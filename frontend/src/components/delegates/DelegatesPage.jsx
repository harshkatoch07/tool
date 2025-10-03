// src/components/delegates/DelegatesPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Paper,
  Chip,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Snackbar,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Collapse,
  Checkbox,
  Menu,
  MenuItem,
  Divider,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ShieldMoonIcon from "@mui/icons-material/ShieldMoon";
import CloseIcon from "@mui/icons-material/Close";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { useNavigate } from "react-router-dom";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import api from "../../services/api";
import SmartDataTable from "../../ui/SmartDataTable";

const MAX_DAYS = 30;

// ─────────────────────────────────────────────────────────────
// Classic (first screenshot) skin tokens
// ─────────────────────────────────────────────────────────────
const CLASSIC = {
  pageBg: "#EFF2F6",
  headerStart: "#0E67B3",
  headerEnd: "#16A0CF",
  cardBorder: "#E3E7ED",
  headerHeight: 64,
};

// Square everything (no rounded “pills”)
const squareControls = {
  "& .MuiOutlinedInput-root": { borderRadius: 0.75 },
  "& .MuiButton-root": { borderRadius: 0.75 },
  "& .MuiChip-root": { borderRadius: 0.75 },
};

// ----- time helpers
function nowLocalISO(minutesFromNow = 0) {
  const d = new Date(Date.now() + minutesFromNow * 60_000);
  d.setSeconds(0, 0);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
}
function localInputToUtcIso(localStr) {
  return new Date(localStr).toISOString();
}
function utcToLocalString(utcIso) {
  try {
    return new Date(utcIso).toLocaleString();
  } catch {
    return utcIso ?? "—";
  }
}

// Small helper: colored status chip
function StatusChip({ status }) {
  const color =
    status === "Active" ? "success" : status === "Scheduled" ? "info" : "default";
  return <Chip size="small" label={status} color={color} />;
}

export default function DelegationPage() {
  const navigate = useNavigate();

  // Form state
  const [delegatee, setDelegatee] = useState(null);
  const [starts, setStarts] = useState(nowLocalISO(15));
  const [ends, setEnds] = useState(nowLocalISO(60 * 24));
  const [reason, setReason] = useState("");

  // Users (autocomplete)
  const [userOptions, setUserOptions] = useState([]); // [{id, fullName, email}]
  const [userLoading, setUserLoading] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const debounceRef = useRef(null);

  // Data
  const [delegations, setDelegations] = useState([]);
  const [loading, setLoading] = useState(false);

  // UI state
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });
  const [loadError, setLoadError] = useState("");
  const [confirmId, setConfirmId] = useState(null);

  // Bulk delete & selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  // Filters (classic toolbar)
  const [filterOpen, setFilterOpen] = useState(false);
  const [anchorFilter, setAnchorFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");        // "", "Active", "Scheduled", "Expired / Revoked"
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Table UI state (client-side)
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(30);
  const [search, setSearch] = useState("");
  const [sortModel, setSortModel] = useState([]);

  // ----- duration validation
  const durationDays = useMemo(() => {
    if (!starts || !ends) return 0;
    const s = new Date(starts);
    const e = new Date(ends);
    return Math.max(0, Math.round((e - s) / (1000 * 60 * 60 * 24)));
  }, [starts, ends]);

  const isValid =
    !!delegatee &&
    starts &&
    ends &&
    new Date(ends) >= new Date(starts) &&
    durationDays <= MAX_DAYS;

  // ----- user search (debounced)
  useEffect(() => {
    const fetchUsers = async (q) => {
      if (!q) {
        setUserOptions([]);
        return;
      }
      try {
        setUserLoading(true);
        const res = await api.get(`/admin/users/lookup`, {
          params: { q, top: 20, onlyActive: false },
        });
        const data = (res.data ?? []).map((u) => ({
          id: u.id ?? u.userId ?? u.Id,
          fullName:
            u.fullName ?? u.name ?? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim(),
          email: u.email ?? u.userName ?? u.username,
        }));
        setUserOptions(data);
      } catch {
        setUserOptions([]);
      } finally {
        setUserLoading(false);
      }
    };

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchUsers(userQuery.trim());
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [userQuery]);

  // ----- load delegations
  const fetchDelegations = async () => {
    try {
      setLoading(true);
      setLoadError("");
      const res = await api.get(`/delegations/my`);
      const list = (res.data ?? []).map((d) => ({
        id: d.id ?? d.delegationId ?? d.Id,
        delegateeId: d.delegateeId ?? d.userId ?? d.UserId,
        delegateeName: d.delegateeName ?? d.fullName ?? d.FullName ?? "—",
        delegateeEmail: d.delegateeEmail ?? d.email ?? d.Email ?? null,
        startsUtc: d.starts ?? d.startUtc ?? d.StartsUtc ?? d.startsUtc,
        endsUtc: d.ends ?? d.endUtc ?? d.EndsUtc ?? d.endsUtc,
        reason: d.reason ?? d.Reason ?? "—",
      }));
      setDelegations(list);
      setSelectedIds(new Set()); // reset selection on reload
    } catch {
      setLoadError("Could not load delegations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDelegations();
  }, []);

  // ----- derive table rows with status
  const derivedWithStatus = useMemo(() => {
    const now = new Date();
    return delegations.map((d) => {
      const startsDate = new Date(d.startsUtc);
      const endsDate = new Date(d.endsUtc);
      let status = "Expired / Revoked";
      if (startsDate > now) status = "Scheduled";
      else if (endsDate >= now) status = "Active";
      return { ...d, status };
    });
  }, [delegations]);

  // Search + filters
  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    return derivedWithStatus.filter((r) => {
      const textMatch =
        !q ||
        [r.delegateeName, r.delegateeEmail, r.reason, r.status]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const statusMatch = !statusFilter || r.status === statusFilter;
      const fromMatch = !dateFrom || new Date(r.startsUtc) >= new Date(dateFrom);
      const toMatch = !dateTo || new Date(r.endsUtc) <= new Date(dateTo);
      return textMatch && statusMatch && fromMatch && toMatch;
    });
  }, [derivedWithStatus, search, statusFilter, dateFrom, dateTo]);

  // Sorting (client-side)
  const sorted = useMemo(() => {
    if (!sortModel[0]) {
      const rank = { Active: 0, Scheduled: 1, "Expired / Revoked": 2 };
      return [...filtered].sort((a, b) => {
        const sr = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
        if (sr !== 0) return sr;
        return new Date(b.startsUtc) - new Date(a.startsUtc);
      });
    }
    const { field, sort } = sortModel[0];
    const dir = sort === "desc" ? -1 : 1;
    const get = (row) => {
      if (field === "delegatee") return `${row.delegateeName} ${row.delegateeEmail || ""}`;
      if (field === "startsUtc" || field === "endsUtc") return new Date(row[field]).getTime();
      return row[field];
    };
    return [...filtered].sort((a, b) => {
      const va = get(a), vb = get(b);
      return va > vb ? dir : va < vb ? -dir : 0;
    });
  }, [filtered, sortModel]);

  // Pagination (client-side)
  const paged = useMemo(() => {
    const s = page * rowsPerPage;
    return sorted.slice(s, s + rowsPerPage);
  }, [sorted, page, rowsPerPage]);

  // Selection helpers
  const onToggleRow = (id, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const allOnPageSelected = paged.length > 0 && paged.every((r) => selectedIds.has(r.id));
  const toggleSelectAllOnPage = (checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      paged.forEach((r) => (checked ? next.add(r.id) : next.delete(r.id)));
      return next;
    });
  };

  // Columns for SmartDataTable (classic look: left checkbox + standard cells)
  const columns = useMemo(
    () => [
      {
        field: "Select",
        headerName: "",
        minWidth: 52,
        align: "center",
        headerAlign: "center",
        sortable: false,
        render: (r) => (
          <Checkbox
            size="small"
            checked={selectedIds.has(r.id)}
            onChange={(e) => onToggleRow(r.id, e.target.checked)}
            inputProps={{ "aria-label": "select row" }}
          />
        ),
      },
      {
        field: "status",
        headerName: "Delegation Status",
        minWidth: 160,
        valueGetter: (r) => r.status,
        render: (r) => <StatusChip status={r.status} />,
      },
      {
        field: "delegatee",
        headerName: "Delegatee User",
        minWidth: 240,
        sortable: true,
        render: (r) => (
          <Stack spacing={0.3}>
            <Typography variant="body2" fontWeight={600}>
              {r.delegateeName}
            </Typography>
            {r.delegateeEmail && (
              <Typography variant="caption" color="text.secondary" display="block">
                {r.delegateeEmail}
              </Typography>
            )}
          </Stack>
        ),
        valueGetter: (r) => `${r.delegateeName} ${r.delegateeEmail || ""}`,
      },
      {
        field: "startsUtc",
        headerName: "Start Date",
        minWidth: 180,
        render: (r) => utcToLocalString(r.startsUtc),
        valueGetter: (r) => new Date(r.startsUtc).getTime(),
      },
      {
        field: "endsUtc",
        headerName: "End Date",
        minWidth: 180,
        render: (r) => utcToLocalString(r.endsUtc),
        valueGetter: (r) => new Date(r.endsUtc).getTime(),
      },
      { field: "reason", headerName: "Delegation Reason", minWidth: 240 },
      {
        field: "__actions",
        headerName: "Actions",
        minWidth: 110,
        align: "right",
        headerAlign: "right",
        sortable: false,
        render: (row) => (
          <Tooltip
            title={row.status === "Expired / Revoked" ? "Already ended" : "Remove Delegation"}
          >
            <span>
              <IconButton
                color="error"
                onClick={() => setConfirmId(row.id)}
                size="small"
                disabled={row.status === "Expired / Revoked"}
                aria-label="remove delegation"
              >
                <DeleteForeverIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        ),
      },
    ],
    [selectedIds]
  );

  // ----- create delegation
  const handleCreate = async () => {
    if (!isValid) {
      setSnack({ open: true, message: "Please fix the form errors.", severity: "warning" });
      return;
    }

    const optimistic = {
      id: `tmp-${crypto.randomUUID()}`,
      delegateeId: delegatee.id,
      delegateeName: delegatee.fullName || "—",
      delegateeEmail: delegatee.email || null,
      startsUtc: localInputToUtcIso(starts),
      endsUtc: localInputToUtcIso(ends),
      reason: reason || "—",
    };
    setDelegations((prev) => [optimistic, ...prev]);

    try {
      const res = await api.post(`/delegations`, {
        delegateeId: delegatee.id,
        starts: optimistic.startsUtc,
        ends: optimistic.endsUtc,
        reason: reason || null,
      });
      const saved = res.data;
      const mapped = {
        id: saved.id ?? saved.delegationId ?? saved.Id,
        delegateeId: saved.delegateeId ?? saved.userId ?? saved.UserId ?? delegatee.id,
        delegateeName:
          saved.delegateeName ?? saved.fullName ?? saved.FullName ?? optimistic.delegateeName,
        delegateeEmail:
          saved.delegateeEmail ?? saved.email ?? saved.Email ?? optimistic.delegateeEmail,
        startsUtc: saved.starts ?? saved.startUtc ?? saved.StartsUtc ?? optimistic.startsUtc,
        endsUtc: saved.ends ?? saved.endUtc ?? saved.EndsUtc ?? optimistic.endsUtc,
        reason: saved.reason ?? optimistic.reason,
      };
      setDelegations((prev) => [mapped, ...prev.filter((x) => x.id !== optimistic.id)]);
      setSnack({ open: true, message: "Delegation created.", severity: "success" });

      // reset form
      setDelegatee(null);
      setStarts(nowLocalISO(15));
      setEnds(nowLocalISO(60 * 24));
      setReason("");
    } catch {
      setDelegations((prev) => prev.filter((x) => x.id !== optimistic.id));
      setSnack({ open: true, message: "Create failed.", severity: "error" });
    }
  };

  // ----- delete (single)
  const deleteRow = async (id) => {
    const prev = delegations;
    setDelegations(prev.filter((x) => x.id !== id));
    try {
      await api.delete(`/delegations/${id}`);
      setSnack({ open: true, message: "Delegation removed.", severity: "success" });
      setSelectedIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    } catch {
      setDelegations(prev); // rollback
      setSnack({ open: true, message: "Delete failed.", severity: "error" });
    }
  };

  // ----- delete (bulk)
  const deleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkOpen(false);
    for (const id of ids) {
      // sequential—keeps optimistic UI simple
      // (you can parallelize later if you prefer)
      // eslint-disable-next-line no-await-in-loop
      await deleteRow(id);
    }
  };

  const handleRefresh = async () => {
    await fetchDelegations();
    setSnack({ open: true, message: "Delegations refreshed.", severity: "info" });
  };

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        bgcolor: "transparent",
       
        ...squareControls,
      }}
    >
      {/* Classic thin header bar */}
     <Box sx={{ mb: 2, display: "flex",  lignItems: "center", justifyContent: "space-between" }}>
  <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
    <IconButton onClick={() => navigate(-1)} sx={{ color: "common.white", p: 0.5 }}>
      <ArrowBackIosNewRoundedIcon />
    </IconButton>
    <Typography variant="h6" fontWeight={700} sx={{ color: "common.white" }}>
      Delegate Approvals
    </Typography>
  </Box>
</Box>



      {/* Main card like reference */}
      <Paper
        variant="outlined"
        sx={{
          borderColor: CLASSIC.cardBorder,
          p: { xs: 2, md: 3 },
          bgcolor: "#fff",
        }}
      >
        {/* Toolbar row: FILTER + Delete Selected + search */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              variant="outlined"
              startIcon={<FilterListRoundedIcon />}
              endIcon={<ExpandMoreRoundedIcon />}
              onClick={(e) => setAnchorFilter(e.currentTarget)}
            >
              FILTER
            </Button>

            <Button
              variant="contained"
              color="primary"
              startIcon={<DeleteForeverIcon />}
              disabled={selectedIds.size === 0}
              onClick={() => setBulkOpen(true)}
            >
              Delete Selected Delegation
            </Button>

            <Checkbox
              checked={allOnPageSelected}
              onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
              sx={{ ml: 1 }}
            />
            <Typography variant="body2">Select All</Typography>
          </Stack>

          <TextField
            size="small"
            placeholder="Search..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSearch("");
                      setPage(0);
                    }}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{ width: 300, alignSelf: { xs: "flex-start", sm: "center" } }}
          />
        </Stack>

        {/* Table */}
        <Paper
          variant="outlined"
          sx={{
            borderColor: CLASSIC.cardBorder,
            mb: 3,
            p: 0,
            overflow: "hidden",
          }}
        >
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
            searchable={false}
            getRowId={(r) => r.id}
            exportFilename="delegations.csv"
            dense
          />
        </Paper>

        {/* Form row (inline, uniform sizing) */}
<Box>
  <Grid container spacing={2} alignItems="flex-end">
    {/* Delegate User */}
    <Grid item xs={12} md={12}>   {/* was md={5} */}
  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
    Delegate User <span style={{ color: "#c1121f" }}>*</span>
  </Typography>
  <Autocomplete
    value={delegatee}
    onChange={(_, v) => setDelegatee(v)}
    loading={userLoading}
    options={userOptions}
    getOptionLabel={(opt) =>
      opt ? `${opt.fullName ?? "User"}${opt.email ? ` (${opt.email})` : ""}` : ""
    }
    onInputChange={(_, v) => setUserQuery(v)}
    filterOptions={(x) => x}
    renderInput={(params) => (
      <TextField
        {...params}
        size="small"
        fullWidth
        placeholder="Search name or email…"
        required
        InputProps={{
          ...params.InputProps,
          endAdornment: (
            <>
              {userLoading ? <CircularProgress size={180} /> : null}
              {params.InputProps.endAdornment}
            </>
          ),
        }}
      />
    )}
    noOptionsText={userQuery ? "No users found" : "Type to search users"}
    isOptionEqualToValue={(o, v) => o.id === v.id}
  />
</Grid>


    {/* Start Date */}
    <Grid item xs={12} md={3}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        Start Date <span style={{ color: "#c1121f" }}>*</span>
      </Typography>
      <TextField
        type="datetime-local"
        size="small"                             // <-- uniform height
        fullWidth
        value={starts}
        onChange={(e) => {
          const v = e.target.value;
          setStarts(v);
          if (new Date(ends) < new Date(v)) setEnds(v);
        }}
        inputProps={{ min: nowLocalISO() }}
        required
      />
    </Grid>

    {/* End Date */}
    <Grid item xs={12} md={3}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        End Date <span style={{ color: "#c1121f" }}>*</span>
      </Typography>
      <TextField
        type="datetime-local"
        size="small"                             // <-- uniform height
        fullWidth
        value={ends}
        onChange={(e) => setEnds(e.target.value)}
        inputProps={{ min: starts || nowLocalISO() }}
        required
        error={durationDays > MAX_DAYS}
        helperText={durationDays > MAX_DAYS ? `Max duration is ${MAX_DAYS} days.` : ""}
      />
    </Grid>

    {/* Reason */}
    <Grid item xs={12} md={2}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        Delegation Reason <span style={{ color: "#c1121f" }}>*</span>
      </Typography>
      <TextField
        size="small"                             // <-- uniform height
        fullWidth
        placeholder="Select / type…"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
    </Grid>

    {/* Assign button */}
    <Grid item xs={12} md={1} sx={{ display: "flex", alignItems: "flex-end" }}>
      <Button
        fullWidth
        variant="contained"
        color="success"
        onClick={handleCreate}
        disabled={!isValid}
      >
        Assign
      </Button>
    </Grid>
  </Grid>

  {/* Reset row with 'Selected: X days' non-interactive button */}
  <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }} alignItems="center">
    <Button
      size="small"
      variant="outlined"
      onClick={() => {
        setDelegatee(null);
        setStarts(nowLocalISO(15));
        setEnds(nowLocalISO(60 * 24));
        setReason("");
      }}
    >
      Reset
    </Button>

    {durationDays > 0 && (
      <Button
        size="small"
        variant="outlined"
        tabIndex={-1}
        disableRipple
        aria-disabled="true"
        sx={{ pointerEvents: "none" }}          // <-- looks like a button, not clickable
      >
        Selected: {durationDays} day{durationDays === 1 ? "" : "s"}
      </Button>
    )}

    <IconButton onClick={handleRefresh} aria-label="refresh list" size="small">
      <RefreshIcon fontSize="small" />
    </IconButton>
  </Stack>
</Box>

      </Paper>

      {/* FILTER popover (status + date range) */}
      <Menu
        anchorEl={anchorFilter}
        open={Boolean(anchorFilter)}
        onClose={() => setAnchorFilter(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 2, width: 320 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Filters
          </Typography>
          <Stack spacing={1.5}>
            <TextField
              select
              size="small"
              label="Delegation Status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="Scheduled">Scheduled</MenuItem>
              <MenuItem value="Expired / Revoked">Expired / Revoked</MenuItem>
            </TextField>

            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="Start Date (from)"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(0);
                }}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1 }}
              />
              <TextField
                size="small"
                label="End Date (to)"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(0);
                }}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1 }}
              />
            </Stack>

            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="contained"
                onClick={() => setAnchorFilter(null)}
              >
                Apply
              </Button>
              <Button
                size="small"
                variant="text"
                onClick={() => {
                  setStatusFilter("");
                  setDateFrom("");
                  setDateTo("");
                  setPage(0);
                }}
              >
                Clear
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Menu>

      {/* Delete confirmation (single) */}
      <Dialog open={!!confirmId} onClose={() => setConfirmId(null)}>
        <DialogTitle>Remove delegation?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This will immediately revoke the selected delegation. You can create a new one anytime.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmId(null)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={async () => {
              const id = confirmId;
              setConfirmId(null);
              await deleteRow(id);
            }}
            color="error"
            variant="contained"
            startIcon={<DeleteForeverIcon />}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation (bulk) */}
      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)}>
        <DialogTitle>Delete selected delegations?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            You’re about to delete {selectedIds.size} item(s).
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={deleteSelected}
            color="error"
            variant="contained"
            startIcon={<DeleteForeverIcon />}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
