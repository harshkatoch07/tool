import { createTheme, alpha } from "@mui/material/styles";

const brand = {
  primary: "#1a73e8",
  primaryDark: "#1557b0",
  gradientFrom: "#1a73e8",
  gradientTo:   "#1ec8ff",
  surface: "#ffffff",
  surfaceAlt: "#f5f7fb",
  border: "#e7eaf3",
  text: "#1b2b41",
  muted: "#6b7a90",
  success: "#2ab67d",
  warning: "#f7b02c",
  danger:  "#ef5350",
};

export const theme = createTheme({
  palette: {
    primary: { main: brand.primary, dark: brand.primaryDark },
    success: { main: brand.success },
    warning: { main: brand.warning },
    error:   { main: brand.danger },
    background: {
      default: "#f3f6fb",
      paper: brand.surface,
    },
    text: {
      primary: brand.text,
      secondary: brand.muted,
    },
    divider: brand.border,
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: `"Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,
    h4: { fontWeight: 700, letterSpacing: 0.2 },
    h6: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { backgroundColor: "#f3f6fb" } } },
    MuiPaper: { styleOverrides: { root: { borderRadius: 16 } } },
    MuiCard:  { styleOverrides: { root: { borderRadius: 16 } } },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 12, paddingInline: 16, paddingBlock: 10 },
        contained: { boxShadow: "0 8px 20px rgba(26,115,232,0.15)" },
      },
    },
    MuiTabs: { styleOverrides: { indicator: { height: 4, borderRadius: 2 } } },
    MuiTab:  { styleOverrides: { root: { fontWeight: 600, minHeight: 44 } } },
    MuiTableHead: { styleOverrides: { root: { backgroundColor: brand.surfaceAlt } } },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 700, borderBottom: `1px solid ${brand.border}` },
        body: { borderBottom: `1px solid ${brand.border}` },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
  },
});

export const pageGradient = (/* theme */) => ({
  background: `linear-gradient(90deg, ${brand.gradientFrom} 0%, ${brand.gradientTo} 100%)`,
  color: "#fff",
});

export const softShadow = "0 8px 30px rgba(18, 38, 63, 0.08)";
export const ring = (/* theme, */ c = brand.primary) => `0 0 0 6px ${alpha(c, 0.08)}`;
