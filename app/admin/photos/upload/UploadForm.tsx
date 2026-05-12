"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import {
  parseExifInBrowser,
  readImageDimensions,
  extension,
} from "@/lib/upload-utils";
import { signPhotoUpload, insertPhotoRow } from "./actions";
import type { Album } from "@/lib/supabase/albums";

const BUCKET = "photos";

function parseTagsCsv(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export function UploadForm({
  initialError,
  albums,
  initialAlbumId = "",
  existingTags = [],
  cancelHref = "/photos",
}: {
  initialError?: string;
  albums: Album[];
  initialAlbumId?: string;
  existingTags?: string[];
  cancelHref?: string;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [tagList, setTagList] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState<string>("");
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
      setStageNote("reading file…");
      const exif = await parseExifInBrowser(file);
      const dims = exif.width && exif.height ? exif : await readImageDimensions(file);

      setStageNote("getting upload slot…");
      const sign = await signPhotoUpload(extension(file.name));
      if (!sign.ok) throw new Error(sign.error);

      setStageNote("uploading…");
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(sign.path, sign.token, file, {
          contentType: file.type,
        });
      if (upErr) throw new Error(upErr.message);

      setStageNote("saving metadata…");
      const albumIdRaw = formData.get("album_id");
      const albumId =
        typeof albumIdRaw === "string" && albumIdRaw !== ""
          ? albumIdRaw
          : null;
      const result = await insertPhotoRow({
        storagePath: sign.path,
        imageUrl: sign.publicUrl,
        caption: String(formData.get("caption") ?? "").trim(),
        tags: parseTagsCsv(String(formData.get("tags") ?? "")),
        takenAt: exif.takenAt,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
        albumId,
      });
      if (!result.ok) throw new Error(result.error);

      router.push("/admin/photos/upload?status=ok");
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
              drop a photo here ✿
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

      <div className="flex flex-col gap-2">
        <label htmlFor="caption" className="label text-pink-600">
          caption
        </label>
        <input
          id="caption"
          name="caption"
          type="text"
          maxLength={240}
          placeholder="a sentence or two…"
          className="bg-pink-50 border border-pink-100 rounded-sm px-3 py-2 text-sm text-ink placeholder:text-pink-400 focus:outline-none focus:border-pink-200"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="label text-pink-600">tags</span>
        <TagChipInput
          tags={tagList}
          draft={tagDraft}
          setTags={setTagList}
          setDraft={setTagDraft}
        />
        {/* Hidden field carries the joined CSV to the server action so
            insertPhotoRow / parseTagsCsv stay unchanged. We also commit
            any pending draft into the CSV on submit so users don't lose
            text they typed but didn't press Enter on. */}
        <input
          type="hidden"
          name="tags"
          value={joinTags(tagList, tagDraft)}
        />
        <p className="text-[11px] text-lavender-600">
          press Enter or comma to capsule each tag. Backspace on an empty
          field removes the last.
        </p>
        {existingTags.length > 0 ? (
          <TagSuggestions
            available={existingTags}
            current={tagList}
            onPick={(t) => {
              if (!tagList.includes(t)) setTagList([...tagList, t]);
            }}
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="album_id" className="label text-pink-600">
          album
        </label>
        <select
          id="album_id"
          name="album_id"
          defaultValue={initialAlbumId}
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
            no albums yet. create one on /photos first.
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="text-xs text-pink-600 font-semibold">{error}</p>
      ) : null}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={pending}
          className="lift rounded-pill bg-pink-200 text-white border border-pink-200 shadow-soft hover:border-pink-400 px-4 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-wait"
        >
          {pending ? stageNote || "uploading…" : "upload →"}
        </button>
        <Link
          href={cancelHref}
          aria-disabled={pending}
          className={
            "lift rounded-pill bg-white text-pink-800 border border-pink-100 hover:border-pink-200 px-4 py-2 text-sm font-semibold " +
            (pending ? "pointer-events-none opacity-60" : "")
          }
        >
          cancel
        </Link>
        {pending && stageNote ? (
          <span className="text-xs text-lavender-600 font-semibold">
            {stageNote}
          </span>
        ) : null}
      </div>
    </form>
  );
}

// Join the committed tag list with any uncommitted draft text so the
// hidden field carries everything the user typed, even if they forgot
// to press Enter on the last word.
function joinTags(committed: string[], draft: string): string {
  const draftTag = draft.trim().toLowerCase();
  if (draftTag && !committed.includes(draftTag)) {
    return [...committed, draftTag].join(", ");
  }
  return committed.join(", ");
}

// Chip-style tag entry. Tags are stored as an array; typing into the
// input and pressing Enter or comma promotes the text to a removable
// capsule. Backspace on an empty input pops the last tag.
function TagChipInput({
  tags,
  draft,
  setTags,
  setDraft,
}: {
  tags: string[];
  draft: string;
  setTags: (next: string[]) => void;
  setDraft: (next: string) => void;
}) {
  function commitDraft() {
    const t = draft.trim().toLowerCase();
    if (!t) return;
    if (!tags.includes(t)) setTags([...tags, t]);
    setDraft("");
  }
  return (
    <div className="bg-pink-50 border border-pink-100 rounded-sm px-2 py-1.5 flex flex-wrap items-center gap-1.5 focus-within:border-pink-200">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-pill bg-white border border-pink-200 text-xs font-semibold text-pink-800 pl-2 pr-1 py-0.5"
        >
          {t}
          <button
            type="button"
            onClick={() => setTags(tags.filter((x) => x !== t))}
            aria-label={`remove ${t}`}
            className="w-4 h-4 inline-flex items-center justify-center text-pink-400 hover:text-pink-800 hover:bg-pink-50 rounded-full leading-none"
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          // If user pastes/types text with a comma, split it into
          // chips immediately instead of leaving the comma in the draft.
          if (v.includes(",")) {
            const parts = v.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
            const next = [...tags];
            for (const p of parts) if (!next.includes(p)) next.push(p);
            setTags(next);
            setDraft("");
          } else {
            setDraft(v);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitDraft();
          } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
            setTags(tags.slice(0, -1));
          }
        }}
        onBlur={commitDraft}
        placeholder={tags.length === 0 ? "travel, nature…" : ""}
        className="bg-transparent flex-1 min-w-[100px] text-sm text-ink placeholder:text-pink-400 focus:outline-none px-1 py-0.5"
      />
    </div>
  );
}

// Suggestion chips below the tags input. Click adds the tag to the
// committed list (skipping duplicates).
function TagSuggestions({
  available,
  current,
  onPick,
}: {
  available: string[];
  current: string[];
  onPick: (tag: string) => void;
}) {
  const currentSet = new Set(current.map((t) => t.toLowerCase()));
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      <span className="text-[11px] text-lavender-600 font-semibold mr-1">
        existing:
      </span>
      {available.map((t) => {
        const picked = currentSet.has(t.toLowerCase());
        return (
          <button
            key={t}
            type="button"
            onClick={() => onPick(t)}
            disabled={picked}
            className={
              "rounded-pill px-2 py-0.5 text-[11px] font-semibold border transition-colors " +
              (picked
                ? "bg-pink-100 text-pink-400 border-pink-100 cursor-default"
                : "bg-white text-pink-800 border-pink-200 hover:border-pink-400")
            }
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}
