"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Album } from "@/lib/supabase/albums";

type ActionResult = { ok: true } | { ok: false; error: string };

export function AlbumManager({
  existing,
  noun,
  placeholder,
  onCreate,
  onRename,
  onDelete,
}: {
  existing: Album[];
  /** "album" | "astrophoto album" — used in copy. */
  noun: string;
  placeholder: string;
  onCreate: (name: string) => Promise<ActionResult>;
  onRename: (id: string, newName: string) => Promise<ActionResult>;
  onDelete: (id: string) => Promise<ActionResult>;
}) {
  const [name, setName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submitCreate() {
    setCreateError(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        const res = await onCreate(trimmed);
        if (!res.ok) setCreateError(res.error);
        else {
          setName("");
          router.refresh();
        }
      } catch (e) {
        setCreateError(
          e instanceof Error ? e.message : "couldn’t reach the server."
        );
      }
    });
  }

  return (
    <section className="rounded-md bg-pink-50 border border-pink-100 p-3 md:p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <p className="label text-pink-600">admin · {noun}s</p>
        <p className="text-[11px] text-lavender-600 font-semibold">
          {existing.length} {noun}
          {existing.length === 1 ? "" : "s"}
        </p>
      </div>

      {/* Create */}
      <div className="flex gap-2 items-stretch flex-wrap">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          className="bg-white border border-pink-200 rounded-pill px-3 py-1.5 text-sm flex-1 min-w-[200px] focus:outline-none focus:border-pink-400"
          onKeyDown={(e) => {
            if (e.key === "Enter") submitCreate();
          }}
        />
        <button
          type="button"
          onClick={submitCreate}
          disabled={pending || !name.trim()}
          className="lift rounded-pill bg-pink-200 text-white border border-pink-200 px-4 py-1.5 text-sm font-semibold disabled:opacity-60 whitespace-nowrap"
        >
          {pending ? "creating…" : `+ new ${noun}`}
        </button>
      </div>
      {createError ? (
        <p className="text-xs text-pink-600 font-semibold">{createError}</p>
      ) : null}

      {/* Existing albums list (rename + delete) */}
      {existing.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {existing.map((a) => (
            <AlbumRow
              key={a.id}
              album={a}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function AlbumRow({
  album,
  onRename,
  onDelete,
}: {
  album: Album;
  onRename: (id: string, newName: string) => Promise<ActionResult>;
  onDelete: (id: string) => Promise<ActionResult>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [draft, setDraft] = useState(album.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    setError(null);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === album.name) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      try {
        const res = await onRename(album.id, trimmed);
        if (!res.ok) setError(res.error);
        else {
          setEditing(false);
          router.refresh();
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
        if (!res.ok) setError(res.error);
        else router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "couldn’t reach the server.");
      }
    });
  }

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2 flex-wrap">
        {editing ? (
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            className="bg-white border border-pink-200 rounded-pill px-3 py-1 text-sm flex-1 min-w-[140px] focus:outline-none focus:border-pink-400"
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") {
                setDraft(album.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <span className="text-sm font-semibold text-pink-800 flex-1 min-w-[140px]">
            {album.name}
          </span>
        )}
        {editing ? (
          <>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-pill bg-pink-200 text-white border border-pink-200 px-2.5 py-0.5 text-[11px] font-semibold disabled:opacity-60"
            >
              save
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(album.name);
                setEditing(false);
              }}
              disabled={pending}
              className="rounded-pill bg-white text-pink-800 border border-pink-200 px-2.5 py-0.5 text-[11px] font-semibold disabled:opacity-60"
            >
              cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={pending}
              title="rename"
              className="rounded-pill bg-white text-pink-800 border border-pink-200 hover:border-pink-400 px-2.5 py-0.5 text-[11px] font-semibold disabled:opacity-60"
            >
              ✎ rename
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={pending}
              title="delete"
              className="rounded-pill bg-white text-pink-800 border border-pink-200 hover:bg-pink-100 hover:border-pink-400 px-2.5 py-0.5 text-[11px] font-semibold disabled:opacity-60"
            >
              ✕ delete
            </button>
          </>
        )}
      </div>
      {confirmingDelete ? (
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
            onClick={() => setConfirmingDelete(false)}
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
    </li>
  );
}
