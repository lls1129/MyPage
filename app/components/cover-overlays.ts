// Cover overlay types + helpers — stickers, captions, highlights.
// Storage is a single jsonb column on the album row; shape is
// documented in migration 0019. The renderer + editor both work
// against the OverlayLayer type defined here.

export type OverlayColor =
  | "cream"
  | "pink"
  | "lavender"
  | "ink"
  | "amber"
  | "skynavy"
  | "white";

export type HighlightShape = "circle" | "rect" | "heart" | "star" | "diamond";

export type StickerOverlay = {
  id: string;
  type: "sticker";
  x: number;
  y: number;
  scale: number;
  rotation: number;
  emoji: string;
};

export type CaptionOverlay = {
  id: string;
  type: "caption";
  x: number;
  y: number;
  scale: number;
  rotation: number;
  text: string;
  color: OverlayColor;
};

export type HighlightOverlay = {
  id: string;
  type: "highlight";
  x: number;
  y: number;
  scale: number;
  rotation: number;
  shape: HighlightShape;
  width: number; // 0..1 relative to cover
  height: number;
  color: OverlayColor;
};

// One pen-down → pen-up sub-stroke inside a StrokeOverlay layer.
// Each segment carries its own color + width so admin can flip
// colors / brush thickness mid-session and still keep all the
// strokes in a single overlay slot.
export type StrokeSegment = {
  points: [number, number][];
  color: OverlayColor;
  width: number; // 0..0.08 — stroke thickness as fraction of cover width
};

// Freehand stroke — admin doodles. Holds a list of segments, each
// with its own color + width. A whole drawing session (admin
// entering draw mode, laying down N strokes regardless of how
// often they change color / brush, then exiting) lives in this
// one overlay layer.
export type StrokeOverlay = {
  id: string;
  type: "stroke";
  x: number; // unused for render — kept for type uniformity (0..1)
  y: number;
  scale: number;
  rotation: number;
  segments: StrokeSegment[];
};

export type CoverOverlay =
  | StickerOverlay
  | CaptionOverlay
  | HighlightOverlay
  | StrokeOverlay;

/** App-level cap so a runaway state can't bloat the row. With
 *  multi-segment strokes folding a whole drawing session into one
 *  overlay, 25 leaves room for plenty of mixed sticker / caption
 *  / highlight / drawing combinations without pushing the
 *  serialised array to absurd sizes. */
export const OVERLAY_LIMIT = 25;

/** Curated set of small decorations admin can drop in with one tap.
 *  Admin can also type any other emoji via the input below. */
export const STICKER_QUICK_PICKS = [
  // typography flourishes
  "✿",
  "✦",
  "✧",
  "✨",
  "❀",
  "❁",
  "❄",
  // florals
  "🌸",
  "🌼",
  "🌷",
  "🌹",
  "🌺",
  "🌻",
  "🌿",
  "🍀",
  // celestial
  "🌟",
  "⭐",
  "💫",
  "🌙",
  "🌝",
  "☁️",
  "☀️",
  "🌈",
  // critters
  "🦋",
  "🐝",
  "🐱",
  "🐰",
  // hearts
  "💕",
  "💖",
  "💗",
  "❤️",
  // misc cute
  "🎀",
  "🍃",
  "🍓",
];

/** Color → Tailwind utility classes for text-style overlays
 *  (captions). Each variant pairs a fill color with a soft outline
 *  so it stays readable on any cover. */
export const OVERLAY_TEXT_CLASSES: Record<OverlayColor, string> = {
  cream:
    "text-cream [text-shadow:0_1px_2px_rgba(64,40,82,0.55)]",
  pink:
    "text-pink-100 [text-shadow:0_1px_2px_rgba(157,23,77,0.55)]",
  lavender:
    "text-lavender-100 [text-shadow:0_1px_2px_rgba(82,40,140,0.55)]",
  ink:
    "text-skynavy-900 [text-shadow:0_1px_2px_rgba(255,255,255,0.65)]",
  amber:
    "text-amber-100 [text-shadow:0_1px_2px_rgba(120,60,0,0.55)]",
  skynavy:
    "text-skynavy-100 [text-shadow:0_1px_2px_rgba(64,40,82,0.65)]",
  white:
    "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.55)]",
};

/** Color → fill+border classes for highlight shapes. Translucent
 *  fills so the cover beneath stays partly visible. */
export const OVERLAY_SHAPE_CLASSES: Record<OverlayColor, string> = {
  cream: "bg-cream/55 border border-cream/85",
  pink: "bg-pink-300/55 border border-pink-400/85",
  lavender: "bg-lavender-200/55 border border-lavender-300/85",
  ink: "bg-skynavy-900/45 border border-skynavy-900/80",
  amber: "bg-amber-200/55 border border-amber-300/90",
  skynavy: "bg-skynavy-500/55 border border-skynavy-600/85",
  white: "bg-white/65 border border-white",
};

/** SVG-friendly equivalents for the heart shape — fill + stroke
 *  use hex values directly because Tailwind's color-with-opacity
 *  utilities don't apply cleanly to `fill` / `stroke`. */
export const OVERLAY_SHAPE_SVG: Record<
  OverlayColor,
  { fill: string; stroke: string }
> = {
  cream: { fill: "#fff8e7", stroke: "#fff8e7" },
  pink: { fill: "#f9a8d4", stroke: "#ec4899" },
  lavender: { fill: "#ddd6fe", stroke: "#c4b5fd" },
  ink: { fill: "#40285288", stroke: "#402852" },
  amber: { fill: "#fde68a", stroke: "#f59e0b" },
  skynavy: { fill: "#647cb1", stroke: "#3f5278" },
  white: { fill: "#ffffff", stroke: "#ffffff" },
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function isColor(v: unknown): v is OverlayColor {
  return (
    v === "cream" ||
    v === "pink" ||
    v === "lavender" ||
    v === "ink" ||
    v === "amber" ||
    v === "skynavy" ||
    v === "white"
  );
}

function isShape(v: unknown): v is HighlightShape {
  return (
    v === "circle" ||
    v === "rect" ||
    v === "heart" ||
    v === "star" ||
    v === "diamond"
  );
}

/** Best-effort parse — skip any entry the renderer can't safely
 *  paint so a typo / stale row doesn't blank the card. */
export function normalizeOverlays(raw: unknown): CoverOverlay[] {
  if (!Array.isArray(raw)) return [];
  const out: CoverOverlay[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" && o.id.length > 0 ? o.id : null;
    if (!id) continue;
    const x = clamp01(o.x as number);
    const y = clamp01(o.y as number);
    const scale =
      Number.isFinite(o.scale as number) && (o.scale as number) > 0
        ? Math.min(5, Math.max(0.1, o.scale as number))
        : 1;
    const rotation =
      Number.isFinite(o.rotation as number)
        ? ((o.rotation as number) % 360)
        : 0;
    const base = { id, x, y, scale, rotation };
    if (o.type === "sticker" && typeof o.emoji === "string" && o.emoji.length > 0) {
      out.push({ ...base, type: "sticker", emoji: o.emoji });
    } else if (
      o.type === "caption" &&
      typeof o.text === "string" &&
      o.text.length > 0
    ) {
      out.push({
        ...base,
        type: "caption",
        text: o.text,
        color: isColor(o.color) ? o.color : "cream",
      });
    } else if (o.type === "highlight" && isShape(o.shape)) {
      out.push({
        ...base,
        type: "highlight",
        shape: o.shape,
        width: clamp01(o.width as number) || 0.3,
        height: clamp01(o.height as number) || 0.3,
        color: isColor(o.color) ? o.color : "pink",
      });
    } else if (o.type === "stroke") {
      // Accept three shapes:
      //   newest — segments: [{ points, color, width }]
      //   middle — segments: [number, number][][]  (uniform style
      //            inherited from overlay-level color + width)
      //   oldest — points:   [number, number][]    (single segment)
      // The newest shape lets a single layer hold strokes with
      // different colors / widths; the older shapes get coerced
      // up with the overlay's color/width applied uniformly.
      const fallbackColor: OverlayColor = isColor(o.color)
        ? (o.color as OverlayColor)
        : "pink";
      const fallbackWidth =
        Number.isFinite(o.width as number) && (o.width as number) > 0
          ? Math.min(0.08, Math.max(0.002, o.width as number))
          : 0.015;
      let segments: StrokeSegment[] = [];
      if (Array.isArray(o.segments)) {
        for (const seg of o.segments as unknown[]) {
          // New shape: { points, color, width }
          if (
            seg &&
            typeof seg === "object" &&
            Array.isArray((seg as { points?: unknown }).points)
          ) {
            const s = seg as Record<string, unknown>;
            const pts = parseStrokePoints(s.points);
            if (pts.length === 0) continue;
            const color = isColor(s.color)
              ? (s.color as OverlayColor)
              : fallbackColor;
            const width =
              Number.isFinite(s.width as number) && (s.width as number) > 0
                ? Math.min(0.08, Math.max(0.002, s.width as number))
                : fallbackWidth;
            segments.push({ points: pts, color, width });
            continue;
          }
          // Middle shape: bare points array per segment.
          if (Array.isArray(seg)) {
            const pts = parseStrokePoints(seg);
            if (pts.length > 0)
              segments.push({
                points: pts,
                color: fallbackColor,
                width: fallbackWidth,
              });
          }
        }
      } else if (Array.isArray(o.points)) {
        const pts = parseStrokePoints(o.points);
        if (pts.length > 0)
          segments = [
            { points: pts, color: fallbackColor, width: fallbackWidth },
          ];
      }
      if (segments.length === 0) continue;
      out.push({
        ...base,
        type: "stroke",
        segments,
      });
    }
  }
  return out.slice(0, OVERLAY_LIMIT);
}

function parseStrokePoints(raw: unknown): [number, number][] {
  if (!Array.isArray(raw)) return [];
  const pts: [number, number][] = [];
  for (const p of raw) {
    if (
      Array.isArray(p) &&
      typeof p[0] === "number" &&
      typeof p[1] === "number"
    ) {
      pts.push([clamp01(p[0]), clamp01(p[1])]);
    }
  }
  return pts;
}

/** Heart path used by the highlight renderer. Sized to viewBox
 *  100×100 with a small inset for the stroke. */
export const HEART_PATH =
  "M50 88 L12 50 C0 37 6 18 23 14 C36 11 46 18 50 28 C54 18 64 11 77 14 C94 18 100 37 88 50 Z";

/** Classic 5-point star in a 100×100 viewBox. */
export const STAR_PATH =
  "M50 8 L61 38 L94 38 L67 57 L77 88 L50 70 L23 88 L33 57 L6 38 L39 38 Z";

/** Diamond — 4-sided polygon (rotated square) in a 100×100 viewBox. */
export const DIAMOND_PATH = "M50 6 L94 50 L50 94 L6 50 Z";

/** Build an SVG `d` from a single segment's points. Coordinates
 *  are multiplied to a 100×100 viewBox to keep stroke widths
 *  proportional. Single-point segments degrade to a tiny line so
 *  `stroke-linecap: round` paints them as dots. */
export function strokePointsToPath(points: [number, number][]): string {
  if (points.length === 0) return "";
  const scaled = points.map(([x, y]) => [x * 100, y * 100] as const);
  if (scaled.length === 1) {
    const [x, y] = scaled[0];
    return `M ${x} ${y} L ${x + 0.01} ${y + 0.01}`;
  }
  let d = `M ${scaled[0][0]} ${scaled[0][1]}`;
  for (let i = 1; i < scaled.length; i++) {
    d += ` L ${scaled[i][0]} ${scaled[i][1]}`;
  }
  return d;
}

/** Make a fresh overlay id without pulling in a crypto lib.
 *  Doesn't need to be globally unique — we just need React keys
 *  and drag identifiers within a single album's overlay list. */
export function newOverlayId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export type StrokeBbox = {
  /** Top-left + size of the un-rotated stroke bbox, in stage 0..1
   *  fractions. Pre-padded for stroke width × overlay scale. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Center of the bbox — used as the rotation pivot for the SVG
   *  (matches what the editor's RotationHandle pivots around). */
  cx: number;
  cy: number;
};

/** Compute the axis-aligned bounding box of a stroke overlay,
 *  padded so the rounded line cap of the widest segment fits
 *  fully inside, and clamped to the 0..1 stage frame. Used both
 *  by the editor (to size the selection outline + position the
 *  rotation handle around the actual stroke instead of the full
 *  stage) and by the viewer (so rotated strokes paint their full
 *  cap area without being clipped). */
export function strokeBoundingBox(
  segments: { points: [number, number][]; width: number }[],
  scale: number
): StrokeBbox {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  let n = 0;
  let widest = 0;
  for (const seg of segments) {
    if (seg.width > widest) widest = seg.width;
    for (const [x, y] of seg.points) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      n++;
    }
  }
  if (n === 0) {
    return { x: 0.45, y: 0.45, w: 0.1, h: 0.1, cx: 0.5, cy: 0.5 };
  }
  const pad = (widest / 2) * Math.max(scale, 0.1);
  let x = Math.max(0, minX - pad);
  let y = Math.max(0, minY - pad);
  let w = Math.min(1, maxX + pad) - x;
  let h = Math.min(1, maxY + pad) - y;
  // Keep a minimum size so the selection ring is grabbable on
  // strokes that collapsed to a dot.
  if (w < 0.05) {
    const c = x + w / 2;
    x = Math.max(0, Math.min(1 - 0.05, c - 0.025));
    w = 0.05;
  }
  if (h < 0.05) {
    const c = y + h / 2;
    y = Math.max(0, Math.min(1 - 0.05, c - 0.025));
    h = 0.05;
  }
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}
