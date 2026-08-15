/**
 * The Aura mark: two counter-rotating gradient rings orbiting a
 * pulsing core, meant to read as an "aura" of energy rather than a
 * static badge. Pure SVG, no images, scales cleanly to any size.
 */
export default function Logo({ size = 32, animated = true, className = "" }) {
  const gradientId = "aura-mark-gradient";
  const gradientId2 = "aura-mark-gradient-soft";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} logo-highlight`}
      role="img"
      aria-label="Aura999+"
    >
      <defs>
        <linearGradient id={gradientId} x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5b8cff" />
          <stop offset="45%" stopColor="#7657e8" />
          <stop offset="100%" stopColor="#ee79c0" />
        </linearGradient>
        <linearGradient id={gradientId2} x1="36" y1="4" x2="4" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ee79c0" />
          <stop offset="100%" stopColor="#5b8cff" />
        </linearGradient>
      </defs>

      {/* outer broken ring */}
      <g className={animated ? "aura-ring-outer" : ""} style={{ transformBox: "fill-box" }}>
        <circle
          cx="20"
          cy="20"
          r="17"
          stroke={`url(#${gradientId})`}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray="58 6 14 30"
          fill="none"
        />
      </g>

      {/* inner broken ring, opposite direction, offset phase */}
      <g className={animated ? "aura-ring-inner" : ""} style={{ transformBox: "fill-box" }}>
        <circle
          cx="20"
          cy="20"
          r="11.5"
          stroke={`url(#${gradientId2})`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="20 8 18 26"
          fill="none"
          opacity="0.85"
        />
      </g>

      {/* pulsing core */}
      <g className={animated ? "aura-core" : ""} style={{ transformBox: "fill-box" }}>
        <circle cx="20" cy="20" r="5.5" fill={`url(#${gradientId})`} />
      </g>
    </svg>
  );
}
