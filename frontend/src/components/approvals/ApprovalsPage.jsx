import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Box, Paper, Typography, CircularProgress, Alert, Button, Snackbar } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { getApprovals, getApprovalTrail } from "../../api/approvalsApi";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import FilterBar from "../../ui/FilterBar";

import SmartDataTable from "../../ui/SmartDataTable";
import { buildApprovalsColumns } from "./ApprovalsPage.columns";
import { STATUS_OPTIONS, normalizeDbStatus } from "../../utils/status";
import ApprovalPathDialog from "../initiate/ApprovalPathDialog";
import useUrlTab from "../../hooks/useUrlTab";

// ---------- helpers ----------
const toLower = (s) => String(s ?? "").toLowerCase();
const isTrueLike = (v) =>
  v === true || v === 1 || v === "1" || toLower(v) === "true" || toLower(v) === "yes";

const normalizeDecision = (v) => {
  const x = toLower(v);
  if (["approved", "approve", "ok", "accepted", "accept", "done"].includes(x)) return "approved";
  if (["rejected", "reject", "declined", "deny", "denied"].includes(x)) return "rejected";
  if (["sent back", "sent_back", "sendback", "returned"].includes(x)) return "sentback";
  if (!x) return "";
  return x;
};

const normalizeRow = (r) => {
  const myActionRaw =
    r.myAction ?? r.MyAction ?? r.userAction ?? r.UserAction ?? r.decision ?? r.Decision ?? r.action ?? r.Action ?? "";

  const isApprovedByMeRaw =
    r.isApprovedByMe ??
    r.IsApprovedByMe ??
    r.approvedByMe ??
    r.ApprovedByMe ??
    r.myApproved ??
    r.MyApproved ??
    r.iApproved ??
    r.IApproved ??
    null;
   
  const isMyPendingRaw =
    r.isPendingForMe ??
    r.IsPendingForMe ??
    r.isMyPending ??
    r.IsMyPending ??
    r.isAssignedToMe ??
    r.IsAssignedToMe ??
    r.isForMe ??
    r.IsForMe ??
    r.isMyTask ??
    r.IsMyTask ??
    r.myPending ??
    r.MyPending ??
    null;

  const nestedFundRequestId = r?.fundRequest?.id ?? r?.FundRequest?.Id ?? null;
  const fundRequestId = r.fundRequestId ?? r.FundRequestId ?? nestedFundRequestId ?? null;
 const approvalId =
    r.approvalId ?? r.ApprovalId ?? (fundRequestId == null ? r.id ?? r.Id ?? null : null);

  return {
    ref: fundRequestId ?? r.requestRef ?? r.RequestRef ?? "—",
    fundRequestId,
    approvalId,
    title:
      r.approvals ??
      r.Approvals ??
      r.title ??
      r.Title ??
      r.requestTitle ??
      r.RequestTitle ??
      r.particulars ??
      r.Particulars ??
      "—",
    workflow: r.workflow ?? r.Workflow ?? r.workflowName ?? r.WorkflowName ?? r.DisplayName ?? "",
    particulars: r.particulars ?? r.Particulars ?? r.details ?? r.Details ?? r.description ?? r.Description ?? "",
    initiatedBy: r.initiatedBy ?? r.InitiatedBy ?? r.initiatorName ?? r.InitiatorName ?? "",
    created: r.initiatedDate ?? r.InitiatedDate ?? r.created ?? r.Created ?? r.createdAt ?? r.CreatedAt ?? null,
    lastActionAt:
      r.lastActionDate ?? r.LastActionDate ?? r.lastActionAt ?? r.LastActionAt ?? r.actionedAt ?? r.ActionedAt ?? null,
    dueBy:
      r.approvalNeededByDate ??
      r.ApprovalNeededByDate ??
      r.neededBy ??
      r.NeededBy ??
      r.dueBy ??
      r.DueBy ??
      r.requiredByDate ??
      r.deadline ??
      null,
    status: r.approvalStatus ?? r.ApprovalStatus ?? r.status ?? r.Status ?? "—",
    myAction: normalizeDecision(myActionRaw),
    isApprovedByMe: isTrueLike(isApprovedByMeRaw),
    isMyPending: isTrueLike(isMyPendingRaw),
  };
};

const TAB_TITLES = {
  assigned: "Assigned Approvals",
  initiated: "Initiated Approvals",
  approved: "Approved",
  sentback: "Sent Back",
  rejected: "Rejected",
};

const pick = (o, ...keys) => keys.reduce((v, k) => (v ?? o?.[k]), undefined);
function normalizeLooseStatus(s) {
  const x = toLower(s);
  if (x === "created" || x === "initiated") return "Initiated";
  if (x === "upcoming" || x === "pending" || x === "finalreceiver") return "Pending";
  if (x === "approved") return "Approved";
  if (x === "rejected") return "Rejected";
  if (x === "sentback" || x === "returned" || x === "sendback" || x === "sent_back") return "Sent Back";
  return s || "Pending";
}

function adaptTrailForDialogDto(dto, listRow) {
  const rawSteps = Array.isArray(dto?.steps) ? dto.steps : pick(dto, "Steps") || [];
  const finals = Array.isArray(dto?.finalReceivers) ? dto.finalReceivers : pick(dto, "FinalReceivers") || [];

  const outSteps = rawSteps.map((s) => ({
    sequence: s.sequence ?? s.Sequence ?? 0,
    stepName: s.stepName ?? s.StepName ?? "",
    designationName: s.designationName ?? s.DesignationName ?? "",
    approverName: "",
    status: normalizeLooseStatus(s.status ?? s.Status),
    assignedAt: s.assignedAt ?? s.AssignedAt ?? null,
    actionedAt: s.actionedAt ?? s.ActionedAt ?? null,
    remarks: s.comments ?? s.Comments ?? "",
    isInitiator: toLower(s.stepName ?? s.StepName) === "initiator" || (s.sequence ?? s.Sequence) === 0,
  }));

  const hasFinalStep =
    outSteps.some((s) => toLower(s.stepName) === "final receiver" || toLower(s.stepName) === "final approval");

  if (!hasFinalStep && finals.length > 0) {
    const maxSeq = outSteps.reduce((m, s) => Math.max(m, Number(s.sequence || 0)), 0);
    const allApproved = finals.every((f) => toLower(f.status ?? f.Status) === "approved");
    const finalStatus = allApproved ? "Approved" : "Pending";

    outSteps.push({
      sequence: maxSeq + 1,
      stepName: "Final Approval",
      designationName: "Final Approval",
      approverName: "",
      status: finalStatus,
      assignedAt: null,
      actionedAt: null,
      remarks: "",
      isInitiator: false,
    });
  }

  outSteps.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

  const initiatorName = listRow?.initiatedBy || dto?.initiatorName || pick(dto, "InitiatorName") || "Initiator";

  return {
    fundRequestId: dto?.fundRequestId ?? dto?.FundRequestId ?? listRow?.fundRequestId ?? listRow?.ref,
    title: dto?.title ?? dto?.Title ?? listRow?.title ?? "",
    createdAt: dto?.createdAt ?? dto?.CreatedAt ?? listRow?.created ?? null,
    requestStatus: normalizeLooseStatus(dto?.requestStatus ?? dto?.RequestStatus ?? listRow?.status ?? "Pending"),
    initiatorName,
    steps: outSteps,
  };
}

// ---- Tab scoping: include items user approved in Approved tab ----
const byTab = (tab, rows) => {
  const statusOf = (x) => normalizeDbStatus(x?.status);
  return tab === "approved"
    ? rows.filter((r) => statusOf(r) === "Approved" || r.isApprovedByMe === true || r.myAction === "approved")
    : rows;
};

export default function ApprovalsPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // URL is the single source of truth for tab
  const [tab] = useUrlTab("assigned", "tab");

  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
const [snackbar, setSnackbar] = useState({ open: false, message: "" });
  // table UI state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(30);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sortModel, setSortModel] = useState([]);

  // header actions
  const [showFilters, setShowFilters] = useState(false);

  // dialogs
  const [trailOpen, setTrailOpen] = useState(false);
  const [trailRow, setTrailRow] = useState(null);
  const [trailData, setTrailData] = useState(null);
  const [trailLoading, setTrailLoading] = useState(false);
  const [trailError, setTrailError] = useState("");
  const [trailCache, setTrailCache] = useState({});

  useEffect(() => {
    const message = location.state?.snackbar?.message;
    if (message) {
      setSnackbar({ open: true, message });
      navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  // load list on tab change
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setBusy(true);
        setError("");
        const token = localStorage.getItem("token");
        const data = await getApprovals(tab, token);
        const normalized = Array.isArray(data) ? data.map(normalizeRow) : [];
        if (alive) {
          setRows(normalized);
          setPage(0); // reset paging on tab swap
        }
      } catch (e) {
        if (alive) {
          setRows([]);
          setError(e?.message || "Failed to load approvals.");
        }
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tab]);

  // scope rows by tab
  const tabScoped = useMemo(() => byTab(tab, rows), [tab, rows]);

  // filter + sort + paginate (client)
  const filtered = useMemo(() => {
    const q = (search || "").toLowerCase();
    return tabScoped.filter((r) => {
      const s = normalizeDbStatus(r.status);
      const matchStatus = tab === "approved" ? true : !status || s === status;
      const matchText =
        !q ||
        String(r.ref).toLowerCase().includes(q) ||
        (r.title || "").toLowerCase().includes(q) ||
        (r.particulars || "").toLowerCase().includes(q) ||
        (r.initiatedBy || "").toLowerCase().includes(q);
      return matchStatus && matchText;
    });
  }, [tabScoped, search, status, tab]);

  const sorted = useMemo(() => {
    if (!sortModel[0]) return filtered;
    const { field, sort } = sortModel[0];
    const dir = sort === "desc" ? -1 : 1;
    const val = (row) => {
      if (field === "created" || field === "lastActionAt" || field === "dueBy")
        return row[field] ? new Date(row[field]).getTime() : 0;
      return (row[field] ?? "").toString().toLowerCase();
    };
    return [...filtered].sort((a, b) => (val(a) > val(b) ? 1 * dir : val(a) < val(b) ? -1 * dir : 0));
  }, [filtered, sortModel]);

  const paged = useMemo(() => {
    const start = page * rowsPerPage;
    return sorted.slice(start, start + rowsPerPage);
  }, [sorted, page, rowsPerPage]);

  // trail API (expects fundRequestId)
  const fetchTrail = useCallback(async (fundRequestId) => getApprovalTrail(fundRequestId), []);

  const navigateToEdit = useCallback(
  (row) => {
      const fundRequestId = row.fundRequestId ?? row.ref;
      const approvalId = row.approvalId ?? row.id;
      const qs = new URLSearchParams({ tab, ...(approvalId ? { approvalId: String(approvalId) } : {}) });

      if (tab === "sentback" && row.isMyPending === true) {
        qs.set("role", "approver");
        navigate(`/approvals/${fundRequestId}/edit?${qs.toString()}`);
        return;
      }

      if (tab === "initiated" || tab === "sentback" || tab === "assigned") {
        navigate(`/resubmit/${fundRequestId}?${qs.toString()}`);
      } else {
        navigate(`/approvals/${fundRequestId}/edit?${qs.toString()}`);
      }
    },
    [navigate, tab]
  );

  const handleOpenTrail = useCallback(
    async (row) => {
      setTrailRow(row);
      setTrailOpen(true);
      setTrailError("");
      setTrailData(null);

      const key = row.fundRequestId ?? row.ref;
      const numericKey = Number(key);
      if (!numericKey || Number.isNaN(numericKey)) {
        setTrailError("Missing FundRequestId for trail");
        return;
      }

      if (trailCache[numericKey]) {
        setTrailData(trailCache[numericKey]);
        return;
      }
      try {
        setTrailLoading(true);
        const dto = await fetchTrail(numericKey);
        setTrailCache((p) => ({ ...p, [numericKey]: dto || null }));
        setTrailData(dto || null);
      } catch (e) {
        setTrailError(e?.message || "Failed to load trail");
      } finally {
        setTrailLoading(false);
      }
    },
    [fetchTrail, trailCache]
  );

  const columns = useMemo(
    () =>
      buildApprovalsColumns({
        onOpenInitiate: navigateToEdit,
        onOpenTrail: handleOpenTrail,
        onEdit: navigateToEdit,
        onDelete: (row) => alert(`Delete not implemented for Ref ${row.ref}`),
        onRetry: (row) => alert(`Retry not implemented for Ref ${row.ref}`),
      }),
    [navigateToEdit, handleOpenTrail]
  );

  const dialogTrail = useMemo(() => {
    if (!trailData || !trailRow) return null;
    return adaptTrailForDialogDto(trailData, trailRow);
  }, [trailData, trailRow]);
 const handleSnackbarClose = (_, reason) => {
    if (reason === "clickaway") return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Box
        sx={{ mb: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}
      >
        <Button
          onClick={() => navigate(-1)}
          startIcon={<ArrowBackIosNewRoundedIcon fontSize="large" />}
          variant="text"
          size="large"
          sx={{ fontWeight: 700, px: 0, color: "common.white", "& .MuiSvgIcon-root": { color: "common.white" } }}
        >
          {TAB_TITLES[tab] || "Approvals"}
        </Button>

        <Button
          onClick={() => setShowFilters((v) => !v)}
          startIcon={<FilterListRoundedIcon />}
          variant="outlined"
          size="small"
          sx={{
            borderRadius: 0,
            backgroundColor: "common.white",
            color: "primary.main",
            border: "0px solid rgba(255,255,255,0.35)",
            boxShadow: "none",
            fontWeight: 600,
            "&:hover": { backgroundColor: "grey.100", boxShadow: "none", borderColor: "rgba(255,255,255,0.6)" },
          }}
        >
          FILTER
        </Button>
      </Box>

      {/* Collapsible filter bar */}
      {showFilters && (
        <Box sx={{ mb: 2 }}>
          <FilterBar
            search={search}
            onSearch={(v) => {
              setSearch(v);
              setPage(0);
            }}
            status={status || "All"}
            onStatusChange={(v) => {
              setStatus(v === "All" ? "" : v);
              setPage(0);
            }}
            statusOptions={STATUS_OPTIONS}
            onClear={() => {
              setSearch("");
              setStatus("");
              setPage(0);
            }}
            onExport={() => {}}
          />
        </Box>
      )}

      {/* Table */}
      <Paper variant="outlined" sx={{ borderRadius: 0.5, overflow: "hidden" }}>
        <Box sx={{ p: 2 }}>
          {busy ? (
            <Box sx={{ p: 4, display: "flex", alignItems: "center", gap: 2 }}>
              <CircularProgress size={22} />
              <Typography>Loading…</Typography>
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : (
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
              searchable
              searchText={search}
              onSearchTextChange={(v) => {
                setSearch(v);
                setPage(0);
              }}
              statusOptions={STATUS_OPTIONS}
              statusFilter={status}
              onStatusFilterChange={(v) => {
                setStatus(v);
                setPage(0);
              }}
              stickyHeader
              dense
              loading={busy}
              emptyText="No Records Found"
              getRowId={(r) => r.fundRequestId ?? r.approvalId ?? r.ref}
            />
          )}
        </Box>
      </Paper>

      {/* Approval Path */}
      <ApprovalPathDialog
        open={trailOpen}
        onClose={() => setTrailOpen(false)}
        trail={dialogTrail}
        loading={trailLoading}
        error={trailError}
      />
        <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={handleSnackbarClose} severity="success" sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
