export function validateBySchema(schema, values) {
  const errors = {};
  (schema?.fields || []).forEach(f => {
    if (f.required && !String(values[f.key] ?? "").trim()) errors[f.key] = "This field is required.";
  });
  return errors;
}
