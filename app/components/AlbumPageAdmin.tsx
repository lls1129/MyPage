"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Album } from "@/lib/supabase/albums";
import { CoverCropper } from "./CoverCropper";
import {
  addToCoverHistory,
  getCoverHistory,
  removeFromCoverHistory,
  type LibraryKind,
} from "@/lib/cover-history";

type ActionResult = { ok: true } | { ok: false; error: string };

type CoverCandidate = { id: string; image_url: string };

// Compact admin strip shown at the top of /photos/album/[slug] and
// /astronomy/album/[slug]. Actions for the current album: rename, hide,
// pick a cover, delete. Upload lives in the grid's pill which is
// context-aware and pre-selects the current album.
export function AlbumPageAdmin({
  album,
  parentHref,
  libraryKind,
  coverCandidates,
  onRename,
  onDelete,
  onSetCover,
  onSetHidden,
  onSetCoverCrop,
}: {
  album: Album;
  /** /photos or /astronomy — where to land after a successful delete. */
  parentHref: string;
  /** Which library this album belongs to — used to namespace the
   *  per-browser "recent covers" history in localStorage. */
  libraryKind: LibraryKind;
  /** Photos in this album the admin can pin as the cover. */
  coverCandidates: CoverCandidate[];
  onRename: (id: string, newName: string) => Promise<ActionResult>;
  onDelete: (id: string) => Promise<ActionResult>;
  onSetCover: (id: string, coverUrl: string | null) => Promise<ActionResult>;
  onSetHidden: (id: string, hidden: boolean) => Promise<ActionResult>;
  onSetCoverCrop: (
    id: string,
    crop: { x: number; y: number; w: number; h: number }
  ) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pickingCover, setPickingCover] = useState(false);
  const [draft, setDraft] = useState(album.name);
  const [urlDraft, setUrlDraft] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Per-browser recently-pinned cover URLs for this album, loaded
  // from localStorage. Hydrate after mount to avoid SSR/CSR mismatch.
  const [history, setHistory] = useState<string[]>([]);
  useEffect(() => {
    setHistory(getCoverHistory(libraryKind, album.id));
  }, [libraryKind, album.id]);

  // Esc closes the preview overlay (matches photo lightbox UX).
  useEffect(() => {
    if (!previewUrl) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreviewUrl(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewUrl]);

  function saveRename() {
    setError(null);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === album.name) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      try {
        const res = await onRename(album.id, trimmed);
        if (!res.ok) {
          setError(res.error);
        } else {
          // slug regenerated — navigate to the new URL.
          const newSlug = slugifyForRedirect(trimmed);
          router.replace(`${parentHref}/album/${newSlug}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "couldn’t reach the server.");
      }
    });
  }

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await onDelete(album.id);
        if (!res.ok) {
          setError(res.error);
        } else {
          router.push(parentHref);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "couldn’t reach the server.");
      }
    });
  }

  function pickCover(url: string | null) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await onSetCover(album.id, url);
        if (!res.ok) {
          setError(res.error);
        } else {
          // Leave the picker open so admin can keep auditioning covers.
          // Clear the URL draft only when that's how it was set.
          if (url === null || url === urlDraft.trim()) setUrlDraft("");
          // Track successful pins in localStorage so admin can re-pin
          // a URL with one click later. Skip the "clear cover" case.
          if (url) setHistory(addToCoverHistory(libraryKind, album.id, url));
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "couldn’t reach the server.");
      }
    });
  }

  function applyUrlCover() {
    const url = urlDraft.trim();
    if (!url) return;
    pickCover(url);
  }

  // Commit a crop from the CoverCropper; refresh so the card on the
  // /photos library page reflects the change without a full reload.
  async function commitCrop(crop: {
    x: number;
    y: number;
    w: number;
    h: number;
  }): Promise<ActionResult> {
    setError(null);
    const res = await onSetCoverCrop(album.id, crop);
    if (res.ok) {
      router.refresh();
      return { ok: true };
    }
    setError(res.error);
    return res;
  }

  function toggleHidden() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await onSetHidden(album.id, !album.hidden);
        if (!res.ok) {
          setError(res.error);
        } else {
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "couldn’t reach the server.");
      }
    });
  }

  return (
    <section className="rounded-md bg-pink-50 border border-pink-100 p-3 md:p-4 flex flex-col gap-2 mt-3">
      <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3">
        <div className="flex items-center gap-2">
          <p className="label text-pink-600 shrink-0">admin · this album</p>
          {album.hidden ? (
            <span className="rounded-pill bg-pink-200 text-white px-2 py-0.5 text-[10px] font-semibold">
              hidden
            </span>
          ) : null}
        </div>
        {editing ? null : (
          // Keep the action buttons in their own flex group so they
          // wrap together (a single line, or all together onto a new
          // line) rather than scattering across rows on narrow widths.
          <div className="flex items-center flex-wrap gap-1.5">
            <AdminPill
              icon="✎"
              label="rename"
              onClick={() => setEditing(true)}
              disabled={pending || confirming || pickingCover}
            />
            <AdminPill
              icon="✦"
              label="cover"
              onClick={() => setPickingCover((v) => !v)}
              disabled={pending || confirming}
            />
            <AdminPill
              icon={album.hidden ? "◉" : "○"}
              label={album.hidden ? "unhide" : "hide"}
              onClick={toggleHidden}
              disabled={pending || confirming || pickingCover}
            />
            <AdminPill
              icon="✕"
              label="delete"
              danger
              onClick={() => setConfirming(true)}
              disabled={pending || confirming || pickingCover}
            />
          </div>
        )}
      </div>

      {editing ? (
        <div className="flex items-stretch gap-2 flex-wrap">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            className="bg-white border border-pink-200 rounded-pill px-3 py-1 text-sm flex-1 min-w-[180px] focus:outline-none focus:border-pink-400"
            onKeyDown={(e) => {
              if (e.key === "Enter") saveRename();
              if (e.key === "Escape") {
                setDraft(album.name);
                setEditing(false);
              }
            }}
          />
          <button
            type="button"
            onClick={saveRename}
            disabled={pending}
            className="rounded-pill bg-pink-200 text-white border border-pink-200 px-3 py-0.5 text-[11px] font-semibold disabled:opacity-60"
          >
            {pending ? "saving…" : "save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(album.name);
              setEditing(false);
            }}
            disabled={pending}
            className="rounded-pill bg-white text-pink-800 border border-pink-200 px-3 py-0.5 text-[11px] font-semibold disabled:opacity-60"
          >
            cancel
          </button>
        </div>
      ) : null}

      {pickingCover ? (
        <div className="rounded-md bg-white border border-pink-200 px-3 py-4 md:py-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] text-pink-800 font-semibold">
              pick a cover for this album
            </p>
            <div className="flex items-center gap-2">
              {album.cover_image_url ? (
                <button
                  type="button"
                  onClick={() => pickCover(null)}
                  disabled={pending}
                  className="rounded-pill bg-white text-pink-800 border border-pink-200 hover:border-pink-400 px-2.5 py-0.5 text-[11px] font-semibold disabled:opacity-60"
                >
                  remove cover
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setPickingCover(false);
                  setUrlDraft("");
                }}
                disabled={pending}
                className="rounded-pill bg-white text-pink-800 border border-pink-200 px-2.5 py-0.5 text-[11px] font-semibold disabled:opacity-60"
              >
                close
              </button>
            </div>
          </div>

          {album.cover_image_url ? (
            <div className="flex flex-col gap-2 rounded-md bg-pink-50 border border-pink-100 p-2.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-[11px] text-pink-800 font-semibold">
                  current cover
                </p>
                <p className="text-[10px] text-ink/70 font-semibold">
                  {coverCandidates.some(
                    (c) => c.image_url === album.cover_image_url
                  )
                    ? "from this album"
                    : "from URL"}
                </p>
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() =>
                    album.cover_image_url &&
                    setPreviewUrl(album.cover_image_url)
                  }
                  className="rounded-pill bg-white hover:bg-white text-pink-800 border border-pink-200 px-2.5 py-0.5 text-[11px] font-semibold"
                  title="view larger"
                >
                  ⤢ view
                </button>
              </div>
              <p className="text-[10px] text-ink/55 font-mono truncate">
                {album.cover_image_url}
              </p>
              <CoverCropper
                imageUrl={album.cover_image_url}
                initialCrop={{
                  x: album.cover_crop_x,
                  y: album.cover_crop_y,
                  w: album.cover_crop_w,
                  h: album.cover_crop_h,
                }}
                onCommit={commitCrop}
              />
            </div>
          ) : null}

          {history.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] text-pink-800 font-semibold">
                recent · click to pin
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                {history.map((url) => {
                  const selected = album.cover_image_url === url;
                  return (
                    <div
                      key={url}
                      className={
                        "relative aspect-square rounded-md overflow-hidden border-2 transition group " +
                        (selected
                          ? "border-pink-400 ring-2 ring-pink-200"
                          : "border-pink-100 hover:border-pink-300")
                      }
                    >
                      <button
                        type="button"
                        onClick={() => pickCover(url)}
                        disabled={pending}
                        title={selected ? "current cover" : "pin again"}
                        className="absolute inset-0 disabled:opacity-60"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setHistory(
                            removeFromCoverHistory(
                              libraryKind,
                              album.id,
                              url
                            )
                          )
                        }
                        title="forget this URL"
                        aria-label="remove from recent"
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-white/90 hover:bg-white text-pink-700 border border-pink-200 flex items-center justify-center text-[9px] font-semibold leading-none opacity-0 group-hover:opacity-100 transition shadow-soft"
                      >
                        ✕
                      </button>
                      {selected ? (
                        <span className="absolute inset-x-0 bottom-0 bg-pink-400/85 text-white text-[9px] font-semibold leading-tight py-0.5 text-center pointer-events-none">
                          current
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {coverCandidates.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
              {coverCandidates.map((c) => {
                const selected = album.cover_image_url === c.image_url;
                return (
                  <div
                    key={c.id}
                    className={
                      "relative aspect-square rounded-md overflow-hidden border-2 transition " +
                      (selected
                        ? "border-pink-400 ring-2 ring-pink-200"
                        : "border-pink-100 hover:border-pink-300")
                    }
                  >
                    <button
                      type="button"
                      onClick={() => pickCover(c.image_url)}
                      disabled={pending}
                      className="absolute inset-0 disabled:opacity-60"
                      title={selected ? "current cover" : "use as cover"}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.image_url}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewUrl(c.image_url)}
                      className="absolute top-1 right-1 rounded-full bg-white/85 hover:bg-white text-pink-800 border border-pink-200 w-6 h-6 flex items-center justify-center text-[11px] font-semibold shadow-soft"
                      title="view larger"
                      aria-label="view larger"
                    >
                      ⤢
                    </button>
                    {selected ? (
                      <span className="absolute inset-x-0 bottom-0 bg-pink-400/85 text-white text-[9px] font-semibold leading-tight py-0.5 text-center pointer-events-none">
                        current
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-ink/70">
              no photos in this album yet — paste a URL below to pin one
              anyway.
            </p>
          )}

          <div className="flex items-stretch gap-2 flex-wrap">
            <input
              type="url"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="…or paste an image URL"
              className="bg-white border border-pink-200 rounded-pill px-3 py-1 text-[11px] flex-1 min-w-[180px] focus:outline-none focus:border-pink-400"
              onKeyDown={(e) => {
                if (e.key === "Enter") applyUrlCover();
              }}
            />
            <button
              type="button"
              onClick={applyUrlCover}
              disabled={pending || !urlDraft.trim()}
              className="rounded-pill bg-pink-200 text-white border border-pink-200 px-3 py-0.5 text-[11px] font-semibold disabled:opacity-60"
            >
              {pending ? "saving…" : "use URL"}
            </button>
          </div>
        </div>
      ) : null}

      {previewUrl && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] bg-skynavy-900/85 flex items-center justify-center p-4 cursor-zoom-out"
              onClick={() => setPreviewUrl(null)}
              role="dialog"
              aria-label="cover preview"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt=""
                className="max-w-full max-h-full object-contain rounded-md shadow-soft"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                onClick={() => setPreviewUrl(null)}
                className="absolute top-3 right-3 rounded-full bg-white/90 hover:bg-white text-pink-800 border border-pink-200 w-9 h-9 flex items-center justify-center text-sm font-semibold shadow-soft"
                aria-label="close preview"
              >
                ✕
              </button>
            </div>,
            document.body
          )
        : null}

      {confirming ? (
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-pink-800 bg-white border border-pink-200 rounded-md px-2.5 py-1.5">
          <span className="font-semibold">
            delete “{album.name}”? photos will become uncategorized.
          </span>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={pending}
            className="rounded-pill bg-pink-200 text-white border border-pink-200 px-2.5 py-0.5 font-semibold disabled:opacity-60"
          >
            {pending ? "deleting…" : "yes, delete"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="rounded-pill bg-white text-pink-800 border border-pink-200 px-2.5 py-0.5 font-semibold disabled:opacity-60"
          >
            cancel
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="text-[11px] text-pink-600 font-semibold">{error}</p>
      ) : null}
    </section>
  );
}

// Small action pill shared by the admin action row. Icons live in a
// fixed-width slot so buttons line up even when the icon glyph widths
// differ (emoji vs. text symbols), and the label is wrapped in a
// flex item so wrapping behavior is predictable.
function AdminPill({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "inline-flex items-center gap-1 rounded-pill bg-white text-pink-800 border border-pink-200 px-2.5 py-0.5 text-[11px] font-semibold disabled:opacity-60 " +
        (danger
          ? "hover:bg-pink-100 hover:border-pink-400"
          : "hover:border-pink-400")
      }
    >
      <span className="inline-flex w-3 justify-center text-pink-500">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

// Local copy of the slug helper so we can predict the new URL after a
// rename and navigate to it. Mirrors lib/supabase/albums slugify().
function slugifyForRedirect(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
