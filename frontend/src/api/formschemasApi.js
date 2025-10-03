export async function getFormSchemaByWorkflow(workflowId) {
  const r = await fetch(`/api/formschemas/by-workflow/${workflowId}`, { credentials: "include" });
  if (!r.ok) throw new Error(`Schema fetch failed: ${r.status}`);
  return r.json();
}
