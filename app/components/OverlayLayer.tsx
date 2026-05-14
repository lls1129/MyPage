// Renders the cover overlay layer (stickers, captions, highlights)
// on top of a parent that's `relative overflow-hidden`. Each
// overlay is absolute-positioned by its normalized center point
// (x, y in 0..1) and scaled relative to the parent's width so
// stickers, text, and shapes all stay proportional whether the
// cover is 80px in a list or 600px in the cropper preview.

import {
  HEART_PATH,
  OVERLAY_SHAPE_CLASSES,
  OVERLAY_SHAPE_SVG,
  OVERLAY_TEXT_CLASSES,
  type CoverOverlay,
  type HighlightOverlay,
} from "./cover-overlays";

export function OverlayLayer({
  overlays,
  className,
}: {
  overlays: CoverOverlay[];
  /** Optional extra classes on the wrapper (e.g. for opacity when
   *  the parent is in a "hidden" state). */
  className?: string;
}) {
  if (overlays.length === 0) return null;
  return (
    <div
      className={
        "absolute inset-0 pointer-events-none " + (className ?? "")
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
  if (o.shape === "heart") {
    const svg = OVERLAY_SHAPE_SVG[o.color];
    return (
      <svg
        className="absolute pointer-events-none"
        style={style}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d={HEART_PATH}
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
