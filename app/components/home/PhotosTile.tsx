import Link from "next/link";
import { listPhotos } from "@/lib/supabase/photos";

const SWATCHES = [
  "bg-pink-100",
  "bg-lavender-100",
  "bg-amber-100",
  "bg-pink-200",
];

export async function PhotosTile() {
  const result = await listPhotos();
  const photos = result.kind === "ok" ? result.photos.slice(0, 4) : [];
  const total = result.kind === "ok" ? result.photos.length : 0;

  return (
    <Link
      href="/photos"
      className="lift col-span-1 row-span-1 md:row-span-2 rounded-lg bg-white border border-pink-100 shadow-soft p-6 flex flex-col gap-4 hover:border-pink-200"
    >
      <div className="flex items-baseline justify-between">
        <span className="label text-pink-600">photos</span>
        <span className="text-xs text-lavender-600 font-semibold">
          {total > 0 ? total : "—"}
        </span>
      </div>
      <div className="font-script text-pink-800 text-[28px] leading-none">
        little moments ❤
      </div>
      <div className="grid grid-cols-2 gap-2 mt-auto">
        {Array.from({ length: 4 }).map((_, i) => {
          const photo = photos[i];
          if (photo) {
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photo.id}
                src={photo.image_url}
                alt={photo.caption || ""}
                loading="lazy"
                style={
                  photo.rotation
                    ? { transform: `rotate(${photo.rotation}deg)` }
                    : undefined
                }
                className="aspect-square w-full object-cover rounded-sm border border-white/60"
              />
            );
          }
          return (
            <div
              key={`swatch-${i}`}
              className={`${SWATCHES[i % SWATCHES.length]} aspect-square rounded-sm border border-white/60`}
            />
          );
        })}
      </div>
      <div className="text-xs text-pink-600 font-semibold">browse the album →</div>
    </Link>
  );
}
