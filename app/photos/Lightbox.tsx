"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import type { Photo } from "@/lib/supabase/photos";
import type { Album } from "@/lib/supabase/albums";
import {
  FILTERS,
  FRAMES,
  FRAME_SIZES,
  filterCssFor,
  frameInsetFor,
  frameMatBgFor,
  frameOuterRadiusFor,
  frameOverlayFor,
  framePadFor,
  resolveDecoration,
} from "../components/cover-decorations";
import { setPhotoDecorations } from "./admin-actions";
import { useRouter } from "next/navigation";

export function Lightbox({
  photos,
  albums = [],
  index,
  isAdmin,
  onClose,
  onChange,
  onEdit,
  onToggleHidden,
  onRotateLeft,
  onRotateRight,
  onConvertToAstro,
  onDelete,
  busy,
  albumLink,
}: {
  photos: Photo[];
  /** Used to resolve per-photo decoration inheritance — if a photo
   *  has cover_frame/cover_filter set to null, we fall back to its
   *  album's value (looked up here via album_id). */
  albums?: Album[];
  index: number;
  isAdmin?: boolean;
  onClose: () => void;
  onChange: (i: number) => void;
  onEdit?: (photo: Photo) => void;
  onToggleHidden?: (photo: Photo) => void;
  onRotateLeft?: (photo: Photo) => void;
  onRotateRight?: (photo: Photo) => void;
  onConvertToAstro?: (photo: Photo) => void;
  onDelete?: (photo: Photo) => void;
  busy?: boolean;
  albumLink?: { href: string; label: string };
}) {
  const router = useRouter();
  const albumMap = useMemo(
    () => new Map(albums.map((a) => [a.id, a])),
    [albums]
  );
  const [decorPending, startDecor] = useTransition();
  const [decorError, setDecorError] = useState<string | null>(null);

  function applyPhotoDecoration(
    photoId: string,
    patch: {
      frame?: string | null;
      filter?: string | null;
      frame_width?: string | null;
    }
  ) {
    setDecorError(null);
    startDecor(async () => {
      try {
        const res = await setPhotoDecorations(photoId, patch);
        if (!res.ok) setDecorError(res.error ?? "couldn’t save decoration.");
        else router.refresh();
      } catch (e) {
        setDecorError(
          e instanceof Error ? e.message : "couldn’t reach the server."
        );
      }
    });
  }
  const photo = photos[index];

  // Render into document.body so the fixed-position backdrop can't get
  // trapped by an ancestor's containing block (transform / contain / etc).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

  if (!photo || !mounted) return null;

  const album = photo.album_id ? albumMap.get(photo.album_id) ?? null : null;
  const decor = resolveDecoration(photo, album);
  const filterCss = filterCssFor(decor.filter);
  const frameClass = frameOverlayFor(decor.frame, decor.frameWidth);
  const outerRadiusClass = frameOuterRadiusFor(
    decor.frame,
    decor.frameWidth
  );
  const isSolidFrame = !!frameInsetFor(decor.frame, decor.frameWidth);
  const padClass = isSolidFrame
    ? framePadFor(decor.frame, decor.frameWidth)
    : "";
  const matBgClass = isSolidFrame ? frameMatBgFor(decor.frame) : "";

  const date = photo.taken_at ?? photo.created_at;
  const dateLabel = date
    ? new Date(date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption || "photo"}
      className="fixed inset-0 z-[100] bg-skynavy-900/95 backdrop-blur-sm flex flex-col"
      style={{
        // Honor iOS / Android safe areas so the top bar isn't trapped
        // under the status notch or browser chrome on mobile.
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      onClick={onClose}
    >
      {/* Top bar — sticks to the top with a strong dark gradient so
          the close button stays reachable even on tall portrait
          phones where the photo would otherwise dominate. */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-3 text-cream/80 gap-2 shrink-0">
        <span className="font-script text-cream/70 text-xl select-none">
          {photo.hidden ? "○ hidden" : "✿"}
        </span>
        <div className="flex items-center gap-2">
          {albumLink ? (
            <Link
              href={albumLink.href}
              className="rounded-pill px-3 py-2 text-sm font-semibold bg-cream/10 text-cream border border-cream/20 hover:bg-cream/20"
            >
              {albumLink.label} →
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="rounded-full w-11 h-11 sm:w-auto sm:h-auto sm:rounded-pill sm:px-3 sm:py-2 inline-flex items-center justify-center text-base sm:text-sm font-semibold bg-cream/15 text-cream border border-cream/30 hover:bg-cream/25"
          >
            <span aria-hidden className="sm:hidden text-lg leading-none">
              ✕
            </span>
            <span aria-hidden className="hidden sm:inline">
              ✕ close
            </span>
          </button>
        </div>
      </div>

      {/* Photo + meta — stop click bubbling so clicks inside don't
          dismiss. Outer wrapper scrolls only as a fallback for tall
          portrait photos where photo + controls genuinely don't fit
          the viewport together; in the common case the photo is
          capped by viewport units so meta panel stays visible
          without any scroll needed. */}
      <div
        className="flex-1 min-h-0 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-full flex flex-col items-center justify-center px-4 pb-6 gap-4">
        <div className="relative w-full max-w-[1100px] flex items-center justify-center">
          <NavArrow direction="prev" onClick={goPrev} />

          {(() => {
            // Size the wrapper to the photo's aspect-ratio so the
            // frame overlay can hug the image's actual rendered
            // edges (not the surrounding letterbox space). If the
            // photo's dimensions aren't stored we skip the frame
            // rather than render it misaligned.
            const haveDims =
              photo.width &&
              photo.height &&
              photo.width > 0 &&
              photo.height > 0;
            const aspect = haveDims
              ? `${photo.width} / ${photo.height}`
              : undefined;
            return (
              <div
                className={
                  "relative overflow-hidden " +
                  outerRadiusClass +
                  " " +
                  padClass +
                  " " +
                  matBgClass
                }
                style={{
                  aspectRatio: aspect,
                  maxWidth: "100%",
                  // Hard viewport cap so tall portrait photos don't
                  // balloon the layout. ~260px reserves room for top
                  // bar + a typical meta panel (caption + admin
                  // actions + the two decoration chip rows) so they
                  // stay reachable without scrolling on most
                  // screens. Larger meta panels still fit thanks to
                  // the outer overflow-y-auto.
                  maxHeight: "calc(100vh - 260px)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.image_url}
                  alt={photo.caption || ""}
                  style={{
                    transform: (() => {
                      const parts: string[] = [];
                      if (photo.rotation)
                        parts.push(`rotate(${photo.rotation}deg)`);
                      if (photo.flipped) parts.push("scaleX(-1)");
                      return parts.length > 0 ? parts.join(" ") : undefined;
                    })(),
                    filter: filterCss || undefined,
                    // No-dimensions fallback needs the same vh cap
                    // as the aspect-ratio'd wrapper so it doesn't
                    // grow unbounded.
                    maxHeight: haveDims ? undefined : "calc(100vh - 260px)",
                    maxWidth: "100%",
                  }}
                  className={
                    haveDims
                      ? "block w-full h-full object-contain rounded-md shadow-soft transition-transform"
                      : "object-contain rounded-md shadow-soft transition-transform block"
                  }
                />
                {haveDims && frameClass ? (
                  <span
                    aria-hidden
                    className={
                      "absolute inset-0 pointer-events-none " + frameClass
                    }
                  />
                ) : null}
              </div>
            );
          })()}

          <NavArrow direction="next" onClick={goNext} />
        </div>

        <div className="w-full max-w-[680px] rounded-md bg-cream/5 border border-cream/10 px-5 py-4 text-cream">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            {/* pr-1 reserves a slim gutter so the script font's
                italic "d" doesn't get visually clipped against the
                neighboring date column. */}
            <p className="font-script text-cream text-2xl leading-tight pr-1">
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

          {isAdmin && (onEdit || onToggleHidden || onRotateLeft || onRotateRight || onConvertToAstro || onDelete) ? (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-cream/10">
              {onRotateLeft ? (
                <ActionBtn onClick={() => onRotateLeft(photo)} disabled={busy}>
                  ↶ rotate
                </ActionBtn>
              ) : null}
              {onRotateRight ? (
                <ActionBtn onClick={() => onRotateRight(photo)} disabled={busy}>
                  ↷ rotate
                </ActionBtn>
              ) : null}
              {onEdit ? (
                <ActionBtn onClick={() => onEdit(photo)} disabled={busy}>
                  ✎ edit
                </ActionBtn>
              ) : null}
              {onToggleHidden ? (
                <ActionBtn
                  onClick={() => onToggleHidden(photo)}
                  disabled={busy}
                >
                  {photo.hidden ? "○ show" : "◐ hide"}
                </ActionBtn>
              ) : null}
              {onConvertToAstro ? (
                <ActionBtn
                  onClick={() => onConvertToAstro(photo)}
                  disabled={busy}
                >
                  ✦ to astrophotos
                </ActionBtn>
              ) : null}
              {onDelete ? (
                <ActionBtn
                  onClick={() => onDelete(photo)}
                  disabled={busy}
                  danger
                >
                  ✕ delete
                </ActionBtn>
              ) : null}
            </div>
          ) : null}

          {isAdmin ? (
            <div className="mt-3 flex flex-col gap-2">
              <DecorationChipRow
                label="frame"
                options={FRAMES}
                currentId={photo.cover_frame}
                albumValue={album?.cover_frame ?? null}
                disabled={decorPending}
                onPick={(id) =>
                  applyPhotoDecoration(photo.id, { frame: id })
                }
              />
              <DecorationChipRow
                label="filter"
                options={FILTERS}
                currentId={photo.cover_filter}
                albumValue={album?.cover_filter ?? null}
                disabled={decorPending}
                onPick={(id) =>
                  applyPhotoDecoration(photo.id, { filter: id })
                }
              />
              {/* Width override only useful when there's an effective
                  frame on this photo (explicit or inherited). */}
              {(photo.cover_frame === null
                ? album?.cover_frame ?? null
                : photo.cover_frame || null) ? (
                <WidthChipRow
                  currentId={photo.cover_frame_width}
                  albumValue={album?.cover_frame_width ?? null}
                  disabled={decorPending}
                  onPick={(id) =>
                    applyPhotoDecoration(photo.id, { frame_width: id })
                  }
                />
              ) : null}
              {decorError ? (
                <p className="text-[11px] text-pink-200 font-semibold">
                  {decorError}
                </p>
              ) : null}
            </div>
          ) : null}

          <p className="text-[11px] text-cream/50 mt-3">
            {index + 1} of {photos.length} · arrow keys to browse · esc to close
          </p>
        </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Dark-theme decoration chips for the lightbox meta panel. Same
// click semantics as PhotoEditModal: null = follow album, preset
// id = override; clicking a selected chip clears the override.
function DecorationChipRow({
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
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] uppercase tracking-wide font-bold text-cream/55 mr-1 w-12 shrink-0">
        {label}
      </span>
      <ChipBtn
        active={currentId === null}
        onClick={() => onPick(null)}
        disabled={disabled}
      >
        {inheritLabel}
      </ChipBtn>
      {/* Explicit "no decoration" override — distinct from "follow
          album" because admin may want to suppress an album-level
          frame/filter on a specific photo. */}
      <ChipBtn
        active={currentId === ""}
        onClick={() => onPick("")}
        disabled={disabled}
      >
        none
      </ChipBtn>
      {options.map((opt) => {
        const selected = currentId === opt.id;
        return (
          <ChipBtn
            key={opt.id}
            active={selected}
            onClick={() => onPick(selected ? null : opt.id)}
            disabled={disabled}
          >
            {opt.label}
          </ChipBtn>
        );
      })}
    </div>
  );
}

// Width override for the lightbox meta panel — only meaningful when
// the photo has an effective frame. NULL = follow album's width.
function WidthChipRow({
  currentId,
  albumValue,
  disabled,
  onPick,
}: {
  currentId: string | null;
  albumValue: string | null;
  disabled?: boolean;
  onPick: (id: string | null) => void;
}) {
  const inheritLabel = albumValue
    ? `follow album · ${albumValue}`
    : "follow album";
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] uppercase tracking-wide font-bold text-cream/55 mr-1 w-12 shrink-0">
        width
      </span>
      <ChipBtn
        active={currentId === null}
        onClick={() => onPick(null)}
        disabled={disabled}
      >
        {inheritLabel}
      </ChipBtn>
      {FRAME_SIZES.map((s) => {
        const selected = currentId === s.id;
        return (
          <ChipBtn
            key={s.id}
            active={selected}
            onClick={() => onPick(selected ? null : s.id)}
            disabled={disabled}
          >
            {s.label}
          </ChipBtn>
        );
      })}
    </div>
  );
}

function ChipBtn({
  children,
  active,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "rounded-pill px-2.5 py-1 text-[11px] font-semibold border transition disabled:opacity-50 " +
        (active
          ? "bg-pink-300 text-white border-pink-300"
          : "bg-cream/10 text-cream border-cream/20 hover:bg-cream/20")
      }
    >
      {children}
    </button>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
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
        "rounded-pill px-3 py-1.5 text-xs font-semibold border transition-colors disabled:opacity-50 disabled:cursor-wait " +
        (danger
          ? "bg-cream/5 text-pink-200 border-pink-400/40 hover:bg-pink-400/15"
          : "bg-cream/10 text-cream border-cream/20 hover:bg-cream/20")
      }
    >
      {children}
    </button>
  );
}

// Big, soft prev/next button for the lightbox. SVG chevron (not the
// thin "‹/›" text glyphs, which render inconsistently across mobile
// fonts), backdrop-blurred dark fill so it reads on any photo, and a
// 44–48px hit area that feels right under a fingertip.
function NavArrow({
  direction,
  onClick,
}: {
  direction: "prev" | "next";
  onClick: () => void;
}) {
  const isPrev = direction === "prev";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isPrev ? "previous" : "next"}
      className={
        "absolute top-1/2 -translate-y-1/2 z-10 " +
        "w-11 h-11 sm:w-12 sm:h-12 rounded-full " +
        "bg-skynavy-900/55 hover:bg-skynavy-900/80 active:bg-skynavy-900/90 " +
        "text-cream border border-cream/30 hover:border-cream/55 " +
        "shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-sm " +
        "flex items-center justify-center transition " +
        (isPrev ? "left-2 sm:left-3" : "right-2 sm:right-3")
      }
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5 sm:w-[22px] sm:h-[22px]"
        aria-hidden
      >
        {isPrev ? (
          <polyline points="15 5 8 12 15 19" />
        ) : (
          <polyline points="9 5 16 12 9 19" />
        )}
      </svg>
    </button>
  );
}
