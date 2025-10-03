// src/config/initiateForms.js
export const INITIATE_FORM_SETTINGS = {
  // sensible defaults for tabs we don't list explicitly
  __default: {
    readOnly: false,                 // force read-only (in addition to first-approver rule)
    showApprovalPathBtn: true,
    showButtons: { update: true, share: true, cancel: true },
    hiddenFields: [],                // e.g. ["history", "urgency"]
    requiredOverrides: {},           // e.g. { reason: true, urgency: false }
    lockOnFirstApproval: true,       // if first approver approved ⇒ lock form
  },

  assigned: {
    readOnly: true,
    showButtons: { update: false, share: true, cancel: true },
  },
  initiated: {
    readOnly: false,
    showButtons: { update: true, share: true, cancel: true },
  },
  approved: {
    readOnly: true,
    showButtons: { update: false, share: true, cancel: true },
  },
  "sentback": {
    readOnly: false,
    showButtons: { update: true, share: true, cancel: true },
  },
  rejected: {
    readOnly: true,
    showButtons: { update: false, share: true, cancel: true },
  },
  final: {
    readOnly: true,
    showButtons: { update: false, share: true, cancel: true },
  },
};
