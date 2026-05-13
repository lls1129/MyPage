"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { storageRefFromUrl } from "@/lib/supabase/storage-utils";
import { slugify } from "@/lib/supabase/albums";

const BUCKET = "photos";

function parseTagsCsv(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export async function updatePhotoMeta(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const caption = String(formData.get("caption") ?? "").trim();
  const tagsRaw = String(formData.get("tags") ?? "");
  // Empty string means "uncategorized"; a uuid means assign to that album.
  const albumIdRaw = formData.get("album_id");
  const albumId =
    typeof albumIdRaw === "string" && albumIdRaw !== ""
      ? albumIdRaw
      : null;
  if (!id) return { ok: false, error: "Missing id." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("photos")
    .update({
      caption,
      tags: parseTagsCsv(tagsRaw),
      album_id: albumId,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/photos");
  revalidatePath(`/photos/album/[slug]`, "page");
  return { ok: true };
}

// Override a photo's frame/filter. NULL on a column means "inherit
// the album's setting" — see resolveDecoration() in
// lib/supabase/photos.ts for the fallback rule.
export async function setPhotoDecorations(
  id: string,
  patch: { frame?: string | null; filter?: string | null }
) {
  await requireAdmin();
  if (!id) return { ok: false as const, error: "missing photo id" };
  const updates: Record<string, string | null> = {};
  if ("frame" in patch) updates.cover_frame = patch.frame ?? null;
  if ("filter" in patch) updates.cover_filter = patch.filter ?? null;
  if (Object.keys(updates).length === 0) return { ok: true as const };
  const admin = createAdminClient();
  const { error } = await admin.from("photos").update(updates).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/photos");
  revalidatePath(`/photos/album/[slug]`, "page");
  return { ok: true as const };
}

export async function togglePhotoHidden(id: string, nextHidden: boolean) {
  await requireAdmin();
  if (!id) return { ok: false, error: "Missing id." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("photos")
    .update({ hidden: nextHidden })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/photos");
  return { ok: true };
}

export async function rotatePhoto(id: string, direction: "left" | "right") {
  await requireAdmin();
  if (!id) return { ok: false, error: "Missing id." };

  const admin = createAdminClient();
  const { data: row, error: fetchErr } = await admin
    .from("photos")
    .select("rotation")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };

  const current = ((row?.rotation ?? 0) + 360) % 360;
  const next = direction === "right" ? (current + 90) % 360 : (current + 270) % 360;

  const { error } = await admin
    .from("photos")
    .update({ rotation: next })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/photos");
  return { ok: true };
}

export async function deletePhoto(id: string) {
  await requireAdmin();
  if (!id) return { ok: false as const, error: "Missing id." };

  const admin = createAdminClient();

  // Look up the storage path + album link so we can clean up the
  // file AND detect any cover impact (pinned or auto-picked).
  const { data: row, error: fetchError } = await admin
    .from("photos")
    .select("image_url, album_id, hidden")
    .eq("id", id)
    .maybeSingle();
  if (fetchError)
    return { ok: false as const, error: fetchError.message };

  // Names of albums whose pinned cover gets cleared during this
  // delete, OR whose auto-picked cover changes because this photo
  // was the latest non-hidden member. Returned to the caller so
  // admin can be notified either way.
  let clearedCovers: string[] = [];

  if (row?.image_url) {
    const ref = storageRefFromUrl(row.image_url);
    if (ref) {
      // Read bucket from URL so converted rows (where the file may live in
      // a different bucket) still get cleaned up correctly.
      await admin.storage.from(ref.bucket).remove([ref.key]);
    }
    // Cover-orphan cleanup: any album currently pinning this URL as
    // its cover loses the pin (falls back to auto-pick / gradient),
    // and any cover_history entry for this URL is dropped so the
    // dead URL can't be re-pinned with one click later. Best-effort
    // — failures here don't block the photo delete.
    clearedCovers = await cleanupCoverReferences(admin, row.image_url);

    // Also surface auto-pick changes: when a photos-kind album has
    // no pinned cover and this photo was the latest non-hidden
    // member, deleting it shifts the auto-pick to the previous
    // photo. There's nothing to clean up in the DB (auto-pick is
    // computed at read time) but admin should still know.
    if (row.album_id && !row.hidden) {
      const autoName = await detectAutoPickImpact(
        admin,
        row.album_id as string,
        id,
        "photos"
      );
      if (autoName && !clearedCovers.includes(autoName)) {
        clearedCovers.push(autoName);
      }
    }
  }

  const { error: deleteError } = await admin
    .from("photos")
    .delete()
    .eq("id", id);
  if (deleteError)
    return { ok: false as const, error: deleteError.message };

  revalidatePath("/photos");
  revalidatePath(`/photos/album/[slug]`, "page");
  return { ok: true as const, clearedCovers };
}

// Returns the album's name if the about-to-be-deleted photo is its
// current auto-picked cover (album has no pinned cover_image_url AND
// this photo is the latest non-hidden member). Used by the delete
// flow to notify admin when the visual cover will change even
// though no DB cleanup was needed. table is "photos" or
// "astrophotos" depending on the caller.
async function detectAutoPickImpact(
  admin: ReturnType<typeof createAdminClient>,
  albumId: string,
  photoId: string,
  table: "photos" | "astrophotos"
): Promise<string | null> {
  try {
    // Only matters when the album has no pinned cover; otherwise
    // the auto-pick isn't what visitors are seeing anyway.
    const { data: album } = await admin
      .from("albums")
      .select("name, cover_image_url")
      .eq("id", albumId)
      .maybeSingle();
    if (!album || album.cover_image_url) return null;

    const { data: latest } = await admin
      .from(table)
      .select("id")
      .eq("album_id", albumId)
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest?.id === photoId) {
      return album.name as string;
    }
    return null;
  } catch {
    return null;
  }
}

// Strip a URL from every album row that references it — both as
// the pinned cover and as a recent-history entry. Run from the
// service-role client so RLS doesn't filter rows out. Returns the
// names of albums whose pinned cover was cleared (used for the
// "deleted photo was the cover for X" notification). Best-effort:
// errors are swallowed (the delete shouldn't fail because of a
// cleanup hiccup).
async function cleanupCoverReferences(
  admin: ReturnType<typeof createAdminClient>,
  url: string
): Promise<string[]> {
  const clearedNames: string[] = [];
  try {
    // First pass: find albums currently using this URL as a pinned
    // cover so we can report them back to the caller.
    const { data: pinned } = await admin
      .from("albums")
      .select("id, name")
      .eq("cover_image_url", url);
    if (Array.isArray(pinned)) {
      for (const a of pinned) clearedNames.push(a.name as string);
    }

    // Clear cover_image_url on any album using this URL. The reset
    // also restores crop fields so the next pinned cover starts
    // fresh.
    await admin
      .from("albums")
      .update({
        cover_image_url: null,
        cover_crop_x: 0,
        cover_crop_y: 0,
        cover_crop_w: 1,
        cover_crop_h: 1,
      })
      .eq("cover_image_url", url);

    // cover_history is jsonb — fetch all rows and filter
    // client-side. Cheaper than getting the `contains` query right
    // for objects-with-extra-fields, and the albums table is small
    // on this site. Write back only when an entry was actually
    // removed to keep this a no-op when there's nothing to do.
    const { data: allAlbums } = await admin
      .from("albums")
      .select("id, cover_history");
    if (Array.isArray(allAlbums)) {
      for (const row of allAlbums) {
        const history = Array.isArray(row.cover_history)
          ? (row.cover_history as { url: string }[])
          : [];
        const next = history.filter((e) => e?.url !== url);
        if (next.length !== history.length) {
          await admin
            .from("albums")
            .update({ cover_history: next })
            .eq("id", row.id);
        }
      }
    }
  } catch {
    // Swallow — the photo delete itself succeeded, cleanup is a nicety.
  }
  return clearedNames;
}

// Create a new album in the "photos" library. Returns the new row so
// the caller can update its UI immediately.
export async function createPhotoAlbum(name: string) {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, error: "name required" };
  const slug = slugify(trimmed);
  if (!slug) return { ok: false as const, error: "name produces an empty slug" };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("albums")
    .insert({ name: trimmed, slug, kind: "photos" })
    .select()
    .single();
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/photos");
  return { ok: true as const, album: data };
}

// Rename a photo album. Regenerates the slug from the new name so the
// /photos/album/[slug] URL matches what the admin typed; old URLs 404.
export async function renamePhotoAlbum(id: string, newName: string) {
  await requireAdmin();
  if (!id) return { ok: false as const, error: "missing album id" };
  const trimmed = newName.trim();
  if (!trimmed) return { ok: false as const, error: "name required" };
  const slug = slugify(trimmed);
  if (!slug) return { ok: false as const, error: "name produces an empty slug" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("albums")
    .update({ name: trimmed, slug })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/photos");
  revalidatePath(`/photos/album/[slug]`, "page");
  return { ok: true as const };
}

// Set the square crop rectangle for a photo album's cover. Coords are
// normalized to source W/H, and the UI is responsible for keeping the
// rect square in source pixels (w*sourceW == h*sourceH). Default
// (0,0,1,1) means "no crop" — the renderer falls back to object-cover.
export async function setPhotoAlbumCoverCrop(
  id: string,
  crop: { x: number; y: number; w: number; h: number }
) {
  await requireAdmin();
  if (!id) return { ok: false as const, error: "missing album id" };
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const admin = createAdminClient();
  const { error } = await admin
    .from("albums")
    .update({
      cover_crop_x: clamp(crop.x),
      cover_crop_y: clamp(crop.y),
      cover_crop_w: clamp(crop.w),
      cover_crop_h: clamp(crop.h),
    })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/photos");
  revalidatePath(`/photos/album/[slug]`, "page");
  return { ok: true as const };
}

// Set or clear the cover image URL for a photo album. Pass null to
// clear (cover falls back to auto-picked most-recent photo). When the
// cover changes (pin a new image OR clear), the existing crop is no
// longer meaningful — reset it to the trivial default so the new
// cover renders as object-cover until admin re-crops.
export async function setPhotoAlbumCover(
  id: string,
  coverUrl: string | null
) {
  await requireAdmin();
  if (!id) return { ok: false as const, error: "missing album id" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("albums")
    .update({
      cover_image_url: coverUrl,
      cover_crop_x: 0,
      cover_crop_y: 0,
      cover_crop_w: 1,
      cover_crop_h: 1,
    })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/photos");
  revalidatePath(`/photos/album/[slug]`, "page");
  return { ok: true as const };
}

// Hide or unhide a photo album. Hidden albums vanish from public
// listings but stay visible to admin with a "hidden" badge.
export async function setPhotoAlbumHidden(id: string, hidden: boolean) {
  await requireAdmin();
  if (!id) return { ok: false as const, error: "missing album id" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("albums")
    .update({ hidden })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/photos");
  revalidatePath(`/photos/album/[slug]`, "page");
  return { ok: true as const };
}

// Delete a photo album. Photos in the album fall back to uncategorized
// via the album_id FK's ON DELETE SET NULL.
export async function deletePhotoAlbum(id: string) {
  await requireAdmin();
  if (!id) return { ok: false as const, error: "missing album id" };
  const admin = createAdminClient();
  const { error } = await admin.from("albums").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/photos");
  return { ok: true as const };
}

// Set decoration presets (frame, filter) on a photo album cover.
// Partial: only fields present in the patch are updated, so the UI
// can change one knob without touching the other. Pass `null` to
// clear a field.
export async function setPhotoAlbumCoverDecorations(
  id: string,
  patch: {
    frame?: string | null;
    filter?: string | null;
    frame_width?: string;
  }
) {
  await requireAdmin();
  if (!id) return { ok: false as const, error: "missing album id" };
  const updates: Record<string, string | null> = {};
  if ("frame" in patch) updates.cover_frame = patch.frame ?? null;
  if ("filter" in patch) updates.cover_filter = patch.filter ?? null;
  if ("frame_width" in patch && patch.frame_width)
    updates.cover_frame_width = patch.frame_width;
  if (Object.keys(updates).length === 0) return { ok: true as const };
  const admin = createAdminClient();
  const { error } = await admin.from("albums").update(updates).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/photos");
  revalidatePath(`/photos/album/[slug]`, "page");
  return { ok: true as const };
}

// Replace a photo album's cover_history. The client computes the
// next array using the helpers in lib/cover-history.ts and ships
// the whole thing — keeps the server side trivially correct, and
// dragging a crop on one device shows up as a recent on another.
export async function setPhotoAlbumCoverHistory(
  id: string,
  entries: unknown
) {
  await requireAdmin();
  if (!id) return { ok: false as const, error: "missing album id" };
  if (!Array.isArray(entries))
    return { ok: false as const, error: "history must be an array" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("albums")
    .update({ cover_history: entries })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/photos");
  revalidatePath(`/photos/album/[slug]`, "page");
  return { ok: true as const };
}

// Assign a photo to an album (or null to make it uncategorized).
export async function setPhotoAlbum(
  photoId: string,
  albumId: string | null
) {
  await requireAdmin();
  if (!photoId) return { ok: false as const, error: "missing photo id" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("photos")
    .update({ album_id: albumId })
    .eq("id", photoId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/photos");
  if (albumId) revalidatePath(`/photos/album/[slug]`, "page");
  return { ok: true as const };
}

// Move a photo row from `photos` into `astrophotos`. The file in Storage
// stays where it is — only the DB row migrates. The destination album's
// object_name defaults to the source caption (admin can edit afterward).
export async function convertPhotoToAstrophoto(id: string) {
  await requireAdmin();
  if (!id) return { ok: false, error: "Missing id." };

  const admin = createAdminClient();
  const { data: row, error: fetchErr } = await admin
    .from("photos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!row) return { ok: false, error: "Photo not found." };

  const caption: string = row.caption ?? "";
  const objectName = caption.trim().slice(0, 80) || "untitled";

  const { error: insertErr } = await admin.from("astrophotos").insert({
    image_url: row.image_url,
    object_name: objectName,
    caption,
    taken_at: row.taken_at,
    hidden: row.hidden,
    rotation: row.rotation ?? 0,
    width: row.width,
    height: row.height,
  });
  if (insertErr) return { ok: false, error: insertErr.message };

  const { error: deleteErr } = await admin.from("photos").delete().eq("id", id);
  if (deleteErr) {
    return {
      ok: false,
      error: `Inserted into astrophotos but couldn't delete original: ${deleteErr.message}`,
    };
  }

  revalidatePath("/photos");
  revalidatePath("/astronomy");
  return { ok: true };
}
