import SunCalc from "suncalc";
import { Horizon, Observer } from "astronomy-engine";
import type { Location } from "./location";
import catalog from "./deepsky-catalog.json";

// Compact per-object record loaded from the OpenNGC-derived JSON. RA in
// hours (0..24), Dec in degrees (-90..90), magnitude V (or B - 0.8 when V
// is missing), constellation 3-letter abbreviation.
export type DSO = {
  id: string;
  m: number | null;
  type: string;
  ra: number;
  dec: number;
  mag: number | null;
  con: string;
  name: string | null;
};

export const CATALOG: DSO[] = catalog as DSO[];

// Human-readable type labels + a glyph for the UI.
const TYPE_INFO: Record<string, { label: string; glyph: string }> = {
  G: { label: "galaxy", glyph: "🌌" },
  GPair: { label: "galaxy pair", glyph: "🌌" },
  GTrpl: { label: "galaxy triplet", glyph: "🌌" },
  GGroup: { label: "galaxy group", glyph: "🌌" },
  OCl: { label: "open cluster", glyph: "✦" },
  GCl: { label: "globular cluster", glyph: "●" },
  PN: { label: "planetary nebula", glyph: "💫" },
  Neb: { label: "nebula", glyph: "🌫" },
  HII: { label: "emission nebula", glyph: "🌫" },
  EmN: { label: "emission nebula", glyph: "🌫" },
  RfN: { label: "reflection nebula", glyph: "🌫" },
  "Cl+N": { label: "cluster + nebulosity", glyph: "✧" },
  SNR: { label: "supernova remnant", glyph: "💥" },
};

export function dsoTypeLabel(type: string): string {
  return TYPE_INFO[type]?.label ?? type;
}
export function dsoTypeGlyph(type: string): string {
  return TYPE_INFO[type]?.glyph ?? "✦";
}

// Tonight's astronomical-dark window for `location` (sun below −18°).
// Returns null on polar nights/summer where there's no true dark.
export function darkWindowTonight(
  now: Date,
  location: Location
): { start: Date; end: Date; hours: number } | null {
  const today = SunCalc.getTimes(now, location.lat, location.lon);
  const tomorrow = SunCalc.getTimes(
    new Date(now.getTime() + 24 * 60 * 60 * 1000),
    location.lat,
    location.lon
  );
  const start = today.night; // evening: sun goes below −18°
  const end = tomorrow.nightEnd; // morning: sun rises above −18°
  if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
    return null;
  }
  if (end.getTime() <= start.getTime()) return null;
  return {
    start,
    end,
    hours: (end.getTime() - start.getTime()) / (1000 * 60 * 60),
  };
}

// Altitude (degrees) of a DSO at a specific date/location.
export function dsoAltitude(
  dso: DSO,
  date: Date,
  location: Location
): number {
  const observer = new Observer(location.lat, location.lon, 0);
  return Horizon(date, observer, dso.ra, dso.dec, "normal").altitude;
}

export type DSOObservability = {
  dso: DSO;
  peakAltDeg: number;
  peakAtISO: string;
  // Composite score for ranking. Higher = better. Combines altitude,
  // magnitude, and moon impact.
  score: number;
};

// Sample each DSO's altitude across the dark window in `stepMin`
// increments and find the peak. Returns DSOs sorted by score (best
// first), filtered to those above `minPeakAlt`.
export function computeTonightDSOs(
  now: Date,
  location: Location,
  dark: { start: Date; end: Date },
  opts: {
    minPeakAlt?: number; // default 25°
    maxMag?: number; // default 10
    moonIllumination?: number; // 0..1, lowers scores when above 0.5
    moonAboveHorizonFraction?: number; // 0..1
    sampleMinutes?: number; // default 20
  } = {}
): DSOObservability[] {
  const minAlt = opts.minPeakAlt ?? 25;
  const maxMag = opts.maxMag ?? 10;
  const stepMs = (opts.sampleMinutes ?? 20) * 60_000;
  const moonImpact =
    (opts.moonIllumination ?? 0) * (opts.moonAboveHorizonFraction ?? 0);

  const observer = new Observer(location.lat, location.lon, 0);
  const out: DSOObservability[] = [];
  for (const dso of CATALOG) {
    if (dso.mag === null || dso.mag > maxMag) continue;
    let peakAlt = -90;
    let peakAt = dark.start.getTime();
    for (let t = dark.start.getTime(); t <= dark.end.getTime(); t += stepMs) {
      const alt = Horizon(new Date(t), observer, dso.ra, dso.dec, "normal")
        .altitude;
      if (alt > peakAlt) {
        peakAlt = alt;
        peakAt = t;
      }
    }
    if (peakAlt < minAlt) continue;
    // Score: peak altitude + brightness bonus − moon penalty.
    // mag<3 is bright, mag=8 is binocular-friendly, mag>9 is hard.
    const magBonus = (8 - dso.mag) * 3;
    const moonPenalty = moonImpact * 25; // up to −25 if full moon high
    const score = peakAlt + magBonus - moonPenalty;
    out.push({
      dso,
      peakAltDeg: peakAlt,
      peakAtISO: new Date(peakAt).toISOString(),
      score,
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}
