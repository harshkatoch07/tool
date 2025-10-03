// src/components/admin/AdminDashboard.jsx

import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Divider,
  Button,
  Fade,
  Stack,
  Avatar,
  Skeleton,
  Alert,
  AlertTitle,
  Chip,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  useTheme,
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LogoutIcon from "@mui/icons-material/Logout";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import { useNavigate } from "react-router-dom";
import RecentActivities from "./RecentActivities";

const fallbackStats = {
  totalUsers: 0,
  pendingApprovals: 0,
  approvedRequests: 0,
  rejectedRequests: 0,
};

export default function AdminDashboard() {
  const theme = useTheme();
  const [stats, setStats] = useState(fallbackStats);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  const todayStr = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    []
  );

  const totalRequests = useMemo(
    () =>
      (stats.pendingApprovals || 0) +
      (stats.approvedRequests || 0) +
      (stats.rejectedRequests || 0),
    [stats]
  );

  const approvalRate = useMemo(() => {
    if (!totalRequests) return 0;
    return Math.round(((stats.approvedRequests || 0) / totalRequests) * 100);
  }, [stats, totalRequests]);

  async function fetchStats(signal) {
    setLoading(true);
    setErrorMsg("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!res.ok) throw new Error(`API returned status ${res.status}`);
      const data = await res.json();
      setStats({ ...fallbackStats, ...data });
    } catch (err) {
      if (err.name !== "AbortError") {
        setErrorMsg("We couldn’t load the latest stats. Showing defaults.");
        setStats(fallbackStats);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetchStats(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handleRefresh = () => {
    const controller = new AbortController();
    fetchStats(controller.signal);
  };

  const summaryCards = [
    {
      key: "users",
      label: "Total Users",
      value: stats.totalUsers,
      tint: theme.palette.mode === "dark" ? "#9b87f5" : "#6D28D9",
      bg:
        theme.palette.mode === "dark"
          ? "rgba(155,135,245,.16)"
          : "rgba(109,40,217,.12)",
      icon: <PeopleIcon sx={{ fontSize: 28 }} />,
    },
    {
      key: "pending",
      label: "Pending Approvals",
      value: stats.pendingApprovals,
      tint: theme.palette.mode === "dark" ? "#f5a524" : "#D97706",
      bg:
        theme.palette.mode === "dark"
          ? "rgba(245,165,36,.16)"
          : "rgba(217,119,6,.12)",
      icon: <HourglassEmptyIcon sx={{ fontSize: 28 }} />,
    },
    {
      key: "approved",
      label: "Approved",
      value: stats.approvedRequests,
      tint: theme.palette.mode === "dark" ? "#10b981" : "#059669",
      bg:
        theme.palette.mode === "dark"
          ? "rgba(16,185,129,.16)"
          : "rgba(5,150,105,.12)",
      icon: <CheckCircleIcon sx={{ fontSize: 28 }} />,
    },
    {
      key: "rejected",
      label: "Rejected",
      value: stats.rejectedRequests,
      tint: theme.palette.mode === "dark" ? "#fb7185" : "#E11D48",
      bg:
        theme.palette.mode === "dark"
          ? "rgba(251,113,133,.16)"
          : "rgba(225,29,72,.12)",
      icon: <CancelIcon sx={{ fontSize: 28 }} />,
    },
  ];

  return (
    <Box
      sx={{
        minHeight:  "calc(100vh - 64px)",
        width: "100%",
         overflowX: "hidden",
        background:
          theme.palette.mode === "dark"
            ? `radial-gradient(1200px 600px at 10% -10%, rgba(120,119,198,.25), transparent 40%),
               radial-gradient(1000px 500px at 100% 0%, rgba(34,197,94,.15), transparent 45%),
               linear-gradient(135deg, #0b1220 0%, #0f172a 100%)`
            : `radial-gradient(1200px 600px at 10% -10%, rgba(79,70,229,.18), transparent 40%),
               radial-gradient(1000px 500px at 100% 0%, rgba(59,130,246,.12), transparent 45%),
               linear-gradient(135deg, #F8FAFF 0%, #EEF2FF 60%, #FDF2F8 100%)`,
        py: 4,
        fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      <Container maxWidth="false" disableGutters sx={{ px: { xs: 2, md: 4 } }}>
        {/* Header */}
        <Box
          sx={{
            mb: 4,
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
            <Avatar
              variant="rounded"
              sx={{
                height: 64,
                width: 64,
                fontWeight: 800,
                fontSize: 28,
                boxShadow:
                  theme.palette.mode === "dark"
                    ? "0 10px 30px rgba(0,0,0,.45)"
                    : "0 10px 30px rgba(79, 70, 229, .35)",
                background:
                  theme.palette.mode === "dark"
                    ? "linear-gradient(135deg, #6366F1 0%, #22C55E 100%)"
                    : "linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%)",
              }}
              alt="Admin"
            >
              A
            </Avatar>
            <Box>
              <Typography
                variant="h4"
                sx={{ fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.2 }}
              >
                Admin Dashboard
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.75, mt: 0.5 }}>
                {todayStr} • Made by Harsh Katoch
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1.25} sx={{ width: { xs: "100%", sm: "auto" } }}>
            <Tooltip title="Refresh stats">
              <Button onClick={handleRefresh} startIcon={<RefreshIcon />} variant="outlined" sx={btnGhost(theme)}>
                Refresh
              </Button>
            </Tooltip>
            
          </Stack>
        </Box>

        {errorMsg && (
          <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
            <AlertTitle>Heads up</AlertTitle>
            {errorMsg}
          </Alert>
        )}

        {/* Stats Grid */}
        <Grid container spacing={3} sx={{ mb: 4 }} aria-label="Summary statistics">
          {summaryCards.map((card, idx) => (
            <Grid key={card.key} item xs={12} sm={6} lg={3} sx={{ display: "flex" }}>
              <Fade in timeout={350 + idx * 100}>
                <Paper elevation={0} sx={glassCard(theme)}>
                  <Stack direction="row" spacing={2.5} alignItems="center" sx={{ width: "100%" }}>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: "999px",
                        bgcolor: card.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: card.tint,
                      }}
                    >
                      {card.icon}
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontSize: 12,
                          fontWeight: 700,
                          opacity: 0.7,
                          letterSpacing: ".08em",
                          textTransform: "uppercase",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {card.label}
                      </Typography>

                      {loading ? (
                        <Skeleton variant="text" width={80} height={36} />
                      ) : (
                        <Typography sx={{ fontSize: 30, fontWeight: 900, lineHeight: 1.15, mt: 0.5 }}>
                          {Number(card.value || 0).toLocaleString()}
                        </Typography>
                      )}
                    </Box>

                    <ArrowOutwardIcon sx={{ opacity: 0.25, fontSize: 20 }} />
                  </Stack>
                </Paper>
              </Fade>
            </Grid>
          ))}
        </Grid>

        {/* Content Area */}
        <Box sx={{ display: "flex", flexDirection: { xs: "column", lg: "row" }, gap: 3 }}>
          {/* Left Column */}
          <Box sx={{ flex: 2, minWidth: 0, display: "flex" }}>
            <Paper elevation={0} sx={glassPanel(theme)}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Recent Activities
                </Typography>
                <Chip size="small" label="Live" color="success" sx={{ fontWeight: 700, borderRadius: 1.5 }} />
              </Stack>
              <Divider sx={{ mb: 2, opacity: 0.2 }} />
              <RecentActivities />
            </Paper>
          </Box>

          {/* Right Column */}
          <Box sx={{ flex: 1, minWidth: 0, display: "flex" }}>
            <Paper elevation={0} sx={glassPanel(theme)}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
                At a Glance
              </Typography>
              <Divider sx={{ mb: 2, opacity: 0.2 }} />

              <Box sx={{ mb: 3 }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                  <Typography variant="body2" sx={{ opacity: 0.75 }}>
                    Approval Rate
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {loading ? "—" : `${approvalRate}%`}
                  </Typography>
                </Stack>
                {loading ? (
                  <Skeleton variant="rectangular" height={10} sx={{ borderRadius: 999 }} />
                ) : (
                  <LinearProgress variant="determinate" value={approvalRate} sx={{ height: 10, borderRadius: 999 }} />
                )}
                <Stack direction="row" spacing={1.5} sx={{ mt: 1.25, flexWrap: "wrap", gap: 1 }}>
                  <Chip size="small" icon={<CheckCircleIcon />} label={`Approved: ${stats.approvedRequests || 0}`} />
                  <Chip size="small" icon={<HourglassEmptyIcon />} label={`Pending: ${stats.pendingApprovals || 0}`} />
                  <Chip size="small" icon={<CancelIcon />} label={`Rejected: ${stats.rejectedRequests || 0}`} />
                </Stack>
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5, mt: "auto" }}>
                Quick Actions
              </Typography>
              <Divider sx={{ mb: 1.5, opacity: 0.2 }} />

              <List component="nav" aria-label="Quick actions" sx={{ p: 0, m: 0, "& .MuiListItemButton-root": quickRow(theme) }}>
                <ListItemButton onClick={() => navigate("/admin/users")}>
                  <ListItemIcon>
                    <PeopleIcon />
                  </ListItemIcon>
                  <ListItemText primary="Manage Users" secondary="Create, edit, and assign roles" />
                  <ChevronRightIcon />
                </ListItemButton>
                <ListItemButton onClick={() => navigate("/admin/workflows")}>
                  <ListItemIcon>
                    <HourglassEmptyIcon />
                  </ListItemIcon>
                  <ListItemText primary="Configure Workflows" secondary="Steps, SLAs, and approvers" />
                  <ChevronRightIcon />
                </ListItemButton>
                <ListItemButton onClick={() => navigate("/admin/reports")}>
                  <ListItemIcon>
                    <CheckCircleIcon />
                  </ListItemIcon>
                  <ListItemText primary="Reports" secondary="Download & analyze activity" />
                  <ChevronRightIcon />
                </ListItemButton>
              </List>
            </Paper>
          </Box>
        </Box>

        <Divider sx={{ my: 4, opacity: 0.2 }} />
      </Container>
    </Box>
  );
}

/* -------------------------- Styles (theme-aware) -------------------------- */

const glassCard = (theme) => ({
  flex: 1,
  p: 3,
  borderRadius: 3,
  minHeight: 130,
  backgroundColor: theme.palette.mode === "dark" ? "rgba(17, 24, 39, 0.55)" : "rgba(255,255,255,0.9)",
  backdropFilter: "blur(8px)",
  border:
    theme.palette.mode === "dark"
      ? "1px solid rgba(148, 163, 184, 0.18)"
      : "1px solid rgba(229, 231, 235, 0.8)",
  boxShadow:
    theme.palette.mode === "dark"
      ? "0 12px 30px rgba(0,0,0,.35)"
      : "0 16px 40px rgba(31, 41, 55, .12)",
  transition: "transform .25s ease, box-shadow .25s ease, background-color .25s ease",
  "&:hover": {
    transform: "translateY(-4px)",
    boxShadow:
      theme.palette.mode === "dark"
        ? "0 18px 50px rgba(0,0,0,.45)"
        : "0 18px 50px rgba(31,41,55,.18)",
    backgroundColor:
      theme.palette.mode === "dark" ? "rgba(30, 41, 59, 0.55)" : "rgba(255,255,255,1)",
  },
});

const glassPanel = (theme) => ({
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  p: 3,
  borderRadius: 3,
  backgroundColor: theme.palette.mode === "dark" ? "rgba(17, 24, 39, 0.55)" : "rgba(255,255,255,0.9)",
  backdropFilter: "blur(8px)",
  border:
    theme.palette.mode === "dark"
      ? "1px solid rgba(148, 163, 184, 0.2)"
      : "1px solid rgba(229, 231, 235, 0.8)",
  boxShadow:
    theme.palette.mode === "dark"
      ? "0 10px 30px rgba(0,0,0,.35)"
      : "0 10px 30px rgba(17, 24, 39, .06)",
});

const btnGhost = (theme) => ({
  textTransform: "none",
  fontWeight: 700,
  borderRadius: 2,
  px: 2.2,
  color: theme.palette.text.primary,
  borderColor: theme.palette.mode === "dark" ? "rgba(148,163,184,.35)" : "rgba(209, 213, 219, .9)",
  backgroundColor: theme.palette.mode === "dark" ? "rgba(2,6,23,.35)" : "rgba(255,255,255,.8)",
  backdropFilter: "blur(6px)",
  "&:hover": {
    backgroundColor: theme.palette.mode === "dark" ? "rgba(15,23,42,.55)" : "rgba(238,242,255,.9)",
    borderColor: theme.palette.mode === "dark" ? "rgba(148,163,184,.6)" : "rgba(199,210,254,1)",
  },
});

const quickRow = (theme) => ({
  borderRadius: 12,
  mb: 1,
  px: 1.25,
  "& .MuiListItemIcon-root": { minWidth: 40, color: theme.palette.text.secondary },
  "& .MuiListItemText-primary": { fontWeight: 700 },
  "& .MuiListItemText-secondary": { opacity: 0.7 },
  border:
    theme.palette.mode === "dark"
      ? "1px solid rgba(148,163,184,.2)"
      : "1px solid rgba(229,231,235,1)",
  backgroundColor: theme.palette.mode === "dark" ? "rgba(2,6,23,.35)" : "rgba(249, 250, 251, 0.8)",
  transition: "all .2s ease",
  "&:hover, &:focus-visible": {
    backgroundColor: theme.palette.mode === "dark" ? "rgba(30,41,59,.55)" : "rgba(238,242,255,.85)",
    borderColor: theme.palette.mode === "dark" ? "rgba(148,163,184,.35)" : "rgba(199,210,254,1)",
    outline: "none",
  },
});
