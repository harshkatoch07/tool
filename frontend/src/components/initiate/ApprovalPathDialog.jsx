// src/components/initiate/ApprovalPathDialog.jsx
import React, { useMemo } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Button, Box, Stack, Avatar, Chip, Typography, Divider, Tooltip
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AccessTimeRounded from "@mui/icons-material/AccessTimeRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import CancelRounded from "@mui/icons-material/CancelRounded";
import ReplyRounded from "@mui/icons-material/ReplyRounded";
import { alpha } from "@mui/material/styles";

const COLORS = {
  rail: (t) => alpha(t.palette.divider, 0.8),
  initiatorBg: "#F4C84A",
  initiatorFg: "#1E293B",
  approverDot: (t) => alpha(t.palette.grey[700], 0.85),
  cardBorder: (t) => alpha(t.palette.divider, 0.9),
};

const STATUS = {
  pending:   { label: "Pending",    color: "default", icon: <AccessTimeRounded fontSize="small" /> },
  initiated: { label: "Initiated",  color: "info",    icon: <AccessTimeRounded fontSize="small" /> },
  submitted: { label: "Submitted",  color: "info",    icon: <AccessTimeRounded fontSize="small" /> },
  approved:  { label: "Approved",   color: "success", icon: <CheckCircleRounded fontSize="small" /> },
  rejected:  { label: "Rejected",   color: "error",   icon: <CancelRounded fontSize="small" /> },
  sentback:  { label: "Sent Back",  color: "warning", icon: <ReplyRounded fontSize="small" /> },
  returned:  { label: "Sent Back",  color: "warning", icon: <ReplyRounded fontSize="small" /> },
  reopened:  { label: "Re-opened",  color: "info",    icon: <AccessTimeRounded fontSize="small" /> },
  finalreceiver: { label: "Final Receiver", color: "info", icon: <AccessTimeRounded fontSize="small" /> },
};

const toTime = (x) => {
  if (!x) return null;
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
};
const fmt = (dt) => {
  if (!dt) return "—";
  const d = new Date(dt);
  return Number.isNaN(d) ? String(dt) : d.toLocaleString();
};
const ord = (n) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const isInitiatorStep = (step, trail) => {
  const type = String(step?.stepType || step?.type || "").toLowerCase();
  const status = String(step?.status || "").toLowerCase();
  // Names removed from comparison
  const initName = "";
  return (
    step?.isInitiator === true ||
    step?._isInitiator === true ||
    type === "initiator" ||
    status === "initiated" ||
    step?.sequence === 0 ||
    false  // Name comparison removed
  );
};

export default function ApprovalPathDialog({ open, onClose, trail, loading }) {
  const { steps, requestStatus } = useMemo(() => {
    // Filter out final receivers from steps
    const raw = Array.isArray(trail?.steps)
      ? trail.steps.filter(step => {
          const status = String(step?.status || "").toLowerCase();
          const stepName = String(step?.stepName || step?.StepName || "").toLowerCase();
          return !step?.isFinalReceiver 
            && status !== "finalreceiver"
            && stepName !== "final receiver"
            && !stepName.includes("final");
        })
      : [];

    // Ensure initiator exists
    let initIdx = raw.findIndex((s) => isInitiatorStep(s, trail));
    if (initIdx === -1) {
      const initiatorName =
        trail?.initiatorName || trail?.requestedByName || trail?.createdByName || "Initiator";
      raw.unshift({
        _isInitiator: true,
        isInitiator: true,
        sequence: 0,
        status: "Initiated",
        approverName: "",
        designationName: "Initiator",
        remarks: "",
        actedAt: trail?.createdAt || trail?.requestedAt || null,
      });
      initIdx = 0;
    } else {
      raw[initIdx]._isInitiator = true;
      raw[initIdx].isInitiator = true;
      if (!raw[initIdx].status) raw[initIdx].status = "Initiated";
      if (raw[initIdx].sequence == null) raw[initIdx].sequence = 0;
    }

    // Sort initiator first then by sequence
    const sorted = raw.slice().sort((a, b) => {
      const ai = a._isInitiator ? -1 : 0;
      const bi = b._isInitiator ? -1 : 0;
      if (ai !== bi) return ai - bi;
      const as = a.sequence ?? Number.MAX_SAFE_INTEGER;
      const bs = b.sequence ?? Number.MAX_SAFE_INTEGER;
      return as - bs;
    });

    // Display sequence
    let rank = 0;
    const normalized = sorted.map((s) => {
      const isInit = !!s._isInitiator || !!s.isInitiator;
      const out = { ...s, _isInitiator: isInit };
      out._actedAtTs = toTime(s.actedAt || s.actionedAt);
      out._assignedAtTs = toTime(s.assignedAt);
      if (isInit) out._displaySeq = "I";
      else { rank += 1; out._displaySeq = rank; }
      return out;
    });

    // Explicit Sent Back tagging (if API logs it)
    const explicitTargetKey = (s) =>
      s?.returnedToSequence ?? s?.returnedTo ?? s?.sentBackTo ?? null;

    normalized.forEach((s) => {
      const skey = String(s.status || "").toLowerCase();
      if (skey === "sentback" || skey === "returned") {
        const explicit = explicitTargetKey(s);
        if (explicit != null && explicit !== "I" && !Number.isNaN(Number(explicit))) {
          s._sentBackTo = Number(explicit);
        } else {
          const curr = Number(s._displaySeq);
          s._sentBackTo = Number.isNaN(curr) ? 1 : Math.max(1, curr - 1);
        }
      }
    });

    // Implicit Sent Back inference (when API didn't log it)
    // Rule: if an earlier step i gets a new assignment AFTER any later step j acted,
    // then j likely sent back to i. Mark i as _reopened and add synthetic arrow on j.
    // We pick the nearest later step j with actedAt just before i.assignedAt.
    const approverSteps = normalized.filter((x) => !x._isInitiator);
    approverSteps.forEach((iStep) => {
      if (!iStep._assignedAtTs) return;
      const later = approverSteps.filter(
        (j) => Number(j._displaySeq) > Number(iStep._displaySeq) && j._actedAtTs
      );
      if (!later.length) return;
      const candidates = later
        .filter((j) => j._actedAtTs <= iStep._assignedAtTs)
        .sort((a, b) => b._actedAtTs - a._actedAtTs);
      if (candidates.length) {
        const sender = candidates[0];
        const senderStatus = String(sender.status || "").toLowerCase();
        if (senderStatus !== "approved") {
          iStep._reopened = true;
          sender._sentBackTo = Number(iStep._displaySeq);
          if (senderStatus !== "sentback" && senderStatus !== "returned") {
            sender._syntheticSentBack = true;
          }
        }
      }
    });

    return {
      steps: normalized,
      requestStatus: trail?.requestStatus || trail?.status || "—",
    };
  }, [trail]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        sx={(t) => ({
          bgcolor: t.palette.primary.main,
          color: t.palette.common.white,
          py: 1.25,
          pr: 6,
        })}
      >
        Approval Path
        <IconButton
          aria-label="close"
          onClick={onClose}
          size="small"
          sx={(t) => ({ position: "absolute", right: 8, top: 8, color: t.palette.common.white })}
        >
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2.25 }}>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          Request Status: <strong>{requestStatus || "—"}</strong>{loading ? " • loading…" : ""}
        </Typography>

        <Box sx={{ position: "relative", pl: 2 }}>
          {/* vertical rail */}
          <Box
            aria-hidden
            sx={(t) => ({
              position: "absolute",
              left: 28, top: 12, bottom: 12,
              width: 2, bgcolor: COLORS.rail(t), borderRadius: 1,
            })}
          />

          <Stack spacing={2.25}>
            {steps.map((s, idx) => {
              const isInitiator = !!s._isInitiator;
              const seqLabel = isInitiator ? "I" : ord(Number(s._displaySeq) || idx + 1);
              const primary = isInitiator
                ? "Initiator"
                : s.isFinalReceiver || String(s.status).toLowerCase() === "finalreceiver"
                  ? "Final Receiver"
                  : (s.designationName || "Approver");
              const sub = "—";

              const statusKey = isInitiator ? "initiated" : String(s.status || "").toLowerCase();
              const meta = STATUS[statusKey] || STATUS.pending;

              const when =
                s.actedAt || s.actionedAt
                  ? `Acted: ${fmt(s.actedAt || s.actionedAt)}`
                  : s.assignedAt
                  ? `Assigned: ${fmt(s.assignedAt)}`
                  : isInitiator && (trail?.createdAt || trail?.requestedAt)
                  ? `Created: ${fmt(trail?.createdAt || trail?.requestedAt)}`
                  : "—";

              const isSentBack = statusKey === "sentback" || statusKey === "returned" || s._syntheticSentBack;
              const targetDisp = s._sentBackTo;
              const reopened = !!s._reopened;

              return (
                <Box key={`step-${idx}`} sx={{ display: "flex", gap: 2 }}>
                  {/* dot */}
                  <Box sx={{ width: 56, display: "flex", justifyContent: "center" }}>
                    <Avatar
                      sx={(t) => ({
                        width: 36, height: 36,
                        fontSize: isInitiator ? 16 : 13, fontWeight: 800,
                        bgcolor: isInitiator ? COLORS.initiatorBg : COLORS.approverDot(t),
                        color: isInitiator ? COLORS.initiatorFg : t.palette.common.white,
                        border: `1px solid ${alpha(t.palette.common.black, 0.08)}`,
                      })}
                    >
                      {seqLabel}
                    </Avatar>
                  </Box>

                  {/* card */}
                  <Box
                    sx={(t) => ({
                      flex: 1, p: 1.5, borderRadius: 2,
                      border: `1px solid ${COLORS.cardBorder(t)}`,
                      bgcolor: t.palette.background.paper,
                    })}
                  >
                    <Stack direction="row" alignItems="center" spacing={1} justifyContent="space-between">
                      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700} noWrap>{primary}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>{sub}</Typography>
                      </Stack>

                      <Stack direction="row" spacing={1} alignItems="center">
                        {reopened && (
                          <Chip size="small" variant="outlined" color={STATUS.reopened.color} icon={STATUS.reopened.icon} label={STATUS.reopened.label} />
                        )}
                        <Chip size="small" variant="outlined" color={meta.color} icon={meta.icon} label={meta.label} sx={{ fontWeight: 600 }} />
                        {isSentBack && targetDisp ? (
                          <Chip
                            size="small"
                            variant="outlined"
                            color="warning"
                            icon={<ReplyRounded fontSize="small" />}
                            label={`→ ${ord(Number(targetDisp))}`}
                          />
                        ) : null}
                      </Stack>
                    </Stack>

                    <Divider sx={{ my: 1 }} />

                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">{when}</Typography>
                      {s.remarks ? (
                        <Tooltip title={s.remarks}>
                          <Typography variant="body2" sx={{ wordBreak: "break-word" }}>{s.remarks}</Typography>
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="text.disabled">No remarks</Typography>
                      )}
                      {isSentBack && targetDisp ? (
                        <Typography variant="caption" color="text.secondary">
                          Sent back to <strong>{ord(Number(targetDisp))}</strong> for rework.
                        </Typography>
                      ) : null}
                    </Stack>
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 1.25 }}>
        <Button onClick={onClose} variant="contained">Close</Button>
      </DialogActions>
    </Dialog>
  );
}
