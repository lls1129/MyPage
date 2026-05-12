"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Astrophoto } from "@/lib/supabase/astrophotos";
import type { Album } from "@/lib/supabase/albums";
import {
  rotateAstrophoto,
  toggleAstrophotoHidden,
  deleteAstrophoto,
  convertAstrophotoToPhoto,
} from "../../admin-actions";
import { AstrophotoEditModal } from "../../components/AstrophotoEditModal";

export function AdminBar({
  photo,
  albums,
}: {
  photo: Astrophoto;
  albums: Album[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    start(async () => {
      setError(null);
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "Action failed.");
        return;
      }
      router.refresh();
    });
  }

  function onDelete() {
    if (!confirm(`Delete "${photo.object_name || "untitled"}"?`)) return;
    start(async () => {
      const result = await deleteAstrophoto(photo.id);
      if (!result.ok) {
        setError(result.error ?? "Delete failed.");
        return;
      }
      router.push("/astronomy");
    });
  }

  function onConvertToPhoto() {
    if (
      !confirm(
        `Move "${photo.object_name || "untitled"}" into the personal photos album? Equipment metadata will be dropped.`
      )
    )
      return;
    start(async () => {
      setError(null);
      const result = await convertAstrophotoToPhoto(photo.id);
      if (!result.ok) {
        setError(result.error ?? "Convert failed.");
        return;
      }
      router.push("/photos");
    });
  }

  return (
    <>
      <div className="rounded-lg bg-white border border-pink-100 shadow-soft p-4 flex flex-wrap items-center gap-2">
        <span className="label text-lavender-600 mr-2">admin ✦</span>
        <Btn onClick={() => run(() => rotateAstrophoto(photo.id, "left"))} disabled={pending}>
          ↶ rotate
        </Btn>
        <Btn onClick={() => run(() => rotateAstrophoto(photo.id, "right"))} disabled={pending}>
          ↷ rotate
        </Btn>
        <Btn onClick={() => setEditing(true)} disabled={pending}>
          ✎ edit
        </Btn>
        <Btn
          onClick={() => run(() => toggleAstrophotoHidden(photo.id, !photo.hidden))}
          disabled={pending}
        >
          {photo.hidden ? "○ show" : "◐ hide"}
        </Btn>
        <Btn onClick={onConvertToPhoto} disabled={pending}>
          ✿ to photos
        </Btn>
        <Btn onClick={onDelete} disabled={pending} danger>
          ✕ delete
        </Btn>
        {error ? (
          <span className="text-xs text-pink-600 font-semibold ml-2">{error}</span>
        ) : null}
      </div>

      {editing ? (
        <AstrophotoEditModal
          photo={photo}
          albums={albums}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "lift inline-flex items-center rounded-pill px-3 py-1.5 text-xs font-semibold border transition-colors disabled:opacity-50 disabled:cursor-wait " +
        (danger
          ? "bg-white text-pink-800 border-pink-200 hover:border-pink-400"
          : "bg-pink-50 text-pink-800 border-pink-100 hover:border-pink-200")
      }
    >
      {children}
    </button>
  );
}
