"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Photo } from "@/lib/supabase/photos";
import type { Album } from "@/lib/supabase/albums";
import {
  filterCssFor,
  frameInsetFor,
  frameOuterRadiusFor,
  frameOverlayFor,
  resolveDecoration,
} from "../components/cover-decorations";
import { Lightbox } from "./Lightbox";
import { PhotoEditModal } from "./PhotoEditModal";
import {
  togglePhotoHidden,
  rotatePhoto,
  deletePhoto,
  convertPhotoToAstrophoto,
} from "./admin-actions";

function rotationStyle(rotation: number | null | undefined) {
  if (!rotation) return undefined;
  return { transform: `rotate(${rotation}deg)` };
}

export function PhotoGrid({
  photos,
  isAdmin,
  albums = [],
  albumId,
}: {
  photos: Photo[];
  isAdmin: boolean;
  albums?: Album[];
  /** When set, the "+ upload" pill pre-selects this album so uploads
   *  from inside an album default to that album, not uncategorized. */
  albumId?: string;
}) {
  const router = useRouter();
  const [tag, setTag] = useState<string>("all");
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [editing, setEditing] = useState<Photo | null>(null);
  // Default-on when ?show=all is in the URL — used by the upload
  // editor's "view in album" deep link so admin lands on a page
  // already showing the photo they just uploaded (which may be
  // hidden). Admin can still toggle off via the show-hidden pill.
  const searchParams = useSearchParams();
  const wantsAllVisible = searchParams.get("show") === "all";
  const [showHidden, setShowHidden] = useState<boolean>(wantsAllVisible);
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const visible = useMemo(
    () => (isAdmin && showHidden ? photos : photos.filter((p) => !p.hidden)),
    [photos, isAdmin, showHidden]
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    visible.forEach((p) => p.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [visible]);

  const filtered = useMemo(
    () => (tag === "all" ? visible : visible.filter((p) => p.tags.includes(tag))),
    [visible, tag]
  );

  // Lookup map for resolving per-photo decoration fallback to the
  // photo's album. Computed once per `albums` change.
  const albumMap = useMemo(
    () => new Map(albums.map((a) => [a.id, a])),
    [albums]
  );

  const hiddenCount = useMemo(
    () => photos.filter((p) => p.hidden).length,
    [photos]
  );

  function chooseTag(next: string) {
    setTag(next);
    setOpenIdx(null);
  }

  function runAction(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      setActionError(null);
      const result = await fn();
      if (!result.ok) {
        setActionError(result.error ?? "Action failed.");
        return;
      }
      router.refresh();
    });
  }

  function onToggleHidden(photo: Photo) {
    runAction(() => togglePhotoHidden(photo.id, !photo.hidden));
  }

  function onRotateLeft(photo: Photo) {
    runAction(() => rotatePhoto(photo.id, "left"));
  }

  function onRotateRight(photo: Photo) {
    runAction(() => rotatePhoto(photo.id, "right"));
  }

  function onDelete(photo: Photo) {
    if (!confirm(`Delete this photo? "${photo.caption || "untitled"}"`)) return;
    runAction(() => deletePhoto(photo.id));
    if (openIdx !== null) setOpenIdx(null);
  }

  function onConvertToAstro(photo: Photo) {
    if (
      !confirm(
        `Move this photo into the astrophotos album? You'll be able to edit the object name + technical metadata afterward.`
      )
    )
      return;
    startTransition(async () => {
      setActionError(null);
      const result = await convertPhotoToAstrophoto(photo.id);
      if (!result.ok) {
        setActionError(result.error ?? "Convert failed.");
        return;
      }
      router.push("/astronomy");
    });
  }

  function onEdit(photo: Photo) {
    setEditing(photo);
  }

  return (
    <>
      {isAdmin ? (
        <div className="flex flex-wrap items-center gap-2 -mb-2">
          <Link
            href={
              albumId
                ? `/admin/photos/upload?album=${encodeURIComponent(albumId)}`
                : "/admin/photos/upload"
            }
            className="lift inline-flex items-center rounded-pill px-3.5 py-1.5 text-sm font-semibold bg-pink-200 text-white border border-pink-200 shadow-soft hover:border-pink-400"
          >
            + upload{albumId ? " here" : ""}
          </Link>
          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowHidden((v) => !v)}
              aria-pressed={showHidden}
              className={
                "lift inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm font-semibold border " +
                (showHidden
                  ? "bg-lavender-100 text-lavender-800 border-lavender-200"
                  : "bg-white text-lavender-600 border-pink-100 hover:border-pink-200")
              }
            >
              {showHidden ? "✓ showing hidden" : "show hidden"}
              <span className="text-[11px] bg-lavender-50 text-lavender-600 rounded-full px-1.5">
                {hiddenCount}
              </span>
            </button>
          ) : null}
          {actionError ? (
            <span className="text-xs text-pink-600 font-semibold">
              {actionError}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <FilterPill
          label="all"
          count={visible.length}
          active={tag === "all"}
          onClick={() => chooseTag("all")}
        />
        {allTags.map((t) => {
          const count = visible.filter((p) => p.tags.includes(t)).length;
          return (
            <FilterPill
              key={t}
              label={t}
              count={count}
              active={tag === t}
              onClick={() => chooseTag(t)}
            />
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-lavender-600 mt-6 text-center">
          ✿ no photos match this tag yet
        </p>
      ) : (
        <MasonryGrid
          photos={filtered}
          albumMap={albumMap}
          isAdmin={isAdmin}
          onOpen={(i) => setOpenIdx(i)}
          onEdit={onEdit}
          onToggleHidden={onToggleHidden}
          onRotateLeft={onRotateLeft}
          onRotateRight={onRotateRight}
          onDelete={onDelete}
          busy={pending}
        />
      )}

      {openIdx !== null ? (
        <Lightbox
          photos={filtered}
          albums={albums}
          index={openIdx}
          isAdmin={isAdmin}
          onClose={() => setOpenIdx(null)}
          onChange={setOpenIdx}
          onEdit={onEdit}
          onToggleHidden={onToggleHidden}
          onRotateLeft={onRotateLeft}
          onRotateRight={onRotateRight}
          onConvertToAstro={onConvertToAstro}
          onDelete={onDelete}
          busy={pending}
        />
      ) : null}

      {editing ? (
        <PhotoEditModal
          photo={editing}
          albums={albums}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

// Pick a column count from the current window width. Matches the
// Tailwind breakpoints we use elsewhere (sm = 640, lg = 1024).
function useColumnCount(): number {
  const [cols, setCols] = useState(() => {
    if (typeof window === "undefined") return 3;
    const w = window.innerWidth;
    return w >= 1024 ? 3 : w >= 640 ? 2 : 1;
  });
  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      const next = w >= 1024 ? 3 : w >= 640 ? 2 : 1;
      setCols((cur) => (cur === next ? cur : next));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return cols;
}

// Round-robin distribute photos across N flex-col columns. Avoids the
// CSS multi-column layout quirks that were hiding photos in columns
// 2/3 on PC. Column count adapts to viewport on resize; on mobile
// (1 column) every photo stacks in a single column.
function MasonryGrid({
  photos,
  albumMap,
  isAdmin,
  onOpen,
  onEdit,
  onToggleHidden,
  onRotateLeft,
  onRotateRight,
  onDelete,
  busy,
}: {
  photos: Photo[];
  albumMap: Map<string, Album>;
  isAdmin: boolean;
  onOpen: (i: number) => void;
  onEdit: (p: Photo) => void;
  onToggleHidden: (p: Photo) => void;
  onRotateLeft: (p: Photo) => void;
  onRotateRight: (p: Photo) => void;
  onDelete: (p: Photo) => void;
  busy: boolean;
}) {
  const cols = useColumnCount();
  const buckets = useMemo(() => {
    const out: { photo: Photo; globalIndex: number }[][] = Array.from(
      { length: cols },
      () => []
    );
    photos.forEach((photo, i) => {
      out[i % cols].push({ photo, globalIndex: i });
    });
    return out;
  }, [photos, cols]);

  return (
    <div
      className="grid gap-4 mt-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {buckets.map((bucket, ci) => (
        <div key={ci} className="flex flex-col gap-4 min-w-0">
          {bucket.map(({ photo, globalIndex }) => {
            const album = photo.album_id
              ? albumMap.get(photo.album_id) ?? null
              : null;
            const decor = resolveDecoration(photo, album);
            return (
              <PhotoTile
                key={photo.id}
                photo={photo}
                frame={decor.frame}
                frameWidth={decor.frameWidth}
                filter={decor.filter}
                isAdmin={isAdmin}
                eager={globalIndex < 6}
                onOpen={() => onOpen(globalIndex)}
                onEdit={() => onEdit(photo)}
                onToggleHidden={() => onToggleHidden(photo)}
                onRotateLeft={() => onRotateLeft(photo)}
                onRotateRight={() => onRotateRight(photo)}
                onDelete={() => onDelete(photo)}
                busy={busy}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function PhotoTile({
  photo,
  frame,
  frameWidth,
  filter,
  isAdmin,
  eager,
  onOpen,
  onEdit,
  onToggleHidden,
  onRotateLeft,
  onRotateRight,
  onDelete,
  busy,
}: {
  photo: Photo;
  frame: string | null;
  frameWidth: string;
  filter: string | null;
  isAdmin: boolean;
  eager: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onToggleHidden: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const filterCss = filterCssFor(filter);
  const frameClass = frameOverlayFor(frame, frameWidth);
  // Solid frames paint their own outer outline + shape, so we drop
  // the wrapper's pink border + bg-pink-50 + small rounded-md and
  // adopt the frame's outer radius so the photo clips along the
  // frame's curve. Decorative frames (and frame-less photos) keep
  // the original wrapper chrome.
  const isSolidFrame = !!frameInsetFor(frame, frameWidth);
  const outerRadiusClass =
    frameOuterRadiusFor(frame, frameWidth) ||
    (isSolidFrame ? "" : "rounded-md");
  return (
    <div
      className={
        "group block w-full mb-4 break-inside-avoid relative overflow-hidden lift " +
        outerRadiusClass +
        " " +
        (isSolidFrame
          ? "shadow-soft "
          : "bg-pink-50 border shadow-soft ") +
        (photo.hidden
          ? isSolidFrame
            ? "ring-2 ring-lavender-100"
            : "border-lavender-200 ring-2 ring-lavender-100"
          : isSolidFrame
          ? ""
          : "border-pink-100 hover:border-pink-200")
      }
    >
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left"
        aria-label={photo.caption || "open photo"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.image_url}
          alt={photo.caption || ""}
          width={photo.width ?? undefined}
          height={photo.height ?? undefined}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          style={{
            ...(rotationStyle(photo.rotation) ?? {}),
            filter: filterCss || undefined,
          }}
          className={
            "block w-full h-auto transition-transform " +
            (photo.hidden ? "opacity-60" : "")
          }
        />
      </button>

      {/* Frame overlay — sits above the image, intercepts no clicks
          so the open-photo button below still receives them. */}
      {frameClass ? (
        <div
          className={"absolute inset-0 pointer-events-none " + frameClass}
          aria-hidden
        />
      ) : null}

      {photo.hidden ? (
        <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wide font-bold rounded-pill bg-lavender-100 text-lavender-800 px-2 py-0.5 border border-lavender-200">
          hidden
        </span>
      ) : null}

      {photo.caption ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 px-3 py-2 bg-gradient-to-t from-skynavy-900/80 via-skynavy-900/40 to-transparent text-cream text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          {photo.caption}
        </span>
      ) : null}

      {isAdmin ? (
        <div className="absolute top-2 right-2 flex flex-wrap items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <IconBtn label="rotate left" onClick={onRotateLeft} disabled={busy}>
            ↶
          </IconBtn>
          <IconBtn label="rotate right" onClick={onRotateRight} disabled={busy}>
            ↷
          </IconBtn>
          <IconBtn label="edit" onClick={onEdit} disabled={busy}>
            ✎
          </IconBtn>
          <IconBtn
            label={photo.hidden ? "show" : "hide"}
            onClick={onToggleHidden}
            disabled={busy}
          >
            {photo.hidden ? "○" : "◐"}
          </IconBtn>
          <IconBtn label="delete" onClick={onDelete} disabled={busy} danger>
            ✕
          </IconBtn>
        </div>
      ) : null}
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
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
      aria-label={label}
      title={label}
      className={
        "w-7 h-7 rounded-full text-sm font-semibold backdrop-blur bg-cream/85 border shadow-soft hover:bg-cream flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-wait " +
        (danger
          ? "text-pink-800 border-pink-200 hover:border-pink-400"
          : "text-pink-700 border-pink-100 hover:border-pink-200")
      }
    >
      {children}
    </button>
  );
}

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "lift inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-sm font-semibold border transition-colors " +
        (active
          ? "bg-pink-200 text-white border-pink-200 shadow-soft"
          : "bg-white text-pink-800 border-pink-100 hover:border-pink-200")
      }
    >
      {label}
      <span
        className={
          "text-[11px] font-semibold rounded-full px-1.5 " +
          (active ? "bg-white/20 text-white" : "bg-pink-50 text-pink-600")
        }
      >
        {count}
      </span>
    </button>
  );
}
