import React, { useMemo, useState } from "react";
import { Box, Paper, Stack, TextField, Button, Typography } from "@mui/material";
import SmartDataTable from "../../../ui/SmartDataTable";
import { getUserActivityReport } from "../../../api/reportsApi";

const toIsoUtcMidnight = (d) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0,0,0)).toISOString();

export default function UserActivityReport() {
  const today = new Date();
  const weekAgo = new Date(Date.now() - 7*24*3600*1000);
  const [username, setUsername] = useState("");
  const [from, setFrom] = useState(weekAgo.toISOString().slice(0,10));
  const [to, setTo] = useState(today.toISOString().slice(0,10));
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const columns = useMemo(() => ([
    { key: "RequestId", header: "Request ID", width: 110 },
    { key: "WorkflowName", header: "Workflow" },
    { key: "ProjectName", header: "Project" },
    { key: "StepName", header: "Step" },
    { key: "AssignedAtUtc", header: "Assigned (UTC)", render:v=>new Date(v).toLocaleString() },
    { key: "FirstOpenedAtUtc", header: "First Open", render:v=>v?new Date(v).toLocaleString():"-" },
    { key: "FirstAttachmentAtUtc", header: "First Attachment", render:v=>v?new Date(v).toLocaleString():"-" },
    { key: "Decision", header: "Decision" },
    { key: "DecisionAtUtc", header: "Decision At", render:v=>v?new Date(v).toLocaleString():"-" },
    { key: "Minutes_AssignToDecision", header: "Min Assign→Decision" },
    { key: "Minutes_OpenToDecision", header: "Min Open→Decision" },
  ]),[]);

  async function run() {
    setErr(""); setLoading(true);
    try {
      const data = await getUserActivityReport({
        username: username.trim(),
        fromUtc: toIsoUtcMidnight(new Date(from)),
        toUtc: toIsoUtcMidnight(new Date(to))
      });
      setRows(data.Rows || data.rows || []);
      setSummary({
        total: data.TotalItems ?? 0,
        avg: data.AvgMinutes_AssignToDecision ?? 0,
        opened: data.OpenedCount ?? 0,
        attached: data.AttachmentViewedCount ?? 0,
        user: data.Username ?? username
      });
    } catch (e) {
      setErr(e?.response?.data ?? e.message);
    } finally { setLoading(false); }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>User Activity Report</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField label="Username or Email" value={username} onChange={e=>setUsername(e.target.value)} size="small" fullWidth />
          <TextField label="From (YYYY-MM-DD)" value={from} onChange={e=>setFrom(e.target.value)} size="small" />
          <TextField label="To (YYYY-MM-DD)" value={to} onChange={e=>setTo(e.target.value)} size="small" />
          <Button variant="contained" onClick={run} disabled={loading || !username}>Run</Button>
        </Stack>
        {err ? <Typography color="error" sx={{ mt: 1 }}>{String(err)}</Typography> : null}
        {summary ? (
          <Stack direction="row" spacing={3} sx={{ mt: 2 }}>
            <Typography>Total: {summary.total}</Typography>
            <Typography>Avg mins: {summary.avg}</Typography>
            <Typography>Opened: {summary.opened}</Typography>
            <Typography>Attachment views: {summary.attached}</Typography>
          </Stack>
        ) : null}
      </Paper>

      <Paper sx={{ p: 1 }}>
        <SmartDataTable rows={rows} columns={columns} rowKey="RequestId" loading={loading} dense stickyHeader virtualize />
      </Paper>
    </Box>
  );
}
