// src/components/admin/layout/AdminLayout.jsx
import React, { useState, useMemo } from "react";
import {
  AppBar,
  Avatar,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import BarChartIcon from "@mui/icons-material/BarChart";
import LogoutIcon from "@mui/icons-material/Logout";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";

const EXPANDED_WIDTH = 256;
const COLLAPSED_WIDTH = 72;

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const theme = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { logout } = useAuth?.() || {};

  const sidebarWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  const handleDrawerToggle = () => setMobileOpen((v) => !v);
  const handleCollapseToggle = () => setCollapsed((v) => !v);

  const navItems = useMemo(
    () => [
      { label: "Dashboard", icon: <DashboardIcon />, path: "/admin" },
      { label: "Users", icon: <PeopleIcon />, path: "/admin/users" },
      { label: "User Activity", icon: <BarChartIcon />, path: "/admin/reports/user-activity" },
    ],
    []
  );

  const handleLogout = () => {
    try { logout && logout(); } catch {}
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("user");
      sessionStorage.clear();
    } catch {}
    navigate("/login", { replace: true });
  };

  const DrawerHeader = (
    <Toolbar sx={{ px: 1.25, gap: 1, minHeight: 64 }}>
      <Avatar sx={{ width: 32, height: 32 }}>AD</Avatar>
      {!collapsed && (
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" noWrap fontWeight={700}>
            Admin Panel
          </Typography>
          <Chip label="Enterprise" size="small" sx={{ height: 20, fontSize: 11, mt: 0.5 }} />
        </Box>
      )}
      <Tooltip title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
        <IconButton size="small" onClick={handleCollapseToggle}>
          {collapsed ? <KeyboardDoubleArrowRightIcon /> : <KeyboardDoubleArrowLeftIcon />}
        </IconButton>
      </Tooltip>
    </Toolbar>
  );

  const drawerContent = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
        borderRight: 1,
        borderColor: "divider",
      }}
    >
      {DrawerHeader}
      <Divider />

      <List sx={{ px: collapsed ? 0.5 : 1.5, py: 1, flex: 1 }}>
        {navItems.map((item) => {
          const selected =
            item.path === "/admin" ? pathname === "/admin" : pathname.startsWith(item.path);

          const button = (
            <ListItemButton
              key={item.path}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              selected={selected}
              sx={{
                mb: 0.5,
                borderRadius: 2,
                minHeight: 44,
                justifyContent: collapsed ? "center" : "flex-start",
                px: collapsed ? 1 : 2,
                "&:hover": { bgcolor: "action.hover" },
                ...(selected
                  ? {
                      bgcolor: "action.selected",
                      "& .MuiListItemIcon-root": { color: theme.palette.primary.main },
                      position: "relative",
                      "&::before": {
                        content: '""',
                        position: "absolute",
                        left: 0,
                        top: 8,
                        bottom: 8,
                        width: 3,
                        borderRadius: 3,
                        bgcolor: "primary.main",
                      },
                    }
                  : {}),
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: collapsed ? 0 : 1.5,
                  justifyContent: "center",
                }}
              >
                {item.icon}
              </ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontWeight: selected ? 700 : 500 }}
                />
              )}
            </ListItemButton>
          );

          return collapsed ? (
            <Tooltip key={item.path} title={item.label} placement="right">
              <Box>{button}</Box>
            </Tooltip>
          ) : (
            button
          );
        })}
      </List>

      <Divider />

      <Box sx={{ p: collapsed ? 0.5 : 1.5 }}>
        <Tooltip title={collapsed ? "Logout" : ""} placement="right">
          <ListItemButton
            onClick={handleLogout}
            sx={{
              borderRadius: 2,
              minHeight: 44,
              justifyContent: collapsed ? "center" : "flex-start",
              px: collapsed ? 1 : 2,
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: collapsed ? 0 : 1.5,
                justifyContent: "center",
              }}
            >
              <LogoutIcon />
            </ListItemIcon>
            {!collapsed && <ListItemText primary="Logout" />}
          </ListItemButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#f6f7fb" }}>
      {/* Top App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: "background.paper",
          color: "text.primary",
          borderBottom: 1,
          borderColor: "divider",
          width: { sm: `calc(100% - ${sidebarWidth}px)` },
          ml: { sm: `${sidebarWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: "none" } }}
            aria-label="open sidebar"
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" fontWeight={700}>
            Admin Dashboard
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title="Open site">
            <IconButton size="small">
              <ArrowOutwardIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* ✅ Always-visible edge toggle (desktop) */}
      <Box
        sx={{
          position: "fixed",
          top: 12,
          left: (collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH) - 22,
          zIndex: (t) => t.zIndex.drawer + 1,
          display: { xs: "none", sm: "block" },
        }}
      >
        <Tooltip title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <IconButton
            size="small"
            onClick={handleCollapseToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            sx={{
              bgcolor: "background.paper",
              border: 1,
              borderColor: "divider",
              boxShadow: 1,
              "&:hover": { bgcolor: "background.paper" },
            }}
          >
            {collapsed ? (
              <KeyboardDoubleArrowRightIcon fontSize="small" />
            ) : (
              <KeyboardDoubleArrowLeftIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Sidebar */}
      <Box component="nav" sx={{ width: { sm: sidebarWidth }, flexShrink: { sm: 0 } }}>
        {/* Mobile (temporary) */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", sm: "none" },
            "& .MuiDrawer-paper": { width: EXPANDED_WIDTH },
          }}
        >
          {drawerContent}
        </Drawer>

        {/* Desktop (permanent, collapsible) */}
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", sm: "block" },
            "& .MuiDrawer-paper": {
              width: sidebarWidth,
              boxSizing: "border-box",
              overflowX: "hidden",
              transition: (theme) =>
                theme.transitions.create("width", {
                  easing: theme.transitions.easing.sharp,
                  duration: theme.transitions.duration.enteringScreen,
                }),
            },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${sidebarWidth}px)` },
          p: 0,
          transition: (theme) =>
            theme.transitions.create("width", {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
