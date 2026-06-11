"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Photo } from "@/lib/supabase/photos";

// Inlined to avoid pulling photos.ts's server-only imports into a
// client component. Same semantics as isTrivialPhotoCrop in the lib.
function isTrivialPhotoCrop(p: Photo): boolean {
  return (
    (p.crop_x ?? 0) === 0 &&
    (p.crop_y ?? 0) === 0 &&
    (p.crop_w ?? 1) === 1 &&
    (p.crop_h ?? 1) === 1
  );
}
import type { Album } from "@/lib/supabase/albums";
import {
  filterCssFor,
  frameInsetFor,
  frameOuterRadiusFor,
  frameOverlayFor,
  framePadFor,
  resolveDecoration,
} from "../components/cover-decorations";
import { Lightbox } from "./Lightbox";
import { PhotoEditModal } from "./PhotoEditModal";
import { OverlayLayer } from "../components/OverlayLayer";
import { normalizeOverlays } from "../components/cover-overlays";
import {
  togglePhotoHidden,
  rotatePhoto,
  deletePhoto,
  deletePhotos,
  setPhotosHidden,
  setPhotosAlbum,
  swapPhotoOrder,
  reorderPhotos,
  convertPhotoToAstrophoto,
} from "./admin-actions";

// Sort modes for the photo grid. Default "uploaded" preserves the
// pre-0027 ordering (most-recent upload first). "manual" sorts by
// sort_order, ascending — only meaningful once admin has nudged at
// least one photo via the ↑ / ↓ tile buttons.
type SortMode = "uploaded" | "taken" | "caption" | "manual";

// Short labels — the dropdown sits in the same admin toolbar as
// "+ upload" / ☐ select / show hidden. Long strings push the
// sort to a second row on narrow mobile widths.
const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: "uploaded", label: "uploaded" },
  { id: "taken", label: "taken" },
  { id: "caption", label: "caption" },
  { id: "manual", label: "manual" },
];

const SORT_STORAGE_KEY = "photo-grid-sort";

function readStoredSort(): SortMode {
  if (typeof window === "undefined") return "uploaded";
  const raw = window.localStorage.getItem(SORT_STORAGE_KEY);
  if (raw === "taken" || raw === "caption" || raw === "manual") return raw;
  return "uploaded";
}

function transformStyle(
  rotation: number | null | undefined,
  flipped: boolean | null | undefined
) {
  const parts: string[] = [];
  if (rotation) parts.push(`rotate(${rotation}deg)`);
  if (flipped) parts.push("scaleX(-1)");
  if (parts.length === 0) return undefined;
  return { transform: parts.join(" ") };
}

export function PhotoGrid({
  photos,
  isAdmin,
  albums = [],
  albumId,
}: {
  photos: Photo[];
  isAdmin: boolean;
  albums?: Album[];
  /** When set, the "+ upload" pill pre-selects this album so uploads
   *  from inside an album default to that album, not uncategorized. */
  albumId?: string;
}) {
  const router = useRouter();
  const [tag, setTag] = useState<string>("all");
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [editing, setEditing] = useState<Photo | null>(null);
  // Default-on when ?show=all is in the URL — used by the upload
  // editor's "view in album" deep link so admin lands on a page
  // already showing the photo they just uploaded (which may be
  // hidden). Admin can still toggle off via the show-hidden pill.
  const searchParams = useSearchParams();
  const wantsAllVisible = searchParams.get("show") === "all";
  const [showHidden, setShowHidden] = useState<boolean>(wantsAllVisible);
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  // Drag-and-drop reorder state — admin grabs a tile and drops it
  // anywhere in the grid (manual sort mode only). Ref instead of
  // state so we don't re-render the whole grid on each drag tick.
  const dragSrcId = useRef<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropAfter, setDropAfter] = useState(false);
  // Sort mode lives in localStorage so the choice persists across
  // page loads / tab switches. Default "uploaded" matches the
  // pre-0027 server-side order.
  const [sortMode, setSortMode] = useState<SortMode>("uploaded");
  useEffect(() => setSortMode(readStoredSort()), []);
  useEffect(() => {
    if (typeof window !== "undefined")
      window.localStorage.setItem(SORT_STORAGE_KEY, sortMode);
  }, [sortMode]);
  // Multi-select / mass-action state. When selectMode is on, photo
  // tiles render with a check overlay and clicking toggles selection
  // instead of opening the lightbox. The action bar at the bottom of
  // the page surfaces delete / hide / unhide / move-to-album wired
  // to the bulk server actions.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set()
  );
  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }
  // Esc cancels selection mode — matches the editor / lightbox UX.
  useEffect(() => {
    if (!selectMode) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") exitSelectMode();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectMode]);

  const visible = useMemo(
    () => (isAdmin && showHidden ? photos : photos.filter((p) => !p.hidden)),
    [photos, isAdmin, showHidden]
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    visible.forEach((p) => p.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [visible]);

  const tagFiltered = useMemo(
    () =>
      tag === "all" ? visible : visible.filter((p) => p.tags.includes(tag)),
    [visible, tag]
  );

  // Apply the chosen sort. Photos arrive from the server ordered by
  // created_at desc, so "uploaded" is a no-op; the other modes do a
  // client-side resort. Compares the relevant field with safe
  // fallbacks for nulls / missing values so a single bad row doesn't
  // collapse the order.
  const filtered = useMemo(() => {
    const list = [...tagFiltered];
    if (sortMode === "taken") {
      list.sort((a, b) => {
        const at = a.taken_at ? Date.parse(a.taken_at) : 0;
        const bt = b.taken_at ? Date.parse(b.taken_at) : 0;
        return bt - at; // newest first
      });
    } else if (sortMode === "caption") {
      list.sort((a, b) => {
        const ac = (a.caption ?? "").toLowerCase();
        const bc = (b.caption ?? "").toLowerCase();
        return ac < bc ? -1 : ac > bc ? 1 : 0;
      });
    } else if (sortMode === "manual") {
      list.sort((a, b) => {
        const av = a.sort_order ?? 0;
        const bv = b.sort_order ?? 0;
        if (av !== bv) return av - bv;
        // Tie-break by created_at desc so untouched rows keep their
        // upload-order until admin nudges them.
        return (
          (b.created_at ? Date.parse(b.created_at) : 0) -
          (a.created_at ? Date.parse(a.created_at) : 0)
        );
      });
    }
    return list;
  }, [tagFiltered, sortMode]);

  // Lookup map for resolving per-photo decoration fallback to the
  // photo's album. Computed once per `albums` change.
  const albumMap = useMemo(
    () => new Map(albums.map((a) => [a.id, a])),
    [albums]
  );

  const hiddenCount = useMemo(
    () => photos.filter((p) => p.hidden).length,
    [photos]
  );

  function chooseTag(next: string) {
    setTag(next);
    setOpenIdx(null);
  }

  function runAction(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      setActionError(null);
      const result = await fn();
      if (!result.ok) {
        setActionError(result.error ?? "Action failed.");
        return;
      }
      router.refresh();
    });
  }

  function onToggleHidden(photo: Photo) {
    runAction(() => togglePhotoHidden(photo.id, !photo.hidden));
  }

  function onRotateLeft(photo: Photo) {
    runAction(() => rotatePhoto(photo.id, "left"));
  }

  function onRotateRight(photo: Photo) {
    runAction(() => rotatePhoto(photo.id, "right"));
  }

  function onDelete(photo: Photo) {
    if (!confirm(`Delete this photo? "${photo.caption || "untitled"}"`)) return;
    runAction(() => deletePhoto(photo.id));
    if (openIdx !== null) setOpenIdx(null);
  }

  function onConvertToAstro(photo: Photo) {
    if (
      !confirm(
        `Move this photo into the astrophotos album? You'll be able to edit the object name + technical metadata afterward.`
      )
    )
      return;
    startTransition(async () => {
      setActionError(null);
      const result = await convertPhotoToAstrophoto(photo.id);
      if (!result.ok) {
        setActionError(result.error ?? "Convert failed.");
        return;
      }
      router.push("/astronomy");
    });
  }

  function onEdit(photo: Photo) {
    setEditing(photo);
  }

  return (
    <>
      {isAdmin ? (
        <div className="flex flex-wrap items-center gap-2 -mb-2">
          <Link
            href={
              albumId
                ? `/admin/photos/upload?album=${encodeURIComponent(albumId)}`
                : "/admin/photos/upload"
            }
            className="lift inline-flex items-center rounded-pill px-3.5 py-1.5 text-sm font-semibold bg-pink-200 text-white border border-pink-200 shadow-soft hover:border-pink-400"
          >
            + upload{albumId ? " here" : ""}
          </Link>
          <button
            type="button"
            onClick={() => {
              if (selectMode) exitSelectMode();
              else setSelectMode(true);
            }}
            aria-pressed={selectMode}
            className={
              "lift inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm font-semibold border " +
              (selectMode
                ? "bg-pink-300 text-white border-pink-300"
                : "bg-white text-pink-800 border-pink-100 hover:border-pink-200")
            }
          >
            {selectMode ? "✓ selecting" : "☐ select"}
            {selectedIds.size > 0 ? (
              <span className="text-[11px] bg-pink-100/80 text-pink-700 rounded-full px-1.5">
                {selectedIds.size}
              </span>
            ) : null}
          </button>
          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowHidden((v) => !v)}
              aria-pressed={showHidden}
              className={
                "lift inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm font-semibold border " +
                (showHidden
                  ? "bg-lavender-100 text-lavender-800 border-lavender-200"
                  : "bg-white text-lavender-600 border-pink-100 hover:border-pink-200")
              }
            >
              {showHidden ? "✓ showing hidden" : "show hidden"}
              <span className="text-[11px] bg-lavender-50 text-lavender-600 rounded-full px-1.5">
                {hiddenCount}
              </span>
            </button>
          ) : null}
          <label className="inline-flex items-center gap-1.5 text-[12px] text-pink-700 font-semibold">
            <span className="text-pink-600">sort</span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="bg-white border border-pink-200 rounded-pill px-2.5 py-1 text-[12px] font-semibold focus:outline-none focus:border-pink-400"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {actionError ? (
            <span className="text-xs text-pink-600 font-semibold">
              {actionError}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <FilterPill
          label="all"
          count={visible.length}
          active={tag === "all"}
          onClick={() => chooseTag("all")}
        />
        {allTags.map((t) => {
          const count = visible.filter((p) => p.tags.includes(t)).length;
          return (
            <FilterPill
              key={t}
              label={t}
              count={count}
              active={tag === t}
              onClick={() => chooseTag(t)}
            />
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-lavender-600 mt-6 text-center">
          ✿ no photos match this tag yet
        </p>
      ) : (
        <MasonryGrid
          photos={filtered}
          albumMap={albumMap}
          isAdmin={isAdmin}
          selectMode={selectMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelected}
          manualOrder={sortMode === "manual"}
          dropTargetId={dropTargetId}
          dropAfter={dropAfter}
          onMoveUp={(i) => {
            if (i <= 0) return;
            const a = filtered[i];
            const b = filtered[i - 1];
            runAction(() => swapPhotoOrder(a.id, b.id));
          }}
          onMoveDown={(i) => {
            if (i >= filtered.length - 1) return;
            const a = filtered[i];
            const b = filtered[i + 1];
            runAction(() => swapPhotoOrder(a.id, b.id));
          }}
          onDragStart={(id) => {
            dragSrcId.current = id;
            setDropTargetId(null);
          }}
          onDragOverTile={(id, after) => {
            if (!dragSrcId.current || dragSrcId.current === id) return;
            setDropTargetId(id);
            setDropAfter(after);
          }}
          onDragEnd={() => {
            dragSrcId.current = null;
            setDropTargetId(null);
          }}
          onDropOnTile={(id, after) => {
            const srcId = dragSrcId.current;
            dragSrcId.current = null;
            setDropTargetId(null);
            if (!srcId || srcId === id) return;
            // Compute new ordered ids: remove src from its current
            // position, then insert before or after the target.
            const remaining = filtered.filter((p) => p.id !== srcId);
            const targetIdx = remaining.findIndex((p) => p.id === id);
            if (targetIdx < 0) return;
            const insertAt = after ? targetIdx + 1 : targetIdx;
            const orderedIds = [
              ...remaining.slice(0, insertAt).map((p) => p.id),
              srcId,
              ...remaining.slice(insertAt).map((p) => p.id),
            ];
            runAction(() => reorderPhotos(orderedIds));
          }}
          onOpen={(i) => setOpenIdx(i)}
          onEdit={onEdit}
          onToggleHidden={onToggleHidden}
          onRotateLeft={onRotateLeft}
          onRotateRight={onRotateRight}
          onDelete={onDelete}
          busy={pending}
        />
      )}

      {selectMode && selectedIds.size > 0 ? (
        <SelectionBar
          selectedCount={selectedIds.size}
          albums={albums}
          busy={pending}
          allSelected={
            filtered.length > 0 &&
            filtered.every((p) => selectedIds.has(p.id))
          }
          onSelectAll={() => {
            // Toggle: if every visible photo is already selected,
            // deselect them; otherwise extend the selection to all
            // currently-visible photos. Keeps any already-selected
            // ids from a wider view in the not-all case.
            const allOn =
              filtered.length > 0 &&
              filtered.every((p) => selectedIds.has(p.id));
            if (allOn) {
              setSelectedIds((prev) => {
                const next = new Set(prev);
                for (const p of filtered) next.delete(p.id);
                return next;
              });
            } else {
              setSelectedIds(
                (prev) => new Set([...prev, ...filtered.map((p) => p.id)])
              );
            }
          }}
          onClear={exitSelectMode}
          onDelete={() => {
            if (
              !window.confirm(
                `Delete ${selectedIds.size} photo${
                  selectedIds.size === 1 ? "" : "s"
                }? This can't be undone.`
              )
            )
              return;
            const ids = Array.from(selectedIds);
            runAction(async () => {
              const r = await deletePhotos(ids);
              if (r.ok) exitSelectMode();
              return { ok: r.ok, error: r.error };
            });
          }}
          onHide={(hide) => {
            const ids = Array.from(selectedIds);
            runAction(async () => {
              const r = await setPhotosHidden(ids, hide);
              if (r.ok) exitSelectMode();
              return { ok: r.ok, error: r.error };
            });
          }}
          onMove={(targetAlbumId) => {
            const ids = Array.from(selectedIds);
            runAction(async () => {
              const r = await setPhotosAlbum(ids, targetAlbumId);
              if (r.ok) exitSelectMode();
              return { ok: r.ok, error: r.error };
            });
          }}
        />
      ) : null}

      {openIdx !== null ? (
        <Lightbox
          photos={filtered}
          albums={albums}
          index={openIdx}
          isAdmin={isAdmin}
          onClose={() => setOpenIdx(null)}
          onChange={setOpenIdx}
          onEdit={onEdit}
          onToggleHidden={onToggleHidden}
          onRotateLeft={onRotateLeft}
          onRotateRight={onRotateRight}
          onConvertToAstro={onConvertToAstro}
          onDelete={onDelete}
          busy={pending}
        />
      ) : null}

      {editing ? (
        <PhotoEditModal
          photo={editing}
          albums={albums}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

// Pick a column count from the current window width. Matches the
// Tailwind breakpoints we use elsewhere (sm = 640, lg = 1024).
function useColumnCount(): number {
  const [cols, setCols] = useState(() => {
    if (typeof window === "undefined") return 3;
    const w = window.innerWidth;
    return w >= 1024 ? 3 : w >= 640 ? 2 : 1;
  });
  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      const next = w >= 1024 ? 3 : w >= 640 ? 2 : 1;
      setCols((cur) => (cur === next ? cur : next));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return cols;
}

// Round-robin distribute photos across N flex-col columns. Avoids the
// CSS multi-column layout quirks that were hiding photos in columns
// 2/3 on PC. Column count adapts to viewport on resize; on mobile
// (1 column) every photo stacks in a single column.
function MasonryGrid({
  photos,
  albumMap,
  isAdmin,
  selectMode,
  selectedIds,
  onToggleSelect,
  manualOrder,
  dropTargetId,
  dropAfter,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOverTile,
  onDragEnd,
  onDropOnTile,
  onOpen,
  onEdit,
  onToggleHidden,
  onRotateLeft,
  onRotateRight,
  onDelete,
  busy,
}: {
  photos: Photo[];
  albumMap: Map<string, Album>;
  isAdmin: boolean;
  selectMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  manualOrder: boolean;
  dropTargetId: string | null;
  dropAfter: boolean;
  onMoveUp: (i: number) => void;
  onMoveDown: (i: number) => void;
  onDragStart: (id: string) => void;
  onDragOverTile: (id: string, after: boolean) => void;
  onDragEnd: () => void;
  onDropOnTile: (id: string, after: boolean) => void;
  onOpen: (i: number) => void;
  onEdit: (p: Photo) => void;
  onToggleHidden: (p: Photo) => void;
  onRotateLeft: (p: Photo) => void;
  onRotateRight: (p: Photo) => void;
  onDelete: (p: Photo) => void;
  busy: boolean;
}) {
  const cols = useColumnCount();
  const buckets = useMemo(() => {
    const out: { photo: Photo; globalIndex: number }[][] = Array.from(
      { length: cols },
      () => []
    );
    photos.forEach((photo, i) => {
      out[i % cols].push({ photo, globalIndex: i });
    });
    return out;
  }, [photos, cols]);

  return (
    <div
      className="grid gap-4 mt-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {buckets.map((bucket, ci) => (
        <div key={ci} className="flex flex-col gap-4 min-w-0">
          {bucket.map(({ photo, globalIndex }) => {
            const album = photo.album_id
              ? albumMap.get(photo.album_id) ?? null
              : null;
            const decor = resolveDecoration(photo, album);
            return (
              <PhotoTile
                key={photo.id}
                photo={photo}
                frame={decor.frame}
                frameWidth={decor.frameWidth}
                filter={decor.filter}
                isAdmin={isAdmin}
                selectMode={selectMode}
                selected={selectedIds.has(photo.id)}
                onToggleSelect={() => onToggleSelect(photo.id)}
                manualOrder={manualOrder}
                isFirst={globalIndex === 0}
                isLast={globalIndex === photos.length - 1}
                isDropTarget={dropTargetId === photo.id}
                dropAfter={dropAfter}
                onMoveUp={() => onMoveUp(globalIndex)}
                onMoveDown={() => onMoveDown(globalIndex)}
                onDragStart={() => onDragStart(photo.id)}
                onDragOverTile={(after) => onDragOverTile(photo.id, after)}
                onDragEnd={onDragEnd}
                onDropOnTile={(after) => onDropOnTile(photo.id, after)}
                eager={globalIndex < 6}
                onOpen={() => onOpen(globalIndex)}
                onEdit={() => onEdit(photo)}
                onToggleHidden={() => onToggleHidden(photo)}
                onRotateLeft={() => onRotateLeft(photo)}
                onRotateRight={() => onRotateRight(photo)}
                onDelete={() => onDelete(photo)}
                busy={busy}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function PhotoTile({
  photo,
  frame,
  frameWidth,
  filter,
  isAdmin,
  selectMode,
  selected,
  onToggleSelect,
  manualOrder,
  isFirst,
  isLast,
  isDropTarget,
  dropAfter,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOverTile,
  onDragEnd,
  onDropOnTile,
  eager,
  onOpen,
  onEdit,
  onToggleHidden,
  onRotateLeft,
  onRotateRight,
  onDelete,
  busy,
}: {
  photo: Photo;
  frame: string | null;
  frameWidth: string;
  filter: string | null;
  isAdmin: boolean;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  manualOrder: boolean;
  isFirst: boolean;
  isLast: boolean;
  isDropTarget: boolean;
  dropAfter: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
  onDragOverTile: (after: boolean) => void;
  onDragEnd: () => void;
  onDropOnTile: (after: boolean) => void;
  eager: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onToggleHidden: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const filterCss = filterCssFor(filter);
  const frameClass = frameOverlayFor(frame, frameWidth);
  // Solid frames paint their own outer outline + shape, so we drop
  // the wrapper's pink border + bg-pink-50 + small rounded-md and
  // adopt the frame's outer radius so the photo clips along the
  // frame's curve. Padding shrinks the photo so it fits inside the
  // frame's inner edge (rather than under the painted border) —
  // safe now because the bg is transparent for solid frames so the
  // padded area shows the frame's cream paint, not pink. Decorative
  // frames keep the original wrapper chrome with no padding so the
  // border sits decoratively on top of a full-size photo.
  const isSolidFrame = !!frameInsetFor(frame, frameWidth);
  const outerRadiusClass =
    frameOuterRadiusFor(frame, frameWidth) ||
    (isSolidFrame ? "" : "rounded-md");
  const padClass = isSolidFrame ? framePadFor(frame, frameWidth) : "";
  // Rotation handling. Photo + frame + overlays all rotate as one
  // composition, so the wrapper takes the post-rotation aspect and
  // the inner rotated container is sized to fill it after the
  // rotate transform fires.
  const r = ((photo.rotation ?? 0) + 360) % 360;
  const isRotated = r === 90 || r === 270;
  const haveDims =
    !!(photo.width && photo.height && photo.width > 0 && photo.height > 0);
  const cropW = haveDims
    ? (photo.width as number) * photo.crop_w
    : photo.crop_w;
  const cropH = haveDims
    ? (photo.height as number) * photo.crop_h
    : photo.crop_h;
  const cropRatio = cropH > 0 ? cropW / cropH : 1;
  const effectiveAspect = isRotated
    ? `${cropH} / ${cropW}`
    : `${cropW} / ${cropH}`;
  const rotationTransform = transformStyle(photo.rotation, photo.flipped)
    ?.transform;
  const containerStyle: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: isRotated ? `${cropRatio * 100}%` : "100%",
    height: isRotated ? `${(1 / cropRatio) * 100}%` : "100%",
    transform: `translate(-50%, -50%)${
      rotationTransform ? " " + rotationTransform : ""
    }`,
  };
  // Drag handlers — wired only in manual-sort mode for admin so the
  // ↑↓ chips and drag interactions land on the same code path.
  const draggable = isAdmin && manualOrder && !selectMode;
  return (
    <div
      className={
        "group block w-full mb-4 break-inside-avoid relative overflow-hidden lift " +
        outerRadiusClass +
        " " +
        padClass +
        " " +
        (isSolidFrame
          ? "shadow-soft "
          : "bg-pink-50 border shadow-soft ") +
        (photo.hidden
          ? isSolidFrame
            ? "ring-2 ring-lavender-100"
            : "border-lavender-200 ring-2 ring-lavender-100"
          : isSolidFrame
          ? ""
          : "border-pink-100 hover:border-pink-200") +
        (selected ? " outline outline-2 outline-pink-400 outline-offset-2" : "") +
        (draggable ? " cursor-grab active:cursor-grabbing" : "")
      }
      style={{ aspectRatio: effectiveAspect }}
      draggable={draggable}
      onDragStart={
        draggable
          ? (e) => {
              e.dataTransfer.effectAllowed = "move";
              // Required for Firefox to actually start the drag.
              e.dataTransfer.setData("text/plain", photo.id);
              onDragStart();
            }
          : undefined
      }
      onDragOver={
        draggable
          ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              const rect = (
                e.currentTarget as HTMLDivElement
              ).getBoundingClientRect();
              const after = e.clientY - rect.top > rect.height / 2;
              onDragOverTile(after);
            }
          : undefined
      }
      onDragEnd={draggable ? onDragEnd : undefined}
      onDrop={
        draggable
          ? (e) => {
              e.preventDefault();
              const rect = (
                e.currentTarget as HTMLDivElement
              ).getBoundingClientRect();
              const after = e.clientY - rect.top > rect.height / 2;
              onDropOnTile(after);
            }
          : undefined
      }
    >
      <div style={containerStyle}>
        <button
          type="button"
          onClick={selectMode ? onToggleSelect : onOpen}
          className="absolute inset-0 block w-full h-full text-left"
          aria-label={
            selectMode
              ? selected
                ? "deselect photo"
                : "select photo"
              : photo.caption || "open photo"
          }
        >
          {isTrivialPhotoCrop(photo) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.image_url}
              alt={photo.caption || ""}
              loading={eager ? "eager" : "lazy"}
              decoding="async"
              style={{ filter: filterCss || undefined }}
              className={
                "block w-full h-full object-cover transition-transform " +
                (photo.hidden ? "opacity-60" : "")
              }
            />
          ) : (
            <div className="relative w-full h-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.image_url}
                alt={photo.caption || ""}
                loading={eager ? "eager" : "lazy"}
                decoding="async"
                style={{
                  position: "absolute",
                  width: `${100 / photo.crop_w}%`,
                  height: "auto",
                  left: `${(-photo.crop_x / photo.crop_w) * 100}%`,
                  top: `${(-photo.crop_y / photo.crop_h) * 100}%`,
                  maxWidth: "none",
                  filter: filterCss || undefined,
                }}
                className={
                  "block transition-transform " +
                  (photo.hidden ? "opacity-60" : "")
                }
              />
            </div>
          )}
        </button>

        {/* Frame overlay — sits above the image, intercepts no clicks
            so the open-photo button below still receives them. */}
        {frameClass ? (
          <div
            className={"absolute inset-0 pointer-events-none " + frameClass}
            aria-hidden
          />
        ) : null}

        {/* Per-photo overlays (stickers / captions / drawings).
            Positioned to match the photo's inner area when a solid
            frame is applied — same insetClass pattern as album
            covers, so decorations stay anchored to the photo. */}
        <OverlayLayer
          overlays={normalizeOverlays(photo.cover_overlays)}
          className={photo.hidden ? "opacity-60" : ""}
          insetClass={frameInsetFor(frame, frameWidth)}
        />
      </div>

      {photo.hidden ? (
        <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wide font-bold rounded-pill bg-lavender-100 text-lavender-800 px-2 py-0.5 border border-lavender-200">
          hidden
        </span>
      ) : null}

      {/* Selection state — checkbox-style chip in the top-right
          corner when select mode is active. Pointer-events disabled
          so the click goes through to the photo wrapper (which
          handles toggle in select mode). */}
      {selectMode ? (
        <span
          className={
            "pointer-events-none absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[12px] font-bold shadow-soft " +
            (selected
              ? "bg-pink-300 text-white border-pink-300"
              : "bg-cream/90 text-pink-700 border-pink-300/70")
          }
          aria-hidden
        >
          {selected ? "✓" : ""}
        </span>
      ) : null}

      {photo.caption ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 px-3 py-2 bg-gradient-to-t from-skynavy-900/80 via-skynavy-900/40 to-transparent text-cream text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          {photo.caption}
        </span>
      ) : null}

      {/* Drop-target indicator — appears as a thick pink bar at
          the top or bottom edge to show where the dragged photo
          will land. */}
      {isDropTarget ? (
        <div
          className="pointer-events-none absolute left-0 right-0 h-1 bg-pink-400 z-10"
          style={dropAfter ? { bottom: 0 } : { top: 0 }}
          aria-hidden
        />
      ) : null}

      {/* Manual-sort ↑↓ chips — only shown when admin picked the
          "manual order" sort, since these only edit sort_order
          (irrelevant in other modes). Sit at the bottom-left so
          they don't clash with the admin action cluster top-right. */}
      {isAdmin && manualOrder && !selectMode ? (
        <div className="absolute bottom-2 left-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <IconBtn
            label="move earlier"
            onClick={onMoveUp}
            disabled={busy || isFirst}
          >
            ↑
          </IconBtn>
          <IconBtn
            label="move later"
            onClick={onMoveDown}
            disabled={busy || isLast}
          >
            ↓
          </IconBtn>
        </div>
      ) : null}

      {isAdmin ? (
        <div className="absolute top-2 right-2 flex flex-wrap items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <IconBtn label="rotate left" onClick={onRotateLeft} disabled={busy}>
            ↶
          </IconBtn>
          <IconBtn label="rotate right" onClick={onRotateRight} disabled={busy}>
            ↷
          </IconBtn>
          <IconBtn label="edit" onClick={onEdit} disabled={busy}>
            ✎
          </IconBtn>
          <IconBtn
            label={photo.hidden ? "show" : "hide"}
            onClick={onToggleHidden}
            disabled={busy}
          >
            {photo.hidden ? "○" : "◐"}
          </IconBtn>
          <IconBtn label="delete" onClick={onDelete} disabled={busy} danger>
            ✕
          </IconBtn>
        </div>
      ) : null}
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
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
      aria-label={label}
      title={label}
      className={
        "w-7 h-7 rounded-full text-sm font-semibold backdrop-blur bg-cream/85 border shadow-soft hover:bg-cream flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-wait " +
        (danger
          ? "text-pink-800 border-pink-200 hover:border-pink-400"
          : "text-pink-700 border-pink-100 hover:border-pink-200")
      }
    >
      {children}
    </button>
  );
}

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "lift inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-sm font-semibold border transition-colors " +
        (active
          ? "bg-pink-200 text-white border-pink-200 shadow-soft"
          : "bg-white text-pink-800 border-pink-100 hover:border-pink-200")
      }
    >
      {label}
      <span
        className={
          "text-[11px] font-semibold rounded-full px-1.5 " +
          (active ? "bg-white/20 text-white" : "bg-pink-50 text-pink-600")
        }
      >
        {count}
      </span>
    </button>
  );
}

// Sticky mass-action bar shown when admin has selected one or more
// photos. Hosts delete / hide / unhide / move-to-album / select-all
// / clear, plus a count of how many photos are currently selected.
function SelectionBar({
  selectedCount,
  albums,
  busy,
  allSelected,
  onSelectAll,
  onClear,
  onDelete,
  onHide,
  onMove,
}: {
  selectedCount: number;
  albums: Album[];
  busy: boolean;
  allSelected: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onDelete: () => void;
  onHide: (hide: boolean) => void;
  onMove: (albumId: string | null) => void;
}) {
  const [moveOpen, setMoveOpen] = useState(false);
  return (
    <div className="fixed inset-x-0 bottom-3 z-[90] flex justify-center px-3 pointer-events-none">
      <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-pill bg-skynavy-900/90 text-cream border border-cream/30 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-sm px-3 py-2 max-w-full">
        <span className="text-[12px] font-semibold pr-1">
          {selectedCount} selected
        </span>
        <BarBtn
          onClick={onSelectAll}
          disabled={busy}
          active={allSelected}
        >
          {allSelected ? "deselect all" : "select all"}
        </BarBtn>
        <BarBtn onClick={() => onHide(true)} disabled={busy}>
          ◐ hide
        </BarBtn>
        <BarBtn onClick={() => onHide(false)} disabled={busy}>
          ○ unhide
        </BarBtn>
        <div className="relative">
          <BarBtn
            onClick={() => setMoveOpen((v) => !v)}
            disabled={busy}
            active={moveOpen}
          >
            ✿ move to…
          </BarBtn>
          {moveOpen ? (
            <div className="absolute bottom-full mb-2 right-0 min-w-[180px] max-h-[240px] overflow-y-auto rounded-md bg-white text-pink-800 border border-pink-200 shadow-soft py-1">
              <button
                type="button"
                onClick={() => {
                  setMoveOpen(false);
                  onMove(null);
                }}
                disabled={busy}
                className="block w-full text-left px-3 py-1.5 text-[12px] font-semibold hover:bg-pink-50 disabled:opacity-60"
              >
                — uncategorized —
              </button>
              {albums.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setMoveOpen(false);
                    onMove(a.id);
                  }}
                  disabled={busy}
                  className="block w-full text-left px-3 py-1.5 text-[12px] font-semibold hover:bg-pink-50 disabled:opacity-60"
                >
                  {a.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <BarBtn onClick={onDelete} disabled={busy} danger>
          ✕ delete
        </BarBtn>
        <BarBtn onClick={onClear} disabled={busy}>
          done
        </BarBtn>
      </div>
    </div>
  );
}

function BarBtn({
  children,
  onClick,
  disabled,
  active,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "rounded-pill border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50 " +
        (active
          ? "bg-cream/30 text-cream border-cream/40"
          : danger
          ? "bg-pink-400/20 text-pink-100 border-pink-300/50 hover:bg-pink-400/40 hover:text-white"
          : "bg-cream/10 text-cream border-cream/30 hover:bg-cream/20")
      }
    >
      {children}
    </button>
  );
}
