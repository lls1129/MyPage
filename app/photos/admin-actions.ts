"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { storageKeyFromPublicUrl } from "@/lib/supabase/photos";

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
  if (!id) return { ok: false, error: "Missing id." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("photos")
    .update({ caption, tags: parseTagsCsv(tagsRaw) })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/photos");
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
    const key = storageKeyFromPublicUrl(row.image_url, BUCKET);
    if (key) {
      // Best-effort — orphaned objects are recoverable, but a missing DB row
      // is what visitors actually see, so prioritize the DB delete below.
      await admin.storage.from(BUCKET).remove([key]);
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
