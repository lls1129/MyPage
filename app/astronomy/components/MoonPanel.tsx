"use client";

import { useMemo, useState } from "react";
import { moonAt, type MoonSnapshot } from "@/lib/astronomy/moon";
import type { MoonPhaseEvent } from "@/lib/astronomy/moon-events";
import type { Location } from "@/lib/astronomy/location";
import { MoonDisk } from "./MoonDisk";

function fmtTime(iso: string | null, tz: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  });
}

function fmtDate(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    timeZone: tz,
  });
}

// Custom join: toLocaleString in some locales inserts the word "at"
// between the date and time ("May 7 at 14:47"), which makes the string
// long enough to wrap inside the narrow metric cards on mobile. We
// keep the natural look but drop the "at" — plain space.
function fmtDayTime(iso: string, tz: string): string {
  return `${fmtDate(iso, tz)} ${fmtTime(iso, tz)}`;
}

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
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

function relativeSliderLabel(minutes: number): string {
  const abs = Math.abs(minutes);
  if (abs < 30) return "now";
  if (abs < 60 * 24) {
    const hrs = Math.round(abs / 60);
    return minutes < 0 ? `${hrs}h ago` : `in ${hrs}h`;
  }
  const days = Math.round(abs / (60 * 24));
  if (days === 1) return minutes < 0 ? "yesterday" : "tomorrow";
  return minutes < 0 ? `${days}d ago` : `in ${days}d`;
}

// Slider granularity: minutes per tick. 5 = scrubbable in 5-min steps
// across a ~30-day window (≈8700 ticks), smoother than any reasonable
// pre-computed grid, computed on the fly so we don't ship snapshots.
const STEP_MINUTES = 5;

export function MoonPanel({
  initialSnapshot,
  startISO,
  endISO,
  nowISO,
  events,
  location,
}: {
  initialSnapshot: MoonSnapshot;
  startISO: string;
  endISO: string;
  nowISO: string;
  events: MoonPhaseEvent[];
  location: Location;
}) {
  const timezone = location.timezone;
  const startMs = useMemo(() => new Date(startISO).getTime(), [startISO]);
  const endMs = useMemo(() => new Date(endISO).getTime(), [endISO]);
  const nowMs = useMemo(() => new Date(nowISO).getTime(), [nowISO]);
  const maxTick = Math.round((endMs - startMs) / 60_000 / STEP_MINUTES);
  const nowTick = Math.round((nowMs - startMs) / 60_000 / STEP_MINUTES);

  const [tick, setTick] = useState(nowTick);
  // When set, takes precedence over the slider-derived snapshot — used
  // when the user taps a phase pill so "at" / illumination / disk all
  // reflect the EXACT event time. The slider snaps to the nearest tick
  // visually.
  const [override, setOverride] = useState<MoonSnapshot | null>(null);

  // Compute the snapshot for the slider's current position. moonAt is
  // pure suncalc — already in the bundle, cheap per call.
  const liveSnapshot = useMemo<MoonSnapshot>(() => {
    if (tick === nowTick) {
      // Use the server-rendered initial snapshot for the SSR/hydration
      // pass so there's no mismatch.
      return initialSnapshot;
    }
    const date = new Date(startMs + tick * STEP_MINUTES * 60_000);
    const snap = moonAt(date, location);
    snap.minutesFromNow = Math.round((date.getTime() - nowMs) / 60_000);
    return snap;
  }, [tick, nowTick, startMs, location, nowMs, initialSnapshot]);

  const current = override ?? liveSnapshot;

  const startLabel = useMemo(
    () =>
      new Date(startMs).toLocaleDateString([], {
        month: "short",
        day: "numeric",
        timeZone: timezone,
      }),
    [startMs, timezone]
  );
  const endLabel = useMemo(
    () =>
      new Date(endMs).toLocaleDateString([], {
        month: "short",
        day: "numeric",
        timeZone: timezone,
      }),
    [endMs, timezone]
  );

  function snapToNow() {
    setTick(nowTick);
    setOverride(null);
  }

  function snapToEvent(targetISO: string) {
    const target = new Date(targetISO);
    const targetMs = target.getTime();
    const targetTick = Math.round(
      (targetMs - startMs) / 60_000 / STEP_MINUTES
    );
    setTick(Math.max(0, Math.min(maxTick, targetTick)));
    // The slider can only land on STEP_MINUTES ticks; override carries
    // the exact-time snapshot so the display matches the event minute.
    const exact = moonAt(target, location);
    exact.minutesFromNow = Math.round((targetMs - Date.now()) / 60_000);
    setOverride(exact);
  }

  function onDragSlider(next: number) {
    setTick(next);
    setOverride(null);
  }

  return (
    <section className="rounded-lg bg-skynavy-700 border border-skynavy-500 shadow-soft text-cream p-6 md:p-8 flex flex-col gap-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="label text-pink-200">moon ✦</p>
          <p className="font-script text-cream text-3xl leading-none mt-1">
            {current.phaseName}
          </p>
          <p className="text-[11px] text-cream/55 font-semibold mt-0.5 capitalize">
            {location.name}
          </p>
        </div>
        <p className="text-xs text-cream/60 font-semibold">
          {relativeSliderLabel(current.minutesFromNow)}
        </p>
      </header>

      <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
        <div className="self-center md:self-start shrink-0">
          <MoonDisk phaseFraction={current.phaseFraction} size={200} glow />
        </div>

        <div className="grid grid-cols-2 gap-3 flex-1 min-w-0">
          <Metric
            label="illumination"
            value={`${Math.round(current.illumination * 100)}%`}
          />
          <Metric label="moon age" value={`${current.ageDays.toFixed(1)} d`} />
          <Metric
            label="moonrise"
            value={fmtTime(current.riseISO, timezone)}
          />
          <Metric
            label="moonset"
            value={fmtTime(current.setISO, timezone)}
          />
          <Metric
            label="position"
            value={
              current.aboveHorizon
                ? `${Math.round(current.altDeg)}° up`
                : "below"
            }
            sub={current.aboveHorizon ? "above horizon" : "below horizon"}
          />
          <Metric
            label="at"
            value={fmtDate(current.iso, timezone)}
            sub={fmtTime(current.iso, timezone)}
          />
        </div>
      </div>

      {/* Slider */}
      <div className="flex flex-col gap-2">
        <input
          type="range"
          min={0}
          max={maxTick}
          step={1}
          value={tick}
          onChange={(e) => onDragSlider(parseInt(e.target.value, 10))}
          aria-label="moon-phase time slider"
          className="w-full accent-pink-200"
        />
        <div className="flex items-center justify-between text-[11px] text-cream/55 font-semibold">
          <span>{startLabel}</span>
          <button
            type="button"
            onClick={snapToNow}
            className="rounded-pill px-2 py-0.5 text-[10px] uppercase tracking-wider bg-cream/10 border border-cream/20 hover:bg-cream/20 text-cream"
          >
            ↺ now
          </button>
          <span>{endLabel}</span>
        </div>
      </div>

      {/* Phase events timeline — tap any pill to jump the slider there */}
      <div>
        <p className="label text-pink-200 mb-3">
          next phases
          <span className="text-cream/40 normal-case tracking-normal ml-2 font-normal">
            tap to jump
          </span>
        </p>
        <ul className="flex flex-wrap gap-2">
          {events.map((ev) => (
            <li key={ev.iso}>
              <button
                type="button"
                onClick={() => snapToEvent(ev.iso)}
                className="lift rounded-pill bg-cream/10 border border-cream/20 hover:bg-cream/20 hover:border-cream/40 px-3 py-1.5 text-xs font-semibold flex items-center gap-2 whitespace-nowrap"
              >
                <span aria-hidden className="text-base leading-none">
                  {ev.glyph}
                </span>
                <span className="text-cream capitalize">{ev.name}</span>
                <span className="text-cream/60">·</span>
                <span className="text-cream/70">{relativeDay(ev.iso)}</span>
                <span className="text-cream/50 text-[10px]">
                  {fmtDayTime(ev.iso, timezone)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md bg-skynavy-900/60 border border-skynavy-500 px-3 py-2">
      <p className="label text-pink-200">{label}</p>
      <p className="font-script text-cream text-2xl leading-tight mt-1">
        {value}
      </p>
      {sub ? (
        <p className="text-[10px] text-cream/55 font-semibold mt-0.5">{sub}</p>
      ) : null}
    </div>
  );
}
