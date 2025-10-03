import React, { createContext, useContext, useEffect, useState } from "react";

// Map numeric role IDs to role names
const roleMap = {
  1: "Admin",
  2: "Approver",
  3: "Requestor"
};

// Utility: decode JWT and extract role
function getRoleFromToken(token) {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    let role = payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || payload.role || null;

    // If role is numeric, map it to name
    if (!isNaN(role)) {
      role = roleMap[parseInt(role, 10)];
    }
    return role;
  } catch {
    return null;
  }
}

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [role, setRole] = useState(() => getRoleFromToken(localStorage.getItem("token")));

  // Update role whenever token changes
  useEffect(() => {
    setRole(getRoleFromToken(token));
  }, [token]);

  const login = (jwt) => {
    localStorage.setItem("token", jwt);
    setToken(jwt);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ token, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
