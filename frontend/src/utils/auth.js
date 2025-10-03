// src/api/auth.js (or whatever this file is named)
import { jwtDecode } from "jwt-decode";

// Returns true if there is a valid, non-expired JWT in localStorage
export const isAuthenticated = () => {
  const token = localStorage.getItem("token");
  if (!token) return false;
  try {
    const { exp } = jwtDecode(token);
    return Date.now() < exp * 1000;
  } catch {
    return false;
  }
};

// Returns the "role" claim from the JWT, or null
export const getUserRole = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const decoded = jwtDecode(token);
    return (
      decoded.role ||
      decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ||
      null
    );
  } catch {
    return null;
  }
};

// Logs out the user by clearing the token and redirecting to login
export const logout = () => {
  localStorage.removeItem("token");
  window.location.href = "/login";
};

// ✅ Use a RELATIVE base so CRA dev server proxies to http://localhost:5292
const API_BASE_URL = "/api";

/**
 * Login with username/email + password.
 * Sends both `user` and `username` to be compatible with either backend expectation.
 */
export const login = async (username, password) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: username,       // some backends expect `user`
        username,             // others expect `username`
        password,
      }),
    });

    if (!response.ok) {
      // Try to parse error body; fall back to generic message
      let message = "Invalid username or password";
      try {
        const errorData = await response.json();
        message = errorData?.message || message;
      } catch {}
      throw new Error(message);
    }

    const data = await response.json();
    localStorage.setItem("token", data.token); // Save token locally
    return data;
  } catch (error) {
    console.error("❌ Login failed:", error.message);
    throw error;
  }
};
