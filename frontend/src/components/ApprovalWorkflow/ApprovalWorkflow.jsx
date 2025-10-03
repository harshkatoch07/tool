import React, { useEffect, useState } from "react";
import api from "../../services/api";
import {
  Paper, Box, Typography, Button, Stack, Chip, Divider
} from "@mui/material";

const ApprovalWorkflow = () => {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    api.get("/fundrequests/mypending")
      .then(res => setRequests(res.data));
  }, []);

  const handleAction = (approvalId, action) => {
    let comments = "";
    if (action === "SendBack") {
      comments = prompt("Enter reason for send back:");
      if (!comments) return;
    }
    api.post(`/approvals/${approvalId}/action`, { action, comments })
      .then(() => {
        alert("Action submitted!");
        setRequests(rs => rs.filter(r => r.approvalId !== approvalId));
      });
  };

  return (
    <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
      <Typography variant="h5" color="primary" gutterBottom fontWeight={600}>
        My Approvals
      </Typography>
      {requests.length === 0 && (
        <Typography color="text.secondary">No pending requests.</Typography>
      )}
      <Stack spacing={2}>
        {requests.map(r => (
          <Box key={r.approvalId} sx={{ border: "1px solid #e0e0e0", borderRadius: 2, p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Typography variant="subtitle1" sx={{ flex: 1 }}>
                <b>{r.title}</b>
              </Typography>
              <Chip label={r.status} color="primary" />
            </Stack>
            <Divider sx={{ my: 1 }} />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" color="success" onClick={() => handleAction(r.approvalId, "Approve")}>
                Approve
              </Button>
              <Button variant="outlined" color="warning" onClick={() => handleAction(r.approvalId, "SendBack")}>
                Send Back
              </Button>
              <Button variant="contained" color="error" onClick={() => handleAction(r.approvalId, "Reject")}>
                Reject
              </Button>
            </Stack>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
};

export default ApprovalWorkflow;
  