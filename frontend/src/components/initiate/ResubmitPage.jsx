// src/components/initiate/ResubmitPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Box, CircularProgress, Snackbar, Alert } from "@mui/material";
import { getApprovalTrail } from "../../api/approvalsApi";
import { http, authHeaders } from "../../api/http";
import InitiateForm from "../forms/InitiateForm";
import ApprovalPathDialog from "./ApprovalPathDialog";

const STATIC_SNAPSHOT_KEYS = new Set([
  "id",
  "requestid",
  "title",
  "requesttitle",
  "description",
  "amount",
  "approvalby",
  "neededby",
  "neededbydate",
  "requiredby",
  "requiredbydate",
  "status",
  "createdat",
]);

const adaptSnapshot = (snapshot, attachments = []) => {
  const rows = Array.isArray(snapshot?.fields) ? snapshot.fields : [];

  const result = {
    requestTitle: "",
    description: "",
    amount: "",
    approvalBy: "",
    fields: [],
    attachments,
  };

  const normalizeKey = (key = "") => key.toString().trim();
  const normalizedCode = (key = "") => normalizeKey(key).replace(/\s+/g, "").toLowerCase();

  const dynamic = [];

  rows.forEach((row) => {
    const rawKey = normalizeKey(row?.key ?? row?.label ?? "");
    if (!rawKey) return;

    const code = normalizedCode(rawKey);
    const value = row?.value ?? "";

    if (code === "title" || code === "requesttitle") {
      result.requestTitle = value ?? "";
      return;
    }
    if (code === "description") {
      result.description = value ?? "";
      return;
    }
    if (code === "amount") {
      result.amount = value === null || value === undefined ? "" : String(value);
      return;
    }
    if (["approvalby", "approvalbydate", "neededby", "neededbydate", "requiredby", "requiredbydate"].includes(code)) {
      if (typeof value === "string") {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          result.approvalBy = value;
        } else {
          const parsed = new Date(value);
          if (!Number.isNaN(parsed.getTime())) {
            result.approvalBy = parsed.toISOString().slice(0, 10);
          }
        }
      } else if (value instanceof Date && !Number.isNaN(value.getTime())) {
        result.approvalBy = value.toISOString().slice(0, 10);
      }
      return;
    }

    if (!STATIC_SNAPSHOT_KEYS.has(code)) {
      dynamic.push({ fieldName: rawKey, fieldValue: value });
    }
  });

  result.fields = dynamic;
  return result;
};

const ALLOWED_TABS = ["initiated", "sentback", "assigned", "approved"];

export default function ResubmitPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const approvalId = search.get("approvalId");
  const role = (search.get("role") || "").toLowerCase();

  const [trail, setTrail] = useState(null);
  const [openPath, setOpenPath] = useState(false);
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [approverFeedback, setApproverFeedback] = useState({ open: false, message: "", action: null, result: null });
  const effectiveTab = useMemo(() => {
    const raw = (search.get("tab") || "assigned").toLowerCase();
    return ALLOWED_TABS.includes(raw) ? raw : "assigned";
  }, [search]);

  useEffect(() => {
    let alive = true;
    setTrail(null);
    if (!approvalId) return () => { alive = false; };
    getApprovalTrail(approvalId)
      .then((t) => alive && setTrail(t))
      .catch(() => alive && setTrail(null));
    return () => { alive = false; };
  }, [approvalId, id]);

  useEffect(() => {
    setApproverFeedback({ open: false, message: "", action: null, result: null });
  }, [approvalId, effectiveTab]);

  useEffect(() => {
    let alive = true;
    const fetchFormData = async () => {
      try {
        setLoading(true);
        setError(null);
const snapshotPromise = http.get(`/approvals/${approvalId}/form-snapshot`, {          headers: authHeaders(),
        });
        
        let attachments = [];
        if (id) {
          try {
            const { data: rawAttachments } = await http.get(`/fundrequests/${id}/attachments`, {
              headers: authHeaders(),
            });
            attachments = Array.isArray(rawAttachments)
              ? rawAttachments.map((a) => ({
                  id: a.Id ?? a.id,
                  name: a.FileName ?? a.fileName ?? a.name,
                  url: `/api/fundrequests/${id}/attachments/${a.Id ?? a.id}/download`,
                  isExisting: true,
                }))
              : [];
          } catch (attErr) {
            console.warn("Failed to load attachments for resubmit view", attErr);
          }
        }

        const resp = await snapshotPromise;
        const adapted = adaptSnapshot(resp.data, attachments);
        if (alive) setFormData(adapted);
      } catch (e) {
        if (alive) {
          setError(e?.response?.data || "Failed to load form data");
          setFormData(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    if (approvalId) fetchFormData();
    else {
      setLoading(false);
      setFormData(null);
    }
    return () => { alive = false; };
   }, [approvalId]);

  const viewKey = useMemo(
    () => `${approvalId || ""}:${effectiveTab}:${role}:${formData ? "ready" : "loading"}`,
    [approvalId, effectiveTab, role, formData]
  );
  const handleApproverDone = ({ action, result } = {}) => {
    const key = String(action || "").toLowerCase();
    const messageMap = {
      approve: "Request approved successfully.",
      reject: "Request rejected successfully.",
      sendback: "Request sent back successfully.",
    };
    const message = messageMap[key] || "Action completed successfully.";
    setApproverFeedback({ open: true, message, action, result });
    navigate(`/approvals?tab=${effectiveTab}`, { state: { snackbar: { message } } });
  };

  const handleToastClose = (_, reason) => {
    if (reason === "clickaway") return;
    setApproverFeedback((prev) => ({ ...prev, open: false }));
  };
const isApproverView = effectiveTab === "assigned" || (effectiveTab === "sentback" && role === "approver");
  const isReadOnlyTab = effectiveTab === "approved";
  const allowAttachmentEdit = !(isApproverView || isReadOnlyTab);
  const showButtonsConfig = isApproverView
    ? { approve: true, sentBack: true, reject: true, approveWithModification: true }
    : undefined;
 
  if (loading && !error) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, color: "error.main" }}>
        {String(error)}
      </Box>
    );
  }

  // Always show attachments. Allow editing only when not assigned/approved.
  
  return (
    <Box sx={{ width: "100%", maxWidth: 1600, mx: "auto" }}>
      <ApprovalPathDialog open={openPath} onClose={() => setOpenPath(false)} trail={trail} />

      <React.Fragment key={viewKey}>
        <InitiateForm
          key={viewKey}
          disabled={isApproverView || isReadOnlyTab}
          hideActions={false}
          mode={isApproverView ? "approver" : "initiator"}
          showButtons={showButtonsConfig}
          tabKey={effectiveTab}
          requestId={approvalId}
          formData={formData}
          showAttachments={true}
          allowAttachmentEdit={allowAttachmentEdit}
          onCancel={() => navigate(`/approvals?tab=${effectiveTab}`)}
          onUpdate={() => navigate(`/approvals?tab=${effectiveTab}`)}
          showPathButton
          onOpenPath={() => setOpenPath(true)}
          onApproverDone={isApproverView ? handleApproverDone : undefined}
        />
      </React.Fragment>

      <Snackbar
        open={approverFeedback.open}
        autoHideDuration={4000}
        onClose={handleToastClose}
       
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={handleToastClose} severity="success" sx={{ width: "100%" }}>
          {approverFeedback.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
