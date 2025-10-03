// src/components/approvals/ApprovalsPage.columns.jsx
import React from "react";
import { IconButton, Link as MuiLink, Stack, Tooltip } from "@mui/material";
import TimelineIcon from "@mui/icons-material/Timeline";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ReplayIcon from "@mui/icons-material/Replay";
import StatusChip from "../shared/StatusChip";
import { normalizeDbStatus } from "../../utils/status";

// pick first defined
const pick = (...vals) => vals.find((v) => v !== undefined && v !== null);

const fmt = {
  date(v) {
    if (!v) return "—";
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? "—"
      : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  },
};

/**
 * Pure factory. No hooks. No module state.
 * Field keys align to normalized row keys produced in ApprovalsPage:
 *  - ref, title, particulars, initiatedBy, created, lastActionAt, dueBy, status
 */
export function buildApprovalsColumns({
  onOpenInitiate, // open request or resubmit
  onOpenTrail,    // open Trail dialog
  onEdit,         // edit action
  onDelete,       // delete action
  onRetry,        // retry action
}) {
  return [
    // ID (uses normalized "ref")
    {
      field: "ref",
      headerName: "ID",
      minWidth: 90,
      valueGetter: (r) => pick(r.ref, r.approvalId, r.fundRequestId, r.id),
      render: (row) => pick(row.ref, row.approvalId, row.fundRequestId, row.id) ?? "—",
    },

    // Approvals / Title (normalized "title")
    {
      field: "title",
      headerName: "Approvals",
      minWidth: 260,
      valueGetter: (r) => pick(r.title, r.approvals, r.requestTitle, r.Name),
      render: (row) => (
        <MuiLink
          component="button"
          variant="body2"
          underline="hover"
          onClick={() => onOpenInitiate && onOpenInitiate(row)}
          sx={{ fontWeight: 600, textAlign: "left" }}
        >
          {pick(row.title, row.approvals, row.requestTitle, row.Name) ?? "—"}
        </MuiLink>
      ),
    },

    // Particulars / Workflow (normalized "particulars")
    {
      field: "particulars",
      headerName: "Particulars",
      minWidth: 320,
      valueGetter: (r) => pick(r.particulars, r.workflow, r.workflowName, r.categoryName),
      render: (row) => pick(row.particulars, row.workflow, row.workflowName, row.categoryName) ?? "—",
    },

    // Initiated By (normalized "initiatedBy")
    {
      field: "initiatedBy",
      headerName: "Initiated By",
      minWidth: 160,
      valueGetter: (r) => pick(r.initiatedBy, r.initiatorName, r.requesterName),
      render: (row) => pick(row.initiatedBy, row.initiatorName, row.requesterName) ?? "—",
    },

    // Initiated Date (normalized "created")
    {
      field: "created",
      headerName: "Initiated Date",
      minWidth: 140,
      valueGetter: (r) => pick(r.created, r.createdAt, r.initiatedDate, r.CreatedAt),
      render: (row) => fmt.date(pick(row.created, row.createdAt, row.initiatedDate, row.CreatedAt)),
    },

    // Last Action Date (normalized "lastActionAt")
    {
      field: "lastActionAt",
      headerName: "Last Action Date",
      minWidth: 150,
      valueGetter: (r) => pick(r.lastActionAt, r.lastActionDate, r.actionedAt, r.ActionedAt),
      render: (row) => fmt.date(pick(row.lastActionAt, row.lastActionDate, row.actionedAt, row.ActionedAt)),
    },

    // Approval Needed By (normalized "dueBy")
    {
      field: "dueBy",
      headerName: "Approval Needed by Date",
      minWidth: 190,
      valueGetter: (r) => pick(r.dueBy, r.approvalNeededByDate, r.neededBy, r.requiredByDate, r.deadline),
      render: (row) => fmt.date(pick(row.dueBy, row.approvalNeededByDate, row.neededBy, row.requiredByDate, row.deadline)),
    },

    // Approval Status (normalized "status")
    {
      field: "status",
      headerName: "Approval Status",
      minWidth: 140,
      valueGetter: (r) => pick(r.status, r.approvalStatus),
      render: (row) => <StatusChip value={normalizeDbStatus(pick(row.status, row.approvalStatus))} />,
    },

    // Approval Trail
    {
      field: "__trail",
      headerName: "Approval Trail",
      minWidth: 130,
      align: "center",
      headerAlign: "center",
      sortable: false,
      render: (row) => (
        <Tooltip title="View Trail">
          <span>
            <IconButton size="small" onClick={() => onOpenTrail && onOpenTrail(row)}>
              <TimelineIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      ),
    },

    // Actions
    {
      field: "__actions",
      headerName: "Actions",
      minWidth: 120,
      align: "center",
      headerAlign: "center",
      sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={0.5} justifyContent="center">
          <Tooltip title="Edit">
            <span>
              <IconButton size="small" onClick={() => onEdit && onEdit(row)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Delete">
            <span>
              <IconButton size="small" onClick={() => onDelete && onDelete(row)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      ),
    },

    // Retry
    {
      field: "__retry",
      headerName: "Retry",
      minWidth: 90,
      align: "center",
      headerAlign: "center",
      sortable: false,
      render: (row) => (
        <Tooltip title="Retry">
          <span>
            <IconButton size="small" onClick={() => onRetry && onRetry(row)}>
              <ReplayIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      ),
    },
  ];
}
