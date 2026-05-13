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
import { updatePhotoMeta } from "@/app/photos/admin-actions";
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
  // Success state for the inline preview card. When set, the form is
  // hidden and the admin can pick "upload another" to reset.
  const [justUploaded, setJustUploaded] = useState<{
    id: string;
    src: string;
    caption: string;
    tags: string[];
    albumId: string | null;
    hidden: boolean;
    width: number | null;
    height: number | null;
  } | null>(null);

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
      const hidden = formData.get("hidden") === "on";
      const captionText = String(formData.get("caption") ?? "").trim();
      const tagsArr = parseTagsCsv(String(formData.get("tags") ?? ""));
      const result = await insertPhotoRow({
        storagePath: sign.path,
        imageUrl: sign.publicUrl,
        caption: captionText,
        tags: tagsArr,
        takenAt: exif.takenAt,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
        albumId,
        hidden,
      });
      if (!result.ok) throw new Error(result.error);

      // Show the inline success preview instead of navigating away.
      // The Storage URL works for the thumbnail since the file is
      // public; we keep the local previewUrl alive too just in case
      // the CDN is slow on first hit.
      setJustUploaded({
        id: result.id,
        src: sign.publicUrl || previewUrl || "",
        caption: captionText,
        tags: tagsArr,
        albumId,
        hidden,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
      setStageNote("");
    }
  }

  function resetForAnother() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFileName("");
    setPreviewUrl(null);
    setTagList([]);
    setTagDraft("");
    setError(null);
    setJustUploaded(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  // Inline success card after a successful upload — replaces the
  // form with a thumbnail + edit panel + "upload another" CTA so
  // admin can confirm + tweak the result without leaving the page.
  if (justUploaded) {
    return (
      <UploadSuccessCard
        item={justUploaded}
        albums={albums}
        existingTags={existingTags}
        onUpdate={(next) => setJustUploaded(next)}
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
                  if (!tagList.includes(t)) setTagList([...tagList, t]);
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
              disabled={savePending}
              className="rounded-pill bg-pink-200 text-white border border-pink-200 hover:border-pink-400 px-4 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-wait"
            >
              {savePending ? "saving…" : "save changes"}
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
