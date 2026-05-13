// localStorage-backed history of recently pinned cover image URLs +
// recent crops for each URL. Single-admin site, so per-browser is
// fine — no DB row needed. Scoped by album so each album surfaces
// only the URLs/crops you've tried on that specific collection.

const KEY_PREFIX = "cover-history:";
const URL_LIMIT = 12;
const CROPS_PER_URL_LIMIT = 6;

export type LibraryKind = "photos" | "astrophotos";

export type CoverCrop = { x: number; y: number; w: number; h: number };

export type HistoryEntry = { url: string; crops: CoverCrop[] };

function keyFor(kind: LibraryKind, albumId: string): string {
  return `${KEY_PREFIX}${kind}:${albumId}`;
}

function isCrop(v: unknown): v is CoverCrop {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.x === "number" &&
    typeof o.y === "number" &&
    typeof o.w === "number" &&
    typeof o.h === "number"
  );
}

function sameCrop(a: CoverCrop, b: CoverCrop): boolean {
  // Round to 4 decimals before comparing — crops set via drag get
  // tiny FP noise that shouldn't fragment the recent-crops list.
  const r = (n: number) => Math.round(n * 10000) / 10000;
  return r(a.x) === r(b.x) && r(a.y) === r(b.y) && r(a.w) === r(b.w) && r(a.h) === r(b.h);
}

function isTrivial(c: CoverCrop): boolean {
  return c.x === 0 && c.y === 0 && c.w === 1 && c.h === 1;
}

function readRaw(kind: LibraryKind, albumId: string): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(keyFor(kind, albumId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): HistoryEntry | null => {
        // Back-compat: older versions stored a flat string[] of URLs.
        if (typeof item === "string" && item.length > 0) {
          return { url: item, crops: [] };
        }
        if (!item || typeof item !== "object") return null;
        const o = item as Record<string, unknown>;
        if (typeof o.url !== "string" || o.url.length === 0) return null;
        const crops = Array.isArray(o.crops) ? o.crops.filter(isCrop) : [];
        return { url: o.url, crops };
      })
      .filter((x): x is HistoryEntry => x !== null);
  } catch {
    return [];
  }
}

function writeRaw(
  kind: LibraryKind,
  albumId: string,
  entries: HistoryEntry[]
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      keyFor(kind, albumId),
      JSON.stringify(entries)
    );
  } catch {
    // localStorage disabled or full — best effort, ignore.
  }
}

export function getCoverHistory(
  kind: LibraryKind,
  albumId: string
): HistoryEntry[] {
  if (!albumId) return [];
  return readRaw(kind, albumId);
}

export function getCropsForUrl(
  kind: LibraryKind,
  albumId: string,
  url: string
): CoverCrop[] {
  if (!albumId || !url) return [];
  const entry = readRaw(kind, albumId).find((e) => e.url === url);
  return entry ? entry.crops : [];
}

// Move the URL to the front of the recent list, preserving its crops.
export function addToCoverHistory(
  kind: LibraryKind,
  albumId: string,
  url: string
): HistoryEntry[] {
  if (!albumId || !url) return getCoverHistory(kind, albumId);
  const existing = readRaw(kind, albumId);
  const prior = existing.find((e) => e.url === url);
  const rest = existing.filter((e) => e.url !== url);
  const moved: HistoryEntry = prior ?? { url, crops: [] };
  const next = [moved, ...rest].slice(0, URL_LIMIT);
  writeRaw(kind, albumId, next);
  return next;
}

// Record a crop applied to a URL. Skips the trivial (no-crop)
// rectangle since it's the default state — showing "no crop" as a
// recent option isn't useful.
export function addCropToCoverHistory(
  kind: LibraryKind,
  albumId: string,
  url: string,
  crop: CoverCrop
): HistoryEntry[] {
  if (!albumId || !url) return getCoverHistory(kind, albumId);
  if (isTrivial(crop)) return getCoverHistory(kind, albumId);
  const existing = readRaw(kind, albumId);
  const prior = existing.find((e) => e.url === url);
  const rest = existing.filter((e) => e.url !== url);
  const priorCrops = prior?.crops ?? [];
  // Move-to-front for crops too: drop duplicates first.
  const crops = [
    crop,
    ...priorCrops.filter((c) => !sameCrop(c, crop)),
  ].slice(0, CROPS_PER_URL_LIMIT);
  const next = [{ url, crops }, ...rest].slice(0, URL_LIMIT);
  writeRaw(kind, albumId, next);
  return next;
}

export function removeFromCoverHistory(
  kind: LibraryKind,
  albumId: string,
  url: string
): HistoryEntry[] {
  if (!albumId) return [];
  const next = readRaw(kind, albumId).filter((e) => e.url !== url);
  writeRaw(kind, albumId, next);
  return next;
}
