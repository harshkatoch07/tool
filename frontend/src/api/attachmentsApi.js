// src/api/attachmentsApi.js
import axios from "axios";

// Base URL normalization:
// - DEV (CRA proxy): leave REACT_APP_API_BASE unset → baseURL "/api"
// - PROD (no proxy): set REACT_APP_API_BASE to "http://host:port" (no trailing /api)
const RAW = process.env.REACT_APP_API_BASE || "/api";
const API_BASE = RAW.endsWith("/api") ? RAW : `${RAW.replace(/\/$/, "")}/api`;

const api = axios.create({ baseURL: API_BASE });

// Always add Bearer token if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---- Attachments API ----
export async function listAttachments(fundRequestId, signal) {
  try {
    const { data } = await api.get(`/fundrequests/${fundRequestId}/attachments`, { signal });
    return Array.isArray(data) ? data : [];
  } catch (e) {
    throw new Error("Failed to load attachments");
  }
}

// Server-driven “can I edit?” flag (optional; falls back in UI if this 404s)
export async function canEditAttachments(fundRequestId) {
  try {
    const { data } = await api.get(`/fundrequests/${fundRequestId}/attachments/can-edit`);
    return !!data?.canEdit;
  } catch {
    return null; // let the UI use its heuristic
  }
}

// Add one file (server expects the field name to be *file*)
export async function addAttachment(fundRequestId, file) {
  const form = new FormData();
  form.append("file", file);
  await api.post(`/fundrequests/${fundRequestId}/attachments`, form);
}

// Replace an existing attachment with a new file
export async function replaceAttachment(fundRequestId, attachmentId, file) {
  const form = new FormData();
  form.append("file", file);
  await api.post(`/fundrequests/${fundRequestId}/attachments/${attachmentId}/replace`, form);
}

// Delete an attachment
export async function deleteAttachment(fundRequestId, attachmentId) {
  await api.delete(`/fundrequests/${fundRequestId}/attachments/${attachmentId}`);
}

// Download (inline=false by default)
export async function downloadAttachment(fundRequestId, attachmentId, { inline = false } = {}) {
  const { data, headers } = await api.get(
    `/fundrequests/${fundRequestId}/attachments/${attachmentId}/download${inline ? "?inline=true" : ""}`,
    { responseType: "blob" }
  );
  return { blob: data, contentType: headers["content-type"] || "application/octet-stream" };
}
