// src/utils/status.js

// UI canonical statuses (what the chips/filter show)
export const STATUS_OPTIONS = ["Pending", "Approved", "Sent Back", "Rejected"];

// Raw DB values from CHECK CK_Approvals_Status
// (Provided, FinalReceiver, SentBack, Rejected, Approved, Pending)
const DB_TO_UI = {
  Pending: "Pending",
  Approved: "Approved",
  Rejected: "Rejected",
  SentBack: "Sent Back",
  // 👇 Make a call: treat Provided as "Pending" and FinalReceiver as "Approved" for list UIs.
  Provided: "Pending",
  FinalReceiver: "Approved",
};

export function normalizeDbStatus(dbStatus) {
  if (!dbStatus) return "";
  return DB_TO_UI[dbStatus] ?? dbStatus;
}

export function statusToColor(uiStatus) {
  switch (uiStatus) {
    case "Approved":
      return "success";
    case "Rejected":
      return "error";
    case "Sent Back":
      return "warning";
    default:
      return "default";
  }
}
