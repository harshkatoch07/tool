// src/components/initiate/ResubmitPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Box, CircularProgress, Snackbar, Alert } from "@mui/material";
import { getApprovalTrail } from "../../api/approvalsApi";
import { http, authHeaders } from "../../api/http";
import InitiateForm from "../forms/InitiateForm";
import ApprovalPathDialog from "./ApprovalPathDialog";

const ALLOWED_TABS = ["initiated", "sentback", "assigned", "approved"];

export default function ResubmitPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const approvalId = search.get("approvalId");

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
  }, [approvalId]);

  useEffect(() => {
    setApproverFeedback({ open: false, message: "", action: null, result: null });
  }, [approvalId, effectiveTab]);

  useEffect(() => {
    let alive = true;
    const fetchFormData = async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await http.get(`/approvals/${approvalId}/form-snapshot`, {
          headers: authHeaders(),
        });
        if (alive) setFormData(resp.data);
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
    () => `${approvalId || ""}:${effectiveTab}:${formData ? "ready" : "loading"}`,
    [approvalId, effectiveTab, formData]
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
  const allowAttachmentEdit = !(effectiveTab === "assigned" || effectiveTab === "approved");
  const isApproverTab = effectiveTab === "assigned";
  const isReadOnlyTab = effectiveTab === "approved";

  return (
    <Box sx={{ width: "100%", maxWidth: 1600, mx: "auto" }}>
      <ApprovalPathDialog open={openPath} onClose={() => setOpenPath(false)} trail={trail} />

      <React.Fragment key={viewKey}>
        <InitiateForm
          key={viewKey}
          disabled={isApproverTab || isReadOnlyTab}
          hideActions={isReadOnlyTab}
          mode={isApproverTab ? "approver" : "initiator"}
          showButtons={
            isApproverTab
              ? { approve: true, sentBack: true, reject: true, approveWithModification: true }
              : undefined
          }
          tabKey={effectiveTab}
          requestId={approvalId}
          formData={formData}
          showAttachments={true}
          allowAttachmentEdit={allowAttachmentEdit}
          onCancel={() => navigate(`/approvals?tab=${effectiveTab}`)}
          onUpdate={() => navigate(`/approvals?tab=${effectiveTab}`)}
          showPathButton
          onOpenPath={() => setOpenPath(true)}
          onApproverDone={isApproverTab ? handleApproverDone : undefined}
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
