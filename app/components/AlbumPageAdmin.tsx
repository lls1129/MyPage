"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Album, CoverHistoryEntry } from "@/lib/supabase/albums";
import { CoverCropper } from "./CoverCropper";
import { CoverUploader } from "./CoverUploader";
import {
  FILTERS,
  FRAMES,
  FRAME_SIZES,
  filterCssFor,
  frameInsetFor,
  frameOverlayFor,
} from "./cover-decorations";
import {
  normalizeOverlays,
  type CoverOverlay,
} from "./cover-overlays";
import { readTitleStyle, type TitleStyle } from "./album-title";
import { OverlayEditor } from "./OverlayEditor";
import {
  getCropsForUrl,
  pushCrop,
  pushUrl,
  removeUrl,
  type LibraryKind,
} from "@/lib/cover-history";

type ActionResult = { ok: true } | { ok: false; error: string };

type CoverCandidate = { id: string; image_url: string };

// Where the album's name + count strip render on the card. Default
// is "below"; the other placements give admin different aesthetics
// for different album styles (polaroid bar, museum stacked, etc).
// Migration 0020 stores the value as a free-form text column; the
// renderer falls back to "below" for unknown values.
const TITLE_PLACEMENTS = [
  { id: "below", label: "below" },
  { id: "caption-bar", label: "caption bar" },
  { id: "stacked", label: "stacked" },
  { id: "corner", label: "on cover" },
  { id: "hover", label: "hover only" },
];

// "Card" shape for placements that draw a container around the
// label. `none` skips the container entirely (text-only). Other
// values map directly onto the title strip via Tailwind.
const TITLE_RADIUS_OPTIONS = [
  { id: "none", label: "none" },
  { id: "rounded-sm", label: "square" },
  { id: "rounded-md", label: "soft" },
  { id: "rounded-lg", label: "rounded" },
  { id: "rounded-xl", label: "pill" },
  { id: "rounded-full", label: "round" },
];

const TITLE_SIZE_OPTIONS = [
  { id: "sm", label: "small" },
  { id: "md", label: "medium" },
  { id: "lg", label: "large" },
];

// Discrete opacity levels — clicking is snappy (each step writes the
// album row once) where a continuous slider was firing dozens of
// commits mid-drag and feeling sluggish.
const TITLE_OPACITY_OPTIONS = [
  { id: "25", label: "25%" },
  { id: "50", label: "50%" },
  { id: "70", label: "70%" },
  { id: "85", label: "85%" },
  { id: "100", label: "solid" },
];

// Discrete opacity levels for the frame overlay — same pattern as
// the title opacity picker.
const FRAME_OPACITY_OPTIONS = [
  { id: "30", label: "30%" },
  { id: "50", label: "50%" },
  { id: "70", label: "70%" },
  { id: "85", label: "85%" },
  { id: "100", label: "solid" },
];

// Compact admin strip shown at the top of /photos/album/[slug] and
// /astronomy/album/[slug]. Actions for the current album: rename, hide,
// pick a cover, delete. Upload lives in the grid's pill which is
// context-aware and pre-selects the current album.
export function AlbumPageAdmin({
  album,
  parentHref,
  libraryKind,
  coverCandidates,
  allAlbums,
  onRename,
  onDelete,
  onSetCover,
  onSetHidden,
  onSetCoverCrop,
  onSetCoverHistory,
  onSetCoverDecorations,
  onSetCoverOverlays,
  onSetTitlePlacement,
  onSetTitleStyle,
  onSetAllTitle,
}: {
  album: Album;
  /** /photos or /astronomy — where to land after a successful delete. */
  parentHref: string;
  /** Which library this album belongs to (reserved for future
   *  per-library settings — history itself is per-album in the DB). */
  libraryKind: LibraryKind;
  /** Photos in this album the admin can pin as the cover. */
  coverCandidates: CoverCandidate[];
  /** All albums in this library, used by the cover uploader's
   *  "also save in album" selector. */
  allAlbums: Album[];
  onRename: (id: string, newName: string) => Promise<ActionResult>;
  onDelete: (id: string) => Promise<ActionResult>;
  onSetCover: (id: string, coverUrl: string | null) => Promise<ActionResult>;
  onSetHidden: (id: string, hidden: boolean) => Promise<ActionResult>;
  onSetCoverCrop: (
    id: string,
    crop: { x: number; y: number; w: number; h: number }
  ) => Promise<ActionResult>;
  onSetCoverHistory: (
    id: string,
    entries: CoverHistoryEntry[]
  ) => Promise<ActionResult>;
  onSetCoverDecorations: (
    id: string,
    patch: {
      frame?: string | null;
      filter?: string | null;
      frame_width?: string;
      frame_opacity?: number | null;
    }
  ) => Promise<ActionResult>;
  onSetCoverOverlays: (
    id: string,
    overlays: CoverOverlay[]
  ) => Promise<ActionResult>;
  onSetTitlePlacement: (
    id: string,
    placement: string
  ) => Promise<ActionResult>;
  onSetTitleStyle: (
    id: string,
    style: Record<string, unknown>
  ) => Promise<ActionResult>;
  onSetAllTitle: (
    placement: string | null,
    style: Record<string, unknown> | null
  ) => Promise<ActionResult>;
}) {
  // libraryKind isn't used directly here yet; kept on the signature
  // so callers don't have to thread it through later when we wire
  // per-library shape settings.
  void libraryKind;
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pickingCover, setPickingCover] = useState(false);
  const [draft, setDraft] = useState(album.name);
  const [urlDraft, setUrlDraft] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Recently-pinned covers for this album, persisted in the DB on
  // the album row so the list syncs across devices. Local state
  // mirrors album.cover_history; we update optimistically and let
  // router.refresh() reconcile after the server action returns.
  const [history, setHistory] = useState<CoverHistoryEntry[]>(
    album.cover_history
  );
  // Keep local state in sync if the prop changes (e.g., after a
  // router.refresh following an action on this device, or after a
  // server-data revalidation triggered from another).
  useEffect(() => {
    setHistory(album.cover_history);
  }, [album.cover_history]);

  // Persist a new history array to the server. Fire-and-forget from
  // the caller's POV — local state has already been updated
  // optimistically, and we just log the error in the shared error
  // strip if the write fails.
  function persistHistory(next: CoverHistoryEntry[]) {
    onSetCoverHistory(album.id, next).then((res) => {
      if (!res.ok) setError(res.error);
    });
  }

  // Local overlay state — initialized from the album row's
  // cover_overlays (normalized to drop malformed entries), updated
  // optimistically while admin drags / edits, and persisted via
  // onSetCoverOverlays. Re-syncs from the prop if the upstream
  // record changes (e.g., router.refresh after another action).
  const [overlays, setOverlays] = useState<CoverOverlay[]>(() =>
    normalizeOverlays(album.cover_overlays)
  );
  // Frame + filter picker is collapsed by default — admin usually
  // tunes it once and then moves on, so hiding it keeps the cover
  // panel compact for the more common overlay editing.
  const [decorOpen, setDecorOpen] = useState(false);
  // Title-style tuners (radius, size, opacity) live alongside the
  // title placement chip row. `applyToAll` controls whether changes
  // also broadcast to every other album in this library.
  const [titleStyle, setTitleStyle] = useState<TitleStyle>(() =>
    readTitleStyle(album.title_style)
  );
  useEffect(() => {
    setTitleStyle(readTitleStyle(album.title_style));
  }, [album.title_style]);
  const [applyToAll, setApplyToAll] = useState(false);
  useEffect(() => {
    setOverlays(normalizeOverlays(album.cover_overlays));
  }, [album.cover_overlays]);

  // Recent crops for the currently pinned URL — surfaced as
  // clickable presets next to the crop preview inside CoverCropper.
  const recentCrops = useMemo(() => {
    if (!album.cover_image_url) return [];
    const entry = history.find((e) => e.url === album.cover_image_url);
    return entry?.crops ?? [];
  }, [history, album.cover_image_url]);

  // Esc closes the preview overlay (matches photo lightbox UX).
  useEffect(() => {
    if (!previewUrl) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreviewUrl(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewUrl]);

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

  function pickCover(url: string | null) {
    setError(null);
    // Whether admin is pinning a *different* photo. Triggers an
    // overlay swap below: either restore the snapshot we saved with
    // the new URL's most-recent crop, or start fresh if there's no
    // prior history for that URL.
    const isNewCoverUrl =
      url !== null && url !== (album.cover_image_url ?? null);
    startTransition(async () => {
      try {
        const res = await onSetCover(album.id, url);
        if (!res.ok) {
          setError(res.error);
        } else {
          // Leave the picker open so admin can keep auditioning covers.
          // Clear the URL draft only when that's how it was set.
          if (url === null || url === urlDraft.trim()) setUrlDraft("");
          // Track successful pins on the album row so admin sees the
          // same recent list on every device. Skip the "clear cover"
          // case (url is null). Optimistic: update local + persist.
          if (url) {
            const next = pushUrl(history, url);
            setHistory(next);
            persistHistory(next);

            // If admin had previously cropped this same URL, restore
            // the most recent crop AND its overlay snapshot, so
            // switching back to a familiar cover brings back what
            // admin had on it. For a brand new URL with no prior
            // history, overlays start empty so they don't carry over
            // from the previous cover.
            const priorCrops = getCropsForUrl(next, url);
            if (priorCrops.length > 0) {
              const top = priorCrops[0];
              await onSetCoverCrop(album.id, {
                x: top.x,
                y: top.y,
                w: top.w,
                h: top.h,
              });
              if (isNewCoverUrl) {
                const snap = (top.overlays ?? []) as CoverOverlay[];
                const normalized = normalizeOverlays(snap);
                setOverlays(normalized);
                onSetCoverOverlays(album.id, normalized).then((r) => {
                  if (!r.ok) setError(r.error);
                });
              }
            } else if (isNewCoverUrl && overlays.length > 0) {
              setOverlays([]);
              onSetCoverOverlays(album.id, []).then((r) => {
                if (!r.ok) setError(r.error);
              });
            }
          }
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "couldn’t reach the server.");
      }
    });
  }

  function applyUrlCover() {
    const url = urlDraft.trim();
    if (!url) return;
    pickCover(url);
  }

  // Commit a crop from the CoverCropper; refresh so the card on the
  // /photos library page reflects the change without a full reload.
  // Also push the crop into local history so it surfaces as a recent
  // preset next time admin opens the cropper for this same URL.
  async function commitCrop(crop: {
    x: number;
    y: number;
    w: number;
    h: number;
  }): Promise<ActionResult> {
    setError(null);
    const res = await onSetCoverCrop(album.id, crop);
    if (res.ok) {
      if (album.cover_image_url) {
        // Snapshot the overlays that are currently applied alongside
        // the crop so re-pinning this crop later restores both.
        const next = pushCrop(
          history,
          album.cover_image_url,
          crop,
          overlays as unknown[]
        );
        if (next !== history) {
          setHistory(next);
          persistHistory(next);
        }
      }
      router.refresh();
      return { ok: true };
    }
    setError(res.error);
    return res;
  }

  function applyDecoration(patch: {
    frame?: string | null;
    filter?: string | null;
    frame_width?: string;
    frame_opacity?: number | null;
  }) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await onSetCoverDecorations(album.id, patch);
        if (!res.ok) setError(res.error);
        else router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "couldn’t reach the server.");
      }
    });
  }

  function applyTitlePlacement(placement: string) {
    setError(null);
    startTransition(async () => {
      try {
        const res = applyToAll
          ? await onSetAllTitle(placement, null)
          : await onSetTitlePlacement(album.id, placement);
        if (!res.ok) setError(res.error);
        else router.refresh();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "couldn’t reach the server."
        );
      }
    });
  }

  function commitTitleStyle(next: TitleStyle) {
    setTitleStyle(next);
    setError(null);
    startTransition(async () => {
      try {
        const res = applyToAll
          ? await onSetAllTitle(null, next as Record<string, unknown>)
          : await onSetTitleStyle(
              album.id,
              next as Record<string, unknown>
            );
        if (!res.ok) setError(res.error);
        else router.refresh();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "couldn’t reach the server."
        );
      }
    });
  }

  function toggleHidden() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await onSetHidden(album.id, !album.hidden);
        if (!res.ok) {
          setError(res.error);
        } else {
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "couldn’t reach the server.");
      }
    });
  }

  return (
    <section className="rounded-md bg-pink-50 border border-pink-100 p-3 md:p-4 flex flex-col gap-2 mt-3">
      <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3">
        <div className="flex items-center gap-2">
          <p className="label text-pink-600 shrink-0">admin · this album</p>
          {album.hidden ? (
            <span className="rounded-pill bg-pink-200 text-white px-2 py-0.5 text-[10px] font-semibold">
              hidden
            </span>
          ) : null}
        </div>
        {editing ? null : (
          // Keep the action buttons in their own flex group so they
          // wrap together (a single line, or all together onto a new
          // line) rather than scattering across rows on narrow widths.
          <div className="flex items-center flex-wrap gap-1.5">
            <AdminPill
              icon="✎"
              label="rename"
              onClick={() => setEditing(true)}
              disabled={pending || confirming || pickingCover}
            />
            <AdminPill
              icon="✦"
              label="cover"
              onClick={() => setPickingCover((v) => !v)}
              disabled={pending || confirming}
            />
            <AdminPill
              icon={album.hidden ? "◉" : "○"}
              label={album.hidden ? "unhide" : "hide"}
              onClick={toggleHidden}
              disabled={pending || confirming || pickingCover}
            />
            <AdminPill
              icon="✕"
              label="delete"
              danger
              onClick={() => setConfirming(true)}
              disabled={pending || confirming || pickingCover}
            />
          </div>
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

      {pickingCover ? (
        <div className="rounded-md bg-white border border-pink-200 px-3 py-4 md:py-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] text-pink-800 font-semibold">
              pick a cover for this album
            </p>
            <div className="flex items-center gap-2">
              {album.cover_image_url ? (
                <button
                  type="button"
                  onClick={() => pickCover(null)}
                  disabled={pending}
                  className="rounded-pill bg-white text-pink-800 border border-pink-200 hover:border-pink-400 px-2.5 py-0.5 text-[11px] font-semibold disabled:opacity-60"
                >
                  remove cover
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setPickingCover(false);
                  setUrlDraft("");
                }}
                disabled={pending}
                className="rounded-pill bg-white text-pink-800 border border-pink-200 px-2.5 py-0.5 text-[11px] font-semibold disabled:opacity-60"
              >
                close
              </button>
            </div>
          </div>

          {album.cover_image_url ? (
            <div className="flex flex-col gap-2 rounded-md bg-pink-50 border border-pink-100 p-2.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-[11px] text-pink-800 font-semibold">
                  current cover
                </p>
                <p className="text-[10px] text-ink/70 font-semibold">
                  {coverCandidates.some(
                    (c) => c.image_url === album.cover_image_url
                  )
                    ? "from this album"
                    : "from URL"}
                </p>
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() =>
                    album.cover_image_url &&
                    setPreviewUrl(album.cover_image_url)
                  }
                  className="rounded-pill bg-white hover:bg-white text-pink-800 border border-pink-200 px-2.5 py-0.5 text-[11px] font-semibold"
                  title="view larger"
                >
                  ⤢ view
                </button>
              </div>
              <p className="text-[10px] text-ink/55 font-mono truncate">
                {album.cover_image_url}
              </p>
              <CoverCropper
                imageUrl={album.cover_image_url}
                initialCrop={{
                  x: album.cover_crop_x,
                  y: album.cover_crop_y,
                  w: album.cover_crop_w,
                  h: album.cover_crop_h,
                }}
                recentCrops={recentCrops}
                frame={album.cover_frame}
                frameWidth={album.cover_frame_width}
                frameOpacity={album.cover_frame_opacity}
                filter={album.cover_filter}
                overlays={overlays}
                titlePlacement={album.title_placement}
                titleStyle={titleStyle}
                albumName={album.name}
                albumCount={coverCandidates.length}
                onCommit={commitCrop}
                onApplyRecent={(entry) => {
                  if (!album.cover_image_url) return;
                  // Snapshot the state we're leaving — the crop that
                  // was just on the album, plus whatever overlays are
                  // currently applied — so admin can rewind to it
                  // later. Without this step, overlays added after a
                  // crop commit get lost when admin switches crops.
                  const currentCrop = {
                    x: album.cover_crop_x,
                    y: album.cover_crop_y,
                    w: album.cover_crop_w,
                    h: album.cover_crop_h,
                  };
                  const saved = pushCrop(
                    history,
                    album.cover_image_url,
                    currentCrop,
                    overlays as unknown[]
                  );
                  if (saved !== history) {
                    setHistory(saved);
                    persistHistory(saved);
                  }
                  // Restore the overlays that were snapshot-ed with the
                  // recent crop, so re-pinning rewinds the full look
                  // (crop draft + overlays) in one click.
                  const snap = (entry.overlays ?? []) as CoverOverlay[];
                  const normalized = normalizeOverlays(snap);
                  setOverlays(normalized);
                  onSetCoverOverlays(album.id, normalized).then((r) => {
                    if (!r.ok) setError(r.error);
                  });
                }}
              />

              {/* Decorations — frame + filter chip rows. Collapsed
                  by default since admin typically picks one and moves
                  on. Header shows the current selection so admin can
                  tell at a glance what's applied without opening. */}
              <div className="flex flex-col gap-2 rounded-md bg-white border border-pink-100 p-2.5">
                <button
                  type="button"
                  onClick={() => setDecorOpen((v) => !v)}
                  className="flex items-center justify-between gap-2 text-left"
                  aria-expanded={decorOpen}
                >
                  <span className="text-[11px] text-pink-800 font-semibold">
                    ✦ frame + filter
                  </span>
                  <span className="flex items-center gap-1.5">
                    <DecorationSummary
                      frame={album.cover_frame}
                      filter={album.cover_filter}
                    />
                    <span
                      aria-hidden
                      className="text-[10px] text-pink-700 font-semibold w-3 text-center"
                    >
                      {decorOpen ? "▾" : "▸"}
                    </span>
                  </span>
                </button>
                {decorOpen ? (
                  <>
                    <DecorationRow
                      label="frame"
                      options={FRAMES.map((f) => ({ id: f.id, label: f.label }))}
                      currentId={album.cover_frame}
                      onPick={(id) => applyDecoration({ frame: id })}
                      disabled={pending}
                    />
                    <DecorationRow
                      label="filter"
                      options={FILTERS.map((f) => ({ id: f.id, label: f.label }))}
                      currentId={album.cover_filter}
                      onPick={(id) => applyDecoration({ filter: id })}
                      disabled={pending}
                    />
                    {/* Frame size only matters when a frame is set, but
                        showing it always lets admin pick the size first
                        if they want. NULL chip is hidden — width has a
                        sensible default (medium) and isn't nullable. */}
                    {album.cover_frame ? (
                      <SizeRow
                        label="size"
                        options={FRAME_SIZES}
                        currentId={album.cover_frame_width}
                        onPick={(id) =>
                          applyDecoration({ frame_width: id })
                        }
                        disabled={pending}
                      />
                    ) : null}
                    {album.cover_frame ? (
                      <SizeRow
                        label="frame α"
                        options={FRAME_OPACITY_OPTIONS}
                        currentId={String(
                          Math.round((album.cover_frame_opacity ?? 1) * 100)
                        )}
                        onPick={(id) =>
                          applyDecoration({
                            frame_opacity: parseInt(id, 10) / 100,
                          })
                        }
                        disabled={pending}
                      />
                    ) : null}
                    <SizeRow
                      label="title"
                      options={TITLE_PLACEMENTS}
                      currentId={album.title_placement}
                      onPick={applyTitlePlacement}
                      disabled={pending}
                    />
                    {/* Tuner visibility per placement:
                          shape   — only the stacked label (its
                                    container shape changes with the
                                    chosen radius)
                          size    — everywhere (scales padding +
                                    font on every variant)
                          opacity — placements that have a tinted bg
                                    (caption-bar, corner, hover) */}
                    {album.title_placement === "stacked" ? (
                      <SizeRow
                        label="shape"
                        options={TITLE_RADIUS_OPTIONS}
                        currentId={titleStyle.radius ?? "none"}
                        onPick={(id) =>
                          commitTitleStyle({ ...titleStyle, radius: id })
                        }
                        disabled={pending}
                      />
                    ) : null}
                    <SizeRow
                      label="size"
                      options={TITLE_SIZE_OPTIONS}
                      currentId={titleStyle.size ?? "md"}
                      onPick={(id) =>
                        commitTitleStyle({
                          ...titleStyle,
                          size: id as "sm" | "md" | "lg",
                        })
                      }
                      disabled={pending}
                    />
                    {album.title_placement === "caption-bar" ||
                    album.title_placement === "corner" ||
                    album.title_placement === "hover" ? (
                      <SizeRow
                        label="opacity"
                        options={TITLE_OPACITY_OPTIONS}
                        currentId={String(
                          Math.round((titleStyle.opacity ?? 0.85) * 100)
                        )}
                        onPick={(id) =>
                          commitTitleStyle({
                            ...titleStyle,
                            opacity: parseInt(id, 10) / 100,
                          })
                        }
                        disabled={pending}
                      />
                    ) : null}
                    <label className="flex items-center gap-2 text-[11px] mt-1">
                      <input
                        type="checkbox"
                        checked={applyToAll}
                        onChange={(e) => setApplyToAll(e.target.checked)}
                        className="accent-pink-400"
                      />
                      <span className="text-ink/70 font-semibold">
                        apply title changes to all albums in this library
                      </span>
                    </label>
                  </>
                ) : null}
              </div>

              {/* Overlay editor — stickers / captions / highlights.
                  Caller passes a background node so the editor can
                  paint overlays + drag handles on top without
                  re-knowing the cover URL + crop math. */}
              <OverlayEditor
                overlays={overlays}
                onChange={setOverlays}
                onCommit={(next) => {
                  // Mirror the overlay state into the current crop's
                  // history snapshot so admin's recent-crops list
                  // always shows the latest decorations alongside
                  // each crop. Skipped for trivial crops (pushCrop
                  // itself filters those — they're never listed as
                  // "recent").
                  if (album.cover_image_url) {
                    const currentCrop = {
                      x: album.cover_crop_x,
                      y: album.cover_crop_y,
                      w: album.cover_crop_w,
                      h: album.cover_crop_h,
                    };
                    const nextHistory = pushCrop(
                      history,
                      album.cover_image_url,
                      currentCrop,
                      next as unknown[]
                    );
                    if (nextHistory !== history) {
                      setHistory(nextHistory);
                      persistHistory(nextHistory);
                    }
                  }
                  return onSetCoverOverlays(album.id, next);
                }}
                stageInsetClass={frameInsetFor(
                  album.cover_frame,
                  album.cover_frame_width
                )}
                background={
                  <CoverPreviewBackground
                    imageUrl={album.cover_image_url}
                    crop={{
                      x: album.cover_crop_x,
                      y: album.cover_crop_y,
                      w: album.cover_crop_w,
                      h: album.cover_crop_h,
                    }}
                    frame={album.cover_frame}
                    frameWidth={album.cover_frame_width}
                    frameOpacity={album.cover_frame_opacity}
                    filter={album.cover_filter}
                  />
                }
              />
            </div>
          ) : null}

          {history.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] text-pink-800 font-semibold">
                recent · click to pin
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                {history.map((entry) => {
                  const selected = album.cover_image_url === entry.url;
                  return (
                    <div
                      key={entry.url}
                      className={
                        "relative aspect-square rounded-md overflow-hidden border-2 transition group " +
                        (selected
                          ? "border-pink-400 ring-2 ring-pink-200"
                          : "border-pink-100 hover:border-pink-300")
                      }
                    >
                      <button
                        type="button"
                        onClick={() => pickCover(entry.url)}
                        disabled={pending}
                        title={selected ? "current cover" : "pin again"}
                        className="absolute inset-0 disabled:opacity-60"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={entry.url}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = removeUrl(history, entry.url);
                          setHistory(next);
                          persistHistory(next);
                        }}
                        title="forget this URL"
                        aria-label="remove from recent"
                        // Hidden on mobile entirely so a fingertip
                        // near the thumbnail corner can't accidentally
                        // forget the entry; on desktop it stays
                        // hover-only.
                        className="hidden md:flex absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-white/90 hover:bg-white text-pink-700 border border-pink-200 items-center justify-center text-[9px] font-semibold leading-none opacity-0 group-hover:opacity-100 transition shadow-soft"
                      >
                        ✕
                      </button>
                      {selected ? (
                        <span className="absolute inset-x-0 bottom-0 bg-pink-400/85 text-white text-[9px] font-semibold leading-tight py-0.5 text-center pointer-events-none">
                          current
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {coverCandidates.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
              {coverCandidates.map((c) => {
                const selected = album.cover_image_url === c.image_url;
                return (
                  <div
                    key={c.id}
                    className={
                      "relative aspect-square rounded-md overflow-hidden border-2 transition " +
                      (selected
                        ? "border-pink-400 ring-2 ring-pink-200"
                        : "border-pink-100 hover:border-pink-300")
                    }
                  >
                    <button
                      type="button"
                      onClick={() => pickCover(c.image_url)}
                      disabled={pending}
                      className="absolute inset-0 disabled:opacity-60"
                      title={selected ? "current cover" : "use as cover"}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.image_url}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewUrl(c.image_url)}
                      className="absolute top-1 right-1 rounded-full bg-white/85 hover:bg-white text-pink-800 border border-pink-200 w-6 h-6 flex items-center justify-center text-[11px] font-semibold shadow-soft"
                      title="view larger"
                      aria-label="view larger"
                    >
                      ⤢
                    </button>
                    {selected ? (
                      <span className="absolute inset-x-0 bottom-0 bg-pink-400/85 text-white text-[9px] font-semibold leading-tight py-0.5 text-center pointer-events-none">
                        current
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-ink/70">
              no photos in this album yet — paste a URL below to pin one
              anyway.
            </p>
          )}

          <div className="flex items-stretch gap-2 flex-wrap">
            <input
              type="url"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="…or paste an image URL"
              className="bg-white border border-pink-200 rounded-pill px-3 py-1 text-[11px] flex-1 min-w-[180px] focus:outline-none focus:border-pink-400"
              onKeyDown={(e) => {
                if (e.key === "Enter") applyUrlCover();
              }}
            />
            <button
              type="button"
              onClick={applyUrlCover}
              disabled={pending || !urlDraft.trim()}
              className="rounded-pill bg-pink-200 text-white border border-pink-200 px-3 py-0.5 text-[11px] font-semibold disabled:opacity-60"
            >
              {pending ? "saving…" : "use URL"}
            </button>
          </div>

          {/* Cover-only upload. Photo albums only for now — astrophoto
              cover upload would need parallel server actions and isn't
              part of this iteration. */}
          {album.kind === "photos" ? (
            <CoverUploader
              currentAlbumId={album.id}
              allAlbums={allAlbums}
              onUploaded={(url) => pickCover(url)}
            />
          ) : null}
        </div>
      ) : null}

      {previewUrl && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] bg-skynavy-900/85 flex items-center justify-center p-4 cursor-zoom-out"
              onClick={() => setPreviewUrl(null)}
              role="dialog"
              aria-label="cover preview"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt=""
                className="max-w-full max-h-full object-contain rounded-md shadow-soft"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                onClick={() => setPreviewUrl(null)}
                className="absolute top-3 right-3 rounded-full bg-white/90 hover:bg-white text-pink-800 border border-pink-200 w-9 h-9 flex items-center justify-center text-sm font-semibold shadow-soft"
                aria-label="close preview"
              >
                ✕
              </button>
            </div>,
            document.body
          )
        : null}

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

// Small action pill shared by the admin action row. Icons live in a
// fixed-width slot so buttons line up even when the icon glyph widths
// differ (emoji vs. text symbols), and the label is wrapped in a
// flex item so wrapping behavior is predictable.
function AdminPill({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: string;
  label: string;
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
        "inline-flex items-center gap-1 rounded-pill bg-white text-pink-800 border border-pink-200 px-2.5 py-0.5 text-[11px] font-semibold disabled:opacity-60 " +
        (danger
          ? "hover:bg-pink-100 hover:border-pink-400"
          : "hover:border-pink-400")
      }
    >
      <span className="inline-flex w-3 justify-center text-pink-500">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

// One row of the decoration picker — a label + a wrap of chip
// buttons. Clicking a chip applies it; clicking the already-active
// chip clears the field (toggles off). `currentId === null` means
// "none" — none chip is rendered first.
function DecorationRow({
  label,
  options,
  currentId,
  onPick,
  disabled,
}: {
  label: string;
  options: { id: string; label: string }[];
  currentId: string | null;
  onPick: (id: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <p className="label text-pink-600 shrink-0 w-12">{label}</p>
      <button
        type="button"
        onClick={() => onPick(null)}
        disabled={disabled}
        className={
          "rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold transition disabled:opacity-60 " +
          (currentId === null
            ? "bg-pink-300 text-white border-pink-300"
            : "bg-white text-pink-800 border-pink-200 hover:border-pink-400")
        }
      >
        none
      </button>
      {options.map((opt) => {
        const selected = currentId === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onPick(selected ? null : opt.id)}
            disabled={disabled}
            className={
              "rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold transition disabled:opacity-60 " +
              (selected
                ? "bg-pink-300 text-white border-pink-300"
                : "bg-white text-pink-800 border-pink-200 hover:border-pink-400")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// One-line at-a-glance summary for the collapsed decoration header.
// Pulls the human label out of FRAMES / FILTERS so admin can see
// what's applied without expanding the picker.
function DecorationSummary({
  frame,
  filter,
}: {
  frame: string | null;
  filter: string | null;
}) {
  const frameLabel = frame
    ? FRAMES.find((f) => f.id === frame)?.label ?? frame
    : "none";
  const filterLabel = filter
    ? FILTERS.find((f) => f.id === filter)?.label ?? filter
    : "none";
  return (
    <span className="text-[10px] text-ink/65">
      {frameLabel} · {filterLabel}
    </span>
  );
}

// Composes the cover preview's background layer (cropped image +
// filter + frame) without overlays, for the OverlayEditor's stage.
// Mirrors the math used by AlbumCardGrid + CoverCropper preview so
// admin's editor matches what visitors will eventually see.
function CoverPreviewBackground({
  imageUrl,
  crop,
  frame,
  frameWidth,
  frameOpacity,
  filter,
}: {
  imageUrl: string | null;
  crop: { x: number; y: number; w: number; h: number };
  frame: string | null;
  frameWidth: string;
  frameOpacity: number | null;
  filter: string | null;
}) {
  const trivial =
    crop.x === 0 && crop.y === 0 && crop.w === 1 && crop.h === 1;
  const filterCss = filterCssFor(filter) || undefined;
  if (!imageUrl) {
    return (
      <div
        className="absolute inset-0 bg-gradient-to-br from-pink-50 to-lavender-100"
        aria-hidden
      />
    );
  }
  return (
    <>
      <div
        className={
          "absolute overflow-hidden " +
          (frameInsetFor(frame, frameWidth) || "inset-0")
        }
        style={
          trivial
            ? {
                backgroundImage: `url("${imageUrl}")`,
                backgroundRepeat: "no-repeat",
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: filterCss,
              }
            : {
                backgroundImage: `url("${imageUrl}")`,
                backgroundRepeat: "no-repeat",
                backgroundSize: `${100 / crop.w}% ${100 / crop.h}%`,
                backgroundPosition: `${
                  crop.w >= 1 ? 0 : (crop.x * 100) / (1 - crop.w)
                }% ${crop.h >= 1 ? 0 : (crop.y * 100) / (1 - crop.h)}%`,
                filter: filterCss,
              }
        }
        aria-hidden
      />
      {frame ? (
        <div
          className={
            "absolute inset-0 pointer-events-none " +
            frameOverlayFor(frame, frameWidth)
          }
          style={
            frameOpacity !== null && frameOpacity !== 1
              ? { opacity: frameOpacity }
              : undefined
          }
          aria-hidden
        />
      ) : null}
    </>
  );
}

// Variant of DecorationRow without the "none" chip — used for frame
// size, which has a sensible non-null default (medium).
function SizeRow({
  label,
  options,
  currentId,
  onPick,
  disabled,
}: {
  label: string;
  options: { id: string; label: string }[];
  currentId: string;
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <p className="label text-pink-600 shrink-0 w-12">{label}</p>
      {options.map((opt) => {
        const selected = currentId === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onPick(opt.id)}
            disabled={disabled}
            className={
              "rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold transition disabled:opacity-60 " +
              (selected
                ? "bg-pink-300 text-white border-pink-300"
                : "bg-white text-pink-800 border-pink-200 hover:border-pink-400")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
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
