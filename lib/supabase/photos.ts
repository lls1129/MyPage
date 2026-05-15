import { readSupabaseEnv } from "./env";
import { createClient } from "./server";
import { createAdminClient, isAdminConfigured } from "./admin";

export type Photo = {
  id: string;
  image_url: string;
  caption: string;
  tags: string[];
  hidden: boolean;
  rotation: number;
  // Horizontal flip toggle — composed with rotation as a CSS
  // transform on display. Source pixels stay untouched.
  flipped: boolean;
  width: number | null;
  height: number | null;
  taken_at: string | null;
  created_at: string;
  album_id: string | null;
  // Per-photo decoration overrides. NULL means "inherit the album
  // setting" — use resolveDecoration() to compute the effective value.
  cover_frame: string | null;
  cover_filter: string | null;
  // Per-photo override for the frame thickness. NULL inherits the
  // album's width. See migration 0021.
  cover_frame_width: string | null;
  // Per-photo overlay layer — same shape as the album cover's
  // cover_overlays. Untyped here (unknown[]) to keep this lib free
  // of UI-layer imports; the renderer normalizes before painting.
  cover_overlays: unknown[];
  // Per-photo crop in source-relative units. Default (0,0,1,1) means
  // "no crop set" — renderer shows the full image. Non-trivial values
  // are applied via positioning math in PhotoGrid + Lightbox (similar
  // to the album cover crop math, but free-form aspect).
  crop_x: number;
  crop_y: number;
  crop_w: number;
  crop_h: number;
};

// resolveDecoration lives in app/components/cover-decorations.ts —
// kept there (instead of here) so client components can import it
// without pulling in this file's server-only Supabase clients.

// True when the photo hasn't had a crop set — renderer should fall
// back to the full image instead of running the inset-image math.
export function isTrivialPhotoCrop(p: {
  crop_x?: number;
  crop_y?: number;
  crop_w?: number;
  crop_h?: number;
}): boolean {
  return (
    (p.crop_x ?? 0) === 0 &&
    (p.crop_y ?? 0) === 0 &&
    (p.crop_w ?? 1) === 1 &&
    (p.crop_h ?? 1) === 1
  );
}

export type PhotosResult =
  | { kind: "ok"; photos: Photo[] }
  | { kind: "unconfigured" }
  | { kind: "schema-missing" }
  | { kind: "error"; message: string };

function classifyError(error: { code?: string; message: string }): PhotosResult {
  // Postgres "undefined_table" is 42P01 over plain Postgres; PostgREST
  // surfaces the same condition as PGRST205 with a "schema cache" message.
  const looksLikeMissingTable =
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist/i.test(error.message) ||
    /schema cache/i.test(error.message);
  if (looksLikeMissingTable) return { kind: "schema-missing" };
  return { kind: "error", message: error.message };
}

// Public listing — RLS hides hidden rows.
export async function listPhotos(): Promise<PhotosResult> {
  const { configured } = readSupabaseEnv();
  if (!configured) return { kind: "unconfigured" };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return classifyError(error);
    return { kind: "ok", photos: (data ?? []) as Photo[] };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

// Admin listing — bypasses RLS via service role, returns hidden rows too.
// Caller is responsible for verifying the user is actually admin.
export async function listAllPhotosAsAdmin(): Promise<PhotosResult> {
  if (!isAdminConfigured()) return { kind: "unconfigured" };
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("photos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return classifyError(error);
    return { kind: "ok", photos: (data ?? []) as Photo[] };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

// Pull the storage object key out of a public Supabase Storage URL so we can
// `storage.remove()` it. Returns null for any URL we can't parse (e.g. seed
// rows that point at picsum.photos) — those just won't have storage cleanup.
export function storageKeyFromPublicUrl(
  url: string,
  bucket: string
): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const tail = url.slice(i + marker.length);
  return tail.split("?")[0] || null;
}

// All unique tags across the photo library, sorted alphabetically. Used
// to power tag-suggestion buttons in the upload form so admin can pick
// from existing tags instead of retyping. Empty/null tag arrays are
// skipped; runs through the service-role client so hidden rows count too.
export async function listAllTags(): Promise<string[]> {
  if (!isAdminConfigured()) return [];
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("photos").select("tags");
    if (error || !data) return [];
    const set = new Set<string>();
    for (const row of data) {
      const tags = (row.tags ?? []) as string[];
      for (const t of tags) {
        const trimmed = t.trim();
        if (trimmed) set.add(trimmed);
      }
    }
    return Array.from(set).sort();
  } catch {
    return [];
  }
}

// Lookup helper used by the explorer for both card thumbnails and pin-panel
// linked-photo display. Returns full Photo objects so the lightbox can render
// caption / date / tags too. Public read (anon-RLS so hidden photos are
// excluded) — no admin requirement.
export async function fetchPhotosByIds(
  ids: string[]
): Promise<Map<string, Photo>> {
  const map = new Map<string, Photo>();
  if (ids.length === 0) return map;
  const { configured } = readSupabaseEnv();
  if (!configured) return map;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .in("id", ids);
    if (error || !data) return map;
    for (const row of data) {
      map.set(row.id, {
        ...row,
        photo_ids: row.photo_ids ?? [],
        rotation: row.rotation ?? 0,
        flipped: Boolean(row.flipped),
        cover_overlays: Array.isArray(row.cover_overlays)
          ? row.cover_overlays
          : [],
      } as Photo);
    }
    return map;
  } catch {
    return map;
  }
}
