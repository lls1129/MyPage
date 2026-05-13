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
    id: "mat",
    label: "mat",
    overlayClassName: "border-[10px] border-cream rounded-md",
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
