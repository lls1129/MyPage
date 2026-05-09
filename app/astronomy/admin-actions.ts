"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { storageKeyFromAstrophotoUrl } from "@/lib/supabase/astrophotos";

const BUCKET = "astrophotos";

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
    const key = storageKeyFromAstrophotoUrl(row.image_url);
    if (key) await admin.storage.from(BUCKET).remove([key]);
  }

  const { error } = await admin.from("astrophotos").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/astronomy");
  return { ok: true };
}
