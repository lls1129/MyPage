import Link from "next/link";
import type { AlbumWithCover } from "@/lib/supabase/albums";

// Reusable album-card grid for the library pages. Each card shows the
// album's most recent photo as a cover thumbnail and links into the
// single-album page. The basePath is the route prefix
// ("/photos/album" or "/astronomy/album").
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
                <div className="w-full h-full flex items-center justify-center text-pink-200 text-4xl">
                  ✿
                </div>
              )}
              <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-skynavy-900/80 to-transparent px-3 pt-6 pb-2">
                <p className="font-script text-cream text-lg leading-tight">
                  {a.name}
                </p>
                <p className="text-[10px] text-cream/75 font-semibold">
                  {a.count} photo{a.count === 1 ? "" : "s"}
                </p>
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
