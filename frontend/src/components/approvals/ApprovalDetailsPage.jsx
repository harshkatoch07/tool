// src/components/approvals/ApprovalDetailsPage.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Divider,
  Chip,
  Tooltip,
  IconButton,
  Snackbar,
  Alert,
  Dialog,
  AppBar,
  Toolbar,
  TextField,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Stack,
  Button,
  Paper,
  Slide,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import LoadingButton from "@mui/lab/LoadingButton";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DoNotDisturbIcon from "@mui/icons-material/DoNotDisturb";
import UndoIcon from "@mui/icons-material/Undo";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CloseIcon from "@mui/icons-material/Close";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DownloadIcon from "@mui/icons-material/Download";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ImageIcon from "@mui/icons-material/Image";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
// edit controls
import AddCircleIcon from "@mui/icons-material/AddCircle";
import ChangeCircleIcon from "@mui/icons-material/ChangeCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import { jwtDecode } from "jwt-decode";

// ✅ Base URL normalization
const RAW = process.env.REACT_APP_API_BASE || "/api";
const API_BASE = RAW.endsWith("/api") ? RAW : `${RAW.replace(/\/$/, "")}/api`;

// Auth headers for API requests
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const ShadyButton = styled(LoadingButton)(({ btncolor }) => ({
  textTransform: "none",
  fontWeight: 600,
  borderRadius: 12,
  padding: "10px 18px",
  boxShadow:
    btncolor === "approve"
      ? "0 6px 14px rgba(16,185,129,.25)"
      : btncolor === "reject"
      ? "0 6px 14px rgba(239,68,68,.25)"
      : "0 6px 14px rgba(249,115,22,.25)",
  transition: "transform 120ms ease, box-shadow 120ms ease",
  "&:hover": {
    transform: "translateY(-1px)",
    boxShadow:
      btncolor === "approve"
        ? "0 10px 22px rgba(16,185,129,.35)"
        : btncolor === "reject"
        ? "0 10px 22px rgba(239,68,68,.35)"
        : "0 10px 22px rgba(249,115,22,.35)",
  },
}));

const FieldRow = ({ label, value, mono = false }) => (
  <Grid container spacing={0.2} sx={{ py: 0.5 }}>
    <Grid item xs={12} sm={4} md={3}>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
    </Grid>
    <Grid item xs={12} sm={8} md={9}>
      <Typography
        variant="body1"
        sx={{ fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "inherit" }}
      >
        {value ?? "—"}
      </Typography>
    </Grid>
  </Grid>
);

const isTextish = (type, name) =>
  (type && (type.startsWith("text/") || type.includes("json") || type.includes("xml"))) ||
  /\.(txt|json|csv|md|log|xml|yml|yaml)$/i.test(name || "");

// ---------- money/date helpers ----------
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
const fmtShortDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

// small getter to support camel/Pascal casing from API
const getProp = (o, lower, upper) => (o ? o[lower] ?? o[upper] : undefined);

export default function ApprovalDetailsPage(props) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // If route is /fundrequest/:id OR parent passed mode="fund", use fundrequest API
  const isFund = (props && props.mode === "fund") || location.pathname.startsWith("/fundrequest/");

  const [approval, setApproval] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState({ open: false, severity: "success", msg: "" });
  const [dialog, setDialog] = useState({ open: false, type: null, note: "" });

  const [attachments, setAttachments] = useState([]);
  const [attBusy, setAttBusy] = useState(false);

  // server-driven flag (may be null while loading/failing)
  const [serverCanEdit, setServerCanEdit] = useState(null);

  const [preview, setPreview] = useState({ open: false, name: "", type: "", blobUrl: "", text: "" });

  // NEW: form snapshot dialog
  const [formOpen, setFormOpen] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [formFields, setFormFields] = useState([]); // [{label, value, key}...]

  // refs for Add/Replace inputs
  const addInputRef = useRef(null);
  const replaceInputRefs = useRef({}); // attId -> input

  useEffect(() => {
    return () => {
      if (preview.blobUrl) URL.revokeObjectURL(preview.blobUrl);
    };
  }, [preview.blobUrl]);

  const fetchApproval = useCallback(
    async (signal) => {
      try {
        setLoading(true);
        const url = isFund
          ? `${API_BASE}/fundrequests/${id}`
          : `${API_BASE}/approvals/${id}`;
        const res = await axios.get(url, { headers: authHeaders(), signal });
        setApproval(res.data);
      } catch (err) {
        if (!axios.isCancel(err)) {
          console.error("❌ Failed to fetch approval details", err);
          setToast({ open: true, severity: "error", msg: "Failed to load approval." });
        }
      } finally {
        setLoading(false);
      }
    },
    [id, isFund]
  );

  const fetchAttachments = useCallback(async (fundRequestId, signal) => {
    if (!fundRequestId) return;
    try {
      setAttBusy(true);
      const res = await axios.get(`${API_BASE}/fundrequests/${fundRequestId}/attachments`, {
        headers: authHeaders(),
        signal,
      });
      setAttachments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (!axios.isCancel(err)) {
        console.error("❌ Failed to fetch attachments", err);
        setAttachments([]);
      }
    } finally {
      setAttBusy(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchApproval(controller.signal);
    return () => controller.abort();
  }, [fetchApproval]);

  // Compute fundRequestId for all attachment routes
  const fundRequestId = useMemo(() => {
    if (!approval) return null;
    return (
      getProp(approval, "fundRequestId", "FundRequestId") ??
      getProp(approval, "requestId", "RequestId") ??
      getProp(approval, "id", "Id") ??
      null
    );
  }, [approval]);

  useEffect(() => {
    if (!fundRequestId) return;
    const controller = new AbortController();
    fetchAttachments(fundRequestId, controller.signal);
    return () => controller.abort();
  }, [fundRequestId, fetchAttachments]);

  // ✅ Ask server if the current user can edit attachments for this fund request
  useEffect(() => {
    if (!fundRequestId) return;
    let alive = true;
    (async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/fundrequests/${fundRequestId}/attachments/can-edit`,
          { headers: authHeaders() }
        );
        if (alive) setServerCanEdit(typeof res.data?.canEdit === "boolean" ? res.data.canEdit : null);
      } catch {
        if (alive) setServerCanEdit(null); // fall back to heuristic
      }
    })();
    return () => { alive = false; };
  }, [fundRequestId]);

  // Fallback heuristic: current user is initiator AND status is Pending/SentBack
  const userIdRaw = useMemo(() => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      const payload = jwtDecode(token) || {};
      return (
        payload.UserId ??
        payload.userId ??
        payload.nameid ??
        payload.sub ??
        null
      );
    } catch {
      return null;
    }
  }, []);

  const initiatorIdRaw = getProp(approval || {}, "initiatorId", "InitiatorId");
  const statusRaw = getProp(approval || {}, "status", "Status") || "Pending";

  const canEditComputed = useMemo(() => {
    const allowedStatus = /^(Pending|SentBack|Sent Back)$/i.test(String(statusRaw || ""));
    if (!allowedStatus || !userIdRaw || !initiatorIdRaw) return false;

    // Compare both as numbers if possible, else as strings
    const asNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const nu = asNum(userIdRaw);
    const ni = asNum(initiatorIdRaw);
    if (nu != null && ni != null) return nu === ni;
    return String(userIdRaw).trim().toLowerCase() === String(initiatorIdRaw).trim().toLowerCase();
  }, [statusRaw, userIdRaw, initiatorIdRaw]);

  // Final decision prefers server answer; if null, use heuristic
  const canEditAttachments = (serverCanEdit ?? canEditComputed) && !!fundRequestId;

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "a") setDialog({ open: true, type: "Approve", note: "" });
      if (k === "r") setDialog({ open: true, type: "Reject", note: "" });
      if (k === "b") setDialog({ open: true, type: "SendBack", note: "" });
      if (k === "f") openFormSnapshot(); // NEW
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const statusChip = useMemo(() => {
    const s = String(statusRaw).toLowerCase();
    const map = {
      pending: { color: "warning", label: "Pending" },
      approved: { color: "success", label: "Approved" },
      rejected: { color: "error", label: "Rejected" },
      "sent back": { color: "default", label: "Sent Back" },
      sendback: { color: "default", label: "Sent Back" },
      sentback: { color: "default", label: "Sent Back" },
    };
    const { color, label } = map[s] || map.pending;
    return <Chip size="small" label={label} color={color} sx={{ fontWeight: 700 }} />;
  }, [statusRaw]);

  // Safe fallbacks for top section fields
  const refId =
    getProp(approval || {}, "fundRequestId", "FundRequestId") ??
    getProp(approval || {}, "requestId", "RequestId") ??
    getProp(approval || {}, "id", "Id");

  const title =
    getProp(approval || {}, "requestTitle", "RequestTitle") ??
    getProp(approval || {}, "title", "Title");

  const amountVal = getProp(approval || {}, "amount", "Amount");

  const createdAt =
    getProp(approval || {}, "createdAt", "CreatedAt") ??
    getProp(approval || {}, "created", "Created");

  const workflowName =
    getProp(approval || {}, "workflowName", "WorkflowName") ?? getProp(approval || {}, "workflow", "Workflow");
    const projectName =
  getProp(approval || {}, "projectName", "ProjectName") ?? getProp(approval || {}, "project", "Project");

  const departmentName =
    getProp(approval || {}, "departmentName", "DepartmentName") ??
    getProp(approval || {}, "department", "Department");

  const initiatorName =
    getProp(approval || {}, "initiatorName", "InitiatorName") ??
    getProp(approval || {}, "initiator", "Initiator");

  const copyId = async () => {
    try {
      if (refId == null) return;
      await navigator.clipboard.writeText(String(refId));
      setToast({ open: true, severity: "info", msg: "ID copied to clipboard" });
    } catch {
      setToast({ open: true, severity: "warning", msg: "Clipboard unavailable." });
    }
  };

  const openConfirm = (type) => setDialog({ open: true, type, note: "" });
  const closeConfirm = () => setDialog({ open: false, type: null, note: "" });

  const handleAction = async () => {
    if (!dialog.type || busy) return;
    try {
      setBusy(true);
      await axios.post(
        `${API_BASE}/approvals/${id}/action`,
        { action: dialog.type, comments: dialog.note || "" },
        { headers: authHeaders() }
      );
      setToast({
        open: true,
        severity: dialog.type === "Approve" ? "success" : dialog.type === "Reject" ? "error" : "warning",
        msg:
          dialog.type === "Approve"
            ? "Request approved."
            : dialog.type === "Reject"
            ? "Request rejected."
            : "Request sent back.",
      });
      closeConfirm();
      const controller = new AbortController();
      await fetchApproval(controller.signal);
      controller.abort();
      setTimeout(() => navigate("/"), 600);
    } catch (err) {
      console.error(`❌ Failed to ${dialog.type} request`, err);
      setToast({ open: true, severity: "error", msg: "Action failed. Try again." });
    } finally {
      setBusy(false);
    }
  };

  // ==== Attachments: View / Download use fundRequestId in path ====
  const viewAttachment = async (attachmentId, filename) => {
    try {
      const res = await axios.get(
        `${API_BASE}/fundrequests/${fundRequestId}/attachments/${attachmentId}/download?inline=true`,
        { headers: authHeaders(), responseType: "blob" }
      );
      const type = res.headers["content-type"] || res.data.type || "";
      const name = filename || "file";
      const blob = res.data;
      const blobUrl = URL.createObjectURL(blob);

      if (isTextish(type, name)) {
        const text = await blob.text();
        setPreview({ open: true, name, type: type || "text/plain", blobUrl, text });
      } else {
        setPreview({ open: true, name, type, blobUrl, text: "" });
      }
    } catch (e) {
      console.error("❌ View failed", e);
      setToast({ open: true, severity: "error", msg: "Could not open attachment." });
    }
  };

  const downloadAttachment = async (attachmentId, filename) => {
    try {
      const res = await axios.get(
        `${API_BASE}/fundrequests/${fundRequestId}/attachments/${attachmentId}/download`,
        { headers: authHeaders(), responseType: "blob" }
      );
    const href = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename || "file";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
    } catch (e) {
      console.error("❌ Download failed", e);
      setToast({ open: true, severity: "error", msg: "Download failed." });
    }
  };

  const closePreview = () => {
    if (preview.blobUrl) URL.revokeObjectURL(preview.blobUrl);
    setPreview({ open: false, name: "", type: "", blobUrl: "", text: "" });
  };

  // Add/Replace/Delete handlers
  const onAddAttachment = async (e) => {
    const file = e.target?.files?.[0];
    if (!file || !fundRequestId) return;
    try {
      setAttBusy(true);
      const form = new FormData();
      form.append("file", file);
      await axios.post(`${API_BASE}/fundrequests/${fundRequestId}/attachments`, form, {
        headers: { ...authHeaders() },
      });
      setToast({ open: true, severity: "success", msg: "Attachment added." });
      await fetchAttachments(fundRequestId);
    } catch (err) {
      console.error("❌ Add attachment failed", err);
      setToast({ open: true, severity: "error", msg: "Failed to add attachment." });
    } finally {
      if (addInputRef.current) addInputRef.current.value = "";
      setAttBusy(false);
    }
  };

  const onReplaceAttachment = async (attId, e) => {
    const file = e.target?.files?.[0];
    if (!file || !fundRequestId) return;
    try {
      setAttBusy(true);
      const form = new FormData();
      form.append("file", file);
      await axios.post(`${API_BASE}/fundrequests/${fundRequestId}/attachments/${attId}/replace`, form, {
        headers: { ...authHeaders() },
      });
      setToast({ open: true, severity: "success", msg: "Attachment replaced." });
      await fetchAttachments(fundRequestId);
    } catch (err) {
      console.error("❌ Replace attachment failed", err);
      setToast({ open: true, severity: "error", msg: "Failed to replace attachment." });
    } finally {
      if (replaceInputRefs.current[attId]) replaceInputRefs.current[attId].value = "";
      setAttBusy(false);
    }
  };

  const onDeleteAttachment = async (attId) => {
    if (!fundRequestId) return;
    if (!window.confirm("Delete this attachment?")) return;
    try {
      setAttBusy(true);
      await axios.delete(`${API_BASE}/fundrequests/${fundRequestId}/attachments/${attId}`, {
        headers: authHeaders(),
      });
      setToast({ open: true, severity: "warning", msg: "Attachment deleted." });
      await fetchAttachments(fundRequestId);
    } catch (err) {
      console.error("❌ Delete attachment failed", err);
      setToast({ open: true, severity: "error", msg: "Failed to delete attachment." });
    } finally {
      setAttBusy(false);
    }
  };

  // open + fetch form snapshot (and pretty-print Amount)
  const openFormSnapshot = async () => {
    if (formBusy) return;
    // Optional guard: this endpoint exists only for approvals
    if (isFund) {
      setToast({ open: true, severity: "info", msg: "Form snapshot is available after approval is created." });
      return;
    }
    setFormBusy(true);
    try {
      const res = await axios.get(`${API_BASE}/approvals/${id}/form-snapshot`, {
        headers: authHeaders(),
      });
      const rows = Array.isArray(res.data?.fields) ? res.data.fields : [];
      const isAmount = (s) => typeof s === "string" && /amount/i.test(s);

      const pretty = rows.map((r) => {
        let v = r.value;
        if (isAmount(r.label) || isAmount(r.key)) {
          v = fmtMoney(v);
        } else if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
          const t = new Date(v);
          if (!isNaN(t)) v = t.toLocaleString();
        }
        return { key: r.key, label: r.label, value: v ?? "—" };
      });
      setFormFields(pretty);
      setFormOpen(true);
    } catch (e) {
      console.error("❌ form-snapshot failed", e);
      setToast({ open: true, severity: "error", msg: "Could not load full form." });
    } finally {
      setFormBusy(false);
    }
  };

  // Click anywhere on the card (except on buttons/links) to open the dialog
  const onCardClick = (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    const isInteractive = ["button", "a", "svg", "path", "input", "textarea"].includes(tag);
    if (isInteractive) return;
    openFormSnapshot();
  };

  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        <LinearProgress />
      </Box>
    );
  }
  if (!approval) return <Typography sx={{ p: 3 }}>No approval found.</Typography>;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: "background.default" }}>
      <Grid container justifyContent="center">
        <Grid item xs={12} md={9} lg={7}>
          {/* add role/aria + onClick to open dialog */}
          <Card
            elevation={3}
            sx={{ borderRadius: 3, overflow: "visible", position: "relative", zIndex: 1, cursor: "pointer" }}
            onClick={onCardClick}
            aria-label="Open full form (press F)"
            title="Click to view full form (shortcut: F)"
          >
            <CardHeader
              title={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="h5" fontWeight={800}>
                    Approval Details
                  </Typography>
                  {statusChip}
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ ml: 1 }}>
                    <InfoOutlinedIcon fontSize="small" />
                    <Typography variant="caption" color="text.secondary">
                      Click the card or press <b>F</b> to view full form
                    </Typography>
                  </Stack>
                </Box>
              }
              action={
                <Tooltip title="Copy ID">
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); copyId(); }} aria-label="Copy ID">
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              }
              sx={{ pb: 1.5 }}
            />
            {busy && <LinearProgress />}

            <CardContent sx={{ pt: 0 }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 2.5,
                }}
              >
                <Box>
                  <FieldRow label="ID" value={refId} mono />
                  <FieldRow label="Title" value={title} />
                  <FieldRow label="Amount" value={fmtMoney(amountVal)} />
                  <FieldRow label="Date" value={fmtShortDate(createdAt)} />
                </Box>
                <Box>
                  <FieldRow label="Workflow" value={workflowName || "N/A"} />
                  <FieldRow label="Project" value={projectName || "N/A"} />
                  <FieldRow label="Department" value={departmentName || "N/A"} />
                  <FieldRow label="Status" value={getProp(approval, "status", "Status")} />
                  <FieldRow label="Initiator" value={initiatorName || "—"} />
                </Box>
              </Box>

              {getProp(approval, "summary", "Summary") && (
                <>
                  <Divider sx={{ my: 2.5 }} />
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 700 }}>
                    Summary
                  </Typography>
                  <Typography variant="body1">{getProp(approval, "summary", "Summary")}</Typography>
                </>
              )}

              {/* Attachments */}
              <Divider sx={{ my: 2.5 }} />
              <Box onClick={(e) => e.stopPropagation()}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      Attachments
                    </Typography>
                    {attBusy && <Typography variant="body2" color="text.secondary">Loading…</Typography>}
                  </Stack>

                  {canEditAttachments && (
                    <>
                      <input
                        type="file"
                        ref={addInputRef}
                        style={{ display: "none" }}
                        onChange={onAddAttachment}
                      />
                      <Button
                        size="small"
                        startIcon={<AddCircleIcon />}
                        onClick={() => addInputRef.current?.click()}
                      >
                        Add
                      </Button>
                    </>
                  )}
                </Stack>

                {attachments.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No attachments.</Typography>
                ) : (
                  <Stack spacing={1}>
                    {attachments.map((f) => (
                      <Stack
                        key={f.id ?? f.Id}
                        direction="row"
                        alignItems="center"
                        spacing={1}
                        sx={{ p: 1, borderRadius: 1, "&:hover": { bgcolor: "#fafafa" } }}
                      >
                        <InsertDriveFileIcon fontSize="small" />
                        <Typography sx={{ flex: 1 }} title={f.fileName ?? f.FileName}>
                          {(f.fileName ?? f.FileName) || ""}
                          <Typography component="span" variant="caption" color="text.secondary">
                            {" "}
                            {(f.fileSize ?? f.SizeBytes)
                              ? ((v) => (v < 1024 ? `${v} B` : v < 1024 * 1024 ? `${(v / 1024).toFixed(0)} KB` : `${(v / (1024 * 1024)).toFixed(1)} MB`))(f.fileSize ?? f.SizeBytes)
                              : ""}
                            {f.uploadedAt || f.UploadedAt
                              ? ` • ${new Date(f.uploadedAt ?? f.UploadedAt).toLocaleString()}`
                              : ""}
                          </Typography>
                        </Typography>

                        <Tooltip title="View">
                          <IconButton
                            size="small"
                            aria-label="View attachment"
                            onClick={() => viewAttachment(f.id ?? f.Id, f.fileName ?? f.FileName)}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Download">
                          <IconButton
                            size="small"
                            aria-label="Download attachment"
                            onClick={() => downloadAttachment(f.id ?? f.Id, f.fileName ?? f.FileName)}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        {canEditAttachments && (
                          <>
                            <input
                              type="file"
                              style={{ display: "none" }}
                              ref={(el) => (replaceInputRefs.current[f.id ?? f.Id] = el)}
                              onChange={(e) => onReplaceAttachment(f.id ?? f.Id, e)}
                            />
                            <Tooltip title="Replace">
                              <IconButton
                                size="small"
                                onClick={() => replaceInputRefs.current[f.id ?? f.Id]?.click()}
                                aria-label="Replace attachment"
                              >
                                <ChangeCircleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                onClick={() => onDeleteAttachment(f.id ?? f.Id)}
                                aria-label="Delete attachment"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Box>
            </CardContent>

            <Divider />

            {/* Sticky action bar */}
            <CardActions
              onClick={(e) => e.stopPropagation()}
              sx={(theme) => ({
                p: 2.5,
                display: "flex",
                justifyContent: { xs: "center", sm: "flex-end" },
                gap: 1.5,
                position: "sticky",
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: theme.zIndex.modal + 2,
                bgcolor: "background.paper",
                boxShadow: "0 -6px 16px rgba(0,0,0,0.06)",
                pointerEvents: "auto",
              })}
            >
              <Tooltip title="Send back to initiator (B)">
                <span>
                  <ShadyButton
                    variant="contained"
                    btncolor="sendback"
                    color="warning"
                    onClick={() => openConfirm("SendBack")}
                    disabled={busy}
                    startIcon={<UndoIcon />}
                    sx={{ pointerEvents: "auto", zIndex: 1 }}
                  >
                    Send Back
                  </ShadyButton>
                </span>
              </Tooltip>

              <Tooltip title="Reject (R)">
                <span>
                  <ShadyButton
                    variant="contained"
                    btncolor="reject"
                    color="error"
                    onClick={() => openConfirm("Reject")}
                    disabled={busy}
                    startIcon={<DoNotDisturbIcon />}
                    sx={{ pointerEvents: "auto", zIndex: 1 }}
                  >
                    Reject
                  </ShadyButton>
                </span>
              </Tooltip>

              <Tooltip title="Approve (A)">
                <span>
                  <ShadyButton
                    variant="contained"
                    btncolor="approve"
                    color="success"
                    onClick={() => openConfirm("Approve")}
                    loading={busy && dialog.type === "Approve"}
                    startIcon={<CheckCircleIcon />}
                    sx={{ pointerEvents: "auto", zIndex: 1 }}
                  >
                    Approve
                  </ShadyButton>
                </span>
              </Tooltip>
            </CardActions>
          </Card>
        </Grid>
      </Grid>

      {/* CONFIRMATION DIALOG */}
      <Dialog
        open={dialog.open}
        onClose={busy ? undefined : closeConfirm}
        fullWidth
        maxWidth="sm"
        aria-labelledby="approval-confirm-title"
      >
        <DialogTitle id="approval-confirm-title">
          {dialog.type === "Approve"
            ? "Confirm approval"
            : dialog.type === "Reject"
            ? "Confirm rejection"
            : "Send back to initiator"}
        </DialogTitle>

        <DialogContent dividers>
          {dialog.type === "Approve" ? (
            <Typography variant="body1">Approve this request?</Typography>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Add a note (visible to requester & audit logs).
              </Typography>
              <TextField
                autoFocus
                fullWidth
                multiline
                minRows={3}
                placeholder={dialog.type === "Reject" ? "Reason for rejection…" : "What needs to be changed…"}
                value={dialog.note}
                onChange={(e) => setDialog((d) => ({ ...d, note: e.target.value }))}
              />
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <LoadingButton onClick={closeConfirm} disabled={busy}>
            Cancel
          </LoadingButton>
          <ShadyButton
            variant="contained"
            btncolor={dialog.type === "Approve" ? "approve" : dialog.type === "Reject" ? "reject" : "sendback"}
            color={dialog.type === "Approve" ? "success" : dialog.type === "Reject" ? "error" : "warning"}
            loading={busy}
            onClick={handleAction}
            startIcon={
              dialog.type === "Approve" ? (
                <CheckCircleIcon />
              ) : dialog.type === "Reject" ? (
                <DoNotDisturbIcon />
              ) : (
                <UndoIcon />
              )
            }
          >
            {dialog.type === "Approve"
              ? "Confirm Approve"
              : dialog.type === "Reject"
              ? "Confirm Reject"
              : "Confirm Send Back"}
          </ShadyButton>
        </DialogActions>
      </Dialog>

      {/* FULL FORM SNAPSHOT DIALOG */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Full Form</DialogTitle>
        <DialogContent dividers>
          {formBusy ? (
            <LinearProgress />
          ) : formFields.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No form fields found.</Typography>
          ) : (
            <Grid container spacing={2} sx={{ mt: 0 }}>
              {formFields.map((f) => (
                <Grid item xs={12} sm={6} key={f.key}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                    {f.label}
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 1, mt: 0.5, borderRadius: 1.5 }}>
                    <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                      {String(f.value)}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* PREVIEW DIALOG */}
      <Dialog fullScreen open={preview.open} onClose={closePreview} TransitionComponent={Transition}>
        <AppBar sx={{ position: "relative" }} color="default" elevation={1}>
          <Toolbar sx={{ gap: 1 }}>
            {preview.type?.includes("pdf") ? (
              <PictureAsPdfIcon role="img" />
            ) : preview.type?.startsWith("image/") ? (
              <ImageIcon role="img" />
            ) : (
              <InsertDriveFileIcon role="img" />
            )}
            <Typography sx={{ flex: 1 }} variant="subtitle1" noWrap title={preview.name}>
              {preview.name}
            </Typography>

            <Tooltip title="Download">
              <IconButton
                aria-label="Download from preview"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = preview.blobUrl;
                  a.download = preview.name || "file";
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                }}
              >
                <DownloadIcon />
              </IconButton>
            </Tooltip>

            <IconButton edge="end" onClick={closePreview} aria-label="Close preview">
              <CloseIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box sx={{ height: "100%", bgcolor: "#f6f7f9" }}>
          {preview.type?.startsWith("image/") && (
            <Box sx={{ height: "100%", display: "grid", placeItems: "center", p: 2 }}>
              <img
                src={preview.blobUrl}
                alt={preview.name}
                style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8, boxShadow: "0 2px 12px rgba(0,0,0,.15)" }}
              />
            </Box>
          )}

          {preview.type?.includes("pdf") && (
            <Box sx={{ height: "100%" }}>
              <iframe
                title={preview.name}
                src={preview.blobUrl}
                sandbox="allow-same-origin allow-forms allow-scripts"
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            </Box>
          )}

          {preview.text && !preview.type?.includes("pdf") && !preview.type?.startsWith("image/") && (
            <Box sx={{ p: 2 }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: "#fff",
                  overflow: "auto",
                  maxHeight: "calc(100vh - 120px)",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
                  fontSize: 14,
                  lineHeight: 1.6,
                  whiteSpace: "pre",
                }}
              >
                {preview.text}
              </Paper>
            </Box>
          )}

          {!preview.type && !preview.text && (
            <Stack height="100%" alignItems="center" justifyContent="center" spacing={2}>
              <InsertDriveFileIcon sx={{ fontSize: 56, opacity: 0.6 }} />
              <Typography variant="body1" color="text.secondary">
                No inline preview for this file type.
              </Typography>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = preview.blobUrl;
                  a.download = preview.name || "file";
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                }}
              >
                Download
              </Button>
            </Stack>
          )}
        </Box>
      </Dialog>

      {/* Toasts */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          severity={toast.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
