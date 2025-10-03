// src/api/adminApi.js
import axios from "axios";

const api = axios.create({
  baseURL: "/api", // 👈 was http://localhost:5292/api
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─────────────────────────────────────────────────────────────
// Admin dashboard: recent activities
export async function getRecentActivities(limit = 20) {
  const { data } = await api.get(`/admin/recent-activities?limit=${limit}`);
  return data;
}

// Fund request details (flat DTO, no cycles)
export async function getFundRequestDetails(id) {
  if (!id) throw new Error("FundRequest id is required");
  const { data } = await api.get(`/fundrequests/${id}`);
  return data;
}

// ─────────────────────────────────────────────────────────────
// Download workflow Excel template (robust Blob handling)
export async function downloadWorkflowTemplate() {
  try {
    const res = await api.get("/admin/workflows/import/template", {
      responseType: "arraybuffer",
      validateStatus: (s) => s >= 200 && s < 300,
    });

    const contentType =
      res.headers["content-type"] ||
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    if (
      contentType.includes("json") ||
      contentType.includes("text/plain") ||
      contentType.includes("html")
    ) {
      const text = new TextDecoder().decode(res.data);
      throw new Error(text || "Server returned non-file response.");
    }

    return new Blob([res.data], { type: contentType });
  } catch (err) {
    const ab = err?.response?.data;
    if (ab && ab instanceof ArrayBuffer) {
      try {
        const text = new TextDecoder().decode(ab);
        throw new Error(text || "Failed to download template.");
      } catch { /* ignore decode issues */ }
    }
    throw new Error(
      err?.message || err?.response?.statusText || "Failed to download template."
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Upload/import workflows Excel (multipart/form-data)
export async function uploadWorkflowsExcel(formData) {
  try {
    const { data } = await api.post("/admin/workflows/import", formData, {});
    return data;
  } catch (err) {
    const ab = err?.response?.data;
    if (ab && ab instanceof ArrayBuffer) {
      try {
        const text = new TextDecoder().decode(ab);
        throw new Error(text || "Failed to import workflows.");
      } catch { /* ignore */ }
    }
    throw new Error(
      err?.response?.data?.message ||
        err?.message ||
        "Failed to import workflows."
    );
  }
}

export default api;
