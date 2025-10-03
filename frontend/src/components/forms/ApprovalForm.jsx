import React, { useEffect, useState } from "react";
import { Button, Box, Typography, Paper, CircularProgress } from "@mui/material";
import api from "../../api";
import DynamicFieldRenderer from "./DynamicFieldRenderer"; // Assume you have a dynamic field renderer

// ApprovalForm: Looks like InitiateForm, but for approvals
export default function ApprovalForm({ fundRequestId, approvalId, onAction, readOnlyFields = [] }) {
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState([]);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        console.debug("[ApprovalForm] Fetching form snapshot for approvalId:", approvalId);
        // Fetch form snapshot for approval
        const { data } = await api.get(`/approvals/${approvalId}/form-snapshot`);
        console.debug("[ApprovalForm] API response data:", data);
        setFields(data.fields || []);
        setFormData(data.formData || {});
      } catch (e) {
        console.debug("[ApprovalForm] Error loading form:", e, e?.response);
        setError("Failed to load approval form. " + (e?.response?.status ? `Status: ${e.response.status}` : ""));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [approvalId]);

  const handleFieldChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleAction = async (action) => {
    setActionLoading(true);
    setError(null);
    try {
      await api.post(`/approvals/${approvalId}/action`, {
        action,
        comments: formData.comments || "",
        modifiedFields: action === "ApproveWithModification" ? formData : undefined,
      });
      if (onAction) onAction(action);
    } catch (e) {
      setError(e?.response?.data?.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <Box p={3} textAlign="center"><CircularProgress /></Box>;
  if (error) return <Box p={3} color="error.main">{error}</Box>;

  return (
    <Paper sx={{ p: 3, maxWidth: 700, margin: "auto" }}>
      <Typography variant="h6" gutterBottom>Approval Form</Typography>
      <DynamicFieldRenderer
        fields={fields}
        values={formData}
        onChange={handleFieldChange}
        readOnlyFields={readOnlyFields}
      />
      <Box mt={3} display="flex" gap={2}>
        <Button variant="contained" color="success" disabled={actionLoading} onClick={() => handleAction("Approve")}>Approve</Button>
        <Button variant="contained" color="warning" disabled={actionLoading} onClick={() => handleAction("SentBack")}>Sent Back</Button>
        <Button variant="contained" color="error" disabled={actionLoading} onClick={() => handleAction("Reject")}>Reject</Button>
        <Button variant="contained" color="primary" disabled={actionLoading} onClick={() => handleAction("ApproveWithModification")}>Approve With Modification</Button>
      </Box>
    </Paper>
  );
}
