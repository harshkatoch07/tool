// src/utils/tabFromStatus.js
export function tabFromStatus(status) {
  const s = (status || "").toLowerCase();
  if (s === "pending" || s === "initiated") return "initiated";
  if (s === "assigned") return "assigned";
  if (s === "approved") return "approved";
  if (s === "sentback" || s === "sent-back" || s === "sent back") return "sentback";
  if (s === "rejected") return "rejected";
  if (s === "final" || s === "completed" || s === "closed") return "final";
  return "initiated";
}
