"use client";

import { useId } from "react";

// SVG moon-phase disk. Renders a real moon photo (NASA / Wikimedia full
// moon image) clipped to the lit lune, with a dark base showing through
// for the shadowed area.
//
// The lit lune path: one half of the moon's outer perimeter (the side
// facing the sun) plus one half of the terminator ellipse (x-radius =
// r * |cos(2π·phase)|). Sweep flags switch through the four quadrants
// of the synodic cycle so the path stays oriented correctly from new
// → first quarter → full → last quarter → new.

// Self-hosted moon photograph, tight-cropped to the moon disk itself so
// the lit area lines up with the dark base circle without leaving a
// visible black border. (Source: Wikimedia Commons FullMoon2010,
// PD-NASA; cropped to 446×446.)
const MOON_IMAGE_URL = "/moon-cropped.jpg";

type Props = {
  /** SunCalc convention: 0 = new, 0.25 = first quarter, 0.5 = full,
   *  0.75 = last quarter. Wraps in [0, 1). */
  phaseFraction: number;
  /** Pixel size of the lit disk (width = height = size). When `glow`
   *  is on the rendered <svg> is slightly bigger to fit the halo. */
  size?: number;
  /** Dark/shadow fill for the unlit area. */
  darkColor?: string;
  /** Soft rim halo (off by default — turn on for the big version). */
  glow?: boolean;
};

export function MoonDisk({
  phaseFraction,
  size = 200,
  darkColor = "#060619",
  glow = false,
}: Props) {
  // Halo padding so the glow doesn't get clipped at the viewBox corners.
  const pad = glow ? Math.ceil(size * 0.12) : 0;
  const total = size + pad * 2;
  const r = size / 2;
  const cx = r + pad;
  const cy = r + pad;

  const phase = ((phaseFraction % 1) + 1) % 1;
  const isNew = phase < 0.005 || phase > 0.995;
  const isFull = Math.abs(phase - 0.5) < 0.005;

  const angle = phase * 2 * Math.PI;
  const cosA = Math.cos(angle);
  // Tiny floor so SVG arc with rx=0 doesn't behave oddly across renderers.
  const rx = Math.max(r * Math.abs(cosA), 0.001);
  const waxing = phase < 0.5;
  const crescent = cosA > 0;
  const sweepOuter = waxing ? 1 : 0;
  const sweepInner = crescent ? sweepOuter : 1 - sweepOuter;

  const litLunePath = isFull
    ? `M ${cx - r},${cy} a ${r},${r} 0 1 0 ${2 * r},0 a ${r},${r} 0 1 0 ${-2 * r},0 Z`
    : `M ${cx},${cy - r} A ${r},${r} 0 0 ${sweepOuter} ${cx},${cy + r} A ${rx},${r} 0 0 ${sweepInner} ${cx},${cy - r} Z`;

  // useId is hydration-safe: same value on server + client.
  const uid = useId().replace(/:/g, "-");
  const clipId = `moon-clip-${uid}`;
  const haloId = `moon-halo-${uid}`;
  const litFilterId = `moon-lit-${uid}`;

  return (
    <svg
      width={total}
      height={total}
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label="moon phase"
      style={{ display: "block" }}
    >
      <defs>
        <clipPath id={clipId}>
          {!isNew ? <path d={litLunePath} /> : null}
        </clipPath>
        {glow ? (
          <radialGradient id={haloId} cx="50%" cy="50%" r="50%">
            <stop offset="65%" stopColor="#FFFAF3" stopOpacity="0" />
            <stop offset="85%" stopColor="#FFFAF3" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#FFFAF3" stopOpacity="0" />
          </radialGradient>
        ) : null}
        {/* Slight warm tint + brightness lift on the lit side so the
            photo reads as illuminated rather than gray. */}
        <filter id={litFilterId} x="0" y="0" width="100%" height="100%">
          <feColorMatrix
            type="matrix"
            values="
              1.05 0    0    0 0.02
              0    1.02 0    0 0.01
              0    0    0.98 0 0
              0    0    0    1 0
            "
          />
        </filter>
      </defs>

      {/* Halo behind the disk (fits inside the padded viewBox). */}
      {glow ? (
        <circle
          cx={cx}
          cy={cy}
          r={r + pad * 0.7}
          fill={`url(#${haloId})`}
        />
      ) : null}

      {/* Dark base — always present, shows through where the lit area
          isn't clipping the moon image. */}
      <circle cx={cx} cy={cy} r={r} fill={darkColor} />

      {/* Moon photo, clipped to the lit lune. The cropped JPEG is square
          and tight on the disk, but we render at 1.04× to swallow the
          last few pixels of black border at the photo's edges so the
          lit area reaches the rim cleanly. */}
      {!isNew ? (
        (() => {
          const inflate = 1.04;
          const imgSize = r * 2 * inflate;
          const offset = (imgSize - r * 2) / 2;
          return (
            <image
              href={MOON_IMAGE_URL}
              x={cx - r - offset}
              y={cy - r - offset}
              width={imgSize}
              height={imgSize}
              clipPath={`url(#${clipId})`}
              filter={`url(#${litFilterId})`}
              preserveAspectRatio="xMidYMid slice"
            />
          );
        })()
      ) : null}

      {/* Crisp rim around the disk so the perimeter reads as round even
          when the lit area is very thin. */}
      <circle
        cx={cx}
        cy={cy}
        r={r - 0.5}
        fill="none"
        stroke="#FFFAF3"
        strokeOpacity="0.22"
        strokeWidth="1"
      />
    </svg>
  );
}
