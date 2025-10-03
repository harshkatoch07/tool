// src/api/base.js
// If REACT_APP_API_BASE is set, use it (e.g. http://localhost:5292)
// Otherwise default to your local API.
const RAW = process.env.REACT_APP_API_BASE || "http://localhost:5292";

// Always ensure trailing "/api"
export const API_BASE = `${RAW.replace(/\/$/, "")}/api`;
