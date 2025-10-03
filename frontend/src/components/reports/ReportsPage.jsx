// src/components/reports/ReportsPage.jsx
import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Stack,
  CircularProgress,
  Button,
  Grid,
  TextField,
  MenuItem,
} from "@mui/material";
import SummarizeIcon from "@mui/icons-material/Summarize";
import GetAppIcon from "@mui/icons-material/GetApp";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate } from "react-router-dom";
import {
  getDecisionRows,
  fetchSummaryBlob,
  fetchSummaryDownloadBlob,
} from "../../api/reportsApi";

// ---------- helpers (consistent with Approvals pages) ----------
const _toNumber = (v) => {
  if (typeof v === "number") return v;
  if (v == null) return NaN;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : NaN;
};
const fmtMoney = (v) => {
  const n = _toNumber(v);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";
};
const fmtDate = (v) => (v ? new Date(v).toLocaleString() : "—");

export default function ReportsPage() {
  const navigate = useNavigate();

  const [decRows, setDecRows] = useState([]);
  const [busyDec, setBusyDec] = useState(false);
  const [errDec, setErrDec] = useState("");
  const [status, setStatus] = useState("All");
  const [from, setFrom] = useState(() =>
    new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)
  );
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchDecisions = async () => {
    try {
      setBusyDec(true);
      setErrDec("");
      const data = await getDecisionRows({ status, from, to, take: 500 });
      setDecRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErrDec(e?.message || "Failed to load decisions.");
    } finally {
      setBusyDec(false);
    }
  };

  useEffect(() => {
    fetchDecisions();
  }, []);

  const handleViewSummary = async (fundRequestId) => {
    if (!fundRequestId) return;
    try {
      const blob = await fetchSummaryBlob(fundRequestId);
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      console.error(e);
      alert("Failed to open summary.");
    }
  };

  const handleDownloadSummary = async (fundRequestId) => {
    if (!fundRequestId) return;
    try {
      const blob = await fetchSummaryDownloadBlob(fundRequestId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `summary-${fundRequestId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Failed to download summary.");
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h4" fontWeight={800}>
          Reports
        </Typography>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<CloseIcon />}
          onClick={() => navigate(-1)}
        >
          Close
        </Button>
      </Stack>

      <Paper sx={{ p: 2, borderRadius: 3, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={3}>
            <TextField
              select
              fullWidth
              size="small"
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <MenuItem value="All">All</MenuItem>
              <MenuItem value="Approved">Approved</MenuItem>
              <MenuItem value="Rejected">Rejected</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="From"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="To"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <Button variant="contained" fullWidth onClick={fetchDecisions}>
              Apply Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2, borderRadius: 3 }}>
        {busyDec ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={22} />
            <Typography>Loading…</Typography>
          </Stack>
        ) : errDec ? (
          <Typography color="error">{errDec}</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Amount</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Decided By</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Decided At</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {decRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>No data for the selected filters.</TableCell>
                </TableRow>
              ) : (
                decRows.map((r) => (
                  <TableRow key={r.fundRequestId} hover>
                    <TableCell>{r.fundRequestId}</TableCell>
                    <TableCell>{r.title}</TableCell>
                    <TableCell>{r.department || "-"}</TableCell>
                    <TableCell align="right">{fmtMoney(r.amount)}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell>{r.decidedBy || "-"}</TableCell>
                    <TableCell>{fmtDate(r.decidedAt)}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          startIcon={<SummarizeIcon />}
                          disabled={!r.fundRequestId}
                          onClick={() => handleViewSummary(r.fundRequestId)}
                        >
                          Summary
                        </Button>
                        
                    </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}
