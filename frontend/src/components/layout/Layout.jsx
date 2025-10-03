import React, { Suspense } from "react";
import { Box, Container, LinearProgress } from "@mui/material";
import { Outlet, ScrollRestoration } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

// Simple error boundary so a failing child route doesn't kill the whole shell
class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    // optional: send to your logger
    // console.error("RouteErrorBoundary", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3, color: "text.secondary" }}>
          Something went wrong loading this page. Try refreshing.
        </Box>
      );
    }
    return this.props.children;
  }
}

// Accessible skip link to jump past the sidebar/topbar
const SkipToContent = () => (
  <a
    href="#main-content"
    style={{
      position: "absolute",
      left: "-9999px",
      top: "auto",
      width: 1,
      height: 1,
      overflow: "hidden",
    }}
    onFocus={(e) => {
      Object.assign(e.currentTarget.style, {
        left: "16px",
        top: "16px",
        width: "auto",
        height: "auto",
        padding: "8px 12px",
        background: "#111827",
        color: "#fff",
        borderRadius: "8px",
        zIndex: 1300,
      });
    }}
    onBlur={(e) => {
      Object.assign(e.currentTarget.style, {
        left: "-9999px",
        width: 1,
        height: 1,
        padding: 0,
        background: "transparent",
      });
    }}
  >
    Skip to content
  </a>
);

const Layout = () => (
  <Box
    sx={{
      display: "flex",
      minHeight: "100vh",
      // Gradient background to match dashboard aesthetic
      background:
        "linear-gradient(135deg, #EFF6FF 0%, #F3E8FF 50%, #FCE7F3 100%)",
    }}
  >
    <SkipToContent />

    {/* Sidebar stays as is; make sure it handles xs/mobile internally (e.g., Drawer) */}
    <Sidebar />

    {/* Main column */}
    <Box
      sx={{
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0, // avoid overflow with flex children
      }}
    >
      {/* Topbar fixed? If so, ensure it reserves space. */}
      <Topbar />

      {/* Content area */}
      <Box
        id="main-content"
        component="main"
        role="main"
        tabIndex={-1}
        sx={{
          // If Topbar is position="fixed", add mt equal to toolbar height:
          // mt: { xs: 7, sm: 8 }, // tweak to your Topbar height
          py: { xs: 2, md: 3 },
          px: { xs: 2, md: 3 },
          // Content gets subtle container max-width and centers on large screens
        }}
      >
        <Container maxWidth="xl" disableGutters={false}>
          <RouteErrorBoundary>
            <Suspense
              fallback={
                <Box sx={{ pt: 1 }}>
                  <LinearProgress />
                </Box>
              }
            >
              <Outlet />
            </Suspense>
          </RouteErrorBoundary>
        </Container>
      </Box>
    </Box>

    {/* Restore scroll position when navigating back/forward */}
    <ScrollRestoration />
  </Box>
);

export default Layout;
