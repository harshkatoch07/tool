// src/api/approvalsApi.js
import axios from "axios";

const RAW = process.env.REACT_APP_API_BASE || "/api";
const API_BASE = RAW.endsWith("/api") ? RAW : `${RAW.replace(/\/$/, "")}/api`;

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  // Allow a manual token override if caller passes one,
  // otherwise pull from localStorage.
  if (!config.headers.Authorization) {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});


/**
 * Normalize server rows so the table can always rely on the same keys.
 * We keep both "new" and "legacy" names so *any* column config will work.
 */
function normalizeRow(x) {
  const id = x.approvalId ?? x.fundRequestId ?? x.id ?? null;

  return {
    // canonical IDs
    id,
    approvalId: x.approvalId ?? null,
    fundRequestId: x.fundRequestId ?? null,

    // title / approvals text
    title: x.approvals ?? x.title ?? x.requestTitle ?? x.name ?? null,
    approvals: x.approvals ?? x.title ?? x.requestTitle ?? x.name ?? null, // keep both keys for safety

    // particulars / workflow/category
    particulars: x.particulars ?? x.workflowName ?? x.workflow ?? x.categoryName ?? null,
    workflowName: x.workflowName ?? x.workflow ?? null, // optional legacy support

    // initiated by / requester name
    initiatedBy: x.initiatedBy ?? x.initiatorName ?? x.requesterName ?? null,

    // dates (canonical first; also expose legacy keys the grid might read)
    initiatedDate: x.initiatedDate ?? x.createdAt ?? x.created ?? null,
    createdAt: x.initiatedDate ?? x.createdAt ?? x.created ?? null,

    lastActionDate: x.lastActionDate ?? x.lastActionAt ?? x.actionedAt ?? x.ApprovedAt ?? null,
    lastActionAt: x.lastActionDate ?? x.lastActionAt ?? x.actionedAt ?? x.ApprovedAt ?? null,

    approvalNeededByDate:
      x.approvalNeededByDate ??
      x.neededBy ??
      x.dueBy ??
      x.requiredByDate ??
      x.deadline ??
      null,
    neededBy:
      x.approvalNeededByDate ??
      x.neededBy ??
      x.dueBy ??
      x.requiredByDate ??
      x.deadline ??
      null,

    // status
    approvalStatus: x.approvalStatus ?? x.status ?? null,
    status: x.approvalStatus ?? x.status ?? null,

    // keep the original for debugging if needed
    __raw: x,
  };
}

// List approvals for a tab (assigned|initiated|approved|rejected|sentback|final)
export async function getApprovals(filterKey /* e.g., 'initiated' */, tokenOverride) {
  const headers = tokenOverride ? { Authorization: `Bearer ${tokenOverride}` } : undefined;
  const { data } = await api.get(`/approvals`, { params: { filter: filterKey }, headers });
  const arr = Array.isArray(data) ? data : [];
  return arr.map(normalizeRow);
}

// 🔥 Convenience helper: everything the current user has personally approved
// Valid filters: 'assigned', 'initiated', 'approved', 'rejected', 'sentback', 'final'
// Option A (recommended): uses the filter switch
export async function getApprovedByMe(tokenOverride) {
  return getApprovals("approved", tokenOverride);
}

// Option B (also works): hits the dedicated route on the backend
export async function getApprovedByMeDirect(tokenOverride) {
  const headers = tokenOverride ? { Authorization: `Bearer ${tokenOverride}` } : undefined;
  const { data } = await api.get(`/approvals?filter=approved`, { headers });
  const arr = Array.isArray(data) ? data : [];
  return arr.map(normalizeRow);
}

// (Optional) fetch a single approval detail if you want to centralize it
export async function getApproval(id) {
  const { data } = await api.get(`/approvals/${id}`);
  return data;
}

// (Optional) trail helper used by the table expander
export async function getApprovalTrail(id) {
  const { data } = await api.get(`/approvals/${id}/trail`);
  return data;
}
  