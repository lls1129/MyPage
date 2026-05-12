import { SearchMoonQuarter, NextMoonQuarter } from "astronomy-engine";

// astronomy-engine is heavy (~150KB). Keeping the phase-event search in
// its own file means the homepage's client bundle can pull just moon.ts
// (suncalc-only) and skip this.

export type MoonPhaseEventKind =
  | "new"
  | "first-quarter"
  | "full"
  | "last-quarter";

export type MoonPhaseEvent = {
  kind: MoonPhaseEventKind;
  name: string;
  glyph: string;
  iso: string;
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
