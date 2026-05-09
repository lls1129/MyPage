"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import exifr from "exifr";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

const BUCKET = "astrophotos";
const MAX_BYTES = 25 * 1024 * 1024;

function trimOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function extension(name: string, fallback = "jpg"): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return (m?.[1] || fallback).toLowerCase();
}

export async function uploadAstrophoto(formData: FormData) {
  await requireAdmin();

  if (!isAdminConfigured()) {
    redirect(
      `/admin/astrophotos/upload?error=${encodeURIComponent(
        "SUPABASE_SERVICE_ROLE_KEY isn't set on the server."
      )}`
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(
      `/admin/astrophotos/upload?error=${encodeURIComponent("Please pick a file.")}`
    );
  }
  if (file.size > MAX_BYTES) {
    redirect(
      `/admin/astrophotos/upload?error=${encodeURIComponent(
        `File is too large. Max is ${MAX_BYTES / 1024 / 1024} MB.`
      )}`
    );
  }
  if (!file.type.startsWith("image/")) {
    redirect(
      `/admin/astrophotos/upload?error=${encodeURIComponent("File must be an image.")}`
    );
  }

  const objectName = (formData.get("object_name") ?? "").toString().trim();
  if (!objectName) {
    redirect(
      `/admin/astrophotos/upload?error=${encodeURIComponent("Object name is required.")}`
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let takenAt: string | null = null;
  let width: number | null = null;
  let height: number | null = null;
  try {
    const exif = await exifr.parse(buffer, {
      pick: [
        "DateTimeOriginal",
        "CreateDate",
        "ImageWidth",
        "ImageHeight",
        "ExifImageWidth",
        "ExifImageHeight",
        "PixelXDimension",
        "PixelYDimension",
      ],
    });
    const captureDate = exif?.DateTimeOriginal ?? exif?.CreateDate;
    if (captureDate instanceof Date) takenAt = captureDate.toISOString();
    width = exif?.ImageWidth ?? exif?.ExifImageWidth ?? exif?.PixelXDimension ?? null;
    height = exif?.ImageHeight ?? exif?.ExifImageHeight ?? exif?.PixelYDimension ?? null;
  } catch {
    // EXIF best-effort.
  }

  // Allow user to override taken_at via form ("YYYY-MM-DD" or full ISO).
  const takenAtOverride = trimOrNull(formData.get("taken_at"));
  if (takenAtOverride) {
    const parsed = new Date(takenAtOverride);
    if (!Number.isNaN(parsed.getTime())) takenAt = parsed.toISOString();
  }

  const ext = extension(file.name);
  const key = `${crypto.randomUUID()}.${ext}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(key, buffer, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError) {
    redirect(
      `/admin/astrophotos/upload?error=${encodeURIComponent(
        `Storage upload failed: ${uploadError.message}`
      )}`
    );
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(key);
  const imageUrl = pub.publicUrl;

  const { error: insertError } = await admin.from("astrophotos").insert({
    image_url: imageUrl,
    object_name: objectName,
    caption: (formData.get("caption") ?? "").toString().trim(),
    taken_at: takenAt,
    width,
    height,
    telescope: trimOrNull(formData.get("telescope")),
    mount: trimOrNull(formData.get("mount")),
    camera: trimOrNull(formData.get("camera")),
    exposure_stack: trimOrNull(formData.get("exposure_stack")),
    processing: trimOrNull(formData.get("processing")),
    location: trimOrNull(formData.get("location")),
  });
  if (insertError) {
    await admin.storage.from(BUCKET).remove([key]);
    redirect(
      `/admin/astrophotos/upload?error=${encodeURIComponent(
        `DB insert failed: ${insertError.message}`
      )}`
    );
  }

  revalidatePath("/astronomy");
  revalidatePath("/admin/astrophotos/upload");
  redirect("/admin/astrophotos/upload?status=ok");
}
