"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { storageRefFromUrl } from "@/lib/supabase/storage-utils";

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

  const update: Record<string, string | null> = {
    object_name: objectName,
    caption: String(formData.get("caption") ?? "").trim(),
    telescope: trimOrNull(formData.get("telescope")),
    mount: trimOrNull(formData.get("mount")),
    camera: trimOrNull(formData.get("camera")),
    exposure_stack: trimOrNull(formData.get("exposure_stack")),
    processing: trimOrNull(formData.get("processing")),
    location: trimOrNull(formData.get("location")),
  };
  if (takenAt !== undefined) update.taken_at = takenAt;

  const admin = createAdminClient();
  const { error } = await admin.from("astrophotos").update(update).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/astronomy");
  revalidatePath(`/astronomy/photo/${id}`);
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
