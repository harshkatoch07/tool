// src/utils/resolveInitiateFormSettings.js
import { INITIATE_FORM_SETTINGS } from "../config/initiateForms";

/**
 * Enforces:
 * - Initiator can edit while status/tab is 'initiated' and first approver not approved.
 * - Once first approver approves, initiator is locked on all tabs EXCEPT 'sentback'.
 * - On 'sentback', initiator can edit and resubmit.
 */
export function resolveInitiateFormSettings(tab, opts = {}) {
  const base = INITIATE_FORM_SETTINGS.__default || {};
  const perTab = INITIATE_FORM_SETTINGS[tab] || {};

  const merged = {
    readOnly: perTab.readOnly ?? base.readOnly ?? false,
    showApprovalPathBtn: perTab.showApprovalPathBtn ?? base.showApprovalPathBtn ?? true,
    showButtons: {
      update:
        (perTab.showButtons && perTab.showButtons.update) ??
        (base.showButtons && base.showButtons.update) ??
        true,
      share:
        (perTab.showButtons && perTab.showButtons.share) ??
        (base.showButtons && base.showButtons.share) ??
        true,
      cancel:
        (perTab.showButtons && perTab.showButtons.cancel) ??
        (base.showButtons && base.showButtons.cancel) ??
        true,
    },
    hiddenFields: [...(base.hiddenFields || []), ...(perTab.hiddenFields || [])],
    requiredOverrides: { ...(base.requiredOverrides || {}), ...(perTab.requiredOverrides || {}) },
    lockOnFirstApproval: perTab.lockOnFirstApproval ?? base.lockOnFirstApproval ?? true,
  };

  // Lock after first approver approval on every tab except 'sentback'
  if (merged.lockOnFirstApproval && opts.firstApproverApproved && tab !== "sentback") {
    merged.readOnly = true;
    merged.showButtons.update = false;
  }

  return merged;
}
