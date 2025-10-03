// src/components/attachments/AttachmentEditor.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Chip,
  LinearProgress,
} from "@mui/material";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import ChangeCircleIcon from "@mui/icons-material/ChangeCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DownloadIcon from "@mui/icons-material/Download";

import {
  // Alias new API names to the old identifiers used below
  canEditAttachments as canInitiatorEdit,
  addAttachment as uploadSingle,
  replaceAttachment as replaceOne,
  deleteAttachment as deleteOne,
  downloadAttachment as downloadOne,
  listAttachments,
} from "../../api/attachmentsApi";

function sizeFmt(v) {
  if (!v && v !== 0) return "";
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(0)} KB`;
  return `${(v / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentEditor({ fundRequestId }) {
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState([]);
  const [canEdit, setCanEdit] = useState(false);
  const [open, setOpen] = useState(false);

  const addRef = useRef(null);
  const replRefs = useRef({}); // attId -> input

  // Local preview helper wrapping downloadOne to return { blob, type }
  const previewOne = async (reqId, attId) => {
    const { blob, contentType } = await downloadOne(reqId, attId);
    return { blob, type: contentType || blob?.type || "" };
  };

  const load = async () => {
    setBusy(true);
    try {
      const [r, gate] = await Promise.all([
        listAttachments(fundRequestId),
        canInitiatorEdit(fundRequestId),
      ]);
      setRows(Array.isArray(r) ? r : []);
      // canInitiatorEdit returns a boolean
      setCanEdit(Boolean(gate));
    } catch {
      setRows([]);
      setCanEdit(false);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (fundRequestId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fundRequestId]);

  const onAdd = async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await uploadSingle(fundRequestId, file);
      await load();
    } catch (err) {
      alert(err?.message || "Failed to add attachment.");
    } finally {
      if (addRef.current) addRef.current.value = "";
      setBusy(false);
    }
  };

  const onReplace = (attId) => replRefs.current[attId]?.click();

  const onReplaceChange = async (attId, e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await replaceOne(fundRequestId, attId, file);
      await load();
    } catch (err) {
      alert(err?.message || "Failed to replace attachment.");
    } finally {
      if (replRefs.current[attId]) replRefs.current[attId].value = "";
      setBusy(false);
    }
  };

  const onDelete = async (attId) => {
    if (!window.confirm("Delete this attachment?")) return;
    setBusy(true);
    try {
      await deleteOne(fundRequestId, attId);
      await load();
    } catch (err) {
      alert(err?.message || "Failed to delete attachment.");
    } finally {
      setBusy(false);
    }
  };

  const onPreview = async (attId, fileName) => {
    try {
      const { blob, type } = await previewOne(fundRequestId, attId);
      const url = URL.createObjectURL(blob);
      // open in a new tab if browser can preview, else force a download
      if (type.includes("pdf") || type.startsWith("image/") || type.startsWith("text/")) {
        const w = window.open();
        if (w) {
          w.document.title = fileName || "Attachment";
          const iframe = w.document.createElement("iframe");
          iframe.style.border = "0";
          iframe.style.width = "100%";
          iframe.style.height = "100%";
          iframe.src = url;
          w.document.body.style.margin = "0";
          w.document.body.appendChild(iframe);
        }
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName || "file";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      alert("Could not preview the file.");
    }
  };

  const onDownload = async (attId, fileName) => {
    try {
      const { blob } = await downloadOne(fundRequestId, attId);
      const link = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = link;
      a.download = fileName || "file";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(link), 60_000);
    } catch {
      alert("Download failed.");
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          Attachments
        </Typography>

        {canEdit && (
          <Button
            size="small"
            variant="outlined"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Close editor" : "Edit attachments"}
          </Button>
        )}
      </Stack>

      {busy && <LinearProgress sx={{ mb: 1 }} />}

      {/* List */}
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No attachments.</Typography>
      ) : (
        <Stack spacing={1} sx={{ mb: open ? 1 : 0 }}>
          {rows.map((f) => {
            const id = f.id ?? f.Id;
            const name = f.fileName ?? f.FileName ?? "file";
            const size = f.fileSize ?? f.SizeBytes;
            const when = f.uploadedAt ?? f.UploadedAt;

            return (
              <Stack
                key={id}
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ p: 1, borderRadius: 1, "&:hover": { bgcolor: "#fafafa" } }}
              >
                <InsertDriveFileIcon fontSize="small" />
                <Typography sx={{ flex: 1 }} title={name}>
                  {name}
                  <Typography component="span" variant="caption" color="text.secondary">
                    {size ? ` (${sizeFmt(size)})` : ""} {when ? ` • ${new Date(when).toLocaleString()}` : ""}
                  </Typography>
                </Typography>

                <Tooltip title="View / Preview">
                  <IconButton size="small" onClick={() => onPreview(id, name)}>
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Download">
                  <IconButton size="small" onClick={() => onDownload(id, name)}>
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                {open && (
                  <>
                    <input
                      type="file"
                      style={{ display: "none" }}
                      ref={(el) => (replRefs.current[id] = el)}
                      onChange={(e) => onReplaceChange(id, e)}
                    />
                    <Tooltip title="Replace file">
                      <IconButton size="small" onClick={() => onReplace(id)}>
                        <ChangeCircleIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete file">
                      <IconButton size="small" onClick={() => onDelete(id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </Stack>
            );
          })}
        </Stack>
      )}

      {/* Add new */}
      {open && canEdit && (
        <Stack direction="row" alignItems="center" spacing={1}>
          <input type="file" ref={addRef} style={{ display: "none" }} onChange={onAdd} />
          <Button size="small" startIcon={<AddCircleIcon />} onClick={() => addRef.current?.click()}>
            Add file
          </Button>
          <Chip
            size="small"
            label="Editable until final approval"
            variant="outlined"
            color="warning"
          />
        </Stack>
      )}
    </Box>
  );
}
