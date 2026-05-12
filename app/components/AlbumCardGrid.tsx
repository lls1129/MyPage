import Link from "next/link";
import type { AlbumWithCover } from "@/lib/supabase/albums";

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
            className="lift block rounded-lg overflow-hidden bg-white border border-pink-100 shadow-soft"
          >
            <div className="aspect-square bg-pink-50 relative">
              {a.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.cover_image_url}
                  alt={a.name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
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
