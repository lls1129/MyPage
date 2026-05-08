"use client";

import { useMemo, useState } from "react";
import type { Photo } from "@/lib/supabase/photos";
import { Lightbox } from "./Lightbox";

export function PhotoGrid({ photos }: { photos: Photo[] }) {
  const [tag, setTag] = useState<string>("all");
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    photos.forEach((p) => p.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [photos]);

  const filtered = useMemo(
    () => (tag === "all" ? photos : photos.filter((p) => p.tags.includes(tag))),
    [photos, tag]
  );

  function chooseTag(next: string) {
    setTag(next);
    setOpenIdx(null);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill label="all" count={photos.length} active={tag === "all"} onClick={() => chooseTag("all")} />
        {allTags.map((t) => {
          const count = photos.filter((p) => p.tags.includes(t)).length;
          return (
            <FilterPill
              key={t}
              label={t}
              count={count}
              active={tag === t}
              onClick={() => chooseTag(t)}
            />
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-lavender-600 mt-6 text-center">
          ✿ no photos match this tag yet
        </p>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 mt-2 [column-fill:_balance]">
          {filtered.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setOpenIdx(i)}
              className="group block w-full mb-4 break-inside-avoid relative overflow-hidden rounded-md bg-pink-50 border border-pink-100 shadow-soft lift hover:border-pink-200 text-left"
              aria-label={photo.caption || "open photo"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.image_url}
                alt={photo.caption || ""}
                width={photo.width ?? undefined}
                height={photo.height ?? undefined}
                loading="lazy"
                className="block w-full h-auto"
              />
              {photo.caption ? (
                <span className="absolute inset-x-0 bottom-0 px-3 py-2 bg-gradient-to-t from-skynavy-900/80 via-skynavy-900/40 to-transparent text-cream text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  {photo.caption}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {openIdx !== null ? (
        <Lightbox
          photos={filtered}
          index={openIdx}
          onClose={() => setOpenIdx(null)}
          onChange={setOpenIdx}
        />
      ) : null}
    </>
  );
}

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "lift inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-sm font-semibold border transition-colors " +
        (active
          ? "bg-pink-200 text-white border-pink-200 shadow-soft"
          : "bg-white text-pink-800 border-pink-100 hover:border-pink-200")
      }
    >
      {label}
      <span
        className={
          "text-[11px] font-semibold rounded-full px-1.5 " +
          (active ? "bg-white/20 text-white" : "bg-pink-50 text-pink-600")
        }
      >
        {count}
      </span>
    </button>
  );
}
