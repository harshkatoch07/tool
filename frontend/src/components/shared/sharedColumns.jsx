// src/pages/shared/SharedColumns.jsx
import React from "react";
import { Button, Chip, IconButton, Tooltip, Stack } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";

// works with raw row or { row } / { original } shapes
const root = (p) => (p && (p.row || p.original || p.data)) || p || {};
const first = (p, keys) => {
  const r = root(p);
  for (const k of keys) {
    const v = r?.[k];
    if (v !== null && v !== undefined && v !== "") return v;
  }
  return null;
};

export function buildSharedColumns({ onOpenDetails, onOpenTrail, money, fmt, showStatus }) {
  const statusColor = (raw) => {
    const t = showStatus ? showStatus(raw) : String(raw ?? "");
    if (/approved/i.test(t)) return "success";
    if (/rejected/i.test(t)) return "error";
    if (/sent\s?back/i.test(t)) return "warning";
    if (/final/i.test(t)) return "info";
    return "default";
  };

  return [
    {
      field: "id",
      headerName: "ID",
      minWidth: 80,
      valueGetter: (p) => first(p, ["id", "fundRequestId", "FundRequestId"]),
      render: (p) => `#${first(p, ["id", "fundRequestId", "FundRequestId"]) ?? "—"}`,
    },
    {
      field: "title",
      headerName: "Approvals",
      minWidth: 260,
      valueGetter: (p) => first(p, ["title", "approvals", "Title"]),
      render: (p) => {
        const id = first(p, ["id", "fundRequestId", "FundRequestId"]);
        const title = first(p, ["title", "approvals", "Title"]) || "—";
        return (
          <Button variant="text" onClick={() => onOpenDetails?.(id)} disabled={!id}>
            {title}
          </Button>
        );
      },
    },
    {
      field: "workflowName",
      headerName: "Particulars",
      minWidth: 220,
      valueGetter: (p) => first(p, ["workflowName", "particulars", "Particulars", "WorkflowName"]),
      render: (p) => first(p, ["workflowName", "particulars", "Particulars", "WorkflowName"]) || "—",
    },
    {
      field: "initiatorName",
      headerName: "Initiated By",
      minWidth: 160,
      valueGetter: (p) => first(p, ["initiatorName", "initiatedBy", "InitiatorName"]),
      render: (p) => first(p, ["initiatorName", "initiatedBy", "InitiatorName"]) || "—",
    },
    {
      field: "createdAt",
      headerName: "Initiated Date",
      minWidth: 170,
      valueGetter: (p) => first(p, ["createdAt", "initiatedDate", "CreatedAt"]),
      render: (p) => {
        const v = first(p, ["createdAt", "initiatedDate", "CreatedAt"]);
        return v ? fmt(v) : "—";
      },
    },
    {
      field: "lastActionAt",
      headerName: "Last Action Date",
      minWidth: 170,
      valueGetter: (p) => first(p, ["lastActionAt", "lastActionDate", "LastActionAt"]),
      render: (p) => {
        const v = first(p, ["lastActionAt", "lastActionDate", "LastActionAt"]);
        return v ? fmt(v) : "—";
      },
    },
    {
      field: "neededBy",
      headerName: "Approval Needed by Date",
      minWidth: 200,
      valueGetter: (p) => first(p, ["neededBy", "approvalNeededBy", "ApprovalNeededByDate", "NeededBy"]),
      render: (p) => {
        const v = first(p, ["neededBy", "approvalNeededBy", "ApprovalNeededByDate", "NeededBy"]);
        return v ? fmt(v) : "—";
      },
    },
    {
      field: "amount",
      headerName: "Amount / Cost",
      minWidth: 160,
      align: "right",
      headerAlign: "right",
      valueGetter: (p) => first(p, ["amount", "cost", "Amount"]),
      render: (p) => {
        const v = first(p, ["amount", "cost", "Amount"]);
        return typeof v === "number" ? (money ? money(v) : v) : v ?? "—";
      },
    },
    {
      field: "status",
      headerName: "Approval Status",
      minWidth: 160,
      valueGetter: (p) => first(p, ["status", "approvalStatus", "Status"]),
      render: (p) => {
        const s = first(p, ["status", "approvalStatus", "Status"]);
        return (
          <Chip
            size="small"
            color={statusColor(s)}
            label={showStatus ? showStatus(s) : s || "—"}
          />
        );
      },
    },
    {
      field: "__trail",
      headerName: "Approval Trail",
      minWidth: 140,
      align: "center",
      headerAlign: "center",
      sortable: false,
      render: (p) => {
        const id = first(p, ["id", "fundRequestId", "FundRequestId"]);
        return (
          <Tooltip title="View approval trail">
            <span>
              <IconButton size="small" onClick={() => onOpenTrail?.(id)} disabled={!id}>
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        );
      },
    },
    {
      field: "__actions",
      headerName: "Actions",
      minWidth: 120,
      align: "right",
      headerAlign: "right",
      sortable: false,
      render: (p) => {
        const id = first(p, ["id", "fundRequestId", "FundRequestId"]);
        return (
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" onClick={() => onOpenDetails?.(id)} disabled={!id}>
              Details
            </Button>
          </Stack>
        );
      },
    },
  ];
}

export default buildSharedColumns;
// src/api/approvalsApi.js