"use client";

import { useEffect, useMemo, useState } from "react";
import type { Meal } from "@/lib/supabase/meals";
import { findMealImage } from "@/lib/meals/themealdb";

const MOODS = ["any", "cozy", "light", "fast", "fancy"] as const;
type Mood = (typeof MOODS)[number];

// Shared with /meals — same key, so a lookup done on one page benefits
// the other. Empty strings (failed lookups) are dropped on load.
const IMAGE_CACHE_KEY = "myworld:meals:image-cache:v2";

function tagsFor(meal: Meal): string[] {
  const out: string[] = [];
  for (const m of meal.moods) out.push(m);
  if (meal.cuisine) out.push(meal.cuisine);
  return out.slice(0, 3);
}

function pickFrom(pool: Meal[], exclude?: string): Meal {
  const filtered = pool.filter((m) => m.name !== exclude);
  const list = filtered.length > 0 ? filtered : pool;
  return list[Math.floor(Math.random() * list.length)];
}

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // swallow quota/denied
  }
}

export function MealStripClient({ meals }: { meals: Meal[] }) {
  const [mood, setMood] = useState<Mood>("any");
  const [meal, setMeal] = useState<Meal>(meals[0]);
  const [imageCache, setImageCache] = useState<Record<string, string>>({});

  useEffect(() => {
    const raw = loadJSON<Record<string, string>>(IMAGE_CACHE_KEY, {});
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v) cleaned[k] = v;
    }
    setImageCache(cleaned);
  }, []);
  useEffect(() => saveJSON(IMAGE_CACHE_KEY, imageCache), [imageCache]);

  // For library meals without an image_url, look one up via TheMealDB /
  // Wikipedia and cache. Same shape as /meals so the cache is shared.
  useEffect(() => {
    if (!meal) return;
    if (meal.image_url) return;
    if (meal.id in imageCache) return;
    let cancelled = false;
    findMealImage(meal.name).then((url) => {
      if (cancelled) return;
      if (url) {
        setImageCache((prev) => ({ ...prev, [meal.id]: url }));
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meal?.id]);

  const filteredPool = useMemo(() => {
    if (mood === "any") return meals;
    const matches = meals.filter((m) => m.moods.includes(mood));
    return matches.length > 0 ? matches : meals;
  }, [mood, meals]);

  function shuffle() {
    setMeal(pickFrom(filteredPool, meal.name));
  }
  function chooseMood(m: Mood) {
    setMood(m);
    const pool = m === "any" ? meals : meals.filter((x) => x.moods.includes(m));
    setMeal(pickFrom(pool.length > 0 ? pool : meals));
  }

  const tags = tagsFor(meal);
  const displayedImage = meal.image_url ?? imageCache[meal.id] ?? null;
  const hasImage = !!displayedImage;

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
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayedImage as string}
            alt={meal.name}
            loading="lazy"
            className="w-14 h-14 shrink-0 rounded-lg object-cover border border-pink-100"
          />
        ) : (
          <div className="w-14 h-14 shrink-0 rounded-full bg-pink-50 border border-pink-100 flex items-center justify-center text-2xl">
            {meal.glyph}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-script text-pink-800 text-[26px] leading-tight">
            {meal.name}
          </div>
          <div className="text-sm text-lavender-600 font-medium">
            {meal.tagline}
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.map((t) => (
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
