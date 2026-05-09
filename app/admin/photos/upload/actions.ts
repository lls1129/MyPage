"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

const BUCKET = "photos";

export type SignedUploadResult =
  | { ok: true; path: string; token: string; publicUrl: string }
  | { ok: false; error: string };

export async function signPhotoUpload(
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

export type PhotoMetadata = {
  storagePath: string;
  imageUrl: string;
  caption: string;
  tags: string[];
  takenAt: string | null;
  width: number | null;
  height: number | null;
};

export async function insertPhotoRow(
  meta: PhotoMetadata
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("photos").insert({
    image_url: meta.imageUrl,
    caption: meta.caption?.trim() ?? "",
    tags: meta.tags ?? [],
    taken_at: meta.takenAt,
    width: meta.width,
    height: meta.height,
  });
  if (error) {
    await admin.storage.from(BUCKET).remove([meta.storagePath]);
    return { ok: false, error: error.message };
  }
  revalidatePath("/photos");
  return { ok: true };
}
