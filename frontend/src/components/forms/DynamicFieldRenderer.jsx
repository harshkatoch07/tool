import React from "react";
import { TextField, Box } from "@mui/material";

// Basic dynamic field renderer for demo purposes
export default function DynamicFieldRenderer({ fields, values, onChange, readOnlyFields = [] }) {
  if (!fields || fields.length === 0) return null;
  return (
    <Box display="flex" flexDirection="column" gap={2}>
      {fields.map((f) => (
        <TextField
          key={f.key || f.name || f.label}
          label={f.label || f.key || f.name}
          value={values?.[f.key] ?? ""}
          onChange={e => onChange(f.key, e.target.value)}
          fullWidth
          margin="normal"
          InputProps={{ readOnly: readOnlyFields.includes(f.key) }}
        />
      ))}
    </Box>
  );
}
