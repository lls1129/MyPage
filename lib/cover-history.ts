// localStorage-backed history of recently pinned cover image URLs.
// Single-admin site, so per-browser is fine — no DB row needed.
// Scoped by album so each album surfaces only the URLs you've actually
// tried on that album (matches admin's mental model: "what have I
// tried as the cover for this collection?"). The library kind is
// kept in the key for namespace safety against future use cases.

const KEY_PREFIX = "cover-history:";
const LIMIT = 12;

export type LibraryKind = "photos" | "astrophotos";

function keyFor(kind: LibraryKind, albumId: string): string {
  return `${KEY_PREFIX}${kind}:${albumId}`;
}

function readRaw(kind: LibraryKind, albumId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(keyFor(kind, albumId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
  } catch {
    return [];
  }
}

function writeRaw(kind: LibraryKind, albumId: string, urls: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(kind, albumId), JSON.stringify(urls));
  } catch {
    // localStorage disabled or full — best effort, ignore.
  }
}

export function getCoverHistory(kind: LibraryKind, albumId: string): string[] {
  if (!albumId) return [];
  return readRaw(kind, albumId);
}

export function addToCoverHistory(
  kind: LibraryKind,
  albumId: string,
  url: string
): string[] {
  if (!albumId || !url) return getCoverHistory(kind, albumId);
  // Move-to-front: drop any existing copy of url, prepend, cap at LIMIT.
  const existing = readRaw(kind, albumId).filter((u) => u !== url);
  const next = [url, ...existing].slice(0, LIMIT);
  writeRaw(kind, albumId, next);
  return next;
}

export function removeFromCoverHistory(
  kind: LibraryKind,
  albumId: string,
  url: string
): string[] {
  if (!albumId) return [];
  const next = readRaw(kind, albumId).filter((u) => u !== url);
  writeRaw(kind, albumId, next);
  return next;
}
