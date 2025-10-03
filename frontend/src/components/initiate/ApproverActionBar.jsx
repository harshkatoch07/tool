import React, { useState } from "react";
import { Stack, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";

const token = () => (typeof window !== "undefined" ? window.localStorage.getItem("token") : null);

async function postApprovalAction(approvalId, action, comments) {
  const res = await fetch(`/api/approvals/${approvalId}/action`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    },
    body: JSON.stringify({ action, comments: comments || "" }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Action failed (${res.status}): ${text || res.statusText}`);
  }
  return res.json().catch(() => ({}));
}

export default function ApproverActionBar({ id: requestId, approvalId, onDone }) {
  const [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState(null); // {action, label, comments}

  const doAction = async (action, comments = "") => {
    if (!approvalId) {
      alert("Missing approvalId in URL. Open this request from the Assigned tab.");
      return;
    }
    const currentAction = action;
    try {
      setBusy(true);
      const result = await postApprovalAction(approvalId, currentAction, comments);
      if (typeof onDone === "function") {
        await onDone({ action: currentAction, result, comments });
      }
    } catch (e) {
      alert(e.message || "Failed to perform action");
    } finally {
      setBusy(false);
      setDlg(null);
    }
  };

  const openWithComments = (action, label) => setDlg({ action, label, comments: "" });

  return (
    <>
      <Stack direction="row" spacing={2} justifyContent="flex-start">
        <Button variant="contained" color="success" disabled={busy} onClick={() => doAction("Approve")}>
          Approve
        </Button>
        <Button variant="outlined" color="error" disabled={busy} onClick={() => openWithComments("Reject", "Reject reason")}>
          Reject
        </Button>
        <Button variant="outlined" disabled={busy} onClick={() => openWithComments("SendBack", "Send-back comments")}>
          Send Back
        </Button>
      </Stack>

      <Dialog open={!!dlg} onClose={() => setDlg(null)} fullWidth maxWidth="sm">
        <DialogTitle>{dlg?.label}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            value={dlg?.comments || ""}
            onChange={(e) => setDlg((p) => ({ ...p, comments: e.target.value }))}
            placeholder="Add comments (optional)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlg(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => doAction(dlg.action, dlg.comments)} disabled={busy}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
