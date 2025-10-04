// src/components/common/BrandLogo.jsx
import React from "react";

export default function BrandLogo({
  variant = "mark",        // "mark" | "full"
  height = 40,
  style,
  ...imgProps
}) {
  const src = variant === "full" ? "/gera-lets-outdo.png" : "/gera-logo.png";
  return (
    <img
      src={src}            // served from /public
      alt={variant === "full" ? "Gera — Let's Outdo" : "Gera"}
      height={height}
      style={{ display: "block", objectFit: "contain", ...style }}
      {...imgProps}
    />
  );
}
