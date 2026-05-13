// Decoration presets for album covers. Single source of truth for
// both the picker UI (chip buttons) and the renderers (card +
// cropper preview).
//
// Adding a preset: drop a new entry below. Class names must appear
// as static string literals here so Tailwind's content scanner picks
// them up — don't compose class names dynamically.

export type FramePreset = {
  id: string;
  label: string;
  /** Classes applied to an overlay div sitting on top of the cover.
   *  The renderer wraps this in `absolute inset-0 pointer-events-none`
   *  so the frame paints over the image without intercepting clicks
   *  or shrinking the cover. */
  overlayClassName: string;
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
    overlayClassName: "border-[4px] border-pink-300 rounded-md",
  },
  {
    id: "dashed",
    label: "dashed",
    overlayClassName: "border-[3px] border-dashed border-pink-400 rounded-md",
  },
  {
    id: "dotted",
    label: "dotted",
    overlayClassName: "border-[3px] border-dotted border-pink-400 rounded-md",
  },
  {
    id: "double",
    label: "double",
    // Concentric pink–white–pink rings via stacked inset shadows.
    overlayClassName:
      "shadow-[inset_0_0_0_3px_#f9a8d4,inset_0_0_0_6px_#ffffff,inset_0_0_0_9px_#f9a8d4] rounded-md",
  },
  {
    id: "mat",
    label: "mat",
    overlayClassName: "border-[10px] border-cream rounded-md",
  },
  {
    id: "polaroid",
    // White border that's heavier on the bottom edge — classic polaroid
    // photo look. The cover still occupies the whole tile; the border
    // crops in on top.
    label: "polaroid",
    overlayClassName: "border-[6px] border-b-[18px] border-white",
  },
  {
    id: "gilt",
    label: "gilt",
    overlayClassName:
      "border-[4px] border-amber-200 shadow-[inset_0_0_0_2px_rgba(239,159,39,0.35)] rounded-md",
  },
  {
    id: "vignette",
    label: "vignette",
    overlayClassName:
      "shadow-[inset_0_0_24px_8px_rgba(64,40,82,0.45)] rounded-md",
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
];

// Lookup helpers — return empty string for unknown ids so renderer
// treats stale/typo'd values as "no decoration" instead of throwing.
export function frameOverlayFor(id: string | null | undefined): string {
  if (!id) return "";
  return FRAMES.find((f) => f.id === id)?.overlayClassName ?? "";
}

export function filterCssFor(id: string | null | undefined): string {
  if (!id) return "";
  return FILTERS.find((f) => f.id === id)?.css ?? "";
}
