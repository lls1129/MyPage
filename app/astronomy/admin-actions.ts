"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { storageRefFromUrl } from "@/lib/supabase/storage-utils";
import { slugify } from "@/lib/supabase/albums";

// Create a new album in the "astrophotos" library.
export async function createAstrophotoAlbum(name: string) {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, error: "name required" };
  const slug = slugify(trimmed);
  if (!slug) return { ok: false as const, error: "name produces an empty slug" };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("albums")
    .insert({ name: trimmed, slug, kind: "astrophotos" })
    .select()
    .single();
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/astronomy");
  return { ok: true as const, album: data };
}

// Rename an astrophoto album. Regenerates the slug.
export async function renameAstrophotoAlbum(id: string, newName: string) {
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
  revalidatePath("/astronomy");
  revalidatePath(`/astronomy/album/[slug]`, "page");
  return { ok: true as const };
}

// Set the square crop rectangle for an astrophoto album cover. Coords
// are normalized to source W/H. UI keeps the rect square in source
// pixels (w*sourceW == h*sourceH). Default (0,0,1,1) means "no crop".
export async function setAstrophotoAlbumCoverCrop(
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
  revalidatePath("/astronomy");
  revalidatePath(`/astronomy/album/[slug]`, "page");
  return { ok: true as const };
}

// Set or clear the cover image URL for an astrophoto album. Resets
// the crop too — the previous crop coords were keyed to the old
// image and don't apply to whatever the cover becomes next.
export async function setAstrophotoAlbumCover(
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
  revalidatePath("/astronomy");
  revalidatePath(`/astronomy/album/[slug]`, "page");
  return { ok: true as const };
}

// Hide or unhide an astrophoto album.
export async function setAstrophotoAlbumHidden(
  id: string,
  hidden: boolean
) {
  await requireAdmin();
  if (!id) return { ok: false as const, error: "missing album id" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("albums")
    .update({ hidden })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/astronomy");
  revalidatePath(`/astronomy/album/[slug]`, "page");
  return { ok: true as const };
}

// Delete an astrophoto album. Astrophotos fall back to uncategorized
// via the FK's ON DELETE SET NULL.
export async function deleteAstrophotoAlbum(id: string) {
  await requireAdmin();
  if (!id) return { ok: false as const, error: "missing album id" };
  const admin = createAdminClient();
  const { error } = await admin.from("albums").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/astronomy");
  return { ok: true as const };
}

// Set decoration presets (frame, filter) on an astrophoto album.
// Partial-patch shape, see the photos twin for design rationale.
export async function setAstrophotoAlbumCoverDecorations(
  id: string,
  patch: {
    frame?: string | null;
    filter?: string | null;
    frame_width?: string;
    frame_opacity?: number | null;
  }
) {
  await requireAdmin();
  if (!id) return { ok: false as const, error: "missing album id" };
  const updates: Record<string, string | number | null> = {};
  if ("frame" in patch) updates.cover_frame = patch.frame ?? null;
  if ("filter" in patch) updates.cover_filter = patch.filter ?? null;
  if ("frame_width" in patch && patch.frame_width)
    updates.cover_frame_width = patch.frame_width;
  if ("frame_opacity" in patch)
    updates.cover_frame_opacity = patch.frame_opacity ?? null;
  if (Object.keys(updates).length === 0) return { ok: true as const };
  const admin = createAdminClient();
  const { error } = await admin.from("albums").update(updates).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/astronomy");
  revalidatePath(`/astronomy/album/[slug]`, "page");
  return { ok: true as const };
}

// Set the album's title placement. See setPhotoAlbumTitlePlacement.
export async function setAstrophotoAlbumTitlePlacement(
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
  revalidatePath("/astronomy");
  revalidatePath(`/astronomy/album/[slug]`, "page");
  return { ok: true as const };
}

// Patch the album's title_style jsonb (merge with existing).
export async function setAstrophotoAlbumTitleStyle(
  id: string,
  style: Record<string, unknown>
) {
  await requireAdmin();
  if (!id) return { ok: false as const, error: "missing album id" };
  if (!style || typeof style !== "object")
    return { ok: false as const, error: "style must be an object" };
  const admin = createAdminClient();
  const { data: cur, error: readErr } = await admin
    .from("albums")
    .select("title_style")
    .eq("id", id)
    .single();
  if (readErr) return { ok: false as const, error: readErr.message };
  const merged = {
    ...((cur?.title_style ?? {}) as Record<string, unknown>),
    ...style,
  };
  const { error } = await admin
    .from("albums")
    .update({ title_style: merged })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/astronomy");
  revalidatePath(`/astronomy/album/[slug]`, "page");
  return { ok: true as const };
}

// Broadcast placement + style to every astrophoto album.
export async function setAllAstrophotoAlbumsTitle(
  placement: string | null,
  style: Record<string, unknown> | null
) {
  await requireAdmin();
  const updates: Record<string, unknown> = {};
  if (placement && placement.length > 0) updates.title_placement = placement;
  if (style) updates.title_style = style;
  if (Object.keys(updates).length === 0) return { ok: true as const };
  const admin = createAdminClient();
  const { error } = await admin
    .from("albums")
    .update(updates)
    .eq("kind", "astrophotos");
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/astronomy");
  return { ok: true as const };
}

// Replace an astrophoto album's cover_overlays array. See
// setPhotoAlbumCoverOverlays for design rationale.
export async function setAstrophotoAlbumCoverOverlays(
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
  revalidatePath("/astronomy");
  revalidatePath(`/astronomy/album/[slug]`, "page");
  return { ok: true as const };
}

// Replace an astrophoto album's cover_history. Client-computed, see
// the photos twin above for the design rationale.
export async function setAstrophotoAlbumCoverHistory(
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
  revalidatePath("/astronomy");
  revalidatePath(`/astronomy/album/[slug]`, "page");
  return { ok: true as const };
}

// Assign an astrophoto to an album (or null to make it uncategorized).
export async function setAstrophotoAlbum(
  astrophotoId: string,
  albumId: string | null
) {
  await requireAdmin();
  if (!astrophotoId) return { ok: false as const, error: "missing astrophoto id" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("astrophotos")
    .update({ album_id: albumId })
    .eq("id", astrophotoId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/astronomy");
  if (albumId) revalidatePath(`/astronomy/album/[slug]`, "page");
  return { ok: true as const };
}

function trimOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export async function updateAstrophotoMeta(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing id." };

  const objectName = String(formData.get("object_name") ?? "").trim();
  if (!objectName) return { ok: false, error: "Object name is required." };

  const takenAtRaw = trimOrNull(formData.get("taken_at"));
  let takenAt: string | null | undefined = undefined;
  if (takenAtRaw !== null) {
    const parsed = new Date(takenAtRaw);
    takenAt = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const albumIdRaw = formData.get("album_id");
  const albumId =
    typeof albumIdRaw === "string" && albumIdRaw !== ""
      ? albumIdRaw
      : null;

  const update: Record<string, string | null> = {
    object_name: objectName,
    caption: String(formData.get("caption") ?? "").trim(),
    telescope: trimOrNull(formData.get("telescope")),
    mount: trimOrNull(formData.get("mount")),
    camera: trimOrNull(formData.get("camera")),
    exposure_stack: trimOrNull(formData.get("exposure_stack")),
    processing: trimOrNull(formData.get("processing")),
    location: trimOrNull(formData.get("location")),
    album_id: albumId,
  };
  if (takenAt !== undefined) update.taken_at = takenAt;

  const admin = createAdminClient();
  const { error } = await admin.from("astrophotos").update(update).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/astronomy");
  revalidatePath(`/astronomy/photo/${id}`);
  revalidatePath(`/astronomy/album/[slug]`, "page");
  return { ok: true };
}

// Override an astrophoto's frame/filter. NULL = inherit album setting.
// See resolveDecoration() in lib/supabase/photos.ts for the rule.
export async function setAstrophotoDecorations(
  id: string,
  patch: {
    frame?: string | null;
    filter?: string | null;
    frame_width?: string | null;
  }
) {
  await requireAdmin();
  if (!id) return { ok: false as const, error: "missing astrophoto id" };
  const updates: Record<string, string | null> = {};
  if ("frame" in patch) updates.cover_frame = patch.frame ?? null;
  if ("filter" in patch) updates.cover_filter = patch.filter ?? null;
  if ("frame_width" in patch)
    updates.cover_frame_width = patch.frame_width ?? null;
  if (Object.keys(updates).length === 0) return { ok: true as const };
  const admin = createAdminClient();
  const { error } = await admin
    .from("astrophotos")
    .update(updates)
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/astronomy");
  revalidatePath(`/astronomy/album/[slug]`, "page");
  revalidatePath(`/astronomy/photo/${id}`);
  return { ok: true as const };
}

export async function toggleAstrophotoHidden(id: string, nextHidden: boolean) {
  await requireAdmin();
  if (!id) return { ok: false, error: "Missing id." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("astrophotos")
    .update({ hidden: nextHidden })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/astronomy");
  revalidatePath(`/astronomy/photo/${id}`);
  return { ok: true };
}

export async function rotateAstrophoto(id: string, direction: "left" | "right") {
  await requireAdmin();
  if (!id) return { ok: false, error: "Missing id." };

  const admin = createAdminClient();
  const { data: row, error: fetchErr } = await admin
    .from("astrophotos")
    .select("rotation")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };

  const current = ((row?.rotation ?? 0) + 360) % 360;
  const next = direction === "right" ? (current + 90) % 360 : (current + 270) % 360;

  const { error } = await admin
    .from("astrophotos")
    .update({ rotation: next })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/astronomy");
  revalidatePath(`/astronomy/photo/${id}`);
  return { ok: true };
}

// Toggle the astrophoto's horizontal-flip flag. See flipPhoto.
export async function flipAstrophoto(id: string) {
  await requireAdmin();
  if (!id) return { ok: false as const, error: "Missing id." };
  const admin = createAdminClient();
  const { data: row, error: fetchErr } = await admin
    .from("astrophotos")
    .select("flipped")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return { ok: false as const, error: fetchErr.message };
  const next = !row?.flipped;
  const { error } = await admin
    .from("astrophotos")
    .update({ flipped: next })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/astronomy");
  revalidatePath(`/astronomy/photo/${id}`);
  return { ok: true as const, flipped: next };
}

export async function deleteAstrophoto(id: string) {
  await requireAdmin();
  if (!id) return { ok: false as const, error: "Missing id." };

  const admin = createAdminClient();
  const { data: row, error: fetchErr } = await admin
    .from("astrophotos")
    .select("image_url, album_id, hidden")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return { ok: false as const, error: fetchErr.message };

  let stillCoverFor: string[] = [];
  let autoShiftedFor: string[] = [];

  if (row?.image_url) {
    // Pinned cover detection. We preserve cover_image_url so the
    // pinned cover keeps rendering after the row is gone.
    try {
      const { data: pinned } = await admin
        .from("albums")
        .select("name")
        .eq("cover_image_url", row.image_url);
      if (Array.isArray(pinned)) {
        for (const a of pinned) stillCoverFor.push(a.name as string);
      }
    } catch {
      // Best-effort.
    }

    // cover_history detection — preserved as-is, just informs the
    // storage-keep decision.
    let inHistory = false;
    try {
      const { data: allAlbums } = await admin
        .from("albums")
        .select("cover_history");
      inHistory = Array.isArray(allAlbums)
        ? allAlbums.some((r) => {
            const h = Array.isArray(r.cover_history)
              ? (r.cover_history as { url: string }[])
              : [];
            return h.some((e) => e?.url === row.image_url);
          })
        : false;
    } catch {
      // Best-effort.
    }

    // Auto-pick impact: only matters for notice text — the row is
    // about to be deleted anyway, so auto-pick naturally shifts.
    if (row.album_id && !row.hidden) {
      try {
        const { data: album } = await admin
          .from("albums")
          .select("name, cover_image_url")
          .eq("id", row.album_id)
          .maybeSingle();
        if (album && !album.cover_image_url) {
          const { data: latest } = await admin
            .from("astrophotos")
            .select("id")
            .eq("album_id", row.album_id)
            .eq("hidden", false)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (latest?.id === id) {
            autoShiftedFor.push(album.name as string);
          }
        }
      } catch {
        // Best-effort.
      }
    }

    // Storage policy mirrors deletePhoto: only purge the file when
    // nothing references the URL.
    const referenced = stillCoverFor.length > 0 || inHistory;
    if (!referenced) {
      const ref = storageRefFromUrl(row.image_url);
      if (ref) {
        await admin.storage.from(ref.bucket).remove([ref.key]);
      }
    }
  }

  const { error } = await admin.from("astrophotos").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/astronomy");
  revalidatePath(`/astronomy/album/[slug]`, "page");
  return { ok: true as const, stillCoverFor, autoShiftedFor };
}

// Move an astrophoto row from `astrophotos` into `photos`. The file in
// Storage stays where it is — only the DB row migrates. Caption preserves
// content; if empty, it falls back to object_name so the entry stays
// recognizable in /photos.
export async function convertAstrophotoToPhoto(id: string) {
  await requireAdmin();
  if (!id) return { ok: false, error: "Missing id." };

  const admin = createAdminClient();
  const { data: row, error: fetchErr } = await admin
    .from("astrophotos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!row) return { ok: false, error: "Astrophoto not found." };

  const caption: string =
    (row.caption as string)?.trim() || (row.object_name as string) || "";

  const { error: insertErr } = await admin.from("photos").insert({
    image_url: row.image_url,
    caption,
    tags: [] as string[],
    hidden: row.hidden,
    rotation: row.rotation ?? 0,
    flipped: Boolean(row.flipped),
    width: row.width,
    height: row.height,
    taken_at: row.taken_at,
  });
  if (insertErr) return { ok: false, error: insertErr.message };

  const { error: deleteErr } = await admin
    .from("astrophotos")
    .delete()
    .eq("id", id);
  if (deleteErr) {
    return {
      ok: false,
      error: `Inserted into photos but couldn't delete original: ${deleteErr.message}`,
    };
  }

  revalidatePath("/photos");
  revalidatePath("/astronomy");
  return { ok: true };
}
