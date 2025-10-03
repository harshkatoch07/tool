// src/components/Login/LoginPage.jsx
import React, { useMemo, useState, useEffect } from "react";
import {
  Box,
  Paper,
  TextField,
  Typography,
  Button,
  Alert,
  IconButton,
  InputAdornment,
  FormControlLabel,
  Checkbox,
  CircularProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { login as apiLogin } from "../../utils/api";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import PersonIcon from "@mui/icons-material/Person";
import LockIcon from "@mui/icons-material/Lock";
import LoginIcon from "@mui/icons-material/Login";
import { jwtDecode } from "jwt-decode";
import { useAuth } from "../../context/AuthContext";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  // Prefill last username if remembered
  useEffect(() => {
    const last = localStorage.getItem("lastUser");
    if (last) setUsername(last);
  }, []);

  const disabled = useMemo(
    () => busy || !username.trim() || !password.trim(),
    [busy, username, password]
  );

  const handleLogin = async (e) => {
    e?.preventDefault();
    setError("");
    if (disabled) return;

    try {
      setBusy(true);
      const data = await apiLogin(username.trim(), password);
      login(data.token); // Store token in context

      // Remember username (not password)
      if (remember) localStorage.setItem("lastUser", username.trim());
      else localStorage.removeItem("lastUser");

      const decoded = jwtDecode(data.token);
      const role =
        decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ||
        decoded.role ||
        decoded.Role;

      // Redirect based on role
      if (role === "Admin") navigate("/admin", { replace: true });
      else navigate("/", { replace: true });
    } catch (err) {
      console.error("Login error:", err);
      setError("Invalid username or password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        p: 2,
        background:
          "linear-gradient(135deg, rgba(247, 255, 172, 0.95) 0%, rgba(170, 22, 255, 0.95) 100%)",
      }}
    >
      <Paper
        component="form"
        onSubmit={handleLogin}
        elevation={8}
        sx={{
          width: "100%",
          maxWidth: 700,
          borderRadius: 5,
          p: { xs: 3, sm: 4 },
          boxShadow: "0 12px 30px rgba(18, 73, 63, 0.04)",
        }}
      >
        {/* Header */}
        <Box sx={{ textAlign: "center", mb: 2 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              mx: "auto",
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              bgcolor: "primary.main",
              color: "primary.contrastText",
              mb: 1,
              boxShadow: 2,
            }}
          >
            <LoginIcon />
          </Box>
          <Typography variant="h5" fontWeight={800}>
            Gera Approvals
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sign in to continue
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        <TextField
          label="Username"
          fullWidth
          margin="normal"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          autoComplete="username"
          inputProps={{ "aria-label": "username" }}
          placeholder="your.username"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PersonIcon color="action" />
              </InputAdornment>
            ),
          }}
        />

        <TextField
          label="Password"
          type={showPassword ? "text" : "password"}
          fullWidth
          margin="normal"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          inputProps={{ "aria-label": "password" }}
          placeholder="********"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((p) => !p)}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Box
          sx={{
            mt: 0.5,
            mb: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <FormControlLabel
            control={
              <Checkbox
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                color="primary"
              />
            }
            label="Remember me"
            sx={{ userSelect: "none" }}
          />
          <Button size="small" color="inherit" disabled sx={{ textTransform: "none" }}>
            Forgot password?
          </Button>
        </Box>

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={disabled}
          sx={{ mt: 0.5, py: 1.2, borderRadius: 2, fontWeight: 800, letterSpacing: 0.4 }}
          startIcon={!busy && <LoginIcon />}
        >
          {busy ? <CircularProgress size={24} sx={{ color: "white" }} /> : "Login"}
        </Button>
      </Paper>
    </Box>
  );
};

export default LoginPage;
