import React, { useEffect, useState } from "react";

type FieldDto = { name: string; value?: string | null };
type AttachmentDto = { id: number; fileName: string; fileSize: number; contentType: string };
type TrailItem = { level: number; approverName: string; status: string; actionedAt?: string | null; comments?: string | null };

type FinalReceiverRequest = {
  id: number;
  title: string;
  description?: string | null;
  amount: number;
  status: string;
  createdAt: string;
  initiatorName: string;
  initiatorEmail?: string | null;
  departmentName?: string | null;
  projectName?: string | null;
  fields: FieldDto[];
  attachments: AttachmentDto[];
  trail: TrailItem[];
};

function formatDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString();
}

function mapStatus(s: string) {
  return s === "FinalReceiver" ? "Provided" : s;
}

async function fetchFinalRequest(fundRequestId: number): Promise<FinalReceiverRequest> {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("jwt") ||
    localStorage.getItem("access_token") ||
    "";
  const res = await fetch(`/api/final-receiver/requests/${fundRequestId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchBlob(url: string): Promise<Blob> {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("jwt") ||
    localStorage.getItem("access_token") ||
    "";
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!res.ok) throw new Error(await res.text());
  return res.blob();
}

async function viewAttachment(attachmentId: number) {
  const blob = await fetchBlob(`/api/fundrequests/attachments/${attachmentId}/view`);
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

async function downloadAttachment(attachmentId: number, filename?: string) {
  const blob = await fetchBlob(`/api/fundrequests/attachments/${attachmentId}/download`);
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename || "file";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

function fmtBytes(n?: number | null) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FinalReceiverDetailsDialog({
  open,
  fundRequestId,
  onClose,
}: {
  open: boolean;
  fundRequestId: number | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<FinalReceiverRequest | null>(null);

  useEffect(() => {
    if (!open || !fundRequestId) return;
    setLoading(true);
    setErr(null);
    fetchFinalRequest(fundRequestId)
      .then(setData)
      .catch((e) => setErr(e.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [open, fundRequestId]);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div aria-modal role="dialog" className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-[min(980px,90vw)] max-h-[85vh] overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-lg font-semibold">
            {data ? `Request #${data.id}: ${data.title}` : "Request"}{" "}
          </h3>
          <button onClick={onClose} className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50">
            Close
          </button>
        </div>

        <div className="max-h-[75vh] overflow-auto p-5">
          {loading && <div className="py-6 text-sm text-gray-600">Loading…</div>}
          {err && (
            <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {err}
            </div>
          )}
          {!loading && !err && data && (
            <>
              {/* Summary */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <div className="text-xs uppercase text-gray-500">Status</div>
                  <div className="mt-1 text-base font-medium">{mapStatus(data.status)}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-xs uppercase text-gray-500">Amount</div>
                  <div className="mt-1 text-base font-medium">{data.amount}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-xs uppercase text-gray-500">Created</div>
                  <div className="mt-1 text-base">{formatDate(data.createdAt)}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-xs uppercase text-gray-500">Initiator</div>
                  <div className="mt-1 text-base">
                    {data.initiatorName}
                    {data.initiatorEmail ? ` • ${data.initiatorEmail}` : ""}
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-xs uppercase text-gray-500">Department</div>
                  <div className="mt-1 text-base">{data.departmentName || "—"}</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-xs uppercase text-gray-500">Project</div>
                  <div className="mt-1 text-base">{data.projectName || "—"}</div>
                </div>
              </div>

              {data.description && (
                <div className="mt-4 rounded-lg border p-4">
                  <div className="text-sm font-medium">Description</div>
                  <div className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{data.description}</div>
                </div>
              )}

              {/* Form fields */}
              <div className="mt-6">
                <div className="mb-2 text-sm font-semibold">Form Data</div>
                <div className="overflow-auto rounded-lg border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Field</th>
                        <th className="px-3 py-2 text-left font-medium">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.fields.length === 0 && (
                        <tr>
                          <td className="px-3 py-2" colSpan={2}>
                            —
                          </td>
                        </tr>
                      )}
                      {data.fields.map((f, i) => (
                        <tr key={i} className="odd:bg-white even:bg-gray-50">
                          <td className="px-3 py-2">{f.name}</td>
                          <td className="px-3 py-2">{f.value ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Attachments with View/Download */}
              <div className="mt-6">
                <div className="mb-2 text-sm font-semibold">Attachments</div>
                <div className="overflow-auto rounded-lg border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">File</th>
                        <th className="px-3 py-2 text-left font-medium">Type</th>
                        <th className="px-3 py-2 text-left font-medium">Size</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.attachments.length === 0 && (
                        <tr>
                          <td className="px-3 py-2" colSpan={4}>
                            —
                          </td>
                        </tr>
                      )}
                      {data.attachments.map((a) => (
                        <tr key={a.id} className="odd:bg-white even:bg-gray-50">
                          <td className="px-3 py-2">{a.fileName}</td>
                          <td className="px-3 py-2">{a.contentType}</td>
                          <td className="px-3 py-2">{fmtBytes(a.fileSize)}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
                                onClick={() => viewAttachment(a.id)}
                              >
                                View
                              </button>
                              <button
                                className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
                                onClick={() => downloadAttachment(a.id, a.fileName)}
                              >
                                Download
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Approval trail */}
              <div className="mt-6">
                <div className="mb-2 text-sm font-semibold">Approval Trail</div>
                <div className="overflow-auto rounded-lg border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Level</th>
                        <th className="px-3 py-2 text-left font-medium">Approver</th>
                        <th className="px-3 py-2 text-left font-medium">Status</th>
                        <th className="px-3 py-2 text-left font-medium">Actioned At</th>
                        <th className="px-3 py-2 text-left font-medium">Comments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.trail.map((t, i) => (
                        <tr key={i} className="odd:bg-white even:bg-gray-50">
                          <td className="px-3 py-2">{t.level}</td>
                          <td className="px-3 py-2">{t.approverName}</td>
                          <td className="px-3 py-2">{mapStatus(t.status)}</td>
                          <td className="px-3 py-2">{formatDate(t.actionedAt)}</td>
                          <td className="px-3 py-2">{t.comments ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
