// src/utils/api.js

// Normalize base: remove trailing slashes and any trailing "/api"
const RAW_BASE = process.env.REACT_APP_API_BASE || "";
const CLEAN_BASE = RAW_BASE.replace(/\/+$/g, "").replace(/\/api$/i, "");
const API_ROOT = `${CLEAN_BASE}/api`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Ensure we always join with a single slash
function buildUrl(path) {
  const p = typeof path === "string" ? path : "";
  return `${API_ROOT}${p.startsWith("/") ? "" : "/"}${p}`;
}

/**
 * request()
 * - Retries 503s (server busy) with backoff
 * - Surfaces 423 (account locked) & 401 (bad creds)
 * - Handles non-JSON error bodies gracefully
 * - Optional per-call abort signal; also supports internal timeout
 */
export async function request(
  path,
  { method = "GET", body, headers = {}, retries = 2, signal, timeoutMs } = {}
) {
  let attempt = 0;

  // Optional internal timeout if caller didn't pass one
  const controller = !signal && timeoutMs ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    while (true) {
      let res;
      try {
        res = await fetch(buildUrl(path), {
          method,
          headers: { "Content-Type": "application/json", ...headers },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller ? controller.signal : signal,
        });
      } catch {
        const err = new Error("Network error. Check connection and try again.");
        err.status = 0;
        throw err;
      }

      // Try JSON; if it fails, try text
      let data, text;
      try {
        data = await res.json();
      } catch {
        try {
          text = await res.text();
        } catch {
          /* ignore */
        }
      }

      if (res.ok) return data ?? (text ? { message: text } : {});

      if (res.status === 503 && attempt < retries) {
        const backoff = 400 * Math.pow(2, attempt) + Math.floor(Math.random() * 150);
        await sleep(backoff);
        attempt++;
        continue;
      }

      const message =
        (data && (data.message || data.error)) ||
        text ||
        (res.status === 423
          ? "Account locked. Try again later."
          : res.status === 401
          ? "Invalid username or password"
          : `Request failed (${res.status})`);

      const err = new Error(message);
      err.status = res.status;
      throw err;
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function login(username, password, { signal } = {}) {
  return request("/auth/login", {
    method: "POST",
    body: { username, password },
    signal,
    retries: 2,
    timeoutMs: 8000,
  });
}
