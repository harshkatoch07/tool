import React from "react";
import { TextField, MenuItem } from "@mui/material";

export default function FieldRenderer({ field, value, onChange, errorText }) {
  const common = {
    fullWidth: true,
    variant: "outlined",
    size: "medium",
    label: field.required ? `${field.label} *` : field.label,
    value: value ?? "",
    onChange: e => onChange(field.key, e.target.value),
    helperText: errorText || " ",
    error: !!errorText
  };
  if (field.type === "select") {
    return (
      <TextField select {...common}>
        {(field.options || []).map(o => (
          <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
        ))}
      </TextField>
    );
  }
  if (field.type === "textarea") return <TextField {...common} multiline minRows={3} />;
  if (field.type === "url") return <TextField {...common} type="url" />;
  return <TextField {...common} />;
}
