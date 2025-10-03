import React, { useId } from "react";

/** ApprovalTrailIcon – final version (with unique mask per instance) */
export default function ApprovalTrailIcon({
  size = 20,
  strokeWidth = 1.2,
  color = "currentColor",
  className = ""
}) {
  const maskId = useId();

  const node = 2.4;                                  // corner squares size
  const innerStroke = Math.max(0.6, strokeWidth * 0.45);

  // inner square (the 4 corner nodes connect to form this)
  const inner = {
    tl: { x: 8, y: 8 },
    tr: { x: 16, y: 8 },
    br: { x: 16, y: 16 },
    bl: { x: 8, y: 16 },
  };

  // Eye — width doubled & 50% thinner outline; left edge sits at x=8
  const eyeRx = 5.8;                   // horizontal radius (wide)
  const eyeCx = 8 + eyeRx;               // center so left edge is at x=8
  const eyeCy = 17.8;                    // sits near lower-right
  const eyeRy = 5.8;                 // vertical radius
  const eyeStroke = Math.max(0.4, strokeWidth * 0.5);
  const eyeD = `M${eyeCx - eyeRx} ${eyeCy} Q ${eyeCx} ${eyeCy - eyeRy} ${eyeCx + eyeRx} ${eyeCy} Q ${eyeCx} ${eyeCy + eyeRy} ${eyeCx - eyeRx} ${eyeCy} Z`;
  const eyeMaskStroke = Math.max(strokeWidth * 2, 3); // hides overlap cleanly

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ color }}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Make overlapped parts invisible under the eye */}
        <mask id={maskId}>
          <rect x="0" y="0" width="24" height="24" fill="#fff" />
          <path d={eyeD} fill="#000" />
          <path d={eyeD} stroke="#000" strokeWidth={eyeMaskStroke} />
        </mask>
      </defs>

      {/* Outer frame + inner square + 4 nodes (masked under the eye) */}
      <g mask={`url(#${maskId})`}>
        <rect x="5" y="5" width="14" height="14" rx="0.8"
              stroke="currentColor" strokeWidth={strokeWidth} fill="none" />
        <path d={`M${inner.tl.x} ${inner.tl.y} L${inner.tr.x} ${inner.tr.y} L${inner.br.x} ${inner.br.y} L${inner.bl.x} ${inner.bl.y} Z`}
              stroke="currentColor" strokeWidth={innerStroke}
              fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {[inner.tl, inner.tr, inner.br, inner.bl].map((p, i) => (
          <rect key={i} x={p.x - node / 2} y={p.y - node / 2}
                width={node} height={node} fill="currentColor" rx="0.3" />
        ))}
      </g>

      {/* Eye on top (50% thinner outline) + 50% smaller pupil */}
      <path d={eyeD} stroke="currentColor" strokeWidth={eyeStroke}
            fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={eyeCx} cy={eyeCy} r={eyeRy * 0.275} fill="currentColor" />
    </svg>
  );
}
