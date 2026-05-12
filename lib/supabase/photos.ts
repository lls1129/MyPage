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
  width: number | null;
  height: number | null;
  taken_at: string | null;
  created_at: string;
  album_id: string | null;
};

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
      } as Photo);
    }
    return map;
  } catch {
    return map;
  }
}
