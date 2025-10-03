// src/components/dashboard/dashboardColumns.js
import React from "react";
import { Chip, IconButton, Tooltip, Link as MUILink } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import ApprovalTrailIcon from "../../icons/ApprovalTrailIcon";

/**
 * Columns:
 * - Initiated  → link to /initiate?resubmit={FundRequestId}&source=dashboard
 * - Assigned   → link to /approval/{ApprovalId}?source=dashboard
 * Safe: guards missing ids, stops row propagation, no full-page reload.
 */
export function buildDashboardColumns({
  mode,          // "initiated" | "assigned"  (required)
  fmtDate,
  showStatus,
  statusChip,
  onOpenTrail,
}) {
  const statusColor = (s) => {
    const c = statusChip(s);
    return <Chip size="small" label={c.label} sx={{ bgcolor: c.bg, color: c.fg, fontWeight: 600 }} />;
  };

  const renderDate = (v) =>
    !v ? "—" : typeof fmtDate === "function" ? fmtDate(v) : new Date(v).toLocaleString();

  const renderApprovalLink = (r) => {
    const frId = r.fundRequestId ?? r.id ?? null;
    const apId = r.approvalId ?? r.id ?? r.fundRequestId ?? null;

    const to =
      mode === "initiated"
        ? frId ? `/initiate?resubmit=${encodeURIComponent(frId)}&source=dashboard` : null
        : apId ? `/approval/${encodeURIComponent(apId)}?source=dashboard` : null;

    const label = r.requestTitle ?? r.title ?? "—";

    if (!to) return <span style={{ fontWeight: 700 }}>{label}</span>;

    return (
      <MUILink
        component={RouterLink}
        to={to}
        underline="hover"
        onClick={(e) => e.stopPropagation()}
        sx={{ cursor: "pointer", fontWeight: 700 }}
      >
        {label}
      </MUILink>
    );
  };

  return [
    {
      field: "id",
      headerName: "ID",
      minWidth: 90,
      valueGetter: (r) => r.id,
      render: (r) => `#${r.id}`,
    },
    {
      field: "workflowName",
      headerName: "Workflows",
      minWidth: 240,
      valueGetter: (r) => r.workflowName,
      render: (r) => r.workflowName || "—",
    },
    {
      field: "requestTitle",
      headerName: "Approvals",
      minWidth: 300,
      valueGetter: (r) => r.requestTitle ?? r.title,
      render: (r) => renderApprovalLink(r),
    },
    {
      field: "createdAt",
      headerName: "Initiated Date",
      minWidth: 160,
      valueGetter: (r) => r.createdAt,
      render: (r) => renderDate(r.createdAt),
    },
    {
      field: "lastActionDate",
      headerName: "Last Action Date",
      minWidth: 160,
      valueGetter: (r) => r.lastActionDate ?? r.lastActionAt,
      render: (r) => renderDate(r.lastActionDate ?? r.lastActionAt),
    },
    {
      field: "neededBy",
      headerName: "Approval Needed by Date",
      minWidth: 210,
      valueGetter: (r) => r.neededBy,
      render: (r) => renderDate(r.neededBy),
    },
    {
      field: "status",
      headerName: "Approval Status",
      minWidth: 160,
      valueGetter: (r) => showStatus(r.status),
      render: (r) => statusColor(r.status),
    },
    {
      field: "__trail",
      headerName: "Approval Trail",
      minWidth: 140,
      align: "center",
      headerAlign: "center",
      sortable: false,
      render: (r) => (
        <Tooltip title="View approval trail">
          <IconButton
            size="small"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenTrail?.(r);
            }}
            aria-label="Approval Trail"
          >
            <ApprovalTrailIcon size={50} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];
}

export default buildDashboardColumns;
