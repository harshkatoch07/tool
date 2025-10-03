// src/components/admin/RecentActivities.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  Divider,
  CircularProgress,
  Drawer,
  Stack,
  Pagination, // ⬅️ added
} from "@mui/material";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { getRecentActivities, getFundRequestDetails } from "../../api/adminApi";

dayjs.extend(relativeTime);

const PAGE_SIZE = 5; // ⬅️ lock to 10 per your requirement

export default function RecentActivities() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);

  // pagination
  const [page, setPage] = useState(1); // 1-based for MUI <Pagination />

  // Drawer + details
  const [open, setOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await getRecentActivities(100); // fetch more; we paginate locally
        if (mounted) {
          setActivities(Array.isArray(data) ? data : []);
          setPage(1); // reset to first page whenever data refreshes
        }
      } catch {
        if (mounted) {
          setActivities([]);
          setPage(1);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  // clamp page if the count shrinks (e.g., after refresh)
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil((activities?.length || 0) / PAGE_SIZE));
    if (page > maxPage) setPage(maxPage);
  }, [activities, page]);

  const empty = !loading && (!activities || activities.length === 0);

  // slice current page (1-based)
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return activities.slice(start, start + PAGE_SIZE);
  }, [activities, page]);

  // Unique + stable-ish key to kill the warnings about dup keys
  const safeKey = (a, idx) => {
    const id = a?.fundRequestId ?? a?.requestId ?? a?.id ?? "na";
    const action = a?.action ?? a?.status ?? a?.type ?? "event";
    const when = a?.at ?? a?.createdAt ?? a?.actionedAt ?? a?.timestamp ?? idx;
    return `${id}-${action}-${when}-${idx}`;
  };

  const prettyWhen = (a) => {
    const raw = a?.at ?? a?.createdAt ?? a?.actionedAt ?? a?.timestamp;
    if (!raw) return "—";
    const d = dayjs(raw);
    return `${d.fromNow()} • ${d.format("DD MMM YYYY, HH:mm")}`;
  };

  const statusChipColor = (status) => {
    const s = (status || "").toLowerCase();
    if (s.includes("reject")) return "error";
    if (s.includes("approve")) return "success";
    if (s.includes("pending")) return "warning";
    if (s.includes("send") || s.includes("back")) return "info";
    return "default";
  };

  const handleOpenDetails = async (a) => {
    const id = a?.fundRequestId ?? a?.requestId ?? a?.id;
    setOpen(true);

    if (!id) {
      setDetails({
        error: true,
        message: "This activity has no linked Fund Request ID.",
        activity: a,
      });
      return;
    }

    try {
      setDetailsLoading(true);
      const data = await getFundRequestDetails(id);
      setDetails({ error: false, data });
    } catch (e) {
      setDetails({
        error: true,
        message: "Failed to load fund request details.",
        activity: a,
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  const header = (
    <Box
      sx={{
        px: 2,
        py: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background:
          "linear-gradient(135deg, rgba(24,119,201,0.08), rgba(38,52,74,0.06))",
        borderRadius: 2,
      }}
    >
      <Typography component="h2" variant="h6" sx={{ fontWeight: 800, color: "#26344a" }}>
        Recent Activities
      </Typography>
      <Chip
        label={`${activities?.length ?? 0}`}
        color="primary"
        variant="outlined"
        sx={{ fontWeight: 700 }}
      />
    </Box>
  );

  return (
    <Box
      sx={{
        background:
          "linear-gradient(120deg, #eef4fb 0%, #f7f9fc 50%, #eef3f8 100%)",
        borderRadius: 2,
        p: 2,
        boxShadow: "0 6px 18px rgba(24,119,201,0.08)",
      }}
    >
      {header}

      <Divider sx={{ my: 2 }} />

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : empty ? (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <Typography variant="body1" color="text.secondary">
            No recent activity yet.
          </Typography>
        </Box>
      ) : (
        <>
          <List disablePadding>
            {paged.map((a, idx) => {
              const title =
                a?.title ??
                a?.requestTitle ??
                `Request #${a?.fundRequestId ?? a?.requestId ?? "—"}`;
              const status = a?.status ?? a?.action ?? a?.type ?? "Event";
              const who =
                a?.by ??
                a?.performedBy ??
                a?.user ??
                a?.actor ??
                a?.initiator ??
                "Unknown";

              return (
                <React.Fragment key={safeKey(a, idx)}>
                  <ListItem disablePadding>
                    <ListItemButton onClick={() => handleOpenDetails(a)}>
                      <ListItemText
                        primary={
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            useFlexGap
                            flexWrap="wrap"
                          >
                            <Typography
                              component="span"
                              variant="subtitle1"
                              sx={{ fontWeight: 700, color: "#26344a" }}
                            >
                              {title}
                            </Typography>
                            <Chip
                              size="small"
                              label={status}
                              color={statusChipColor(status)}
                              sx={{ fontWeight: 700 }}
                            />
                          </Stack>
                        }
                        secondary={
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1.5}
                            divider={
                              <Divider
                                orientation="vertical"
                                flexItem
                                sx={{ display: { xs: "none", sm: "block" } }}
                              />
                            }
                          >
                            <Typography component="span" variant="body2" color="text.secondary">
                              {prettyWhen(a)}
                            </Typography>
                            <Typography component="span" variant="body2" color="text.secondary">
                              By: {who}
                            </Typography>
                            <Typography component="span" variant="body2" color="text.secondary">
                              Ref: {a?.fundRequestId ?? a?.requestId ?? "—"}
                            </Typography>
                          </Stack>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                  {idx < paged.length - 1 && <Divider component="li" />}
                </React.Fragment>
              );
            })}
          </List>

          {/* Pagination footer (only shown when more than 10) */}
          {activities.length > PAGE_SIZE && (
            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
              <Pagination
                count={Math.ceil(activities.length / PAGE_SIZE)}
                page={page}
                onChange={(_, p) => setPage(p)}
                color="primary"
                shape="rounded"
                size="small"
              />
            </Box>
          )}
        </>
      )}

      {/* Details Drawer */}
      <Drawer
        anchor="right"
        open={open}
        onClose={() => {
          setOpen(false);
          setDetails(null);
          setDetailsLoading(false);
        }}
        PaperProps={{ sx: { width: { xs: "100%", sm: 420 } } }}
      >
        <Box sx={{ p: 3 }}>
          <Typography component="h3" variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
            Fund Request Details
          </Typography>

          {detailsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : !details ? (
            <Typography variant="body2" color="text.secondary">
              Select an activity to see details.
            </Typography>
          ) : details.error ? (
            <Typography variant="body2" color="error">
              {details.message}
            </Typography>
          ) : (
            <Box>
              <Item label="Title" value={details.data?.requestTitle} />
              <Item label="Description" value={details.data?.description} />
              <Item label="Amount" value={details.data?.amount} />
              <Item label="Status" value={details.data?.status} />
              <Item
                label="Created"
                value={
                  details.data?.createdAt
                    ? dayjs(details.data.createdAt).format("DD MMM YYYY, HH:mm")
                    : "—"
                }
              />
              <Item
                label="Workflow"
                value={
                  details.data?.workflow?.name ??
                  details.data?.workflowName ??
                  "—"
                }
              />
              <Item
                label="Department"
                value={
                  details.data?.department?.name ??
                  details.data?.departmentName ??
                  "—"
                }
              />

              {Array.isArray(details.data?.fields) &&
                details.data.fields.length > 0 && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography component="h4" variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                      Submitted Fields
                    </Typography>
                    <Box sx={{ display: "grid", rowGap: 1 }}>
                      {details.data.fields.map((f, i) => (
                        <Item
                          key={`${f?.id ?? f?.fieldName ?? "field"}-${i}`}
                          label={f?.fieldName}
                          value={f?.fieldValue}
                        />
                      ))}
                    </Box>
                  </>
                )}
            </Box>
          )}
        </Box>
      </Drawer>
    </Box>
  );
}

function Item({ label, value }) {
  return (
    <Box sx={{ mb: 1.25 }}>
      <Typography component="div" variant="caption" sx={{ color: "text.secondary" }}>
        {label}
      </Typography>
      <Typography component="div" variant="body2" sx={{ fontWeight: 600, color: "#26344a" }}>
        {value ?? "—"}
      </Typography>
    </Box>
  );
}
