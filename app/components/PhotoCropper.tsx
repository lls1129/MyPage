"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Free-form per-photo crop modal. Unlike CoverCropper (which locks
// to a square because album cards are aspect-square), this one
// lets admin pick any rectangle to trim the source down to.
//
// Result is in source-relative units (0..1) — the renderer scales
// the visible photo so the cropped region fills the wrapper, same
// math as the album cover crop just without the aspect lock.

type Crop = { x: number; y: number; w: number; h: number };

type ActionResult = { ok: true } | { ok: false; error: string };

// Box in source-pixel units while admin is dragging. Normalized
// only on commit so dragging stays drift-free.
type Box = { x: number; y: number; w: number; h: number };

type Handle =
  | "move"
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function PhotoCropper({
  imageUrl,
  initialCrop,
  onCommit,
  onClose,
}: {
  imageUrl: string;
  initialCrop: Crop;
  onCommit: (crop: Crop) => Promise<ActionResult>;
  onClose: () => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(
    null
  );
  const [displayScale, setDisplayScale] = useState(1);
  const [box, setBox] = useState<Box | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<{
    handle: Handle;
    startPointerX: number;
    startPointerY: number;
    startBox: Box;
  } | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  function onImgLoad() {
    const el = imgRef.current;
    const stage = stageRef.current;
    if (!el || !stage) return;
    const nw = el.naturalWidth;
    const nh = el.naturalHeight;
    if (nw === 0 || nh === 0) return;
    setNatural({ w: nw, h: nh });
    const rect = stage.getBoundingClientRect();
    const scale = Math.min(rect.width / nw, rect.height / nh);
    setDisplayScale(scale);
    // Seed the box from the saved crop (in source pixels).
    setBox({
      x: initialCrop.x * nw,
      y: initialCrop.y * nh,
      w: initialCrop.w * nw,
      h: initialCrop.h * nh,
    });
  }

  function startDrag(e: React.PointerEvent, handle: Handle) {
    if (!box) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      handle,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startBox: { ...box },
    };
  }

  function moveDrag(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || !natural) return;
    // Translate pointer delta from screen to source pixels.
    const dxSrc = (e.clientX - d.startPointerX) / displayScale;
    const dySrc = (e.clientY - d.startPointerY) / displayScale;
    const start = d.startBox;
    const min = 8; // min crop side in source pixels, prevents degenerate boxes
    let nx = start.x;
    let ny = start.y;
    let nw = start.w;
    let nh = start.h;
    if (d.handle === "move") {
      nx = clamp(start.x + dxSrc, 0, natural.w - start.w);
      ny = clamp(start.y + dySrc, 0, natural.h - start.h);
    } else {
      // Corner / edge resize — each handle moves a specific edge.
      const touchesLeft =
        d.handle === "nw" || d.handle === "w" || d.handle === "sw";
      const touchesRight =
        d.handle === "ne" || d.handle === "e" || d.handle === "se";
      const touchesTop =
        d.handle === "nw" || d.handle === "n" || d.handle === "ne";
      const touchesBottom =
        d.handle === "sw" || d.handle === "s" || d.handle === "se";
      let left = start.x;
      let right = start.x + start.w;
      let top = start.y;
      let bottom = start.y + start.h;
      if (touchesLeft)
        left = clamp(start.x + dxSrc, 0, start.x + start.w - min);
      if (touchesRight)
        right = clamp(start.x + start.w + dxSrc, start.x + min, natural.w);
      if (touchesTop)
        top = clamp(start.y + dySrc, 0, start.y + start.h - min);
      if (touchesBottom)
        bottom = clamp(start.y + start.h + dySrc, start.y + min, natural.h);
      nx = left;
      ny = top;
      nw = right - left;
      nh = bottom - top;
    }
    setBox({ x: nx, y: ny, w: nw, h: nh });
  }

  function endDrag(e: React.PointerEvent) {
    if (!dragRef.current) return;
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    dragRef.current = null;
  }

  function reset() {
    if (!natural) return;
    setBox({ x: 0, y: 0, w: natural.w, h: natural.h });
  }

  async function save() {
    if (!box || !natural) return;
    setError(null);
    setPending(true);
    const crop = {
      x: box.x / natural.w,
      y: box.y / natural.h,
      w: box.w / natural.w,
      h: box.h / natural.h,
    };
    try {
      const res = await onCommit(crop);
      if (!res.ok) {
        setError(res.error);
        setPending(false);
        return;
      }
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "couldn’t reach the server."
      );
      setPending(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] bg-skynavy-900/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[900px] flex flex-col gap-4 rounded-lg bg-white border border-pink-100 shadow-soft p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-script text-pink-600 text-2xl leading-tight">
            crop photo ✂
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="text-pink-600 text-sm font-semibold hover:text-pink-800"
          >
            ✕
          </button>
        </div>

        {/* Stage — fits image inside a fixed-height area; the box +
            handles live as overlays positioned in screen pixels.
            Display scale converts to source pixels for the math. */}
        <div
          ref={stageRef}
          className="relative w-full bg-pink-50 rounded-md border border-pink-100 overflow-hidden flex items-center justify-center"
          style={{ minHeight: 240, maxHeight: "calc(100vh - 280px)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt="source"
            onLoad={onImgLoad}
            onError={() => setLoadError(true)}
            className="block max-w-full max-h-[calc(100vh-280px)] object-contain select-none"
            draggable={false}
            style={{ touchAction: "none" }}
          />
          {natural && box ? (
            <div
              className="absolute"
              style={{
                left: `calc(50% + ${
                  (box.x - natural.w / 2) * displayScale
                }px)`,
                top: `calc(50% + ${
                  (box.y - natural.h / 2) * displayScale
                }px)`,
                width: box.w * displayScale,
                height: box.h * displayScale,
              }}
            >
              {/* Outer dim — paint a dark scrim outside the crop
                  rectangle so the chosen region stands out. */}
              <div className="absolute inset-0 border-2 border-cream shadow-[0_0_0_9999px_rgba(64,40,82,0.55)] pointer-events-none" />
              {/* Body drag */}
              <div
                onPointerDown={(e) => startDrag(e, "move")}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className="absolute inset-0 cursor-move touch-none"
              />
              {/* Corner + edge handles — small dots admin can grab.
                  Edge handles use longer hit area for easier touch. */}
              <CornerHandle pos="nw" onPointerDown={(e) => startDrag(e, "nw")} onPointerMove={moveDrag} onPointerUp={endDrag} />
              <CornerHandle pos="ne" onPointerDown={(e) => startDrag(e, "ne")} onPointerMove={moveDrag} onPointerUp={endDrag} />
              <CornerHandle pos="sw" onPointerDown={(e) => startDrag(e, "sw")} onPointerMove={moveDrag} onPointerUp={endDrag} />
              <CornerHandle pos="se" onPointerDown={(e) => startDrag(e, "se")} onPointerMove={moveDrag} onPointerUp={endDrag} />
              <EdgeHandle pos="n" onPointerDown={(e) => startDrag(e, "n")} onPointerMove={moveDrag} onPointerUp={endDrag} />
              <EdgeHandle pos="s" onPointerDown={(e) => startDrag(e, "s")} onPointerMove={moveDrag} onPointerUp={endDrag} />
              <EdgeHandle pos="e" onPointerDown={(e) => startDrag(e, "e")} onPointerMove={moveDrag} onPointerUp={endDrag} />
              <EdgeHandle pos="w" onPointerDown={(e) => startDrag(e, "w")} onPointerMove={moveDrag} onPointerUp={endDrag} />
            </div>
          ) : null}
          {!natural && !loadError ? (
            <p className="absolute text-[11px] text-pink-600 font-semibold">
              loading image…
            </p>
          ) : null}
          {loadError ? (
            <p className="absolute text-[11px] text-pink-700 font-semibold leading-snug px-4 text-center">
              couldn’t load this image for cropping.
            </p>
          ) : null}
        </div>

        {error ? (
          <p className="text-xs text-pink-600 font-semibold">{error}</p>
        ) : null}

        <div className="flex items-center justify-end gap-2 flex-wrap">
          <button
            type="button"
            onClick={reset}
            disabled={!natural || pending}
            className="lift rounded-pill bg-white text-pink-800 border border-pink-100 hover:border-pink-200 px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="lift rounded-pill bg-white text-pink-800 border border-pink-100 hover:border-pink-200 px-4 py-2 text-sm font-semibold"
          >
            cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!natural || pending}
            className="lift rounded-pill bg-pink-200 text-white border border-pink-200 shadow-soft hover:border-pink-400 px-4 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-wait"
          >
            {pending ? "saving…" : "save crop"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function CornerHandle({
  pos,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  pos: "nw" | "ne" | "sw" | "se";
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}) {
  // Outer span: 40×40 invisible hit target centered on the corner —
  // gives fingers a reasonable touch area. Inner span paints the
  // 16×16 visible dot.
  const placement: Record<typeof pos, string> = {
    nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
    ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
    sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
    se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
  };
  return (
    <span
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={
        "absolute w-10 h-10 flex items-center justify-center touch-none " +
        placement[pos]
      }
    >
      <span
        aria-hidden
        className="w-4 h-4 rounded-full bg-cream border-2 border-pink-400 shadow-soft"
      />
    </span>
  );
}

function EdgeHandle({
  pos,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  pos: "n" | "s" | "e" | "w";
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}) {
  // Outer span carries a fat hit area in the resize direction (40px
  // across the edge, 28px out from it) while the visible bar stays
  // the original 32×12 / 12×32 pill.
  const placement: Record<typeof pos, string> = {
    n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 w-12 h-9 cursor-ns-resize",
    s: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 w-12 h-9 cursor-ns-resize",
    e: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 h-12 w-9 cursor-ew-resize",
    w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-9 cursor-ew-resize",
  };
  const visual: Record<typeof pos, string> = {
    n: "w-8 h-3",
    s: "w-8 h-3",
    e: "h-8 w-3",
    w: "h-8 w-3",
  };
  return (
    <span
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={
        "absolute flex items-center justify-center touch-none " + placement[pos]
      }
    >
      <span
        aria-hidden
        className={
          "rounded-full bg-cream border-2 border-pink-400 shadow-soft " +
          visual[pos]
        }
      />
    </span>
  );
}
