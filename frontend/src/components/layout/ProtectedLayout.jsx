import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import UserSidebar from "./UserSidebar";
import { Box, IconButton, Tooltip } from "@mui/material";
import { styled, alpha } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";

const OPEN_W = 230;   // keep in sync with UserSidebar
const CLOSED_W = 60;  // keep in sync with UserSidebar

// Floating circular hamburger like the reference
const SidebarToggleBtn = styled(IconButton)(({ theme }) => ({
  position: "fixed",
  top: 12,
  zIndex: theme.zIndex.drawer + 2,
  width: 36,
  height: 36,
  borderRadius: 999,
  background: "#fff",
  border: `1px solid ${alpha(theme.palette.common.black, 0.08)}`,
  boxShadow: "0 2px 6px rgba(0,0,0,.12)",
  "&:hover": { background: "#fff" },
}));

export default function ProtectedLayout({ children, requiredRole }) {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [open, setOpen] = useState(true); // SIDEBAR OPEN STATE

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      const decoded = jwtDecode(token);
      if (!decoded.exp || decoded.exp * 1000 < Date.now()) {
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }
      const extractedRole =
        decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
      setUserRole(extractedRole);

      if (requiredRole) {
        const isAdminRole = extractedRole === "1" || extractedRole?.toLowerCase() === "admin";
        if (requiredRole === "Admin" && !isAdminRole) {
          navigate("/unauthorized");
          return;
        }
      }
      setIsAuthorized(true);
    } catch {
      localStorage.removeItem("token");
      navigate("/login");
    }
  }, [navigate, requiredRole]);

  if (!isAuthorized) return <div>Loading...</div>;

  // Hide sidebar for Admin (role 1/admin)
  const hasSidebar = !(userRole === "1" || userRole?.toLowerCase() === "admin");

  // Position the floating button right at the content edge
  const leftOffset = (hasSidebar ? (open ? OPEN_W : CLOSED_W) : 0) + 12;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: hasSidebar
          ? "var(--app-sidebar-w) minmax(0, 1fr)"
          : "minmax(0, 1fr)",
        minHeight: "100dvh",
        transition: "grid-template-columns 220ms ease",
        "--app-sidebar-w": `${open ? OPEN_W : CLOSED_W}px`,
        background: "transparent",
      }}
    >
      {hasSidebar && (
        <>
          {/* Floating toggle button */}
          <Tooltip title={open ? "Collapse menu" : "Expand menu"}>
            <SidebarToggleBtn
              aria-label="Toggle sidebar"
              onClick={() => setOpen((v) => !v)}
              sx={{ left: leftOffset }}
            >
              {open ? <MenuOpenIcon fontSize="small" /> : <MenuIcon fontSize="small" />}
            </SidebarToggleBtn>
          </Tooltip>

          {/* Sidebar (participates in layout; not overlay) */}
          <Box
            component="aside"
            sx={{
              width: "var(--app-sidebar-w)",
              overflow: "hidden",
              transition: "width 220ms ease",
            }}
          >
            <UserSidebar open={open} setOpen={setOpen} />
          </Box>
        </>
      )}

      {/* Main content area (no extra padding; page controls its own) */}
      <Box
        component="main"
        sx={{
          minWidth: 0,
          p: 0,
          bgcolor: "transparent",
        }}
        className="app-content"
      >
        {children}
      </Box>
    </Box>
  );
}
