import SunCalc from "suncalc";
import {
  Body,
  Equator,
  Horizon,
  Illumination,
  Observer,
} from "astronomy-engine";
import type { Location } from "./location";

export type AltAz = {
  altDeg: number; // 0 = horizon, 90 = zenith
  azDeg: number; // 0 = north, 90 = east, clockwise
};

export type SkyObject = {
  id: string;
  name: string;
  kind: "sun" | "moon" | "planet" | "star";
  altDeg: number;
  azDeg: number;
  /** Apparent magnitude (smaller = brighter); null when unknown. */
  magnitude: number | null;
  brightness: "bright" | "moderate" | "dim";
  /** Visible above horizon right now? */
  visible: boolean;
};

export type MoonInfo = {
  phaseFraction: number; // 0..1 (SunCalc convention: 0 new, 0.5 full)
  illumination: number; // 0..1
  phaseName: string;
  riseISO: string | null;
  setISO: string | null;
};

export type TonightSky = {
  now: Date;
  sunset: Date | null;
  sunrise: Date | null;
  moon: MoonInfo;
  objects: SkyObject[];
};

const NAMED_STARS: ReadonlyArray<{ name: string; ra: number; dec: number; mag: number }> = [
  { name: "Polaris", ra: 2.529722, dec: 89.264, mag: 1.97 },
  { name: "Vega", ra: 18.6156, dec: 38.7836, mag: 0.03 },
  { name: "Arcturus", ra: 14.2611, dec: 19.1825, mag: -0.05 },
  { name: "Sirius", ra: 6.7525, dec: -16.7161, mag: -1.46 },
  { name: "Betelgeuse", ra: 5.9195, dec: 7.4071, mag: 0.5 },
  { name: "Altair", ra: 19.8463, dec: 8.8683, mag: 0.77 },
  { name: "Antares", ra: 16.49, dec: -26.4322, mag: 1.06 },
  { name: "Capella", ra: 5.2782, dec: 45.998, mag: 0.08 },
];

const PLANETS: ReadonlyArray<{ id: keyof typeof Body | "Mercury" | "Venus" | "Mars" | "Jupiter" | "Saturn"; name: string; body: Body }> = [
  { id: "Mercury", name: "Mercury", body: Body.Mercury },
  { id: "Venus", name: "Venus", body: Body.Venus },
  { id: "Mars", name: "Mars", body: Body.Mars },
  { id: "Jupiter", name: "Jupiter", body: Body.Jupiter },
  { id: "Saturn", name: "Saturn", body: Body.Saturn },
];

function magnitudeBucket(mag: number | null): "bright" | "moderate" | "dim" {
  if (mag === null) return "moderate";
  if (mag <= 1.5) return "bright";
  if (mag <= 3.5) return "moderate";
  return "dim";
}

function moonPhaseName(fraction: number): string {
  // SunCalc phase: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter
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

function altAzForRaDec(
  raHours: number,
  decDeg: number,
  date: Date,
  location: Location
): AltAz {
  // Use astronomy-engine's Horizon helper for refraction-corrected alt/az.
  // It expects RA in hours, Dec in degrees, and an Observer.
  const observer = new Observer(location.lat, location.lon, 0);
  const horizon = Horizon(date, observer, raHours, decDeg, "normal");
  return { altDeg: horizon.altitude, azDeg: horizon.azimuth };
}

export function tonightSky(date: Date, location: Location): TonightSky {
  const sunTimes = SunCalc.getTimes(date, location.lat, location.lon);
  const sunPos = SunCalc.getPosition(date, location.lat, location.lon);
  const moonPos = SunCalc.getMoonPosition(date, location.lat, location.lon);
  const moonIll = SunCalc.getMoonIllumination(date);
  const moonTimes = SunCalc.getMoonTimes(date, location.lat, location.lon);

  const sunAltDeg = (sunPos.altitude * 180) / Math.PI;
  // SunCalc azimuth is from south, clockwise. Convert to north-clockwise.
  const sunAzDeg = (((sunPos.azimuth * 180) / Math.PI) + 180 + 360) % 360;
  const moonAltDeg = (moonPos.altitude * 180) / Math.PI;
  const moonAzDeg = (((moonPos.azimuth * 180) / Math.PI) + 180 + 360) % 360;

  const objects: SkyObject[] = [];

  objects.push({
    id: "sun",
    name: "sun",
    kind: "sun",
    altDeg: sunAltDeg,
    azDeg: sunAzDeg,
    magnitude: -26.7,
    brightness: "bright",
    visible: sunAltDeg > 0,
  });

  objects.push({
    id: "moon",
    name: "moon",
    kind: "moon",
    altDeg: moonAltDeg,
    azDeg: moonAzDeg,
    magnitude: -12.7,
    brightness: "bright",
    visible: moonAltDeg > 0,
  });

  for (const planet of PLANETS) {
    try {
      const observer = new Observer(location.lat, location.lon, 0);
      const eq = Equator(planet.body, date, observer, true, true);
      const horizon = Horizon(date, observer, eq.ra, eq.dec, "normal");
      const ill = Illumination(planet.body, date);
      const mag = ill.mag;
      objects.push({
        id: planet.id,
        name: planet.name.toLowerCase(),
        kind: "planet",
        altDeg: horizon.altitude,
        azDeg: horizon.azimuth,
        magnitude: mag,
        brightness: magnitudeBucket(mag),
        visible: horizon.altitude > 0,
      });
    } catch {
      // Skip a planet if the engine throws (shouldn't, but defensive).
    }
  }

  for (const star of NAMED_STARS) {
    const { altDeg, azDeg } = altAzForRaDec(star.ra, star.dec, date, location);
    objects.push({
      id: `star-${star.name}`,
      name: star.name.toLowerCase(),
      kind: "star",
      altDeg,
      azDeg,
      magnitude: star.mag,
      brightness: magnitudeBucket(star.mag),
      visible: altDeg > 0,
    });
  }

  return {
    now: date,
    sunset: sunTimes.sunset ?? null,
    sunrise: sunTimes.sunrise ?? null,
    moon: {
      phaseFraction: moonIll.phase,
      illumination: moonIll.fraction,
      phaseName: moonPhaseName(moonIll.phase),
      riseISO: moonTimes.rise ? moonTimes.rise.toISOString() : null,
      setISO: moonTimes.set ? moonTimes.set.toISOString() : null,
    },
    objects,
  };
}

export function formatTime(date: Date | null, timezone: string): string {
  if (!date) return "—";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
    hour12: true,
  });
}

export type SkySnapshot = {
  iso: string;
  /** Localized "8:30 PM" */
  label: string;
  /** Minutes from "now" (the original reference time) — negative for past. */
  minutesFromNow: number;
  objects: SkyObject[];
};

/**
 * Precompute a list of sky snapshots from `start` to `end` at `stepMinutes`
 * intervals. Used to drive the time-slider on the client without re-running
 * SunCalc / astronomy-engine in the browser.
 */
export function tonightSnapshots(
  start: Date,
  end: Date,
  stepMinutes: number,
  location: Location,
  reference: Date = new Date()
): SkySnapshot[] {
  const out: SkySnapshot[] = [];
  const step = stepMinutes * 60_000;
  for (let t = start.getTime(); t <= end.getTime(); t += step) {
    const date = new Date(t);
    const sky = tonightSky(date, location);
    out.push({
      iso: date.toISOString(),
      label: formatTime(date, location.timezone),
      minutesFromNow: Math.round((t - reference.getTime()) / 60_000),
      objects: sky.objects,
    });
  }
  return out;
}

/** Pick the snapshot whose time is closest to `target`. */
export function nearestSnapshotIndex(
  snapshots: SkySnapshot[],
  target: Date
): number {
  if (snapshots.length === 0) return 0;
  let bestIdx = 0;
  let bestDiff = Number.POSITIVE_INFINITY;
  const t = target.getTime();
  for (let i = 0; i < snapshots.length; i++) {
    const diff = Math.abs(new Date(snapshots[i].iso).getTime() - t);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
}
