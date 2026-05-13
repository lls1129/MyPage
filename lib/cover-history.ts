// Pure helpers for manipulating an album's cover-history array.
// Storage is now DB-backed (albums.cover_history jsonb), so these
// functions just compute the next array — the caller persists it via
// a server action. Same caps as before: 12 URLs × 6 crops each.

import type { CoverCrop, CoverHistoryEntry } from "@/lib/supabase/albums";

export type { CoverCrop, CoverHistoryEntry } from "@/lib/supabase/albums";

export type LibraryKind = "photos" | "astrophotos";

const URL_LIMIT = 12;
const CROPS_PER_URL_LIMIT = 6;

function sameCrop(a: CoverCrop, b: CoverCrop): boolean {
  // Round to 4 decimals before comparing — crops set via drag get
  // tiny FP noise that shouldn't fragment the recent-crops list.
  const r = (n: number) => Math.round(n * 10000) / 10000;
  return r(a.x) === r(b.x) && r(a.y) === r(b.y) && r(a.w) === r(b.w) && r(a.h) === r(b.h);
}

function isTrivial(c: CoverCrop): boolean {
  return c.x === 0 && c.y === 0 && c.w === 1 && c.h === 1;
}

// Move the URL to the front of the recent list, preserving its crops.
// Returns the next array (does not mutate input).
export function pushUrl(
  entries: CoverHistoryEntry[],
  url: string
): CoverHistoryEntry[] {
  if (!url) return entries;
  const prior = entries.find((e) => e.url === url);
  const rest = entries.filter((e) => e.url !== url);
  const moved: CoverHistoryEntry = prior ?? { url, crops: [] };
  return [moved, ...rest].slice(0, URL_LIMIT);
}

// Record a crop applied to a URL. Skips the trivial (no-crop)
// rectangle since it's the default state — showing "no crop" as a
// recent option isn't useful.
export function pushCrop(
  entries: CoverHistoryEntry[],
  url: string,
  crop: CoverCrop
): CoverHistoryEntry[] {
  if (!url || isTrivial(crop)) return entries;
  const prior = entries.find((e) => e.url === url);
  const rest = entries.filter((e) => e.url !== url);
  const priorCrops = prior?.crops ?? [];
  const crops = [
    crop,
    ...priorCrops.filter((c) => !sameCrop(c, crop)),
  ].slice(0, CROPS_PER_URL_LIMIT);
  return [{ url, crops }, ...rest].slice(0, URL_LIMIT);
}

export function removeUrl(
  entries: CoverHistoryEntry[],
  url: string
): CoverHistoryEntry[] {
  return entries.filter((e) => e.url !== url);
}

export function getCropsForUrl(
  entries: CoverHistoryEntry[],
  url: string
): CoverCrop[] {
  return entries.find((e) => e.url === url)?.crops ?? [];
}
