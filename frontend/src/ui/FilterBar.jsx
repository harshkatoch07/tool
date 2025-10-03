import React from "react";
import {
  Box, Stack, TextField, InputAdornment, IconButton, Button, MenuItem
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import FilterListIcon from "@mui/icons-material/FilterList";
import DownloadIcon from "@mui/icons-material/Download";

export default function FilterBar({
  search, onSearch,
  status, onStatusChange, statusOptions = [],
  department, onDepartmentChange, departmentOptions = [],
  onClear, onExport, extraFilters
}) {
  return (
    <Box
      sx={{
        p: 2,
        mb: 2.5,
        borderRadius: 2,
        bgcolor: "background.paper",
        border: (t) => `1px solid ${t.palette.divider}`,
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <TextField
          value={search ?? ""}
          onChange={(e) => onSearch?.(e.target.value)}
          size="small"
          placeholder="Search by ID, title, department..."
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: (search ?? "") ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => onSearch?.("")}><ClearIcon/></IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{ minWidth: 360 }}
        />

        <TextField
          select size="small" label="Status"
          value={status ?? "All"} onChange={(e) => onStatusChange?.(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="All">All</MenuItem>
          {statusOptions.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>

        <TextField
          select size="small" label="Department"
          value={department ?? "All"} onChange={(e) => onDepartmentChange?.(e.target.value)}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="All">All Departments</MenuItem>
          {departmentOptions.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
        </TextField>

        {extraFilters}

        <Button onClick={onClear} startIcon={<FilterListIcon />} variant="text">
          Clear Filters
        </Button>

        <Box sx={{ flex: 1 }} />

        <Button onClick={onExport} startIcon={<DownloadIcon />} variant="contained">
          Export
        </Button>
      </Stack>
    </Box>
  );
}
