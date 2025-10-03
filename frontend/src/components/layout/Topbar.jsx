import React from "react";
import { AppBar, Toolbar, Typography } from "@mui/material";
import { useLocation } from "react-router-dom";

const pageTitles = {
  "/": "Dashboard",
  "/approvals": "Approvals",
  "/shared": "Shared Approvals",
  "/delegates": "Delegate Approvals",
  "/configurations": "Configurations",
  "/reports": "Reports"
};

const Topbar = () => {
  const location = useLocation();
  const title = pageTitles[location.pathname] || "";
  return (
    <AppBar position="sticky" color="primary" sx={{ boxShadow: "none", zIndex: 1201, borderRadius: 0 }}>
      <Toolbar>
        <Typography variant="h6" fontWeight={600} sx={{ letterSpacing: 0.5 }}>
          {title}
        </Typography>
      </Toolbar>
    </AppBar>
  );
};
export default Topbar;
