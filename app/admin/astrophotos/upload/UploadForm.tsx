"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import {
  parseExifInBrowser,
  readImageDimensions,
  extension,
} from "@/lib/upload-utils";
import { signAstrophotoUpload, insertAstrophotoRow } from "./actions";

const BUCKET = "astrophotos";

function trimOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export function UploadForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pending, setPending] = useState(false);
  const [stageNote, setStageNote] = useState<string>("");
  const [error, setError] = useState<string | null>(initialError ?? null);

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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formEl = e.currentTarget;
    const formData = new FormData(formEl);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Please pick a file.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("File must be an image.");
      return;
    }

    setPending(true);
    try {
      // 1. Parse EXIF + dimensions in the browser.
      setStageNote("reading file…");
      const exif = await parseExifInBrowser(file);
      const dims = exif.width && exif.height ? exif : await readImageDimensions(file);

      // Allow caller to override taken_at via form.
      const takenAtOverride = trimOrNull(formData.get("taken_at"));
      let takenAt: string | null = exif.takenAt;
      if (takenAtOverride) {
        const parsed = new Date(takenAtOverride);
        if (!Number.isNaN(parsed.getTime())) takenAt = parsed.toISOString();
      }

      // 2. Get signed upload URL.
      setStageNote("getting upload slot…");
      const sign = await signAstrophotoUpload(extension(file.name));
      if (!sign.ok) throw new Error(sign.error);

      // 3. Upload directly to Supabase Storage.
      setStageNote("uploading…");
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(sign.path, sign.token, file, {
          contentType: file.type,
        });
      if (upErr) throw new Error(upErr.message);

      // 4. Insert metadata row.
      setStageNote("saving metadata…");
      const result = await insertAstrophotoRow({
        storagePath: sign.path,
        imageUrl: sign.publicUrl,
        objectName: String(formData.get("object_name") ?? "").trim(),
        caption: String(formData.get("caption") ?? "").trim(),
        takenAt,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
        telescope: trimOrNull(formData.get("telescope")),
        mount: trimOrNull(formData.get("mount")),
        camera: trimOrNull(formData.get("camera")),
        exposureStack: trimOrNull(formData.get("exposure_stack")),
        processing: trimOrNull(formData.get("processing")),
        location: trimOrNull(formData.get("location")),
      });
      if (!result.ok) throw new Error(result.error);

      router.push("/admin/astrophotos/upload?status=ok");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
      setStageNote("");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
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
              or click to choose · uploads directly to storage · no size cap
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

      {error ? (
        <p className="text-xs text-pink-600 font-semibold">{error}</p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="lift rounded-pill bg-pink-200 text-white border border-pink-200 shadow-soft hover:border-pink-400 px-4 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-wait"
        >
          {pending ? stageNote || "uploading…" : "upload →"}
        </button>
        {pending && stageNote ? (
          <span className="text-xs text-lavender-600 font-semibold">
            {stageNote}
          </span>
        ) : null}
      </div>
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
