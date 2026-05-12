"use client";

import { useEffect, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { Astrophoto } from "@/lib/supabase/astrophotos";
import type { Album } from "@/lib/supabase/albums";
import { updateAstrophotoMeta } from "../admin-actions";

const FIELDS: { name: keyof Astrophoto; label: string; placeholder: string }[] = [
  { name: "telescope", label: "telescope", placeholder: "askar 71f" },
  { name: "mount", label: "mount", placeholder: "zwo am3" },
  { name: "camera", label: "camera", placeholder: "zwo asi533mc pro" },
  { name: "exposure_stack", label: "exposure", placeholder: "120 × 180s rgb" },
  { name: "processing", label: "processing", placeholder: "pixinsight, graxpert" },
  { name: "location", label: "location", placeholder: "bortle 4 site" },
];

export function AstrophotoEditModal({
  photo,
  albums,
  onClose,
}: {
  photo: Astrophoto;
  albums: Album[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!mounted) return null;

  const initialDate = photo.taken_at
    ? new Date(photo.taken_at).toISOString().slice(0, 10)
    : "";

  return createPortal(
    <div
      className="fixed inset-0 z-[110] bg-skynavy-900/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] rounded-lg bg-white border border-pink-100 shadow-soft p-6 max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="label text-lavender-600">edit astrophoto</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="text-pink-600 text-sm font-semibold hover:text-pink-800"
          >
            ✕
          </button>
        </div>

        <form
          action={async (formData) => {
            setError(null);
            const result = await updateAstrophotoMeta(formData);
            if (!result.ok) {
              setError(result.error ?? "Update failed.");
              return;
            }
            router.refresh();
            onClose();
          }}
          className="flex flex-col gap-4 mt-4"
        >
          <input type="hidden" name="id" value={photo.id} />

          <Field name="object_name" label="object" defaultValue={photo.object_name} required />
          <Field name="caption" label="caption" defaultValue={photo.caption} />
          <Field name="taken_at" label="taken on" defaultValue={initialDate} placeholder="2026-04-15" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <Field
                key={f.name}
                name={f.name}
                label={f.label}
                defaultValue={(photo[f.name] as string | null) ?? ""}
                placeholder={f.placeholder}
              />
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="album_id" className="label text-pink-600">
              album
            </label>
            <select
              id="album_id"
              name="album_id"
              defaultValue={photo.album_id ?? ""}
              className="bg-pink-50 border border-pink-100 rounded-sm px-3 py-2 text-sm text-ink focus:outline-none focus:border-pink-200"
            >
              <option value="">— uncategorized —</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {albums.length === 0 ? (
              <p className="text-[11px] text-lavender-600">
                no albums yet. create one on the /astronomy page first.
              </p>
            ) : null}
          </div>

          {error ? (
            <p className="text-xs text-pink-600 font-semibold">{error}</p>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="lift rounded-pill bg-white text-pink-800 border border-pink-100 hover:border-pink-200 px-4 py-2 text-sm font-semibold"
            >
              cancel
            </button>
            <SaveButton />
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="label text-pink-600">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="bg-pink-50 border border-pink-100 rounded-sm px-3 py-2 text-sm text-ink placeholder:text-pink-400 focus:outline-none focus:border-pink-200"
      />
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="lift rounded-pill bg-pink-200 text-white border border-pink-200 shadow-soft hover:border-pink-400 px-4 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-wait"
    >
      {pending ? "saving…" : "save"}
    </button>
  );
}
