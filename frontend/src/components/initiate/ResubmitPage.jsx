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
    fundRequestId:
      snapshot?.fundRequestId ??
      snapshot?.requestId ??
      snapshot?.RequestId ??
      snapshot?.id ??
      snapshot?.Id ??
      null,
  };

  const normalizeKey = (key = "") => key.toString().trim();
  const toCode = (key = "") => normalizeKey(key).replace(/\s+/g, "").toLowerCase();

  const dynamic = [];
  rows.forEach((row) => {
    const rawKey = normalizeKey(row?.key ?? row?.label ?? "");
    if (!rawKey) return;

    const code = toCode(rawKey);
    const value = row?.value ?? "";

    if (code === "id" || code === "requestid") {
      if (value !== undefined && value !== null && value !== "") result.fundRequestId = value;
      return;
    }
    if (code === "title" || code === "requesttitle") {
      result.requestTitle = value ?? "";
      return;
    }
    if (code === "description") {
      result.description = value ?? "";
      return;
    }
    if (code === "amount") {
      result.amount = value == null ? "" : String(value);
      return;
    }
    if (["approvalby", "approvalbydate", "neededby", "neededbydate", "requiredby", "requiredbydate"].includes(code)) {
      if (typeof value === "string") {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          result.approvalBy = value;
        } else {
          const d = new Date(value);
          if (!Number.isNaN(d.getTime())) result.approvalBy = d.toISOString().slice(0, 10);
        }
      } else if (value instanceof Date && !Number.isNaN(value.getTime())) {
        result.approvalBy = value.toISOString().slice(0, 10);
      }
      return;
    }

    if (!STATIC_SNAPSHOT_KEYS.has(code)) dynamic.push({ fieldName: rawKey, fieldValue: value });
  });

  result.fields = dynamic;
  return result;
};

const ALLOWED_TABS = ["initiated", "sentback", "assigned", "approved","rejected"];

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

  const [fundRequestId, setFundRequestId] = useState(id || null);
  const [loadedViaFundRequest, setLoadedViaFundRequest] = useState(false);

  const [approverFeedback, setApproverFeedback] = useState({
    open: false,
    message: "",
    action: null,
    result: null,
  });

  const effectiveTab = useMemo(() => {
    const raw = (search.get("tab") || "assigned").toLowerCase();
    return ALLOWED_TABS.includes(raw) ? raw : "assigned";
  }, [search]);

  const isApproverView = useMemo(
    () => effectiveTab === "assigned" || (effectiveTab === "sentback" && role === "approver"),
    [effectiveTab, role]
  );

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
        setLoadedViaFundRequest(false);
        setFundRequestId(id ?? null);

        const shouldUseFundRequest =
          !approvalId ||
          effectiveTab === "initiated" ||
          effectiveTab === "rejected" ||
          (effectiveTab === "sentback" && role !== "approver");

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

        const normalizeFundRequest = (details) => {
          if (!details) return { fields: [] };

          const rows = [];
          const pushRow = (key, label, value) => {
            if (value === undefined || value === null) return;
            const v =
              typeof value === "string" || typeof value === "number"
                ? value
                : value instanceof Date
                ? value.toISOString()
                : String(value);
            rows.push({ key, label: label || key, value: v });
          };

          pushRow("Id", "Request ID", details.id ?? details.Id);
          pushRow("RequestId", "Request ID", details.id ?? details.Id);
          pushRow("RequestTitle", "Title", details.requestTitle ?? details.RequestTitle);
          pushRow("Description", "Description", details.description ?? details.Description);
          pushRow("Amount", "Amount", details.amount ?? details.Amount);
          pushRow("Status", "Status", details.status ?? details.Status);
          pushRow("CurrentLevel", "Current Level", details.currentLevel ?? details.CurrentLevel);
          pushRow("CreatedAt", "Created", details.createdAt ?? details.CreatedAt);
          pushRow("WorkflowId", "Workflow ID", details.workflowId ?? details.WorkflowId);
          pushRow("WorkflowName", "Workflow Name", details.workflowName ?? details.WorkflowName);
          pushRow("DepartmentId", "Department ID", details.departmentId ?? details.DepartmentId);
          pushRow("DepartmentName", "Department Name", details.departmentName ?? details.DepartmentName);
          pushRow("ProjectName", "Project", details.projectName ?? details.ProjectName);
          const rawFields = details.fields ?? details.Fields;
          const dynamicFields = Array.isArray(rawFields) ? rawFields : [];

          dynamicFields.forEach((field) => {
            const key = field?.fieldName ?? field?.FieldName;
            if (!key) return;
            const rawValue = field?.fieldValue ?? field?.FieldValue ?? "";
            const normalizedValue =
              typeof rawValue === "string" || typeof rawValue === "number"
                ? rawValue
                : rawValue instanceof Date
                ? rawValue.toISOString()
                : String(rawValue);
            rows.push({
              key,
              label: key,
              value: normalizedValue,
            });
          });

          const fundRequestId = details?.id ?? details?.Id ?? null;

          return { fields: rows, fundRequestId };
        };

        const tryFundRequest = async () => {
          if (!id) {
            throw new Error("Missing request id");
          }
          const { data } = await http.get(`/fundrequests/${id}`, {
            headers: authHeaders(),
          });
          return adaptSnapshot(normalizeFundRequest(data), attachments);
        };

        const tryApprovalsSnapshot = async () => {
          if (!approvalId) {
            throw new Error("Missing approval id");
          }
          const resp = await http.get(`/approvals/${approvalId}/form-snapshot`, {
            headers: authHeaders(),
          });
          return adaptSnapshot(resp.data, attachments);
        };

        

        const errors = [];
        const assignResult = async (promiseFactory, { viaFundRequest } = {}) => {
          try {
            const data = await promiseFactory();
            if (alive) {
              setFormData(data);
              setLoadedViaFundRequest(!!viaFundRequest);
              const extractedId =
                data?.fundRequestId ??
                data?.requestId ??
                data?.RequestId ??
                data?.id ??
                data?.Id ??
                null;

              if (viaFundRequest) {
                setFundRequestId(id ?? (extractedId != null ? String(extractedId) : null));
              } else if (extractedId != null) {
                setFundRequestId(String(extractedId));
              }
              return true;
            }
          } catch (err) {
            errors.push(err);
          }
          return false;
        };

        let loaded = false;

        if (shouldUseFundRequest) {
          loaded = await assignResult(tryFundRequest, { viaFundRequest: true });
        } else {
          loaded = await assignResult(tryApprovalsSnapshot);
          if (!loaded) {
            loaded = await assignResult(tryFundRequest, { viaFundRequest: true });
          }
        }

        if (!loaded && alive) {
          if (errors.length) {
            console.warn("Failed to load resubmit data", errors);
          }
          setFormData(null);
          setError("We couldn't load the request details. Please try again later.");
        }
      } catch (e) {
        if (alive) {
          
          console.error("Unexpected error loading resubmit data", e);
          setError("We couldn't load the request details. Please try again later.");
          setFormData(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    
    fetchFormData();
    return () => {
      alive = false;
    };
  }, [approvalId, effectiveTab, role, id]);

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

  const isReadOnlyTab = effectiveTab === "approved" || effectiveTab === "rejected";
  const allowAttachmentEdit = !(isApproverView || isReadOnlyTab);
  const showButtonsConfig = isApproverView
    ? { approve: true, sentBack: true, reject: true, approveWithModification: true }
    : isReadOnlyTab
    ? { update: false, cancel: false, share: true }
    : undefined;
  const resolvedFundRequestId = useMemo(() => {
    const fallbackId = fundRequestId ?? id ?? undefined;
    if (!isApproverView) {
      return id ?? fundRequestId ?? undefined;
    }
    if (loadedViaFundRequest) {
      return id ?? fundRequestId ?? undefined;
    }
    return fallbackId;
  }, [fundRequestId, id, isApproverView, loadedViaFundRequest]);
 
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
          requestId={isApproverView && !loadedViaFundRequest ? approvalId : resolvedFundRequestId}
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

