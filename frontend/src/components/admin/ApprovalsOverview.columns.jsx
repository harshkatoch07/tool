import React from "react";
import StatusChip from "../shared/StatusChip";
import { normalizeDbStatus } from "../../utils/status";

export const approvalsOverviewColumns = [
  { field: "approvalId", headerName: "Approval ID", minWidth: 110 },
  { field: "fundRequestId", headerName: "Request ID", minWidth: 110 },
  { field: "requestTitle", headerName: "Title", minWidth: 220 },
  { field: "departmentName", headerName: "Department", minWidth: 160 },
  { field: "approverName", headerName: "Approver", minWidth: 180 },
  {
    field: "assignedAt",
    headerName: "Assigned",
    minWidth: 150,
    render: (r) => (r.assignedAt ? new Date(r.assignedAt).toLocaleDateString() : "—"),
    valueGetter: (r) => r.assignedAt,
  },
  {
    field: "status",
    headerName: "Status",
    minWidth: 140,
    render: (r) => <StatusChip value={r.status} />,
    valueGetter: (r) => normalizeDbStatus(r.status),
  },
];
