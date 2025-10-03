import React from "react";
import { Tooltip, IconButton } from "@mui/material";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import dayjs from "dayjs";

const fmtDate = (v) => (v ? dayjs(v).format("DD-MMM-YYYY HH:mm") : "—");

export function buildDelegationsColumns({ onOpen }) {
  return [
    { field: "id", headerName: "ID", minWidth: 80, valueGetter: r => r.id },
    { field: "from", headerName: "From", minWidth: 160, valueGetter: r => r.fromUserName || r.from },
    { field: "to", headerName: "To", minWidth: 160, valueGetter: r => r.toUserName || r.to },
    { field: "starts", headerName: "Starts", minWidth: 180, render: r => fmtDate(r.startsAtUtc || r.starts) },
    { field: "ends", headerName: "Ends", minWidth: 180, render: r => fmtDate(r.endsAtUtc || r.ends) },
    { field: "status", headerName: "Status", minWidth: 120, render: r => (r.isRevoked ? "Revoked" : "Active") },
    {
      field: "__actions",
      headerName: "Actions",
      minWidth: 100,
      align: "center",
      headerAlign: "center",
      sortable: false,
      render: (row) => (
        <Tooltip title="Open">
          <span>
            <IconButton size="small" onClick={() => onOpen && onOpen(row)}>
              <OpenInNewRounded fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      ),
    },
  ];
}
