"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { extension } from "@/lib/upload-utils";
import { signPhotoUpload } from "@/app/admin/photos/upload/actions";
import { setMealImage } from "./actions";

// Inline meal-photo uploader — collapses to a small pill until
// clicked. Uses the same signed-upload pattern as the album-cover
// uploader: sign a URL via signPhotoUpload, push the file straight
// to Supabase Storage (bypasses Vercel's 4.5MB body cap), then
// stamp the resulting public URL onto the meal row via setMealImage.
//
// No `also save as photo` checkbox here — meal photos are private to
// the meal record and don't belong in the public photo library.
export function MealUploader({
  mealId,
  currentImageUrl,
  onUploaded,
}: {
  mealId: string;
  currentImageUrl: string | null;
  onUploaded: (url: string | null) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  function pickFile(f: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
    setError(null);
  }

  function close() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setOpen(false);
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    setStatus("");
  }

  async function upload() {
    if (!file) {
      setError("pick a file first.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("file must be an image.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      setStatus("signing…");
      const sign = await signPhotoUpload(extension(file.name));
      if (!sign.ok) throw new Error(sign.error);

      setStatus("uploading…");
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("photos")
        .uploadToSignedUrl(sign.path, sign.token, file, {
          contentType: file.type,
        });
      if (upErr) throw new Error(upErr.message);

      setStatus("saving…");
      const res = await setMealImage({
        mealId,
        imageUrl: sign.publicUrl,
      });
      if (!res.ok) throw new Error(res.message);

      await onUploaded(sign.publicUrl);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
      setStatus("");
    }
  }

  async function clearImage() {
    if (!currentImageUrl) return;
    setError(null);
    setPending(true);
    try {
      const res = await setMealImage({ mealId, imageUrl: null });
      if (!res.ok) throw new Error(res.message);
      await onUploaded(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-pill bg-white text-pink-800 border border-pink-200 hover:border-pink-400 px-3 py-1 text-[11px] font-semibold"
        >
          {currentImageUrl ? "✎ replace photo" : "+ upload photo"}
        </button>
        {currentImageUrl ? (
          <button
            type="button"
            onClick={clearImage}
            disabled={pending}
            title="clear the admin-uploaded photo and fall back to the default thumbnail"
            className="rounded-pill bg-white text-pink-700 border border-pink-200 hover:border-pink-400 px-2.5 py-1 text-[11px] font-semibold disabled:opacity-60"
          >
            ✕ clear
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-md bg-white border border-pink-200 p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] text-pink-800 font-semibold">
          upload meal photo
        </p>
        <button
          type="button"
          onClick={close}
          disabled={pending}
          className="rounded-pill bg-white text-pink-800 border border-pink-200 hover:border-pink-400 px-2.5 py-0.5 text-[11px] font-semibold disabled:opacity-60"
        >
          close
        </button>
      </div>

      <label
        htmlFor={`meal-uploader-${mealId}`}
        className="block cursor-pointer rounded-md border-2 border-dashed border-pink-200 hover:border-pink-400 bg-pink-50/60 px-4 py-5 text-center"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="preview"
            className="mx-auto max-h-40 rounded-sm border border-pink-100"
          />
        ) : (
          <>
            <p className="font-script text-pink-600 text-lg leading-tight">
              choose a photo ✿
            </p>
            <p className="text-[10px] text-lavender-600 mt-1 font-semibold">
              jpg / png / heic / webp · uploads straight to storage
            </p>
          </>
        )}
        <input
          id={`meal-uploader-${mealId}`}
          type="file"
          accept="image/*"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
        {file ? (
          <p className="text-[10px] text-pink-600 mt-2 font-semibold truncate">
            {file.name}
          </p>
        ) : null}
      </label>

      {error ? (
        <p className="text-[11px] text-pink-600 font-semibold">{error}</p>
      ) : null}

      <div className="flex items-center gap-2 flex-wrap pt-1">
        <button
          type="button"
          onClick={upload}
          disabled={pending || !file}
          className="rounded-pill bg-pink-300 text-white border border-pink-300 hover:bg-pink-400 hover:border-pink-400 px-3 py-0.5 text-[11px] font-semibold disabled:opacity-50"
        >
          {pending ? status || "uploading…" : "upload & pin"}
        </button>
      </div>
    </div>
  );
}
