// Pure SVG moon-phase disk. No state, no client hooks — fine in a server
// component. The math uses the classic three-shape trick:
//   1. Dark base circle covering the whole disk
//   2. Lit semi-circle on the side facing the sun (right for waxing, left for waning)
//   3. An ellipse (vertical, x-radius = r * |cos(2π·phase)|) on top, colored
//      LIT if we're in a gibbous phase (extends the half-moon outward) and
//      DARK if we're in a crescent phase (carves into the half-moon)
//
// Result: a single SVG with three primitives, mathematically correct from
// new → first quarter → full → last quarter → new.

type Props = {
  /** SunCalc convention: 0 = new, 0.25 = first quarter, 0.5 = full,
   *  0.75 = last quarter. Wraps in [0, 1). */
  phaseFraction: number;
  /** Pixel size of the rendered disk (width = height). */
  size?: number;
  /** Custom colors. Defaults play well on a dark skynavy panel. */
  litColor?: string;
  darkColor?: string;
  /** Soft rim halo (off by default — turn on for the big version). */
  glow?: boolean;
};

export function MoonDisk({
  phaseFraction,
  size = 200,
  litColor = "#FFFAF3",
  darkColor = "#060619",
  glow = false,
}: Props) {
  const r = size / 2;
  const cx = r;
  const cy = r;

  const phase = ((phaseFraction % 1) + 1) % 1;
  const angle = phase * 2 * Math.PI;
  const cosA = Math.cos(angle);
  const ellipseRx = r * Math.abs(cosA);

  const waxing = phase < 0.5;
  const gibbous = phase > 0.25 && phase < 0.75;

  // Right semicircle for waxing, left semicircle for waning. Both close back
  // along the vertical diameter, giving a clean half-disk.
  const litSemiPath = waxing
    ? `M ${cx},${cy - r} A ${r},${r} 0 0 1 ${cx},${cy + r} Z`
    : `M ${cx},${cy - r} A ${r},${r} 0 0 0 ${cx},${cy + r} Z`;

  const gradId = `moon-rim-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="moon phase"
      style={{ display: "block" }}
    >
      {glow ? (
        <defs>
          <radialGradient id={gradId} cx="50%" cy="50%" r="55%">
            <stop offset="60%" stopColor={litColor} stopOpacity="0" />
            <stop offset="100%" stopColor={litColor} stopOpacity="0.18" />
          </radialGradient>
        </defs>
      ) : null}

      {glow ? (
        <circle cx={cx} cy={cy} r={r * 1.08} fill={`url(#${gradId})`} />
      ) : null}

      {/* Base dark disk */}
      <circle cx={cx} cy={cy} r={r} fill={darkColor} />

      {/* Lit semi-circle */}
      <path d={litSemiPath} fill={litColor} />

      {/* Modifier ellipse — bright for gibbous, dark for crescent */}
      <ellipse
        cx={cx}
        cy={cy}
        rx={ellipseRx}
        ry={r}
        fill={gibbous ? litColor : darkColor}
      />

      {/* Subtle rim outline */}
      <circle
        cx={cx}
        cy={cy}
        r={r - 0.5}
        fill="none"
        stroke={litColor}
        strokeOpacity="0.18"
        strokeWidth="1"
      />
    </svg>
  );
}
