"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import {
  parseExifInBrowser,
  readImageDimensions,
  extension,
} from "@/lib/upload-utils";
import { signPhotoUpload, insertPhotoRow } from "./actions";
import {
  togglePhotoHidden,
  updatePhotoMeta,
} from "@/app/photos/admin-actions";
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
  // Selected files (one or many). Previews are object URLs we
  // generate per file and revoke when we replace or reset the list.
  const [selectedFiles, setSelectedFiles] = useState<
    { file: File; previewUrl: string }[]
  >([]);
  const [dragActive, setDragActive] = useState(false);
  const [pending, setPending] = useState(false);
  const [stageNote, setStageNote] = useState<string>("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  // Success state — list of items, one per successful upload. The
  // form is replaced by the success view as soon as the batch
  // finishes (or the first one succeeds for single-file uploads).
  const [justUploadedList, setJustUploadedList] = useState<
    SuccessItem[]
  >([]);

  function setFiles(files: File[]) {
    setSelectedFiles((prev) => {
      // Revoke previous object URLs to avoid leaks.
      for (const p of prev) URL.revokeObjectURL(p.previewUrl);
      return files.map((f) => ({
        file: f,
        previewUrl: URL.createObjectURL(f),
      }));
    });
    setError(null);
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length === 0) return;
    if (fileInput.current) {
      const dt = new DataTransfer();
      for (const f of files) dt.items.add(f);
      fileInput.current.files = dt.files;
    }
    setFiles(files);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formEl = e.currentTarget;
    const formData = new FormData(formEl);
    if (selectedFiles.length === 0) {
      setError("Please pick at least one file.");
      return;
    }

    setPending(true);
    // Read form-level fields that apply to ALL files in this batch.
    const albumIdRaw = formData.get("album_id");
    const sharedAlbumId =
      typeof albumIdRaw === "string" && albumIdRaw !== ""
        ? albumIdRaw
        : null;
    const sharedHidden = formData.get("hidden") === "on";
    const sharedCaption = String(formData.get("caption") ?? "").trim();
    const sharedTags = parseTagsCsv(String(formData.get("tags") ?? ""));

    const uploaded: SuccessItem[] = [];
    let failed = 0;
    try {
      const supabase = createClient();
      for (let i = 0; i < selectedFiles.length; i++) {
        const { file, previewUrl } = selectedFiles[i];
        const labelN =
          selectedFiles.length === 1
            ? ""
            : ` (${i + 1}/${selectedFiles.length})`;
        try {
          setStageNote(`reading file…${labelN}`);
          const exif = await parseExifInBrowser(file);
          const dims =
            exif.width && exif.height ? exif : await readImageDimensions(file);

          setStageNote(`signing…${labelN}`);
          const sign = await signPhotoUpload(extension(file.name));
          if (!sign.ok) throw new Error(sign.error);

          setStageNote(`uploading…${labelN}`);
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .uploadToSignedUrl(sign.path, sign.token, file, {
              contentType: file.type,
            });
          if (upErr) throw new Error(upErr.message);

          setStageNote(`saving metadata…${labelN}`);
          // Shared caption only applies to the first file when
          // uploading many — re-using it for the rest would
          // duplicate text in unhelpful ways. Admin can edit
          // each photo's caption in the success grid.
          const caption =
            selectedFiles.length === 1 || i === 0 ? sharedCaption : "";
          const result = await insertPhotoRow({
            storagePath: sign.path,
            imageUrl: sign.publicUrl,
            caption,
            tags: sharedTags,
            takenAt: exif.takenAt,
            width: dims?.width ?? null,
            height: dims?.height ?? null,
            albumId: sharedAlbumId,
            hidden: sharedHidden,
          });
          if (!result.ok) throw new Error(result.error);

          uploaded.push({
            id: result.id,
            src: sign.publicUrl || previewUrl,
            caption,
            tags: sharedTags,
            albumId: sharedAlbumId,
            hidden: sharedHidden,
            width: dims?.width ?? null,
            height: dims?.height ?? null,
          });
        } catch (err) {
          failed += 1;
          // Track the first failure to surface inline; continue with
          // remaining files so a single bad upload doesn't abort the
          // whole batch.
          if (!error) {
            setError(
              `${file.name}: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          }
        }
      }
      if (uploaded.length > 0) {
        setJustUploadedList(uploaded);
        router.refresh();
      }
      if (uploaded.length === 0 && failed > 0 && !error) {
        setError("All uploads failed. Check file types and try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
      setStageNote("");
    }
  }

  function resetForAnother() {
    for (const p of selectedFiles) URL.revokeObjectURL(p.previewUrl);
    setSelectedFiles([]);
    setTagList([]);
    setTagDraft("");
    setError(null);
    setJustUploadedList([]);
    if (fileInput.current) fileInput.current.value = "";
  }

  // Inline success card after a successful upload. Single-file
  // uploads keep the existing thumbnail-plus-edit-panel layout; a
  // batch upload renders the items as a grid where clicking a
  // thumbnail opens the editor in an overlay.
  if (justUploadedList.length === 1) {
    return (
      <UploadSuccessCard
        item={justUploadedList[0]}
        albums={albums}
        existingTags={existingTags}
        onUpdate={(next) => setJustUploadedList([next])}
        onResetForAnother={resetForAnother}
      />
    );
  }
  if (justUploadedList.length > 1) {
    return (
      <UploadSuccessGrid
        items={justUploadedList}
        albums={albums}
        existingTags={existingTags}
        onUpdate={(next) => setJustUploadedList(next)}
        onResetForAnother={resetForAnother}
      />
    );
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
        {selectedFiles.length === 0 ? (
          <>
            <p className="font-script text-pink-600 text-2xl">
              drop photos here ✿
            </p>
            <p className="text-xs text-lavender-600 mt-2 font-semibold">
              one or many · uploads directly to storage · no size cap
            </p>
          </>
        ) : selectedFiles.length === 1 ? (
          // Single selection: show the full preview thumbnail like
          // before.
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedFiles[0].previewUrl}
              alt="preview"
              className="mx-auto max-h-64 rounded-sm border border-pink-100"
            />
            <p className="text-xs text-pink-600 mt-3 font-semibold truncate">
              {selectedFiles[0].file.name}
            </p>
          </>
        ) : (
          // Multiple selection: small thumbnail strip + count.
          <div className="flex flex-col gap-3 items-center">
            <div className="flex flex-wrap items-center justify-center gap-2 max-h-40 overflow-hidden">
              {selectedFiles.slice(0, 10).map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={p.previewUrl}
                  alt=""
                  className="w-16 h-16 object-cover rounded-sm border border-pink-100"
                />
              ))}
              {selectedFiles.length > 10 ? (
                <span className="text-[11px] text-pink-700 font-semibold px-2">
                  +{selectedFiles.length - 10} more
                </span>
              ) : null}
            </div>
            <p className="text-xs text-pink-600 font-semibold">
              {selectedFiles.length} photos selected
            </p>
          </div>
        )}
        <input
          ref={fileInput}
          id="file"
          name="file"
          type="file"
          accept="image/*"
          multiple
          required
          onChange={(e) =>
            setFiles(Array.from(e.target.files ?? []))
          }
          className="sr-only"
        />
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
              setTagList(
                tagList.includes(t)
                  ? tagList.filter((x) => x !== t)
                  : [...tagList, t]
              );
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

      <label className="flex items-center gap-2 text-sm text-ink/85 font-semibold cursor-pointer select-none">
        <input
          type="checkbox"
          name="hidden"
          className="accent-pink-400 w-4 h-4"
        />
        upload as hidden
        <span className="text-[11px] text-lavender-600 font-normal">
          (only you can see it until you unhide on /photos)
        </span>
      </label>

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
        // enterKeyHint nudges most mobile keyboards to show a "Done"
        // or "Return" key; some still don't fire onKeyDown with
        // key="Enter" though, so we also detect a literal "\n" in
        // the value below (which is what the return key inserts on
        // a single-line input on iOS Safari & some Android keyboards
        // when autocorrect is involved).
        enterKeyHint="done"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => {
          const v = e.target.value;
          // Split on comma OR newline so mobile keyboards that insert
          // \n on return-key still capsule the tag without the user
          // having to tap an extra button. Desktop comma flow still
          // works the same way.
          if (/[,\n]/.test(v)) {
            const parts = v
              .split(/[,\n]/)
              .map((p) => p.trim().toLowerCase())
              .filter(Boolean);
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
      {/* Tap-friendly "add" pill — guarantees there's always a
          visible commit affordance on mobile, even if the keyboard
          omits the return key. */}
      {draft.trim() ? (
        <button
          type="button"
          onClick={commitDraft}
          className="rounded-pill bg-pink-200 text-white border border-pink-200 px-2 py-0.5 text-[11px] font-semibold leading-none"
          aria-label="add tag"
        >
          + add
        </button>
      ) : null}
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
            // Toggle behavior: caller decides what to do based on
            // whether the tag is currently picked. Clicking a picked
            // chip now removes the tag — matches the × on the
            // committed capsule, so admin has two equivalent ways
            // to undo a tag pick.
            onClick={() => onPick(t)}
            title={picked ? "click to remove" : "click to add"}
            className={
              "rounded-pill px-2 py-0.5 text-[11px] font-semibold border transition-colors " +
              (picked
                ? "bg-pink-200 text-white border-pink-200 hover:bg-pink-100 hover:text-pink-800 hover:border-pink-300"
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

// Success card shown after a successful upload. Replaces the form
// in-place. Desktop layout: top-row CTAs (upload another / view
// photos) above a row with the thumbnail on the left and an inline
// edit panel (caption / tags / album) on the right. Mobile stacks
// the same content vertically. Clicking the thumbnail opens an
// in-page preview overlay that also offers an album-deep link.
type SuccessItem = {
  id: string;
  src: string;
  caption: string;
  tags: string[];
  albumId: string | null;
  hidden: boolean;
  width: number | null;
  height: number | null;
};

function UploadSuccessCard({
  item,
  albums,
  existingTags,
  onUpdate,
  onResetForAnother,
}: {
  item: SuccessItem;
  albums: Album[];
  existingTags: string[];
  onUpdate: (next: SuccessItem) => void;
  onResetForAnother: () => void;
}) {
  const haveDims =
    item.width && item.height && item.width > 0 && item.height > 0;
  const aspect = haveDims ? `${item.width} / ${item.height}` : undefined;
  // Edit panel local state. Initialized from the just-uploaded row
  // and synced back via onUpdate after a successful save so the
  // thumbnail's caption / album-link stay correct.
  const [caption, setCaption] = useState(item.caption);
  const [tagList, setTagList] = useState<string[]>(item.tags);
  const [tagDraft, setTagDraft] = useState("");
  const [albumId, setAlbumId] = useState<string>(item.albumId ?? "");
  const [savePending, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [hidePending, startHide] = useTransition();

  function toggleHidden() {
    const next = !item.hidden;
    setSaveError(null);
    startHide(async () => {
      try {
        const res = await togglePhotoHidden(item.id, next);
        if (!res.ok) {
          setSaveError(res.error ?? "couldn’t change visibility.");
          return;
        }
        onUpdate({ ...item, hidden: next });
      } catch (e) {
        setSaveError(
          e instanceof Error ? e.message : "couldn’t reach the server."
        );
      }
    });
  }

  // Stable copy of "where is this photo right now" so the album-deep
  // link in the preview modal reflects the saved value, not the
  // in-progress draft.
  const currentAlbum = albums.find((a) => a.id === item.albumId) ?? null;

  function save() {
    setSaveError(null);
    setSaveOk(false);
    startSave(async () => {
      try {
        const fd = new FormData();
        fd.set("id", item.id);
        fd.set("caption", caption);
        // updatePhotoMeta accepts comma-separated tags.
        fd.set(
          "tags",
          joinTags(tagList, tagDraft.trim().toLowerCase())
        );
        fd.set("album_id", albumId);
        const res = await updatePhotoMeta(fd);
        if (!res.ok) {
          setSaveError(res.error ?? "save failed.");
          return;
        }
        // Commit any pending draft into the saved chip list so the
        // displayed state matches what's in the DB.
        const finalTags = (() => {
          const d = tagDraft.trim().toLowerCase();
          if (!d || tagList.includes(d)) return tagList;
          return [...tagList, d];
        })();
        setTagList(finalTags);
        setTagDraft("");
        onUpdate({
          ...item,
          caption: caption.trim(),
          tags: finalTags,
          albumId: albumId || null,
        });
        setSaveOk(true);
      } catch (e) {
        setSaveError(
          e instanceof Error ? e.message : "couldn’t reach the server."
        );
      }
    });
  }

  const albumLinkHref =
    currentAlbum ? `/photos/album/${encodeURIComponent(currentAlbum.slug)}` : "/photos";
  const albumLinkLabel = currentAlbum
    ? `view in “${currentAlbum.name}”`
    : "view photos";

  return (
    <div className="flex flex-col gap-4 mt-6 rounded-lg bg-white border border-pink-100 shadow-soft p-4 sm:p-6">
      {/* Top row: header + CTAs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="font-script text-pink-600 text-2xl leading-tight">
            uploaded ✿
          </p>
          {item.hidden ? (
            <span className="rounded-pill bg-lavender-100 text-lavender-800 px-2 py-0.5 text-[10px] font-semibold border border-lavender-200">
              hidden
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onResetForAnother}
            className="lift rounded-pill bg-pink-200 text-white border border-pink-200 shadow-soft hover:border-pink-400 px-4 py-2 text-sm font-semibold"
          >
            + upload another
          </button>
          <Link
            href="/photos"
            className="lift rounded-pill bg-white text-pink-800 border border-pink-100 hover:border-pink-200 px-4 py-2 text-sm font-semibold"
          >
            view photos
          </Link>
        </div>
      </div>

      {/* Photo + edit panel */}
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          aria-label="open larger preview"
          className="shrink-0 mx-auto md:mx-0 rounded-md border border-pink-100 overflow-hidden bg-pink-50/40 cursor-zoom-in hover:border-pink-200 transition-colors"
          style={{
            aspectRatio: aspect,
            width: haveDims ? "auto" : "100%",
            maxWidth: "min(100%, 260px)",
            maxHeight: "240px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.src}
            alt={item.caption || "uploaded photo"}
            className={
              haveDims
                ? "block w-full h-full object-cover"
                : "block max-w-full max-h-[240px] object-contain mx-auto"
            }
          />
        </button>

        {/* Inline edit panel — fills the right side on desktop,
            stacks below the thumbnail on mobile. Lets admin tidy
            caption / tags / album without leaving the page. */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="success-caption"
              className="label text-pink-600"
            >
              caption
            </label>
            <input
              id="success-caption"
              type="text"
              value={caption}
              onChange={(e) => {
                setCaption(e.target.value);
                setSaveOk(false);
              }}
              maxLength={240}
              placeholder="a sentence or two…"
              className="bg-pink-50 border border-pink-100 rounded-sm px-3 py-2 text-sm text-ink placeholder:text-pink-400 focus:outline-none focus:border-pink-200"
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="label text-pink-600">tags</span>
            <TagChipInput
              tags={tagList}
              draft={tagDraft}
              setTags={(next) => {
                setTagList(next);
                setSaveOk(false);
              }}
              setDraft={(next) => {
                setTagDraft(next);
                setSaveOk(false);
              }}
            />
            {existingTags.length > 0 ? (
              <TagSuggestions
                available={existingTags}
                current={tagList}
                onPick={(t) => {
                  setTagList(
                    tagList.includes(t)
                      ? tagList.filter((x) => x !== t)
                      : [...tagList, t]
                  );
                  setSaveOk(false);
                }}
              />
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="success-album"
              className="label text-pink-600"
            >
              album
            </label>
            <select
              id="success-album"
              value={albumId}
              onChange={(e) => {
                setAlbumId(e.target.value);
                setSaveOk(false);
              }}
              className="bg-pink-50 border border-pink-100 rounded-sm px-3 py-2 text-sm text-ink focus:outline-none focus:border-pink-200"
            >
              <option value="">— uncategorized —</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {saveError ? (
            <p className="text-xs text-pink-600 font-semibold">{saveError}</p>
          ) : null}

          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              type="button"
              onClick={save}
              disabled={savePending || hidePending}
              className="rounded-pill bg-pink-200 text-white border border-pink-200 hover:border-pink-400 px-4 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-wait"
            >
              {savePending ? "saving…" : "save changes"}
            </button>
            <button
              type="button"
              onClick={toggleHidden}
              disabled={savePending || hidePending}
              title={item.hidden ? "unhide on /photos" : "hide from public"}
              className="rounded-pill bg-white text-pink-800 border border-pink-200 hover:border-pink-400 px-3 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-wait"
            >
              {hidePending
                ? "…"
                : item.hidden
                ? "◉ unhide"
                : "○ hide"}
            </button>
            {saveOk && !savePending ? (
              <span className="text-xs text-lavender-600 font-semibold">
                ✓ saved
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {previewOpen ? (
        <PreviewOverlay
          src={item.src}
          aspect={aspect}
          caption={item.caption}
          albumLinkHref={albumLinkHref}
          albumLinkLabel={albumLinkLabel}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </div>
  );
}

// Minimal in-page preview overlay — portaled to body so it sits
// above the upload form, click-outside or escape to dismiss, with
// a button that deep-links to the photo's album (or /photos when
// the photo is uncategorized).
function PreviewOverlay({
  src,
  aspect,
  caption,
  albumLinkHref,
  albumLinkLabel,
  onClose,
}: {
  src: string;
  aspect?: string;
  caption: string;
  albumLinkHref: string;
  albumLinkLabel: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (!mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-skynavy-900/90 backdrop-blur-sm flex flex-col"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-3 sm:px-4 py-3 text-cream/80 gap-2 shrink-0">
        <span className="font-script text-cream/70 text-xl select-none">
          ✿
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="close preview"
          className="rounded-full w-11 h-11 sm:w-auto sm:h-auto sm:rounded-pill sm:px-3 sm:py-2 inline-flex items-center justify-center text-base sm:text-sm font-semibold bg-cream/15 text-cream border border-cream/30 hover:bg-cream/25"
        >
          <span aria-hidden className="sm:hidden text-lg leading-none">
            ✕
          </span>
          <span aria-hidden className="hidden sm:inline">
            ✕ close
          </span>
        </button>
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-full flex flex-col items-center justify-center px-4 pb-6 gap-4">
          <div
            className="relative"
            style={{
              aspectRatio: aspect,
              maxWidth: "100%",
              maxHeight: "calc(100vh - 220px)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={caption || "uploaded photo"}
              className={
                aspect
                  ? "block w-full h-full object-contain rounded-md shadow-soft"
                  : "block max-h-[calc(100vh-220px)] max-w-full object-contain rounded-md shadow-soft"
              }
            />
          </div>
          <div className="w-full max-w-[680px] rounded-md bg-cream/5 border border-cream/10 px-5 py-3 text-cream flex items-center justify-between gap-3 flex-wrap">
            <p className="font-script text-cream text-lg leading-tight truncate">
              {caption || "untitled"}
            </p>
            <Link
              href={albumLinkHref}
              className="rounded-pill px-3 py-1.5 text-sm font-semibold bg-cream/15 text-cream border border-cream/30 hover:bg-cream/25"
            >
              {albumLinkLabel} →
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Round chevron arrow used inside the batch editor for prev/next.
// Mirrors the photo lightbox's NavArrow styling so the lightbox /
// editor feel consistent. Click navigates only — saving is handled
// separately by the "save & next" button or the "save" button.
function BatchNavArrow({
  direction,
  disabled,
  onClick,
  title,
}: {
  direction: "prev" | "next";
  disabled?: boolean;
  onClick: () => void;
  title: string;
}) {
  const isPrev = direction === "prev";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      title={title}
      className={
        "absolute top-1/2 -translate-y-1/2 z-10 " +
        "w-11 h-11 sm:w-12 sm:h-12 rounded-full " +
        "bg-skynavy-900/55 hover:bg-skynavy-900/80 active:bg-skynavy-900/90 " +
        "text-cream border border-cream/30 hover:border-cream/55 " +
        "shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-sm " +
        "flex items-center justify-center transition disabled:opacity-25 disabled:cursor-not-allowed " +
        (isPrev ? "left-2 sm:left-3" : "right-2 sm:right-3")
      }
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5 sm:w-[22px] sm:h-[22px]"
        aria-hidden
      >
        {isPrev ? (
          <polyline points="15 5 8 12 15 19" />
        ) : (
          <polyline points="9 5 16 12 9 19" />
        )}
      </svg>
    </button>
  );
}

// Success view for a batch upload (>1 file). Renders a compact grid
// of thumbnails; clicking any one opens an edit overlay where admin
// can tweak that specific photo's caption / tags / album / hidden.
// Mobile-friendly by default — no per-item edit panel inline, since
// many would make the page very long.
function UploadSuccessGrid({
  items,
  albums,
  existingTags,
  onUpdate,
  onResetForAnother,
}: {
  items: SuccessItem[];
  albums: Album[];
  existingTags: string[];
  onUpdate: (next: SuccessItem[]) => void;
  onResetForAnother: () => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  function updateAt(idx: number, next: SuccessItem) {
    onUpdate(items.map((it, i) => (i === idx ? next : it)));
  }

  const editingItem = editingIndex !== null ? items[editingIndex] : null;

  return (
    <div className="flex flex-col gap-4 mt-6 rounded-lg bg-white border border-pink-100 shadow-soft p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="font-script text-pink-600 text-2xl leading-tight">
          uploaded {items.length} ✿
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onResetForAnother}
            className="lift rounded-pill bg-pink-200 text-white border border-pink-200 shadow-soft hover:border-pink-400 px-4 py-2 text-sm font-semibold"
          >
            + upload another
          </button>
          <Link
            href="/photos"
            className="lift rounded-pill bg-white text-pink-800 border border-pink-100 hover:border-pink-200 px-4 py-2 text-sm font-semibold"
          >
            view photos
          </Link>
        </div>
      </div>
      <p className="text-[11px] text-lavender-600 font-semibold">
        tap a photo to edit caption / tags / album / visibility.
      </p>

      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {items.map((it, i) => (
          <li key={it.id}>
            <button
              type="button"
              onClick={() => setEditingIndex(i)}
              className="block w-full aspect-square rounded-md overflow-hidden border border-pink-100 hover:border-pink-300 bg-pink-50/40 relative"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.src}
                alt={it.caption || "uploaded photo"}
                className="w-full h-full object-cover"
              />
              {it.hidden ? (
                <span className="absolute top-1.5 left-1.5 rounded-pill bg-lavender-100/95 text-lavender-800 px-1.5 py-0.5 text-[9px] font-semibold border border-lavender-200">
                  hidden
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      {editingItem !== null && editingIndex !== null ? (
        <BatchItemEditor
          // Re-key on item id so the editor's internal state (caption
          // / tags / album / hidden drafts) re-initialises when we
          // jump to a different photo via the prev/next arrows.
          key={editingItem.id}
          item={editingItem}
          index={editingIndex}
          total={items.length}
          albums={albums}
          existingTags={existingTags}
          onClose={() => setEditingIndex(null)}
          onSaved={(next) => updateAt(editingIndex, next)}
          onNavigate={(direction) => {
            const nextIdx = editingIndex + direction;
            if (nextIdx >= 0 && nextIdx < items.length) {
              setEditingIndex(nextIdx);
            }
          }}
        />
      ) : null}
    </div>
  );
}

// Per-item edit overlay used by UploadSuccessGrid. Wraps the photo
// at viewport size and lets admin tweak caption / tags / album /
// visibility inline. Save closes the overlay; close-without-save
// preserves whatever was last persisted.
function BatchItemEditor({
  item,
  index,
  total,
  albums,
  existingTags,
  onClose,
  onSaved,
  onNavigate,
}: {
  item: SuccessItem;
  /** Position of this item in the batch (0-based). */
  index: number;
  /** Total items in the batch. Used to gate prev/next at edges. */
  total: number;
  albums: Album[];
  existingTags: string[];
  onClose: () => void;
  onSaved: (next: SuccessItem) => void;
  /** Move to the next/prev photo in the batch. The editor saves
   *  current edits first so the arrow feels like "save & next". */
  onNavigate: (direction: -1 | 1) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Escape closes; arrow keys save-and-navigate. We ignore arrow
  // keys while the focus is in an input/textarea/select so admin
  // can still move the caret around inside fields.
  useEffect(() => {
    function isTextFocus() {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (!isTextFocus()) {
        // Arrow keys are pure navigation (no save) so admin can skip
        // past photos they don't want to commit changes to.
        if (e.key === "ArrowLeft" && index > 0) {
          e.preventDefault();
          onNavigate(-1);
        } else if (e.key === "ArrowRight" && index < total - 1) {
          e.preventDefault();
          onNavigate(1);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, index, total]);

  const [caption, setCaption] = useState(item.caption);
  const [tagList, setTagList] = useState<string[]>(item.tags);
  const [tagDraft, setTagDraft] = useState("");
  const [albumId, setAlbumId] = useState<string>(item.albumId ?? "");
  const [hidden, setHidden] = useState(item.hidden);
  const [savePending, startSave] = useTransition();
  const [hidePending, startHide] = useTransition();
  const [navPending, startNav] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const canPrev = index > 0;
  const canNext = index < total - 1;

  // Local helper — true when the draft differs from the last saved
  // state. Used to warn admin near the save button so a stray arrow
  // press doesn't silently lose work. tagDraft is folded in (the
  // pending text becomes a chip on save).
  function effectiveTags(list: string[], draft: string): string[] {
    const d = draft.trim().toLowerCase();
    if (!d || list.includes(d)) return list;
    return [...list, d];
  }
  function tagsEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  const dirty =
    caption.trim() !== item.caption ||
    !tagsEqual(effectiveTags(tagList, tagDraft), item.tags) ||
    (albumId || null) !== (item.albumId ?? null);

  const haveDims =
    item.width && item.height && item.width > 0 && item.height > 0;
  const aspect = haveDims ? `${item.width} / ${item.height}` : undefined;
  const currentAlbum = albums.find((a) => a.id === item.albumId) ?? null;
  const albumLinkHref = currentAlbum
    ? `/photos/album/${encodeURIComponent(currentAlbum.slug)}`
    : "/photos";
  const albumLinkLabel = currentAlbum
    ? `view in “${currentAlbum.name}”`
    : "view photos";

  // Persist the current draft to the server and update the parent's
  // item record. Returns whether the save succeeded so callers
  // (save, save&navigate) can branch.
  async function persistDraft(): Promise<boolean> {
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("id", item.id);
      fd.set("caption", caption);
      fd.set("tags", joinTags(tagList, tagDraft.trim().toLowerCase()));
      fd.set("album_id", albumId);
      const res = await updatePhotoMeta(fd);
      if (!res.ok) {
        setErr(res.error ?? "save failed.");
        return false;
      }
      const finalTags = (() => {
        const d = tagDraft.trim().toLowerCase();
        if (!d || tagList.includes(d)) return tagList;
        return [...tagList, d];
      })();
      onSaved({
        ...item,
        caption: caption.trim(),
        tags: finalTags,
        albumId: albumId || null,
        hidden,
      });
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return false;
    }
  }

  function save() {
    startSave(async () => {
      const ok = await persistDraft();
      if (ok) onClose();
    });
  }

  function saveAndNavigate(direction: -1 | 1) {
    startNav(async () => {
      const ok = await persistDraft();
      if (ok) onNavigate(direction);
    });
  }

  function toggleHidden() {
    const next = !hidden;
    startHide(async () => {
      try {
        const res = await togglePhotoHidden(item.id, next);
        if (!res.ok) {
          setErr(res.error ?? "couldn’t change visibility.");
          return;
        }
        setHidden(next);
        onSaved({ ...item, hidden: next });
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    });
  }

  if (!mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-skynavy-900/90 backdrop-blur-sm flex flex-col"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-3 sm:px-4 py-3 text-cream/80 gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-script text-cream/70 text-xl select-none">
            ✿ edit · {index + 1} of {total}
          </span>
          {/* Dirty marker lives in the header rather than the action
              row — keeping it out of that row prevents the "view in
              album" button from being pushed onto a second line on
              narrow phones when the badge appears. */}
          {dirty && !savePending && !navPending ? (
            <span className="rounded-pill bg-amber-200/90 text-amber-900 px-1.5 py-0.5 text-[10px] font-semibold border border-amber-300/80">
              unsaved
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="close"
          className="rounded-full w-11 h-11 sm:w-auto sm:h-auto sm:rounded-pill sm:px-3 sm:py-2 inline-flex items-center justify-center text-base sm:text-sm font-semibold bg-cream/15 text-cream border border-cream/30 hover:bg-cream/25"
        >
          <span aria-hidden className="sm:hidden text-lg leading-none">
            ✕
          </span>
          <span aria-hidden className="hidden sm:inline">
            ✕ close
          </span>
        </button>
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-full flex flex-col items-center px-4 pb-6 gap-4">
          {/* Photo + prev/next arrows. The arrows are "save & {prev,
              next}" — they persist the current draft before moving
              on, so admin can sweep through a batch with one tap per
              photo. */}
          <div className="relative w-full flex items-center justify-center">
            <BatchNavArrow
              direction="prev"
              disabled={!canPrev || savePending || navPending}
              onClick={() => onNavigate(-1)}
              title="previous (no save)"
            />
            <div
              className="relative"
              style={{
                aspectRatio: aspect,
                maxWidth: "min(100%, 900px)",
                maxHeight: "calc(100vh - 360px)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.src}
                alt={item.caption || "uploaded photo"}
                className={
                  aspect
                    ? "block w-full h-full object-contain rounded-md shadow-soft"
                    : "block max-h-[calc(100vh-360px)] max-w-full object-contain rounded-md shadow-soft"
                }
              />
            </div>
            <BatchNavArrow
              direction="next"
              disabled={!canNext || savePending || navPending}
              onClick={() => onNavigate(1)}
              title="next (no save)"
            />
          </div>

          <div className="w-full max-w-[680px] rounded-md bg-cream/5 border border-cream/10 px-4 py-3 text-cream flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide font-bold text-cream/55">
                caption
              </label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={240}
                placeholder="a sentence or two…"
                className="bg-cream/10 border border-cream/20 rounded-sm px-3 py-2 text-sm text-cream placeholder:text-cream/40 focus:outline-none focus:border-cream/50"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide font-bold text-cream/55">
                tags
              </span>
              <TagChipInput
                tags={tagList}
                draft={tagDraft}
                setTags={setTagList}
                setDraft={setTagDraft}
              />
              {existingTags.length > 0 ? (
                <TagSuggestions
                  available={existingTags}
                  current={tagList}
                  onPick={(t) =>
                    setTagList(
                      tagList.includes(t)
                        ? tagList.filter((x) => x !== t)
                        : [...tagList, t]
                    )
                  }
                />
              ) : null}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide font-bold text-cream/55">
                album
              </label>
              <select
                value={albumId}
                onChange={(e) => setAlbumId(e.target.value)}
                className="bg-cream/10 border border-cream/20 rounded-sm px-3 py-2 text-sm text-cream focus:outline-none focus:border-cream/50"
              >
                <option value="" className="text-ink">
                  — uncategorized —
                </option>
                {albums.map((a) => (
                  <option key={a.id} value={a.id} className="text-ink">
                    {a.name}
                  </option>
                ))}
              </select>
              {/* Contextual deep-link: lives with the album select so
                  it doesn't compete with save / hide for action-row
                  space (and so a save & next button appearing or
                  disappearing can't push it to a second row on
                  mobile). Reflects the *saved* album, not the draft —
                  the link target only changes after admin saves. */}
              <Link
                href={albumLinkHref}
                className="self-start text-[11px] text-cream/80 hover:text-cream underline-offset-2 hover:underline mt-0.5"
              >
                {albumLinkLabel} →
              </Link>
            </div>

            {err ? (
              <p className="text-xs text-pink-200 font-semibold">{err}</p>
            ) : null}

            <div className="flex items-center gap-2 flex-wrap pt-1">
              <button
                type="button"
                onClick={save}
                disabled={savePending || hidePending || navPending}
                className="rounded-pill bg-pink-300 text-white border border-pink-300 hover:bg-pink-400 hover:border-pink-400 px-4 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-wait"
              >
                {savePending && !navPending ? "saving…" : "save"}
              </button>
              {canNext ? (
                <button
                  type="button"
                  onClick={() => saveAndNavigate(1)}
                  disabled={savePending || hidePending || navPending}
                  className="rounded-pill bg-pink-200 text-white border border-pink-200 hover:bg-pink-300 hover:border-pink-300 px-4 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-wait"
                >
                  {navPending ? "saving…" : "save & next →"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={toggleHidden}
                disabled={savePending || hidePending || navPending}
                className="rounded-pill bg-cream/10 text-cream border border-cream/30 hover:bg-cream/20 px-3 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {hidePending ? "…" : hidden ? "◉ unhide" : "○ hide"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
