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
}: {
  overlays: CoverOverlay[];
  /** Local-state update (optimistic). Called for every drag tick. */
  onChange: (next: CoverOverlay[]) => void;
  /** Persisted save. Called on drag-end and on add/remove/style
   *  changes. The editor passes the same array onChange already
   *  reflected so server and local state stay in sync. */
  onCommit: (next: CoverOverlay[]) => Promise<ActionResult>;
  background: React.ReactNode;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const rotateRef = useRef<{ id: string } | null>(null);
  /** Stroke-in-progress while in draw mode. The drawing overlay is
   *  appended to the array on pointerdown and updated in place on
   *  every pointermove sample. */
  const drawRef = useRef<{ id: string } | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [drawColor, setDrawColor] = useState<OverlayColor>("pink");
  const [drawWidth, setDrawWidth] = useState(0.015); // ~1.5% of stage width
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savingErr, setSavingErr] = useState<string | null>(null);

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

  function persist(next: CoverOverlay[]) {
    onChange(next);
    setSavingErr(null);
    onCommit(next).then((res) => {
      if (!res.ok) setSavingErr(res.error);
    });
  }

  function updateOverlay(id: string, patch: Partial<CoverOverlay>) {
    const next = overlays.map((o) =>
      o.id === id ? ({ ...o, ...patch } as CoverOverlay) : o
    );
    persist(next);
  }

  function removeOverlay(id: string) {
    persist(overlays.filter((o) => o.id !== id));
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
    persist(next);
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
    persist(next);
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
    persist(next);
    setSelectedId(next[next.length - 1].id);
    setActiveAdder(null);
  }

  function startDrag(e: React.PointerEvent, overlay: CoverOverlay) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setSelectedId(overlay.id);
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
  }

  function endDrag(e: React.PointerEvent) {
    if (!dragRef.current) return;
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    dragRef.current = null;
    // Persist whatever the latest local state is.
    persist(overlays);
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
    persist(overlays);
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
    if (overlays.length >= OVERLAY_LIMIT) return;
    const p = pointerToStageFraction(e);
    if (!p) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const id = newOverlayId();
    drawRef.current = { id };
    const stroke: CoverOverlay = {
      id,
      type: "stroke",
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      points: [[p.x, p.y]],
      color: drawColor,
      width: drawWidth,
    };
    onChange([...overlays, stroke]);
  }

  function moveDraw(e: React.PointerEvent) {
    const d = drawRef.current;
    if (!d) return;
    const p = pointerToStageFraction(e);
    if (!p) return;
    // Find current stroke + skip-tiny-moves filter.
    const cur = overlays.find((o) => o.id === d.id);
    if (!cur || cur.type !== "stroke") return;
    const last = cur.points[cur.points.length - 1];
    const dx = p.x - last[0];
    const dy = p.y - last[1];
    if (dx * dx + dy * dy < 0.000025) return; // 0.5% threshold
    const next = overlays.map((o) =>
      o.id === d.id && o.type === "stroke"
        ? { ...o, points: [...o.points, [p.x, p.y]] as [number, number][] }
        : o
    );
    onChange(next);
  }

  function endDraw(e: React.PointerEvent) {
    const d = drawRef.current;
    if (!d) return;
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    drawRef.current = null;
    // Strip any stroke that ended with no real movement (single
    // tap with no drag) so an accidental click doesn't litter the
    // overlay list with invisible dots.
    const stroke = overlays.find((o) => o.id === d.id);
    const next =
      stroke && stroke.type === "stroke" && stroke.points.length >= 2
        ? overlays
        : overlays.filter((o) => o.id !== d.id);
    if (next === overlays) {
      persist(next);
    } else {
      onChange(next);
      // No need to persist if we just removed the in-progress
      // empty stroke that was only in local state.
    }
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
  }

  const selected = overlays.find((o) => o.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-3 rounded-md bg-white border border-pink-100 p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[11px] text-pink-800 font-semibold">
            ✿ overlays
          </p>
          <p className="text-[10px] text-ink/65">
            {overlays.length} of {OVERLAY_LIMIT} · drag to reposition
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <AdderPill
            label="+ sticker"
            active={activeAdder === "sticker"}
            disabled={overlays.length >= OVERLAY_LIMIT || drawMode}
            onClick={() => {
              setDrawMode(false);
              setActiveAdder((a) => (a === "sticker" ? null : "sticker"));
            }}
          />
          <AdderPill
            label="+ caption"
            active={activeAdder === "caption"}
            disabled={overlays.length >= OVERLAY_LIMIT || drawMode}
            onClick={() => {
              setDrawMode(false);
              setActiveAdder((a) => (a === "caption" ? null : "caption"));
            }}
          />
          <AdderPill
            label="+ highlight"
            active={activeAdder === "highlight"}
            disabled={overlays.length >= OVERLAY_LIMIT || drawMode}
            onClick={() => {
              setDrawMode(false);
              setActiveAdder((a) =>
                a === "highlight" ? null : "highlight"
              );
            }}
          />
          {/* Draw mode is mutually exclusive with the adder
              popovers — toggling it closes them and swaps the
              stage into stroke-capture mode. */}
          <AdderPill
            label={drawMode ? "✓ drawing" : "✎ draw"}
            active={drawMode}
            disabled={overlays.length >= OVERLAY_LIMIT && !drawMode}
            onClick={() => {
              setActiveAdder(null);
              setDrawMode((v) => !v);
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

      {/* Stage — the editable cover canvas. Caller passes the
          background (image / frame / filter) and we draw overlays
          + drag handles on top so click-to-select works. */}
      <div
        ref={stageRef}
        className={
          "relative w-full aspect-square rounded-md overflow-hidden border border-pink-100 bg-pink-50 mx-auto " +
          (drawMode ? "cursor-crosshair touch-none" : "")
        }
        style={{
          maxWidth: 360,
          containerType: "inline-size",
        }}
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
        {background}
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
    const svg = OVERLAY_SHAPE_SVG[o.color];
    const strokeWidth = Math.max(o.width * 100, 0.4);
    const center = (() => {
      if (o.points.length === 0) return { x: 0.5, y: 0.5 };
      let sx = 0;
      let sy = 0;
      for (const [x, y] of o.points) {
        sx += x;
        sy += y;
      }
      return { x: sx / o.points.length, y: sy / o.points.length };
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
          <path
            d={strokePointsToPath(o.points)}
            fill="none"
            stroke={svg.stroke}
            strokeOpacity={0.92}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            // Make the entire path width grab the pointer for drag/
            // select, even though the painted line is thinner.
            pointerEvents={interactive ? "stroke" : "none"}
          />
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
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold transition disabled:opacity-50 " +
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
            ? `drawing · ${o.points.length} pts`
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

      {o.type === "stroke" ? (
        <SliderRow
          label="brush"
          value={o.width}
          min={0.005}
          max={0.05}
          step={0.005}
          onChange={(width) => onChange({ width })}
          format={(v) => `${Math.round(v * 1000) / 10}%`}
        />
      ) : null}

      {o.type === "caption" ||
      o.type === "highlight" ||
      o.type === "stroke" ? (
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
