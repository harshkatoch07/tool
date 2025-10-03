// src/index.js
import "./api/fetchAxiosShim"; // 👈 keep FIRST so it patches fetch/axios globally

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";

// ✅ Add these two imports
import { ThemeProvider, CssBaseline } from "@mui/material";
import { theme } from "./ui/theme"; // make sure src/ui/theme.js exists

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <AuthProvider>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </AuthProvider>
);
