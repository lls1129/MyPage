"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { Photo } from "@/lib/supabase/photos";
import type { Album } from "@/lib/supabase/albums";
import {
  updatePhotoMeta,
  setPhotoDecorations,
  setPhotoOverlays,
  setPhotoCrop,
  rotatePhoto,
  flipPhoto,
} from "./admin-actions";
import {
  FILTERS,
  FRAMES,
  FRAME_SIZES,
  filterCssFor,
  frameInsetFor,
  frameOverlayFor,
} from "../components/cover-decorations";
import { OverlayEditor } from "../components/OverlayEditor";
import { PhotoCropper } from "../components/PhotoCropper";
import { lockBodyScroll } from "@/lib/scroll-lock";
import {
  normalizeOverlays,
  type CoverOverlay,
} from "../components/cover-overlays";

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
  const [frameWidth, setFrameWidth] = useState<string | null>(
    photo.cover_frame_width
  );
  const [decorPending, startDecor] = useTransition();
  const [overlays, setOverlays] = useState<CoverOverlay[]>(() =>
    normalizeOverlays(photo.cover_overlays)
  );
  // Crop is a window onto the full image (source-relative 0..1).
  // Overlays are stored in FULL-image fractions, so changing the
  // crop never touches overlay data — the crop just reframes what's
  // shown (and clips overlays that fall outside it). Local state so
  // the editor's crop-boundary indicator updates instantly.
  const [crop, setCrop] = useState({
    x: photo.crop_x ?? 0,
    y: photo.crop_y ?? 0,
    w: photo.crop_w ?? 1,
    h: photo.crop_h ?? 1,
  });
  const [cropping, setCropping] = useState(false);
  // Local rotation / flip so the preview updates instantly; the
  // server actions persist and router.refresh() reconciles.
  const [rotation, setRotation] = useState(photo.rotation ?? 0);
  const [flipped, setFlipped] = useState(!!photo.flipped);
  const [orientPending, startOrient] = useTransition();
  const album = albums.find((a) => a.id === photo.album_id) ?? null;

  function doRotate(direction: "left" | "right") {
    setRotation((r) =>
      ((direction === "right" ? r + 90 : r + 270) + 360) % 360
    );
    startOrient(async () => {
      const res = await rotatePhoto(photo.id, direction);
      if (!res.ok) setError(res.error ?? "couldn’t rotate.");
      else router.refresh();
    });
  }

  function doFlip() {
    setFlipped((f) => !f);
    startOrient(async () => {
      const res = await flipPhoto(photo.id);
      if (!res.ok) setError(res.error ?? "couldn’t flip.");
      else router.refresh();
    });
  }
  // Width picker only makes sense when there's actually a frame on
  // this photo (either explicit or inherited from the album).
  const effectiveFrame =
    frame === null ? album?.cover_frame ?? null : frame || null;

  function applyDecoration(patch: {
    frame?: string | null;
    filter?: string | null;
    frame_width?: string | null;
  }) {
    if ("frame" in patch) setFrame(patch.frame ?? null);
    if ("filter" in patch) setFilter(patch.filter ?? null);
    if ("frame_width" in patch) setFrameWidth(patch.frame_width ?? null);
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
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => lockBodyScroll(), []);

  if (!mounted) return null;

  return createPortal(
    // Outer layer owns the backdrop + scroll. When the expanded
    // overlay editor makes the card taller than the viewport, the
    // whole layer scrolls (min-h-full + items-center keeps it
    // centered while short) instead of clipping the card's top and
    // bottom off-screen with no way to reach them.
    <div
      className="fixed inset-0 z-[110] bg-skynavy-900/85 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4">
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
            {effectiveFrame ? (
              <WidthRow
                currentId={frameWidth}
                albumValue={album?.cover_frame_width ?? null}
                disabled={decorPending}
                onPick={(id) =>
                  applyDecoration({ frame_width: id })
                }
              />
            ) : null}
          </div>

          {/* Orientation — rotate / flip, same actions as the album
              grid but available without leaving the editor. Flip is
              mirrored live in the overlay editor; rotation persists +
              is correct in the viewer. */}
          <div className="flex items-center gap-2 flex-wrap rounded-md bg-pink-50/60 border border-pink-100 p-2.5">
            <span className="label text-pink-600">orient</span>
            {rotation % 360 !== 0 || flipped ? (
              <span className="text-[11px] text-lavender-600">
                {rotation % 360 !== 0 ? `${rotation % 360}°` : ""}
                {rotation % 360 !== 0 && flipped ? " · " : ""}
                {flipped ? "flipped" : ""}
              </span>
            ) : null}
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => doRotate("left")}
              disabled={orientPending}
              title="rotate left"
              className="rounded-pill bg-white text-pink-800 border border-pink-200 hover:border-pink-400 px-3 py-1 text-[11px] font-semibold disabled:opacity-60"
            >
              ↺ left
            </button>
            <button
              type="button"
              onClick={() => doRotate("right")}
              disabled={orientPending}
              title="rotate right"
              className="rounded-pill bg-white text-pink-800 border border-pink-200 hover:border-pink-400 px-3 py-1 text-[11px] font-semibold disabled:opacity-60"
            >
              ↻ right
            </button>
            <button
              type="button"
              onClick={doFlip}
              disabled={orientPending}
              title="flip horizontally"
              className="rounded-pill bg-white text-pink-800 border border-pink-200 hover:border-pink-400 px-3 py-1 text-[11px] font-semibold disabled:opacity-60"
            >
              ⇄ flip
            </button>
          </div>

          {/* Crop — trim the source to a window. Overlays are stored
              in full-image coords, so cropping reframes them (and
              clips whatever falls outside) without moving them
              relative to the photo. */}
          <div className="flex items-center gap-2 flex-wrap rounded-md bg-pink-50/60 border border-pink-100 p-2.5">
            <span className="label text-pink-600">crop</span>
            <span className="text-[11px] text-lavender-600">
              {isTrivialCrop(crop)
                ? "full image"
                : `${Math.round(crop.w * 100)}% × ${Math.round(
                    crop.h * 100
                  )}% window`}
            </span>
            <span className="flex-1" />
            {!isTrivialCrop(crop) ? (
              <button
                type="button"
                onClick={async () => {
                  const full = { x: 0, y: 0, w: 1, h: 1 };
                  const r = await setPhotoCrop(photo.id, full);
                  if (r.ok) {
                    setCrop(full);
                    router.refresh();
                  } else {
                    setError(r.error ?? "couldn’t reset crop.");
                  }
                }}
                className="rounded-pill bg-white text-pink-800 border border-pink-200 hover:border-pink-400 px-3 py-1 text-[11px] font-semibold"
              >
                reset
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setCropping(true)}
              className="rounded-pill bg-pink-200 text-white border border-pink-200 hover:bg-pink-300 hover:border-pink-300 px-3 py-1 text-[11px] font-semibold"
            >
              ✂ adjust crop
            </button>
          </div>

          {cropping ? (
            <PhotoCropper
              imageUrl={photo.image_url}
              initialCrop={crop}
              onCommit={async (c) => {
                const r = await setPhotoCrop(photo.id, c);
                if (r.ok) {
                  setCrop(c);
                  router.refresh();
                }
                return r;
              }}
              onClose={() => setCropping(false)}
            />
          ) : null}

          {/* Per-photo overlays — stickers / captions / drawings.
              Editor is collapsed by default so the modal stays
              compact for the common case (caption + tags); admin
              taps the header to expand and decorate. Background is
              the photo itself, with the photo's effective frame
              applied so the editor mirrors what visitors will see. */}
          <OverlayEditor
            overlays={overlays}
            onChange={setOverlays}
            onCommit={async (next) => {
              const r = await setPhotoOverlays(photo.id, next);
              return r.ok
                ? ({ ok: true } as const)
                : ({
                    ok: false,
                    error: r.error ?? "couldn’t save overlays.",
                  } as const);
            }}
            stageInsetClass={frameInsetFor(
              effectiveFrame ?? null,
              frameWidth ?? album?.cover_frame_width ?? "medium"
            )}
            stageAspect={
              photo.width && photo.height && photo.width > 0 && photo.height > 0
                ? `${photo.width} / ${photo.height}`
                : "1 / 1"
            }
            flipped={flipped}
            background={
              <PhotoOverlayBackground
                photo={photo}
                rotation={rotation}
                flipped={flipped}
                frame={effectiveFrame ?? null}
                frameWidth={frameWidth ?? album?.cover_frame_width ?? "medium"}
                filter={
                  filter === null
                    ? album?.cover_filter ?? null
                    : filter || null
                }
                crop={crop}
              />
            }
          />

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
      </div>
    </div>,
    document.body
  );
}

// A crop is trivial (the whole image) when it starts at the origin
// and spans the full width and height.
function isTrivialCrop(c: { x: number; y: number; w: number; h: number }) {
  return c.x <= 0 && c.y <= 0 && c.w >= 1 && c.h >= 1;
}

// One decoration row for the photo edit modal. "follow album" is
// always first; when the album itself has a value, its label hints
// at what's inherited so admin knows the default they're following.
// Background for the per-photo OverlayEditor — the FULL photo (with
// frame + filter), so admin draws on the whole image; overlays are
// stored in full-image coords. When a crop is set, a dashed window +
// dimmed surround shows which part visitors will actually see, so
// admin knows what will be clipped. Used inside PhotoEditModal.
function PhotoOverlayBackground({
  photo,
  rotation,
  flipped,
  frame,
  frameWidth,
  filter,
  crop,
}: {
  photo: Photo;
  rotation: number;
  flipped: boolean;
  frame: string | null;
  frameWidth: string;
  filter: string | null;
  crop: { x: number; y: number; w: number; h: number };
}) {
  const filterCss = filterCssFor(filter);
  // Flip is mirrored live (the OverlayEditor mirrors overlays to
  // match). Rotation is intentionally NOT applied to the editor
  // preview: overlays are authored in the photo's canonical
  // orientation and the viewer rotates the whole composition
  // (photo + overlays) together, so editing stays in one stable
  // coordinate space. `rotation` is accepted for API symmetry.
  void rotation;
  const transform = flipped ? "scaleX(-1)" : undefined;
  return (
    <>
      <div
        className={
          "absolute overflow-hidden " +
          (frameInsetFor(frame, frameWidth) || "inset-0")
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.image_url}
          alt={photo.caption || ""}
          style={{
            transform,
            filter: filterCss || undefined,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
          className="block transition-transform"
        />
      </div>
      {!isTrivialCrop(crop) ? (
        <div
          aria-hidden
          className="absolute pointer-events-none border-2 border-dashed border-cream/90 rounded-[2px]"
          style={{
            left: `${crop.x * 100}%`,
            top: `${crop.y * 100}%`,
            width: `${crop.w * 100}%`,
            height: `${crop.h * 100}%`,
            // Huge spread dims everything outside the crop window;
            // the stage container clips it (overflow-hidden).
            boxShadow: "0 0 0 9999px rgba(24, 16, 43, 0.5)",
          }}
        />
      ) : null}
      {frame ? (
        <div
          className={
            "absolute inset-0 pointer-events-none " +
            frameOverlayFor(frame, frameWidth)
          }
          aria-hidden
        />
      ) : null}
    </>
  );
}

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

// Frame-thickness picker for the photo edit modal. Like
// DecorationRow but without the explicit "none" chip — width has
// no "off" state (every frame has some thickness). NULL = follow
// album's width; explicit thin/medium/thick = override.
function WidthRow({
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
    <div className="flex items-center gap-2 flex-wrap">
      <p className="label text-pink-600 shrink-0 w-12">width</p>
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
      {FRAME_SIZES.map((s) => {
        const selected = currentId === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(selected ? null : s.id)}
            disabled={disabled}
            className={
              "rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold transition disabled:opacity-60 " +
              (selected
                ? "bg-pink-300 text-white border-pink-300"
                : "bg-white text-pink-800 border-pink-200 hover:border-pink-400")
            }
          >
            {s.label}
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
