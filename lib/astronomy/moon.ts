import SunCalc from "suncalc";
import type { Location } from "./location";

export type MoonSnapshot = {
  iso: string;
  minutesFromNow: number;
  /** SunCalc convention: 0 = new, 0.25 = first quarter, 0.5 = full,
   *  0.75 = last quarter. Wraps in [0, 1). */
  phaseFraction: number;
  /** Fraction of disk that's illuminated (0..1). */
  illumination: number;
  /** Approximate days since the most recent new moon (0..29.53). */
  ageDays: number;
  phaseName: string;
  glyph: string;
  /** True when the moon is above the horizon at `location` at this time. */
  aboveHorizon: boolean;
  altDeg: number;
  /** That day's moonrise / moonset at `location`. */
  riseISO: string | null;
  setISO: string | null;
};

const SYNODIC_MONTH_DAYS = 29.530588853;

const PHASE_GLYPHS: Record<string, string> = {
  "new moon": "🌑",
  "waxing crescent": "🌒",
  "first quarter": "🌓",
  "waxing gibbous": "🌔",
  "full moon": "🌕",
  "waning gibbous": "🌖",
  "last quarter": "🌗",
  "waning crescent": "🌘",
};

export function moonPhaseName(fraction: number): string {
  const f = ((fraction % 1) + 1) % 1;
  if (f < 0.03 || f > 0.97) return "new moon";
  if (f < 0.22) return "waxing crescent";
  if (f < 0.28) return "first quarter";
  if (f < 0.47) return "waxing gibbous";
  if (f < 0.53) return "full moon";
  if (f < 0.72) return "waning gibbous";
  if (f < 0.78) return "last quarter";
  return "waning crescent";
}

export function moonPhaseGlyph(name: string): string {
  return PHASE_GLYPHS[name] ?? "🌙";
}

// Pure SunCalc-based current snapshot — safe to import in client bundles
// (no astronomy-engine). Phase event search lives in moon-events.ts so
// the homepage widget doesn't have to pull astronomy-engine into its
// client bundle just to render the disk + small slider.
export function moonAt(date: Date, location: Location): MoonSnapshot {
  const ill = SunCalc.getMoonIllumination(date);
  const pos = SunCalc.getMoonPosition(date, location.lat, location.lon);
  const times = SunCalc.getMoonTimes(date, location.lat, location.lon);
  const altDeg = (pos.altitude * 180) / Math.PI;
  const name = moonPhaseName(ill.phase);
  return {
    iso: date.toISOString(),
    minutesFromNow: 0,
    phaseFraction: ill.phase,
    illumination: ill.fraction,
    ageDays: ill.phase * SYNODIC_MONTH_DAYS,
    phaseName: name,
    glyph: moonPhaseGlyph(name),
    aboveHorizon: altDeg > 0,
    altDeg,
    riseISO: times.rise ? times.rise.toISOString() : null,
    setISO: times.set ? times.set.toISOString() : null,
  };
}

export function moonSnapshots(
  startDate: Date,
  endDate: Date,
  stepMinutes: number,
  location: Location,
  now: Date
): MoonSnapshot[] {
  const out: MoonSnapshot[] = [];
  const stepMs = stepMinutes * 60_000;
  for (let t = startDate.getTime(); t <= endDate.getTime(); t += stepMs) {
    const d = new Date(t);
    const snap = moonAt(d, location);
    snap.minutesFromNow = Math.round((d.getTime() - now.getTime()) / 60_000);
    out.push(snap);
  }
  return out;
}

export function nearestMoonSnapshotIndex(
  snapshots: MoonSnapshot[],
  date: Date
): number {
  let best = 0;
  let bestDiff = Number.POSITIVE_INFINITY;
  const t = date.getTime();
  for (let i = 0; i < snapshots.length; i++) {
    const diff = Math.abs(new Date(snapshots[i].iso).getTime() - t);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}
