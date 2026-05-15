import Link from "next/link";
import type { AlbumWithCover } from "@/lib/supabase/albums";
import { isTrivialCrop } from "@/lib/supabase/albums";
import {
  filterCssFor,
  frameInsetFor,
  frameOverlayFor,
} from "./cover-decorations";
import { normalizeOverlays } from "./cover-overlays";
import { OverlayLayer } from "./OverlayLayer";

// Pastel gradient palette used for empty-album covers. We pick one
// deterministically from the album id so each empty album has a stable
// look — refreshing the page won't swap colors around.
const EMPTY_GRADIENTS = [
  "from-pink-50 to-lavender-100",
  "from-lavender-50 to-pink-100",
  "from-amber-100/60 to-pink-50",
  "from-pink-100 to-amber-100/60",
  "from-lavender-100 to-amber-100/50",
  "from-pink-50 to-amber-100/70",
];

function gradientForAlbum(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return EMPTY_GRADIENTS[Math.abs(h) % EMPTY_GRADIENTS.length];
}

function initialForAlbum(name: string): string {
  const first = name.trim().charAt(0).toUpperCase();
  return first || "✿";
}

// Reusable album-card grid for the library pages. Each card shows the
// album's most recent photo as a cover thumbnail, or — when empty — a
// deterministic pastel gradient with the album's first letter in
// script font. Links into the single-album page.
export function AlbumCardGrid({
  albums,
  basePath,
}: {
  albums: AlbumWithCover[];
  basePath: string;
}) {
  if (albums.length === 0) return null;
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
      {albums.map((a) => {
        // Solid frames (mat, polaroid, rounded mat, etc) already
        // paint their own outer outline + bg, so we hide the card's
        // chrome (rounded-lg + bg-white + pink border) to avoid the
        // four mismatched corners where the card's small radius
        // peeks past the frame's bigger / square radius.
        const isSolidFrame = !!frameInsetFor(
          a.cover_frame,
          a.cover_frame_width
        );
        return (
        <li key={a.id}>
          <Link
            href={`${basePath}/${encodeURIComponent(a.slug)}`}
            className={
              "group lift block overflow-hidden " +
              (isSolidFrame
                ? ""
                : "rounded-lg bg-white border shadow-soft " +
                  (a.hidden ? "border-pink-300" : "border-pink-100"))
            }
          >
            <div
              className={
                "aspect-square relative overflow-hidden " +
                (isSolidFrame ? "" : "bg-pink-50")
              }
              // Establish a container so the overlay layer's
              // `cqw` font sizes scale against the card width.
              style={{ containerType: "inline-size" }}
            >
              {a.cover_image_url ? (
                <>
                  {/* Cover image rendered as a background-image so
                      the crop is purely CSS-driven. Filter is
                      applied here so frame overlay sits on top
                      un-filtered. For solid frames (mat, polaroid,
                      etc) the photo is inset so it sits inside the
                      frame rather than bleeding past the corners. */}
                  <div
                    className={
                      "absolute overflow-hidden " +
                      (frameInsetFor(a.cover_frame, a.cover_frame_width) ||
                        "inset-0") +
                      " " +
                      (a.hidden ? "opacity-70" : "")
                    }
                    style={
                      isTrivialCrop(a)
                        ? {
                            backgroundImage: `url("${a.cover_image_url}")`,
                            backgroundRepeat: "no-repeat",
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            filter: filterCssFor(a.cover_filter) || undefined,
                          }
                        : {
                            backgroundImage: `url("${a.cover_image_url}")`,
                            backgroundRepeat: "no-repeat",
                            backgroundSize: `${100 / a.cover_crop_w}% ${
                              100 / a.cover_crop_h
                            }%`,
                            backgroundPosition: `${
                              a.cover_crop_w >= 1
                                ? 0
                                : (a.cover_crop_x * 100) / (1 - a.cover_crop_w)
                            }% ${
                              a.cover_crop_h >= 1
                                ? 0
                                : (a.cover_crop_y * 100) / (1 - a.cover_crop_h)
                            }%`,
                            filter: filterCssFor(a.cover_filter) || undefined,
                          }
                    }
                    role="img"
                    aria-label={a.name}
                  />
                  {/* Frame overlay — purely decorative, doesn't
                      shift the cover layout or intercept clicks. */}
                  {a.cover_frame ? (
                    <div
                      className={
                        "absolute inset-0 pointer-events-none " +
                        frameOverlayFor(a.cover_frame, a.cover_frame_width)
                      }
                      aria-hidden
                    />
                  ) : null}
                </>
              ) : (
                <div
                  className={
                    "absolute overflow-hidden flex items-center justify-center bg-gradient-to-br " +
                    (frameInsetFor(a.cover_frame, a.cover_frame_width) ||
                      "inset-0") +
                    " " +
                    gradientForAlbum(a.id)
                  }
                  aria-hidden
                >
                  <span className="font-script text-pink-400/85 text-[64px] leading-none drop-shadow-sm">
                    {initialForAlbum(a.name)}
                  </span>
                </div>
              )}
              {/* Stickers / captions / highlights sit above any
                  cover (or above the empty-album gradient) so the
                  overlay layer always renders consistently. The
                  layer inherits the same inset as the photo so
                  overlays shift with the photo when admin switches
                  to a solid frame. */}
              <OverlayLayer
                overlays={normalizeOverlays(a.cover_overlays)}
                className={a.hidden ? "opacity-70" : ""}
                insetClass={frameInsetFor(
                  a.cover_frame,
                  a.cover_frame_width
                )}
              />
              {a.hidden ? (
                <span className="absolute top-1.5 left-1.5 rounded-pill bg-pink-200 text-white px-1.5 py-0.5 text-[10px] font-semibold shadow-soft">
                  hidden
                </span>
              ) : null}
              {/* "Corner" + "hover" placements render the title
                  ON the cover. They stay inside the aspect-square
                  div so they sit in the cover's coordinate space
                  rather than below it. */}
              {a.title_placement === "corner" ? (
                <CornerTitle name={a.name} count={a.count} />
              ) : null}
              {a.title_placement === "hover" ? (
                <HoverTitle name={a.name} count={a.count} />
              ) : null}
            </div>
            {/* Below-cover placements render the title below the
                aspect-square cover. Each variant carries its own
                bg + spacing so they feel distinct. */}
            {a.title_placement === "caption-bar" ? (
              <CaptionBarTitle name={a.name} count={a.count} />
            ) : a.title_placement === "stacked" ? (
              <StackedTitle name={a.name} count={a.count} />
            ) : a.title_placement === "corner" ||
              a.title_placement === "hover" ? null : (
              <BelowTitle name={a.name} count={a.count} />
            )}
          </Link>
        </li>
        );
      })}
    </ul>
  );
}

function countLabel(count: number): string {
  return count === 0
    ? "soon ✦"
    : `${count} photo${count === 1 ? "" : "s"}`;
}

function BelowTitle({ name, count }: { name: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-3 py-2">
      <p className="font-script text-skynavy-900 text-lg leading-tight truncate pr-1">
        {name}
      </p>
      <p className="text-[10px] text-ink/60 font-semibold shrink-0">
        {countLabel(count)}
      </p>
    </div>
  );
}

// Polaroid-style strip: tinted bg + a bit more padding so the
// caption reads as part of the same card rather than a separate
// label.
function CaptionBarTitle({
  name,
  count,
}: {
  name: string;
  count: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 bg-cream/70 px-3 py-2.5">
      <p className="font-script text-skynavy-900 text-lg leading-tight truncate pr-1">
        {name}
      </p>
      <p className="text-[10px] text-pink-700 font-semibold shrink-0">
        {countLabel(count)}
      </p>
    </div>
  );
}

// Two rows — name on top in slightly larger script, count under it
// like a museum label. Best for short names + a clean cover.
function StackedTitle({ name, count }: { name: string; count: number }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2.5">
      <p className="font-script text-skynavy-900 text-xl leading-tight truncate">
        {name}
      </p>
      <p className="text-[10px] text-ink/55 font-semibold tracking-wide">
        {countLabel(count)}
      </p>
    </div>
  );
}

// Tucked into the bottom-left corner of the cover — a small soft
// chip with a backdrop blur so it reads cleanly over busy photos
// without needing a full gradient.
function CornerTitle({ name, count }: { name: string; count: number }) {
  return (
    <span className="absolute left-2 bottom-2 right-2 flex items-baseline gap-2 rounded-md bg-cream/85 backdrop-blur-sm px-2 py-1 shadow-soft">
      <span className="font-script text-skynavy-900 text-base leading-none truncate flex-1">
        {name}
      </span>
      <span className="text-[10px] text-ink/60 font-semibold shrink-0">
        {countLabel(count)}
      </span>
    </span>
  );
}

// Hover-only gradient overlay — cover stays untouched at rest;
// hovering (or focusing on keyboard) surfaces the title.
function HoverTitle({ name, count }: { name: string; count: number }) {
  return (
    <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-skynavy-900/85 to-transparent px-3 pt-6 pb-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
      <p className="font-script text-cream text-lg leading-tight truncate">
        {name}
      </p>
      <p className="text-[10px] text-cream/75 font-semibold">
        {countLabel(count)}
      </p>
    </span>
  );
}
