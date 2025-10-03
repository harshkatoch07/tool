// src/components/shared/SharedPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DownloadIcon from "@mui/icons-material/Download";
import { useNavigate } from "react-router-dom";

import SmartDataTable from "../../ui/SmartDataTable";
import FilterBar from "../../ui/FilterBar";
import { buildSharedColumns } from "./sharedColumns";
import ApprovalPathDialog from "../initiate/ApprovalPathDialog"; // ← NEW

// ─────────────────────────────────────────────
// Generic fetch wrappers that add bearer token
// ─────────────────────────────────────────────
async function apiGet(url) {
  const headers = {};
  const token = localStorage.getItem("token");
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiBlob(url) {
  const headers = {};
  const token = localStorage.getItem("token");
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.blob();
}
async function viewAttachmentBlob(url) {
  const blob = await apiBlob(url);
  const blobUrl = window.URL.createObjectURL(blob);
  window.open(blobUrl, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
async function downloadAttachmentBlob(url, filename = "file") {
  const blob = await apiBlob(url);
  const href = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const fmt = (d) => (d ? new Date(d).toLocaleString() : "—");
const money = (n) =>
  typeof n === "number"
    ? n.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : n != null
    ? Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : "—";
const showStatus = (s) => (s === "FinalReceiver" ? "Final Receiver" : s || "—");
const bytes = (n) =>
  n == null
    ? "—"
    : n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)} MB`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(1)} KB`
    : `${n} B`;

// Map API row to a consistent shape for the table
const normalize = (r) => ({
  id: r.FundRequestId ?? r.fundRequestId ?? r.Id ?? r.id,
  title: r.Title ?? r.title ?? r.approvals ?? "—",
  workflowName:
    r.WorkflowName ?? r.workflowName ?? r.Particulars ?? r.particulars ?? "—",
  department: r.Department ?? r.department ?? "—",
  amount: r.Amount ?? r.amount ?? null,
  status: r.Status ?? r.status ?? r.approvalStatus ?? "—",
  createdAt: r.CreatedAt ?? r.createdAt ?? r.initiatedDate ?? null,
  initiatorName: r.InitiatorName ?? r.initiatedBy ?? r.initiator ?? "—",
lastActionAt:
    r.LastActionAt ??
    r.lastActionAt ??
    r.lastActionDate ??
    r.ActionedAt ??
    r.actionedAt ??
    null,
    neededBy: r.NeededBy ?? r.approvalNeededBy ?? r.ApprovalNeededByDate ?? null,
});

export default function SharedPage() {
  const navigate = useNavigate();

  const [rawRows, setRawRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Header / filter toggle
  const [showFilters, setShowFilters] = useState(true);

  // ApprovalPath dialog state (replaces Drawer)
  const [pathOpen, setPathOpen] = useState(false);
  const [pathBusy, setPathBusy] = useState(false);
  const [trail, setTrail] = useState(null);

  // Details dialog
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [details, setDetails] = useState(null);

  // SmartDataTable state (client-side)
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(30);
  const [sortModel, setSortModel] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  async function loadFinalInbox() {
    setLoading(true);
    try {
      const data = await apiGet("/api/approvals?filter=final");
      const rows = Array.isArray(data) ? data.map(normalize) : [];
      setRawRows(rows);
    } catch (e) {
      console.error(e);
      setRawRows([]);
    } finally {
      setLoading(false);
    }
  }

  // wire the eye icon to open ApprovalPathDialog
  async function openTrail(fundRequestId) {
    setPathOpen(true);
    setTrail(null);
    setPathBusy(true);
    try {
      const t = await apiGet(`/api/approvals/${fundRequestId}/trail`);
      // Optionally adapt to dialog shape if needed
      setTrail(t);
    } catch (e) {
      console.error(e);
    } finally {
      setPathBusy(false);
    }
  }

  // details loader (row/title click)
  async function openDetails(fundRequestId) {
    setDetailsOpen(true);
    setDetails(null);
    setDetailsBusy(true);
    try {
      const d = await apiGet(`/api/final-receiver/requests/${fundRequestId}`);
      setDetails(d);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailsBusy(false);
    }
  }

  // Attachments actions
  const handleViewAttachment = async (fundRequestId, attachmentId) => {
    if (!fundRequestId) return alert("Missing request id.");
    try {
      await viewAttachmentBlob(
        `/api/fundrequests/${fundRequestId}/attachments/${attachmentId}/download?inline=true`
      );
    } catch (e) {
      console.error(e);
      alert("Could not open attachment.");
    }
  };
  const handleDownloadAttachment = async (fundRequestId, attachmentId, filename) => {
    if (!fundRequestId) return alert("Missing request id.");
    try {
      await downloadAttachmentBlob(
        `/api/fundrequests/${fundRequestId}/attachments/${attachmentId}/download`,
        filename || "file"
      );
    } catch (e) {
      console.error(e);
      alert("Download failed.");
    }
  };

  useEffect(() => {
    loadFinalInbox();
  }, []);

  // ─────────────────────────────────────────────
  // Client-side search / filter / sort / page
  // ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rawRows.filter((r) => {
      const textMatch =
        !q ||
        [r.id, r.title, r.workflowName, r.department, r.initiatorName, showStatus(r.status)]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const statusMatch = !statusFilter || showStatus(r.status) === statusFilter;
      return textMatch && statusMatch;
    });
  }, [rawRows, search, statusFilter]);

  const sorted = useMemo(() => {
    if (!sortModel[0]) {
      return [...filtered].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
    }
    const { field, sort } = sortModel[0];
    const dir = sort === "desc" ? -1 : 1;
    const get = (r) => {
      if (field === "id") return Number(r.id);
      if (field === "title") return r.title || "";
      if (field === "workflowName") return r.workflowName || "";
      if (field === "department") return r.department || "";
      if (field === "createdAt" || field === "lastActionAt" || field === "neededBy")
        return new Date(r[field] || 0).getTime();
      if (field === "amount") return Number(r.amount || 0);
      if (field === "status") return showStatus(r.status);
      return r[field];
    };
    return [...filtered].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      return va > vb ? dir : va < vb ? -dir : 0;
    });
  }, [filtered, sortModel]);

  const paged = useMemo(() => {
    const s = page * rowsPerPage;
    return sorted.slice(s, s + rowsPerPage);
  }, [sorted, page, rowsPerPage]);

  // Status filter options
  const statusOptions = useMemo(() => {
    const set = new Set(rawRows.map((r) => showStatus(r.status)));
    ["Final Receiver", "Provided", "Approved", "Rejected", "Sent Back"].forEach((s) => set.add(s));
    return Array.from(set);
  }, [rawRows]);

  // Columns
  const columns = useMemo(
    () =>
      buildSharedColumns({
        onOpenDetails: openDetails,
        onOpenTrail: openTrail, // ← unchanged, now opens dialog
        money,
        fmt,
        showStatus,
      }),
    [] // handlers/helpers are stable
  );

  // CSV Export
  const exportCsv = () => {
    const headers = [
      "ID",
      "Title",
      "Workflow",
      "Department",
      "Amount",
      "Status",
      "Created",
      "Initiator",
      "Last Action",
      "Needed By",
    ];
    const rows = sorted.map((r) => [
      r.id,
      (r.title || "").replace(/\n/g, " "),
      r.workflowName || "",
      r.department || "",
      typeof r.amount === "number" ? r.amount : Number(r.amount || 0),
      showStatus(r.status),
      r.createdAt ? new Date(r.createdAt).toISOString() : "",
      r.initiatorName || "",
      r.lastActionAt ? new Date(r.lastActionAt).toISOString() : "",
      r.neededBy ? new Date(r.neededBy).toISOString() : "",
    ]);

    const csv =
      [headers, ...rows]
        .map((row) =>
          row
            .map((cell) => {
              const s = String(cell ?? "");
              return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            })
            .join(",")
        )
        .join("\n") + "\n";

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shared-approvals.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      {/* ---- Header ---- */}
      <Box
        sx={{
          mb: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Button
          onClick={() => navigate(-1)}
          startIcon={<ArrowBackIosNewRoundedIcon fontSize="small" />}
          variant="text"
          size="small"
          sx={{ fontWeight: 700, px: 0, color: "common.white" }}
        >
          Shared Approvals (Final Receiver)
        </Button>

        <Button
          onClick={() => setShowFilters((v) => !v)}
          startIcon={<FilterListRoundedIcon />}
          variant="contained"
          size="small"
          sx={{
            borderRadius: 0,
            backgroundColor: "common.white",
            color: "primary.main",
            boxShadow: "none",
            "&:hover": { backgroundColor: "grey.100", boxShadow: "none" },
          }}
        >
          FILTER
        </Button>
      </Box>

      {/* ---- Filter Bar ---- */}
      {showFilters && (
        <Box sx={{ mb: 2, borderRadius : 0.5, overflow: "hidden" }}>
          <FilterBar
            search={search}
            onSearch={(v) => {
              setSearch(v);
              setPage(0);
            }}
            status={statusFilter || "All"}
            onStatusChange={(v) => {
              setStatusFilter(v === "All" ? "" : v);
              setPage(0);
            }}
            statusOptions={statusOptions}
            onClear={() => {
              setSearch("");
              setStatusFilter("");
              setPage(0);
            }}
            onExport={exportCsv}
          />
        </Box>
      )}

      {/* ---- Table ---- */}
      <Paper variant="outlined" sx={{ borderRadius: 0.5, overflow: "hidden" }}>
        <Box sx={{ p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="subtitle2" color="text.secondary">
              Showing requests that are fully approved and assigned to you as a Final Receiver.
            </Typography>
            <Button variant="outlined" onClick={loadFinalInbox} sx={{ borderRadius: 0 }}>
              Refresh
            </Button>
          </Box>

          <SmartDataTable
            columns={columns}
            rows={paged}
            total={sorted.length}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={setPage}
            onRowsPerPageChange={(n) => {
              setRowsPerPage(n);
              setPage(0);
            }}
            sortModel={sortModel}
            onSortModelChange={setSortModel}
            loading={loading}
            searchable
            searchText={search}
            onSearchTextChange={(v) => {
              setSearch(v);
              setPage(0);
            }}
            statusOptions={statusOptions}
            statusFilter={statusFilter}
            onStatusFilterChange={(v) => {
              setStatusFilter(v);
              setPage(0);
            }}
            stickyHeader
            dense
            emptyText="No Records Found"
            getRowId={(r) => r.id}
          />
        </Box>
      </Paper>

      {/* ===== Details Dialog ===== */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>
          {details ? `Request #${details.id}: ${details.title}` : "Request Details"}
        </DialogTitle>
        <DialogContent dividers>
          {detailsBusy ? (
            <Box p={3} display="flex" alignItems="center" justifyContent="center">
              <CircularProgress />
            </Box>
          ) : !details ? (
            <Typography color="text.secondary">Select a request to view details.</Typography>
          ) : (
            <>
              {/* Summary */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 2,
                  mb: 2,
                }}
              >
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Status
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {showStatus(details.status)}
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Amount
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {money(details.amount)}
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Created
                  </Typography>
                  <Typography variant="body1">{fmt(details.createdAt)}</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Initiator
                  </Typography>
                  <Typography variant="body1">
                    {details.initiatorName}
                    {details.initiatorEmail ? ` • ${details.initiatorEmail}` : ""}
                  </Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Department
                  </Typography>
                  <Typography variant="body1">{details.departmentName ?? "—"}</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Project
                  </Typography>
                  <Typography variant="body1">{details.projectName ?? "—"}</Typography>
                </Paper>
              </Box>

              {details.description ? (
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2">Description</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {details.description}
                  </Typography>
                </Paper>
              ) : null}

              {/* Form Data */}
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Form Data
              </Typography>
              <Paper variant="outlined" sx={{ p: 0, mb: 2, overflow: "hidden" }}>
                <SmartDataTable
                  columns={[
                    { field: "name", headerName: "Field", minWidth: 200 },
                    { field: "value", headerName: "Value", minWidth: 300 },
                  ]}
                  rows={(details.fields || []).map((f, i) => ({ id: i, ...f }))}
                  page={0}
                  rowsPerPage={Math.max(5, (details.fields || []).length)}
                  onPageChange={() => {}}
                  onRowsPerPageChange={() => {}}
                  exportable={false}
                  searchable={false}
                  dense
                />
              </Paper>

              {/* Attachments */}
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Attachments
              </Typography>
              <Paper variant="outlined" sx={{ p: 0, mb: 2, overflow: "hidden" }}>
                <SmartDataTable
                  columns={[
                    { field: "fileName", headerName: "File", minWidth: 260 },
                    { field: "contentType", headerName: "Type", minWidth: 160 },
                    {
                      field: "fileSize",
                      headerName: "Size",
                      minWidth: 120,
                      render: (r) => bytes(r.fileSize),
                      valueGetter: (r) => r.fileSize,
                    },
                    {
                      field: "__actions",
                      headerName: "Actions",
                      minWidth: 180,
                      align: "right",
                      headerAlign: "right",
                      sortable: false,
                      render: (r) => (
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            startIcon={<VisibilityIcon fontSize="small" />}
                            onClick={() => handleViewAttachment(details?.id, r.id)}
                          >
                            View
                          </Button>
                          <Button
                            size="small"
                            startIcon={<DownloadIcon fontSize="small" />}
                            onClick={() =>
                              handleDownloadAttachment(details?.id, r.id, r.fileName)
                            }
                          >
                            Download
                          </Button>
                        </Stack>
                      ),
                    },
                  ]}
                  rows={(details.attachments || []).map((a) => ({ id: a.id, ...a }))}
                  page={0}
                  rowsPerPage={Math.max(5, (details.attachments || []).length)}
                  onPageChange={() => {}}
                  onRowsPerPageChange={() => {}}
                  exportable={false}
                  searchable={false}
                  dense
                />
              </Paper>

              {/* Approval Trail (from details API) */}
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Approval Trail
              </Typography>
              <Paper variant="outlined" sx={{ p: 0, overflow: "hidden" }}>
                <SmartDataTable
                  columns={[
                    { field: "level", headerName: "Level", minWidth: 80 },
                    { field: "approverName", headerName: "Approver", minWidth: 200 },
                    {
                      field: "status",
                      headerName: "Status",
                      minWidth: 160,
                      render: (r) => showStatus(r.status),
                      valueGetter: (r) => showStatus(r.status),
                    },
                    {
                      field: "actionedAt",
                      headerName: "Actioned At",
                      minWidth: 180,
                      render: (r) => fmt(r.actionedAt),
                      valueGetter: (r) => r.actionedAt,
                    },
                    { field: "comments", headerName: "Comments", minWidth: 240 },
                  ]}
                  rows={(details.trail || []).map((t, i) => ({ id: i, ...t }))}
                  page={0}
                  rowsPerPage={Math.max(5, (details.trail || []).length)}
                  onPageChange={() => {}}
                  onRowsPerPageChange={() => {}}
                  exportable={false}
                  searchable={false}
                  dense
                />
              </Paper>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ===== Approval Path Dialog (replaces Drawer) ===== */}
      <ApprovalPathDialog
        open={pathOpen}
        onClose={() => setPathOpen(false)}
        trail={trail}          // pass raw API payload
        loading={pathBusy}     // spinner inside dialog while loading
      />
    </Box>
  );
}
