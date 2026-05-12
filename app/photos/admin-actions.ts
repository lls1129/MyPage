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
  if (!id) return { ok: false, error: "Missing id." };

  const admin = createAdminClient();

  // Look up the storage path so we can clean up the file too.
  const { data: row, error: fetchError } = await admin
    .from("photos")
    .select("image_url")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return { ok: false, error: fetchError.message };

  if (row?.image_url) {
    const ref = storageRefFromUrl(row.image_url);
    if (ref) {
      // Read bucket from URL so converted rows (where the file may live in
      // a different bucket) still get cleaned up correctly.
      await admin.storage.from(ref.bucket).remove([ref.key]);
    }
  }

  const { error: deleteError } = await admin
    .from("photos")
    .delete()
    .eq("id", id);
  if (deleteError) return { ok: false, error: deleteError.message };

  revalidatePath("/photos");
  return { ok: true };
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
