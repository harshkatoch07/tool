import axios from "axios";

// Use env base in prod; fall back to /api for dev with proxy
const RAW = process.env.REACT_APP_API_BASE || "/api";
const API_BASE = RAW.endsWith("/api") ? RAW : `${RAW.replace(/\/$/, "")}/api`;

export const http = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// simple helper for auth
export const authHeaders = () => {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};
