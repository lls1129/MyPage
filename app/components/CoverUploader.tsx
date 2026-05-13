"use client";

import { useState } from "react";
import type { Album } from "@/lib/supabase/albums";
import { createClient } from "@/lib/supabase/browser";
import { extension } from "@/lib/upload-utils";
import {
  signPhotoUpload,
  insertPhotoRow,
} from "@/app/admin/photos/upload/actions";

// Inline cover upload — collapses to a single "upload" pill until
// clicked. Uploads to the photos bucket, optionally inserts a photos
// row (so the image also appears in /photos), and pins the resulting
// public URL as the cover via `onUploaded`. Only used on photo
// albums for now — astrophoto covers still go through /admin/
// astrophotos/upload.
export function CoverUploader({
  currentAlbumId,
  allAlbums,
  onUploaded,
}: {
  currentAlbumId: string;
  allAlbums: Album[];
  onUploaded: (url: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [alsoSave, setAlsoSave] = useState(false);
  const [saveAlbumId, setSaveAlbumId] = useState(currentAlbumId);
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

      if (alsoSave) {
        setStatus("saving metadata…");
        const res = await insertPhotoRow({
          storagePath: sign.path,
          imageUrl: sign.publicUrl,
          caption: "",
          tags: [],
          takenAt: null,
          width: null,
          height: null,
          albumId: saveAlbumId || null,
        });
        if (!res.ok) throw new Error(res.error);
      }

      setStatus("pinning…");
      await onUploaded(sign.publicUrl);

      // All done — reset & collapse.
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
      setStatus("");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-pill bg-white text-pink-800 border border-pink-200 hover:border-pink-400 px-3 py-1 text-[11px] font-semibold"
      >
        + upload new cover
      </button>
    );
  }

  return (
    <div className="rounded-md bg-white border border-pink-200 p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] text-pink-800 font-semibold">
          upload new cover
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
        htmlFor="cover-uploader-file"
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
          id="cover-uploader-file"
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

      <label className="flex items-center gap-2 text-[11px] text-ink/85 font-semibold">
        <input
          type="checkbox"
          checked={alsoSave}
          onChange={(e) => setAlsoSave(e.target.checked)}
          disabled={pending}
          className="accent-pink-400 w-3.5 h-3.5"
        />
        also save it as a photo
      </label>

      {alsoSave ? (
        <div className="flex items-center gap-2 flex-wrap pl-5">
          <span className="text-[10px] text-ink/65 font-semibold">in</span>
          <select
            value={saveAlbumId}
            onChange={(e) => setSaveAlbumId(e.target.value)}
            disabled={pending}
            className="bg-pink-50 border border-pink-100 rounded-sm px-2 py-1 text-[11px] text-ink focus:outline-none focus:border-pink-300"
          >
            <option value="">uncategorized</option>
            {allAlbums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

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
