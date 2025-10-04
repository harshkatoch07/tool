// src/components/forms/InitiateForm.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Typography, CircularProgress, MenuItem, Button, TextField,
  Paper, Divider, Stack, Chip, Tooltip, InputAdornment, IconButton, Alert, AlertTitle
} from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DomainIcon from "@mui/icons-material/Domain";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import BusinessIcon from "@mui/icons-material/Business";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import { MemoryRouter, useInRouterContext, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTheme, alpha } from "@mui/material/styles";
import ApproverActionBar from "../initiate/ApproverActionBar";
import TimelineIcon from "@mui/icons-material/Timeline";
import { downloadAttachment } from "../../api/attachmentsApi";
import { getAssignedWorkflows } from "../../api/workflowApi";

// ---------------------------------------------
// Minimal API client (fetch-based) + optional mocks
// ---------------------------------------------
const USE_MOCKS =
  (typeof import.meta !== "undefined" && import.meta.env && (import.meta.env.VITE_USE_MOCKS === "true")) ||
  (typeof process !== "undefined" && process.env && ((process.env.REACT_APP_USE_MOCKS === "true") || (process.env.VITE_USE_MOCKS === "true")));

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  (typeof process !== "undefined" && process.env && (process.env.REACT_APP_API_BASE_URL || process.env.VITE_API_BASE_URL)) ||
  "/api";

function resolveApiUrl(path) {
  if (!path) return API_BASE;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/")) return `${API_BASE}${path}`;
  return `${API_BASE}/${path}`;
}

// --- Mocks ---
const mockDB = {
  workflows: [
    { workflowId: 1, name: "Software Purchase", description: "Buy/renew software" },
    { workflowId: 2, name: "CapEx", description: "Capital expenditure" },
  ],
  projects: [
    { projectId: 101, projectName: "Phoenix" },
    { projectId: 102, projectName: "Nimbus" },
  ],
};

async function apiRequest(method, path, { body, headers, signal } = {}) {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
  const url = resolveApiUrl(path);
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  const finalHeaders = new Headers({ Accept: "application/json", ...(headers || {}) });
  if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
  if (!isForm && body != null) finalHeaders.set("Content-Type", "application/json");

  try {
    const res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: isForm ? body : body != null ? JSON.stringify(body) : undefined,
      signal,
      credentials: "include",
    });

    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("application/json") ? await res.json().catch(() => null) : await res.text();
    if (!res.ok) throw Object.assign(new Error(`Request failed: ${res.status}`), { status: res.status, data });
    return { data, status: res.status };
  } catch (err) {
    if (USE_MOCKS) {
      if (/\/workflow/.test(path)) return { data: mockDB.workflows, status: 200 };
      if (/\/projects\/assigned/.test(path)) return { data: mockDB.projects, status: 200 };
      if (/\/formschemas\/by-workflow\//.test(path)) {
        return {
          data: {
            schema: {
              fields: [
                { key: "projectId", label: "Project", type: "select", required: true },
                { key: "employee", label: "Employee", type: "text", required: false },
                { key: "legalEntity", label: "Legal Entity", type: "select", required: false },
                { key: "justification", label: "Justification", type: "textarea", required: false },
                { key: "hyperlinkTitle", label: "Hyperlink Title", type: "text", required: false },
                { key: "hyperlinkUrl", label: "Hyperlink URL", type: "url", required: false }
              ]
            }
          },
          status: 200
        };
      }
      if (method === "POST" && /\/fundrequests$/.test(path)) return { data: { id: 9999 }, status: 201 };
      if (method === "PUT"  && /\/fundrequests\/.+\/resubmit$/.test(path)) return { data: { ok: true }, status: 200 };
      if (method === "POST" && /\/attachments$/.test(path)) return { data: { uploaded: true }, status: 200 };
      if (method === "GET"  && /\/fundrequests\//.test(path)) return { data: { amount: 0, fields: [], requestTitle: "", description: "" }, status: 200 };
      return { data: null, status: 200 };
    }
    throw err;
  }
}

const api = {
  get: (path, opts) => apiRequest("GET", path, opts),
  post: (path, body, opts) => apiRequest("POST", path, { ...(opts || {}), body }),
  put: (path, body, opts) => apiRequest("PUT", path, { ...(opts || {}), body }),
};

// ─────────────────────────────────────────────
// Field sizing + alignment
// ─────────────────────────────────────────────
const UNIFORM_FIELD_HEIGHT = 48;

const FIELD_SX_BASE = {
  width: "100%",
  minWidth: 0,
  height: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start",
  "& .MuiInputBase-root": { height: UNIFORM_FIELD_HEIGHT },
  "& .MuiOutlinedInput-root": {
    height: UNIFORM_FIELD_HEIGHT,
    "& .MuiOutlinedInput-notchedOutline": { top: 0 },
  },
  "& .MuiInputBase-input": {
    height: UNIFORM_FIELD_HEIGHT,
    display: "flex",
    alignItems: "center",
    paddingTop: 0,
    paddingBottom: 0,
  },
  "& .MuiSelect-select": {
    height: UNIFORM_FIELD_HEIGHT,
    display: "flex",
    alignItems: "center",
    paddingTop: 0,
    paddingBottom: 0,
  },
  "& .MuiFormHelperText-root": { minHeight: 20, marginLeft: 0 },
  "& .MuiInputAdornment-root": { marginRight: 8 },
  "& .MuiSelect-icon": { top: "calc(50% - 12px)", right: 8 },
};

const FIELD_SX = { ...FIELD_SX_BASE };

const FIELD_SX_MULTILINE = {
  width: "100%",
  minWidth: 0,
  "& .MuiInputBase-root": {
    height: "auto",
    alignItems: "flex-start",
    paddingTop: 0,
    paddingBottom: 0,
  },
  "& .MuiOutlinedInput-root": {
    height: "auto",
    alignItems: "flex-start",
  },
  "& .MuiOutlinedInput-input": {
    padding: "12px 14px",
  },
  "& textarea": {
    lineHeight: 1.4,
    resize: "none",
  },
  "& .MuiFormHelperText-root": { minHeight: 20, marginLeft: 0 },
};

const CELL_SX = { display: "flex", flexDirection: "column", height: "100%" };

// --- helpers ---
const IMMUTABLE_ON_EDIT = { workflow: true };
const parseAmount = (v) => {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : NaN;
};
const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};
const computePriority = (dateStr) => {
  const d = daysUntil(dateStr);
  if (d == null) return "";
  if (d <= 3) return "High";
  if (d <= 6) return "Medium";
  return "Low";
};

// ---------------------------
// Component
// ---------------------------
function InitiateFormImpl({
  disabled = false,
  hideActions = false,
  mode = "initiator",
  showButtons = { update: true, share: true, cancel: true },
  tabKey = "initiated",
  requestId,
  formData: externalFormData,   // NEW: allow external prefill
  onCancel,
  onApproverDone,
  onOpenPath,
  showPathButton = false,
  showAttachments = true,       // NEW: always show attachments by default
  allowAttachmentEdit = true,   // NEW: allow attachment editing by default
} = {}) {
  // --- React hooks & refs ---
  const { id: idFromRoute } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const fileInputRef = useRef(null);

  // --- Loading and UI state ---
  const [loading, setLoading] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // --- Form and workflow state ---
  const [workflows, setWorkflows] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProj, setSelectedProj] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [schema, setSchema] = useState(null);
  const [touched, setTouched] = useState({});
  const [prefill, setPrefill] = useState(null);
  const [formData, setFormData] = useState({
    whatNeed: "",
    whyNeed: "",
    recommend: "",
    reason: "",
    attachments: [],
    amount: "",
    approvalBy: "",
  });
  const [dynValues, setDynValues] = useState({});

  // --- Static legal entities ---
  const localLegalEntities = [
    { value: "entity1", label: "Entity 1" },
    { value: "entity2", label: "Entity 2" },
    { value: "entity3", label: "Entity 3" },
  ];

  // --- Helper to check if a field is required in schema ---
  const isReq = (key) => (schema?.fields || []).some((f) => f.key === key && f.required);

  // Compute derived values
  const approvalId = searchParams.get("approvalId") || undefined;
  const departmentFilter = useMemo(() => {
    const raw =
      searchParams.get("departmentId") ??
      searchParams.get("department") ??
      searchParams.get("dept");
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (trimmed.toLowerCase() === "all") return null;
    return trimmed;
  }, [searchParams]);
  const id = requestId ?? idFromRoute;
  const isEdit = !!id;

  // Reset on mode/policy changes
  useEffect(() => {
    setTouched({});
    setPrefill(null);
    setFormData({
      whatNeed: "",
      whyNeed: "",
      recommend: "",
      reason: "",
      attachments: [],
      amount: "",
      approvalBy: "",
    });
    setDynValues({});
  }, [mode, disabled, hideActions, JSON.stringify(showButtons)]);

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setShowLoading(true), 200);
      return () => clearTimeout(timer);
    } else {
      setShowLoading(false);
    }
  }, [loading]);

  const priority = useMemo(() => computePriority(formData.approvalBy), [formData.approvalBy]);

  // ─────────────────────────────────────────────
  // NEW: Accept externalFormData and short-circuit fetch
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!externalFormData) return;

    // Map common fields
    const ext = externalFormData;
    const reqTitle = ext.requestTitle ?? ext.title ?? "";
    const desc = ext.description ?? "";
    const amt = ext.amount != null && ext.amount !== "" ? String(ext.amount) : "";
    const apprBy =
      typeof ext.approvalBy === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ext.approvalBy)
        ? ext.approvalBy
        : typeof ext.neededBy === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ext.neededBy)
        ? ext.neededBy
        : typeof ext.requiredByDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ext.requiredByDate)
        ? ext.requiredByDate
        : "";

    // Map dynamic fields array/object into flat values
    let dyn = {};
    if (Array.isArray(ext.fields)) {
      dyn = ext.fields.reduce((acc, f) => {
        const name = (f.fieldName ?? f.name ?? "").toString();
        if (!name) return acc;
        const key = name.charAt(0).toLowerCase() + name.slice(1);
        let val = f.fieldValue ?? f.value ?? "";
        // support array for hyperlinkUrl
        if (key === "hyperlinkUrl" && typeof val === "string") val = [val];
        acc[key] = val;
        return acc;
      }, {});
    } else if (ext.fields && typeof ext.fields === "object") {
      dyn = Object.entries(ext.fields).reduce((acc, [k, v]) => {
        const key = k.charAt(0).toLowerCase() + k.slice(1);
        acc[key] = key === "hyperlinkUrl" && typeof v === "string" ? [v] : v;
        return acc;
      }, {});
    }

    // Attachments if caller provided
    const attachments = Array.isArray(ext.attachments)
      ? ext.attachments.map((a) => ({
          id: a.Id ?? a.id,
          name: a.FileName ?? a.fileName ?? a.name,
          url: a.Url ?? a.url,
          isExisting: true,
        }))
      : [];

    // Push into state
    setPrefill(ext);
    if (ext.workflowId) setSelectedProj(String(ext.workflowId));
    if (ext.projectId) setSelectedProject(String(ext.projectId));
    setFormData((p) => ({
      ...p,
      whatNeed: reqTitle,
      whyNeed: desc,
      amount: amt,
      approvalBy: apprBy,
      attachments,
    }));
    setDynValues((prev) => ({ ...prev, ...dyn }));
    setLoading(false);
  }, [externalFormData]);

   // Load available workflows
  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    const loadWorkflows = async () => {
      setLoadError(null);
      try {
        const data = await getAssignedWorkflows({
          initiatorOnly: mode !== "approver",
          departmentId: departmentFilter ?? undefined,
          signal: controller.signal,
        });
        if (!isActive) return;
        const list = Array.isArray(data) ? data : [];
        setWorkflows(list);
        if (!isEdit && list.length === 1) {
          setSelectedProj((prev) => prev || String(list[0]?.workflowId ?? list[0]?.id ?? ""));
        }
      } catch (err) {
        if (!isActive || err?.name === "AbortError") return;
        if (USE_MOCKS) {
          const list = Array.isArray(mockDB.workflows) ? mockDB.workflows : [];
          setWorkflows(list);
          if (!isEdit && list.length === 1) {
            setSelectedProj((prev) => prev || String(list[0]?.workflowId ?? list[0]?.id ?? ""));
          }
          return;
        }
        setWorkflows([]);
        setLoadError(err?.message || "Unable to load workflows");
      }
    };

    loadWorkflows();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [isEdit, mode, departmentFilter]);
  
  // Load assigned projects
  useEffect(() => {
    (async () => {
      setLoadingProjects(true);
      try {
        const res = await api.get("/projects/assigned");
        const list = Array.isArray(res.data) ? res.data : [];
        setProjects(list);
        if (!isEdit && list.length === 1) setSelectedProject(String(list[0].projectId));
      } catch {
        setProjects([]);
        if (USE_MOCKS) {
          setProjects(mockDB.projects);
          if (!isEdit && mockDB.projects.length === 1) setSelectedProject(String(mockDB.projects[0].projectId));
        }
      } finally {
        setLoadingProjects(false);
      }
    })();
  }, [isEdit]);

  // Fetch schema on workflow selection
  useEffect(() => {
    if (!selectedProj) {
      setSchema(null);
      setDynValues({});
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/formschemas/by-workflow/${selectedProj}`);
        const fields = (data?.schema?.fields || []).map((f) => {
          const key = f.key;
          const type = f.type || "text";
          const label = f.label || key;
          const required = !!f.required;
          const clone = { ...f, key, type, label, required };
          if (key === "projectId") {
            clone.type = "select";
            clone.options =
              (f.options && f.options.length)
                ? f.options
                : (projects || []).map((p) => ({ value: String(p.projectId), label: p.projectName }));
          }
          if (key === "legalEntity") {
            clone.type = "select";
            clone.options = (f.options && f.options.length) ? f.options : localLegalEntities;
          }
          return clone;
        });
        setSchema({ fields });

        // Reset dynamic values for new schema, but keep already filled
        const initial = {};
        fields.forEach((f) => {
          const existing = (v) => (v !== undefined && v !== null && String(v) !== "" ? v : "");
          initial[f.key] = existing(dynValues[f.key]);
        });
        if (initial.additionalInfo === undefined) initial.additionalInfo = "";
        if (initial.urgency === undefined) initial.urgency = computePriority(formData.approvalBy) || "";
        setDynValues((prev) => ({ ...initial }));
      } catch {
        setSchema({ fields: [] });
        setDynValues({});
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProj, projects]);

  // Fetch fund request details on edit only if no externalFormData
  useEffect(() => {
    if (!isEdit || !id || externalFormData) return;
    (async () => {
      setLoading(true);
      try {
        const { data: fr } = await api.get(`/fundrequests/${id}`);
        setPrefill(fr);
        if (fr.workflowId) setSelectedProj(`${fr.workflowId}`);
        if (fr.projectId) setSelectedProject(`${fr.projectId}`);

        const frFields = fr.fields || fr.Fields || [];
        const map = {};
        const approvalByFromFr =
          frFields.find((f) => (f.fieldName ?? f.FieldName) === "ApprovalBy")?.fieldValue ?? "";
        frFields.forEach((f) => {
          const name = f.fieldName ?? f.FieldName;
          const val = f.fieldValue ?? f.FieldValue;
          if (["ApprovalBy", "Priority"].includes(name)) return;
          map[name.charAt(0).toLowerCase() + name.slice(1)] = val;
        });

        setLoadingAttachments(true);
        let attachments = [];
        try {
          const { data: att } = await api.get(`/fundrequests/${id}/attachments`);
          console.log('📎 Raw attachments from API:', att);
          attachments = Array.isArray(att)
            ? att.map((a) => ({
                id: a.Id ?? a.id,
                name: a.FileName ?? a.fileName ?? a.name,
                url: `/api/fundrequests/${id}/attachments/${a.Id ?? a.id}/download`,
                isExisting: true,
              }))
            : [];
          console.log('📎 Mapped attachments:', attachments);
        } catch (err) {
          console.error('❌ Failed to fetch attachments:', err);
        }
        setFormData((p) => {
          const newData = {
            ...p,
            whatNeed: fr.requestTitle ?? fr.RequestTitle ?? "",
            whyNeed: fr.description ?? fr.Description ?? "",
            amount: fr?.amount != null ? String(fr.amount) : "",
            approvalBy:
              typeof approvalByFromFr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(approvalByFromFr)
                ? approvalByFromFr
                : "",
            attachments,
          };
          console.log('📎 FormData after setting attachments:', newData.attachments);
          return newData;
        });
        setDynValues(map);
        setLoadingAttachments(false);
      } catch {
        setSchema({ fields: [] });
        setDynValues((prev) => ({
          additionalInfo: prev?.additionalInfo ?? "",
          urgency: computePriority(formData.approvalBy) || "",
        }));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id, externalFormData]);

  // Auto-calc urgency
  useEffect(() => {
    const p = computePriority(formData.approvalBy);
    setDynValues((prev) => ({ ...prev, urgency: p || "" }));
  }, [formData.approvalBy]);

  // Submit bridge
  useEffect(() => {
    const h = () => {
      if (!disabled) handleSubmit();
    };
    document.addEventListener("initiateForm.submit", h);
    return () => document.removeEventListener("initiateForm.submit", h);
  }, [disabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── VALIDATION ──
  const errors = useMemo(() => {
    const e = {};
    if (!selectedProj && !(isEdit && IMMUTABLE_ON_EDIT.workflow)) e.workflow = "Please select a workflow.";
    const requiresProject = (schema?.fields || []).some((f) => f.key === "projectId" && f.required);
    if (requiresProject && !selectedProject) e.project = "Please select a project.";
    if (!formData.whatNeed?.trim()) e.whatNeed = "This field is required.";

    if (String(formData.amount ?? "").trim() !== "") {
      const amt = parseAmount(formData.amount);
      if (!Number.isFinite(amt) || amt <= 0) e.amount = "Enter a valid amount (> 0).";
    }

    if (!formData.approvalBy) e.approvalBy = "Please select the approval deadline.";
    else if (daysUntil(formData.approvalBy) < 0) e.approvalBy = "Approval deadline cannot be in the past.";

    (schema?.fields || []).forEach((f) => {
      if (f.required && !["projectId", "urgency", "additionalInfo"].includes(f.key)) {
        const v = dynValues?.[f.key];
        if (!v || String(v).trim() === "") e[f.key] = `${f.label} is required.`;
      }
    });
    return e;
  }, [isEdit, selectedProj, selectedProject, formData, schema, dynValues]);

  const handleBlur = (name) => setTouched((t) => ({ ...t, [name]: true }));
  const setDyn = (key, val) => setDynValues((p) => ({ ...p, [key]: val }));
  const setFD = (k, v) => setFormData((p) => ({ ...p, [k]: v }));

  const handleFiles = (fileList) => {
    if (disabled) return;
    const picked = Array.from(fileList || []);
    setFormData((prev) => {
      const key = (f) => (f.isExisting ? `existing-${f.id}` : `${f.name}|${f.size}|${f.lastModified}`);
      const map = new Map((prev.attachments || []).map((f) => [key(f), f]));
      picked.forEach((f) => map.set(`${f.name}|${f.size}|${f.lastModified}`, f));
      return { ...prev, attachments: Array.from(map.values()) };
    });
  };
  
  const handleViewAttachment = async (event, attachment) => {
    event?.preventDefault?.();
    if (!attachment || typeof window === "undefined") return;

    try {
      let blob = null;
      if (attachment.isExisting && attachment.id && id) {
        const result = await downloadAttachment(id, attachment.id, { inline: true });
        blob = result?.blob ?? null;
      } else if (typeof File !== "undefined" && attachment instanceof File) {
        blob = attachment;
      }

      if (!blob) {
        if (attachment.url) {
          window.open(attachment.url, "_blank", "noopener,noreferrer");
        }
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const newWindow = window.open(objectUrl, "_blank", "noopener,noreferrer");
      if (!newWindow) {
        URL.revokeObjectURL(objectUrl);
        alert("Unable to open attachment preview. Please allow pop-ups and try again.");
        return;
      }

      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
        newWindow.removeEventListener("beforeunload", cleanup);
      };

      newWindow.addEventListener("beforeunload", cleanup, { once: true });
      setTimeout(cleanup, 60_000);
    } catch (err) {
      console.error("Failed to preview attachment", err);
      alert("Unable to preview attachment. Please try again.");
    }
  };

  const handleDownloadAttachment = async (event, attachment) => {
    event?.preventDefault?.();
    if (!attachment || typeof window === "undefined") return;

    try {
      let blob = null;
      if (attachment.isExisting && attachment.id && id) {
        const result = await downloadAttachment(id, attachment.id, { inline: false });
        blob = result?.blob ?? null;
      } else if (typeof File !== "undefined" && attachment instanceof File) {
        blob = attachment;
      }

      if (!blob) {
        if (attachment.url) {
          const fallbackLink = document.createElement("a");
          fallbackLink.href = attachment.url;
          fallbackLink.target = "_blank";
          fallbackLink.rel = "noopener noreferrer";
          document.body.appendChild(fallbackLink);
          fallbackLink.click();
          document.body.removeChild(fallbackLink);
        }
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.name || "attachment";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      console.error("Failed to download attachment", err);
      alert("Unable to download attachment. Please try again.");
    }
  };

  const buildFieldsArray = () => {
    const fields = [];
    (schema?.fields || []).forEach((f) => {
      if (["projectId", "urgency", "additionalInfo"].includes(f.key)) return;
      let val = dynValues?.[f.key];
      if (f.key === "hyperlinkUrl" && Array.isArray(val)) {
        val = val.filter((v) => v && v.trim() !== "");
        if (val.length > 0) {
          fields.push({ fieldName: f.key.charAt(0).toUpperCase() + f.key.slice(1), fieldValue: val });
        }
      } else if (val != null && String(val).trim() !== "") {
        fields.push({ fieldName: f.key.charAt(0).toUpperCase() + f.key.slice(1), fieldValue: String(val) });
      }
    });
    if (dynValues.urgency) fields.push({ fieldName: "Urgency", fieldValue: String(dynValues.urgency) });
    if (dynValues.additionalInfo && String(dynValues.additionalInfo).trim() !== "")
      fields.push({ fieldName: "AdditionalInfo", fieldValue: String(dynValues.additionalInfo) });

    if (formData.approvalBy) fields.push({ fieldName: "ApprovalBy", fieldValue: formData.approvalBy });
    const p = computePriority(formData.approvalBy);
    if (p) fields.push({ fieldName: "Priority", fieldValue: p });
    return fields;
  };

  const handleSubmit = async () => {
    if (disabled) return;

    const requiresProject = (schema?.fields || []).some((f) => f.key === "projectId" && f.required);
    const touchedAll = { workflow: true, whatNeed: true, approvalBy: true };
    if (requiresProject) touchedAll.project = true;
    (schema?.fields || []).forEach((f) => (touchedAll[f.key] = true));
    setTouched(touchedAll);
    if (Object.keys(errors).length > 0) return;

    const wfIdForSubmit = selectedProj || (prefill?.workflowId ? `${prefill.workflowId}` : "");
    const projectIdForSubmit = selectedProject || (prefill?.projectId ? `${prefill.projectId}` : "");

    let amt = parseAmount(formData.amount);
    if (!formData.amount || !Number.isFinite(amt) || amt <= 0) amt = null;

    const payloadBase = {
      title: formData.whatNeed,
      description: formData.whyNeed,
      amount: amt,
      fields: buildFieldsArray(),
    };

    const payload = isEdit
      ? { ...payloadBase, projectId: projectIdForSubmit ? Number(projectIdForSubmit) : null }
      : { ...payloadBase, workflowId: Number(wfIdForSubmit || selectedProj), projectId: Number(projectIdForSubmit || 0) || null };

    try {
      setSubmitting(true);
      if (isEdit) {
        await api.put(`/fundrequests/${id}/resubmit`, payload);
        await uploadSelectedAttachments(id);
      } else {
        const { data } = await api.post("/fundrequests", payload);
        const newId = data?.id ?? data?.Id ?? data?.fundRequestId ?? data?.FundRequestId;
        if (newId) await uploadSelectedAttachments(newId);
      }
      navigate("/approvals?tab=initiated");
    } catch {
      alert(isEdit ? "Failed to resubmit the request." : "Failed to submit fund request.");
    } finally {
      setSubmitting(false);
    }
  };

  const uploadSelectedAttachments = async (fundRequestId) => {
    const files = Array.from(formData.attachments || []).filter((f) =>
      typeof File !== "undefined" ? f instanceof File && f.size > 0 : true
    );
    if (!fundRequestId || files.length === 0 || disabled) return;
    for (const f of files) {
      const fd = new FormData();
      fd.append("file", f, f.name);
      await api.post(`/fundrequests/${fundRequestId}/attachments`, fd);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  const neutralSectionSx = {
    borderRadius: 0.2,
    overflow: "hidden",
    borderColor: alpha(theme.palette.primary.main, 0.25),
    boxShadow: "none",
    bgcolor: theme.palette.common.white,
    p: 1,
  };

  const MAX_W = 1600;
  const containerWidthSx = { width: "97%", maxWidth: MAX_W, mx: "auto" };

  const renderDynField = (f) => {
    const label = f.required ? `${f.label} *` : f.label;
    if (f.key === "hyperlinkUrl") {
      const urls = Array.isArray(dynValues.hyperlinkUrl)
        ? dynValues.hyperlinkUrl
        : dynValues.hyperlinkUrl
        ? [dynValues.hyperlinkUrl]
        : [""];
      return (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            {label}
          </Typography>
          {urls.map((url, idx) => (
            <Stack direction="row" spacing={1} alignItems="center" key={idx} sx={{ mb: 1 }}>
              <TextField
                fullWidth
                variant="outlined"
                size="medium"
                type="url"
                value={url}
                onChange={(e) => {
                  const newUrls = [...urls];
                  newUrls[idx] = e.target.value;
                  setDyn("hyperlinkUrl", newUrls);
                }}
                onBlur={() => setTouched((t) => ({ ...t, hyperlinkUrl: true }))}
                error={touched.hyperlinkUrl && !!errors.hyperlinkUrl}
                helperText={idx === 0 && touched.hyperlinkUrl && errors.hyperlinkUrl ? errors.hyperlinkUrl : " "}
                disabled={disabled}
                placeholder="https://example.com"
              />
              <Button
                variant="outlined"
                color="error"
                size="small"
                disabled={disabled || urls.length === 1}
                onClick={() => {
                  const newUrls = urls.filter((_, i) => i !== idx);
                  setDyn("hyperlinkUrl", newUrls);
                }}
              >
                Remove
              </Button>
            </Stack>
          ))}
          <Button variant="outlined" size="small" disabled={disabled} onClick={() => setDyn("hyperlinkUrl", [...urls, ""])}>
            Add another URL
          </Button>
        </Box>
      );
    }

    if (f.key === "hyperlinkTitle") {
      return (
        <TextField
          fullWidth
          variant="outlined"
          size="medium"
          label={label}
          value={dynValues?.hyperlinkTitle ?? ""}
          onChange={(e) => setDyn("hyperlinkTitle", e.target.value)}
          error={touched.hyperlinkTitle && !!errors.hyperlinkTitle}
          helperText={touched.hyperlinkTitle && errors.hyperlinkTitle ? errors.hyperlinkTitle : " "}
          onBlur={() => setTouched((t) => ({ ...t, hyperlinkTitle: true }))}
          disabled={disabled}
        />
      );
    }

    const common = {
      fullWidth: true,
      variant: "outlined",
      size: "medium",
      sx: f.type === "textarea" ? FIELD_SX_MULTILINE : FIELD_SX,
      label,
      value: dynValues?.[f.key] ?? "",
      onChange: (e) => setDyn(f.key, e.target.value),
      error: touched[f.key] && !!errors[f.key],
      helperText: touched[f.key] && errors[f.key] ? errors[f.key] : " ",
      onBlur: () => setTouched((t) => ({ ...t, [f.key]: true })),
      disabled,
    };

    if (f.key === "legalEntity") {
      return (
        <TextField
          select
          {...common}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <BusinessIcon fontSize="small" sx={{ color: "text.secondary" }} />
              </InputAdornment>
            ),
          }}
        >
          {(f.options || localLegalEntities).map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      );
    }

    if (f.type === "select") {
      return (
        <TextField select {...common}>
          {(f.options || []).map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      );
    }

    if (f.type === "textarea") {
      return <TextField {...common} multiline minRows={3} maxRows={3} />;
    }

    if (f.type === "url") {
      return <TextField {...common} type="url" />;
    }

    return <TextField {...common} />;
  };

  return (
    <Box>
      {/* Heading */}
      <Stack direction="row" alignItems="center" spacing={0.2} sx={{ mb: 3, mt: 4 }}>
        <IconButton
          onClick={() => (typeof onCancel === "function" ? onCancel() : navigate(-1))}
          size="small"
          sx={{ color: "common.white" }}
          aria-label="Back"
        >
          <ArrowBackIosNewIcon fontSize="small" />
        </IconButton>
        <Typography variant="h6" fontWeight={800} sx={{ color: "common.white" }}>
          {mode === "approver" ? "Approve Request" : " Approval"}
        </Typography>
      </Stack>

      {/* Container 1 */}
      <Paper variant="outlined" sx={{ ...neutralSectionSx, ...containerWidthSx, mb: "24px" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Workflow
          </Typography>
          {showPathButton && (
            <Button size="small" variant="outlined" startIcon={<TimelineIcon />} onClick={onOpenPath}>
              Path
            </Button>
          )}
        </Box>

        {loadError && !USE_MOCKS && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>API Unavailable</AlertTitle>
            {String(loadError)} — Start your backend at the configured API base or enable mocks.
          </Alert>
        )}

        <TextField
          select
          fullWidth
          variant="outlined"
          size="medium"
          sx={FIELD_SX}
          label="Workflow *"
          value={selectedProj}
          onChange={(e) => setSelectedProj(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, workflow: true }))}
          disabled={((isEdit && IMMUTABLE_ON_EDIT.workflow) || disabled)}
          error={touched.workflow && !!errors.workflow}
          helperText={touched.workflow && errors.workflow ? errors.workflow : " "}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <DomainIcon fontSize="small" sx={{ color: "text.secondary" }} />
              </InputAdornment>
            ),
          }}
        >
          {workflows.length === 0 && <MenuItem disabled value="">No workflows available</MenuItem>}
          {workflows.map((wf) => (
            <MenuItem key={wf.workflowId} value={wf.workflowId}>
              {wf.name}
            </MenuItem>
          ))}
        </TextField>
      </Paper>

      {/* Container 2 */}
      <Paper variant="outlined" sx={{ ...neutralSectionSx, ...containerWidthSx, mb: "24px", minHeight: 550 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 2,
            alignItems: "stretch",
            gridAutoFlow: "row dense",
            boxSizing: "border-box",
          }}
        >
          {/* Project */}
          <Box sx={CELL_SX}>
            <TextField
              select
              fullWidth
              variant="outlined"
              size="medium"
              sx={FIELD_SX}
              label={`Project${isReq("projectId") ? " *" : ""}`}
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              onBlur={() => handleBlur("project")}
              disabled={disabled || loadingProjects || projects.length === 0}
              error={touched.project && !!errors.project}
              helperText={
                touched.project && errors.project
                  ? errors.project
                  : projects.length === 0
                  ? loadingProjects
                    ? "Loading projects..."
                    : "No projects assigned to your account"
                  : " "
              }
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <WorkOutlineIcon fontSize="small" sx={{ color: "text.secondary" }} />
                  </InputAdornment>
                ),
              }}
            >
              {projects.map((p) => (
                <MenuItem key={p.projectId} value={p.projectId}>
                  {p.projectName}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          {/* Amount */}
          <Box sx={CELL_SX}>
            <TextField
              label="Amount"
              fullWidth
              variant="outlined"
              size="medium"
              sx={FIELD_SX}
              value={formData.amount}
              onChange={(e) => {
                const v = e.target.value.replace(/,/g, "");
                if (/^\d*\.?\d{0,2}$/.test(v) || v === "") setFD("amount", v);
              }}
              onBlur={() => handleBlur("amount")}
              error={touched.amount && !!errors.amount}
              helperText={touched.amount && errors.amount ? errors.amount : " "}
              inputProps={{ inputMode: "decimal" }}
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              disabled={disabled}
            />
          </Box>

          {/* When needed */}
          <Box sx={CELL_SX}>
            <TextField
              label="When do you need it by? *"
              type="date"
              fullWidth
              variant="outlined"
              size="medium"
              sx={FIELD_SX}
              value={formData.approvalBy}
              onChange={(e) => setFD("approvalBy", e.target.value)}
              onBlur={() => handleBlur("approvalBy")}
              error={touched.approvalBy && !!errors.approvalBy}
              helperText={touched.approvalBy && errors.approvalBy ? errors.approvalBy : " "}
              inputProps={{ min: todayISO() }}
              InputLabelProps={{ shrink: true }}
              disabled={disabled}
            />
          </Box>

          {/* Urgency — read-only */}
          <Box sx={CELL_SX}>
            <TextField
              select
              label="How urgent is this request?"
              fullWidth
              variant="outlined"
              size="medium"
              sx={FIELD_SX}
              value={dynValues.urgency || ""}
              disabled
              helperText={"Auto-calculated from approval deadline"}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PriorityHighIcon fontSize="small" sx={{ color: "text.secondary" }} />
                  </InputAdornment>
                ),
              }}
            >
              <MenuItem value="Low">Low</MenuItem>
              <MenuItem value="Medium">Medium</MenuItem>
              <MenuItem value="High">High</MenuItem>
            </TextField>
          </Box>

          {/* What / Why */}
          <Box sx={CELL_SX}>
            <TextField
              label="What do you need? *"
              fullWidth
              multiline
              minRows={3}
              maxRows={3}
              variant="outlined"
              size="medium"
              sx={FIELD_SX_MULTILINE}
              value={formData.whatNeed}
              onChange={(e) => setFD("whatNeed", e.target.value)}
              onBlur={() => handleBlur("whatNeed")}
              error={touched.whatNeed && !!errors.whatNeed}
              helperText={touched.whatNeed && errors.whatNeed ? errors.whatNeed : " "}
              disabled={disabled}
            />
          </Box>
          <Box sx={CELL_SX}>
            <TextField
              label="Why do you need it?"
              fullWidth
              multiline
              minRows={3}
              maxRows={3}
              variant="outlined"
              size="medium"
              sx={FIELD_SX_MULTILINE}
              value={formData.whyNeed}
              onChange={(e) => setFD("whyNeed", e.target.value)}
              helperText={" "}
              disabled={disabled}
            />
          </Box>

          {/* Additional Info */}
          <Box sx={CELL_SX}>
            <TextField
              label="History or Any Additional Information"
              fullWidth
              multiline
              minRows={3}
              maxRows={3}
              variant="outlined"
              size="medium"
              sx={FIELD_SX_MULTILINE}
              value={dynValues.additionalInfo || ""}
              onChange={(e) => setDyn("additionalInfo", e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, additionalInfo: true }))}
              error={touched.additionalInfo && !!errors.additionalInfo}
              helperText={touched.additionalInfo && errors.additionalInfo ? errors.additionalInfo : " "}
              disabled={disabled}
            />
          </Box>

          {/* Dynamic fields */}
          {(schema?.fields || [])
            .filter((f) => !["projectId", "urgency", "additionalInfo"].includes(f.key))
            .map((f) => (
              <Box key={f.key} sx={CELL_SX}>
                {renderDynField(f)}
              </Box>
            ))}

          {/* Attachments */}
          {showAttachments && (
            <Box sx={{ gridColumn: "1 / -1" }}>
              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                {allowAttachmentEdit && (
                  <Tooltip title={disabled ? "Attachments disabled by policy" : "Upload attachments"}>
                    <span>
                      <Button
                        variant="outlined"
                        startIcon={<AttachFileIcon />}
                        component="label"
                        disabled={disabled}
                        sx={{
                          borderStyle: "dashed",
                          bgcolor: "transparent",
                          borderColor: alpha(theme.palette.primary.main, 0.5),
                          color: theme.palette.primary.main,
                          fontWeight: 700,
                          "&:hover": { bgcolor: alpha(theme.palette.primary.light, 0.06) },
                        }}
                      >
                        Select file(s). OR Drag a file here to upload
                        <input
                          type="file"
                          hidden
                          multiple
                          ref={fileInputRef}
                          onChange={(e) => {
                            handleFiles(e.target.files);
                            if (e.target) e.target.value = "";
                          }}
                          disabled={disabled}
                        />
                      </Button>
                    </span>
                  </Tooltip>
                )}

                {console.log('📎 Attachments in render:', formData.attachments)}
                {console.log('📎 Attachments in render:', formData.attachments)}
             {formData.attachments?.length > 0 &&
                  formData.attachments.map((f, i) => {
                    const key = f.id || `${f.name || "attachment"}-${f.size || ""}-${i}`;
                    return (
                      <span
                        key={key}
                        style={{ display: "inline-flex", alignItems: "center", margin: 4 }}
                      >
                        <Chip label={f.name} variant="outlined" sx={{ m: 0.5 }} />
                        <Button
                          size="small"
                          variant="text"
                          onClick={(event) => handleViewAttachment(event, f)}
                          sx={{ ml: 0.5 }}
                        >
                          View
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          onClick={(event) => handleDownloadAttachment(event, f)}
                          sx={{ ml: 0.5 }}
                        >
                          Download
                        </Button>
                        {allowAttachmentEdit && !disabled && (
                          <Button
                            size="small"
                            color="error"
                            variant="text"
                            onClick={() =>
                              setFormData((p) => ({
                                ...p,
                                attachments: p.attachments.filter((_, idx) => idx !== i),
                              }))
                            }
                            sx={{ ml: 0.5 }}
                          >
                            Remove
                          </Button>
                        )}
                      </span>
                    );
                  })}
              </Stack>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Footer actions */}
      {!hideActions && (
        <Box sx={{ ...containerWidthSx }}>
          <Divider sx={{ mb: 2, borderColor: (t) => alpha(t.palette.divider, 0.6) }} />
          {mode === "approver" ? (
            <ApproverActionBar
              id={id}
              approvalId={approvalId}
              onDone={typeof onApproverDone === "function" ? onApproverDone : undefined}
            />
          ) : (
            <Stack direction="row" spacing={2} justifyContent="flex-start">
              {showButtons.cancel && (
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={() => (typeof onCancel === "function" ? onCancel() : window.history.back())}
                  disabled={disabled || submitting}
                >
                  Cancel
                </Button>
              )}
              {showButtons.update && (
                <Button variant="contained" color="primary" onClick={handleSubmit} disabled={submitting || disabled}>
                  {tabKey === "sentback"
                    ? submitting
                      ? "Resubmitting…"
                      : "Resubmit"
                    : submitting
                    ? isEdit
                      ? "Updating…"
                      : "Submitting…"
                    : isEdit
                    ? "Update"
                    : "Submit"}
                </Button>
              )}
              {showButtons.share && (
                <Button
                  variant="outlined"
                  onClick={() => {
                    if (navigator.share) navigator.share({ title: formData.whatNeed || "Approval", url: window.location.href });
                  }}
                >
                  Share
                </Button>
              )}
            </Stack>
          )}
        </Box>
      )}
    </Box>
  );
}

// Export with Router fallback and policy props passthrough
const defaultButtonsConfig = {
  showUpdate: true,
  showCancel: true,
  updateText: "Update",
  cancelText: "Cancel",
};

export default function InitiateForm(props) {
  const { buttonsConfig = defaultButtonsConfig } = props;
  const inRouter = useInRouterContext();
  return inRouter ? (
    <InitiateFormImpl {...props} />
  ) : (
    <MemoryRouter initialEntries={["/"]}>
      <InitiateFormImpl {...props} />
    </MemoryRouter>
  );
}
