import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Stack,
  Alert,
  Divider,
  Select,
  MenuItem,
  Badge,
  Button,
  Skeleton,
  Tooltip,
  ButtonBase,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import { alpha } from "@mui/material/styles";
import AssignmentIndRounded from "@mui/icons-material/AssignmentIndRounded";
import OutboxRounded from "@mui/icons-material/OutboxRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import HighlightOffRounded from "@mui/icons-material/HighlightOffRounded";
import AutorenewRounded from "@mui/icons-material/AutorenewRounded";
import { useNavigate } from "react-router-dom";

import SmartDataTable from "../../ui/SmartDataTable";
import { buildDashboardColumns } from "./dashboardColumns";
import ApprovalPathDialog from "../initiate/ApprovalPathDialog";

// ─────────────────────────────────────────────────────────────
const BRAND = {
  bannerStart: "#0E67B3",
  bannerEnd: "#16A0CF",
  bannerText: "#FFFFFF",
  cardBorder: "#E2E8F0",
  chipApprovedBg: "#E8FFF3",
  chipApprovedFg: "#137A4B",
  chipWarnBg: "#FFF7E6",
  chipWarnFg: "#925511",
  chipRejectedBg: "#FFECEC",
  chipRejectedFg: "#7C1D1D",
};

const UI = {
  page: { minH: { xs: "100svh", md: "100dvh" } },
  kpi: { minH: 88, iconBox: 40 },
};

// ─────────────────────────────────────────────────────────────
// JWT helpers
const getJwtPayload = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const prettyNameFromEmail = (email) => {
  if (!email || typeof email !== "string") return null;
  const local = email.split("@")[0].split("+")[0];
  const words = local
    .replace(/[\._\-]+/g, " ")
    .replace(/\d+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return null;
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
};

const pickDisplayName = (claims) => {
  if (!claims) return null;
  const dotnet = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims";
  const tryKeys = [
    "name",
    "given_name",
    "family_name",
    "preferred_username",
    "unique_name",
    "fullName",
    `${dotnet}/name`,
    `${dotnet}/givenname`,
    `${dotnet}/surname`,
    `${dotnet}/emailaddress`,
    "email",
  ];
  for (const k of tryKeys) {
    const v = claims[k];
    if (!v) continue;
    if (typeof v === "string" && v.includes("@")) {
      return prettyNameFromEmail(v) || v;
    }
    return v;
  }
  if (claims.given_name && claims.family_name) return `${claims.given_name} ${claims.family_name}`;
  if (claims.email) return prettyNameFromEmail(claims.email) || claims.email;
  if (claims[`${dotnet}/emailaddress`]) {
    const v = claims[`${dotnet}/emailaddress`];
    return prettyNameFromEmail(v) || v;
  }
  return null;
};

// ─────────────────────────────────────────────────────────────
// Shared formatters
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");
const showStatus = (s) => {
  const v = String(s || "");
  if (/^inprogress$/i.test(v)) return "InProgress";
  if (/sent/i.test(v)) return "Sent Back";
  return v || "—";
};
const statusChip = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return { label: "Approved", bg: BRAND.chipApprovedBg, fg: BRAND.chipApprovedFg };
  if (s === "rejected") return { label: "Rejected", bg: BRAND.chipRejectedBg, fg: BRAND.chipRejectedFg };
  if (s === "pending" || s === "inprogress" || s.includes("sent"))
    return { label: showStatus(status), bg: BRAND.chipWarnBg, fg: BRAND.chipWarnFg };
  return { label: showStatus(status), bg: alpha("#000", 0.06), fg: "#334155" };
};

// Normalizers
const normalizeInitiated = (r) => ({
  id: r.id ?? r.fundRequestId ?? r.FundRequestId,
  fundRequestId: r.fundRequestId ?? r.FundRequestId ?? r.id,
  approvalId: r.approvalId ?? r.ApprovalId ?? null,
  title: r.requestTitle ?? r.Title ?? "—",
  workflowName: r.workflowName ?? r.approvalCategoryName ?? r.categoryName ?? r.requestType ?? "—",
  initiatedBy: r.initiatedBy ?? r.initiatorName ?? r.InitiatorName ?? null,
  departmentName: r.departmentName ?? r.DepartmentName ?? r.department ?? "—",
  createdAt: r.createdAt ?? r.CreatedAt ?? null,
  lastActionAt: r.lastActionDate ?? r.LastActionDate ?? null,
  neededBy: r.neededBy ?? r.NeededBy ?? r.requiredByDate ?? r.dueDate ?? r.deadline ?? null,
  status: r.status ?? r.Status ?? "—",
});

const normalizeAssigned = (r) => ({
  id: r.approvalId ?? r.ApprovalId ?? r.id,
  approvalId: r.approvalId ?? r.ApprovalId ?? r.id,
  fundRequestId: r.fundRequestId ?? r.FundRequestId ?? null,
  title: r.requestTitle ?? r.Title ?? "—",
  workflowName: r.workflowName ?? r.approvalCategoryName ?? r.categoryName ?? r.requestType ?? "—",
  initiatedBy: r.initiatorName ?? r.initiatedBy ?? r.InitiatorName ?? null,
  departmentName: r.departmentName ?? r.DepartmentName ?? r.department ?? "—",
  createdAt: r.createdAt ?? r.CreatedAt ?? null,
  lastActionAt: r.lastActionDate ?? r.LastActionDate ?? null,
  neededBy: r.neededBy ?? r.NeededBy ?? r.requiredByDate ?? r.dueDate ?? r.deadline ?? null,
  status: r.status ?? r.Status ?? "—",
});

// ─────────────────────────────────────────────────────────────
function InitiateLauncher() {
  const navigate = useNavigate();
  return (
    <Box
      sx={{
        position: "fixed",
        right: { xs: 16, md: 24 },
        bottom: { xs: 24, md: 28 },
        zIndex: 1301,
        "@keyframes breathe": {
          "0%, 100%": { transform: "translateY(0) scale(1)" },
          "50%": { transform: "translateY(-2px) scale(1.02)" },
        },
        "@keyframes wave": {
          "0%": { transform: "translate(-50%, -50%) scale(0.8)", opacity: 0.6 },
          "100%": { transform: "translate(-50%, -50%) scale(1.35)", opacity: 0 },
        },
      }}
    >
      <Tooltip title="Initiate Fund Request">
        <Button
          onClick={() => navigate("/initiate")}
          aria-label="Initiate fund request"
          sx={{
            position: "relative",
            minWidth: 64,
            height: 64,
            px: 0,
            borderRadius: 4,
            color: "#fff",
            fontWeight: 800,
            background: "linear-gradient(135deg,#FF7A00 0%,#FFB020 100%)",
            // FIXED: removed stray backtick
            boxShadow: "0 10px 22px rgba(255,122,0,0.35), inset 0 1px 0 rgba(255,255,255,0.32)",
            transition: "transform 160ms ease, box-shadow 160ms ease",
            animation: "breathe 2.4s ease-in-out infinite",
            "&:hover": {
              transform: "translateY(-1px) scale(1.02)",
              boxShadow: "0 14px 28px rgba(255,122,0,0.42), inset 0 1px 0 rgba(255,255,255,0.36)",
            },
            "&:active": { transform: "translateY(0) scale(0.98)" },
            "&::before": {
              content: '""',
              position: "absolute",
              inset: -8,
              borderRadius: "inherit",
              background: "radial-gradient(closest-side, rgba(255,122,0,.35), transparent)",
              filter: "blur(8px)",
              pointerEvents: "none",
            },
          }}
        >
          <AddRounded sx={{ fontSize: 30 }} />
        </Button>
      </Tooltip>

      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 64,
          height: 64,
          borderRadius: 4,
          pointerEvents: "none",
          "&::before, &::after": {
            content: '""',
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "100%",
            height: "100%",
            borderRadius: 4,
            border: "2px solid rgba(255,122,0,.35)",
            transform: "translate(-50%, -50%)",
            animation: "wave 2.4s ease-out infinite",
          },
          "&::after": { animationDelay: "1.2s" },
        }}
      />
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────
function DashboardPageInner() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [raw, setRaw] = useState({ assigned: [], initiated: [] });

  const [tab, setTab] = useState(0); // 0=Initiated, 1=Assigned
  const [dept, setDept] = useState("all");

  // SmartDataTable state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(30);
  const [sortModel, setSortModel] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Trail dialog state
  const [trailFor, setTrailFor] = useState(null);
  const [trail, setTrail] = useState(null);
  const [trailErr, setTrailErr] = useState("");
  const [trailLoading, setTrailLoading] = useState(false);

  const navigate = useNavigate();

  // Display name
  const displayName = useMemo(() => {
    const cached =
      localStorage.getItem("userName") ||
      localStorage.getItem("username") ||
      localStorage.getItem("name") ||
      localStorage.getItem("fullName");
    if (cached) return cached.includes("@") ? prettyNameFromEmail(cached) || cached : cached;
    const claims = getJwtPayload();
    const picked = pickDisplayName(claims);
    return picked ? (picked.includes("@") ? prettyNameFromEmail(picked) || picked : picked) : localStorage.getItem("role") || "User";
  }, []);

  // Load dashboard
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const token = localStorage.getItem("token");
        const res = await fetch("/api/fundrequests/dashboard", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`Dashboard API ${res.status}`);
        const json = await res.json();
        if (on) setRaw(json || { assigned: [], initiated: [] });
      } catch (e) {
        if (on) setErr(e?.message || "Failed to load dashboard.");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, []);

  // Normalize per tab
  const dataInitiated = useMemo(() => (raw.initiated || []).map(normalizeInitiated), [raw]);
  const dataAssigned = useMemo(() => (raw.assigned || []).map(normalizeAssigned), [raw]);

  // Derived KPI
  const kpis = useMemo(() => {
    const initiated = dataInitiated;
    const assigned = dataAssigned;
    const approved = initiated.filter((x) => /^approved$/i.test(x.status)).length;
    const rejected = initiated.filter((x) => /^rejected$/i.test(x.status)).length;
    const sentback = initiated.filter((x) => /sent/i.test(x.status)).length;
    return [
      { label: "Assigned", value: assigned.length, icon: <AssignmentIndRounded sx={{ fontSize: 26 }} />, accent: BRAND.bannerStart },
      { label: "Initiated", value: initiated.length, icon: <OutboxRounded sx={{ fontSize: 26 }} />, accent: "#7C3AED" },
      { label: "Approved", value: approved, icon: <CheckCircleRounded sx={{ fontSize: 26 }} />, accent: "#059669" },
      { label: "Sent Back", value: sentback, icon: <AutorenewRounded sx={{ fontSize: 26 }} />, accent: "#D97706" },
      { label: "Rejected", value: rejected, icon: <HighlightOffRounded sx={{ fontSize: 26 }} />, accent: "#DC2626" },
    ];
  }, [dataInitiated, dataAssigned]);

   const handleKpiClick = useCallback(
    (label) => {
      if (loading) return;
      setTab(label === "Assigned" ? 1 : 0);
    },
    [loading, setTab]
  );
  // Department options
  const deptOptions = useMemo(() => {
    const src = tab === 0 ? dataInitiated : dataAssigned;
    return ["all", ...Array.from(new Set(src.map((x) => x.departmentName).filter(Boolean)))];
  }, [tab, dataInitiated, dataAssigned]);

  // Filter/search/status
  const filtered = useMemo(() => {
    const src = tab === 0 ? dataInitiated : dataAssigned;
    const q = search.trim().toLowerCase();

    return src.filter((r) => {
      const matchDept = dept === "all" || String(r.departmentName || "").toLowerCase() === String(dept).toLowerCase();
      const matchText =
        !q ||
        String(r.id ?? "").toLowerCase().includes(q) ||
        (r.title || "").toLowerCase().includes(q) ||
        (r.workflowName || "").toLowerCase().includes(q) ||
        (r.departmentName || "").toLowerCase().includes(q) ||
        (r.initiatedBy || "").toLowerCase().includes(q);
      const matchStatus = !statusFilter || showStatus(r.status) === statusFilter;
      return matchDept && matchText && matchStatus;
    });
  }, [tab, dataInitiated, dataAssigned, dept, search, statusFilter]);

  // Sort (client-side)
  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (!sortModel[0]) {
      return arr.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    const { field, sort } = sortModel[0];
    const dir = sort === "desc" ? -1 : 1;
    const get = (r) => {
      if (field === "id") return Number(r.id || 0);
      if (field === "title") return r.title || "";
      if (field === "workflowName") return r.workflowName || "";
      if (field === "initiatedBy") return r.initiatedBy || "";
      if (field === "createdAt" || field === "lastActionAt" || field === "neededBy")
        return new Date(r[field] || 0).getTime();
      if (field === "status") return showStatus(r.status);
      return r[field];
    };
    return arr.sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      return va > vb ? dir : va < vb ? -dir : 0;
    });
  }, [filtered, sortModel]);

  // Page slice
  const paged = useMemo(() => {
    const start = page * rowsPerPage;
    return sorted.slice(start, start + rowsPerPage);
  }, [sorted, page, rowsPerPage]);

  // Reset page on filters/tab/size change
  useEffect(() => setPage(0), [tab, dept, search, statusFilter, rowsPerPage]);

  // Status options
  const statusOptions = useMemo(() => {
    const src = tab === 0 ? dataInitiated : dataAssigned;
    const set = new Set(src.map((r) => showStatus(r.status)));
    ["Pending", "InProgress", "Sent Back", "Approved", "Rejected"].forEach((x) => set.add(x));
    return Array.from(set);
  }, [tab, dataInitiated, dataAssigned]);

  // Trail loader
  const fetchTrail = async (id) => {
    const token = localStorage.getItem("token");
    const hdrs = token ? { Authorization: `Bearer ${token}` } : {};
    const tryUrls = [
      `/api/approvals/${id}/trail`,
      `/api/approvals/${id}/path`,
      `/api/fundrequests/${id}/trail`,
      `/api/fundrequests/${id}/path`,
    ];
    for (const url of tryUrls) {
      const res = await fetch(url, { headers: hdrs });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) return { steps: json, requestStatus: "—" };
        return json || null;
      }
    }
    throw new Error("Trail API not found");
  };

  const openTrail = async (row) => {
    const id = row.approvalId ?? row.id ?? row.fundRequestId;
    setTrailFor(id);
    setTrailErr("");
    setTrailLoading(true);
    try {
      const data = await fetchTrail(encodeURIComponent(id));
      setTrail(data);
    } catch (e) {
      setTrail({ steps: [], requestStatus: "—" });
      setTrailErr(e?.message || "Failed to load trail");
    } finally {
      setTrailLoading(false);
    }
  };

  // Columns builder
  const columns = useMemo(
    () =>
      buildDashboardColumns({
        mode: tab === 0 ? "initiated" : "assigned",
        onOpenTrail: openTrail,
        fmtDate,
        showStatus,
        statusChip,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tab]
  );

  const totalFilters = (dept !== "all" ? 1 : 0) + (search ? 1 : 0) + (statusFilter ? 1 : 0);

  return (
    <Box sx={{ minHeight: UI.page.minH, bgcolor: "transparent" }}>
      <Box sx={{ px: { xs: 1.5, md: 2 }, pt: { xs: 2, md: 3 }, width: "100%" }}>
        <Box sx={{ width: "100%", ml: 0, mr: 0 }}>
          <Box sx={{ color: BRAND.bannerText, pb: 2 }}>
            <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>
              {`Hello, ${displayName}`}
            </Typography>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(5, 1fr)" },
                gap: { xs: 1.5, md: 2.5 },
                width: "100%",
              }}
            >
              {(loading ? Array.from({ length: 5 }) : kpis).map((k, i) => {
                if (loading || !k) {
                  return (
                    <Paper
                      key={i}
                      elevation={0}
                      sx={{
                        minHeight: UI.kpi.minH,
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        p: 2,
                        borderRadius: 0.3,
                        bgcolor: "#fff",
                        color: "#0B1324",
                        border: `1px solid ${BRAND.cardBorder}`,
                        transition: "transform 180ms ease, box-shadow 180ms ease",
                        "&:hover": {
                          transform: "translateY(-2px)",
                          boxShadow: "0 10px 24px rgba(14,103,179,0.18)",
                        },
                        width: "100%",
                        cursor: "default",
                      }}
                    >
                      <Skeleton variant="circular" width={UI.kpi.iconBox} height={UI.kpi.iconBox} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton width="40%" height={15} sx={{ mb: 1 }} />
                        <Skeleton width="60%" height={22} />
                      </Box>
                    </Paper>
                  );
                }

                return (
                  <Paper
                    key={k.label}
                    elevation={0}
                    component={ButtonBase}
                    onClick={() => handleKpiClick(k.label)}
                    type="button"
                    focusRipple
                    role="button"
                    aria-label={`View ${k.label} approvals`}
                    sx={{
                      minHeight: UI.kpi.minH,
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      p: 2,
                      borderRadius: 0.3,
                      bgcolor: "#fff",
                      color: "#0B1324",
                      border: `1px solid ${BRAND.cardBorder}`,
                      transition: "transform 180ms ease, box-shadow 180ms ease",
                      "&:hover": {
                        transform: "translateY(-2px)",
                        boxShadow: "0 10px 24px rgba(14,103,179,0.18)",
                      },
                      width: "100%",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <Box
                      sx={{
                        width: UI.kpi.iconBox,
                        height: UI.kpi.iconBox,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        background: `linear-gradient(135deg, ${alpha(k.accent, 0.14)}, ${alpha(k.accent, 0.22)})`,
                        color: k.accent,
                        // FIXED: removed stray backtick
                        boxShadow:
                          "inset 0 0 0 1px rgba(255,255,255,0.65), 0 6px 14px rgba(14,103,179,0.16)",
                        flexShrink: 0,
                      }}
                    >
                      {k.icon}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="caption" sx={{ color: alpha("#000", 0.65) }}>
                        {k.label}
                      </Typography>
                      <Typography variant="h5" fontWeight={900} sx={{ lineHeight: 1.1 }}>
                        {k.value}
                      </Typography>
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          </Box>

          <Paper
            elevation={0}
            sx={{
              p: { xs: 1.5, md: 2 },
              border: `1px solid ${BRAND.cardBorder}`,
              borderRadius: 0.3,
              bgcolor: "#fff",
              mt: 2,
              boxShadow: "0 8px 24px rgba(2, 6, 23, 0.06)",
              width: "100%",
            }}
          >
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              sx={{
                minHeight: 40,
                "& .MuiTab-root": { textTransform: "none", fontWeight: 700, minHeight: 40 },
                "& .MuiTabs-indicator": { height: 3, bgcolor: BRAND.bannerStart },
              }}
            >
              <Tab label={`Initiated Approvals (${dataInitiated.length})`} />
              <Tab label={`Assigned Approvals (${dataAssigned.length})`} />
            </Tabs>

            <Divider sx={{ my: 1 }} />

            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              alignItems={{ xs: "stretch", md: "center" }}
              justifyContent="space-between"
              sx={{ mb: 1 }}
            >
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Select size="small" value={dept} onChange={(e) => setDept(e.target.value)} sx={{ minWidth: 220 }}>
                  {deptOptions.map((d) => (
                    <MenuItem key={d} value={d}>
                      {d === "all" ? "All Departments" : d}
                    </MenuItem>
                  ))}
                </Select>

                <Badge color="primary" badgeContent={totalFilters || 0} invisible={totalFilters === 0}>
                  <Typography variant="body2" color="text.secondary">
                    Filters
                  </Typography>
                </Badge>

                {err ? (
                  <Alert severity="error" sx={{ ml: 2 }}>
                    {err}
                  </Alert>
                ) : null}
              </Stack>

              <Stack direction="row" alignItems="center" spacing={1}>
                <Button
                  onClick={() => {
                    setDept("all");
                    setSearch("");
                    setStatusFilter("");
                  }}
                >
                  Clear filters
                </Button>
              </Stack>
            </Stack>

            <SmartDataTable
              columns={columns}
              rows={paged}
              total={sorted.length}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={setPage}
              onRowsPerPageChange={(n) => {
                setRowsPerPage(n);
                setPage(0);
              }}
              sortModel={sortModel}
              onSortModelChange={setSortModel}
              loading={loading}
              searchable
              searchText={search}
              onSearchTextChange={setSearch}
              statusOptions={statusOptions}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              exportFilename={`approvals_${tab === 0 ? "initiated" : "assigned"}.csv`}
              dense
            />
          </Paper>
        </Box>
      </Box>

      <InitiateLauncher />

      <ApprovalPathDialog
        open={!!trailFor}
        onClose={() => {
          setTrailFor(null);
          setTrail(null);
          setTrailErr("");
        }}
        trail={
          trailLoading
            ? { requestStatus: "Loading…", steps: [] }
            : trail || { requestStatus: trailErr ? `Error: ${trailErr}` : "—", steps: [] }
        }
      />
    </Box>
  );
}

export default function DashboardPage(props) {
  return <DashboardPageInner {...props} />;
}
