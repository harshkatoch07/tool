// src/components/admin/workflow/ImportWorkflowsPage.jsx
import React, { useState } from "react";
import {
  Box,
  Paper,
  Grid,
  Typography,
  Button,
  Stack,
  LinearProgress,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DownloadIcon from "@mui/icons-material/Download";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import {
  uploadWorkflowsExcel,
  downloadWorkflowTemplate,
} from "../../../api/adminApi";
import { useNavigate } from "react-router-dom";

export default function ImportWorkflowsPage() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // {type:'success'|'error', text:string}
  const [results, setResults] = useState([]); // optional per-row results from API
  const navigate = useNavigate();

  const handleChoose = (e) => {
    const f = e.target.files?.[0];
    if (f && !f.name.toLowerCase().endsWith(".xlsx")) {
      setMessage({ type: "error", text: "Please select an .xlsx file." });
      return;
    }
    setMessage(null);
    setResults([]);
    setFile(f || null);
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage({ type: "error", text: "Choose an Excel (.xlsx) file first." });
      return;
    }
    try {
      setBusy(true);
      setMessage(null);

      const formData = new FormData();
      formData.append("file", file, file.name);

      // adminApi.uploadWorkflowsExcel expects FormData and returns JSON
      const resp = await uploadWorkflowsExcel(formData);

      // Be robust to different server payloads:
      //  - { message: "Imported X workflow(s) successfully." }
      //  - { imported: number, results: [{ ok, row, workflowId, name, error }...] }
      const imported =
        resp?.imported ??
        (Array.isArray(resp?.results)
          ? resp.results.filter((r) => r.ok).length
          : undefined);

      if (Array.isArray(resp?.results)) {
        setResults(resp.results);
      } else {
        setResults([]);
      }

      const text =
        resp?.message ||
        (typeof imported === "number"
          ? `Import finished. ${imported} rows imported.`
          : "Import finished.");

      setMessage({ type: "success", text });
    } catch (err) {
      setMessage({ type: "error", text: err?.message || "Import failed." });
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setBusy(true);
      setMessage(null);

      // adminApi.downloadWorkflowTemplate returns a Blob
      const blob = await downloadWorkflowTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "WorkflowsTemplate.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setMessage({ type: "success", text: "Template downloaded." });
    } catch (err) {
      setMessage({
        type: "error",
        text: err?.message || "Failed to download template.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        p: { xs: 1.5, md: 4 },
        bgcolor: "linear-gradient(120deg,#eaf2fb 0%,#f6f7fa 100%)",
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h4" fontWeight={800} color="#26344a">
          Import Workflows
        </Typography>
        <Button variant="text" onClick={() => navigate(-1)}>
          ← Back
        </Button>
      </Stack>

      <Grid container spacing={3}>
        {/* Import Card */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 1 }}>
            <Typography variant="h6" fontWeight={700} mb={1}>
              Upload Excel
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {message && (
              <Alert severity={message.type} sx={{ mb: 2 }}>
                {message.text}
              </Alert>
            )}
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                alignItems="center"
              >
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<CloudUploadIcon />}
                  sx={{ minWidth: 220, borderStyle: "dashed" }}
                >
                  Choose .xlsx file
                  <input type="file" accept=".xlsx" hidden onChange={handleChoose} />
                </Button>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {file ? file.name : "No file selected"}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  onClick={handleUpload}
                  disabled={busy || !file}
                  startIcon={<CloudUploadIcon />}
                >
                  Import
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  disabled={busy && !results.length}
                  onClick={() => {
                    setFile(null);
                    setResults([]);
                    setMessage(null);
                  }}
                >
                  Reset
                </Button>
              </Stack>
              {busy && <LinearProgress />}
            </Stack>

            {/* Results */}
            {!!results.length && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" fontWeight={700} mb={1}>
                  Import Results
                </Typography>
                <List
                  dense
                  sx={{
                    maxHeight: 360,
                    overflow: "auto",
                    border: "1px solid #eee",
                    borderRadius: 2,
                  }}
                >
                  {results.map((r, idx) => {
                    const ok = Boolean(r.ok);
                    const primary = ok
                      ? `Row ${r.row}: Imported (ID ${r.workflowId})`
                      : `Row ${r.row}: Failed`;
                    const secondary = ok ? r.name || "" : r.error || "Unknown error";
                    return (
                      <ListItem key={`${r.row}-${idx}`} alignItems="flex-start" sx={{ py: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: 2 }}>
                          {ok ? (
                            <CheckCircleIcon color="success" />
                          ) : (
                            <ErrorOutlineIcon color="error" />
                          )}
                          <Chip
                            size="small"
                            label={ok ? "OK" : "ERROR"}
                            color={ok ? "success" : "error"}
                          />
                        </Stack>
                        <ListItemText
                          primary={
                            <Typography variant="body1" fontWeight={700}>
                              {primary}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="body2" color="text.secondary">
                              {secondary}
                            </Typography>
                          }
                        />
                      </ListItem>
                    );
                  })}
                </List>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Help + Download Template */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 1 }}>
            <Typography variant="h6" fontWeight={700} mb={1}>
              Download Template
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Use this Excel template to avoid header mistakes. Fill rows and then import.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadTemplate}
              disabled={busy}
            >
              Download Template (.xlsx)
            </Button>

            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Required Columns (match exactly)
            </Typography>
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              <li>
                <Typography variant="body2">
                  <b>Name</b> — Workflow name
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  <b>DepartmentName</b> — e.g. Finance, HR (must exist in DB)
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  <b>Description</b> (optional), <b>IsActive</b> (TRUE/FALSE)
                </Typography>
              </li>
            </Box>

            <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 2, mb: 1 }}>
              Steps (repeatable groups)
            </Typography>
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              <li>
                <Typography variant="body2">
                  <b>Step1_Designation</b>, <b>Step1_Sequence</b>, <b>Step1_SLAHours</b>
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  <b>Step2_Designation</b>, <b>Step2_Sequence</b>, <b>Step2_SLAHours</b>, …
                </Typography>
              </li>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Tip: The <b>Initiator</b> step (Sequence = 1) is added automatically by the system.
              Your first approver should usually start at Sequence = 2.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
