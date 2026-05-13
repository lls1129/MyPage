"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { Photo } from "@/lib/supabase/photos";
import type { Album } from "@/lib/supabase/albums";
import { updatePhotoMeta, setPhotoDecorations } from "./admin-actions";
import { FILTERS, FRAMES } from "../components/cover-decorations";

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

  // Decoration state is local so chip clicks update visibly even
  // while the server action is still in flight. Server is the source
  // of truth on next router.refresh().
  const [frame, setFrame] = useState<string | null>(photo.cover_frame);
  const [filter, setFilter] = useState<string | null>(photo.cover_filter);
  const [decorPending, startDecor] = useTransition();
  const album = albums.find((a) => a.id === photo.album_id) ?? null;

  function applyDecoration(patch: {
    frame?: string | null;
    filter?: string | null;
  }) {
    if ("frame" in patch) setFrame(patch.frame ?? null);
    if ("filter" in patch) setFilter(patch.filter ?? null);
    startDecor(async () => {
      try {
        const res = await setPhotoDecorations(photo.id, patch);
        if (!res.ok) setError(res.error ?? "couldn’t save decoration.");
        else router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "couldn’t reach the server.");
      }
    });
  }

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

          {/* Per-photo decoration override. "follow album" clears
              the override so the photo inherits the album's setting
              (which itself may be null = no decoration). Each chip
              clicks save immediately — separate from the form's
              caption / tags / album save flow. */}
          <div className="flex flex-col gap-2 rounded-md bg-pink-50/60 border border-pink-100 p-2.5">
            <DecorationRow
              label="frame"
              options={FRAMES.map((f) => ({ id: f.id, label: f.label }))}
              currentId={frame}
              albumValue={album?.cover_frame ?? null}
              disabled={decorPending}
              onPick={(id) => applyDecoration({ frame: id })}
            />
            <DecorationRow
              label="filter"
              options={FILTERS.map((f) => ({ id: f.id, label: f.label }))}
              currentId={filter}
              albumValue={album?.cover_filter ?? null}
              disabled={decorPending}
              onPick={(id) => applyDecoration({ filter: id })}
            />
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

// One decoration row for the photo edit modal. "follow album" is
// always first; when the album itself has a value, its label hints
// at what's inherited so admin knows the default they're following.
function DecorationRow({
  label,
  options,
  currentId,
  albumValue,
  disabled,
  onPick,
}: {
  label: string;
  options: { id: string; label: string }[];
  currentId: string | null;
  albumValue: string | null;
  disabled?: boolean;
  onPick: (id: string | null) => void;
}) {
  const inheritLabel =
    albumValue && options.find((o) => o.id === albumValue)
      ? `follow album · ${options.find((o) => o.id === albumValue)?.label}`
      : "follow album";
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <p className="label text-pink-600 shrink-0 w-12">{label}</p>
      <button
        type="button"
        onClick={() => onPick(null)}
        disabled={disabled}
        className={
          "rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold transition disabled:opacity-60 " +
          (currentId === null
            ? "bg-pink-300 text-white border-pink-300"
            : "bg-white text-pink-800 border-pink-200 hover:border-pink-400")
        }
      >
        {inheritLabel}
      </button>
      <button
        type="button"
        onClick={() => onPick("")}
        disabled={disabled}
        title="suppress any decoration on this photo"
        className={
          "rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold transition disabled:opacity-60 " +
          (currentId === ""
            ? "bg-pink-300 text-white border-pink-300"
            : "bg-white text-pink-800 border-pink-200 hover:border-pink-400")
        }
      >
        none
      </button>
      {options.map((opt) => {
        const selected = currentId === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onPick(selected ? null : opt.id)}
            disabled={disabled}
            className={
              "rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold transition disabled:opacity-60 " +
              (selected
                ? "bg-pink-300 text-white border-pink-300"
                : "bg-white text-pink-800 border-pink-200 hover:border-pink-400")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
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
