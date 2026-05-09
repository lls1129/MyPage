"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import exifr from "exifr";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAdminEmail } from "@/lib/supabase/env";

const BUCKET = "photos";
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

function parseTags(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function extension(name: string, fallback = "jpg"): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return (m?.[1] || fallback).toLowerCase();
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const adminEmail = getAdminEmail();
  if (!user || !adminEmail || user.email?.toLowerCase() !== adminEmail) {
    redirect("/login?next=/admin/photos/upload");
  }
}

export async function uploadPhoto(formData: FormData) {
  await requireAdmin();

  if (!isAdminConfigured()) {
    redirect(
      `/admin/photos/upload?error=${encodeURIComponent(
        "SUPABASE_SERVICE_ROLE_KEY isn't set on the server."
      )}`
    );
  }

  const file = formData.get("file");
  const captionRaw = String(formData.get("caption") ?? "").trim();
  const tagsRaw = String(formData.get("tags") ?? "");

  if (!(file instanceof File) || file.size === 0) {
    redirect(
      `/admin/photos/upload?error=${encodeURIComponent("Please pick a file.")}`
    );
  }
  if (file.size > MAX_BYTES) {
    redirect(
      `/admin/photos/upload?error=${encodeURIComponent(
        `File is too large. Max is ${MAX_BYTES / 1024 / 1024} MB.`
      )}`
    );
  }
  if (!file.type.startsWith("image/")) {
    redirect(
      `/admin/photos/upload?error=${encodeURIComponent("File must be an image.")}`
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // EXIF: capture date + dimensions where available.
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
    width =
      exif?.ImageWidth ??
      exif?.ExifImageWidth ??
      exif?.PixelXDimension ??
      null;
    height =
      exif?.ImageHeight ??
      exif?.ExifImageHeight ??
      exif?.PixelYDimension ??
      null;
  } catch {
    // EXIF is best-effort; missing/corrupt headers shouldn't block the upload.
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
      `/admin/photos/upload?error=${encodeURIComponent(
        `Storage upload failed: ${uploadError.message}`
      )}`
    );
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(key);
  const imageUrl = pub.publicUrl;

  const { error: insertError } = await admin.from("photos").insert({
    image_url: imageUrl,
    caption: captionRaw,
    tags: parseTags(tagsRaw),
    width,
    height,
    taken_at: takenAt,
  });
  if (insertError) {
    // Best-effort cleanup of the orphaned file.
    await admin.storage.from(BUCKET).remove([key]);
    redirect(
      `/admin/photos/upload?error=${encodeURIComponent(
        `DB insert failed: ${insertError.message}`
      )}`
    );
  }

  revalidatePath("/photos");
  revalidatePath("/admin/photos/upload");
  redirect("/admin/photos/upload?status=ok");
}
