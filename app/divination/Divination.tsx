"use client";

import { useEffect, useState } from "react";
import { TAROT_MAJOR, type TarotCard } from "@/lib/divination/tarot";
import { HEXAGRAMS, type Hexagram } from "@/lib/divination/iching";
import { TRIGRAMS, type Trigram } from "@/lib/divination/bagua";

function pickDifferentIndex(length: number, current: number | null): number {
  if (length <= 1) return 0;
  let next = Math.floor(Math.random() * length);
  while (next === current) {
    next = Math.floor(Math.random() * length);
  }
  return next;
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

function TarotPanel() {
  const [idx, setIdx] = useState<number | null>(null);
  const [revealing, setRevealing] = useState(false);
  // Defer the initial draw to mount so SSR/CSR markup matches.
  useEffect(() => {
    setIdx(pickDifferentIndex(TAROT_MAJOR.length, null));
  }, []);

  function draw() {
    setRevealing(true);
    setTimeout(() => {
      setIdx((prev) => pickDifferentIndex(TAROT_MAJOR.length, prev));
      setRevealing(false);
    }, 250);
  }

  const card: TarotCard | null = idx === null ? null : TAROT_MAJOR[idx];

  return (
    <ToolCard
      tint="lavender"
      label="tarot"
      title="major arcana"
      onDraw={draw}
      drawLabel={card ? "↻ draw again" : "✦ draw a card"}
    >
      <div
        className={
          "transition-all duration-200 " +
          (revealing ? "opacity-0 scale-95" : "opacity-100 scale-100")
        }
      >
        {card ? (
          <>
            <div className="text-center pt-4 pb-3">
              <div
                className="font-script text-lavender-400 leading-none"
                style={{ fontSize: 96 }}
                aria-hidden
              >
                {card.glyph}
              </div>
              <p className="text-[11px] uppercase tracking-wider font-bold text-lavender-600 mt-3">
                {card.number === 0 ? "0" : romanNumeral(card.number)} ·{" "}
                {card.name.toLowerCase()}
              </p>
            </div>
            <p className="text-sm text-ink/85 text-center font-medium mt-1">
              {card.meaning}
            </p>
            <p className="font-serif italic text-lavender-800 text-center mt-3 leading-snug">
              {card.prompt}
            </p>
          </>
        ) : (
          <Placeholder />
        )}
      </div>
    </ToolCard>
  );
}

function IChingPanel() {
  const [idx, setIdx] = useState<number | null>(null);
  const [revealing, setRevealing] = useState(false);
  useEffect(() => {
    setIdx(pickDifferentIndex(HEXAGRAMS.length, null));
  }, []);

  function draw() {
    setRevealing(true);
    setTimeout(() => {
      setIdx((prev) => pickDifferentIndex(HEXAGRAMS.length, prev));
      setRevealing(false);
    }, 250);
  }

  const hex: Hexagram | null = idx === null ? null : HEXAGRAMS[idx];

  return (
    <ToolCard
      tint="amber"
      label="i ching"
      title="cast a hexagram"
      onDraw={draw}
      drawLabel={hex ? "↻ cast again" : "✦ cast a hexagram"}
    >
      <div
        className={
          "transition-all duration-200 " +
          (revealing ? "opacity-0 scale-95" : "opacity-100 scale-100")
        }
      >
        {hex ? (
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
        ) : (
          <Placeholder />
        )}
      </div>
    </ToolCard>
  );
}

function BaguaPanel() {
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

  return (
    <ToolCard
      tint="pink"
      label="bagua"
      title="eight trigrams"
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
          </>
        ) : (
          <Placeholder />
        )}
      </div>
    </ToolCard>
  );
}

function ToolCard({
  tint,
  label,
  title,
  drawLabel,
  onDraw,
  children,
}: {
  tint: "lavender" | "amber" | "pink";
  label: string;
  title: string;
  drawLabel: string;
  onDraw: () => void;
  children: React.ReactNode;
}) {
  const tintStyles = {
    lavender: {
      bg: "bg-gradient-to-br from-lavender-100/70 to-lavender-50",
      border: "border-lavender-200",
      btnBg: "bg-lavender-200",
      btnText: "text-lavender-800",
      btnBorder: "border-lavender-200",
      labelText: "text-lavender-600",
      titleText: "text-lavender-800",
    },
    amber: {
      bg: "bg-gradient-to-br from-amber-100/60 to-amber-100/20",
      border: "border-amber-100",
      btnBg: "bg-amber-100",
      btnText: "text-amber-800",
      btnBorder: "border-amber-400/50",
      labelText: "text-amber-600",
      titleText: "text-amber-800",
    },
    pink: {
      bg: "bg-gradient-to-br from-pink-100/70 to-pink-50",
      border: "border-pink-200",
      btnBg: "bg-pink-200",
      btnText: "text-white",
      btnBorder: "border-pink-200",
      labelText: "text-pink-600",
      titleText: "text-pink-800",
    },
  }[tint];

  return (
    <section
      className={`rounded-lg border-2 shadow-soft p-5 flex flex-col gap-3 min-h-[420px] ${tintStyles.bg} ${tintStyles.border}`}
    >
      <header>
        <p className={`label ${tintStyles.labelText}`}>{label}</p>
        <h2 className={`font-script text-3xl leading-tight ${tintStyles.titleText}`}>
          {title}
        </h2>
      </header>

      <div className="flex-1 min-h-0">{children}</div>

      <button
        type="button"
        onClick={onDraw}
        className={`lift self-center rounded-pill border shadow-soft px-4 py-2 text-sm font-semibold ${tintStyles.btnBg} ${tintStyles.btnText} ${tintStyles.btnBorder}`}
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
