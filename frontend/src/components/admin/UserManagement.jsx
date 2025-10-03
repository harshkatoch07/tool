// src/components/admin/UserManagement.jsx
import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Grid,
  Button,
  IconButton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Stack,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TablePagination,
  Tooltip,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloseIcon from "@mui/icons-material/Close";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import ToggleOffIcon from "@mui/icons-material/ToggleOff";

const API = "/api";
const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
};

// 🔹 Adjust if your Role IDs/Names differ
const ROLES = [
  { id: 1, name: "Admin" },
  { id: 2, name: "User" },
];

const getRoleName = (id) =>
  ROLES.find((r) => r.id === Number(id))?.name || String(id ?? "");

// ---- Compact spacing tokens ----
const DENSE = { padX: 1, padY: 0.5, rowH: 40, sectionGap: 1.5, gridGap: 1 };

/**
 * ✅ Robust truthy coercion
 * - If value is *missing*, default to TRUE (active).
 * - Otherwise accept true/false, 1/0, "1"/"0", "true"/"false", "y"/"n".
 */
const toBool = (v, defaultWhenMissing = true) => {
  if (v === undefined || v === null || v === "") return defaultWhenMissing;
  if (v === true || v === false) return v;
  const s = String(v).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "y" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "n" || s === "no") return false;
  // Fallback: keep default for odd values
  return defaultWhenMissing;
};

export default function UserManagement() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [refLoading, setRefLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [projects, setProjects] = useState([]);

  const [openCreate, setOpenCreate] = useState(false);
  const [openPwd, setOpenPwd] = useState(false);
  const [openAssign, setOpenAssign] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);

  const [createForm, setCreateForm] = useState({
    username: "",
    fullName: "",
    email: "",
    password: "",
    roleId: 0,
    departmentId: "",
    designationId: "",
    mobile: "",
    gender: "",
    designationName: "",
    isActive: true,
  });
  const [roleOption, setRoleOption] = useState(null);
  const [deptOption, setDeptOption] = useState(null);
  const [desigOption, setDesigOption] = useState(null);

  const [createProjectIds, setCreateProjectIds] = useState([]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [assignLoading, setAssignLoading] = useState(false);
  const [userProjectIds, setUserProjectIds] = useState([]);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ---- Users (server-side pagination + search) ----
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const url = `${API}/admin/users?page=${page + 1}&pageSize=${rowsPerPage}&q=${encodeURIComponent(
        debounced || ""
      )}&_=${Date.now()}`;

      const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
      const data = res.ok ? await res.json() : { items: [], total: 0 };

      const list = Array.isArray(data) ? data : data.items ?? [];

      setRows(
        (list ?? []).map((u) => {
          const rawStatus =
            u.isActive ?? u.IsActive ?? u.active ?? u.Active ?? u.status ?? u.Status;
          return {
            id: u.id ?? u.userID ?? u.UserID,
            username: u.username ?? u.userName,
            fullName: u.fullName ?? u.FullName,
            email: u.email ?? u.EmailID ?? "",
            roleId: u.roleId ?? u.RoleID ?? u.role ?? 0,
            departmentId: u.departmentId ?? u.DepartmentID ?? null,
            designationId: u.designationId ?? u.DesignationId ?? null,
            mobile: u.mobile ?? u.MobileNumber ?? "",
            gender: u.gender ?? u.Gender ?? "",
            designationName: u.designationName ?? u.DesignationName ?? "",
            // ✅ Default to ACTIVE if field is missing; otherwise coerce correctly
            isActive: toBool(rawStatus, /* defaultWhenMissing */ true),
          };
        })
      );
      setTotal(
        !Array.isArray(data) && typeof data.total === "number" ? data.total : list?.length ?? 0
      );
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // ---- Reference data ----
  const fetchDepartments = async () => {
    try {
      const res = await fetch(`${API}/admin/departments`, { headers: authHeaders(), cache: "no-store" });
      const data = res.ok ? await res.json() : [];
      return (Array.isArray(data) ? data : []).map((d) => ({
        id: d.departmentId ?? d.id,
        name: d.name ?? d.departmentName,
        isActive: toBool(d.isActive ?? d.IsActive, true),
      }));
    } catch {
      return [];
    }
  };

  const fetchDesignations = async () => {
    try {
      let res = await fetch(`${API}/admin/designations`, { headers: authHeaders(), cache: "no-store" });
      if (!res.ok) res = await fetch(`${API}/designations`, { headers: authHeaders(), cache: "no-store" });
      const data = res.ok ? await res.json() : [];
      return (Array.isArray(data) ? data : []).map((x) => ({
        id: x.id ?? x.designationID ?? x.DesignationID,
        name: x.name ?? x.designationName ?? x.DesignationName,
        isActive: toBool(x.isActive ?? x.IsActive, true),
      }));
    } catch {
      return [];
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API}/admin/projects`, { headers: authHeaders(), cache: "no-store" });
      const data = res.ok ? await res.json() : [];
      return (Array.isArray(data) ? data : []).map((p) => ({
        projectId: p.projectId ?? p.id ?? p.ProjectID,
        projectName: p.projectName ?? p.name ?? p.ProjectName,
      }));
    } catch {
      return [];
    }
  };

  const fetchRefs = async () => {
    setRefLoading(true);
    try {
      const [deptList, desigList, projectList] = await Promise.all([
        fetchDepartments(),
        fetchDesignations(),
        fetchProjects(),
      ]);
      setDepartments(deptList);
      setDesignations(desigList);
      setProjects(projectList);
    } finally {
      setRefLoading(false);
    }
  };

  useEffect(() => { fetchRefs(); }, []);
  useEffect(() => { fetchUsers(); }, [page, rowsPerPage, debounced]);
  useEffect(() => { setPage(0); }, [debounced]);

  // ----- Create user -----
  const handleOpenCreate = () => {
    setCreateForm({
      username: "",
      fullName: "",
      email: "",
      password: "",
      roleId: 0,
      departmentId: "",
      designationId: "",
      mobile: "",
      gender: "",
      designationName: "",
      isActive: true,
    });
    setRoleOption(null);
    setDeptOption(null);
    setDesigOption(null);
    setCreateProjectIds([]);
    setOpenCreate(true);
  };

  const createUser = async () => {
    const payload = {
      username: createForm.username?.trim(),
      fullName: createForm.fullName?.trim(),
      email: createForm.email?.trim() || null,
      password: createForm.password || null,
      role: Number(createForm.roleId) || 0,
      departmentId: createForm.departmentId ? Number(createForm.departmentId) : null,
      designationId: createForm.designationId ? Number(createForm.designationId) : 0,
      designationName: createForm.designationName || null,
      mobile: createForm.mobile?.trim() || null,
      gender: createForm.gender?.trim() || null,
      isActive: !!createForm.isActive,
    };

    const res = await fetch(`${API}/admin/users`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await res.text();
      alert(`Failed to create user: ${msg}`);
      return;
    }
    const created = await res.json();
    const newId = created?.id ?? created?.userID ?? created?.UserID;

    if (newId && createProjectIds.length > 0) {
      const aRes = await fetch(`${API}/admin/users/${newId}/projects`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ projectIds: createProjectIds }),
      });
      if (!aRes.ok) {
        const msg = await aRes.text();
        alert(`User created but failed to assign projects: ${msg}`);
      }
    }

    setOpenCreate(false);
    fetchUsers();
  };

  // ----- Password -----
  const handleOpenPwd = (user) => {
    setSelectedUser(user);
    setNewPassword("");
    setConfirmPassword("");
    setOpenPwd(true);
  };

  const changePassword = async () => {
    if (!selectedUser) return;
    if (!newPassword?.trim() || newPassword !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
    const res = await fetch(`${API}/admin/users/${selectedUser.id}/password`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ newPassword }),
    });
    if (!res.ok) {
      const msg = await res.text();
      alert(`Failed to set password: ${msg}`);
      return;
    }
    setOpenPwd(false);
  };

  // ----- Assign projects -----
  const handleOpenAssign = async (user) => {
    setSelectedUser(user);
    setAssignLoading(true);
    setOpenAssign(true);
    try {
      if (!projects.length) setProjects(await fetchProjects());
      const aRes = await fetch(`${API}/admin/users/${user.id}/projects`, { headers: authHeaders(), cache: "no-store" });
      const aData = aRes.ok ? await aRes.json() : { projectIds: [] };
      setUserProjectIds(Array.isArray(aData.projectIds) ? aData.projectIds : []);
    } finally {
      setAssignLoading(false);
    }
  };

  const saveAssignments = async () => {
    if (!selectedUser) return;
    const res = await fetch(`${API}/admin/users/${selectedUser.id}/projects`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ projectIds: userProjectIds }),
    });
    if (!res.ok) {
      const msg = await res.text();
      alert(`Failed to assign projects: ${msg}`);
      return;
    }
    setOpenAssign(false);
  };

  // ----- Toggle Active / Inactive -----
  const toggleActive = async (user) => {
    const next = !user.isActive;

    const res = await fetch(`${API}/admin/users/${user.id}/status`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ isActive: next }),
    });
    if (!res.ok) {
      const msg = await res.text();
      alert(`Failed to ${next ? "activate" : "deactivate"} user: ${msg}`);
      return;
    }

    // Optimistic update
    setRows((prev) => prev.map((r) => (r.id === user.id ? { ...r, isActive: next } : r)));

    // Sync with server
    await fetchUsers();
  };

  // ----- Delete user -----
  const handleOpenDelete = (user) => {
    setDeleteUserTarget(user);
    setOpenDelete(true);
  };

  const confirmDeleteUser = async () => {
    if (!deleteUserTarget) return;
    const res = await fetch(`${API}/admin/users/${deleteUserTarget.id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) {
      const msg = await res.text();
      alert(`Failed to delete user: ${msg}`);
      return;
    }
    setOpenDelete(false);
    setDeleteUserTarget(null);
    fetchUsers();
  };

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, background: "transparent" }}>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 2,
          backgroundColor: "rgba(255,255,255,0.7)",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(229, 231, 235, 0.8)",
          boxShadow: "0 10px 24px rgba(31, 41, 55, 0.08)",
        }}
      >
        {/* Header */}
        <Grid container alignItems="center" spacing={DENSE.gridGap}>
          <Grid item xs>
            <Typography variant="h6" sx={{ fontWeight: 800, color: "#1F2937", lineHeight: 1.2 }}>
              Manage Users
            </Typography>
            <Typography variant="caption" sx={{ color: "#6B7280" }}>
              Create users, reset passwords, assign projects, set active status, and search employees.
            </Typography>
          </Grid>

          {/* 🔎 Search */}
          <Grid item>
            <TextField
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, username"
              sx={{
                minWidth: { xs: 220, sm: 280, md: 320 },
                backgroundColor: "rgba(255,255,255,0.8)",
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: search ? (
                  <InputAdornment position="end">
                    <IconButton size="small" aria-label="Clear search" onClick={() => setSearch("")}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
          </Grid>

          <Grid item>
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={fetchUsers}
              sx={{
                mr: 1,
                textTransform: "none",
                fontWeight: 600,
                border: "1px solid rgba(209, 213, 219, 1)",
                backgroundColor: "rgba(255,255,255,0.6)",
                "&:hover": { backgroundColor: "rgba(243,244,246,0.9)" },
              }}
            >
              Refresh
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<PersonAddAlt1Icon />}
              onClick={handleOpenCreate}
              sx={{
                textTransform: "none",
                fontWeight: 700,
                background: "linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)",
                boxShadow: "0 6px 16px rgba(79,70,229,.35)",
              }}
            >
              Add User
            </Button>
          </Grid>

          {/* Close button pushed to extreme right */}
          <Grid item sx={{ ml: "auto" }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<CloseIcon />}
              onClick={() => window.history.back()}
              sx={{
                color: "#b91c1c",
                border: "1px solid rgba(185,28,28,0.15)",
                textTransform: "none",
                fontWeight: 600,
              }}
            >
              Close
            </Button>
          </Grid>
        </Grid>

        <Divider sx={{ my: DENSE.sectionGap, opacity: 0.5 }} />

        {/* Table */}
        <TableContainer component={Paper} elevation={0} sx={{ background: "transparent" }}>
          <Table
            size="small"
            sx={{
              "& td, & th": { py: DENSE.padY, px: DENSE.padX },
              "& tr": { height: DENSE.rowH },
            }}
          >
            <TableHead>
              <TableRow
                sx={{
                  "& th": {
                    backgroundColor: "rgba(249,250,251,0.7)",
                    fontWeight: 700,
                    color: "#374151",
                  },
                }}
              >
                <TableCell>ID</TableCell>
                <TableCell>Username</TableCell>
                <TableCell>Full Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <CircularProgress size={20} />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ color: "#6B7280" }}>
                    {debounced ? "No users match your search." : "No users found."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    sx={{
                      "&:hover": { backgroundColor: "rgba(243,244,246,0.5)" },
                      opacity: row.isActive ? 1 : 0.6,
                    }}
                  >
                    <TableCell>{row.id}</TableCell>
                    <TableCell>{row.username}</TableCell>
                    <TableCell>{row.fullName}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={getRoleName(row.roleId)}
                        size="small"
                        sx={{
                          fontWeight: 600,
                          height: 22,
                          ...(row.roleId === 1
                            ? { bgcolor: "rgba(254,226,226,0.8)", color: "#991B1B" }
                            : row.roleId === 2
                            ? { bgcolor: "rgba(254,243,199,0.8)", color: "#92400E" }
                            : { bgcolor: "rgba(219,234,254,0.8)", color: "#1E3A8A" }),
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.isActive ? "Active" : "Inactive"}
                        sx={{
                          fontWeight: 700,
                          height: 22,
                          ...(row.isActive
                            ? { bgcolor: "rgba(209,250,229,0.85)", color: "#065F46" }
                            : { bgcolor: "rgba(254,226,226,0.85)", color: "#991B1B" }),
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Change Password">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenPwd(row)}
                            sx={{ "&:hover": { bgcolor: "rgba(229,231,235,0.7)" } }}
                          >
                            <VpnKeyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Assign Projects">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenAssign(row)}
                            sx={{ "&:hover": { bgcolor: "rgba(229,231,235,0.7)" } }}
                          >
                            <AssignmentIndIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        {/* Toggle Active/Inactive */}
                        <Tooltip title={row.isActive ? "Mark Inactive" : "Mark Active"}>
                          <IconButton
                            size="small"
                            onClick={() => toggleActive(row)}
                            sx={{
                              "&:hover": { bgcolor: "rgba(229,231,235,0.7)" },
                              color: row.isActive ? "#b45309" : "#065F46",
                            }}
                          >
                            {row.isActive ? <ToggleOffIcon fontSize="small" /> : <ToggleOnIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Delete User">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDelete(row)}
                            sx={{ "&:hover": { bgcolor: "rgba(229,231,235,0.7)" }, color: "#b91c1c" }}
                          >
                            <DeleteForeverIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Server-side pagination using backend total */}
        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(+e.target.value);
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100, 500]}
          sx={{
            ".MuiTablePagination-toolbar": { minHeight: 36, p: 0, color: "#374151", fontWeight: 600 },
            ".MuiTablePagination-actions": { color: "#374151" },
          }}
        />
      </Paper>

      {/* Create User Dialog */}
      <Dialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{
          elevation: 0,
          sx: { borderRadius: 2, backgroundColor: "rgba(255,255,255,0.96)", border: "1px solid rgba(229,231,235,0.85)" },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, pr: 5 }}>
          Create New User
          <IconButton aria-label="close" onClick={() => setOpenCreate(false)} sx={{ ml: 1, float: "right" }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 2 }}>
          <Box component="form" noValidate>
            {/* Account Details */}
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#1F2937" }}>
              Account Details
            </Typography>
            <Typography variant="caption" sx={{ color: "#6B7280", mb: 1.5, display: "block" }}>
              Provide login credentials and basic identification.
            </Typography>

            <Grid container spacing={DENSE.gridGap}>
              <Grid item xs={12} sm={6}>
                <TextField
                  size="small"
                  label="Username"
                  fullWidth
                  required
                  value={createForm.username}
                  onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  size="small"
                  label="Full Name"
                  fullWidth
                  required
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  size="small"
                  label="Email"
                  type="email"
                  fullWidth
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  size="small"
                  label="Password"
                  type={createForm.__showPwd ? "text" : "password"}
                  fullWidth
                  required
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => setCreateForm((f) => ({ ...f, __showPwd: !f.__showPwd }))}
                        >
                          {createForm.__showPwd ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: DENSE.sectionGap }} />

            {/* Organizational Information */}
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#1F2937" }}>
              Organizational Information
            </Typography>
            <Typography variant="caption" sx={{ color: "#6B7280", mb: 1.5, display: "block" }}>
              Define the user's role, department, and project access.
            </Typography>

            <Grid container spacing={DENSE.gridGap}>
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  options={ROLES}
                  value={roleOption}
                  onChange={(_, opt) => {
                    setRoleOption(opt);
                    setCreateForm((f) => ({ ...f, roleId: opt ? opt.id : 0 }));
                  }}
                  getOptionLabel={(o) => o?.name ?? ""}
                  fullWidth
                  renderInput={(params) => <TextField {...params} size="small" label="Role" required />}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  options={departments}
                  loading={refLoading}
                  value={deptOption}
                  onChange={(_, opt) => {
                    setDeptOption(opt);
                    setCreateForm((f) => ({ ...f, departmentId: opt ? opt.id : "" }));
                  }}
                  getOptionLabel={(o) => o?.name ?? ""}
                  fullWidth
                  renderInput={(params) => <TextField {...params} size="small" label="Department" />}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  options={designations}
                  loading={refLoading}
                  value={desigOption}
                  onChange={(_, opt) => {
                    setDesigOption(opt);
                    setCreateForm((f) => ({
                      ...f,
                      designationId: opt ? opt.id : 0,
                      designationName: opt ? opt.name : "",
                    }));
                  }}
                  getOptionLabel={(o) => o?.name ?? ""}
                  fullWidth
                  renderInput={(params) => <TextField {...params} size="small" label="Designation" />}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  multiple
                  options={projects}
                  loading={refLoading}
                  getOptionLabel={(o) => o.projectName ?? String(o.projectId)}
                  value={projects.filter((p) => createProjectIds.includes(p.projectId))}
                  onChange={(_, val) => setCreateProjectIds(val.map((v) => v.projectId))}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip key={option.projectId} size="small" label={option.projectName} {...getTagProps({ index })} />
                    ))
                  }
                  renderInput={(params) => <TextField {...params} size="small" label="Assign Projects" />}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: DENSE.sectionGap }} />

            {/* Personal Details */}
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#1F2937" }}>
              Personal Details
            </Typography>
            <Typography variant="caption" sx={{ color: "#6B7280", mb: 1.5, display: "block" }}>
              Optional demographic information.
            </Typography>

            <Grid container spacing={DENSE.gridGap}>
              <Grid item xs={12} sm={6}>
                <TextField
                  size="small"
                  label="Mobile Number"
                  fullWidth
                  value={createForm.mobile}
                  onChange={(e) => setCreateForm((f) => ({ ...f, mobile: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel id="gender-label">Gender</InputLabel>
                  <Select
                    labelId="gender-label"
                    value={createForm.gender || ""}
                    label="Gender"
                    onChange={(e) => setCreateForm((f) => ({ ...f, gender: e.target.value }))}
                  >
                    <MenuItem value="Male">Male</MenuItem>
                    <MenuItem value="Female">Female</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                    <MenuItem value="Prefer not to say">Prefer not to say</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Initial Active status */}
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!createForm.isActive}
                      onChange={(e) => setCreateForm((f) => ({ ...f, isActive: e.target.checked }))}
                    />
                  }
                  label={createForm.isActive ? "Active" : "Inactive"}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 1.5 }}>
          <Button size="small" onClick={() => setOpenCreate(false)} sx={{ textTransform: "none", fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={createUser}
            disabled={!createForm.username || !createForm.password || !createForm.fullName || refLoading}
            sx={{ textTransform: "none", fontWeight: 700, background: "linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)" }}
          >
            Create User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog
        open={openPwd}
        onClose={() => setOpenPwd(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ elevation: 0, sx: { borderRadius: 2, backgroundColor: "rgba(255,255,255,0.95)", border: "1px solid rgba(229,231,235,0.8)" } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pr: 5 }}>
          Change Password {selectedUser ? `— ${selectedUser.username}` : ""}
          <IconButton aria-label="close" onClick={() => setOpenPwd(false)} sx={{ ml: 1, float: "right" }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2 }}>
          <TextField size="small" type="password" label="New Password" fullWidth value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <TextField
            size="small"
            type="password"
            label="Confirm Password"
            fullWidth
            sx={{ mt: 1 }}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={!!confirmPassword && confirmPassword !== newPassword}
            helperText={!!confirmPassword && confirmPassword !== newPassword ? "Passwords do not match" : " "}
          />
        </DialogContent>
        <DialogActions sx={{ p: 1.5 }}>
          <Button size="small" onClick={() => setOpenPwd(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button size="small" variant="contained" onClick={changePassword} sx={{ textTransform: "none", fontWeight: 700, background: "linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)" }}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Projects Dialog */}
      <Dialog
        open={openAssign}
        onClose={() => setOpenAssign(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ elevation: 0, sx: { borderRadius: 2, backgroundColor: "rgba(255,255,255,0.95)", border: "1px solid rgba(229,231,235,0.8)" } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pr: 5 }}>
          Assign Projects {selectedUser ? `— ${selectedUser.username}` : ""}
          <IconButton aria-label="close" onClick={() => setOpenAssign(false)} sx={{ ml: 1, float: "right" }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2 }}>
          {assignLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size={22} />
            </Box>
          ) : (
            <>
              <Autocomplete
                multiple
                options={projects}
                getOptionLabel={(o) => o.projectName ?? String(o.projectId)}
                value={projects.filter((p) => userProjectIds.includes(p.projectId))}
                onChange={(_, val) => setUserProjectIds(val.map((v) => v.projectId))}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip key={option.projectId} size="small" label={option.projectName} {...getTagProps({ index })} />
                  ))
                }
                renderInput={(params) => <TextField {...params} size="small" label="Projects" placeholder="Select" />}
              />
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {userProjectIds.length} project(s) selected
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 1.5 }}>
          <Button size="small" onClick={() => setOpenAssign(false)} sx={{ textTransform: "none" }}>
            Close
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={saveAssignments}
            disabled={assignLoading}
            sx={{ textTransform: "none", fontWeight: 700, background: "linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)" }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete User Confirm Dialog */}
      <Dialog
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ elevation: 0, sx: { borderRadius: 2, backgroundColor: "rgba(255,255,255,0.95)", border: "1px solid rgba(229,231,235,0.8)" } }}
      >
        {/* keep your existing delete-confirm content here */}
      </Dialog>
    </Box>
  );
}
