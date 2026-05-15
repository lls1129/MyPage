// Decoration presets for album covers. Single source of truth for
// both the picker UI (chip buttons) and the renderers (card +
// cropper preview + photo grid + lightbox).
//
// Adding a preset: drop a new entry below. Class names must appear
// as static string literals here so Tailwind's content scanner
// picks them up — don't compose class names dynamically.

export type FrameSize = "thin" | "medium" | "thick";

export const FRAME_SIZES: { id: FrameSize; label: string }[] = [
  { id: "thin", label: "thin" },
  { id: "medium", label: "medium" },
  { id: "thick", label: "thick" },
];

function isFrameSize(v: string | null | undefined): v is FrameSize {
  return v === "thin" || v === "medium" || v === "thick";
}

export type FramePreset = {
  id: string;
  label: string;
  /** Classes for an overlay div (absolute inset-0 pointer-events-none)
   *  that paints the frame on top of the cover. One variant per
   *  size tier — admin picks both id and size in the cover picker. */
  sizes: Record<FrameSize, string>;
  /** Per-size positioning classes for the photo element. When set,
   *  the renderer applies these via `absolute` so the photo sits
   *  inside the frame's inner edge rather than bleeding past it at
   *  corners or under solid borders. Required for solid frames
   *  (mat, polaroid, rounded mat); omitted for decorative frames
   *  (dashed, dotted, vignette) where the full-size photo is part
   *  of the look (gaps in the border are meant to reveal it). */
  insets?: Record<FrameSize, string>;
  /** Same visual inset as `insets`, expressed as padding classes for
   *  cases where the photo is an in-flow element (e.g. <img>) and
   *  the wrapper carries the frame. The padding shrinks the image's
   *  content area; the frame overlay still spans the full bounds. */
  pads?: Record<FrameSize, string>;
  /** Outer corner-radius class for the cover/photo wrapper, matching
   *  the frame's outermost rounded curve. Lets a wrapper clip its
   *  contents (photo, bg) along the frame's shape so we don't see a
   *  mismatched square / small-radius outline poking past curves. */
  outerRadius?: Record<FrameSize, string>;
  /** Tailwind bg-color class to fill the wrapper underneath a solid
   *  frame so any "mat" area not covered by the photo (e.g. object-
   *  contain letterbox in the lightbox) blends with the frame's
   *  color instead of showing the page bg through. */
  matBg?: string;
};

export type FilterPreset = {
  id: string;
  label: string;
  /** CSS filter value applied to the cover image element. */
  css: string;
};

export const FRAMES: FramePreset[] = [
  {
    id: "soft",
    label: "soft pink",
    sizes: {
      thin: "border-[2px] border-pink-300 rounded-md",
      medium: "border-[4px] border-pink-300 rounded-md",
      thick: "border-[8px] border-pink-300 rounded-md",
    },
    insets: {
      thin: "inset-[2px] rounded-sm",
      medium: "inset-[4px] rounded-sm",
      thick: "inset-[8px]",
    },
    pads: {
      thin: "p-[2px]",
      medium: "p-[4px]",
      thick: "p-[8px]",
    },
    outerRadius: {
      thin: "rounded-md",
      medium: "rounded-md",
      thick: "rounded-md",
    },
    matBg: "bg-pink-300",
  },
  {
    id: "dashed",
    label: "dashed",
    sizes: {
      thin: "border-[2px] border-dashed border-pink-400 rounded-md",
      medium: "border-[3px] border-dashed border-pink-400 rounded-md",
      thick: "border-[6px] border-dashed border-pink-400 rounded-md",
    },
  },
  {
    id: "dotted",
    label: "dotted",
    sizes: {
      thin: "border-[2px] border-dotted border-pink-400 rounded-md",
      medium: "border-[3px] border-dotted border-pink-400 rounded-md",
      thick: "border-[6px] border-dotted border-pink-400 rounded-md",
    },
  },
  {
    id: "double",
    label: "double",
    sizes: {
      // Concentric pink–white–pink rings via stacked inset shadows.
      thin: "shadow-[inset_0_0_0_2px_#f9a8d4,inset_0_0_0_4px_#ffffff,inset_0_0_0_6px_#f9a8d4] rounded-md",
      medium:
        "shadow-[inset_0_0_0_3px_#f9a8d4,inset_0_0_0_6px_#ffffff,inset_0_0_0_9px_#f9a8d4] rounded-md",
      thick:
        "shadow-[inset_0_0_0_5px_#f9a8d4,inset_0_0_0_10px_#ffffff,inset_0_0_0_15px_#f9a8d4] rounded-md",
    },
  },
  {
    id: "mat",
    label: "mat",
    sizes: {
      thin: "border-[6px] border-cream rounded-md",
      medium: "border-[10px] border-cream rounded-md",
      thick: "border-[18px] border-cream rounded-md",
    },
    insets: {
      thin: "inset-[6px]",
      medium: "inset-[10px]",
      thick: "inset-[18px]",
    },
    pads: {
      thin: "p-[6px]",
      medium: "p-[10px]",
      thick: "p-[18px]",
    },
    outerRadius: {
      thin: "rounded-md",
      medium: "rounded-md",
      thick: "rounded-md",
    },
    matBg: "bg-cream",
  },
  {
    id: "polaroid",
    label: "polaroid",
    sizes: {
      // Heavier bottom for the iconic look. Scales the gap with size.
      thin: "border-[4px] border-b-[12px] border-white",
      medium: "border-[6px] border-b-[18px] border-white",
      thick: "border-[10px] border-b-[30px] border-white",
    },
    insets: {
      thin: "top-[4px] left-[4px] right-[4px] bottom-[12px]",
      medium: "top-[6px] left-[6px] right-[6px] bottom-[18px]",
      thick: "top-[10px] left-[10px] right-[10px] bottom-[30px]",
    },
    pads: {
      thin: "pt-[4px] pl-[4px] pr-[4px] pb-[12px]",
      medium: "pt-[6px] pl-[6px] pr-[6px] pb-[18px]",
      thick: "pt-[10px] pl-[10px] pr-[10px] pb-[30px]",
    },
    outerRadius: {
      thin: "",
      medium: "",
      thick: "",
    },
    matBg: "bg-white",
  },
  {
    id: "gilt",
    label: "gilt",
    sizes: {
      thin: "border-[2px] border-amber-200 shadow-[inset_0_0_0_1px_rgba(239,159,39,0.35)] rounded-md",
      medium:
        "border-[4px] border-amber-200 shadow-[inset_0_0_0_2px_rgba(239,159,39,0.35)] rounded-md",
      thick:
        "border-[8px] border-amber-200 shadow-[inset_0_0_0_3px_rgba(239,159,39,0.45)] rounded-md",
    },
    insets: {
      thin: "inset-[2px] rounded-sm",
      medium: "inset-[4px] rounded-sm",
      thick: "inset-[8px]",
    },
    pads: {
      thin: "p-[2px]",
      medium: "p-[4px]",
      thick: "p-[8px]",
    },
    outerRadius: {
      thin: "rounded-md",
      medium: "rounded-md",
      thick: "rounded-md",
    },
    matBg: "bg-amber-200",
  },
  {
    id: "vignette",
    label: "vignette",
    sizes: {
      thin: "shadow-[inset_0_0_16px_4px_rgba(64,40,82,0.35)] rounded-md",
      medium: "shadow-[inset_0_0_24px_8px_rgba(64,40,82,0.45)] rounded-md",
      thick: "shadow-[inset_0_0_40px_14px_rgba(64,40,82,0.55)] rounded-md",
    },
  },
  {
    id: "glow",
    label: "pink glow",
    sizes: {
      thin: "shadow-[inset_0_0_18px_4px_rgba(244,114,182,0.45)] rounded-md",
      medium:
        "shadow-[inset_0_0_28px_8px_rgba(244,114,182,0.55)] rounded-md",
      thick:
        "shadow-[inset_0_0_48px_16px_rgba(244,114,182,0.65)] rounded-md",
    },
  },
  {
    id: "ribbon",
    // Two concentric pink rings with a white gap between — reads
    // like a thin ribbon laid over the edge.
    label: "ribbon",
    sizes: {
      thin: "shadow-[inset_0_0_0_2px_#ec4899,inset_0_0_0_4px_#ffffff,inset_0_0_0_5px_#ec4899] rounded-md",
      medium:
        "shadow-[inset_0_0_0_3px_#ec4899,inset_0_0_0_6px_#ffffff,inset_0_0_0_8px_#ec4899] rounded-md",
      thick:
        "shadow-[inset_0_0_0_5px_#ec4899,inset_0_0_0_10px_#ffffff,inset_0_0_0_14px_#ec4899] rounded-md",
    },
  },
  {
    id: "rounded",
    label: "rounded mat",
    sizes: {
      thin: "border-[6px] border-cream rounded-2xl",
      medium: "border-[12px] border-cream rounded-3xl",
      thick: "border-[20px] border-cream rounded-[2rem]",
    },
    insets: {
      // Inner radius ≈ outer radius − border width, so the photo's
      // inner curve sits flush with the mat's inner edge.
      thin: "inset-[6px] rounded-[10px]",
      medium: "inset-[12px] rounded-xl",
      thick: "inset-[20px] rounded-xl",
    },
    pads: {
      thin: "p-[6px]",
      medium: "p-[12px]",
      thick: "p-[20px]",
    },
    outerRadius: {
      thin: "rounded-2xl",
      medium: "rounded-3xl",
      thick: "rounded-[2rem]",
    },
    matBg: "bg-cream",
  },
  {
    id: "lavender",
    label: "lavender",
    sizes: {
      thin: "border-[3px] border-lavender-300 rounded-md",
      medium: "border-[5px] border-lavender-300 rounded-md",
      thick:
        "border-[10px] border-lavender-300 shadow-[inset_0_0_0_2px_rgba(196,181,253,0.5)] rounded-md",
    },
    insets: {
      thin: "inset-[3px] rounded-sm",
      medium: "inset-[5px] rounded-sm",
      thick: "inset-[10px] rounded-sm",
    },
    pads: {
      thin: "p-[3px]",
      medium: "p-[5px]",
      thick: "p-[10px]",
    },
    outerRadius: {
      thin: "rounded-md",
      medium: "rounded-md",
      thick: "rounded-md",
    },
    matBg: "bg-lavender-300",
  },
];

export const FILTERS: FilterPreset[] = [
  { id: "warm", label: "warm", css: "sepia(0.45) saturate(1.15)" },
  { id: "mono", label: "mono", css: "grayscale(1)" },
  { id: "cool", label: "cool", css: "hue-rotate(-15deg) saturate(0.9)" },
  {
    id: "dreamy",
    label: "dreamy",
    css: "brightness(1.08) saturate(1.25) contrast(0.95)",
  },
  { id: "vivid", label: "vivid", css: "saturate(1.5) contrast(1.05)" },
  {
    id: "vintage",
    label: "vintage",
    css: "sepia(0.3) contrast(0.92) brightness(1.04) saturate(0.85)",
  },
  {
    id: "pastel",
    label: "pastel",
    css: "saturate(0.7) brightness(1.08) sepia(0.15)",
  },
  {
    id: "rosy",
    label: "rosy",
    css: "hue-rotate(-10deg) saturate(1.15) brightness(1.03)",
  },
  {
    id: "noir",
    label: "noir",
    css: "grayscale(1) contrast(1.3) brightness(0.88)",
  },
  {
    id: "sunset",
    label: "sunset",
    css: "sepia(0.4) saturate(1.35) hue-rotate(-20deg) brightness(1.05)",
  },
  {
    id: "film",
    label: "film",
    css: "sepia(0.22) contrast(1.12) saturate(0.85) brightness(0.96)",
  },
  {
    id: "moody",
    label: "moody",
    css: "brightness(0.85) saturate(1.25) contrast(1.15)",
  },
  {
    id: "bright",
    label: "bright",
    css: "brightness(1.15) saturate(1.2) contrast(1.04)",
  },
  {
    id: "twilight",
    label: "twilight",
    css: "hue-rotate(20deg) saturate(1.2) brightness(0.95) contrast(1.05)",
  },
];

// Compute the effective frame/filter for a photo. Three states per
// column on the photo row:
//   null  → inherit (fall back to album's value, else nothing)
//   ""    → explicit no decoration (override an album default off)
//   id    → explicit preset override
// Frame width follows the same rule (migration 0021); photos that
// don't override inherit the album's width.
function resolveOne(photoValue: string | null, albumValue: string | null) {
  if (photoValue === null) return albumValue ?? null; // inherit
  if (photoValue === "") return null; // explicit none
  return photoValue;
}

export function resolveDecoration(
  photo: {
    cover_frame: string | null;
    cover_filter: string | null;
    cover_frame_width?: string | null;
  },
  album: {
    cover_frame: string | null;
    cover_filter: string | null;
    cover_frame_width?: string;
  } | null
): {
  frame: string | null;
  filter: string | null;
  frameWidth: FrameSize;
} {
  const photoWidth =
    typeof photo.cover_frame_width === "string" &&
    photo.cover_frame_width.length > 0
      ? photo.cover_frame_width
      : null;
  const albumWidth = album?.cover_frame_width ?? null;
  const resolvedWidth = photoWidth ?? albumWidth;
  return {
    frame: resolveOne(photo.cover_frame, album?.cover_frame ?? null),
    filter: resolveOne(photo.cover_filter, album?.cover_filter ?? null),
    frameWidth: isFrameSize(resolvedWidth) ? resolvedWidth : "medium",
  };
}

// Lookup helpers — return empty string for unknown ids so renderer
// treats stale/typo'd values as "no decoration" instead of throwing.
export function frameOverlayFor(
  id: string | null | undefined,
  size: string | null | undefined = "medium"
): string {
  if (!id) return "";
  const preset = FRAMES.find((f) => f.id === id);
  if (!preset) return "";
  const sz = isFrameSize(size) ? size : "medium";
  return preset.sizes[sz] ?? "";
}

export function filterCssFor(id: string | null | undefined): string {
  if (!id) return "";
  return FILTERS.find((f) => f.id === id)?.css ?? "";
}

/** Positioning classes for the photo element when the chosen frame
 *  has solid borders that should sit OUTSIDE the photo (mat, polaroid,
 *  rounded mat, etc) — the photo shrinks to fit inside the frame's
 *  inner edge instead of bleeding past it. Returns empty string for
 *  decorative frames where the photo should stay at full size (so
 *  dashed / dotted / inset-shadow gaps reveal the photo content). */
export function frameInsetFor(
  id: string | null | undefined,
  size: string | null | undefined = "medium"
): string {
  if (!id) return "";
  const preset = FRAMES.find((f) => f.id === id);
  if (!preset?.insets) return "";
  const sz = isFrameSize(size) ? size : "medium";
  return preset.insets[sz] ?? "";
}

/** Padding-class equivalent of {@link frameInsetFor}, for use on
 *  wrappers around in-flow `<img>` elements (masonry photo grid,
 *  lightbox). The padding shrinks the image's content area to sit
 *  inside the frame while the frame overlay still spans the full
 *  wrapper bounds. */
export function framePadFor(
  id: string | null | undefined,
  size: string | null | undefined = "medium"
): string {
  if (!id) return "";
  const preset = FRAMES.find((f) => f.id === id);
  if (!preset?.pads) return "";
  const sz = isFrameSize(size) ? size : "medium";
  return preset.pads[sz] ?? "";
}

/** Outer corner-radius class for the cover/photo wrapper, matching
 *  the chosen frame's outermost curve. Use on a wrapper that has
 *  `overflow-hidden` so the photo and bg clip along the frame's
 *  shape — avoids the small-radius outline showing past a bigger
 *  / square frame outline. Returns empty for decorative frames. */
export function frameOuterRadiusFor(
  id: string | null | undefined,
  size: string | null | undefined = "medium"
): string {
  if (!id) return "";
  const preset = FRAMES.find((f) => f.id === id);
  if (!preset?.outerRadius) return "";
  const sz = isFrameSize(size) ? size : "medium";
  return preset.outerRadius[sz] ?? "";
}

/** Tailwind bg class to fill the wrapper underneath a solid frame so
 *  any "mat" gap (e.g. object-contain letterbox in the lightbox)
 *  shows the frame's color instead of the page bg behind it. */
export function frameMatBgFor(
  id: string | null | undefined
): string {
  if (!id) return "";
  const preset = FRAMES.find((f) => f.id === id);
  return preset?.matBg ?? "";
}
