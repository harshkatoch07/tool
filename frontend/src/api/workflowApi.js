// src/api/workflowApi.js
const API = "/api/workflow"; // 👈 match WorkFlowController route

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// --- Designations ---
export async function getDesignations(q = "") {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  const res = await fetch(`${API}/designations${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`getDesignations failed: ${res.status}`);
  return res.json();
}

// --- Workflows (Admin) ---
// GET /api/workflow/admin
export async function getAllWorkflowsAdmin() {
  const res = await fetch(`${API}/admin`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`getAllWorkflowsAdmin failed: ${res.status}`);
  return res.json();
}

// Workflows assigned/available to current user
// GET /api/workflow
export async function getAssignedWorkflows({ departmentId, initiatorOnly } = {}) {
  const params = new URLSearchParams();
  if (departmentId != null) params.set("departmentId", String(departmentId));
  if (initiatorOnly != null) params.set("initiatorOnly", String(initiatorOnly));
  const q = params.toString();
  const url = q ? `${API}?${q}` : `${API}`;

  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`getAssignedWorkflows failed: ${res.status}`);
  return res.json();
}

// One workflow
// GET /api/workflow/{id}
export async function getWorkflowById(id, { initiatorOnly } = {}) {
  const q = initiatorOnly != null ? `?initiatorOnly=${initiatorOnly}` : "";
  const res = await fetch(`${API}/${id}${q}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`getWorkflowById failed: ${res.status}`);
  return res.json();
}

// Create / Update / Delete
// POST /api/workflow
export async function createWorkflow(payload) {
  const res = await fetch(`${API}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`createWorkflow failed: ${res.status}`);
  return res.json();
}

// PUT /api/workflow/{id}
export async function updateWorkflow(id, payload) {
  const res = await fetch(`${API}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`updateWorkflow failed: ${res.status}`);
  return res.json();
}

// DELETE /api/workflow/{id}
export async function deleteWorkflow(id) {
  const res = await fetch(`${API}/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`deleteWorkflow failed: ${res.status}`);
  return true;
}

// Steps for a workflow
// NOTE: Your controller returns steps inside the workflow payload.
// We fetch the workflow and return its Steps array.
export async function getWorkflowSteps(workflowId) {
  const wf = await getWorkflowById(workflowId);
  // handle both camelCase and PascalCase just in case
  return wf.steps ?? wf.Steps ?? [];
}
