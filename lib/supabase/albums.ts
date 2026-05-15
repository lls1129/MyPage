import { readSupabaseEnv } from "./env";
import { createClient } from "./server";
import { createAdminClient, isAdminConfigured } from "./admin";

export type AlbumKind = "photos" | "astrophotos";

// Defensive cast: `numeric` comes back from PostgREST as number in
// most cases but can be a string. Coerce + clamp to [0,1] with a
// fallback when missing/NaN so pre-migration rows still render.
function coerceCrop(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function isRecentCrop(v: unknown): v is RecentCrop {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.x === "number" &&
    typeof o.y === "number" &&
    typeof o.w === "number" &&
    typeof o.h === "number"
  );
}

function coerceHistory(raw: unknown): CoverHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): CoverHistoryEntry | null => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      if (typeof o.url !== "string" || o.url.length === 0) return null;
      // Each entry's `crops` array can mix two shapes: the original
      // bare CoverCrop ({x,y,w,h}) from before overlays were tracked
      // per crop, and the newer RecentCrop ({x,y,w,h,overlays}).
      // Both pass isRecentCrop; the overlays field is just dropped
      // for older shape rows, defaulting to undefined.
      const crops = Array.isArray(o.crops)
        ? o.crops.filter(isRecentCrop).map(
            (c): RecentCrop => ({
              x: c.x,
              y: c.y,
              w: c.w,
              h: c.h,
              overlays: Array.isArray(
                (c as unknown as { overlays?: unknown }).overlays
              )
                ? ((c as unknown as { overlays: unknown[] }).overlays)
                : undefined,
            })
          )
        : [];
      return { url: o.url, crops };
    })
    .filter((x): x is CoverHistoryEntry => x !== null);
}

function normalizeAlbum(row: Record<string, unknown>): Album {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    kind: row.kind as AlbumKind,
    cover_image_url: (row.cover_image_url as string | null) ?? null,
    cover_crop_x: coerceCrop(row.cover_crop_x, 0),
    cover_crop_y: coerceCrop(row.cover_crop_y, 0),
    cover_crop_w: coerceCrop(row.cover_crop_w, 1),
    cover_crop_h: coerceCrop(row.cover_crop_h, 1),
    cover_history: coerceHistory(row.cover_history),
    cover_frame:
      typeof row.cover_frame === "string" && row.cover_frame.length > 0
        ? row.cover_frame
        : null,
    cover_filter:
      typeof row.cover_filter === "string" && row.cover_filter.length > 0
        ? row.cover_filter
        : null,
    cover_frame_width:
      typeof row.cover_frame_width === "string" &&
      row.cover_frame_width.length > 0
        ? row.cover_frame_width
        : "medium",
    cover_overlays: Array.isArray(row.cover_overlays)
      ? (row.cover_overlays as unknown[])
      : [],
    title_placement:
      typeof row.title_placement === "string" &&
      row.title_placement.length > 0
        ? row.title_placement
        : "below",
    title_style:
      row.title_style && typeof row.title_style === "object"
        ? (row.title_style as Record<string, unknown>)
        : {},
    hidden: Boolean(row.hidden),
    created_at: row.created_at as string,
  };
}

// True when the album hasn't had a crop set — renderer should fall
// back to object-cover (centered) instead of the explicit-crop math
// (which needs the source aspect to match w/h).
export function isTrivialCrop(a: {
  cover_crop_x: number;
  cover_crop_y: number;
  cover_crop_w: number;
  cover_crop_h: number;
}): boolean {
  return (
    a.cover_crop_x === 0 &&
    a.cover_crop_y === 0 &&
    a.cover_crop_w === 1 &&
    a.cover_crop_h === 1
  );
}

export type CoverCrop = { x: number; y: number; w: number; h: number };

// An entry in an album's cover_history.crops list. Stores the crop
// itself plus an optional snapshot of the overlays applied at the
// moment this crop was committed — re-applying the crop later
// restores both. `overlays` is intentionally untyped (unknown[])
// here so this lib stays free of UI-layer imports; the renderer
// runs each entry through normalizeOverlays before painting.
export type RecentCrop = {
  x: number;
  y: number;
  w: number;
  h: number;
  overlays?: unknown[];
};

export type CoverHistoryEntry = { url: string; crops: RecentCrop[] };

export type Album = {
  id: string;
  name: string;
  slug: string;
  kind: AlbumKind;
  cover_image_url: string | null;
  // Square crop of the source cover image, normalized to source W/H.
  // Constraint enforced by the cropper UI: w*sourceW == h*sourceH, so
  // the cropped region is square in source pixels. Defaults (0,0,1,1)
  // are the "no crop set" sentinel — renderer falls back to object-
  // cover (centered) which doesn't need to know source dimensions.
  cover_crop_x: number;
  cover_crop_y: number;
  cover_crop_w: number;
  cover_crop_h: number;
  // Recently-pinned cover URLs (and their applied crops) for this
  // album. Persisted in the DB so admin sees the same list on any
  // device. App-level cap is 12 URLs × 6 crops each.
  cover_history: CoverHistoryEntry[];
  // Decoration presets applied to the cover render. IDs live in
  // app/components/cover-decorations.ts; the renderer maps them to
  // Tailwind classes and CSS filter strings. Null = none.
  cover_frame: string | null;
  cover_filter: string | null;
  // Scaling factor for the frame overlay — see FRAME_WIDTHS in
  // app/components/cover-decorations.ts. Default "medium" matches
  // pre-0018 rendering. Photos that inherit (or override) this
  // album's frame also inherit this width.
  cover_frame_width: string;
  // Free-form overlay layer on top of the cover: stickers,
  // captions, highlights. Stored as a jsonb array; shape is
  // documented in app/components/cover-overlays.ts. Untyped here
  // (unknown[]) to keep the lib free of UI-layer imports.
  cover_overlays: unknown[];
  // Where the album's name + count render on its card. See
  // migration 0020 for the value set; unknown values fall back to
  // "below" in the renderer.
  title_placement: string;
  // Optional styling tuners for the title strip. Shape documented
  // in migration 0022. Renderer falls back to per-placement
  // defaults for any missing field so existing rows ({}) render
  // unchanged.
  title_style: Record<string, unknown>;
  hidden: boolean;
  created_at: string;
};

// Cover image + count of non-hidden photos for an album. Cover resolves
// in priority order: explicit cover_image_url → most recent non-hidden
// photo in the album → null (the card renders a gradient + initial).
export type AlbumWithCover = Album & {
  cover_image_url: string | null;
  count: number;
};

// URL-safe slug from a name. Lowercased, ASCII-ish, hyphens. Adequate
// for v1 — admin can rename if it collides.
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// List albums for a given library. Public RLS already hides
// hidden albums; pass `includeHidden=true` (admin context only) to
// fetch them all via the service-role client.
export async function listAlbums(
  kind: AlbumKind,
  includeHidden = false
): Promise<Album[]> {
  const { configured } = readSupabaseEnv();
  if (!configured) return [];
  try {
    const client =
      includeHidden && isAdminConfigured()
        ? createAdminClient()
        : await createClient();
    const { data, error } = await client
      .from("albums")
      .select("*")
      .eq("kind", kind)
      .order("name", { ascending: true });
    if (error) return [];
    return (data ?? []).map((r) => normalizeAlbum(r as Record<string, unknown>));
  } catch {
    return [];
  }
}

// Albums + cover image for each. Cover resolves to:
//   1. Album's explicit cover_image_url (admin pinned)
//   2. Most recent non-hidden photo in the album (auto-pick)
//   3. null (card falls back to gradient + initial)
// `count` counts non-hidden photos. Hidden albums included only when
// `isAdmin` is true.
export async function listAlbumsWithCovers(
  kind: AlbumKind,
  isAdmin: boolean
): Promise<AlbumWithCover[]> {
  const albums = await listAlbums(kind, isAdmin);
  if (albums.length === 0) return [];

  const { configured } = readSupabaseEnv();
  if (!configured) {
    return albums.map((a) => ({
      ...a,
      cover_image_url: a.cover_image_url ?? null,
      count: 0,
    }));
  }
  const supabase =
    isAdmin && isAdminConfigured()
      ? createAdminClient()
      : await createClient();
  const table = kind === "photos" ? "photos" : "astrophotos";

  // Pull (album_id, image_url, created_at, hidden) for all rows in
  // these albums, then group client-side.
  const ids = albums.map((a) => a.id);
  const { data, error } = await supabase
    .from(table)
    .select("album_id,image_url,created_at,hidden")
    .in("album_id", ids)
    .order("created_at", { ascending: false });
  if (error || !data) {
    return albums.map((a) => ({
      ...a,
      cover_image_url: a.cover_image_url ?? null,
      count: 0,
    }));
  }

  type Row = {
    album_id: string | null;
    image_url: string;
    created_at: string;
    hidden: boolean;
  };
  const byAlbum = new Map<string, { cover: string | null; count: number }>();
  for (const r of data as Row[]) {
    if (!r.album_id) continue;
    if (!isAdmin && r.hidden) continue;
    const cur = byAlbum.get(r.album_id) ?? { cover: null, count: 0 };
    if (!cur.cover && !r.hidden) cur.cover = r.image_url;
    cur.count++;
    byAlbum.set(r.album_id, cur);
  }
  return albums.map((a) => {
    const info = byAlbum.get(a.id) ?? { cover: null, count: 0 };
    return {
      ...a,
      // Explicit cover override wins. Otherwise auto-pick. Otherwise
      // null → card falls back to gradient + initial.
      cover_image_url: a.cover_image_url ?? info.cover,
      count: info.count,
    };
  });
}

export async function getAlbumBySlug(
  kind: AlbumKind,
  slug: string,
  includeHidden = false
): Promise<Album | null> {
  const { configured } = readSupabaseEnv();
  if (!configured) return null;
  try {
    const client =
      includeHidden && isAdminConfigured()
        ? createAdminClient()
        : await createClient();
    const { data, error } = await client
      .from("albums")
      .select("*")
      .eq("kind", kind)
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data) return null;
    return normalizeAlbum(data as Record<string, unknown>);
  } catch {
    return null;
  }
}
