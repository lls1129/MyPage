import {
  SearchMoonQuarter,
  NextMoonQuarter,
  SearchLunarEclipse,
  SearchGlobalSolarEclipse,
} from "astronomy-engine";

// astronomy-engine is heavy (~150KB). Keeping the phase-event search in
// its own file means the homepage's client bundle can pull just moon.ts
// (suncalc-only) and skip this.

export type MoonPhaseEventKind =
  | "new"
  | "first-quarter"
  | "full"
  | "last-quarter"
  | "lunar-eclipse"
  | "solar-eclipse";

export type MoonPhaseEvent = {
  kind: MoonPhaseEventKind;
  name: string;
  glyph: string;
  iso: string;
  /** Free-text detail (eclipse kind like "total", "partial") for display. */
  detail?: string;
};

const QUARTER_DEFS: { kind: MoonPhaseEventKind; name: string; glyph: string }[] = [
  { kind: "new", name: "new moon", glyph: "🌑" },
  { kind: "first-quarter", name: "first quarter", glyph: "🌓" },
  { kind: "full", name: "full moon", glyph: "🌕" },
  { kind: "last-quarter", name: "last quarter", glyph: "🌗" },
];

// Next `count` lunar quarter phase events starting from `fromDate`.
// astronomy-engine's MoonQuarter.quarter is 0..3, matching QUARTER_DEFS.
export function nextPhaseEvents(
  fromDate: Date,
  count = 4
): MoonPhaseEvent[] {
  const out: MoonPhaseEvent[] = [];
  let mq = SearchMoonQuarter(fromDate);
  while (out.length < count) {
    const def = QUARTER_DEFS[mq.quarter];
    out.push({
      kind: def.kind,
      name: def.name,
      glyph: def.glyph,
      iso: mq.time.date.toISOString(),
    });
    mq = NextMoonQuarter(mq);
  }
  return out;
}

// Next lunar + solar eclipse after `fromDate` (geocentric — eclipses
// aren't visible from every location, but the times are global). Used
// alongside the quarter phases on the moon panel so the strip has 6
// pills total.
export function nextEclipses(fromDate: Date): {
  lunar: MoonPhaseEvent | null;
  solar: MoonPhaseEvent | null;
} {
  let lunar: MoonPhaseEvent | null = null;
  let solar: MoonPhaseEvent | null = null;
  try {
    const le = SearchLunarEclipse(fromDate);
    lunar = {
      kind: "lunar-eclipse",
      name: "lunar eclipse",
      glyph: "🌚",
      iso: le.peak.date.toISOString(),
      detail: le.kind,
    };
  } catch {
    // astronomy-engine throws if it can't find one; treat as "none upcoming".
  }
  try {
    const se = SearchGlobalSolarEclipse(fromDate);
    solar = {
      kind: "solar-eclipse",
      name: "solar eclipse",
      glyph: "🌝",
      iso: se.peak.date.toISOString(),
      detail: se.kind,
    };
  } catch {
    // ignore
  }
  return { lunar, solar };
}
