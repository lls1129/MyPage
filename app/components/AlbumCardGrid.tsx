import Link from "next/link";
import type { AlbumWithCover } from "@/lib/supabase/albums";
import { isTrivialCrop } from "@/lib/supabase/albums";
import { filterCssFor, frameOverlayFor } from "./cover-decorations";

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
      {albums.map((a) => (
        <li key={a.id}>
          <Link
            href={`${basePath}/${encodeURIComponent(a.slug)}`}
            className={
              "lift block rounded-lg overflow-hidden bg-white border shadow-soft " +
              (a.hidden ? "border-pink-300" : "border-pink-100")
            }
          >
            <div className="aspect-square bg-pink-50 relative overflow-hidden">
              {a.cover_image_url ? (
                <>
                  {/* Cover image rendered as a background-image so
                      the crop is purely CSS-driven. Filter is
                      applied here so frame overlay sits on top
                      un-filtered. */}
                  <div
                    className={
                      "absolute inset-0 " + (a.hidden ? "opacity-70" : "")
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
                        frameOverlayFor(a.cover_frame)
                      }
                      aria-hidden
                    />
                  ) : null}
                </>
              ) : (
                <div
                  className={
                    "w-full h-full flex items-center justify-center bg-gradient-to-br " +
                    gradientForAlbum(a.id)
                  }
                  aria-hidden
                >
                  <span className="font-script text-pink-400/85 text-[64px] leading-none drop-shadow-sm">
                    {initialForAlbum(a.name)}
                  </span>
                </div>
              )}
              {a.hidden ? (
                <span className="absolute top-1.5 left-1.5 rounded-pill bg-pink-200 text-white px-1.5 py-0.5 text-[10px] font-semibold shadow-soft">
                  hidden
                </span>
              ) : null}
              <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-skynavy-900/80 to-transparent px-3 pt-6 pb-2">
                <p className="font-script text-cream text-lg leading-tight">
                  {a.name}
                </p>
                <p className="text-[10px] text-cream/75 font-semibold">
                  {a.count === 0
                    ? "soon ✦"
                    : `${a.count} photo${a.count === 1 ? "" : "s"}`}
                </p>
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
