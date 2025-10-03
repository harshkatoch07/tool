import React from "react";

export const workflowStepsColumns = [
  { field: "stepId", headerName: "Step ID", minWidth: 100 },
  { field: "workflowId", headerName: "Workflow ID", minWidth: 110 },
  { field: "workflowName", headerName: "Workflow", minWidth: 220 },
  { field: "stepName", headerName: "Step", minWidth: 220 },
  { field: "sequence", headerName: "Seq", minWidth: 80, align: "right" },
  { field: "designationName", headerName: "Designation", minWidth: 180 },
  {
    field: "slaHours",
    headerName: "SLA (hrs)",
    minWidth: 110,
    align: "right",
    render: (r) => (r.slaHours != null ? r.slaHours : "—"),
    valueGetter: (r) => r.slaHours,
  },
  {
    field: "autoApprove",
    headerName: "Auto-Approve",
    minWidth: 140,
    render: (r) => (r.autoApprove ? "Yes" : "No"),
    valueGetter: (r) => r.autoApprove,
  },
  {
    field: "isFinalReceiver",
    headerName: "Final Receiver",
    minWidth: 140,
    render: (r) => (r.isFinalReceiver ? "Yes" : "No"),
    valueGetter: (r) => r.isFinalReceiver,
  },
];
