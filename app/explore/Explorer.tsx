"use client";

import { Suspense, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, Stars, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { Pin, PinBody, PinType } from "@/lib/supabase/pins";
import type { Photo } from "@/lib/supabase/photos";
import {
  createPin,
  updatePinNote,
  updatePinType,
  deletePin,
  clearPinsForBody,
  linkPinPhotos,
  listPhotosForPicker,
  setExplorePinMode,
  setPinDisplayMode,
} from "./admin-actions";
import type { ExplorePinMode, PinDisplayMode } from "@/lib/supabase/settings";
import { getPinFeed, type PinFeed } from "./feed-actions";
import { FeedCard } from "./FeedCard";
import { PhotoPicker } from "./PhotoPicker";

const TYPE_COLORS: Record<PinType, string> = {
  travel: "#D4537E",
  diary: "#7F77DD",
  astronomy: "#EF9F27",
};

const TYPE_LABELS: Record<PinType, string> = {
  travel: "✈ travel",
  diary: "✿ diary",
  astronomy: "✦ astronomy",
};

const TYPE_GLYPHS: Record<PinType, string> = {
  travel: "✈",
  diary: "✿",
  astronomy: "✦",
};

const TYPES: PinType[] = ["travel", "diary", "astronomy"];

const DRAFT_PREFIX = "draft-";
const isDraftId = (id: string) => id.startsWith(DRAFT_PREFIX);

function pointToLatLon(p: [number, number, number]): { lat: number; lon: number } {
  const v = new THREE.Vector3(...p).normalize();
  // Three.js SphereGeometry's default UV mapping puts +X at lon 0° (centered
  // on Greenwich for an equirectangular Earth texture), +Z at lon -90° (the
  // Americas), and -Z at lon +90° (Asia). The atan2 sign for Z is therefore
  // negated relative to the naive math convention.
  return {
    lat: (Math.asin(v.y) * 180) / Math.PI,
    lon: (Math.atan2(-v.z, v.x) * 180) / Math.PI,
  };
}

function approxRegion(lat: number, lon: number, body: PinBody): string {
  if (body === "moon") {
    if (lat > 30) return "Northern highlands";
    if (lat < -30) return "Southern highlands";
    if (lon > -90 && lon < 90) return "Near side · mare region";
    return "Far side";
  }
  const a = Math.abs(lat);
  if (a > 66) return lat > 0 ? "Arctic region" : "Antarctic region";
  if (lon > -170 && lon < -50 && lat > -55)
    return a > 23 ? "Americas" : "Equatorial Americas";
  if (lon > -20 && lon < 50 && lat > -35) return "Africa or Europe";
  if (lon > 50 && lon < 145 && lat > -10) return "Asia";
  if (lon > 110 && lon < 155 && lat < -10) return "Australia or Oceania";
  return "Open ocean";
}

function formatCoords(lat: number, lon: number): string {
  return (
    `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} · ` +
    `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`
  );
}

function BodySphere({
  textureUrl,
  visible,
  onSurfaceClick,
}: {
  textureUrl: string;
  visible: boolean;
  onSurfaceClick: (point: [number, number, number]) => void;
}) {
  const texture = useTexture(textureUrl);
  texture.anisotropy = 8;
  return (
    <mesh
      visible={visible}
      onClick={(e) => {
        if (!visible) return;
        e.stopPropagation();
        onSurfaceClick([e.point.x, e.point.y, e.point.z]);
      }}
    >
      <sphereGeometry args={[1, 96, 96]} />
      <meshPhongMaterial map={texture} shininess={6} specular={"#222233"} />
    </mesh>
  );
}

function PinMesh({
  pin,
  selected,
  isDraft,
  onClick,
}: {
  pin: Pin;
  selected: boolean;
  isDraft: boolean;
  onClick: () => void;
}) {
  const pos = new THREE.Vector3(pin.position_x, pin.position_y, pin.position_z)
    .normalize()
    .multiplyScalar(1.015)
    .toArray() as [number, number, number];
  return (
    <mesh
      position={pos}
      scale={selected ? 1.7 : 1}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <sphereGeometry args={[0.025, 16, 16]} />
      <meshBasicMaterial
        color={TYPE_COLORS[pin.type]}
        transparent={isDraft}
        opacity={isDraft ? 0.45 : 1}
      />
    </mesh>
  );
}

export function Explorer({
  initialPins,
  isAdmin,
  initialPinMode,
  initialPinDisplay,
}: {
  initialPins: Pin[];
  isAdmin: boolean;
  initialPinMode: ExplorePinMode;
  initialPinDisplay: PinDisplayMode;
}) {
  const router = useRouter();
  const [body, setBody] = useState<PinBody>("earth");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pins, setPins] = useState<Pin[]>(initialPins);
  const [draft, setDraft] = useState<Pin | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<PinFeed | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pinMode, setPinMode] = useState<ExplorePinMode>(initialPinMode);
  const [pinDisplay, setPinDisplay] = useState<PinDisplayMode>(initialPinDisplay);

  // Sync mode if server-side value changes (e.g. another admin toggled it).
  useEffect(() => setPinMode(initialPinMode), [initialPinMode]);
  useEffect(() => setPinDisplay(initialPinDisplay), [initialPinDisplay]);

  function handleTogglePinMode() {
    const next: ExplorePinMode = pinMode === "popup" ? "inline" : "popup";
    setPinMode(next);
    startTransition(async () => {
      const r = await setExplorePinMode(next);
      if (!r.ok) {
        setError(r.error ?? "Could not save pin mode.");
        setPinMode(pinMode);
      } else {
        router.refresh();
      }
    });
  }

  function handleTogglePinDisplay() {
    const next: PinDisplayMode = pinDisplay === "card" ? "dot" : "card";
    setPinDisplay(next);
    startTransition(async () => {
      const r = await setPinDisplayMode(next);
      if (!r.ok) {
        setError(r.error ?? "Could not save display mode.");
        setPinDisplay(pinDisplay);
      } else {
        router.refresh();
      }
    });
  }

  // Sync server-side state.
  useEffect(() => setPins(initialPins), [initialPins]);

  // Combined list (server pins + local draft) filtered by body.
  const allForBody = useMemo(() => {
    const base = pins.filter((p) => p.body === body);
    if (draft && draft.body === body) return [draft, ...base];
    return base;
  }, [pins, draft, body]);

  const selected = allForBody.find((p) => p.id === selectedId) ?? null;
  const selectedIsDraft = Boolean(selected && isDraftId(selected.id));

  const counts = {
    earth: pins.filter((p) => p.body === "earth").length,
    moon: pins.filter((p) => p.body === "moon").length,
  };

  // Resolve linked photo objects for the panel — only for committed pins.
  // Stored as a small list so we don't ship the full library in props.
  const [linkedPhotos, setLinkedPhotos] = useState<Photo[]>([]);
  const selectedPhotoIds = selected?.photo_ids ?? [];
  useEffect(() => {
    if (!selected || selectedIsDraft || selectedPhotoIds.length === 0) {
      setLinkedPhotos([]);
      return;
    }
    let cancelled = false;
    listPhotosForPicker().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLinkedPhotos([]);
        return;
      }
      const wanted = new Set(selectedPhotoIds);
      setLinkedPhotos(result.photos.filter((p) => wanted.has(p.id)));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selectedPhotoIds.join(","), selectedIsDraft]);

  // Fetch the feed only for committed pins.
  useEffect(() => {
    if (!selected || selectedIsDraft) {
      setFeed(null);
      return;
    }
    let cancelled = false;
    setFeedLoading(true);
    getPinFeed(selected).then((f) => {
      if (cancelled) return;
      setFeed(f);
      setFeedLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.type, selected?.body, selectedIsDraft]);

  function discardDraftIfAny() {
    if (draft) setDraft(null);
  }

  function handleBodyClick(point: [number, number, number]) {
    if (!isAdmin) return;
    discardDraftIfAny();
    const id = `${DRAFT_PREFIX}${crypto.randomUUID()}`;
    const newDraft: Pin = {
      id,
      body,
      type: "travel",
      position_x: point[0],
      position_y: point[1],
      position_z: point[2],
      note: "",
      photo_ids: [],
      created_at: new Date().toISOString(),
    };
    setDraft(newDraft);
    setSelectedId(id);
    setError(null);
  }

  function handleSelectPin(id: string) {
    if (id !== draft?.id) discardDraftIfAny();
    setSelectedId(selectedId === id ? null : id);
  }

  function handleSwitchBody(next: PinBody) {
    setBody(next);
    setSelectedId(null);
    discardDraftIfAny();
  }

  // Commit the draft to the server. Optionally apply pending updates
  // (type / note / photo_ids) before the server rounds-trip so the new
  // committed row already has them.
  async function commitDraft(updates: {
    type?: PinType;
    note?: string;
    photoIds?: string[];
  } = {}): Promise<string | null> {
    if (!draft) return null;
    const result = await createPin({
      body: draft.body,
      type: updates.type ?? draft.type,
      position: [draft.position_x, draft.position_y, draft.position_z],
    });
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    const newId = result.id;
    // Apply note + photo_ids in parallel — both are no-ops if empty.
    const tasks: Promise<unknown>[] = [];
    if (updates.note && updates.note.length > 0)
      tasks.push(updatePinNote(newId, updates.note));
    if (updates.photoIds && updates.photoIds.length > 0)
      tasks.push(linkPinPhotos(newId, updates.photoIds));
    await Promise.all(tasks);

    // Optimistically place the committed pin in local state.
    setPins((prev) => [
      {
        id: newId,
        body: draft.body,
        type: updates.type ?? draft.type,
        position_x: draft.position_x,
        position_y: draft.position_y,
        position_z: draft.position_z,
        note: updates.note ?? "",
        photo_ids: updates.photoIds ?? [],
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    setDraft(null);
    setSelectedId(newId);
    router.refresh();
    return newId;
  }

  function handleSetType(type: PinType) {
    if (!selected) return;
    if (selectedIsDraft) {
      startTransition(async () => {
        await commitDraft({ type });
      });
    } else {
      setPins((prev) =>
        prev.map((p) => (p.id === selected.id ? { ...p, type } : p))
      );
      startTransition(async () => {
        const r = await updatePinType(selected.id, type);
        if (!r.ok) setError(r.error ?? "Update failed.");
        else router.refresh();
      });
    }
  }

  function handleNoteSave(note: string) {
    if (!selected) return;
    const trimmed = note.trim();
    if (selectedIsDraft) {
      // Empty note doesn't commit a draft — stay as-is so an idle click
      // can still be discarded.
      if (trimmed.length === 0) return;
      startTransition(async () => {
        await commitDraft({ note });
      });
    } else {
      setPins((prev) =>
        prev.map((p) => (p.id === selected.id ? { ...p, note } : p))
      );
      startTransition(async () => {
        const r = await updatePinNote(selected.id, note);
        if (!r.ok) setError(r.error ?? "Update failed.");
        else router.refresh();
      });
    }
  }

  function handleDeleteSelected() {
    if (!selected) return;
    if (selectedIsDraft) {
      // Drafts aren't on the server — just discard locally.
      setDraft(null);
      setSelectedId(null);
      return;
    }
    if (!confirm("Delete this pin?")) return;
    const id = selected.id;
    setPins((prev) => prev.filter((p) => p.id !== id));
    setSelectedId(null);
    startTransition(async () => {
      const r = await deletePin(id);
      if (!r.ok) setError(r.error ?? "Delete failed.");
      else router.refresh();
    });
  }

  function handleClearAll() {
    if (!confirm(`Delete ALL ${counts[body]} pin${counts[body] === 1 ? "" : "s"} on ${body}?`))
      return;
    setPins((prev) => prev.filter((p) => p.body !== body));
    setSelectedId(null);
    discardDraftIfAny();
    startTransition(async () => {
      const r = await clearPinsForBody(body);
      if (!r.ok) setError(r.error ?? "Clear failed.");
      else router.refresh();
    });
  }

  function handleSaveDraft() {
    if (!selected || !selectedIsDraft) return;
    startTransition(async () => {
      await commitDraft();
    });
  }

  async function handleSavePhotoLinks(photoIds: string[]) {
    if (!selected) return { ok: false, error: "No pin selected." };
    if (selectedIsDraft) {
      // Commit draft first with the linked photos.
      const newId = await commitDraft({ photoIds });
      return newId ? { ok: true } : { ok: false, error: "Could not save pin." };
    }
    // Update existing pin.
    setPins((prev) =>
      prev.map((p) => (p.id === selected.id ? { ...p, photo_ids: photoIds } : p))
    );
    const r = await linkPinPhotos(selected.id, photoIds);
    if (r.ok) router.refresh();
    return r;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <BodyButton
          active={body === "earth"}
          count={counts.earth}
          onClick={() => handleSwitchBody("earth")}
        >
          🌍 earth
        </BodyButton>
        <BodyButton
          active={body === "moon"}
          count={counts.moon}
          onClick={() => handleSwitchBody("moon")}
        >
          🌙 moon
        </BodyButton>
        <span className="flex-1" />
        {isAdmin ? (
          <>
            <ToggleBtn active={pinMode === "popup"} disabled={pending} onClick={handleTogglePinMode} title="panel below ↔ popup at pin">
              {pinMode === "popup" ? "✓ popups" : "popups"}
            </ToggleBtn>
            <ToggleBtn active={pinDisplay === "card"} disabled={pending} onClick={handleTogglePinDisplay} title="dots ↔ thumbnail cards on the globe">
              {pinDisplay === "card" ? "✓ cards" : "cards"}
            </ToggleBtn>
            {counts[body] > 0 ? (
              <button
                type="button"
                onClick={handleClearAll}
                disabled={pending}
                className="lift rounded-pill bg-white text-pink-800 border border-pink-100 hover:border-pink-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
              >
                ✕ clear pins on {body}
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      <div
        className="relative aspect-[4/3] rounded-lg overflow-hidden border-2 border-white shadow-soft"
        style={{
          background:
            "radial-gradient(ellipse at center, #1a1530 0%, #050510 100%)",
          cursor: "grab",
        }}
      >
        <span className="absolute top-3 left-4 z-10 font-script text-cream/70 text-base pointer-events-none">
          ✦
        </span>
        <span className="absolute top-3 right-4 z-10 font-script text-cream/70 text-lg pointer-events-none">
          ✿
        </span>

        <Canvas
          flat
          camera={{ position: [0, 0, 2.8], fov: 45 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
        >
          {/* `flat` disables R3F's ACES Filmic tone mapping which crushes
              brightness for our LDR textures. Light intensities here are tuned
              for Three's modern physically-correct defaults — they look about
              4x dimmer than they did in the r128 prototype. */}
          <ambientLight intensity={1.0} />
          <directionalLight position={[5, 2, 5]} intensity={3.0} />
          <Stars
            radius={50}
            depth={20}
            count={1500}
            factor={3}
            saturation={0}
            fade
            speed={0.5}
          />
          <Suspense fallback={null}>
            <BodySphere
              textureUrl="/textures/earth.jpg"
              visible={body === "earth"}
              onSurfaceClick={handleBodyClick}
            />
            <BodySphere
              textureUrl="/textures/moon.jpg"
              visible={body === "moon"}
              onSurfaceClick={handleBodyClick}
            />
          </Suspense>
          {allForBody.map((pin) =>
            pinDisplay === "card" ? (
              <PinCard
                key={pin.id}
                pin={pin}
                selected={pin.id === selectedId}
                isDraft={isDraftId(pin.id)}
                photoThumbUrl={
                  pin.photo_ids.length > 0 && pin.id === selected?.id
                    ? linkedPhotos[0]?.image_url ?? null
                    : null
                }
                onClick={() => handleSelectPin(pin.id)}
              />
            ) : (
              <PinMesh
                key={pin.id}
                pin={pin}
                selected={pin.id === selectedId}
                isDraft={isDraftId(pin.id)}
                onClick={() => handleSelectPin(pin.id)}
              />
            )
          )}
          {pinMode === "popup" && selected ? (
            <PinPopupAnchor pin={selected}>
              <PinPanel
                pin={selected}
                body={body}
                isAdmin={isAdmin}
                isDraft={selectedIsDraft}
                pending={pending}
                linkedPhotos={linkedPhotos}
                onSetType={handleSetType}
                onSaveNote={handleNoteSave}
                onSaveDraft={handleSaveDraft}
                onDelete={handleDeleteSelected}
                onOpenPicker={() => setPickerOpen(true)}
                compact
              />
            </PinPopupAnchor>
          ) : null}
          <OrbitControls
            enablePan={false}
            minDistance={1.3}
            maxDistance={8}
            autoRotate={!selected}
            autoRotateSpeed={0.35}
            rotateSpeed={0.6}
            zoomSpeed={0.7}
          />
        </Canvas>
      </div>

      <p className="text-center text-xs text-lavender-600 font-semibold">
        drag to rotate · scroll to zoom ·{" "}
        {isAdmin
          ? "tap the surface to drop a draft pin · type a note or pick a photo to keep it"
          : "tap any pin to see its note"}
      </p>

      {pinMode === "inline" ? (
        <PinPanel
          pin={selected}
          body={body}
          isAdmin={isAdmin}
          isDraft={selectedIsDraft}
          pending={pending}
          linkedPhotos={linkedPhotos}
          onSetType={handleSetType}
          onSaveNote={handleNoteSave}
          onSaveDraft={handleSaveDraft}
          onDelete={handleDeleteSelected}
          onOpenPicker={() => setPickerOpen(true)}
        />
      ) : !selected && isAdmin ? (
        <p className="rounded-lg bg-white border border-pink-100 shadow-soft p-4 text-center text-xs text-lavender-600">
          ✿ popup mode · tap the surface to drop a draft pin
        </p>
      ) : null}

      {pinMode === "inline" && selected && !selectedIsDraft ? (
        feedLoading ? (
          <div className="rounded-md px-4 py-3 bg-pink-50/60 border border-pink-100 text-xs text-lavender-600 font-semibold text-center">
            ✦ loading feed…
          </div>
        ) : (
          <FeedCard feed={feed} linkedPhotos={linkedPhotos} />
        )
      ) : null}

      {error ? (
        <p className="text-xs text-pink-600 font-semibold text-center">
          {error}
        </p>
      ) : null}

      {pickerOpen && selected ? (
        <PhotoPicker
          initialSelected={selectedPhotoIds}
          onClose={() => setPickerOpen(false)}
          onSave={handleSavePhotoLinks}
        />
      ) : null}
    </div>
  );
}

function BodyButton({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "lift inline-flex items-center gap-1.5 rounded-pill px-4 py-1.5 text-sm font-semibold border transition-colors " +
        (active
          ? "bg-pink-200 text-white border-pink-200 shadow-soft"
          : "bg-white text-pink-800 border-pink-100 hover:border-pink-200")
      }
    >
      {children}
      <span
        className={
          "text-[11px] rounded-full px-1.5 " +
          (active ? "bg-white/20 text-white" : "bg-pink-50 text-pink-600")
        }
      >
        {count}
      </span>
    </button>
  );
}

function ToggleBtn({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={title}
      className={
        "lift inline-flex items-center rounded-pill px-3 py-1.5 text-xs font-semibold border transition-colors disabled:opacity-50 " +
        (active
          ? "bg-lavender-100 text-lavender-800 border-lavender-200"
          : "bg-white text-lavender-600 border-pink-100 hover:border-pink-200")
      }
    >
      {children}
    </button>
  );
}

function PinCard({
  pin,
  selected,
  isDraft,
  photoThumbUrl,
  onClick,
}: {
  pin: Pin;
  selected: boolean;
  isDraft: boolean;
  photoThumbUrl: string | null;
  onClick: () => void;
}) {
  const pos = new THREE.Vector3(pin.position_x, pin.position_y, pin.position_z)
    .normalize()
    .multiplyScalar(1.02)
    .toArray() as [number, number, number];
  const borderColor = TYPE_COLORS[pin.type];
  const ring = selected ? `0 0 0 2px ${borderColor}55` : "none";

  return (
    <Html position={pos} center distanceFactor={3.5} zIndexRange={[20, 0]}>
      <button
        type="button"
        onClick={onClick}
        title={pin.note || `${pin.type} pin`}
        style={{
          borderColor,
          boxShadow: ring,
          opacity: isDraft ? 0.65 : 1,
        }}
        className="block w-12 h-12 rounded-md border-2 overflow-hidden bg-cream hover:scale-110 transition-transform shadow-soft cursor-pointer"
      >
        {photoThumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoThumbUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : pin.note ? (
          <div className="w-full h-full flex items-center justify-center p-1 text-[8px] leading-tight font-semibold text-ink overflow-hidden text-center break-words">
            {pin.note.slice(0, 28)}
          </div>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-base font-bold"
            style={{ color: borderColor }}
          >
            {TYPE_GLYPHS[pin.type]}
          </div>
        )}
      </button>
    </Html>
  );
}

function PinPopupAnchor({
  pin,
  children,
}: {
  pin: Pin;
  children: React.ReactNode;
}) {
  // Anchor point is the pin position lifted slightly off the sphere so the
  // popup floats above the marker.
  const pos = new THREE.Vector3(pin.position_x, pin.position_y, pin.position_z)
    .normalize()
    .multiplyScalar(1.05)
    .toArray() as [number, number, number];
  return (
    <Html
      position={pos}
      center
      distanceFactor={3}
      zIndexRange={[100, 0]}
      // pointer-events on the wrapper so children can take clicks; the
      // outer canvas still receives drag events that don't hit the popup.
      style={{ pointerEvents: "auto" }}
    >
      <div className="w-[320px] max-w-[80vw]">{children}</div>
    </Html>
  );
}

function PinPanel({
  pin,
  body,
  isAdmin,
  isDraft,
  pending,
  linkedPhotos,
  compact = false,
  onSetType,
  onSaveNote,
  onSaveDraft,
  onDelete,
  onOpenPicker,
}: {
  pin: Pin | null;
  body: PinBody;
  isAdmin: boolean;
  isDraft: boolean;
  pending: boolean;
  linkedPhotos: Photo[];
  compact?: boolean;
  onSetType: (t: PinType) => void;
  onSaveNote: (note: string) => void;
  onSaveDraft: () => void;
  onDelete: () => void;
  onOpenPicker: () => void;
}) {
  const noteRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (noteRef.current) noteRef.current.value = pin?.note ?? "";
  }, [pin?.id, pin?.note]);

  if (!pin) {
    if (compact) return null;
    return (
      <div className="rounded-lg bg-white border border-pink-100 shadow-soft p-6 text-center text-sm text-lavender-600">
        ✿ no pin selected ·{" "}
        {isAdmin
          ? "tap anywhere on the surface to drop a draft"
          : "tap any pin on the globe"}
      </div>
    );
  }

  const { lat, lon } = pointToLatLon([pin.position_x, pin.position_y, pin.position_z]);
  const region = approxRegion(lat, lon, body);
  const coords = formatCoords(lat, lon);

  // The compact layout is roughly half the height of the inline one — chip
  // row collapses to glyph-only buttons, coords + region merge into a single
  // small line, the textarea starts at one row, and the linked-photos row
  // is hidden entirely when there are none (admin gets a tiny "+ photos"
  // link instead of a full empty section).
  const photosLabel =
    linkedPhotos.length === 0 ? "+ photos" : `edit (${linkedPhotos.length})`;

  return (
    <div
      className={
        "rounded-lg shadow-soft flex flex-col border " +
        (compact ? "p-3 gap-2 " : "p-5 gap-4 ") +
        (isDraft
          ? "bg-pink-50/95 border-pink-200 border-dashed"
          : "bg-white border-pink-100")
      }
    >
      {/* Top row: type chips + action buttons */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => isAdmin && onSetType(t)}
              disabled={!isAdmin || pending}
              title={TYPE_LABELS[t]}
              aria-label={TYPE_LABELS[t]}
              className={
                "rounded-pill border transition-colors " +
                (compact ? "w-7 h-7 text-sm " : "px-3 py-1.5 text-xs font-semibold ") +
                "flex items-center justify-center " +
                (pin.type === t
                  ? typeChipClasses(t, true)
                  : typeChipClasses(t, false))
              }
            >
              {compact ? TYPE_GLYPHS[t] : TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        {isAdmin ? (
          <div className="flex items-center gap-1">
            {isDraft ? (
              <button
                type="button"
                onClick={onSaveDraft}
                disabled={pending}
                title="save pin as-is"
                className="lift inline-flex items-center rounded-pill bg-pink-200 text-white border border-pink-200 shadow-soft hover:border-pink-400 px-2.5 py-1 text-[11px] font-semibold disabled:opacity-60"
              >
                ✓ save
              </button>
            ) : null}
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              aria-label={isDraft ? "discard draft" : "delete pin"}
              title={isDraft ? "discard draft" : "delete pin"}
              className={
                "rounded-full text-sm font-semibold bg-pink-100 text-pink-600 hover:bg-pink-200 transition-colors disabled:opacity-50 flex items-center justify-center " +
                (compact ? "w-7 h-7 text-xs" : "w-9 h-9")
              }
            >
              ✕
            </button>
          </div>
        ) : null}
      </div>

      {/* Coords + region row */}
      <div className="flex items-baseline gap-2 flex-wrap">
        <span
          className={
            "inline-block rounded-pill bg-pink-100 text-pink-800 font-mono font-semibold " +
            (compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs")
          }
        >
          {coords}
        </span>
        <span
          className={
            "text-lavender-600 font-semibold " +
            (compact ? "text-[10px]" : "text-xs")
          }
        >
          {region}
        </span>
      </div>

      {/* Note */}
      {isAdmin ? (
        <textarea
          ref={noteRef}
          defaultValue={pin.note}
          onBlur={(e) => {
            if (e.target.value !== pin.note) onSaveNote(e.target.value);
          }}
          rows={compact ? 1 : 2}
          placeholder={compact ? "note…" : "leave yourself a little memory…"}
          className={
            "w-full bg-pink-50 border border-pink-100 rounded-sm text-ink placeholder:text-pink-400 focus:outline-none focus:border-pink-200 resize-y " +
            (compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm")
          }
        />
      ) : pin.note ? (
        <p
          className={
            "font-serif text-ink/85 leading-relaxed bg-pink-50 border border-pink-100 rounded-sm " +
            (compact ? "text-xs px-2 py-1" : "text-[15px] px-3 py-2")
          }
        >
          {pin.note}
        </p>
      ) : null}

      {/* Linked photos */}
      {linkedPhotos.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <p
              className={
                "uppercase tracking-wider font-semibold text-pink-600 " +
                (compact ? "text-[9px]" : "text-[11px]")
              }
            >
              photos
            </p>
            {isAdmin ? (
              <button
                type="button"
                onClick={onOpenPicker}
                disabled={pending}
                className={
                  "font-semibold text-pink-600 hover:text-pink-800 disabled:opacity-50 " +
                  (compact ? "text-[10px]" : "text-xs")
                }
              >
                {photosLabel}
              </button>
            ) : null}
          </div>
          <ul
            className={
              "grid gap-1.5 " +
              (compact ? "grid-cols-5" : "grid-cols-4 sm:grid-cols-6 gap-2")
            }
          >
            {linkedPhotos.slice(0, compact ? 5 : 18).map((p) => (
              <li key={p.id}>
                <Link
                  href="/photos"
                  className="block aspect-square rounded-sm overflow-hidden border border-pink-100 hover:border-pink-200"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image_url}
                    alt={p.caption || ""}
                    loading="lazy"
                    style={
                      p.rotation
                        ? { transform: `rotate(${p.rotation}deg)` }
                        : undefined
                    }
                    className="w-full h-full object-cover"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : isAdmin ? (
        <button
          type="button"
          onClick={onOpenPicker}
          disabled={pending}
          className={
            "self-start font-semibold text-pink-600 hover:text-pink-800 disabled:opacity-50 " +
            (compact ? "text-[10px]" : "text-xs")
          }
        >
          + link photos
        </button>
      ) : null}
    </div>
  );
}

function typeChipClasses(t: PinType, active: boolean): string {
  if (!active)
    return "bg-pink-50 text-pink-400 border-transparent hover:bg-pink-100 disabled:hover:bg-pink-50";
  switch (t) {
    case "travel":
      return "bg-pink-100 text-pink-800 border-pink-400";
    case "diary":
      return "bg-lavender-100 text-lavender-800 border-lavender-400";
    case "astronomy":
      return "bg-amber-100 text-amber-800 border-amber-400";
  }
}
