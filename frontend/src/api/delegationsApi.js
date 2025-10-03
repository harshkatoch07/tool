// src/api/delegationsApi.js
import axios from "axios";

const RAW = process.env.REACT_APP_API_BASE || "/api";
const API_BASE = RAW.endsWith("/api") ? RAW : `${RAW.replace(/\/$/, "")}/api`;

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  if (!config.headers.Authorization) {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Buckets for current user
export async function getMyDelegationBuckets() {
  const { data } = await api.get(`/delegations/my`);
  // normalize nulls to arrays
  return {
    outgoingActive: data.outgoingActive || [],
    outgoingScheduled: data.outgoingScheduled || [],
    outgoingExpired: data.outgoingExpired || [],
    incomingActive: data.incomingActive || [],
  };
}

// User search (dropdown)
export async function searchDelegatableUsers(query) {
  const { data } = await api.get(`/delegations/options/users`, {
    params: query ? { search: query } : undefined,
  });
  return data?.users || [];
}

// Create a delegation
export async function createDelegation({ toUserId, startsAtLocal, endsAtLocal }) {
  const toUtcIso = (local) => (local ? new Date(local).toISOString() : null);
  const payload = {
    toUserId,
    startsAtUtc: toUtcIso(startsAtLocal),
    endsAtUtc: toUtcIso(endsAtLocal),
  };
  const { data } = await api.post(`/delegations`, payload);
  return data;
}

// Revoke
export async function revokeDelegation(id) {
  await api.post(`/delegations/${id}/revoke`);
}
