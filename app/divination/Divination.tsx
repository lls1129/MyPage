"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TAROT_MAJOR,
  SPREADS,
  type TarotCard,
  type Spread,
} from "@/lib/divination/tarot";
import {
  HEXAGRAMS,
  castSixLines,
  isYang,
  isMoving,
  type Hexagram,
  type LineValue,
} from "@/lib/divination/iching";
import {
  TRIGRAMS,
  elementCycle,
  type Trigram,
} from "@/lib/divination/bagua";

function pickDifferentIndex(length: number, current: number | null): number {
  if (length <= 1) return 0;
  let next = Math.floor(Math.random() * length);
  while (next === current) {
    next = Math.floor(Math.random() * length);
  }
  return next;
}

function pickDistinctIndices(length: number, count: number): number[] {
  const out: number[] = [];
  const used = new Set<number>();
  while (out.length < count && used.size < length) {
    const n = Math.floor(Math.random() * length);
    if (!used.has(n)) {
      used.add(n);
      out.push(n);
    }
  }
  return out;
}

export function Divination() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <TarotPanel />
      <IChingPanel />
      <BaguaPanel />
    </div>
  );
}

// ────────────────────────────────────────────────────────────── tarot ─────

type TarotDraw = { idx: number; reversed: boolean };

function TarotPanel() {
  const [advanced, setAdvanced] = useState(false);
  const [spread, setSpread] = useState<Spread>(SPREADS[0]);
  const [single, setSingle] = useState<TarotDraw | null>(null);
  const [multi, setMulti] = useState<TarotDraw[] | null>(null);
  const [revealing, setRevealing] = useState(false);

  function drawSingle() {
    const idx = pickDifferentIndex(TAROT_MAJOR.length, single?.idx ?? null);
    setSingle({ idx, reversed: Math.random() < 0.3 });
  }

  function drawMulti() {
    const ids = pickDistinctIndices(TAROT_MAJOR.length, spread.positions.length);
    setMulti(ids.map((idx) => ({ idx, reversed: Math.random() < 0.3 })));
  }

  // Initial draw on mount, and when toggling/changing spread.
  useEffect(() => {
    if (advanced) {
      drawMulti();
    } else if (!single) {
      drawSingle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanced, spread.id]);

  function reroll() {
    setRevealing(true);
    setTimeout(() => {
      if (advanced) drawMulti();
      else drawSingle();
      setRevealing(false);
    }, 250);
  }

  return (
    <ToolCard
      tint="lavender"
      label="tarot"
      title={advanced ? "tarot spread" : "major arcana"}
      onAdvanced={advanced}
      onToggleAdvanced={() => setAdvanced((v) => !v)}
      onDraw={reroll}
      drawLabel={advanced ? "↻ deal again" : single ? "↻ draw again" : "✦ draw a card"}
    >
      <div
        className={
          "transition-all duration-200 " +
          (revealing ? "opacity-0 scale-95" : "opacity-100 scale-100")
        }
      >
        {advanced ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              {SPREADS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSpread(s)}
                  className={
                    "rounded-pill px-2.5 py-1 text-[10px] font-semibold border transition-colors " +
                    (s.id === spread.id
                      ? "bg-lavender-200 text-white border-lavender-200"
                      : "bg-white text-lavender-600 border-lavender-200 hover:bg-lavender-50")
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
            {multi ? (
              <ul className="grid grid-cols-3 gap-2 mt-2">
                {multi.map((d, i) => {
                  const card = TAROT_MAJOR[d.idx];
                  return (
                    <li
                      key={i}
                      className="rounded-md bg-white/60 border border-lavender-200 p-2 flex flex-col items-center gap-1 min-h-[148px]"
                    >
                      <p className="text-[9px] uppercase tracking-wider font-bold text-lavender-600">
                        {spread.positions[i]}
                      </p>
                      <div
                        className="font-script text-lavender-400 leading-none text-3xl"
                        aria-hidden
                        style={{
                          transform: d.reversed ? "rotate(180deg)" : undefined,
                        }}
                      >
                        {card.glyph}
                      </div>
                      <p className="text-[10px] text-center font-semibold text-lavender-800 leading-tight">
                        {card.name.toLowerCase()}
                        {d.reversed ? (
                          <span className="block text-pink-600 text-[8px]">reversed</span>
                        ) : null}
                      </p>
                      <p className="text-[10px] text-center text-ink/80 leading-snug mt-1">
                        {d.reversed ? card.reversed : card.meaning}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Placeholder />
            )}
          </>
        ) : single ? (
          <SingleCardView card={TAROT_MAJOR[single.idx]} reversed={single.reversed} />
        ) : (
          <Placeholder />
        )}
      </div>
    </ToolCard>
  );
}

function SingleCardView({ card, reversed }: { card: TarotCard; reversed: boolean }) {
  return (
    <>
      <div className="text-center pt-4 pb-3">
        <div
          className="font-script text-lavender-400 leading-none"
          style={{
            fontSize: 96,
            transform: reversed ? "rotate(180deg)" : undefined,
          }}
          aria-hidden
        >
          {card.glyph}
        </div>
        <p className="text-[11px] uppercase tracking-wider font-bold text-lavender-600 mt-3">
          {card.number === 0 ? "0" : romanNumeral(card.number)} ·{" "}
          {card.name.toLowerCase()}
          {reversed ? <span className="text-pink-600"> · reversed</span> : null}
        </p>
      </div>
      <p className="text-sm text-ink/85 text-center font-medium mt-1">
        {reversed ? card.reversed : card.meaning}
      </p>
      <p className="font-serif italic text-lavender-800 text-center mt-3 leading-snug">
        {card.prompt}
      </p>
    </>
  );
}

// ─────────────────────────────────────────────────────────── i ching ──────

function IChingPanel() {
  const [advanced, setAdvanced] = useState(false);
  const [idx, setIdx] = useState<number | null>(null);
  const [lines, setLines] = useState<LineValue[] | null>(null);
  const [transformedIdx, setTransformedIdx] = useState<number | null>(null);
  const [revealing, setRevealing] = useState(false);

  function drawSimple() {
    setIdx(pickDifferentIndex(HEXAGRAMS.length, idx));
  }

  function castFull() {
    const cast = castSixLines();
    setLines(cast);
    setIdx(pickDifferentIndex(HEXAGRAMS.length, idx));
    if (cast.some(isMoving)) {
      setTransformedIdx(pickDifferentIndex(HEXAGRAMS.length, idx));
    } else {
      setTransformedIdx(null);
    }
  }

  useEffect(() => {
    if (advanced) castFull();
    else if (idx === null) drawSimple();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanced]);

  function reroll() {
    setRevealing(true);
    setTimeout(() => {
      if (advanced) castFull();
      else drawSimple();
      setRevealing(false);
    }, 250);
  }

  const hex: Hexagram | null = idx === null ? null : HEXAGRAMS[idx];
  const transformed = transformedIdx === null ? null : HEXAGRAMS[transformedIdx];

  return (
    <ToolCard
      tint="amber"
      label="i ching"
      title={advanced ? "cast the lines" : "cast a hexagram"}
      onAdvanced={advanced}
      onToggleAdvanced={() => setAdvanced((v) => !v)}
      onDraw={reroll}
      drawLabel={advanced ? "↻ cast again" : hex ? "↻ cast again" : "✦ cast a hexagram"}
    >
      <div
        className={
          "transition-all duration-200 " +
          (revealing ? "opacity-0 scale-95" : "opacity-100 scale-100")
        }
      >
        {advanced && lines && hex ? (
          <AdvancedHexagramView lines={lines} hex={hex} transformed={transformed} />
        ) : hex ? (
          <SimpleHexagramView hex={hex} />
        ) : (
          <Placeholder />
        )}
      </div>
    </ToolCard>
  );
}

function SimpleHexagramView({ hex }: { hex: Hexagram }) {
  return (
    <>
      <div className="text-center pt-4 pb-3">
        <div
          className="text-amber-600 leading-none"
          style={{ fontSize: 110, fontFamily: "ui-serif, Georgia, serif" }}
          aria-hidden
        >
          {hex.glyph}
        </div>
        <p className="text-[11px] uppercase tracking-wider font-bold text-amber-600 mt-3">
          #{hex.number} · {hex.pinyin}
        </p>
        <p className="font-script text-amber-800 text-2xl leading-none mt-1">
          {hex.name.toLowerCase()}
        </p>
      </div>
      <p className="font-serif italic text-amber-800 text-center mt-3 leading-snug">
        {hex.meaning}
      </p>
    </>
  );
}

function AdvancedHexagramView({
  lines,
  hex,
  transformed,
}: {
  lines: LineValue[];
  hex: Hexagram;
  transformed: Hexagram | null;
}) {
  const movingLineNumbers = lines
    .map((v, i) => (isMoving(v) ? i + 1 : null))
    .filter((v): v is number => v !== null);

  return (
    <div className="flex flex-col gap-3 mt-1">
      <div className="flex items-start justify-around gap-3">
        <HexagramVisualization lines={lines} hex={hex} label="cast" />
        {transformed ? (
          <>
            <span className="self-center text-amber-600 font-bold text-xl mt-12">→</span>
            <HexagramVisualization
              lines={lines.map((v) =>
                v === 6 ? 7 : v === 9 ? 8 : v
              ) as LineValue[]}
              hex={transformed}
              label="becomes"
              dim
            />
          </>
        ) : null}
      </div>

      <p className="font-serif italic text-amber-800 text-center leading-snug text-sm mt-1">
        {hex.meaning}
      </p>

      {movingLineNumbers.length > 0 ? (
        <p className="text-[11px] text-amber-700 font-semibold text-center">
          moving line{movingLineNumbers.length > 1 ? "s" : ""}:{" "}
          {movingLineNumbers.join(" · ")} — where the situation is most fluid
        </p>
      ) : (
        <p className="text-[11px] text-amber-700/70 font-semibold text-center italic">
          no moving lines — the hexagram is stable
        </p>
      )}
    </div>
  );
}

function HexagramVisualization({
  lines,
  hex,
  label,
  dim = false,
}: {
  lines: LineValue[];
  hex: Hexagram;
  label: string;
  dim?: boolean;
}) {
  // Render top to bottom (line 6 first).
  const displayLines = [...lines].reverse();
  return (
    <div
      className={
        "flex flex-col items-center gap-1.5 " + (dim ? "opacity-70" : "")
      }
    >
      <div className="flex flex-col gap-1 my-1">
        {displayLines.map((v, i) => (
          <LineBar key={i} value={v} />
        ))}
      </div>
      <p className="text-[10px] uppercase tracking-wider font-bold text-amber-600">
        {label}
      </p>
      <p className="font-script text-amber-800 text-lg leading-none">
        {hex.name.toLowerCase()}
      </p>
      <p className="text-[10px] text-amber-700 font-mono">#{hex.number}</p>
    </div>
  );
}

function LineBar({ value }: { value: LineValue }) {
  const yang = isYang(value);
  const moving = isMoving(value);
  return (
    <div className="relative flex items-center gap-1">
      {yang ? (
        <div className="w-12 h-1.5 bg-amber-800 rounded-sm" />
      ) : (
        <div className="flex gap-1">
          <div className="w-[22px] h-1.5 bg-amber-800 rounded-sm" />
          <div className="w-[22px] h-1.5 bg-amber-800 rounded-sm" />
        </div>
      )}
      {moving ? (
        <span
          className="absolute -right-3 text-[10px] font-bold text-pink-600"
          aria-label="moving line"
          title="moving line"
        >
          ✦
        </span>
      ) : null}
    </div>
  );
}

// ───────────────────────────────────────────────────────────── bagua ──────

function BaguaPanel() {
  const [advanced, setAdvanced] = useState(false);
  const [idx, setIdx] = useState<number | null>(null);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    setIdx(pickDifferentIndex(TRIGRAMS.length, null));
  }, []);

  function draw() {
    setRevealing(true);
    setTimeout(() => {
      setIdx((prev) => pickDifferentIndex(TRIGRAMS.length, prev));
      setRevealing(false);
    }, 250);
  }

  const tri: Trigram | null = idx === null ? null : TRIGRAMS[idx];
  const cycle = useMemo(() => (tri ? elementCycle(tri.pureElement) : null), [tri]);

  return (
    <ToolCard
      tint="pink"
      label="bagua"
      title={advanced ? "five-element cycle" : "eight trigrams"}
      onAdvanced={advanced}
      onToggleAdvanced={() => setAdvanced((v) => !v)}
      onDraw={draw}
      drawLabel={tri ? "↻ draw again" : "✦ pick a trigram"}
    >
      <div
        className={
          "transition-all duration-200 " +
          (revealing ? "opacity-0 scale-95" : "opacity-100 scale-100")
        }
      >
        {tri ? (
          <>
            <div className="text-center pt-4 pb-3">
              <div
                className="text-pink-600 leading-none"
                style={{ fontSize: 110, fontFamily: "ui-serif, Georgia, serif" }}
                aria-hidden
              >
                {tri.glyph}
              </div>
              <p className="text-[11px] uppercase tracking-wider font-bold text-pink-600 mt-3">
                {tri.pinyin} · {tri.english.toLowerCase()}
              </p>
              <p className="text-xs text-pink-800/70 font-mono mt-1">
                {tri.element} · {tri.family}
              </p>
            </div>
            <p className="font-serif italic text-pink-800 text-center mt-3 leading-snug">
              {tri.meaning}
            </p>

            {advanced && cycle ? (
              <div className="mt-4 pt-3 border-t border-pink-200/60 grid grid-cols-2 gap-2">
                <CycleRow
                  label="fed by"
                  element={cycle.fedBy.element}
                  verb={cycle.fedBy.verb}
                  yours={cycle.yours}
                />
                <CycleRow
                  label="feeds"
                  element={cycle.feeds.element}
                  verb={cycle.feeds.verb}
                  yours={cycle.yours}
                  reverse
                />
                <CycleRow
                  label="controlled by"
                  element={cycle.controlledBy.element}
                  verb={cycle.controlledBy.verb}
                  yours={cycle.yours}
                  warn
                />
                <CycleRow
                  label="controls"
                  element={cycle.controls.element}
                  verb={cycle.controls.verb}
                  yours={cycle.yours}
                  reverse
                  warn
                />
              </div>
            ) : null}
          </>
        ) : (
          <Placeholder />
        )}
      </div>
    </ToolCard>
  );
}

function CycleRow({
  label,
  element,
  verb,
  yours,
  reverse = false,
  warn = false,
}: {
  label: string;
  element: string;
  verb: string;
  yours: string;
  reverse?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={
        "rounded-md p-2 border " +
        (warn
          ? "bg-pink-50 border-pink-200"
          : "bg-white/70 border-pink-100")
      }
    >
      <p
        className={
          "text-[9px] uppercase tracking-wider font-bold mb-1 " +
          (warn ? "text-pink-600" : "text-pink-600")
        }
      >
        {label}
      </p>
      <p className="font-mono text-[11px] text-ink/85">
        {reverse ? (
          <>
            <span className="text-pink-800 font-semibold">{yours}</span> {verb}{" "}
            <span className="font-semibold">{element}</span>
          </>
        ) : (
          <>
            <span className="font-semibold">{element}</span> {verb}{" "}
            <span className="text-pink-800 font-semibold">{yours}</span>
          </>
        )}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────── shared chrome ────

function ToolCard({
  tint,
  label,
  title,
  drawLabel,
  onDraw,
  onAdvanced,
  onToggleAdvanced,
  children,
}: {
  tint: "lavender" | "amber" | "pink";
  label: string;
  title: string;
  drawLabel: string;
  onDraw: () => void;
  onAdvanced: boolean;
  onToggleAdvanced: () => void;
  children: React.ReactNode;
}) {
  const t = {
    lavender: {
      bg: "bg-gradient-to-br from-lavender-100/70 to-lavender-50",
      border: "border-lavender-200",
      btn: "bg-lavender-200 text-lavender-800 border-lavender-200",
      labelText: "text-lavender-600",
      titleText: "text-lavender-800",
      togglerOff: "bg-white text-lavender-600 border-lavender-200 hover:bg-lavender-50",
      togglerOn: "bg-lavender-200 text-lavender-800 border-lavender-200",
    },
    amber: {
      bg: "bg-gradient-to-br from-amber-100/60 to-amber-100/20",
      border: "border-amber-100",
      btn: "bg-amber-100 text-amber-800 border-amber-400/50",
      labelText: "text-amber-600",
      titleText: "text-amber-800",
      togglerOff: "bg-white text-amber-600 border-amber-200 hover:bg-amber-50",
      togglerOn: "bg-amber-100 text-amber-800 border-amber-400/50",
    },
    pink: {
      bg: "bg-gradient-to-br from-pink-100/70 to-pink-50",
      border: "border-pink-200",
      btn: "bg-pink-200 text-white border-pink-200",
      labelText: "text-pink-600",
      titleText: "text-pink-800",
      togglerOff: "bg-white text-pink-600 border-pink-200 hover:bg-pink-50",
      togglerOn: "bg-pink-200 text-white border-pink-200",
    },
  }[tint];

  return (
    <section
      className={`rounded-lg border-2 shadow-soft p-5 flex flex-col gap-3 min-h-[440px] ${t.bg} ${t.border}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className={`label ${t.labelText}`}>{label}</p>
          <h2 className={`font-script text-2xl leading-tight ${t.titleText}`}>
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onToggleAdvanced}
          aria-pressed={onAdvanced}
          className={
            "rounded-pill px-2.5 py-1 text-[10px] font-semibold border transition-colors " +
            (onAdvanced ? t.togglerOn : t.togglerOff)
          }
          title="toggle advanced reading"
        >
          {onAdvanced ? "✓ advanced" : "advanced"}
        </button>
      </header>

      <div className="flex-1 min-h-0">{children}</div>

      <button
        type="button"
        onClick={onDraw}
        className={`lift self-center rounded-pill border shadow-soft px-4 py-2 text-sm font-semibold ${t.btn}`}
      >
        {drawLabel}
      </button>
    </section>
  );
}

function Placeholder() {
  return (
    <div className="flex items-center justify-center h-48 text-sm text-lavender-600 font-semibold">
      shuffling…
    </div>
  );
}

const ROMAN: ReadonlyArray<[number, string]> = [
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

function romanNumeral(n: number): string {
  if (n <= 0) return "0";
  let out = "";
  let remaining = n;
  for (const [value, sym] of ROMAN) {
    while (remaining >= value) {
      out += sym;
      remaining -= value;
    }
  }
  return out;
}
