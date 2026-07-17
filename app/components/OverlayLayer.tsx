// Renders the cover overlay layer (stickers, captions, highlights)
// on top of a parent that's `relative overflow-hidden`. Each
// overlay is absolute-positioned by its normalized center point
// (x, y in 0..1) and scaled relative to the parent's width so
// stickers, text, and shapes all stay proportional whether the
// cover is 80px in a list or 600px in the cropper preview.

import {
  DIAMOND_PATH,
  HEART_PATH,
  OVERLAY_SHAPE_CLASSES,
  OVERLAY_SHAPE_SVG,
  OVERLAY_TEXT_CLASSES,
  STAR_PATH,
  strokeBoundingBox,
  strokePointsToPath,
  type CoverOverlay,
  type HighlightOverlay,
  type StrokeOverlay,
} from "./cover-overlays";

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

// Freehand stroke render. Points are normalized 0..1 against the
// parent. We paint into a fixed `0 0 100 100` viewBox sized to the
// parent via definite CSS percentages (width/height: 100%) and
// preserveAspectRatio="none" — exactly how the highlight shapes
// above render. The browser stretches the 100-unit viewBox to fill
// the parent's actual box in layout space, so no JS pixel
// measurement is involved. That matters: getBoundingClientRect()
// returns *visually-transformed* pixels, so the previous
// measured-pixel `width={px}` approach drifted by a constant scale
// factor (error growing with distance from the origin) whenever an
// ancestor applied any transform/zoom — while the pointer-capture
// math, being scale-invariant, stayed correct. Letting CSS do the
// mapping keeps capture and render in the same coordinate space.
function StrokeRender({ o }: { o: StrokeOverlay }) {
  const bbox = strokeBoundingBox(o.segments, o.scale);
  return (
    <svg
      className="absolute pointer-events-none"
      style={{ left: 0, top: 0, width: "100%", height: "100%" }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <g
        transform={`translate(${bbox.cx * 100} ${
          bbox.cy * 100
        }) rotate(${o.rotation}) scale(${o.scale}) translate(${
          -bbox.cx * 100
        } ${-bbox.cy * 100})`}
      >
        {o.segments.map((seg, i) => {
          const svg = OVERLAY_SHAPE_SVG[seg.color];
          return (
            <path
              key={i}
              d={strokePointsToPath(seg.points)}
              fill="none"
              stroke={svg.stroke}
              strokeOpacity={0.92}
              strokeWidth={Math.max(seg.width * 100, 0.5)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </g>
    </svg>
  );
}
