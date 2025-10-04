export const toHyperlinkUrlArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === "string" ? v : v != null ? String(v) : ""));
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }
  return [];
};

export const serializeHyperlinkUrls = (value) => {
  const cleaned = toHyperlinkUrlArray(value)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  return cleaned.join("\n");
};