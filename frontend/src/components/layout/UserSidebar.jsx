import React, { useState } from "react";
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Toolbar,
  Box,
  Divider,
} from "@mui/material";
import { Link, useLocation, useNavigate } from "react-router-dom";

import LogoutRounded from "@mui/icons-material/LogoutRounded";

import DashboardIcon from "@mui/icons-material/Dashboard";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ShareIcon from "@mui/icons-material/Share";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";

import AssignmentIndRounded from "@mui/icons-material/AssignmentIndRounded";
import OutboxRounded from "@mui/icons-material/OutboxRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import AutorenewRounded from "@mui/icons-material/AutorenewRounded";
import HighlightOffRounded from "@mui/icons-material/HighlightOffRounded";

const drawerWidth = 230;   // keep in sync with ProtectedLayout OPEN_W
const collapsedWidth = 60; // keep in sync with ProtectedLayout CLOSED_W

const BRAND = {
  blue: "#0E67B3",
  blueLightBg: "#E9F2FB",
  text: "#3C4257",
  subText: "#6B7280",
};

// Menu config
const menuItems = [
  { text: "Dashboard", icon: <DashboardIcon />, path: "/" },
  {
    text: "Approvals",
    icon: <AssignmentIcon />,
    children: [
      { text: "Assigned", key: "assigned", icon: <AssignmentIndRounded /> },
      { text: "Initiated", key: "initiated", icon: <OutboxRounded /> },
      { text: "Approved", key: "approved", icon: <CheckCircleRounded /> },
      { text: "Sent Back", key: "sentback", icon: <AutorenewRounded /> },
      { text: "Rejected", key: "rejected", icon: <HighlightOffRounded /> },
    ],
  },
  { text: "Shared", icon: <ShareIcon />, path: "/shared", children: [] },
  { text: "Delegates", icon: <CompareArrowsIcon />, path: "/delegations", children: [] },
  
  
];

const UserSidebar = ({ open, setOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();

const handleLogout = () => {
  try {
    localStorage.removeItem("token");        // remove auth token
  } finally {
    navigate("/login", { replace: true });   // go to login (or "/" if you prefer)
  }
};

  // Default expands Approvals to match reference
  const [openMenus, setOpenMenus] = useState({
    Approvals: true,
    Shared: false,
    Delegates: false,
    Configurations: false,
    Reports: false,
  });

  const toggleMenu = (name) => setOpenMenus((p) => ({ ...p, [name]: !p[name] }));

  const isApprovalsSectionActive = location.pathname.startsWith("/approvals");
  const isSelectedPath = (path) => path && location.pathname === path;

  return (
    <Drawer
      variant="permanent"
      open={open}
      sx={{
        width: open ? drawerWidth : collapsedWidth,
        flexShrink: 0,
        whiteSpace: "nowrap",
        "& .MuiDrawer-paper": {
          width: open ? drawerWidth : collapsedWidth,
          boxSizing: "border-box",
          transition: "width 0.2s cubic-bezier(.4,0,.2,1)",
          background: "#fff",
          color: BRAND.text,
          borderRight: `2px solid ${BRAND.blue}`, // thin blue line at right
          borderRadius: 0,
          overflowX: "hidden",
        },
      }}
      PaperProps={{ sx: { overflowY: "hidden" } }}
    >
      {/* Brand header */}
      <Toolbar
        disableGutters
        sx={{
          px: open ? 1.5 : 0,
          py: 1.25,
          minHeight: 64,
          borderBottom: (t) => `1px solid ${t.palette.divider}`,
          display: "flex",
          alignItems: "center",
          justifyContent: open ? "flex-start" : "center",
          gap: 1,
        }}
      >
        {/* Replace this with your logo if available */}
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${BRAND.blue}, #16A0CF)`,
            flexShrink: 0,
          }}
        />
        {open && (
          <Box sx={{ lineHeight: 1.1 }}>
            <Box sx={{ fontWeight: 700, fontSize: 14 }}>Gera</Box>
            <Box sx={{ fontSize: 11, letterSpacing: 0.6, color: BRAND.subText }}>
              APPROVALS
            </Box>
          </Box>
        )}
      </Toolbar>

      <List
        sx={{
          flex: 1,
          py: 0.5,
          overflowY: "auto",
          "& .MuiListItemButton-root": {
            borderRadius: 0,
            minHeight: 40,
          },
          "& .MuiListItemButton-root.Mui-selected": {
            backgroundColor: "transparent",
            color: BRAND.blue,
            "& .MuiListItemIcon-root": { color: BRAND.blue },
          },
          "& .MuiListItemButton-root:hover": {
            backgroundColor: BRAND.blueLightBg,
          },
        }}
      >
        {/* Dashboard */}
        <ListItemButton
          component={Link}
          to="/"
          selected={isSelectedPath("/")}
          sx={{ justifyContent: open ? "initial" : "center", px: open ? 2 : 1 }}
        >
          <ListItemIcon
            sx={{
              minWidth: 0,
              mr: open ? 2 : "auto",
              justifyContent: "center",
              color: "inherit",
            }}
          >
            <DashboardIcon fontSize="small" />
          </ListItemIcon>
          {open && (
            <ListItemText primary="Dashboard" primaryTypographyProps={{ fontSize: 14 }} />
          )}
        </ListItemButton>

        {/* Groups */}
        {menuItems.slice(1).map((item) => {
         const hasChildren = Array.isArray(item.children) && item.children.length > 0;
          const openThis = !!openMenus[item.text];
          const selectedHeader =
            item.text === "Approvals" ? isApprovalsSectionActive : isSelectedPath(item.path);

          return (
            <Box key={item.text}>
              <ListItemButton
                onClick={() => hasChildren && toggleMenu(item.text)}
                component={!hasChildren && item.path ? Link : "div"}
                to={!hasChildren && item.path ? item.path : undefined}
                selected={selectedHeader}
                sx={{
                  justifyContent: open ? "initial" : "center",
                  px: open ? 2 : 1,
                }}
                aria-expanded={hasChildren ? openThis : undefined}
                aria-controls={hasChildren ? `${item.text}-collapse` : undefined}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: open ? 2 : "auto",
                    justifyContent: "center",
                    color: "inherit",
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {open && (
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{ fontSize: 14 }}
                  />
                )}
                {open && hasChildren && (openThis ? <ExpandLess /> : <ExpandMore />)}
              </ListItemButton>

              {hasChildren && (
                <Collapse
                  in={open && openThis}
                  timeout="auto"
                  unmountOnExit
                  id={`${item.text}-collapse`}
                >
                  <List component="div" disablePadding>
                    {item.children.length > 0 ? (
                      item.children.map((sub) => {
                        const params = new URLSearchParams(location.search);
                        const currentTab = (params.get("tab") || "").toLowerCase();
                        const selected =
                          item.text === "Approvals" &&
                          (currentTab ? currentTab === sub.key : sub.key === "assigned");

                        const to = { pathname: "/approvals", search: `?tab=${sub.key}` };

                        return (
                          <ListItemButton
                            key={sub.key}
                            component={Link}
                            to={to}
                            selected={selected}
                            sx={{
                              pl: open ? 6 : 2,
                              minHeight: 34,
                              justifyContent: open ? "initial" : "center",
                            }}
                          >
                            <ListItemIcon
                              sx={{
                                minWidth: 0,
                                mr: open ? 1 : "auto",
                                justifyContent: "center",
                                color: BRAND.subText,
                              }}
                            >
                              {sub.icon}
                            </ListItemIcon>
                            {open && (
                              <ListItemText
                                primary={sub.text}
                                primaryTypographyProps={{
                                  fontSize: 13,
                                  color: BRAND.subText,
                                }}
                              />
                            )}
                          </ListItemButton>
                        );
                      })
                    ) : null}
                  </List>
                </Collapse>
              )}
            </Box>
          );
        })}
      </List>

            <Divider />
      <Box sx={{ p: 1 }}>
        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: 0,
            minHeight: 40,
            justifyContent: open ? "initial" : "center",
            px: open ? 2 : 1,
            "&:hover": { backgroundColor: BRAND.blueLightBg },
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: 0,
              mr: open ? 2 : "auto",
              justifyContent: "center",
              color: "inherit",
            }}
          >
            <LogoutRounded fontSize="small" />
          </ListItemIcon>
          {open && (
            <ListItemText
              primary="Logout"
              primaryTypographyProps={{ fontSize: 14 }}
            />
          )}
        </ListItemButton>
      </Box>
    </Drawer>
  );
};

export default UserSidebar;
