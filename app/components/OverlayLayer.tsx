// Renders the cover overlay layer (stickers, captions, highlights)
// on top of a parent that's `relative overflow-hidden`. Each
// overlay is absolute-positioned by its normalized center point
// (x, y in 0..1) and scaled relative to the parent's width so
// stickers, text, and shapes all stay proportional whether the
// cover is 80px in a list or 600px in the cropper preview.

"use client";

import { useEffect, useRef, useState } from "react";
import {
  DIAMOND_PATH,
  HEART_PATH,
  OVERLAY_SHAPE_CLASSES,
  OVERLAY_SHAPE_SVG,
  OVERLAY_TEXT_CLASSES,
  STAR_PATH,
  strokeBoundingBox,
  type CoverOverlay,
  type HighlightOverlay,
  type StrokeOverlay,
} from "./cover-overlays";

// Measure an element's box (via ResizeObserver). Only the RATIO of
// the returned w:h is used by callers, and a ratio is invariant to
// any uniform ancestor transform/zoom — so this is safe where
// absolute getBoundingClientRect pixels would drift.
function useMeasuredBox<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setBox({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, box] as const;
}

// Freehand-stroke glyph — just the painted SVG (no pointer events).
// Shared by the viewer (StrokeRender) and the editor's draggable
// wrapper. Uses an ASPECT-CORRECT viewBox: the SVG fills its parent
// (width/height 100%), and its viewBox is set to the measured box's
// w×h so viewBox aspect == box aspect. With preserveAspectRatio
// "none" that makes the coordinate scale UNIFORM (x-scale == y-scale)
// — so stroke thickness is the same in every direction and rotation
// is a true rotation (no shear). Positions still map correctly (the
// W/H cancel), and because only the box's *ratio* is used, an
// ancestor transform can't make it drift.
export function StrokeGlyph({ o }: { o: StrokeOverlay }) {
  const [ref, box] = useMeasuredBox<SVGSVGElement>();
  const W = box.w > 0 ? box.w : 100;
  const H = box.h > 0 ? box.h : 100;
  const bbox = strokeBoundingBox(o.segments, o.scale);
  // Thickness relative to the box's smaller side (aspect-neutral).
  const unit = Math.min(W, H);
  const buildPath = (points: [number, number][]) => {
    if (points.length === 0) return "";
    if (points.length === 1) {
      const [x, y] = points[0];
      return `M ${x * W} ${y * H} L ${x * W + 0.01} ${y * H + 0.01}`;
    }
    let d = `M ${points[0][0] * W} ${points[0][1] * H}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i][0] * W} ${points[i][1] * H}`;
    }
    return d;
  };
  return (
    <svg
      ref={ref}
      className="absolute pointer-events-none"
      style={{ left: 0, top: 0, width: "100%", height: "100%" }}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <g
        transform={`translate(${bbox.cx * W} ${
          bbox.cy * H
        }) rotate(${o.rotation}) scale(${o.scale}) translate(${
          -bbox.cx * W
        } ${-bbox.cy * H})`}
      >
        {o.segments.map((seg, i) => {
          const svg = OVERLAY_SHAPE_SVG[seg.color];
          return (
            <path
              key={i}
              d={buildPath(seg.points)}
              fill="none"
              stroke={svg.stroke}
              strokeOpacity={0.92}
              strokeWidth={Math.max(seg.width * unit, 1)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </g>
    </svg>
  );
}

export type OverlayCrop = { x: number; y: number; w: number; h: number };

/** True when a crop is the whole image (or effectively so). */
function isTrivialCrop(c: OverlayCrop): boolean {
  return (c.x ?? 0) <= 0 && (c.y ?? 0) <= 0 && (c.w ?? 1) >= 1 && (c.h ?? 1) >= 1;
}

// Overlay layer for a CROPPED photo. Overlays are stored in
// FULL-image fractions (0..1 of the whole source image) — the crop
// is just a window onto the image, so overlays stay glued to image
// content and clip when they fall outside the crop. This renders
// the same OverlayLayer inside a box positioned + scaled exactly
// like the cropped <img> (full image extends past the crop viewport;
// overflow-hidden clips it), so a full-image fraction lands on the
// same pixel the image shows. For a trivial crop it degrades to a
// plain OverlayLayer, so uncropped photos are byte-for-byte
// unchanged.
export function OverlayLayerCropped({
  overlays,
  crop,
  className,
  insetClass,
}: {
  overlays: CoverOverlay[];
  crop: OverlayCrop;
  className?: string;
  insetClass?: string;
}) {
  if (overlays.length === 0) return null;
  if (isTrivialCrop(crop)) {
    return (
      <OverlayLayer
        overlays={overlays}
        className={className}
        insetClass={insetClass}
      />
    );
  }
  const w = crop.w > 0 ? crop.w : 1;
  const h = crop.h > 0 ? crop.h : 1;
  return (
    <div
      className={
        "absolute overflow-hidden pointer-events-none " +
        (insetClass || "inset-0") +
        " " +
        (className ?? "")
      }
      aria-hidden
    >
      {/* Full-image box: same placement math as the cropped <img>
          (width 1/crop_w of the viewport, offset by the crop origin).
          OverlayLayer fills it, so its 0..1 fractions map to the
          whole image; the parent's overflow-hidden trims whatever
          spills outside the crop window. */}
      <div
        style={{
          position: "absolute",
          left: `${(-crop.x / w) * 100}%`,
          top: `${(-crop.y / h) * 100}%`,
          width: `${(1 / w) * 100}%`,
          height: `${(1 / h) * 100}%`,
        }}
      >
        <OverlayLayer overlays={overlays} />
      </div>
    </div>
  );
}

export function OverlayLayer({
  overlays,
  className,
  insetClass,
}: {
  overlays: CoverOverlay[];
  /** Optional extra classes on the wrapper (e.g. for opacity when
   *  the parent is in a "hidden" state). */
  className?: string;
  /** Positioning classes for the wrapper. When a solid frame is
   *  active the wrapper inherits the same inset as the photo so
   *  overlays stay anchored to the photo's inner area rather than
   *  the full cover bounds — switching frames shifts the photo
   *  and the overlays together. Defaults to `inset-0`. */
  insetClass?: string;
}) {
  if (overlays.length === 0) return null;
  return (
    <div
      className={
        "absolute pointer-events-none " +
        (insetClass || "inset-0") +
        " " +
        (className ?? "")
      }
      aria-hidden
    >
      {overlays.map((o) => (
        <OverlayItem key={o.id} overlay={o} />
      ))}
    </div>
  );
}

function OverlayItem({ overlay: o }: { overlay: CoverOverlay }) {
  // Use cqw (container query units) so overlays scale with the
  // container's width — fallback to vw-like behavior on older
  // browsers via the cropper / card both relying on natural
  // re-render. cqw resolves against the nearest container with
  // container-type, so we set that on the wrapping div below.
  const baseStyle: React.CSSProperties = {
    left: `${o.x * 100}%`,
    top: `${o.y * 100}%`,
    transform: `translate(-50%, -50%) rotate(${o.rotation}deg) scale(${o.scale})`,
  };

  if (o.type === "sticker") {
    return (
      <span
        className="absolute select-none leading-none"
        style={{
          ...baseStyle,
          // Stickers sized as a fraction of the container width.
          fontSize: "16cqw",
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))",
        }}
      >
        {o.emoji}
      </span>
    );
  }
  if (o.type === "caption") {
    return (
      <span
        className={
          "absolute font-script select-none leading-none whitespace-nowrap " +
          OVERLAY_TEXT_CLASSES[o.color]
        }
        style={{
          ...baseStyle,
          fontSize: "12cqw",
        }}
      >
        {o.text}
      </span>
    );
  }
  if (o.type === "highlight") return <HighlightRender o={o} />;
  if (o.type === "stroke") return <StrokeRender o={o} />;
  return null;
}

function HighlightRender({ o }: { o: HighlightOverlay }) {
  const style: React.CSSProperties = {
    left: `${o.x * 100}%`,
    top: `${o.y * 100}%`,
    width: `${Math.max(o.width, 0.05) * 100}%`,
    height: `${Math.max(o.height, 0.05) * 100}%`,
    transform: `translate(-50%, -50%) rotate(${o.rotation}deg) scale(${o.scale})`,
  };
  // SVG-rendered shapes share fill+stroke styling for visual
  // consistency with the heart preset.
  if (o.shape === "heart" || o.shape === "star" || o.shape === "diamond") {
    const svg = OVERLAY_SHAPE_SVG[o.color];
    const path =
      o.shape === "heart"
        ? HEART_PATH
        : o.shape === "star"
        ? STAR_PATH
        : DIAMOND_PATH;
    return (
      <svg
        className="absolute pointer-events-none"
        style={style}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d={path}
          fill={svg.fill}
          fillOpacity={0.55}
          stroke={svg.stroke}
          strokeOpacity={0.85}
          strokeWidth={2}
        />
      </svg>
    );
  }
  return (
    <span
      className={
        "absolute " +
        OVERLAY_SHAPE_CLASSES[o.color] +
        (o.shape === "circle" ? " rounded-full" : " rounded-md")
      }
      style={style}
    />
  );
}

// Freehand stroke render — the viewer just paints the glyph.
function StrokeRender({ o }: { o: StrokeOverlay }) {
  return <StrokeGlyph o={o} />;
}
