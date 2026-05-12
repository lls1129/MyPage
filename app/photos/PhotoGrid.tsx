"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Photo } from "@/lib/supabase/photos";
import type { Album } from "@/lib/supabase/albums";
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
}: {
  photos: Photo[];
  isAdmin: boolean;
  albums?: Album[];
}) {
  const router = useRouter();
  const [tag, setTag] = useState<string>("all");
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [editing, setEditing] = useState<Photo | null>(null);
  const [showHidden, setShowHidden] = useState<boolean>(false);
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
            href="/admin/photos/upload"
            className="lift inline-flex items-center rounded-pill px-3.5 py-1.5 text-sm font-semibold bg-pink-200 text-white border border-pink-200 shadow-soft hover:border-pink-400"
          >
            + upload
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
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 mt-2 [column-fill:_balance]">
          {filtered.map((photo, i) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              isAdmin={isAdmin}
              onOpen={() => setOpenIdx(i)}
              onEdit={() => onEdit(photo)}
              onToggleHidden={() => onToggleHidden(photo)}
              onRotateLeft={() => onRotateLeft(photo)}
              onRotateRight={() => onRotateRight(photo)}
              onDelete={() => onDelete(photo)}
              busy={pending}
            />
          ))}
        </div>
      )}

      {openIdx !== null ? (
        <Lightbox
          photos={filtered}
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

function PhotoTile({
  photo,
  isAdmin,
  onOpen,
  onEdit,
  onToggleHidden,
  onRotateLeft,
  onRotateRight,
  onDelete,
  busy,
}: {
  photo: Photo;
  isAdmin: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onToggleHidden: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <div
      className={
        "group block w-full mb-4 break-inside-avoid relative overflow-hidden rounded-md bg-pink-50 border shadow-soft lift " +
        (photo.hidden
          ? "border-lavender-200 ring-2 ring-lavender-100"
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
          loading="lazy"
          style={rotationStyle(photo.rotation)}
          className={
            "block w-full h-auto transition-transform " +
            (photo.hidden ? "opacity-60" : "")
          }
        />
      </button>

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
