"use client";

import { useEffect, useRef, useState } from "react";
import {
  coverClipRadiusFor,
  filterCssFor,
  frameOverlayFor,
} from "./cover-decorations";
import { type CoverOverlay } from "./cover-overlays";
import { OverlayLayer } from "./OverlayLayer";

export type CoverCrop = { x: number; y: number; w: number; h: number };

type ActionResult = { ok: true } | { ok: false; error: string };

// Internal box: stored in source-image pixels for math clarity. The
// box is always square in source pixels — UI enforces this so the
// resulting card renders without distortion.
type Box = { x: number; y: number; size: number };

function trivial(): CoverCrop {
  return { x: 0, y: 0, w: 1, h: 1 };
}

function isTrivial(c: CoverCrop): boolean {
  return c.x === 0 && c.y === 0 && c.w === 1 && c.h === 1;
}

// Centered square crop based on natural dimensions. This is what
// object-cover would auto-pick — used as the starting box when the
// admin opens the cropper on a "no crop set" album.
function defaultBox(naturalW: number, naturalH: number): Box {
  const side = Math.min(naturalW, naturalH);
  return {
    x: (naturalW - side) / 2,
    y: (naturalH - side) / 2,
    size: side,
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

// Square crop editor. Shows the full source image scaled to fit the
// container; admin drags the box body to reposition or the corners to
// resize (always square). Commits the normalized crop on release.
//
// `recentCrops` is an optional list of previously-applied crops for
// this same image (surfaced as clickable presets next to the
// preview on wide screens).
export function CoverCropper({
  imageUrl,
  initialCrop,
  recentCrops = [],
  frame = null,
  frameWidth = "medium",
  filter = null,
  overlays = [],
  onCommit,
}: {
  imageUrl: string;
  initialCrop: CoverCrop;
  recentCrops?: CoverCrop[];
  /** Decoration preset ids — applied to the preview tile only, so the
   *  preview matches what the actual card on /photos will render. */
  frame?: string | null;
  frameWidth?: string;
  filter?: string | null;
  /** Live overlay list for the preview tile. Echoes whatever the
   *  overlay editor is showing so admin sees crop + decoration +
   *  overlays composed together. */
  overlays?: CoverOverlay[];
  onCommit: (crop: CoverCrop) => Promise<ActionResult>;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Display scale: source pixels → on-screen pixels. Set after the
  // image loads and we measure the stage.
  const [displayScale, setDisplayScale] = useState(1);
  const [box, setBox] = useState<Box | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Drag state stored in a ref so handlers don't see stale values.
  const dragRef = useRef<{
    mode: "move" | "nw" | "ne" | "sw" | "se";
    startPointerX: number;
    startPointerY: number;
    startBox: Box;
  } | null>(null);

  // Resize-observe the stage so we recompute displayScale when the
  // viewport changes (mobile rotation, etc.). Reserve a 14px buffer
  // around the image so the resize handles (which extrude ~10px past
  // the crop-box edges) stay inside the stage's overflow-hidden clip
  // even on landscape images that would otherwise fill the full
  // available height.
  useEffect(() => {
    if (!natural) return;
    const el = stageRef.current;
    if (!el) return;
    const HANDLE_MARGIN = 14;
    function measure() {
      if (!el || !natural) return;
      const rect = el.getBoundingClientRect();
      const sx = (rect.width - 2 * HANDLE_MARGIN) / natural.w;
      const sy = (rect.height - 2 * HANDLE_MARGIN) / natural.h;
      setDisplayScale(Math.max(0.001, Math.min(sx, sy)));
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [natural]);

  // Reset load state when the URL changes (admin pins a different
  // cover). Also: if the new image is already in the browser cache,
  // <img>'s onLoad may not fire after mount — sync naturalWidth/
  // naturalHeight directly off the ref to cover that case.
  useEffect(() => {
    setNatural(null);
    setLoadError(false);
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, [imageUrl]);

  // Latest initialCrop kept in a ref so we can re-seed the box when
  // the image (re)loads without making the seed-effect re-fire every
  // time a parent re-render produces a fresh initialCrop reference.
  // Re-firing was the cause of the "box snaps after every commit"
  // bug — numeric(6,4) round-trips through the server return slightly
  // shifted values that nudged the box mid-edit.
  const initialCropRef = useRef(initialCrop);
  useEffect(() => {
    initialCropRef.current = initialCrop;
  }, [initialCrop]);

  // Seed the box from initialCrop only when natural dimensions change
  // (i.e., the image just loaded or admin pinned a different cover).
  // Subsequent prop updates from server commits leave the draft alone.
  useEffect(() => {
    if (!natural) return;
    const ic = initialCropRef.current;
    if (isTrivial(ic)) {
      setBox(defaultBox(natural.w, natural.h));
      return;
    }
    setBox({
      x: ic.x * natural.w,
      y: ic.y * natural.h,
      // Width and height should be equal in source pixels (UI enforces
      // it). Use the smaller of the two as a defensive measure.
      size: Math.min(ic.w * natural.w, ic.h * natural.h),
    });
  }, [natural]);

  function commitCrop(crop: CoverCrop) {
    setError(null);
    setPending(true);
    onCommit(crop)
      .then((res) => {
        if (!res.ok) setError(res.error);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "couldn’t reach the server.");
      })
      .finally(() => setPending(false));
  }

  // The current draft as a normalized CoverCrop. Used both for the
  // dirty check and for the save handler.
  function boxToCrop(b: Box): CoverCrop {
    if (!natural) return trivial();
    return {
      x: b.x / natural.w,
      y: b.y / natural.h,
      w: b.size / natural.w,
      h: b.size / natural.h,
    };
  }

  function save() {
    if (!box || !natural) return;
    commitCrop(boxToCrop(box));
  }

  function reset() {
    if (!natural) return;
    // Draft only — admin still has to confirm with save.
    setBox(defaultBox(natural.w, natural.h));
  }

  function applyRecent(c: CoverCrop) {
    if (!natural) return;
    // Draft only — clicking a recent crop sets the box but doesn't
    // commit until save. This matches the rule for drags/resizes.
    setBox({
      x: c.x * natural.w,
      y: c.y * natural.h,
      size: Math.min(c.w * natural.w, c.h * natural.h),
    });
  }

  function startDrag(
    e: React.PointerEvent,
    mode: "move" | "nw" | "ne" | "sw" | "se"
  ) {
    if (!box) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startBox: box,
    };
  }

  function moveDrag(e: React.PointerEvent) {
    if (!dragRef.current || !natural || !box) return;
    const d = dragRef.current;
    // Pointer delta in display pixels → convert to source pixels.
    const dx = (e.clientX - d.startPointerX) / displayScale;
    const dy = (e.clientY - d.startPointerY) / displayScale;

    let next: Box;
    if (d.mode === "move") {
      next = {
        x: clamp(d.startBox.x + dx, 0, natural.w - d.startBox.size),
        y: clamp(d.startBox.y + dy, 0, natural.h - d.startBox.size),
        size: d.startBox.size,
      };
    } else {
      // Resize from a corner. We use the dominant axis (max abs delta)
      // and apply the change symmetrically so the box stays square.
      // The corner being dragged stays under the pointer (in source
      // coords) by anchoring the opposite corner.
      const anchorX =
        d.mode === "ne" || d.mode === "se"
          ? d.startBox.x
          : d.startBox.x + d.startBox.size;
      const anchorY =
        d.mode === "sw" || d.mode === "se"
          ? d.startBox.y
          : d.startBox.y + d.startBox.size;
      // Pointer position in source pixels at the dragged corner.
      const px =
        (d.mode === "ne" || d.mode === "se"
          ? d.startBox.x + d.startBox.size
          : d.startBox.x) + dx;
      const py =
        (d.mode === "sw" || d.mode === "se"
          ? d.startBox.y + d.startBox.size
          : d.startBox.y) + dy;
      // Square side = max of |px-anchorX|, |py-anchorY|, then clamp
      // so the box stays inside the image.
      let side = Math.max(Math.abs(px - anchorX), Math.abs(py - anchorY));
      // Minimum reasonable size: 32 source pixels OR 5% of min dim.
      const minSide = Math.max(32, Math.min(natural.w, natural.h) * 0.05);
      side = Math.max(side, minSide);
      // Direction from anchor toward pointer determines the new x/y.
      const xDir = d.mode === "ne" || d.mode === "se" ? 1 : -1;
      const yDir = d.mode === "sw" || d.mode === "se" ? 1 : -1;
      let nx = xDir > 0 ? anchorX : anchorX - side;
      let ny = yDir > 0 ? anchorY : anchorY - side;
      // Clamp to image bounds — shrink side if it overflows.
      if (nx < 0) {
        side -= -nx;
        nx = 0;
      }
      if (ny < 0) {
        side -= -ny;
        ny = 0;
      }
      if (nx + side > natural.w) side = natural.w - nx;
      if (ny + side > natural.h) side = natural.h - ny;
      // Re-clamp to minSide and recompute anchored origin.
      if (side < minSide) side = minSide;
      // Re-anchor in case clamping reduced side:
      if (xDir < 0) nx = anchorX - side;
      if (yDir < 0) ny = anchorY - side;
      next = { x: nx, y: ny, size: side };
    }
    setBox(next);
  }

  function endDrag(e: React.PointerEvent) {
    if (!dragRef.current || !box) return;
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    dragRef.current = null;
    // No auto-commit — admin must hit save explicitly. This stops
    // every micro-adjustment from polluting recent crops and prevents
    // the box from snapping after each release.
  }

  // Display coords of the box (source pixels * displayScale).
  const display = box && {
    left: box.x * displayScale,
    top: box.y * displayScale,
    size: box.size * displayScale,
  };
  const imgW = natural ? natural.w * displayScale : 0;
  const imgH = natural ? natural.h * displayScale : 0;

  // Live-preview crop for the side panel — uses current draft box.
  const previewCrop: CoverCrop =
    box && natural
      ? {
          x: box.x / natural.w,
          y: box.y / natural.h,
          w: box.size / natural.w,
          h: box.size / natural.h,
        }
      : trivial();

  // Has the admin's draft drifted from the saved crop? Tolerance is
  // 0.001 (0.1%) per axis to swallow FP noise from drag + numeric
  // (6,4) DB round-trip.
  const dirty =
    !!box &&
    !!natural &&
    (Math.abs(previewCrop.x - initialCrop.x) > 0.001 ||
      Math.abs(previewCrop.y - initialCrop.y) > 0.001 ||
      Math.abs(previewCrop.w - initialCrop.w) > 0.001 ||
      Math.abs(previewCrop.h - initialCrop.h) > 0.001);

  // Centering math for the stage. The image is letterboxed so we know
  // exactly where it lives within the stage container.
  const stage = stageRef.current;
  const stageW = stage?.clientWidth ?? 0;
  const stageH = stage?.clientHeight ?? 0;
  const padX = (stageW - imgW) / 2;
  const padY = (stageH - imgH) / 2;

  return (
    <div className="flex flex-col gap-3 rounded-md bg-white border border-pink-100 p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[11px] text-pink-800 font-semibold">
            ✦ crop &amp; zoom
          </p>
          <p className="text-[10px] text-ink/65">
            drag the box · drag a corner to zoom
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pending ? (
            <span className="text-[10px] text-pink-600 font-semibold">
              saving…
            </span>
          ) : dirty ? (
            <span className="text-[10px] text-amber-600 font-semibold">
              unsaved
            </span>
          ) : null}
          <button
            type="button"
            onClick={reset}
            disabled={pending || !natural}
            className="rounded-pill bg-white text-pink-800 border border-pink-200 hover:border-pink-400 px-2.5 py-0.5 text-[11px] font-semibold disabled:opacity-60"
          >
            ↺ reset
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending || !natural || !dirty}
            className={
              "rounded-pill border px-3 py-0.5 text-[11px] font-semibold disabled:opacity-50 " +
              (dirty
                ? "bg-pink-300 text-white border-pink-300 hover:bg-pink-400 hover:border-pink-400"
                : "bg-white text-pink-800 border-pink-200")
            }
          >
            {pending ? "saving…" : dirty ? "✓ save" : "saved"}
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        {/* Stage: shows the whole source image with the crop box on top. */}
        <div
          ref={stageRef}
          className="relative bg-gradient-to-br from-pink-50 to-lavender-50 border border-pink-200 rounded-md overflow-hidden flex items-center justify-center select-none touch-none"
          style={{ minHeight: 280, height: 360, flex: "1 1 0" }}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt=""
            draggable={false}
            // Some hosts (Wikimedia & friends) block hot-linking when
            // a referer header is present. no-referrer lets the
            // browser fetch without one, matching how the card
            // background-image is fetched.
            referrerPolicy="no-referrer"
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth > 0) {
                setNatural({ w: img.naturalWidth, h: img.naturalHeight });
                setLoadError(false);
              } else {
                // Loaded but no decodable dimensions (e.g., SVG
                // without intrinsic size). Treat as error.
                setLoadError(true);
              }
            }}
            onError={() => setLoadError(true)}
            style={{
              width: natural ? imgW : "auto",
              height: natural ? imgH : "auto",
              maxWidth: "none",
              maxHeight: "none",
              // Hide the raw img until we know its dimensions, so the
              // stage doesn't briefly show a giant unscaled version.
              visibility: natural ? "visible" : "hidden",
            }}
            className="pointer-events-none rounded-sm"
          />

          {natural && display ? (
            <>
              {/* Dimmed overlay outside the crop box (4 strips). */}
              <div
                className="absolute bg-skynavy-900/55 pointer-events-none"
                style={{
                  left: padX,
                  top: padY,
                  width: imgW,
                  height: display.top,
                }}
              />
              <div
                className="absolute bg-skynavy-900/55 pointer-events-none"
                style={{
                  left: padX,
                  top: padY + display.top + display.size,
                  width: imgW,
                  height: imgH - display.top - display.size,
                }}
              />
              <div
                className="absolute bg-skynavy-900/55 pointer-events-none"
                style={{
                  left: padX,
                  top: padY + display.top,
                  width: display.left,
                  height: display.size,
                }}
              />
              <div
                className="absolute bg-skynavy-900/55 pointer-events-none"
                style={{
                  left: padX + display.left + display.size,
                  top: padY + display.top,
                  width: imgW - display.left - display.size,
                  height: display.size,
                }}
              />
              {/* Crop box: body (move handle) + four corner handles +
                  inner third-grid hint lines (subtle). */}
              <div
                className="absolute border-2 border-dashed border-white shadow-[0_0_0_2px_rgba(244,114,182,0.85),inset_0_0_0_2px_rgba(244,114,182,0.85)] cursor-move touch-none"
                style={{
                  left: padX + display.left,
                  top: padY + display.top,
                  width: display.size,
                  height: display.size,
                }}
                onPointerDown={(e) => startDrag(e, "move")}
              >
                {/* Rule-of-thirds guides — softens the crop visually. */}
                <span className="absolute left-1/3 top-0 bottom-0 w-px bg-white/40 pointer-events-none" />
                <span className="absolute left-2/3 top-0 bottom-0 w-px bg-white/40 pointer-events-none" />
                <span className="absolute top-1/3 left-0 right-0 h-px bg-white/40 pointer-events-none" />
                <span className="absolute top-2/3 left-0 right-0 h-px bg-white/40 pointer-events-none" />
                {(["nw", "ne", "sw", "se"] as const).map((corner) => {
                  const isTop = corner.startsWith("n");
                  const isLeft = corner.endsWith("w");
                  // Visible dot is 16×16 but the hit area extends a
                  // bigger transparent pad around it so fingers can
                  // grab it reliably (28×28 effective hit target).
                  return (
                    <button
                      type="button"
                      key={corner}
                      onPointerDown={(e) => startDrag(e, corner)}
                      aria-label={`resize ${corner}`}
                      className="absolute flex items-center justify-center touch-none p-1.5 bg-transparent border-0"
                      style={{
                        left: isLeft ? -14 : "auto",
                        right: isLeft ? "auto" : -14,
                        top: isTop ? -14 : "auto",
                        bottom: isTop ? "auto" : -14,
                        cursor:
                          corner === "nw" || corner === "se"
                            ? "nwse-resize"
                            : "nesw-resize",
                      }}
                    >
                      <span className="w-4 h-4 bg-white border-2 border-pink-400 rounded-full shadow-soft block" />
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
          {!natural ? (
            <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
              {loadError ? (
                <p className="text-[11px] text-pink-700 font-semibold leading-snug">
                  couldn’t load this image for cropping — the host may
                  block direct embeds. try pinning a different cover.
                </p>
              ) : (
                <span className="text-[11px] text-pink-600 font-semibold">
                  loading image…
                </span>
              )}
            </div>
          ) : null}
        </div>

        {/* Preview: square card-sized rendering with current crop. */}
        <div className="flex flex-row md:flex-col items-center md:items-stretch gap-3 md:gap-2 md:w-44 shrink-0">
          <div className="flex flex-col gap-1 shrink-0">
            <p className="label text-pink-600">card preview</p>
            <div
              className={
                "w-32 md:w-full aspect-square rounded-lg border border-pink-100 bg-pink-50 overflow-hidden relative shadow-soft " +
                coverClipRadiusFor(frame, frameWidth)
              }
              style={{ containerType: "inline-size" }}
            >
              {natural ? (
                <>
                  <div
                    className="absolute inset-0"
                    style={
                      isTrivial(previewCrop)
                        ? {
                            backgroundImage: `url("${imageUrl}")`,
                            backgroundRepeat: "no-repeat",
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            filter: filterCssFor(filter) || undefined,
                          }
                        : {
                            backgroundImage: `url("${imageUrl}")`,
                            backgroundRepeat: "no-repeat",
                            backgroundSize: `${100 / previewCrop.w}% ${
                              100 / previewCrop.h
                            }%`,
                            backgroundPosition: `${
                              previewCrop.w >= 1
                                ? 0
                                : (previewCrop.x * 100) / (1 - previewCrop.w)
                            }% ${
                              previewCrop.h >= 1
                                ? 0
                                : (previewCrop.y * 100) / (1 - previewCrop.h)
                            }%`,
                            filter: filterCssFor(filter) || undefined,
                          }
                    }
                  />
                  {frame ? (
                    <div
                      className={
                        "absolute inset-0 pointer-events-none " +
                        frameOverlayFor(frame, frameWidth)
                      }
                      aria-hidden
                    />
                  ) : null}
                  <OverlayLayer overlays={overlays} />
                </>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-[10px] text-ink/70 font-mono leading-tight">
              {natural
                ? `x ${Math.round(previewCrop.x * 100)}% · y ${Math.round(
                    previewCrop.y * 100
                  )}%`
                : "—"}
            </p>
            <p className="text-[10px] text-ink/70 font-mono leading-tight">
              {natural
                ? `zoom ${(1 / Math.max(previewCrop.w, 0.001)).toFixed(2)}×`
                : ""}
            </p>
          </div>

          {/* Desktop: recent crops fill the blank space below the
              preview tile inside the right column. */}
          {natural && recentCrops.length > 0 ? (
            <RecentCropsGrid
              wrapperClass="hidden md:flex flex-col gap-1.5 pt-1"
              gridClass="grid grid-cols-3 gap-1.5"
              recentCrops={recentCrops}
              imageUrl={imageUrl}
              previewCrop={previewCrop}
              pending={pending}
              onApply={applyRecent}
            />
          ) : null}
        </div>
      </div>

      {/* Mobile: a horizontal-style grid below the main row. Same
          thumbnails as desktop, just placed where the layout has
          room on small screens. */}
      {natural && recentCrops.length > 0 ? (
        <RecentCropsGrid
          wrapperClass="md:hidden flex flex-col gap-1.5"
          gridClass="grid grid-cols-6 gap-1.5"
          recentCrops={recentCrops}
          imageUrl={imageUrl}
          previewCrop={previewCrop}
          pending={pending}
          onApply={applyRecent}
        />
      ) : null}

      {error ? (
        <p className="text-[11px] text-pink-600 font-semibold">{error}</p>
      ) : null}
    </div>
  );
}

function RecentCropsGrid({
  wrapperClass,
  gridClass,
  recentCrops,
  imageUrl,
  previewCrop,
  pending,
  onApply,
}: {
  wrapperClass: string;
  gridClass: string;
  recentCrops: CoverCrop[];
  imageUrl: string;
  previewCrop: CoverCrop;
  pending: boolean;
  onApply: (c: CoverCrop) => void;
}) {
  return (
    <div className={wrapperClass}>
      <p className="label text-pink-600">recent crops</p>
      <div className={gridClass}>
        {recentCrops.map((c, i) => {
          const current =
            Math.abs(c.x - previewCrop.x) < 0.001 &&
            Math.abs(c.y - previewCrop.y) < 0.001 &&
            Math.abs(c.w - previewCrop.w) < 0.001;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onApply(c)}
              disabled={pending}
              title="apply this crop"
              className={
                "relative aspect-square rounded-md overflow-hidden border-2 transition disabled:opacity-60 " +
                (current
                  ? "border-pink-400 ring-2 ring-pink-200"
                  : "border-pink-100 hover:border-pink-300")
              }
            >
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url("${imageUrl}")`,
                  backgroundRepeat: "no-repeat",
                  backgroundSize: `${100 / c.w}% ${100 / c.h}%`,
                  backgroundPosition: `${
                    c.w >= 1 ? 0 : (c.x * 100) / (1 - c.w)
                  }% ${c.h >= 1 ? 0 : (c.y * 100) / (1 - c.h)}%`,
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
