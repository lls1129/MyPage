"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCATION, type Location } from "@/lib/astronomy/location";
import { moonAt, type MoonSnapshot } from "@/lib/astronomy/moon";
import type { MoonPhaseEvent } from "@/lib/astronomy/moon-events";
import { MoonDisk } from "@/app/astronomy/components/MoonDisk";

const LOCATION_KEY = "myworld:astronomy:location:v1";
const RANGE_DAYS = 7;
const STEP_HOURS = 6;
const STEPS = (RANGE_DAYS * 2 * 24) / STEP_HOURS; // 56 = ±7d at 6-hour resolution
const CENTER_STEP = STEPS / 2;

function relativeDay(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  if (days === 0) {
    const hours = Math.round(ms / (60 * 60 * 1000));
    if (hours === 0) return "now";
    return hours > 0 ? `in ${hours}h` : `${-hours}h ago`;
  }
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days}d` : `${-days}d ago`;
}

export function MoonStripClient({
  initialSnapshot,
  events,
}: {
  initialSnapshot: MoonSnapshot;
  events: MoonPhaseEvent[];
}) {
  // Initial-render snapshot from the server (DEFAULT_LOCATION). After mount,
  // we read localStorage to find the user's actual astronomy location and
  // re-compute. Avoids a hydration mismatch on initial paint.
  const [location, setLocation] = useState<Location>(DEFAULT_LOCATION);
  const [stepIdx, setStepIdx] = useState(CENTER_STEP);
  const [snapshot, setSnapshot] = useState<MoonSnapshot>(initialSnapshot);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LOCATION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Location;
      if (
        parsed &&
        typeof parsed.lat === "number" &&
        typeof parsed.lon === "number" &&
        typeof parsed.timezone === "string"
      ) {
        setLocation(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  // Recompute the snapshot whenever the slider moves or location loads.
  useEffect(() => {
    const offsetHours = (stepIdx - CENTER_STEP) * STEP_HOURS;
    const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
    setSnapshot(moonAt(date, location));
  }, [stepIdx, location]);

  const nextFull = useMemo(() => {
    const now = Date.now();
    return (
      events.find((e) => e.kind === "full" && new Date(e.iso).getTime() > now) ??
      null
    );
  }, [events]);

  const isNowStep = stepIdx === CENTER_STEP;
  const offsetLabel = isNowStep ? "right now" : relativeDay(snapshot.iso);

  return (
    <section className="rounded-lg bg-skynavy-700 border border-skynavy-500 shadow-soft text-cream p-5 flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <a
          href="/astronomy"
          className="lift shrink-0 rounded-full overflow-hidden"
          title="open the astronomy page"
          aria-label="open the astronomy page"
        >
          <MoonDisk
            phaseFraction={snapshot.phaseFraction}
            size={64}
            glow
          />
        </a>
        <div className="min-w-0 flex-1">
          <p className="label text-pink-200">moon ✦</p>
          <p className="font-script text-cream text-[26px] leading-tight capitalize">
            {snapshot.phaseName}
          </p>
          <p className="text-[11px] text-cream/65 font-semibold">
            {Math.round(snapshot.illumination * 100)}% lit
            {nextFull ? (
              <>
                <span className="text-cream/40 mx-1">·</span>
                next full {relativeDay(nextFull.iso)}
              </>
            ) : null}
          </p>
        </div>
        <a
          href="/astronomy"
          className="lift rounded-pill bg-cream/10 border border-cream/20 hover:bg-cream/20 text-cream px-3 py-1.5 text-xs font-semibold whitespace-nowrap self-start"
        >
          full view →
        </a>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={STEPS}
          step={1}
          value={stepIdx}
          onChange={(e) => setStepIdx(parseInt(e.target.value, 10))}
          aria-label="walk the moon forward or back"
          className="flex-1 accent-pink-200"
        />
        <button
          type="button"
          onClick={() => setStepIdx(CENTER_STEP)}
          disabled={isNowStep}
          className="rounded-pill px-2 py-0.5 text-[10px] uppercase tracking-wider bg-cream/10 border border-cream/20 hover:bg-cream/20 text-cream disabled:opacity-40"
        >
          ↺ now
        </button>
      </div>

      <p className="text-[10px] text-cream/55 font-semibold text-center">
        {offsetLabel}
        <span className="text-cream/35 mx-1.5">·</span>
        <span className="capitalize">{location.name}</span>
      </p>
    </section>
  );
}
