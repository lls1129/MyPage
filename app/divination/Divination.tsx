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
import {
  LINGQIAN,
  toChineseNumeral,
  type Lingqian,
  type Tier,
} from "@/lib/divination/lingqian";
import {
  tossOneBlock,
  readJiaoBei,
  type Face,
  type JiaoBeiOutcome,
} from "@/lib/divination/jiaobei";
import {
  ZODIAC,
  sunSignFromDate,
  ascendantFromBirth,
  pairReading,
  type ZodiacSign,
  type AscendantResult,
  type PairReading,
} from "@/lib/divination/zodiac";

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
      <LingqianPanel />
      <JiaoBeiPanel />
      <ConstellationPanel />
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

// ─────────────────────────────────────────────────────── lingqian ────────

const TIER_LABEL: Record<Tier, string> = {
  auspicious: "上 · auspicious",
  neutral: "中 · neutral",
  cautious: "下 · careful",
};

const TIER_COLOR: Record<Tier, string> = {
  auspicious: "text-amber-600",
  neutral: "text-lavender-600",
  cautious: "text-pink-600",
};

function LingqianPanel() {
  const [advanced, setAdvanced] = useState(false);
  const [idx, setIdx] = useState<number | null>(null);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    setIdx(pickDifferentIndex(LINGQIAN.length, null));
  }, []);

  function draw() {
    setRevealing(true);
    setTimeout(() => {
      setIdx((prev) => pickDifferentIndex(LINGQIAN.length, prev));
      setRevealing(false);
    }, 250);
  }

  const stick: Lingqian | null = idx === null ? null : LINGQIAN[idx];

  return (
    <ToolCard
      tint="lavender"
      label="lingqian · 灵签"
      title={advanced ? "draw the stick" : "fortune sticks"}
      onAdvanced={advanced}
      onToggleAdvanced={() => setAdvanced((v) => !v)}
      onDraw={draw}
      drawLabel={stick ? "↻ draw again" : "✦ shake the tube"}
    >
      <div
        className={
          "transition-all duration-200 " +
          (revealing ? "opacity-0 scale-95" : "opacity-100 scale-100")
        }
      >
        {stick ? (
          <>
            <div className="text-center pt-3 pb-2 flex flex-col items-center">
              <FortuneStick number={stick.n} />
              <p
                className={
                  "text-[11px] uppercase tracking-wider font-bold mt-3 " +
                  TIER_COLOR[stick.tier]
                }
              >
                {TIER_LABEL[stick.tier]}
              </p>
              <p className="font-script text-lavender-800 text-2xl leading-tight mt-1">
                {stick.title}
              </p>
            </div>
            <p className="font-serif italic text-lavender-800 text-center mt-2 leading-snug">
              &ldquo;{stick.verse}&rdquo;
            </p>
            <p className="text-sm text-ink/85 text-center font-medium mt-3">
              {stick.meaning}
            </p>

            {advanced ? (
              <div className="mt-4 pt-3 border-t border-lavender-200/60 grid grid-cols-3 gap-1.5 text-[10px] text-center">
                {(["auspicious", "neutral", "cautious"] as const).map((t) => {
                  const count = LINGQIAN.filter((l) => l.tier === t).length;
                  const here = stick.tier === t;
                  return (
                    <div
                      key={t}
                      className={
                        "rounded-md px-2 py-1.5 " +
                        (here
                          ? "bg-lavender-200 text-white font-bold"
                          : "bg-white/70 text-lavender-600 border border-lavender-200")
                      }
                    >
                      <p className="uppercase tracking-wider font-semibold">
                        {TIER_LABEL[t].split(" · ")[1]}
                      </p>
                      <p className="font-mono mt-0.5">{count} / 99</p>
                    </div>
                  );
                })}
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

function FortuneStick({ number }: { number: number }) {
  // A small bamboo-stick rendering: rounded vertical pill with the number in
  // Chinese numerals stacked top-to-bottom inside, set in Noto Serif TC so
  // the glyphs read as carved-temple Traditional Chinese rather than the
  // browser's default sans fallback.
  const characters = toChineseNumeral(number).split("");
  return (
    <div
      aria-label={`fortune stick number ${number}`}
      title={`第 ${toChineseNumeral(number)} 籤`}
      className="flex items-center justify-center rounded-full bg-gradient-to-b from-lavender-50 via-white to-lavender-100 border border-lavender-400/40 shadow-soft"
      style={{ width: 38, minHeight: 116, padding: "14px 0" }}
    >
      <div
        className="flex flex-col items-center text-lavender-800 leading-none"
        style={{
          fontFamily:
            'var(--font-noto-serif-tc), "Noto Serif TC", "Songti TC", "STSongti-TC-Regular", "STKaiti", "Kaiti TC", serif',
          fontSize: 22,
          fontWeight: 700,
          gap: 6,
        }}
      >
        {characters.map((ch, i) => (
          <span key={i}>{ch}</span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────── jiao bei ────────

function JiaoBeiPanel() {
  const [advanced, setAdvanced] = useState(false);
  const [throws, setThrows] = useState<{ left: Face; right: Face }[]>([]);
  const [revealing, setRevealing] = useState(false);

  function tossOnce() {
    setRevealing(true);
    setTimeout(() => {
      const fresh = { left: tossOneBlock(), right: tossOneBlock() };
      setThrows((prev) => (advanced ? [...prev, fresh].slice(-3) : [fresh]));
      setRevealing(false);
    }, 350);
  }

  function reset() {
    setThrows([]);
  }

  // Reset throws when toggling mode so the layout doesn't carry stale rows.
  useEffect(() => setThrows([]), [advanced]);

  // Initial toss on mount.
  useEffect(() => {
    if (throws.length === 0) {
      setThrows([{ left: tossOneBlock(), right: tossOneBlock() }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const last = throws[throws.length - 1];
  const lastOutcome: JiaoBeiOutcome | null = last
    ? readJiaoBei(last.left, last.right)
    : null;

  const yesCount = throws.filter(
    (t) => readJiaoBei(t.left, t.right).kind === "yes"
  ).length;

  return (
    <ToolCard
      tint="pink"
      label="jiaobei · 筊杯"
      title={advanced ? "ask three times" : "moon blocks"}
      onAdvanced={advanced}
      onToggleAdvanced={() => setAdvanced((v) => !v)}
      onDraw={tossOnce}
      drawLabel={
        advanced && throws.length >= 3
          ? "↻ start a new question"
          : advanced && throws.length > 0
            ? `toss ${throws.length + 1} of 3 →`
            : last
              ? "↻ toss again"
              : "✦ toss the blocks"
      }
    >
      <div
        className={
          "transition-all duration-200 " +
          (revealing ? "opacity-0 scale-95" : "opacity-100 scale-100")
        }
      >
        {advanced ? (
          <p className="text-[11px] text-pink-600 font-semibold text-center mb-2">
            hold a yes/no question in mind. three tosses confirm.
          </p>
        ) : (
          <p className="text-[11px] text-pink-600 font-semibold text-center mb-2">
            ask a yes/no question, then toss.
          </p>
        )}

        {last ? (
          <div className="flex justify-center gap-4 mb-3">
            <Crescent face={last.left} />
            <Crescent face={last.right} />
          </div>
        ) : (
          <div className="h-[80px]" />
        )}

        {lastOutcome ? (
          <>
            <p className="text-center mt-2">
              <span
                className={
                  "font-script text-2xl " +
                  (lastOutcome.kind === "yes"
                    ? "text-pink-800"
                    : lastOutcome.kind === "no"
                      ? "text-lavender-800"
                      : "text-amber-800")
                }
              >
                {lastOutcome.chinese}
              </span>
              <span className="text-[10px] uppercase tracking-wider font-bold text-pink-600 ml-2">
                {lastOutcome.english}
              </span>
            </p>
            <p className="text-sm text-ink/85 text-center font-medium mt-2">
              {lastOutcome.meaning}
            </p>
            {!advanced ? (
              <p className="font-serif italic text-pink-800 text-center mt-3 leading-snug text-sm">
                {lastOutcome.prompt}
              </p>
            ) : null}
          </>
        ) : null}

        {advanced && throws.length > 0 ? (
          <div className="mt-3 pt-3 border-t border-pink-200/60">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-pink-600 text-center mb-2">
              all three tosses
            </p>
            <ul className="flex justify-center gap-3">
              {throws.map((t, i) => {
                const o = readJiaoBei(t.left, t.right);
                return (
                  <li
                    key={i}
                    className="flex flex-col items-center gap-1 text-[10px]"
                  >
                    <div className="flex gap-0.5">
                      <Crescent face={t.left} small />
                      <Crescent face={t.right} small />
                    </div>
                    <span
                      className={
                        "uppercase tracking-wider font-semibold " +
                        (o.kind === "yes"
                          ? "text-pink-800"
                          : o.kind === "no"
                            ? "text-lavender-800"
                            : "text-amber-800")
                      }
                    >
                      {o.kind}
                    </span>
                  </li>
                );
              })}
            </ul>
            {throws.length === 3 ? (
              <>
                <p className="text-center text-sm text-ink/85 font-medium mt-3">
                  {yesCount === 3
                    ? "three yeses — the agreement is firm. proceed."
                    : yesCount === 0
                      ? "no yeses — this isn't the path. let it go."
                      : `${yesCount} yes${yesCount > 1 ? "es" : ""} of three — partial agreement. take only what's clearly affirmed.`}
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="block mx-auto mt-2 text-[11px] font-semibold text-pink-600 hover:text-pink-800"
                >
                  reset for a new question
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </ToolCard>
  );
}

function Crescent({ face, small = false }: { face: Face; small?: boolean }) {
  // Curved-up = the rounded edge faces the sky (a half-disc sitting flat).
  // Flat-up = the same shape rotated 180°. Animate the rotation on change.
  const size = small ? 26 : 64;
  const rotation = face === "flat" ? 180 : 0;
  return (
    <svg
      viewBox="0 0 60 36"
      width={size}
      height={small ? size * 0.6 : size * 0.6}
      style={{
        transform: `rotate(${rotation}deg)`,
        transition: "transform 350ms cubic-bezier(0.4,0,0.2,1)",
      }}
      role="img"
      aria-label={face === "flat" ? "flat side up" : "curved side up"}
    >
      <defs>
        <linearGradient id={`bei-${face}-${small ? "s" : "b"}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#F4C0D1" />
          <stop offset="100%" stopColor="#D4537E" />
        </linearGradient>
      </defs>
      <path
        d="M 4 30 A 26 26 0 0 1 56 30 L 4 30 Z"
        fill={`url(#bei-${face}-${small ? "s" : "b"})`}
        stroke="#993556"
        strokeWidth="1"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────── constellation ──────

function ConstellationPanel() {
  const [advanced, setAdvanced] = useState(false);
  const [birthday, setBirthday] = useState<string>("");
  const [birthTime, setBirthTime] = useState<string>("");
  const [place, setPlace] = useState<string>("");
  const [partnerBirthday, setPartnerBirthday] = useState<string>("");
  const [rising, setRising] = useState<AscendantResult | null>(null);
  const [risingError, setRisingError] = useState<string | null>(null);
  const [risingPending, setRisingPending] = useState(false);

  // Random fallback so the empty state has something to show.
  const [randomIdx, setRandomIdx] = useState<number | null>(null);
  useEffect(() => {
    setRandomIdx(pickDifferentIndex(ZODIAC.length, null));
  }, []);

  // When advanced is toggled off, drop the rising/partner state so they
  // don't linger invisibly.
  useEffect(() => {
    if (!advanced) {
      setRising(null);
      setRisingError(null);
      setPartnerBirthday("");
    }
  }, [advanced]);

  const sun = useMemo(() => sunSignFromDate(birthday), [birthday]);
  const partnerSun = useMemo(() => sunSignFromDate(partnerBirthday), [partnerBirthday]);
  const compat: PairReading | null = useMemo(
    () => (sun && partnerSun ? pairReading(sun, partnerSun) : null),
    [sun, partnerSun]
  );

  async function calculateRising() {
    setRisingError(null);
    if (!birthday || !birthTime || !place.trim()) {
      setRisingError("birthday, time, and place are all needed.");
      return;
    }
    const birthIso = `${birthday}T${birthTime}:00`;
    const birthDate = new Date(birthIso);
    if (Number.isNaN(birthDate.getTime())) {
      setRisingError("couldn't parse that birthday + time.");
      return;
    }
    setRisingPending(true);
    try {
      const url =
        `https://geocoding-api.open-meteo.com/v1/search?name=` +
        `${encodeURIComponent(place.trim())}&count=1&language=en&format=json`;
      const res = await fetch(url);
      const data = await res.json();
      const hit = Array.isArray(data?.results) ? data.results[0] : null;
      if (!hit || typeof hit.latitude !== "number" || typeof hit.longitude !== "number") {
        setRisingError(`couldn't find "${place.trim()}".`);
        setRisingPending(false);
        return;
      }
      const result = ascendantFromBirth(birthDate, hit.latitude, hit.longitude);
      if (!result) {
        setRisingError("calculation failed for those values.");
      } else {
        setRising(result);
      }
    } catch {
      setRisingError("geocoding lookup failed.");
    } finally {
      setRisingPending(false);
    }
  }

  function rollRandom() {
    setRandomIdx((prev) => pickDifferentIndex(ZODIAC.length, prev));
    setBirthday("");
    setBirthTime("");
    setPlace("");
    setPartnerBirthday("");
    setRising(null);
    setRisingError(null);
  }

  const featured: ZodiacSign | null =
    sun ?? (randomIdx === null ? null : ZODIAC[randomIdx]);
  const showingRandom = !sun && featured;

  return (
    <ToolCard
      tint="amber"
      label="constellation"
      title={advanced ? "your sky" : "zodiac"}
      onAdvanced={advanced}
      onToggleAdvanced={() => setAdvanced((v) => !v)}
      onDraw={rollRandom}
      drawLabel={sun ? "↻ random sign" : "↻ random sign"}
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-amber-600">
            birthday
          </span>
          <input
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            max="2030-12-31"
            min="1900-01-01"
            className="bg-white border border-amber-100 rounded-sm px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-amber-400"
          />
        </label>

        {featured ? (
          <SignCard sign={featured} note={showingRandom ? "(random — enter your birthday for yours)" : null} />
        ) : null}

        {advanced ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider font-bold text-amber-600">
                  birth time
                </span>
                <input
                  type="time"
                  value={birthTime}
                  onChange={(e) => setBirthTime(e.target.value)}
                  className="bg-white border border-amber-100 rounded-sm px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-amber-400"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider font-bold text-amber-600">
                  birth place
                </span>
                <input
                  type="text"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="city name"
                  className="bg-white border border-amber-100 rounded-sm px-2.5 py-1.5 text-sm text-ink placeholder:text-amber-400 focus:outline-none focus:border-amber-400"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={calculateRising}
              disabled={risingPending}
              className="self-start lift rounded-pill bg-amber-100 text-amber-800 border border-amber-400/50 shadow-soft hover:border-amber-400 px-3 py-1 text-[11px] font-semibold disabled:opacity-60"
            >
              {risingPending ? "computing…" : "✦ compute rising sign"}
            </button>

            {risingError ? (
              <p className="text-[11px] text-pink-600 font-semibold">{risingError}</p>
            ) : null}

            {rising ? (
              <div className="rounded-md bg-white/70 border border-amber-200 p-2.5">
                <p className="text-[10px] uppercase tracking-wider font-bold text-amber-600 mb-1">
                  rising sign
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl text-amber-600 leading-none">
                    {rising.sign.glyph}
                  </span>
                  <span className="font-script text-amber-800 text-xl">
                    {rising.sign.name.toLowerCase()}
                  </span>
                  <span className="text-[10px] font-mono text-amber-700 ml-auto">
                    {rising.degInSign.toFixed(1)}°
                  </span>
                </div>
                <p className="text-[11px] text-ink/80 mt-1 leading-snug">
                  the face you put on the world — how you arrive in a room.
                </p>
              </div>
            ) : null}

            <div className="border-t border-amber-200/60 pt-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider font-bold text-amber-600">
                  compare with another birthday
                </span>
                <input
                  type="date"
                  value={partnerBirthday}
                  onChange={(e) => setPartnerBirthday(e.target.value)}
                  max="2030-12-31"
                  min="1900-01-01"
                  className="bg-white border border-amber-100 rounded-sm px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-amber-400"
                />
              </label>

              {sun && partnerSun && compat ? (
                <div className="mt-2 rounded-md bg-white/70 border border-amber-200 p-2.5">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-amber-600 mb-1">
                    {sun.name.toLowerCase()} × {partnerSun.name.toLowerCase()}
                  </p>
                  <div className="flex items-baseline gap-1.5 mb-1.5 flex-wrap">
                    <span className="font-script text-amber-800 text-lg">
                      {compat.aspect}
                    </span>
                    <span className="text-[10px] font-mono text-amber-700">
                      {compat.angularDistance}°
                    </span>
                  </div>
                  <p className="text-[11px] text-ink/80 leading-snug">
                    {compat.summary}
                  </p>
                  <p className="text-[10px] text-amber-700 mt-1.5 italic">
                    {compat.elementRelation}
                  </p>
                </div>
              ) : partnerBirthday && !partnerSun ? (
                <p className="text-[11px] text-pink-600 font-semibold mt-2">
                  partner birthday couldn&apos;t be parsed.
                </p>
              ) : sun && !partnerSun && partnerBirthday ? null : !sun &&
                partnerBirthday ? (
                <p className="text-[11px] text-amber-700 mt-2">
                  enter your birthday above too.
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </ToolCard>
  );
}

function SignCard({ sign, note }: { sign: ZodiacSign; note: string | null }) {
  return (
    <div className="rounded-md bg-white/70 border border-amber-200 p-3">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl text-amber-600 leading-none">{sign.glyph}</span>
        <div>
          <p className="font-script text-amber-800 text-2xl leading-none">
            {sign.name.toLowerCase()}
          </p>
          <p className="text-[10px] text-amber-700 font-mono mt-0.5">
            {sign.dateRange}
          </p>
        </div>
      </div>
      <div className="text-[10px] text-amber-700/80 font-mono mt-2 flex flex-wrap gap-x-2">
        <span>{sign.element}</span>
        <span>·</span>
        <span>{sign.modality}</span>
        <span>·</span>
        <span>ruler {sign.ruler.toLowerCase()}</span>
      </div>
      <p className="font-serif italic text-amber-800 text-sm mt-2 leading-snug">
        {sign.vibe}
      </p>
      <p className="text-[11px] text-ink/80 mt-2 leading-snug">
        <strong className="text-amber-800">strength:</strong> {sign.strength}
      </p>
      <p className="text-[11px] text-ink/80 leading-snug">
        <strong className="text-amber-800">shadow:</strong> {sign.shadow}
      </p>
      {note ? (
        <p className="text-[10px] italic text-amber-700/80 mt-2">{note}</p>
      ) : null}
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
