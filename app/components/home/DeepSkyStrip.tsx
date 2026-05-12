import SunCalc from "suncalc";
import { DEFAULT_LOCATION } from "@/lib/astronomy/location";
import {
  computeTonightDSOs,
  darkWindowTonight,
  dsoTypeGlyph,
} from "@/lib/astronomy/deepsky";
import { moonAt } from "@/lib/astronomy/moon";

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

// Static "tonight's best" preview at DEFAULT_LOCATION. The full panel on
// /astronomy supports per-user location + a time slider; the homepage
// widget is intentionally simple — three picks and a click-through.
export function DeepSkyStrip() {
  const now = new Date();
  const dark = darkWindowTonight(now, DEFAULT_LOCATION);
  if (!dark) return null;

  // Same moon-impact calc as the full panel so ranking matches.
  const moon = moonAt(now, DEFAULT_LOCATION);
  let moonUp = 0;
  let moonSamples = 0;
  for (
    let t = dark.start.getTime();
    t <= dark.end.getTime();
    t += 30 * 60_000
  ) {
    const pos = SunCalc.getMoonPosition(
      new Date(t),
      DEFAULT_LOCATION.lat,
      DEFAULT_LOCATION.lon
    );
    moonSamples++;
    if (pos.altitude > 0) moonUp++;
  }
  const moonAboveFrac = moonSamples > 0 ? moonUp / moonSamples : 0;

  const top = computeTonightDSOs(now, DEFAULT_LOCATION, dark, {
    minPeakAlt: 30,
    maxMag: 8,
    moonIllumination: moon.illumination,
    moonAboveHorizonFraction: moonAboveFrac,
  }).slice(0, 3);

  if (top.length === 0) return null;

  const tz = DEFAULT_LOCATION.timezone;

  return (
    <section className="rounded-lg bg-skynavy-700 border border-skynavy-500 shadow-soft text-cream p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="label text-pink-200">deep sky tonight ✦</p>
          <p className="font-script text-cream text-[22px] leading-tight mt-0.5">
            {fmtTime(dark.start, tz)} → {fmtTime(dark.end, tz)}
          </p>
          <p className="text-[11px] text-cream/55 font-semibold mt-0.5">
            {fmtDuration(dark.hours)} of true dark · santa clara
          </p>
        </div>
        <a
          href="/astronomy"
          className="lift rounded-pill bg-cream/10 border border-cream/20 hover:bg-cream/20 text-cream px-3 py-1.5 text-xs font-semibold whitespace-nowrap self-start"
        >
          full forecast →
        </a>
      </div>

      <ul className="flex flex-col gap-1">
        {top.map((t) => (
          <li
            key={t.dso.id}
            className="flex items-baseline gap-2 flex-wrap text-sm"
          >
            <span aria-hidden className="text-base leading-none">
              {dsoTypeGlyph(t.dso.type)}
            </span>
            <span className="font-script text-cream text-lg leading-none">
              {t.dso.m ? `M${t.dso.m}` : t.dso.id}
            </span>
            {t.dso.name ? (
              <span className="text-cream/80 text-xs truncate">
                · {t.dso.name}
              </span>
            ) : null}
            <span className="flex-1" />
            <span className="text-xs text-cream/65 font-mono whitespace-nowrap">
              {Math.round(t.peakAltDeg)}° @ {fmtTime(new Date(t.peakAtISO), tz)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
