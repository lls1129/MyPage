"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Album } from "@/lib/supabase/albums";

type ActionResult = { ok: true } | { ok: false; error: string };

// Compact admin strip shown at the top of /photos/album/[slug] and
// /astronomy/album/[slug]. Two actions for the current album: rename
// and delete. (Upload lives in the PhotoGrid / AstrophotoGrid pill,
// which is context-aware and pre-selects the current album.)
export function AlbumPageAdmin({
  album,
  parentHref,
  onRename,
  onDelete,
}: {
  album: Album;
  /** /photos or /astronomy — where to land after a successful delete. */
  parentHref: string;
  onRename: (id: string, newName: string) => Promise<ActionResult>;
  onDelete: (id: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(album.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function saveRename() {
    setError(null);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === album.name) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      try {
        const res = await onRename(album.id, trimmed);
        if (!res.ok) {
          setError(res.error);
        } else {
          // slug regenerated — navigate to the new URL.
          const newSlug = slugifyForRedirect(trimmed);
          router.replace(`${parentHref}/album/${newSlug}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "couldn’t reach the server.");
      }
    });
  }

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await onDelete(album.id);
        if (!res.ok) {
          setError(res.error);
        } else {
          router.push(parentHref);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "couldn’t reach the server.");
      }
    });
  }

  return (
    <section className="rounded-md bg-pink-50 border border-pink-100 p-3 md:p-4 flex flex-col gap-2 mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="label text-pink-600 shrink-0">admin · this album</p>
        <span className="flex-1" />
        {editing ? null : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={pending || confirming}
              className="rounded-pill bg-white text-pink-800 border border-pink-200 hover:border-pink-400 px-2.5 py-0.5 text-[11px] font-semibold disabled:opacity-60"
            >
              ✎ rename
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={pending || confirming}
              className="rounded-pill bg-white text-pink-800 border border-pink-200 hover:bg-pink-100 hover:border-pink-400 px-2.5 py-0.5 text-[11px] font-semibold disabled:opacity-60"
            >
              ✕ delete album
            </button>
          </>
        )}
      </div>

      {editing ? (
        <div className="flex items-stretch gap-2 flex-wrap">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            className="bg-white border border-pink-200 rounded-pill px-3 py-1 text-sm flex-1 min-w-[180px] focus:outline-none focus:border-pink-400"
            onKeyDown={(e) => {
              if (e.key === "Enter") saveRename();
              if (e.key === "Escape") {
                setDraft(album.name);
                setEditing(false);
              }
            }}
          />
          <button
            type="button"
            onClick={saveRename}
            disabled={pending}
            className="rounded-pill bg-pink-200 text-white border border-pink-200 px-3 py-0.5 text-[11px] font-semibold disabled:opacity-60"
          >
            {pending ? "saving…" : "save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(album.name);
              setEditing(false);
            }}
            disabled={pending}
            className="rounded-pill bg-white text-pink-800 border border-pink-200 px-3 py-0.5 text-[11px] font-semibold disabled:opacity-60"
          >
            cancel
          </button>
        </div>
      ) : null}

      {confirming ? (
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-pink-800 bg-white border border-pink-200 rounded-md px-2.5 py-1.5">
          <span className="font-semibold">
            delete “{album.name}”? photos will become uncategorized.
          </span>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={pending}
            className="rounded-pill bg-pink-200 text-white border border-pink-200 px-2.5 py-0.5 font-semibold disabled:opacity-60"
          >
            {pending ? "deleting…" : "yes, delete"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="rounded-pill bg-white text-pink-800 border border-pink-200 px-2.5 py-0.5 font-semibold disabled:opacity-60"
          >
            cancel
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="text-[11px] text-pink-600 font-semibold">{error}</p>
      ) : null}
    </section>
  );
}

// Local copy of the slug helper so we can predict the new URL after a
// rename and navigate to it. Mirrors lib/supabase/albums slugify().
function slugifyForRedirect(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
