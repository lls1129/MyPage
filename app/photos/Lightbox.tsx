"use client";

import { useCallback, useEffect } from "react";
import type { Photo } from "@/lib/supabase/photos";

export function Lightbox({
  photos,
  index,
  onClose,
  onChange,
}: {
  photos: Photo[];
  index: number;
  onClose: () => void;
  onChange: (i: number) => void;
}) {
  const photo = photos[index];

  const goPrev = useCallback(() => {
    onChange((index - 1 + photos.length) % photos.length);
  }, [index, photos.length, onChange]);

  const goNext = useCallback(() => {
    onChange((index + 1) % photos.length);
  }, [index, photos.length, onChange]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, goPrev, goNext]);

  if (!photo) return null;

  const date = photo.taken_at ?? photo.created_at;
  const dateLabel = date
    ? new Date(date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption || "photo"}
      className="fixed inset-0 z-50 bg-skynavy-900/95 backdrop-blur-sm flex flex-col"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between p-4 text-cream/80">
        <span className="font-script text-cream/70 text-xl select-none">✿</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="close"
          className="rounded-pill px-3 py-1.5 text-sm font-semibold bg-cream/10 text-cream border border-cream/20 hover:bg-cream/20"
        >
          ✕ close
        </button>
      </div>

      {/* Photo + meta — stop click bubbling so clicks inside don't dismiss */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-4 pb-6 gap-4 min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex-1 min-h-0 w-full max-w-[1100px] flex items-center justify-center">
          <button
            type="button"
            onClick={goPrev}
            aria-label="previous"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-cream/10 text-cream border border-cream/20 hover:bg-cream/20 flex items-center justify-center text-lg"
          >
            ‹
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.image_url}
            alt={photo.caption || ""}
            className="max-h-full max-w-full object-contain rounded-md shadow-soft"
          />

          <button
            type="button"
            onClick={goNext}
            aria-label="next"
            className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-cream/10 text-cream border border-cream/20 hover:bg-cream/20 flex items-center justify-center text-lg"
          >
            ›
          </button>
        </div>

        <div className="w-full max-w-[680px] rounded-md bg-cream/5 border border-cream/10 px-5 py-4 text-cream">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <p className="font-script text-cream text-2xl leading-tight">
              {photo.caption || "untitled"}
            </p>
            {dateLabel ? (
              <p className="text-xs text-cream/60 font-semibold whitespace-nowrap">
                {dateLabel}
              </p>
            ) : null}
          </div>
          {photo.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {photo.tags.map((t) => (
                <span
                  key={t}
                  className="text-[11px] text-cream/90 bg-cream/10 border border-cream/20 rounded-pill px-2 py-[2px] font-semibold"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          <p className="text-[11px] text-cream/50 mt-3">
            {index + 1} of {photos.length} · arrow keys to browse · esc to close
          </p>
        </div>
      </div>
    </div>
  );
}
