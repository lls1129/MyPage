"use client";

import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { Pin, PinBody, PinType } from "@/lib/supabase/pins";
import {
  createPin,
  updatePinNote,
  updatePinType,
  deletePin,
  clearPinsForBody,
} from "./admin-actions";
import { getPinFeed, type PinFeed } from "./feed-actions";
import { FeedCard } from "./FeedCard";

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

const TYPES: PinType[] = ["travel", "diary", "astronomy"];

// Decorative starfield using a Stars component from drei (the bigger one,
// not the one already in the prototype's old shader).

function pointToLatLon(p: [number, number, number]): { lat: number; lon: number } {
  const v = new THREE.Vector3(...p).normalize();
  return {
    lat: (Math.asin(v.y) * 180) / Math.PI,
    lon: (Math.atan2(v.z, v.x) * 180) / Math.PI,
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
  // Improve sharpness at oblique angles — matches the prototype.
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
  onClick,
}: {
  pin: Pin;
  selected: boolean;
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
      <meshBasicMaterial color={TYPE_COLORS[pin.type]} />
    </mesh>
  );
}

export function Explorer({
  initialPins,
  isAdmin,
}: {
  initialPins: Pin[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState<PinBody>("earth");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pins, setPins] = useState<Pin[]>(initialPins);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<PinFeed | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);

  // Sync state when server data changes (e.g. router.refresh() lands).
  useEffect(() => setPins(initialPins), [initialPins]);

  const currentPins = pins.filter((p) => p.body === body);
  const selected = currentPins.find((p) => p.id === selectedId) ?? null;

  // Fetch the feed when selection or its type changes; keyed on id+type so
  // changing the chip refreshes the feed.
  useEffect(() => {
    if (!selected) {
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
  }, [selected?.id, selected?.type, selected?.body]);
  const counts = {
    earth: pins.filter((p) => p.body === "earth").length,
    moon: pins.filter((p) => p.body === "moon").length,
  };

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "Action failed.");
        return;
      }
      router.refresh();
    });
  }

  function handleBodyClick(point: [number, number, number]) {
    if (!isAdmin) return;
    startTransition(async () => {
      setError(null);
      const result = await createPin({ body, type: "travel", position: point });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Optimistically add so the new pin is selectable immediately.
      const newPin: Pin = {
        id: result.id,
        body,
        type: "travel",
        position_x: point[0],
        position_y: point[1],
        position_z: point[2],
        note: "",
        created_at: new Date().toISOString(),
      };
      setPins((prev) => [newPin, ...prev]);
      setSelectedId(result.id);
      router.refresh();
    });
  }

  function handleSelectPin(id: string) {
    setSelectedId(selectedId === id ? null : id);
  }

  function handleSwitchBody(next: PinBody) {
    setBody(next);
    setSelectedId(null);
  }

  function handleSetType(type: PinType) {
    if (!selected) return;
    setPins((prev) =>
      prev.map((p) => (p.id === selected.id ? { ...p, type } : p))
    );
    run(() => updatePinType(selected.id, type));
  }

  function handleNoteSave(note: string) {
    if (!selected) return;
    setPins((prev) =>
      prev.map((p) => (p.id === selected.id ? { ...p, note } : p))
    );
    run(() => updatePinNote(selected.id, note));
  }

  function handleDeleteSelected() {
    if (!selected) return;
    if (!confirm("Delete this pin?")) return;
    const id = selected.id;
    setPins((prev) => prev.filter((p) => p.id !== id));
    setSelectedId(null);
    run(() => deletePin(id));
  }

  function handleClearAll() {
    if (!confirm(`Delete ALL ${counts[body]} pin${counts[body] === 1 ? "" : "s"} on ${body}?`))
      return;
    setPins((prev) => prev.filter((p) => p.body !== body));
    setSelectedId(null);
    run(() => clearPinsForBody(body));
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
        {isAdmin && counts[body] > 0 ? (
          <button
            type="button"
            onClick={handleClearAll}
            disabled={pending}
            className="lift rounded-pill bg-white text-pink-800 border border-pink-100 hover:border-pink-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
          >
            ✕ clear pins on {body}
          </button>
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
          camera={{ position: [0, 0, 2.8], fov: 45 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 2, 5]} intensity={1.0} />
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
          {currentPins.map((pin) => (
            <PinMesh
              key={pin.id}
              pin={pin}
              selected={pin.id === selectedId}
              onClick={() => handleSelectPin(pin.id)}
            />
          ))}
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
          ? "tap the surface to drop a pin · tap a pin to select"
          : "tap any pin to see its note"}
      </p>

      <PinPanel
        pin={selected}
        body={body}
        isAdmin={isAdmin}
        pending={pending}
        onSetType={handleSetType}
        onSaveNote={handleNoteSave}
        onDelete={handleDeleteSelected}
      />

      {selected ? (
        feedLoading ? (
          <div className="rounded-md px-4 py-3 bg-pink-50/60 border border-pink-100 text-xs text-lavender-600 font-semibold text-center">
            ✦ loading feed…
          </div>
        ) : (
          <FeedCard feed={feed} />
        )
      ) : null}

      {error ? (
        <p className="text-xs text-pink-600 font-semibold text-center">
          {error}
        </p>
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

function PinPanel({
  pin,
  body,
  isAdmin,
  pending,
  onSetType,
  onSaveNote,
  onDelete,
}: {
  pin: Pin | null;
  body: PinBody;
  isAdmin: boolean;
  pending: boolean;
  onSetType: (t: PinType) => void;
  onSaveNote: (note: string) => void;
  onDelete: () => void;
}) {
  const noteRef = useRef<HTMLTextAreaElement | null>(null);

  // Reset textarea when selection changes.
  useEffect(() => {
    if (noteRef.current) noteRef.current.value = pin?.note ?? "";
  }, [pin?.id, pin?.note]);

  if (!pin) {
    return (
      <div className="rounded-lg bg-white border border-pink-100 shadow-soft p-6 text-center text-sm text-lavender-600">
        ✿ no pin selected ·{" "}
        {isAdmin
          ? "tap anywhere on the surface to drop one"
          : "tap any pin on the globe"}
      </div>
    );
  }

  const { lat, lon } = pointToLatLon([pin.position_x, pin.position_y, pin.position_z]);
  const region = approxRegion(lat, lon, body);
  const coords = formatCoords(lat, lon);

  return (
    <div className="rounded-lg bg-white border border-pink-100 shadow-soft p-5 flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => isAdmin && onSetType(t)}
            disabled={!isAdmin || pending}
            className={
              "rounded-pill px-3 py-1.5 text-xs font-semibold border transition-colors " +
              (pin.type === t
                ? typeChipClasses(t, true)
                : typeChipClasses(t, false))
            }
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="inline-block px-3 py-1 rounded-pill bg-pink-100 text-pink-800 text-xs font-mono font-semibold w-fit">
            {coords}
          </span>
          <span className="text-xs text-lavender-600 font-semibold">{region}</span>
        </div>
        {isAdmin ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            aria-label="delete pin"
            className="w-9 h-9 rounded-full text-sm font-semibold bg-pink-100 text-pink-600 hover:bg-pink-200 transition-colors disabled:opacity-50"
          >
            ✕
          </button>
        ) : null}
      </div>

      {isAdmin ? (
        <textarea
          ref={noteRef}
          defaultValue={pin.note}
          onBlur={(e) => {
            if (e.target.value !== pin.note) onSaveNote(e.target.value);
          }}
          rows={2}
          placeholder="leave yourself a little memory…"
          className="w-full bg-pink-50 border border-pink-100 rounded-sm px-3 py-2 text-sm text-ink placeholder:text-pink-400 focus:outline-none focus:border-pink-200 resize-y"
        />
      ) : pin.note ? (
        <p className="font-serif text-ink/85 text-[15px] leading-relaxed bg-pink-50 border border-pink-100 rounded-sm px-3 py-2">
          {pin.note}
        </p>
      ) : (
        <p className="text-xs text-lavender-600 font-semibold italic">
          (no note yet)
        </p>
      )}
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
