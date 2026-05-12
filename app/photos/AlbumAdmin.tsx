"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Album } from "@/lib/supabase/albums";
import { createPhotoAlbum } from "./admin-actions";

export function AlbumAdmin({ existing }: { existing: Album[] }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        const res = await createPhotoAlbum(trimmed);
        if (!res.ok) {
          setError(res.error);
        } else {
          setName("");
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "couldn’t reach the server.");
      }
    });
  }

  return (
    <section className="rounded-md bg-pink-50 border border-pink-100 p-3 md:p-4 flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <p className="label text-pink-600">admin · new album</p>
        {existing.length > 0 ? (
          <p className="text-[11px] text-lavender-600 font-semibold">
            {existing.length} album{existing.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2 items-stretch flex-wrap">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., grand canyon trip"
          className="bg-white border border-pink-200 rounded-pill px-3 py-1.5 text-sm flex-1 min-w-[200px] focus:outline-none focus:border-pink-400"
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || !name.trim()}
          className="lift rounded-pill bg-pink-200 text-white border border-pink-200 px-4 py-1.5 text-sm font-semibold disabled:opacity-60 whitespace-nowrap"
        >
          {pending ? "creating…" : "+ create album"}
        </button>
      </div>
      {error ? (
        <p className="text-xs text-pink-600 font-semibold">{error}</p>
      ) : null}
    </section>
  );
}
