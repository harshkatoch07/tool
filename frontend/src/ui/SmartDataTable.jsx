import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  IconButton,
  InputBase,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import FirstPageIcon from "@mui/icons-material/FirstPage";
import LastPageIcon from "@mui/icons-material/LastPage";

/**
 * SmartDataTable (Replica Skin) — DROP-IN REPLACEMENT
 */

export const DEFAULT_ROWS_PER_PAGE_OPTIONS = [30, 50, 100];

// Safer default id resolver. Accepts (row, index). Falls back to index.
const defaultGetRowId = (r, i) =>
  String(
    r?.FundRequestId ??
      r?.RequestId ??
      r?.Id ??
      r?.id ??
      `row-${i}`
  );

export default function SmartDataTable({
  columns = [],
  rows = [],
  total, // optional; if omitted, uses rows.length
  page = 0, // 0-based
  rowsPerPage = DEFAULT_ROWS_PER_PAGE_OPTIONS[0],
  onPageChange, // (page:number) => void
  onRowsPerPageChange, // (n:number) => void
  getRowId = defaultGetRowId, // UPDATED
  emptyText = "No Records Found",
  maxBodyHeight = 440, // set to null to let it grow
}) {
  const visibleColumns = Array.isArray(columns) ? columns.filter((c) => !c.hide) : [];

  const count = typeof total === "number" ? total : rows?.length || 0;
  const safeRpp = Math.max(1, rowsPerPage || DEFAULT_ROWS_PER_PAGE_OPTIONS[0]);
  const pageCount = Math.max(1, Math.ceil(count / safeRpp));
  const atFirst = page <= 0;
  const atLast = page >= pageCount - 1;

  const goFirst = () => onPageChange && onPageChange(0);
  const goPrev = () => onPageChange && onPageChange(Math.max(0, page - 1));
  const goNext = () => onPageChange && onPageChange(Math.min(pageCount - 1, page + 1));
  const goLast = () => onPageChange && onPageChange(pageCount - 1);

  const [goto, setGoto] = React.useState(String(page + 1));
  React.useEffect(() => setGoto(String(page + 1)), [page]);
  const doGoto = () => {
    const n = Math.max(1, Math.min(pageCount, parseInt(goto || "1", 10)));
    onPageChange && onPageChange(n - 1);
  };

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 0,
        overflow: "hidden",
        border: (t) => `1px solid ${t.palette.divider}`,
        bgcolor: "white",
      }}
    >
      <TableContainer sx={{ maxHeight: maxBodyHeight || undefined }}>
        <Table
          stickyHeader
          size="medium"
          sx={{
            "& th, & td": {
              borderBottom: (t) => `1px solid ${t.palette.divider}`,
            },
            "& thead th": {
              bgcolor: (t) =>
                t.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "#f5f7f9",
              color: (t) => t.palette.text.primary,
              fontWeight: 600,
            },
          }}
        >
          <TableHead>
            <TableRow>
              {visibleColumns.map((col, i) => {
                const headKey =
                  col.field ??
                  col.key ??
                  col.accessor ??
                  col.headerName ??
                  `col-${i}`;
                return (
                  <TableCell
                    key={`h-${headKey}-${i}`}
                    align={col.headerAlign || "left"}
                    style={{
                      minWidth: col.minWidth,
                      width: col.width,
                    }}
                  >
                    {col.headerName || col.field || col.title || String(headKey)}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>

          <TableBody>
            {rows && rows.length > 0 ? (
              rows.map((row, idx) => {
                // Guarantee unique row key even if domain id repeats.
                const baseId = String(getRowId(row, idx));
                const rowKey = `${baseId}::${idx}`;
                return (
                  <TableRow key={rowKey}>
                    {visibleColumns.map((col, cIdx) => {
                      const accessor = col.field ?? col.accessor ?? col.key;
                      const raw =
                        typeof col.valueGetter === "function"
                          ? col.valueGetter(row, idx)
                          : accessor
                          ? row?.[accessor]
                          : undefined;
                      const node =
                        typeof col.render === "function" ? col.render(row, idx) : raw ?? "—";
                      const cellKey =
                        (col.field ?? col.accessor ?? col.key ?? `c-${cIdx}`) + "-" + cIdx;
                      return (
                        <TableCell key={cellKey} align={col.align || "left"}>
                          {node}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={Math.max(1, visibleColumns.length)}>
                  <Box sx={{ py: 2, px: 2, color: "text.secondary" }}>{emptyText}</Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Footer */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          px: 2,
          py: 1.25,
          borderTop: (t) => `1px solid ${t.palette.divider}`,
          bgcolor: "white",
        }}
      >
        {/* Left: Show entries */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
          <Box component="span">Show</Box>
          <Select
            variant="outlined"
            size="small"
            value={rowsPerPage}
            onChange={(e) =>
              onRowsPerPageChange && onRowsPerPageChange(parseInt(String(e.target.value), 10))
            }
            sx={{ height: 32, minWidth: 64 }}
          >
            {DEFAULT_ROWS_PER_PAGE_OPTIONS.map((n) => (
              <MenuItem key={`rpp-${n}`} value={n}>
                {n}
              </MenuItem>
            ))}
          </Select>
          <Box component="span">Entries</Box>
        </Box>

        {/* Middle: Pager */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <IconButton size="small" disabled={atFirst} onClick={goFirst}>
            <FirstPageIcon fontSize="inherit" />
          </IconButton>
          <IconButton size="small" disabled={atFirst} onClick={goPrev}>
            <ChevronLeftIcon fontSize="inherit" />
          </IconButton>
          <IconButton size="small" disabled={atLast} onClick={goNext}>
            <ChevronRightIcon fontSize="inherit" />
          </IconButton>
          <IconButton size="small" disabled={atLast} onClick={goLast}>
            <LastPageIcon fontSize="inherit" />
          </IconButton>
        </Box>

        {/* Right: Go to Page */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
          <Box component="span">Go to Page:</Box>
          <InputBase
            value={goto}
            onChange={(e) => setGoto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doGoto()}
            inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
            sx={{
              border: (t) => `1px solid ${t.palette.divider}`,
              borderRadius: 0,
              px: 1,
              height: 32,
              width: 56,
              bgcolor: "white",
            }}
          />
          <IconButton size="small" onClick={doGoto}>
            <ChevronRightIcon fontSize="inherit" />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  );
}

SmartDataTable.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      field: PropTypes.string.isRequired,
      headerName: PropTypes.string,
      width: PropTypes.number,
      minWidth: PropTypes.number,
      align: PropTypes.oneOf(["left", "right", "center"]),
      headerAlign: PropTypes.oneOf(["left", "right", "center"]),
      valueGetter: PropTypes.func,
      render: PropTypes.func,
      hide: PropTypes.bool,
    })
  ),
  rows: PropTypes.array,
  total: PropTypes.number,
  page: PropTypes.number,
  rowsPerPage: PropTypes.number,
  onPageChange: PropTypes.func,
  onRowsPerPageChange: PropTypes.func,
  // Note: function receives (row, index)
  getRowId: PropTypes.func,
  emptyText: PropTypes.string,
  maxBodyHeight: PropTypes.number,
};
