import { readSupabaseEnv } from "./env";
import { createClient } from "./server";
import { createAdminClient, isAdminConfigured } from "./admin";

export type AlbumKind = "photos" | "astrophotos";

export type Album = {
  id: string;
  name: string;
  slug: string;
  kind: AlbumKind;
  created_at: string;
};

// Cover photo metadata, picked at read time as the most recent
// (non-hidden) photo in the album. Used by the library page to render
// the album card.
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

// Public listing of albums for a given library. Sorted alphabetically.
export async function listAlbums(kind: AlbumKind): Promise<Album[]> {
  const { configured } = readSupabaseEnv();
  if (!configured) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("albums")
      .select("*")
      .eq("kind", kind)
      .order("name", { ascending: true });
    if (error) return [];
    return (data ?? []) as Album[];
  } catch {
    return [];
  }
}

// Albums + auto-picked cover image for each (most recent non-hidden
// photo in that album) + count of non-hidden photos. Empty albums get
// cover_image_url=null but stay in the list so the admin can see them.
export async function listAlbumsWithCovers(
  kind: AlbumKind,
  isAdmin: boolean
): Promise<AlbumWithCover[]> {
  const albums = await listAlbums(kind);
  if (albums.length === 0) return [];

  const { configured } = readSupabaseEnv();
  if (!configured) {
    return albums.map((a) => ({ ...a, cover_image_url: null, count: 0 }));
  }
  // Admin can see hidden rows; public RLS hides them already.
  const supabase = isAdmin && isAdminConfigured()
    ? createAdminClient()
    : await createClient();
  const table = kind === "photos" ? "photos" : "astrophotos";

  // Pull (album_id, image_url, created_at, hidden) for all rows in
  // these albums, then group client-side. Cheaper than N round-trips.
  const ids = albums.map((a) => a.id);
  const { data, error } = await supabase
    .from(table)
    .select("album_id,image_url,created_at,hidden")
    .in("album_id", ids)
    .order("created_at", { ascending: false });
  if (error || !data) {
    return albums.map((a) => ({ ...a, cover_image_url: null, count: 0 }));
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
    return { ...a, cover_image_url: info.cover, count: info.count };
  });
}

export async function getAlbumBySlug(
  kind: AlbumKind,
  slug: string
): Promise<Album | null> {
  const { configured } = readSupabaseEnv();
  if (!configured) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("albums")
      .select("*")
      .eq("kind", kind)
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data) return null;
    return data as Album;
  } catch {
    return null;
  }
}
