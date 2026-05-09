"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { uploadAstrophoto } from "./actions";

export function UploadForm({ initialError }: { initialError?: string }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  function setFile(file: File | null) {
    if (!file) {
      setFileName("");
      setPreviewUrl(null);
      return;
    }
    setFileName(file.name);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (fileInput.current) {
      const dt = new DataTransfer();
      dt.items.add(f);
      fileInput.current.files = dt.files;
    }
    setFile(f);
  }

  return (
    <form
      action={uploadAstrophoto}
      className="flex flex-col gap-5 mt-6 rounded-lg bg-white border border-pink-100 shadow-soft p-6"
    >
      <label
        htmlFor="file"
        onDragEnter={() => setDragActive(true)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={
          "block cursor-pointer rounded-md border-2 border-dashed px-6 py-10 text-center transition-colors " +
          (dragActive
            ? "bg-pink-50 border-pink-400"
            : "bg-pink-50/60 border-pink-200 hover:border-pink-400")
        }
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="preview"
            className="mx-auto max-h-64 rounded-sm border border-pink-100"
          />
        ) : (
          <>
            <p className="font-script text-pink-600 text-2xl">
              drop your astrophoto here ✦
            </p>
            <p className="text-xs text-lavender-600 mt-2 font-semibold">
              or click to choose · jpg, png, tiff · up to 25mb
            </p>
          </>
        )}
        <input
          ref={fileInput}
          id="file"
          name="file"
          type="file"
          accept="image/*"
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
        {fileName ? (
          <p className="text-xs text-pink-600 mt-3 font-semibold truncate">
            {fileName}
          </p>
        ) : null}
      </label>

      <Field name="object_name" label="object" placeholder="m31 — andromeda galaxy" required />
      <Field name="caption" label="caption" placeholder="a sentence about this image" />
      <Field name="taken_at" label="taken on" placeholder="2026-04-15 (or leave blank — read from EXIF)" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field name="telescope" label="telescope" placeholder="askar 71f" />
        <Field name="mount" label="mount" placeholder="zwo am3" />
        <Field name="camera" label="camera" placeholder="zwo asi533mc pro" />
        <Field name="exposure_stack" label="exposure stack" placeholder="120 × 180s rgb" />
        <Field name="processing" label="processing" placeholder="pixinsight, graxpert" />
        <Field name="location" label="location" placeholder="bortle 4 site, sierra nevada" />
      </div>

      {initialError ? (
        <p className="text-xs text-pink-600 font-semibold">{initialError}</p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function Field({
  name,
  label,
  placeholder,
  required,
}: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={name} className="label text-pink-600">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        placeholder={placeholder}
        required={required}
        className="bg-pink-50 border border-pink-100 rounded-sm px-3 py-2 text-sm text-ink placeholder:text-pink-400 focus:outline-none focus:border-pink-200"
      />
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="lift rounded-pill bg-pink-200 text-white border border-pink-200 shadow-soft hover:border-pink-400 px-4 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-wait"
    >
      {pending ? "uploading…" : "upload →"}
    </button>
  );
}
