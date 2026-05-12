"use client";

import { useEffect, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { Photo } from "@/lib/supabase/photos";
import type { Album } from "@/lib/supabase/albums";
import { updatePhotoMeta } from "./admin-actions";

export function PhotoEditModal({
  photo,
  albums,
  onClose,
}: {
  photo: Photo;
  albums: Album[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] bg-skynavy-900/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] rounded-lg bg-white border border-pink-100 shadow-soft p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="label text-lavender-600">edit photo</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="text-pink-600 text-sm font-semibold hover:text-pink-800"
          >
            ✕
          </button>
        </div>

        <form
          action={async (formData) => {
            setError(null);
            const result = await updatePhotoMeta(formData);
            if (!result.ok) {
              setError(result.error ?? "Update failed.");
              return;
            }
            router.refresh();
            onClose();
          }}
          className="flex flex-col gap-4 mt-4"
        >
          <input type="hidden" name="id" value={photo.id} />

          <div className="flex flex-col gap-2">
            <label htmlFor="caption" className="label text-pink-600">
              caption
            </label>
            <input
              id="caption"
              name="caption"
              type="text"
              maxLength={240}
              defaultValue={photo.caption}
              placeholder="a sentence or two…"
              className="bg-pink-50 border border-pink-100 rounded-sm px-3 py-2 text-sm text-ink placeholder:text-pink-400 focus:outline-none focus:border-pink-200"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="tags" className="label text-pink-600">
              tags
            </label>
            <input
              id="tags"
              name="tags"
              type="text"
              defaultValue={photo.tags.join(", ")}
              placeholder="travel, nature"
              className="bg-pink-50 border border-pink-100 rounded-sm px-3 py-2 text-sm text-ink placeholder:text-pink-400 focus:outline-none focus:border-pink-200"
            />
            <p className="text-[11px] text-lavender-600">comma-separated.</p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="album_id" className="label text-pink-600">
              album
            </label>
            <select
              id="album_id"
              name="album_id"
              defaultValue={photo.album_id ?? ""}
              className="bg-pink-50 border border-pink-100 rounded-sm px-3 py-2 text-sm text-ink focus:outline-none focus:border-pink-200"
            >
              <option value="">— uncategorized —</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {albums.length === 0 ? (
              <p className="text-[11px] text-lavender-600">
                no albums yet. create one on the /photos page first.
              </p>
            ) : null}
          </div>

          {error ? (
            <p className="text-xs text-pink-600 font-semibold">{error}</p>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="lift rounded-pill bg-white text-pink-800 border border-pink-100 hover:border-pink-200 px-4 py-2 text-sm font-semibold"
            >
              cancel
            </button>
            <SaveButton />
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="lift rounded-pill bg-pink-200 text-white border border-pink-200 shadow-soft hover:border-pink-400 px-4 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-wait"
    >
      {pending ? "saving…" : "save"}
    </button>
  );
}
