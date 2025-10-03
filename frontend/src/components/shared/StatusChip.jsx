import React from "react";
import { Chip } from "@mui/material";

const map = {
  Pending:   { color: "default", label: "Pending" },
  Approved:  { color: "success", label: "Approved" },
  Rejected:  { color: "error",   label: "Rejected" },
  "Sent Back": { color: "warning", label: "Sent Back" },
};

export default function StatusChip({ value }) {
  const cfg = map[value] || { color: "default", label: value ?? "—" };
  return <Chip size="small" variant="filled" color={cfg.color} label={cfg.label} />;
}
