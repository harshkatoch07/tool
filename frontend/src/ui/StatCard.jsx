import React from "react";
import { Paper, Stack, Typography, Avatar } from "@mui/material";
import AssignmentIndRounded from "@mui/icons-material/AssignmentIndRounded";
import OutboxRounded from "@mui/icons-material/OutboxRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import ReplayRounded from "@mui/icons-material/ReplayRounded";
import CancelRounded from "@mui/icons-material/CancelRounded";
import { alpha } from "@mui/material/styles";

const iconMap = {
  assignment: AssignmentIndRounded,
  inbox: OutboxRounded,
  check: CheckCircleRounded,
  repeat: ReplayRounded,
  close: CancelRounded,
};

export default function StatCard({ icon = "assignment", label, value }) {
  const Icon = iconMap[icon] || AssignmentIndRounded;
  return (
    <Paper
      elevation={0}
      sx={{
        flex: "0 0 280px",
        p: 2.5,
        display: "flex",
        alignItems: "center",
        gap: 2,
        bgcolor: "background.paper",
      }}
    >
      <Avatar
        sx={(t) => ({
          width: 48,
          height: 48,
          bgcolor: alpha(t.palette.primary.main, 0.12),
          color: t.palette.primary.main,
          boxShadow: `0 0 0 8px ${alpha(t.palette.primary.main, 0.06)}`,
        })}
      >
        <Icon />
      </Avatar>
      <Stack>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>{value}</Typography>
      </Stack>
    </Paper>
  );
}
