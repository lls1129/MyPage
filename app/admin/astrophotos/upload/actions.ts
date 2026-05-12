"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

const BUCKET = "astrophotos";

export type SignedUploadResult =
  | { ok: true; path: string; token: string; publicUrl: string }
  | { ok: false; error: string };

export async function signAstrophotoUpload(
  ext: string
): Promise<SignedUploadResult> {
  await requireAdmin();
  if (!isAdminConfigured()) {
    return { ok: false, error: "Server admin Supabase env not configured." };
  }
  const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext.toLowerCase() : "jpg";
  const path = `${crypto.randomUUID()}.${safeExt}`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);
  if (error) return { ok: false, error: error.message };
  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  return { ok: true, path, token: data.token, publicUrl: pub.publicUrl };
}

export type AstrophotoMetadata = {
  storagePath: string;
  imageUrl: string;
  objectName: string;
  caption: string;
  takenAt: string | null;
  width: number | null;
  height: number | null;
  telescope: string | null;
  mount: string | null;
  camera: string | null;
  exposureStack: string | null;
  processing: string | null;
  location: string | null;
  albumId: string | null;
};

export async function insertAstrophotoRow(
  meta: AstrophotoMetadata
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  if (!meta.objectName?.trim()) {
    return { ok: false, error: "Object name is required." };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("astrophotos").insert({
    image_url: meta.imageUrl,
    object_name: meta.objectName.trim(),
    caption: meta.caption?.trim() ?? "",
    taken_at: meta.takenAt,
    width: meta.width,
    height: meta.height,
    telescope: meta.telescope,
    mount: meta.mount,
    camera: meta.camera,
    exposure_stack: meta.exposureStack,
    processing: meta.processing,
    location: meta.location,
    album_id: meta.albumId,
  });
  if (error) {
    // Best-effort cleanup of the orphaned upload.
    await admin.storage.from(BUCKET).remove([meta.storagePath]);
    return { ok: false, error: error.message };
  }
  revalidatePath("/astronomy");
  if (meta.albumId) revalidatePath(`/astronomy/album/[slug]`, "page");
  return { ok: true };
}
