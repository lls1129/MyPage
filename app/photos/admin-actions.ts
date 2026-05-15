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
// lib/supabase/photos.ts for the fallback rule. `frame_width`
// follows the same null=inherit semantics (migration 0021).
export async function setPhotoDecorations(
  id: string,
  patch: {
    frame?: string | null;
    filter?: string | null;
    frame_width?: string | null;
  }
) {
  await requireAdmin();
  if (!id) return { ok: false as const, error: "missing photo id" };
  const updates: Record<string, string | null> = {};
  if ("frame" in patch) updates.cover_frame = patch.frame ?? null;
  if ("filter" in patch) updates.cover_filter = patch.filter ?? null;
  if ("frame_width" in patch)
    updates.cover_frame_width = patch.frame_width ?? null;
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

  // Look up the storage path + album link so we can detect cover
  // impact (pinned, auto-picked, in history) without touching the
  // file yet — we keep the storage file around when the URL is
  // still referenced anywhere so pinned covers + history entries
  // keep working after the row is deleted.
  const { data: row, error: fetchError } = await admin
    .from("photos")
    .select("image_url, album_id, hidden")
    .eq("id", id)
    .maybeSingle();
  if (fetchError)
    return { ok: false as const, error: fetchError.message };

  // Two distinct cover-impact lists for the notice:
  //   stillCoverFor — albums where this URL is the pinned cover.
  //     Storage file is preserved so the pinned cover keeps
  //     rendering even after the row is gone; admin can change it
  //     manually on the album page.
  //   autoShiftedFor — albums where this photo was the auto-picked
  //     cover (no pin, latest non-hidden member). After the row is
  //     deleted, auto-pick falls back to the next photo so the
  //     visible cover changes.
  let stillCoverFor: string[] = [];
  let autoShiftedFor: string[] = [];

  if (row?.image_url) {
    // Detect pinned cover usage.
    const { data: pinned } = await admin
      .from("albums")
      .select("name")
      .eq("cover_image_url", row.image_url);
    if (Array.isArray(pinned)) {
      for (const a of pinned) stillCoverFor.push(a.name as string);
    }

    // Detect cover_history usage (any album row whose history
    // includes this URL). Fetch all rows + filter client-side —
    // small table on this site and reliable across jsonb shapes.
    const { data: allAlbums } = await admin
      .from("albums")
      .select("cover_history");
    const inHistory = Array.isArray(allAlbums)
      ? allAlbums.some((r) => {
          const h = Array.isArray(r.cover_history)
            ? (r.cover_history as { url: string }[])
            : [];
          return h.some((e) => e?.url === row.image_url);
        })
      : false;

    // Detect auto-pick: photo's album has no pin and this is the
    // latest non-hidden member.
    if (row.album_id && !row.hidden) {
      const autoName = await detectAutoPickImpact(
        admin,
        row.album_id as string,
        id,
        "photos"
      );
      if (autoName) autoShiftedFor.push(autoName);
    }

    // Storage policy: keep the file around as long as anything
    // references the URL — preserves pinned covers and history
    // re-pin clicks. Otherwise delete normally to avoid orphans.
    const referenced = stillCoverFor.length > 0 || inHistory;
    if (!referenced) {
      const ref = storageRefFromUrl(row.image_url);
      if (ref) {
        await admin.storage.from(ref.bucket).remove([ref.key]);
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
  return {
    ok: true as const,
    stillCoverFor,
    autoShiftedFor,
  };
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

// Set the album's title placement (where name+count renders on the
// card). Accepts any string; the renderer falls back to "below" for
// unknown values so a typo can't blank the title.
export async function setPhotoAlbumTitlePlacement(
  id: string,
  placement: string
) {
  await requireAdmin();
  if (!id) return { ok: false as const, error: "missing album id" };
  if (typeof placement !== "string" || placement.length === 0)
    return { ok: false as const, error: "missing title placement" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("albums")
    .update({ title_placement: placement })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/photos");
  revalidatePath(`/photos/album/[slug]`, "page");
  return { ok: true as const };
}

// Replace a photo album's cover_overlays array. Client computes
// the next array (add / remove / reposition / restyle), ships the
// whole thing. Shape validated by the renderer's normalizer so we
// don't need to deep-validate here — typed `unknown[]` to keep the
// action permissive and let the UI evolve without action churn.
export async function setPhotoAlbumCoverOverlays(
  id: string,
  overlays: unknown
) {
  await requireAdmin();
  if (!id) return { ok: false as const, error: "missing album id" };
  if (!Array.isArray(overlays))
    return { ok: false as const, error: "overlays must be an array" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("albums")
    .update({ cover_overlays: overlays })
    .eq("id", id);
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
