"use client";

import { useMemo, useState } from "react";
import type { DSOObservability } from "@/lib/astronomy/deepsky";
import {
  altAtTime,
  dsoTypeGlyph,
  dsoTypeLabel,
} from "@/lib/astronomy/deepsky";
import type { Location } from "@/lib/astronomy/location";

// Slider granularity across the dark window. 2 minutes = up to ~600
// ticks for a 20h Arctic-winter night, fewer for typical nights.
const STEP_MINUTES = 2;

function fmtTime(date: Date, tz: string): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  });
}

function fmtDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

export function DeepSkyPanel({
  darkStartISO,
  darkEndISO,
  darkHours,
  nowISO,
  topTargets,
  photographicCount,
  moonNote,
  location,
}: {
  darkStartISO: string | null;
  darkEndISO: string | null;
  darkHours: number | null;
  nowISO: string;
  topTargets: DSOObservability[];
  photographicCount: number;
  moonNote: string | null;
  location: Location;
}) {
  const timezone = location.timezone;

  // No-dark-tonight branch (polar summer, etc.).
  if (!darkStartISO || !darkEndISO || darkHours === null) {
    return (
      <section className="rounded-lg bg-skynavy-700 border border-skynavy-500 shadow-soft text-cream p-6 md:p-8">
        <header className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
          <div>
            <p className="label text-pink-200">deep sky ✦</p>
            <p className="font-script text-cream text-3xl leading-none mt-1">
              no true dark tonight
            </p>
            <p className="text-[11px] text-cream/55 font-semibold mt-0.5 capitalize">
              {location.name}
            </p>
          </div>
        </header>
        <p className="text-sm text-cream/75 leading-relaxed">
          the sun doesn&apos;t dip below −18° (astronomical twilight) tonight,
          so deep-sky observation isn&apos;t practical from this location.
          this is typical at high latitudes near the summer solstice.
        </p>
      </section>
    );
  }

  const startMs = useMemo(
    () => new Date(darkStartISO).getTime(),
    [darkStartISO]
  );
  const endMs = useMemo(() => new Date(darkEndISO).getTime(), [darkEndISO]);
  const nowMs = useMemo(() => new Date(nowISO).getTime(), [nowISO]);
  const maxTick = Math.round((endMs - startMs) / 60_000 / STEP_MINUTES);
  // Initial position: now if it's inside the dark window, else 0 (dusk).
  const initialTick = useMemo(() => {
    const t = Math.round((nowMs - startMs) / 60_000 / STEP_MINUTES);
    return Math.max(0, Math.min(maxTick, t));
  }, [nowMs, startMs, maxTick]);
  const nowTick = Math.max(
    0,
    Math.min(maxTick, Math.round((nowMs - startMs) / 60_000 / STEP_MINUTES))
  );
  const nowInsideDark = nowMs >= startMs && nowMs <= endMs;

  const [tick, setTick] = useState(initialTick);

  const currentDate = useMemo(
    () => new Date(startMs + tick * STEP_MINUTES * 60_000),
    [startMs, tick]
  );

  // Per-target altitude at the slider time.
  const liveAlts = useMemo(() => {
    return topTargets.map((t) =>
      altAtTime(t.dso.ra, t.dso.dec, location.lat, location.lon, currentDate)
    );
  }, [topTargets, location.lat, location.lon, currentDate]);

  return (
    <section className="rounded-lg bg-skynavy-700 border border-skynavy-500 shadow-soft text-cream p-6 md:p-8 flex flex-col gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="label text-pink-200">deep sky tonight ✦</p>
          <p className="font-script text-cream text-3xl leading-none mt-1">
            {fmtTime(new Date(darkStartISO), timezone)} →{" "}
            {fmtTime(new Date(darkEndISO), timezone)}
          </p>
          <p className="text-[11px] text-cream/55 font-semibold mt-0.5">
            {fmtDuration(darkHours)} of true dark ·{" "}
            <span className="capitalize">{location.name}</span>
          </p>
        </div>
        {moonNote ? (
          <p className="text-xs text-cream/65 font-semibold max-w-[260px] text-right">
            🌙 {moonNote}
          </p>
        ) : null}
      </header>

      {topTargets.length === 0 ? (
        <p className="text-sm text-cream/75">
          no deep-sky targets above 25° tonight — try later in the night, or
          adjust your location.
        </p>
      ) : (
        <>
          {/* Slider — scrub through the dark window to see live altitudes */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="label text-pink-200">at</p>
              <p className="font-script text-cream text-2xl leading-none">
                {fmtTime(currentDate, timezone)}
              </p>
            </div>
            <input
              type="range"
              min={0}
              max={maxTick}
              step={1}
              value={tick}
              onChange={(e) => setTick(parseInt(e.target.value, 10))}
              aria-label="time of night"
              className="w-full accent-pink-200"
            />
            <div className="flex items-center justify-between text-[11px] text-cream/55 font-semibold">
              <span>{fmtTime(new Date(darkStartISO), timezone)} dusk</span>
              {nowInsideDark ? (
                <button
                  type="button"
                  onClick={() => setTick(nowTick)}
                  className="rounded-pill px-2 py-0.5 text-[10px] uppercase tracking-wider bg-cream/10 border border-cream/20 hover:bg-cream/20 text-cream"
                >
                  ↺ now
                </button>
              ) : null}
              <span>{fmtTime(new Date(darkEndISO), timezone)} dawn</span>
            </div>
          </div>

          <div>
            <p className="label text-pink-200 mb-3">
              best targets · live altitude at slider time
            </p>
            <ul className="flex flex-col gap-1.5">
              {topTargets.map((t, i) => {
                const liveAlt = liveAlts[i];
                const isUp = liveAlt >= 0;
                return (
                  <li
                    key={t.dso.id}
                    className={
                      "flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 px-3 rounded-md border " +
                      (isUp
                        ? "bg-skynavy-900/40 border-skynavy-500/60"
                        : "bg-skynavy-900/20 border-skynavy-500/30 opacity-60")
                    }
                  >
                    <span className="text-lg leading-none" aria-hidden>
                      {dsoTypeGlyph(t.dso.type)}
                    </span>
                    <span className="font-script text-cream text-xl leading-none">
                      {t.dso.m ? `M${t.dso.m}` : t.dso.id}
                    </span>
                    {t.dso.name ? (
                      <span className="text-sm text-cream/85">
                        · {t.dso.name}
                      </span>
                    ) : null}
                    <span className="text-[10px] uppercase tracking-wider text-pink-200/80 font-semibold">
                      {dsoTypeLabel(t.dso.type)}
                    </span>
                    <span className="flex-1" />
                    {t.dso.mag !== null ? (
                      <span className="text-xs text-cream/70 font-mono">
                        mag {t.dso.mag.toFixed(1)}
                      </span>
                    ) : null}
                    <span
                      className={
                        "text-xs font-mono " +
                        (isUp ? "text-amber-100" : "text-cream/40")
                      }
                      title={
                        isUp
                          ? "current altitude at slider time"
                          : "below horizon at this time"
                      }
                    >
                      {isUp ? `${Math.round(liveAlt)}° now` : "below"}
                    </span>
                    <span
                      className="text-xs text-cream/55 font-mono"
                      title="peak altitude during tonight's dark window"
                    >
                      peak {Math.round(t.peakAltDeg)}° @{" "}
                      {fmtTime(new Date(t.peakAtISO), timezone)}
                    </span>
                    <span className="text-[10px] text-cream/55 font-semibold uppercase">
                      {t.dso.con}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] text-cream/55 font-semibold mt-3">
              +{photographicCount} more targets workable for photography
              (mag &lt; 10, peak &gt; 35°)
            </p>
          </div>
        </>
      )}
    </section>
  );
}
