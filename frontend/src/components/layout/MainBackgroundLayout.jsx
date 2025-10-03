// MainBackgroundLayout.jsx
// Two-tone background wrapper: top 60% blue gradient, bottom white.
// Use this as the visual background container that pages render inside.

import React from "react";
import { Box, Container } from "@mui/material";
import { Outlet } from "react-router-dom";

/**
 * @typedef {Object} MainBackgroundLayoutProps
 * @property {boolean} [useOutlet=true] Render <Outlet/> (router nesting). If false, render children.
 * @property {"xs"|"sm"|"md"|"lg"|"xl"|false} [maxWidth=false] MUI Container maxWidth. false = full width.
 * @property {boolean} [padded=true] Apply default vertical padding for page content.
 * @property {string} [topBandHeight="60vh"] Height of the blue band (e.g., "60vh", "420px").
 * @property {number} [topBandRatio] Optional ratio (0..1). If provided, overrides topBandHeight using `${ratio*100}vh`.
 * @property {string} [start="#0E67B3"] Gradient start color.
 * @property {string} [end="#16A0CF"] Gradient end color.
 * @property {import('react').ReactNode} [children] Children when useOutlet=false.
 * @property {object} [sx] MUI sx overrides for the outer Box.
 */
export default function MainBackgroundLayout({
  useOutlet = true,
  maxWidth = false,          // full-bleed by default
  padded = true,
  topBandHeight = "60vh",
  topBandRatio,
  start = "#0E67B3",
  end = "#16A0CF",
  children,
  sx = {},
}) {
  const computedHeight =
    typeof topBandRatio === "number"
      ? `${Math.max(0, Math.min(1, topBandRatio)) * 100}vh`
      : topBandHeight;

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "100dvh",
        bgcolor: "#f3f3f3ff",
        "&::before": {
          content: '""',
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: computedHeight,
          background: `linear-gradient(135deg, ${start} 0%, ${end} 100%)`,
          zIndex: 0,
          pointerEvents: "none",
        },
        ...sx,
      }}
    >
      {/* Content layer */}
      <Container
        disableGutters            // no side gutters; pages control their own padding
        maxWidth={maxWidth}       // false = 100% width
        sx={{
          position: "relative",
          zIndex: 1,
          px: 0,                  // edge-to-edge (pages add their own px)
          py: padded ? { xs: 2, md: 3 } : 0,
          width: "100%",
        }}
      >
        {useOutlet ? <Outlet /> : children}
      </Container>
    </Box>
  );
}
