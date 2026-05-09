"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Photo } from "@/lib/supabase/photos";
import { listPhotosForPicker } from "./admin-actions";

export function PhotoPicker({
  initialSelected,
  onClose,
  onSave,
}: {
  initialSelected: string[];
  onClose: () => void;
  onSave: (ids: string[]) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [mounted, setMounted] = useState(false);
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    listPhotosForPicker().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setPhotos([]);
        return;
      }
      setPhotos(result.photos);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await onSave(Array.from(selected));
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Save failed.");
      return;
    }
    onClose();
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] bg-skynavy-900/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[760px] max-h-[85vh] flex flex-col rounded-lg bg-white border border-pink-100 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-baseline justify-between gap-3 px-5 py-4 border-b border-pink-100">
          <div>
            <p className="label text-lavender-600">link photos to pin</p>
            <p className="text-xs text-ink/70 mt-0.5">
              tap to toggle · {selected.size} selected
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="text-pink-600 text-sm font-semibold hover:text-pink-800"
          >
            ✕
          </button>
        </header>

        <div className="overflow-auto p-5 flex-1 min-h-0">
          {photos === null ? (
            <p className="text-sm text-lavender-600 text-center">loading…</p>
          ) : photos.length === 0 ? (
            <p className="text-sm text-lavender-600 text-center">
              no photos in your album yet. upload some from /admin.
            </p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((p) => {
                const on = selected.has(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => toggle(p.id)}
                      className={
                        "block relative w-full aspect-square overflow-hidden rounded-md border-2 transition-colors " +
                        (on
                          ? "border-pink-400 ring-2 ring-pink-200"
                          : "border-pink-100 hover:border-pink-200")
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.image_url}
                        alt={p.caption || ""}
                        loading="lazy"
                        style={
                          p.rotation
                            ? { transform: `rotate(${p.rotation}deg)` }
                            : undefined
                        }
                        className="w-full h-full object-cover"
                      />
                      <span
                        className={
                          "absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border " +
                          (on
                            ? "bg-pink-200 text-white border-pink-400"
                            : "bg-cream/85 text-pink-400 border-pink-100")
                        }
                      >
                        {on ? "✓" : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error ? (
          <p className="px-5 pb-2 text-xs text-pink-600 font-semibold">
            {error}
          </p>
        ) : null}

        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-pink-100">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="lift rounded-pill bg-white text-pink-800 border border-pink-100 hover:border-pink-200 px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="lift rounded-pill bg-pink-200 text-white border border-pink-200 shadow-soft hover:border-pink-400 px-4 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-wait"
          >
            {saving ? "saving…" : `save ${selected.size}`}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
