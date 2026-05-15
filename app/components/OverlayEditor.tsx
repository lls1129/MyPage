"use client";

import { useEffect, useRef, useState } from "react";
import {
  DIAMOND_PATH,
  HEART_PATH,
  newOverlayId,
  normalizeOverlays,
  OVERLAY_LIMIT,
  OVERLAY_SHAPE_CLASSES,
  OVERLAY_SHAPE_SVG,
  OVERLAY_TEXT_CLASSES,
  STAR_PATH,
  STICKER_QUICK_PICKS,
  strokePointsToPath,
  type CoverOverlay,
  type HighlightShape,
  type OverlayColor,
  type StrokeSegment,
} from "./cover-overlays";

type ActionResult = { ok: true } | { ok: false; error: string };

const COLOR_OPTIONS: { id: OverlayColor; label: string }[] = [
  { id: "white", label: "white" },
  { id: "cream", label: "cream" },
  { id: "pink", label: "pink" },
  { id: "lavender", label: "lavender" },
  { id: "amber", label: "amber" },
  { id: "skynavy", label: "navy" },
  { id: "ink", label: "ink" },
];

// Drag state stored in a ref so the pointer handlers always see
// the latest values (useState would be too laggy on touch).
type DragState = {
  id: string;
  startPointerX: number;
  startPointerY: number;
  startX: number;
  startY: number;
};

export function OverlayEditor({
  overlays,
  onChange,
  onCommit,
  /** Preview tile contents — caller renders the cover image / frame
   *  / filter so this editor can draw the overlays + drag handles
   *  on top without knowing about decorations. */
  background,
  /** Positioning classes for the interactive stage. Caller passes
   *  the photo's frame inset so the editable overlays + drag math
   *  use the photo's inner area as their coordinate frame, keeping
   *  stickers anchored to the photo when admin switches frames. */
  stageInsetClass,
}: {
  overlays: CoverOverlay[];
  /** Local-state update (optimistic). Called for every drag tick. */
  onChange: (next: CoverOverlay[]) => void;
  /** Persisted save. Called on drag-end and on add/remove/style
   *  changes. The editor passes the same array onChange already
   *  reflected so server and local state stay in sync. */
  onCommit: (next: CoverOverlay[]) => Promise<ActionResult>;
  background: React.ReactNode;
  stageInsetClass?: string;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const rotateRef = useRef<{ id: string } | null>(null);
  /** Stroke-in-progress while in draw mode. The drawing overlay is
   *  appended to the array on pointerdown and updated in place on
   *  every pointermove sample. */
  const drawRef = useRef<{ id: string } | null>(null);
  /** ID of the stroke overlay that's accumulating segments during
   *  the current draw session — one entry into draw mode, no
   *  color / width changes since. Subsequent strokes append a new
   *  segment to this overlay rather than creating a new layer.
   *  Null between sessions. */
  const drawSessionRef = useRef<{ id: string } | null>(null);
  /** Snapshot of overlays at the start of a drag / rotate / draw
   *  gesture, used so undo can restore the pre-gesture state in
   *  one click instead of replaying each pointermove sample. */
  const historyBookmark = useRef<CoverOverlay[] | null>(null);
  // Editor starts collapsed — the album page already shows the
  // small cover preview in the cropper, and admin only opens the
  // overlay editor when they want to add / move decorations.
  const [open, setOpen] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [eraserMode, setEraserMode] = useState(false);
  const [drawColor, setDrawColor] = useState<OverlayColor>("pink");
  const [drawWidth, setDrawWidth] = useState(0.015); // ~1.5% of stage width
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savingErr, setSavingErr] = useState<string | null>(null);
  // Auto-save status: "saved" by default, "unsaved" between an
  // optimistic onChange and the actual commit (during a drag),
  // "saving" while the server action is in flight, "error" if it
  // failed (savingErr holds the message).
  type SaveStatus = "saved" | "unsaved" | "saving" | "error";
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  // Undo / redo stacks. Each entry is the overlays snapshot from
  // immediately before a discrete change (add / delete / style edit
  // / drag-end / etc.). Capped at 40 entries so a long session
  // can't bloat memory.
  const [history, setHistory] = useState<CoverOverlay[][]>([]);
  const [future, setFuture] = useState<CoverOverlay[][]>([]);
  const HISTORY_CAP = 40;

  // Add-overlay popovers (one open at a time). Keeps the picker
  // compact when collapsed.
  const [activeAdder, setActiveAdder] = useState<
    "sticker" | "caption" | "highlight" | null
  >(null);
  const [stickerInput, setStickerInput] = useState("");
  const [captionInput, setCaptionInput] = useState("");

  useEffect(() => {
    // Clear selection if the overlay it points to no longer exists.
    if (selectedId && !overlays.some((o) => o.id === selectedId)) {
      setSelectedId(null);
    }
  }, [overlays, selectedId]);

  // Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z (or Cmd/Ctrl+Y) = redo.
  // Only fires when the stage or its descendants have focus so
  // these shortcuts don't fight with the rest of the page.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!stageRef.current) return;
      // Ignore when focus is in an input / contentEditable — admin
      // is probably typing a caption.
      const active = document.activeElement as HTMLElement | null;
      if (active) {
        const tag = active.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          active.isContentEditable
        )
          return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.length, future.length, overlays]);

  // commit() — fire the actual server save + drive the status
  // indicator. Doesn't touch history (caller decides whether to
  // push a snapshot first).
  function commit(next: CoverOverlay[]) {
    onChange(next);
    setSavingErr(null);
    setSaveStatus("saving");
    onCommit(next).then((res) => {
      if (!res.ok) {
        setSavingErr(res.error);
        setSaveStatus("error");
      } else {
        setSaveStatus("saved");
      }
    });
  }

  // modify() — discrete user change. Pushes the current state to
  // history so undo can roll back, clears the redo stack (since we
  // just branched the timeline), then commits.
  function modify(next: CoverOverlay[]) {
    setHistory((h) => {
      const trimmed = h.length >= HISTORY_CAP ? h.slice(1) : h;
      return [...trimmed, overlays];
    });
    setFuture([]);
    commit(next);
  }

  // Convenience for drag/rotate/draw: while the gesture is in
  // flight we want optimistic-only updates (no history, no
  // commit). The bookmark captured at gesture start gives undo a
  // single-step rollback to the pre-gesture state.
  function bookmark() {
    historyBookmark.current = overlays;
  }
  function commitWithBookmark(next: CoverOverlay[]) {
    if (historyBookmark.current) {
      const snap = historyBookmark.current;
      setHistory((h) => {
        const trimmed = h.length >= HISTORY_CAP ? h.slice(1) : h;
        return [...trimmed, snap];
      });
      setFuture([]);
      historyBookmark.current = null;
    }
    commit(next);
  }

  function undo() {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setFuture((f) => {
        const trimmed = f.length >= HISTORY_CAP ? f.slice(0, -1) : f;
        return [overlays, ...trimmed];
      });
      commit(prev);
      return h.slice(0, -1);
    });
  }

  function redo() {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setHistory((h) => {
        const trimmed = h.length >= HISTORY_CAP ? h.slice(1) : h;
        return [...trimmed, overlays];
      });
      commit(next);
      return f.slice(1);
    });
  }

  function updateOverlay(id: string, patch: Partial<CoverOverlay>) {
    const next = overlays.map((o) =>
      o.id === id ? ({ ...o, ...patch } as CoverOverlay) : o
    );
    modify(next);
  }

  function removeOverlay(id: string) {
    modify(overlays.filter((o) => o.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function addSticker(emoji: string) {
    if (overlays.length >= OVERLAY_LIMIT) return;
    const next: CoverOverlay[] = [
      ...overlays,
      {
        id: newOverlayId(),
        type: "sticker",
        emoji,
        x: 0.5,
        y: 0.5,
        scale: 1,
        rotation: 0,
      },
    ];
    modify(next);
    setSelectedId(next[next.length - 1].id);
    setActiveAdder(null);
    setStickerInput("");
  }

  function addCaption(text: string) {
    if (!text.trim() || overlays.length >= OVERLAY_LIMIT) return;
    const next: CoverOverlay[] = [
      ...overlays,
      {
        id: newOverlayId(),
        type: "caption",
        text: text.trim(),
        color: "cream",
        x: 0.5,
        y: 0.5,
        scale: 1,
        rotation: 0,
      },
    ];
    modify(next);
    setSelectedId(next[next.length - 1].id);
    setActiveAdder(null);
    setCaptionInput("");
  }

  function addHighlight(shape: HighlightShape) {
    if (overlays.length >= OVERLAY_LIMIT) return;
    const next: CoverOverlay[] = [
      ...overlays,
      {
        id: newOverlayId(),
        type: "highlight",
        shape,
        color: "pink",
        width: 0.4,
        height: 0.4,
        x: 0.5,
        y: 0.5,
        scale: 1,
        rotation: 0,
      },
    ];
    modify(next);
    setSelectedId(next[next.length - 1].id);
    setActiveAdder(null);
  }

  function startDrag(e: React.PointerEvent, overlay: CoverOverlay) {
    // Eraser mode: tap-to-delete instead of starting a drag.
    if (eraserMode) {
      e.preventDefault();
      e.stopPropagation();
      removeOverlay(overlay.id);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setSelectedId(overlay.id);
    bookmark();
    dragRef.current = {
      id: overlay.id,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startX: overlay.x,
      startY: overlay.y,
    };
  }

  function moveDrag(e: React.PointerEvent) {
    const d = dragRef.current;
    const stage = stageRef.current;
    if (!d || !stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dx = (e.clientX - d.startPointerX) / rect.width;
    const dy = (e.clientY - d.startPointerY) / rect.height;
    const nx = Math.max(0, Math.min(1, d.startX + dx));
    const ny = Math.max(0, Math.min(1, d.startY + dy));
    const next = overlays.map((o) =>
      o.id === d.id ? ({ ...o, x: nx, y: ny } as CoverOverlay) : o
    );
    // Optimistic only — commit happens on pointer release so we
    // don't fire dozens of server actions during a single drag.
    onChange(next);
    setSaveStatus("unsaved");
  }

  function endDrag(e: React.PointerEvent) {
    if (!dragRef.current) return;
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    dragRef.current = null;
    // Persist whatever the latest local state is.
    commitWithBookmark(overlays);
  }

  // Rotation drag — pulls the handle around the overlay's center
  // and sets rotation to the angle of (pointer → center). Direct
  // assignment (not delta) so the handle always "follows the
  // finger" the way most editors do.
  function startRotate(e: React.PointerEvent, overlay: CoverOverlay) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setSelectedId(overlay.id);
    bookmark();
    rotateRef.current = { id: overlay.id };
    applyRotationFromPointer(e, overlay.id);
  }

  function moveRotate(e: React.PointerEvent) {
    const r = rotateRef.current;
    if (!r) return;
    applyRotationFromPointer(e, r.id);
  }

  function endRotate(e: React.PointerEvent) {
    if (!rotateRef.current) return;
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    rotateRef.current = null;
    commitWithBookmark(overlays);
  }

  // Drawing — start, sample, finish a stroke. Points are stored
  // in normalized stage coords (0..1). Sampling skips moves that
  // are smaller than 0.5% of the stage's smaller dimension to
  // keep paths from being absurdly dense.
  function pointerToStageFraction(
    e: React.PointerEvent
  ): { x: number; y: number } | null {
    const stage = stageRef.current;
    if (!stage) return null;
    const rect = stage.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }

  function startDraw(e: React.PointerEvent) {
    const p = pointerToStageFraction(e);
    if (!p) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    bookmark();
    // While a draw session is active, every new stroke appends a
    // segment to the same overlay — regardless of whether the
    // admin changed color or brush width mid-session, since each
    // segment carries its own style now. The session ends only
    // when admin toggles draw off or switches tools (handled by
    // endDrawSession in the pill onClicks).
    const existing = drawSessionRef.current
      ? overlays.find((o) => o.id === drawSessionRef.current!.id)
      : null;
    const newSeg: StrokeSegment = {
      points: [[p.x, p.y]],
      color: drawColor,
      width: drawWidth,
    };
    if (existing && existing.type === "stroke") {
      const id = existing.id;
      drawRef.current = { id };
      const next = overlays.map((o) =>
        o.id === id && o.type === "stroke"
          ? { ...o, segments: [...o.segments, newSeg] }
          : o
      );
      onChange(next);
    } else {
      // Cap only blocks brand-new layers — additional segments
      // appended to the active session never push the count.
      if (overlays.length >= OVERLAY_LIMIT) return;
      const id = newOverlayId();
      drawRef.current = { id };
      drawSessionRef.current = { id };
      const stroke: CoverOverlay = {
        id,
        type: "stroke",
        x: 0.5,
        y: 0.5,
        scale: 1,
        rotation: 0,
        segments: [newSeg],
      };
      onChange([...overlays, stroke]);
    }
    setSaveStatus("unsaved");
  }

  function moveDraw(e: React.PointerEvent) {
    const d = drawRef.current;
    if (!d) return;
    const p = pointerToStageFraction(e);
    if (!p) return;
    const cur = overlays.find((o) => o.id === d.id);
    if (!cur || cur.type !== "stroke") return;
    const lastSeg = cur.segments[cur.segments.length - 1];
    if (!lastSeg || lastSeg.points.length === 0) return;
    const last = lastSeg.points[lastSeg.points.length - 1];
    const dx = p.x - last[0];
    const dy = p.y - last[1];
    if (dx * dx + dy * dy < 0.000025) return; // 0.5% threshold
    const next = overlays.map((o) => {
      if (o.id !== d.id || o.type !== "stroke") return o;
      const segments = o.segments.map((s, i) =>
        i === o.segments.length - 1
          ? { ...s, points: [...s.points, [p.x, p.y]] as [number, number][] }
          : s
      );
      return { ...o, segments };
    });
    onChange(next);
    setSaveStatus("unsaved");
  }

  function endDraw(e: React.PointerEvent) {
    const d = drawRef.current;
    if (!d) return;
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    drawRef.current = null;
    // If the just-ended segment is degenerate (no real movement),
    // strip it before persisting. If that leaves the stroke
    // overlay with zero segments, drop the overlay entirely.
    const stroke = overlays.find((o) => o.id === d.id);
    if (stroke && stroke.type === "stroke") {
      const lastSeg = stroke.segments[stroke.segments.length - 1];
      const lastOk = lastSeg ? lastSeg.points.length >= 2 : false;
      if (!lastOk) {
        const trimmed = stroke.segments.slice(0, -1);
        if (trimmed.length === 0) {
          // Whole layer is empty — discard. If this was a brand
          // new session (started by this stroke), clear the
          // session ref too so the next stroke starts fresh.
          historyBookmark.current = null;
          if (drawSessionRef.current?.id === d.id) {
            drawSessionRef.current = null;
          }
          const next = overlays.filter((o) => o.id !== d.id);
          onChange(next);
          setSaveStatus("saved");
          return;
        }
        const next = overlays.map((o) =>
          o.id === d.id && o.type === "stroke"
            ? { ...o, segments: trimmed }
            : o
        );
        commitWithBookmark(next);
        return;
      }
    }
    commitWithBookmark(overlays);
  }

  // End the active drawing session — next pointer-down in draw
  // mode will create a fresh layer. Called when admin exits draw
  // mode or changes color / brush width.
  function endDrawSession() {
    drawSessionRef.current = null;
  }

  function applyRotationFromPointer(e: React.PointerEvent, id: string) {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const overlay = overlays.find((o) => o.id === id);
    if (!overlay) return;
    const cx = rect.left + overlay.x * rect.width;
    const cy = rect.top + overlay.y * rect.height;
    // Angle from center to pointer. +90 so that "directly above"
    // maps to 0° (matching how CSS rotates 0° = identity, with
    // the handle painted above the overlay at 0°).
    const rawDeg =
      (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
    // Normalize to (-180, 180].
    let rotation = rawDeg;
    while (rotation > 180) rotation -= 360;
    while (rotation <= -180) rotation += 360;
    const next = overlays.map((o) =>
      o.id === id ? ({ ...o, rotation } as CoverOverlay) : o
    );
    onChange(next);
    setSaveStatus("unsaved");
  }

  const selected = overlays.find((o) => o.id === selectedId) ?? null;

  if (!open) {
    // Collapsed header — admin opens the editor only when they need
    // to add / reposition overlays, so the album page stays compact
    // by default. Count + a small preview of the layer types lives
    // here so admin can see at a glance what's applied.
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-between gap-2 rounded-md bg-white border border-pink-100 px-3 py-2 text-left hover:border-pink-300 transition-colors"
        aria-expanded={false}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] text-pink-800 font-semibold shrink-0">
            ✿ overlays
          </span>
          <span className="text-[10px] text-ink/65 truncate">
            {overlays.length === 0
              ? "none yet · tap to add"
              : `${overlays.length} of ${OVERLAY_LIMIT} · tap to edit`}
          </span>
        </span>
        <span
          aria-hidden
          className="text-[10px] text-pink-700 font-semibold w-3 text-center shrink-0"
        >
          ▸
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-white border border-pink-100 p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              endDrawSession();
              setDrawMode(false);
              setEraserMode(false);
              setActiveAdder(null);
              setOpen(false);
            }}
            className="text-[11px] text-pink-800 font-semibold inline-flex items-center gap-1 hover:text-pink-600"
            title="collapse"
            aria-expanded={true}
          >
            <span aria-hidden>▾</span>
            <span>✿ overlays</span>
          </button>
          <p className="text-[10px] text-ink/65">
            {overlays.length} of {OVERLAY_LIMIT} · drag to reposition
          </p>
          <SaveStatusPill status={saveStatus} />
          {/* Clear-all pill shares the status row so the row doesn't
              wrap to just the status pill on mobile. Only rendered
              when there's something to clear. */}
          {overlays.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                endDrawSession();
                setDrawMode(false);
                setEraserMode(false);
                setActiveAdder(null);
                modify([]);
              }}
              title="remove every overlay"
              className="inline-flex items-center rounded-pill border border-pink-200 bg-white text-pink-700 hover:border-pink-400 px-2 py-0.5 text-[10px] font-semibold"
            >
              ✕ clear all
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <UndoRedoPill
            glyph="↶"
            label="undo"
            title="undo last change"
            disabled={history.length === 0}
            onClick={undo}
          />
          <UndoRedoPill
            glyph="↷"
            label="redo"
            title="redo"
            disabled={future.length === 0}
            onClick={redo}
          />
          <AdderPill
            label="+ sticker"
            active={activeAdder === "sticker"}
            disabled={overlays.length >= OVERLAY_LIMIT || drawMode || eraserMode}
            onClick={() => {
              endDrawSession();
              setDrawMode(false);
              setEraserMode(false);
              setActiveAdder((a) => (a === "sticker" ? null : "sticker"));
            }}
          />
          <AdderPill
            label="+ caption"
            active={activeAdder === "caption"}
            disabled={overlays.length >= OVERLAY_LIMIT || drawMode || eraserMode}
            onClick={() => {
              endDrawSession();
              setDrawMode(false);
              setEraserMode(false);
              setActiveAdder((a) => (a === "caption" ? null : "caption"));
            }}
          />
          <AdderPill
            label="+ highlight"
            active={activeAdder === "highlight"}
            disabled={overlays.length >= OVERLAY_LIMIT || drawMode || eraserMode}
            onClick={() => {
              endDrawSession();
              setDrawMode(false);
              setEraserMode(false);
              setActiveAdder((a) =>
                a === "highlight" ? null : "highlight"
              );
            }}
          />
          {/* Draw + eraser modes are mutually exclusive with the
              adder popovers — toggling either closes them and
              swaps the stage into the right capture mode. The
              draw / drawing labels share a min-width so toggling
              doesn't shift the row layout on mobile. */}
          {/* Label always reads "draw" / "erase" so the glyph
              width doesn't change between states — the active /
              inactive distinction is carried entirely by the
              pink fill on `active=true`. Avoids the ✓-vs-✎
              width swap that was reflowing the toolbar on iOS
              even with a min-width clamp. */}
          <AdderPill
            label="✎ draw"
            active={drawMode}
            disabled={
              (overlays.length >= OVERLAY_LIMIT && !drawMode) || eraserMode
            }
            fixedWidth={110}
            onClick={() => {
              setActiveAdder(null);
              setEraserMode(false);
              setDrawMode((v) => {
                const next = !v;
                // Exiting draw mode (or re-entering it) closes
                // out the current drawing session so the next
                // stroke starts a fresh overlay layer.
                if (!next || v) endDrawSession();
                return next;
              });
            }}
          />
          <AdderPill
            label="🩹 erase"
            active={eraserMode}
            disabled={drawMode}
            fixedWidth={110}
            onClick={() => {
              setActiveAdder(null);
              endDrawSession();
              setDrawMode(false);
              setEraserMode((v) => !v);
            }}
          />
        </div>
      </div>

      {activeAdder === "sticker" ? (
        <div className="flex flex-col gap-2 rounded-md bg-pink-50/60 border border-pink-100 px-2.5 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {STICKER_QUICK_PICKS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => addSticker(e)}
                className="rounded-md bg-white border border-pink-200 hover:border-pink-400 px-2 py-1 text-base leading-none"
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex items-stretch gap-2 flex-wrap">
            <input
              type="text"
              value={stickerInput}
              onChange={(e) => setStickerInput(e.target.value)}
              placeholder="…or paste any emoji"
              maxLength={6}
              className="bg-white border border-pink-200 rounded-pill px-3 py-1 text-[11px] flex-1 min-w-[160px] focus:outline-none focus:border-pink-400"
              onKeyDown={(e) => {
                if (e.key === "Enter" && stickerInput.trim()) {
                  e.preventDefault();
                  addSticker(stickerInput.trim());
                }
              }}
            />
            <button
              type="button"
              onClick={() =>
                stickerInput.trim() && addSticker(stickerInput.trim())
              }
              disabled={!stickerInput.trim()}
              className="rounded-pill bg-pink-200 text-white border border-pink-200 px-3 py-0.5 text-[11px] font-semibold disabled:opacity-60"
            >
              add
            </button>
          </div>
        </div>
      ) : null}

      {activeAdder === "caption" ? (
        <div className="flex items-stretch gap-2 flex-wrap rounded-md bg-pink-50/60 border border-pink-100 px-2.5 py-2">
          <input
            type="text"
            value={captionInput}
            onChange={(e) => setCaptionInput(e.target.value)}
            placeholder="short script-font caption…"
            maxLength={32}
            className="bg-white border border-pink-200 rounded-pill px-3 py-1 text-[11px] flex-1 min-w-[160px] focus:outline-none focus:border-pink-400"
            onKeyDown={(e) => {
              if (e.key === "Enter" && captionInput.trim()) {
                e.preventDefault();
                addCaption(captionInput);
              }
            }}
          />
          <button
            type="button"
            onClick={() => addCaption(captionInput)}
            disabled={!captionInput.trim()}
            className="rounded-pill bg-pink-200 text-white border border-pink-200 px-3 py-0.5 text-[11px] font-semibold disabled:opacity-60"
          >
            add
          </button>
        </div>
      ) : null}

      {activeAdder === "highlight" ? (
        <div className="flex items-center gap-2 flex-wrap rounded-md bg-pink-50/60 border border-pink-100 px-2.5 py-2">
          <span className="text-[10px] text-ink/70 font-semibold mr-1">
            shape:
          </span>
          {(
            [
              { id: "circle" as HighlightShape, label: "● circle" },
              { id: "rect" as HighlightShape, label: "▢ rectangle" },
              { id: "heart" as HighlightShape, label: "♡ heart" },
              { id: "star" as HighlightShape, label: "★ star" },
              { id: "diamond" as HighlightShape, label: "◆ diamond" },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => addHighlight(s.id)}
              className="rounded-pill bg-white text-pink-800 border border-pink-200 hover:border-pink-400 px-2.5 py-0.5 text-[11px] font-semibold"
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : null}

      {drawMode ? (
        <div className="flex flex-col gap-2 rounded-md bg-pink-50/60 border border-pink-100 px-2.5 py-2">
          <p className="text-[10px] text-ink/70">
            drag on the canvas to draw. release to finish a stroke.
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-ink/70 font-semibold w-12 shrink-0">
              color
            </span>
            {COLOR_OPTIONS.map((c) => {
              const active = drawColor === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setDrawColor(c.id)}
                  className={
                    "rounded-pill border px-2 py-0.5 text-[10px] font-semibold transition " +
                    (active
                      ? "bg-pink-300 text-white border-pink-300"
                      : "bg-white text-pink-800 border-pink-200 hover:border-pink-400")
                  }
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-[11px]">
            <span className="font-semibold text-ink/70 w-12 shrink-0">
              brush
            </span>
            <input
              type="range"
              value={drawWidth}
              min={0.005}
              max={0.05}
              step={0.005}
              onChange={(e) => setDrawWidth(parseFloat(e.target.value))}
              className="flex-1 accent-pink-400"
            />
            <span className="font-mono text-ink/65 w-12 text-right">
              {Math.round(drawWidth * 1000) / 10}%
            </span>
          </label>
        </div>
      ) : null}

      {/* Outer container sizes the cover preview area. The inner
          "stage" div is inset to match the photo's frame inset so
          overlay coordinates + drag math share the photo's frame
          of reference. Background renders at the outer bounds so
          the frame + photo paint at full size. For solid frames
          (which paint their own outer outline) we drop the pink
          chrome on the outer container so the frame's curve is
          the visible shape. */}
      <div
        className={
          "relative w-full aspect-square overflow-hidden mx-auto " +
          (stageInsetClass
            ? ""
            : "rounded-md border border-pink-100 bg-pink-50")
        }
        style={{
          maxWidth: 360,
          containerType: "inline-size",
        }}
      >
        {background}
        <div
          ref={stageRef}
          className={
            "absolute " +
            (stageInsetClass || "inset-0") +
            " " +
            (drawMode ? "cursor-crosshair touch-none" : "")
          }
          onPointerDown={(e) => {
            // In draw mode the stage itself captures the pointer to
            // start a stroke. Existing overlays render with
            // pointer-events:none so they don't intercept the press.
            if (drawMode) startDraw(e);
          }}
          onPointerMove={(e) => {
            if (drawRef.current) moveDraw(e);
            else if (rotateRef.current) moveRotate(e);
            else if (dragRef.current) moveDrag(e);
          }}
          onPointerUp={(e) => {
            if (drawRef.current) endDraw(e);
            else if (rotateRef.current) endRotate(e);
            else if (dragRef.current) endDrag(e);
          }}
          onPointerCancel={(e) => {
            if (drawRef.current) endDraw(e);
            else if (rotateRef.current) endRotate(e);
            else if (dragRef.current) endDrag(e);
          }}
          onClick={() => {
            if (drawMode) return; // don't deselect mid-draw
            setSelectedId(null);
          }}
        >
          {/* Editable overlay items — duplicates the OverlayLayer
              renderer but with drag handlers + a selection ring.
              In draw mode they go inert so the stage receives the
              stroke gesture instead. */}
          {overlays.map((o) => (
            <EditableOverlay
              key={o.id}
              overlay={o}
              selected={!drawMode && o.id === selectedId}
              interactive={!drawMode}
              onPointerDown={(e) => startDrag(e, o)}
            />
          ))}
          {/* Rotation handle for the selected overlay — a small dot
              anchored "above" the overlay in its rotated frame.
              Dragging it spins the overlay around its center. */}
          {!drawMode && selected ? (
            <RotationHandle
              overlay={selected}
              onPointerDown={(e) => startRotate(e, selected)}
            />
          ) : null}
        </div>
      </div>

      {/* Selected overlay controls — only shown when something is
          selected to keep the panel quiet otherwise. */}
      {selected ? (
        <SelectedControls
          overlay={selected}
          onChange={(patch) => updateOverlay(selected.id, patch)}
          onRemove={() => removeOverlay(selected.id)}
        />
      ) : overlays.length > 0 ? (
        <p className="text-[10px] text-ink/55 text-center">
          tap an overlay to resize / rotate / restyle.
        </p>
      ) : null}

      {savingErr ? (
        <p className="text-[11px] text-pink-600 font-semibold">
          {savingErr}
        </p>
      ) : null}
    </div>
  );
}

// Single overlay rendered with drag handlers. Mirrors OverlayLayer's
// item rendering but wires up pointer-events + a selection outline.
function EditableOverlay({
  overlay: o,
  selected,
  interactive = true,
  onPointerDown,
}: {
  overlay: CoverOverlay;
  selected: boolean;
  /** When false, the overlay renders inert (pointer-events: none)
   *  so the stage can capture pointer events for drawing instead. */
  interactive?: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const baseStyle: React.CSSProperties = {
    left: `${o.x * 100}%`,
    top: `${o.y * 100}%`,
    transform: `translate(-50%, -50%) rotate(${o.rotation}deg) scale(${o.scale})`,
    pointerEvents: interactive ? undefined : "none",
  };
  const ring = selected
    ? "outline outline-2 outline-pink-400 outline-offset-2 rounded-sm"
    : "";

  if (o.type === "sticker") {
    return (
      <button
        type="button"
        onPointerDown={onPointerDown}
        onClick={(e) => e.stopPropagation()}
        aria-label="select sticker"
        className={"absolute select-none leading-none cursor-move touch-none " + ring}
        style={{
          ...baseStyle,
          fontSize: "16cqw",
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))",
        }}
      >
        {o.emoji}
      </button>
    );
  }
  if (o.type === "caption") {
    return (
      <button
        type="button"
        onPointerDown={onPointerDown}
        onClick={(e) => e.stopPropagation()}
        aria-label="select caption"
        className={
          "absolute font-script select-none leading-none whitespace-nowrap cursor-move touch-none " +
          OVERLAY_TEXT_CLASSES[o.color] +
          " " +
          ring
        }
        style={{
          ...baseStyle,
          fontSize: "12cqw",
        }}
      >
        {o.text}
      </button>
    );
  }
  if (o.type === "stroke") {
    const center = (() => {
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (const seg of o.segments) {
        for (const [x, y] of seg.points) {
          sx += x;
          sy += y;
          n++;
        }
      }
      if (n === 0) return { x: 0.5, y: 0.5 };
      return { x: sx / n, y: sy / n };
    })();
    return (
      <svg
        onPointerDown={onPointerDown}
        onClick={(e) => e.stopPropagation()}
        className={
          "absolute inset-0 touch-none " +
          (interactive ? "cursor-move" : "") +
          " " +
          (selected
            ? "outline outline-2 outline-pink-400 outline-offset-2 rounded-sm"
            : "")
        }
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-label="select stroke"
        style={{ pointerEvents: interactive ? "auto" : "none" }}
      >
        <g
          transform={`translate(${center.x * 100} ${
            center.y * 100
          }) rotate(${o.rotation}) scale(${o.scale}) translate(${
            -center.x * 100
          } ${-center.y * 100})`}
        >
          {o.segments.map((seg, i) => {
            const svg = OVERLAY_SHAPE_SVG[seg.color];
            return (
              <path
                key={i}
                d={strokePointsToPath(seg.points)}
                fill="none"
                stroke={svg.stroke}
                strokeOpacity={0.92}
                strokeWidth={Math.max(seg.width * 100, 0.4)}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                // Make the entire path width grab the pointer for drag/
                // select, even though the painted line is thinner.
                pointerEvents={interactive ? "stroke" : "none"}
              />
            );
          })}
        </g>
      </svg>
    );
  }
  // highlight
  const style: React.CSSProperties = {
    left: `${o.x * 100}%`,
    top: `${o.y * 100}%`,
    width: `${Math.max(o.width, 0.05) * 100}%`,
    height: `${Math.max(o.height, 0.05) * 100}%`,
    transform: `translate(-50%, -50%) rotate(${o.rotation}deg) scale(${o.scale})`,
    pointerEvents: interactive ? undefined : "none",
  };
  if (o.shape === "heart" || o.shape === "star" || o.shape === "diamond") {
    const svg = OVERLAY_SHAPE_SVG[o.color];
    const path =
      o.shape === "heart"
        ? HEART_PATH
        : o.shape === "star"
        ? STAR_PATH
        : DIAMOND_PATH;
    return (
      <svg
        onPointerDown={onPointerDown}
        onClick={(e) => e.stopPropagation()}
        className={"absolute cursor-move touch-none " + ring}
        style={style}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-label={`select ${o.shape} highlight`}
      >
        <path
          d={path}
          fill={svg.fill}
          fillOpacity={0.55}
          stroke={svg.stroke}
          strokeOpacity={0.85}
          strokeWidth={2}
        />
      </svg>
    );
  }
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      aria-label={`select ${o.shape} highlight`}
      className={
        "absolute cursor-move touch-none " +
        OVERLAY_SHAPE_CLASSES[o.color] +
        (o.shape === "circle" ? " rounded-full" : " rounded-md") +
        " " +
        ring
      }
      style={style}
    />
  );
}

function SaveStatusPill({
  status,
}: {
  status: "saved" | "unsaved" | "saving" | "error";
}) {
  // All states share the same pill shell + fixed width so flipping
  // saved → unsaved → saving mid-draw doesn't reflow the toolbar
  // (which on mobile pushes the stage up and down under the finger).
  const base =
    "inline-flex items-center justify-center rounded-pill border px-1.5 py-0.5 text-[10px] font-semibold text-center";
  const widthStyle = { width: 64, flex: "0 0 auto" } as const;
  if (status === "saving") {
    return (
      <span
        className={base + " bg-white text-pink-600 border-pink-200"}
        style={widthStyle}
      >
        saving…
      </span>
    );
  }
  if (status === "unsaved") {
    return (
      <span
        className={base + " bg-amber-200/90 text-amber-900 border-amber-300/80"}
        style={widthStyle}
      >
        unsaved
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        className={base + " bg-pink-200 text-white border-pink-200"}
        style={widthStyle}
      >
        failed
      </span>
    );
  }
  return (
    <span
      className={base + " bg-white text-lavender-600 border-lavender-200"}
      style={widthStyle}
    >
      ✓ saved
    </span>
  );
}

function UndoRedoPill({
  glyph,
  label,
  title,
  disabled,
  onClick,
}: {
  glyph: string;
  label: string;
  title: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-[11px] font-semibold bg-white text-pink-800 border border-pink-200 hover:border-pink-400 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span aria-hidden className="text-sm leading-none">
        {glyph}
      </span>
      <span>{label}</span>
    </button>
  );
}

// Rotation drag-handle shown on the selected overlay. The outer
// wrapper rotates with the overlay so the handle paints at the
// overlay's "top" — dragging it sweeps the overlay around its
// own center.
function RotationHandle({
  overlay: o,
  onPointerDown,
}: {
  overlay: CoverOverlay;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${o.x * 100}%`,
        top: `${o.y * 100}%`,
        transform: `translate(-50%, -50%) rotate(${o.rotation}deg)`,
      }}
      aria-hidden
    >
      {/* Dashed tether so admin sees the rotation pivot point. */}
      <span
        className="absolute left-1/2 -translate-x-1/2 border-l border-dashed border-pink-400/85"
        style={{ top: -36, height: 28 }}
      />
      <button
        type="button"
        onPointerDown={onPointerDown}
        onClick={(e) => e.stopPropagation()}
        aria-label="rotate overlay"
        title="drag to rotate"
        className="pointer-events-auto absolute w-5 h-5 rounded-full bg-white border-2 border-pink-400 shadow-soft cursor-grab active:cursor-grabbing touch-none"
        style={{
          left: "50%",
          top: -36,
          transform: "translate(-50%, -50%)",
        }}
      />
    </div>
  );
}

function AdderPill({
  label,
  active,
  disabled,
  onClick,
  fixedWidth,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  /** When set, locks the button to this width (in px) so toggling
   *  labels with different glyph widths (notably emoji vs. text)
   *  can't change the button size and reflow the toolbar.
   *  width — not min-width — because iOS emoji renderers paint
   *  "✓" wide enough to overshoot a min-width clamp. */
  fixedWidth?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={
        fixedWidth
          ? { width: `${fixedWidth}px`, flex: "0 0 auto" }
          : undefined
      }
      className={
        "rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold transition disabled:opacity-50 text-center overflow-hidden whitespace-nowrap " +
        (active
          ? "bg-pink-300 text-white border-pink-300"
          : "bg-white text-pink-800 border-pink-200 hover:border-pink-400")
      }
    >
      {label}
    </button>
  );
}

function SelectedControls({
  overlay: o,
  onChange,
  onRemove,
}: {
  overlay: CoverOverlay;
  onChange: (patch: Partial<CoverOverlay>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md bg-pink-50/60 border border-pink-100 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wide font-bold text-pink-700">
          {o.type === "sticker"
            ? `sticker · ${o.emoji}`
            : o.type === "caption"
            ? `caption · "${o.text}"`
            : o.type === "stroke"
            ? `drawing · ${o.segments.length} stroke${
                o.segments.length === 1 ? "" : "s"
              }`
            : `${o.shape} highlight`}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-pill bg-pink-400/15 text-pink-700 border border-pink-300/60 hover:bg-pink-400/30 px-2.5 py-0.5 text-[11px] font-semibold"
        >
          ✕ remove
        </button>
      </div>

      {/* Size slider applies to sticker / caption / highlight via
          CSS scale. For strokes, scale visually thickens the
          path too, which conflates with the brush-width slider —
          we omit it for strokes to keep semantics clean. */}
      {o.type !== "stroke" ? (
        <SliderRow
          label="size"
          value={o.scale}
          min={0.4}
          max={2.5}
          step={0.1}
          onChange={(scale) => onChange({ scale })}
          format={(v) => `${v.toFixed(1)}×`}
        />
      ) : null}
      <SliderRow
        label="rotate"
        value={o.rotation}
        min={-180}
        max={180}
        step={5}
        onChange={(rotation) => onChange({ rotation })}
        format={(v) => `${Math.round(v)}°`}
      />

      {o.type === "highlight" ? (
        <>
          <SliderRow
            label="width"
            value={o.width}
            min={0.05}
            max={1}
            step={0.05}
            onChange={(width) => onChange({ width })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <SliderRow
            label="height"
            value={o.height}
            min={0.05}
            max={1}
            step={0.05}
            onChange={(height) => onChange({ height })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </>
      ) : null}

      {o.type === "caption" || o.type === "highlight" ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-ink/70 font-semibold mr-1 w-12 shrink-0">
            color
          </span>
          {COLOR_OPTIONS.map((c) => {
            const active = o.color === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onChange({ color: c.id } as Partial<CoverOverlay>)}
                className={
                  "rounded-pill border px-2 py-0.5 text-[10px] font-semibold transition " +
                  (active
                    ? "bg-pink-300 text-white border-pink-300"
                    : "bg-white text-pink-800 border-pink-200 hover:border-pink-400")
                }
              >
                {c.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {o.type === "stroke" ? (
        <p className="text-[10px] text-ink/55">
          color + brush width are set per stroke in draw mode.
        </p>
      ) : null}

      {o.type === "caption" ? (
        <div className="flex items-stretch gap-2">
          <input
            type="text"
            value={o.text}
            onChange={(e) => onChange({ text: e.target.value })}
            maxLength={32}
            className="bg-white border border-pink-200 rounded-pill px-3 py-1 text-[11px] flex-1 min-w-[100px] focus:outline-none focus:border-pink-400"
          />
        </div>
      ) : null}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <label className="flex items-center gap-2 text-[11px]">
      <span className="font-semibold text-ink/70 w-12 shrink-0">{label}</span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-pink-400"
      />
      <span className="font-mono text-ink/65 w-12 text-right">
        {format(value)}
      </span>
    </label>
  );
}

// Re-export so the caller doesn't need a second import for the
// normalize helper while wiring this up.
export { normalizeOverlays };
