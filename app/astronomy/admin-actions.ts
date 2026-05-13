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

export async function deleteAstrophoto(id: string) {
  await requireAdmin();
  if (!id) return { ok: false, error: "Missing id." };

  const admin = createAdminClient();
  const { data: row, error: fetchErr } = await admin
    .from("astrophotos")
    .select("image_url")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };

  if (row?.image_url) {
    const ref = storageRefFromUrl(row.image_url);
    if (ref) {
      // Read bucket from URL — converted rows may live in a different one.
      await admin.storage.from(ref.bucket).remove([ref.key]);
    }
  }

  const { error } = await admin.from("astrophotos").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/astronomy");
  return { ok: true };
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
