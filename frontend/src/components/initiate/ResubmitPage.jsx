// src/components/initiate/ResubmitPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
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

  return (
    <Box sx={{ width: "100%", maxWidth: 1600, mx: "auto" }}>
      <ApprovalPathDialog open={openPath} onClose={() => setOpenPath(false)} trail={trail} />

      <React.Fragment key={viewKey}>
        <InitiateForm
          key={viewKey}
          disabled={effectiveTab === "assigned" || effectiveTab === "approved"}
          hideActions={effectiveTab !== "assigned"}
          mode={effectiveTab === "assigned" ? "approver" : "initiator"}
          showButtons={
            effectiveTab === "assigned"
              ? { approve: true, sentBack: true, reject: true, approveWithModification: true }
              : {}
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
        />
      </React.Fragment>
    </Box>
  );
}
