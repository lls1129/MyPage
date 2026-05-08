"use client";

import { useState } from "react";

type Meal = {
  name: string;
  tagline: string;
  tags: string[];
  glyph: string;
};

const STARTER_MEALS: Meal[] = [
  {
    name: "miso butter udon",
    tagline: "warm, slurpy, 15 min",
    tags: ["cozy", "japanese", "fast"],
    glyph: "🍜",
  },
  {
    name: "tomato burrata toast",
    tagline: "summery and lazy",
    tags: ["light", "italian", "fast"],
    glyph: "🍅",
  },
  {
    name: "mushroom risotto",
    tagline: "stir, sip wine, repeat",
    tags: ["fancy", "italian", "slow"],
    glyph: "🍄",
  },
  {
    name: "scallion pancakes",
    tagline: "crispy edges = the goal",
    tags: ["cozy", "chinese", "fast"],
    glyph: "🥞",
  },
];

const MOODS = ["any", "cozy", "light", "fast", "fancy"] as const;
type Mood = (typeof MOODS)[number];

function pickFor(mood: Mood, exclude?: string): Meal {
  const pool = STARTER_MEALS.filter(
    (m) => (mood === "any" || m.tags.includes(mood)) && m.name !== exclude
  );
  const list = pool.length > 0 ? pool : STARTER_MEALS;
  return list[Math.floor(Math.random() * list.length)];
}

export function MealStrip() {
  const [mood, setMood] = useState<Mood>("any");
  const [meal, setMeal] = useState<Meal>(STARTER_MEALS[0]);

  function shuffle() {
    setMeal(pickFor(mood, meal.name));
  }
  function chooseMood(m: Mood) {
    setMood(m);
    setMeal(pickFor(m));
  }

  return (
    <section className="rounded-lg bg-white border border-pink-100 shadow-soft p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="label text-pink-600">what to eat?</span>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => chooseMood(m)}
              className={
                "rounded-pill px-3 py-1 text-xs font-semibold border transition-colors " +
                (m === mood
                  ? "bg-pink-200 text-white border-pink-200"
                  : "bg-pink-50 text-pink-800 border-pink-100 hover:border-pink-200")
              }
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-14 h-14 shrink-0 rounded-full bg-pink-50 border border-pink-100 flex items-center justify-center text-2xl">
          {meal.glyph}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-script text-pink-800 text-[26px] leading-tight">
            {meal.name}
          </div>
          <div className="text-sm text-lavender-600 font-medium">
            {meal.tagline}
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {meal.tags.map((t) => (
              <span
                key={t}
                className="text-[11px] text-pink-800 bg-pink-50 border border-pink-100 rounded-pill px-2 py-[2px] font-semibold"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={shuffle}
            className="lift rounded-pill px-4 py-2 text-sm font-semibold bg-pink-200 text-white border border-pink-200 shadow-soft hover:border-pink-400"
          >
            ↻ shuffle
          </button>
          <a
            href="/meals"
            className="lift rounded-pill px-4 py-2 text-sm font-semibold bg-white text-pink-800 border border-pink-100 hover:border-pink-200"
          >
            full picker →
          </a>
        </div>
      </div>
    </section>
  );
}
