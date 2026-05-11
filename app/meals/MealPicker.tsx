"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { Meal, MealStatus } from "@/lib/supabase/meals";
import { fetchSurpriseMeal, findMealImage } from "@/lib/meals/themealdb";
import { setMealStatus } from "./actions";

const MOODS = ["any", "cozy", "light", "fast", "fancy", "spicy", "slow"] as const;
type Mood = (typeof MOODS)[number];

type TimeBand = "any" | "under-15" | "15-30" | "30-60" | "over-60";
const TIME_BANDS: { id: TimeBand; label: string }[] = [
  { id: "any", label: "any time" },
  { id: "under-15", label: "<15 min" },
  { id: "15-30", label: "15–30" },
  { id: "30-60", label: "30–60" },
  { id: "over-60", label: "60+ min" },
];

type Pool = "all" | "want-to-try" | "favorites";

const FAV_KEY = "myworld:meals:favorites:v1";
const RECENT_KEY = "myworld:meals:recents:v1";
const SAVED_THEMEALDB_KEY = "myworld:meals:saved-themealdb:v1";
const IMAGE_CACHE_KEY = "myworld:meals:image-cache:v2";
const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function inTimeBand(minutes: number | null, band: TimeBand): boolean {
  if (band === "any") return true;
  if (minutes === null) return false;
  if (band === "under-15") return minutes < 15;
  if (band === "15-30") return minutes >= 15 && minutes < 30;
  if (band === "30-60") return minutes >= 30 && minutes < 60;
  return minutes >= 60;
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
    // out of space or denied — silently swallow
  }
}

// Break an instructions paragraph into discrete steps. TheMealDB picks
// usually include newlines between paragraphs; our library uses ". " between
// sentences. Strip any leading numbering ("1. ", "Step 2:", "- ", etc.) so
// the <ol> adds its own, and drop pure section-header lines like
// "Preparation:" / "Cooking instructions" / "Method".
const SECTION_HEADER =
  /^(recipe\s+|cooking\s+)?(preparation|instructions?|directions?|method|steps?|ingredients?|notes?|cooking)\s*:?\s*$/i;

function splitInstructions(raw: string): string[] {
  const trimmed = raw.trim();
  const source = trimmed.includes("\n")
    ? trimmed.split(/\n+/)
    : trimmed.split(/\.\s+/);

  const out: string[] = [];
  for (const part of source) {
    let t = part.trim();
    if (!t) continue;
    if (SECTION_HEADER.test(t)) continue;
    // Strip "Step N" / "STEP 2" prefix.
    t = t.replace(/^step\s*\d+\b/i, "");
    // Strip leading bullet markers.
    t = t.replace(/^[-•*]+/, "");
    // Strip leading "1" / "12" before its separator.
    t = t.replace(/^\d+(?=[\s.):])/, "");
    // Strip leftover separator punctuation/whitespace.
    t = t.replace(/^[-:.)—–\s]+/, "").trim();
    // Trim trailing periods (the <ol> + sentence rhythm reads better).
    t = t.replace(/\.+$/, "").trim();
    if (t) out.push(t);
  }
  return out;
}

type Props = {
  library: Meal[];
  statuses: Record<string, MealStatus>;
  isAdmin: boolean;
  initialMealId?: string;
};

export function MealPicker({
  library,
  statuses,
  isAdmin,
  initialMealId,
}: Props) {
  // Filter state
  const [mood, setMood] = useState<Mood>("any");
  const [cuisine, setCuisine] = useState<string>("any");
  const [timeBand, setTimeBand] = useState<TimeBand>("any");
  const [ingredient, setIngredient] = useState<string>("");
  const [pool, setPool] = useState<Pool>("all");

  // Persisted state (favorites + recents + saved themealdb meals + image cache)
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<Record<string, number>>({});
  // Snapshot favorited TheMealDB meals so they survive reload and merge into
  // the shuffle pool alongside the library.
  const [savedThemealdb, setSavedThemealdb] = useState<Record<string, Meal>>(
    {}
  );
  // Cache TheMealDB image lookups so we don't re-fetch every shuffle.
  // Sentinel "" means "looked up, no image found".
  const [imageCache, setImageCache] = useState<Record<string, string>>({});

  // Mirror of server statuses so we can show optimistic updates.
  const [statusMap, setStatusMap] =
    useState<Record<string, MealStatus>>(statuses);
  const [notesDraft, setNotesDraft] = useState<string>("");
  const [notesEditing, setNotesEditing] = useState(false);
  const [statusSaving, startStatusSave] = useTransition();
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    setFavorites(loadJSON<string[]>(FAV_KEY, []));
    const r = loadJSON<Record<string, number>>(RECENT_KEY, {});
    const cutoff = Date.now() - RECENT_WINDOW_MS;
    const cleaned: Record<string, number> = {};
    for (const [id, t] of Object.entries(r)) {
      if (t > cutoff) cleaned[id] = t;
    }
    setRecents(cleaned);
    setSavedThemealdb(loadJSON<Record<string, Meal>>(SAVED_THEMEALDB_KEY, {}));
    // Image cache: drop the empty-string "tried, no result" sentinels so
    // previously-failed lookups retry once per session against the current
    // (possibly upgraded) lookup chain. Positive URLs stay cached.
    const rawCache = loadJSON<Record<string, string>>(IMAGE_CACHE_KEY, {});
    const cleanedCache: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawCache)) {
      if (v) cleanedCache[k] = v;
    }
    setImageCache(cleanedCache);
  }, []);
  useEffect(() => saveJSON(FAV_KEY, favorites), [favorites]);
  useEffect(() => saveJSON(RECENT_KEY, recents), [recents]);
  useEffect(
    () => saveJSON(SAVED_THEMEALDB_KEY, savedThemealdb),
    [savedThemealdb]
  );
  useEffect(() => saveJSON(IMAGE_CACHE_KEY, imageCache), [imageCache]);

  // Sync server-provided statuses if they change between renders
  // (e.g. after revalidatePath).
  useEffect(() => {
    setStatusMap(statuses);
  }, [statuses]);

  // The shuffle/filter pool is library + any TheMealDB meals the user has
  // favorited (so they reappear when favorites-only is on, and can be re-shuffled).
  const fullLibrary = useMemo(() => {
    const extras = Object.values(savedThemealdb);
    if (extras.length === 0) return library;
    const seen = new Set(library.map((m) => m.id));
    return [...library, ...extras.filter((m) => !seen.has(m.id))];
  }, [library, savedThemealdb]);

  // Current pick (the meal shown). Starts unset; we choose on mount once.
  const [current, setCurrent] = useState<Meal | null>(null);
  const [surpriseLoading, setSurpriseLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset notes draft when the current meal changes.
  useEffect(() => {
    setNotesEditing(false);
    setStatusError(null);
    if (current) {
      setNotesDraft(statusMap[current.id]?.notes ?? "");
    } else {
      setNotesDraft("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const cuisines = useMemo(() => {
    const set = new Set<string>();
    for (const m of fullLibrary) if (m.cuisine) set.add(m.cuisine);
    return ["any", ...Array.from(set).sort()];
  }, [fullLibrary]);

  const eligible = useMemo(() => {
    const ingTrim = ingredient.trim().toLowerCase();
    return fullLibrary.filter((m) => {
      if (pool === "favorites" && !favorites.includes(m.id)) return false;
      if (pool === "want-to-try" && !statusMap[m.id]?.want_to_try) return false;
      if (mood !== "any" && !m.moods.includes(mood)) return false;
      if (cuisine !== "any" && m.cuisine !== cuisine) return false;
      if (!inTimeBand(m.time_minutes, timeBand)) return false;
      if (ingTrim) {
        const haystack = [
          m.name,
          m.tagline,
          m.cuisine,
          ...m.ingredients,
          ...m.ingredients_detail,
          m.instructions ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(ingTrim)) return false;
      }
      return true;
    });
  }, [
    fullLibrary,
    pool,
    favorites,
    statusMap,
    mood,
    cuisine,
    timeBand,
    ingredient,
  ]);

  // The freshly-eligible pool: filter eligible, then push down anything
  // recently shown so it floats to the back of the queue.
  const fresh = useMemo(() => {
    const cutoff = Date.now() - RECENT_WINDOW_MS;
    return eligible.filter((m) => !recents[m.id] || recents[m.id] < cutoff);
  }, [eligible, recents]);

  function recordShow(id: string) {
    setRecents((prev) => ({ ...prev, [id]: Date.now() }));
  }

  function pickFromPool(srcPool: Meal[]): Meal | null {
    if (srcPool.length === 0) return null;
    if (srcPool.length === 1) return srcPool[0];
    let next: Meal;
    let safety = 6;
    do {
      next = srcPool[Math.floor(Math.random() * srcPool.length)];
      safety--;
    } while (next.id === current?.id && safety > 0);
    return next;
  }

  function shuffle() {
    setError(null);
    const sourcePool = fresh.length > 0 ? fresh : eligible;
    const next = pickFromPool(sourcePool);
    if (next) {
      setCurrent(next);
      recordShow(next.id);
    } else {
      surpriseMe();
    }
  }

  async function surpriseMe() {
    setError(null);
    setSurpriseLoading(true);
    const meal = await fetchSurpriseMeal();
    setSurpriseLoading(false);
    if (!meal) {
      setError("themealdb didn't answer — try shuffle instead.");
      return;
    }
    setCurrent(meal);
  }

  function toggleFavorite(meal: Meal) {
    const id = meal.id;
    const wasFavorite = favorites.includes(id);
    setFavorites((prev) =>
      wasFavorite ? prev.filter((x) => x !== id) : [...prev, id]
    );
    if (meal.source === "themealdb") {
      setSavedThemealdb((prev) => {
        if (wasFavorite) {
          const next = { ...prev };
          delete next[id];
          return next;
        }
        return { ...prev, [id]: meal };
      });
    }
  }

  // Apply a status patch optimistically, then persist via server action.
  // The server returns the canonical row which we re-sync into state.
  function patchStatus(
    meal: Meal,
    patch: Partial<Omit<MealStatus, "meal_id" | "updated_at">>
  ) {
    const mealId = meal.id;
    setStatusError(null);
    setStatusMap((prev) => {
      const existing: MealStatus = prev[mealId] ?? {
        meal_id: mealId,
        tried: false,
        want_to_try: false,
        rating: null,
        notes: null,
        updated_at: new Date().toISOString(),
      };
      return {
        ...prev,
        [mealId]: { ...existing, ...patch, updated_at: new Date().toISOString() },
      };
    });
    // TheMealDB meals only live in localStorage until favorited. If the
    // user marks one tried/on-my-list/rated/noted, snapshot it so the meal
    // shows up again on next load (otherwise the status row would orphan).
    if (meal.source === "themealdb" && !(mealId in savedThemealdb)) {
      setSavedThemealdb((prev) => ({ ...prev, [mealId]: meal }));
    }
    startStatusSave(async () => {
      try {
        const res = await setMealStatus({
          mealId,
          tried: patch.tried,
          wantToTry: patch.want_to_try,
          rating: patch.rating,
          notes: patch.notes,
        });
        if (!res.ok) {
          setStatusError(res.message);
        } else {
          setStatusMap((prev) => ({ ...prev, [mealId]: res.status }));
        }
      } catch (e) {
        setStatusError(
          e instanceof Error ? e.message : "couldn’t reach the server."
        );
      }
    });
  }

  // Initial pick on mount. If the URL carried ?id=…, try to land on that
  // exact meal (deep-link from the homepage widget); otherwise pick at random.
  useEffect(() => {
    if (current !== null || fullLibrary.length === 0) return;
    const requested = initialMealId
      ? fullLibrary.find((m) => m.id === initialMealId)
      : null;
    const next = requested ?? pickFromPool(fullLibrary);
    if (next) {
      setCurrent(next);
      recordShow(next.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullLibrary]);

  // For library meals without an image_url, look one up via TheMealDB
  // search and cache the result. Sentinel "" means we tried and got nothing.
  useEffect(() => {
    if (!current) return;
    if (current.source !== "library") return;
    if (current.image_url) return;
    if (current.id in imageCache) return;
    let cancelled = false;
    findMealImage(current.name).then((url) => {
      if (cancelled) return;
      setImageCache((prev) => ({ ...prev, [current.id]: url ?? "" }));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // If filters change and current is no longer eligible, swap.
  useEffect(() => {
    if (
      current &&
      !eligible.find((m) => m.id === current.id) &&
      eligible.length > 0
    ) {
      const next = pickFromPool(fresh.length > 0 ? fresh : eligible);
      if (next) {
        setCurrent(next);
        recordShow(next.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible]);

  const isFavorite = current ? favorites.includes(current.id) : false;
  const currentStatus = current ? statusMap[current.id] ?? null : null;
  const displayedImage = current
    ? current.image_url ?? imageCache[current.id] ?? null
    : null;
  const hasDisplayImage = !!displayedImage && displayedImage !== "";

  // Pool counts (for the segmented control labels).
  const poolCounts = useMemo(() => {
    let wantToTry = 0;
    let favs = 0;
    for (const m of fullLibrary) {
      if (statusMap[m.id]?.want_to_try) wantToTry++;
      if (favorites.includes(m.id)) favs++;
    }
    return { all: fullLibrary.length, wantToTry, favs };
  }, [fullLibrary, statusMap, favorites]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <section className="rounded-lg bg-white border border-pink-100 shadow-soft p-4 md:p-5 flex flex-col gap-4">
        <FilterRow label="mood">
          {MOODS.map((m) => (
            <FilterChip
              key={m}
              active={mood === m}
              onClick={() => setMood(m)}
              label={m}
            />
          ))}
        </FilterRow>

        <FilterRow label="time">
          {TIME_BANDS.map((b) => (
            <FilterChip
              key={b.id}
              active={timeBand === b.id}
              onClick={() => setTimeBand(b.id)}
              label={b.label}
            />
          ))}
        </FilterRow>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="label text-pink-600">cuisine</span>
            <select
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              className="bg-pink-50 border border-pink-100 rounded-sm px-3 py-2 text-sm text-ink focus:outline-none focus:border-pink-200"
            >
              {cuisines.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="label text-pink-600">ingredient</span>
              {ingredient.trim() ? (
                <span className="text-[11px] text-lavender-600 font-semibold">
                  {eligible.length} match{eligible.length === 1 ? "" : "es"}
                </span>
              ) : null}
            </div>
            <input
              type="text"
              value={ingredient}
              onChange={(e) => setIngredient(e.target.value)}
              placeholder="e.g. tofu, noodles, basil"
              className="bg-pink-50 border border-pink-100 rounded-sm px-3 py-2 text-sm text-ink placeholder:text-pink-400 focus:outline-none focus:border-pink-200"
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <span className="label text-pink-600">pool</span>
            <div className="inline-flex flex-wrap gap-1.5">
              <FilterChip
                active={pool === "all"}
                onClick={() => setPool("all")}
                label={`all (${poolCounts.all})`}
              />
              <FilterChip
                active={pool === "want-to-try"}
                onClick={() => setPool("want-to-try")}
                label={`✿ on my list (${poolCounts.wantToTry})`}
              />
              <FilterChip
                active={pool === "favorites"}
                onClick={() => setPool("favorites")}
                label={`♥ favorites (${poolCounts.favs})`}
              />
            </div>
          </div>
          <p className="text-[11px] text-lavender-600 font-semibold">
            {eligible.length} match
            {eligible.length === 1 ? "" : "es"} · {fresh.length} fresh
          </p>
        </div>

        {pool === "favorites" ? (
          <p className="text-[11px] text-lavender-600 italic">
            ♥ favorites is per-device — switch to <strong>all</strong> to
            browse new meals and tap ♡ favorite to add them here.
          </p>
        ) : null}
        {pool === "want-to-try" && poolCounts.wantToTry === 0 ? (
          <p className="text-[11px] text-lavender-600 italic">
            nothing on your list yet — switch to <strong>all</strong> and tap
            <strong> + on my list </strong>on meals you want to make.
          </p>
        ) : null}
      </section>

      {/* Current pick */}
      <section className="rounded-lg bg-white border border-pink-100 shadow-soft p-6 md:p-8 flex flex-col gap-6">
        {current ? (
          <>
            <div className="flex flex-col md:flex-row md:items-start gap-5 md:gap-7">
              {hasDisplayImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayedImage as string}
                  alt={current.name}
                  loading="lazy"
                  className="w-full md:w-60 md:shrink-0 aspect-square object-cover rounded-lg border border-pink-100"
                />
              ) : (
                <div className="w-32 h-32 md:w-36 md:h-36 md:shrink-0 mx-auto md:mx-0 rounded-full bg-pink-50 border border-pink-100 flex items-center justify-center text-5xl">
                  {current.glyph || "🍽"}
                </div>
              )}

              <div className="min-w-0 flex-1 flex flex-col gap-4">
                <div>
                  <p className="font-script text-pink-800 text-[32px] md:text-[40px] leading-tight">
                    {current.name}
                  </p>
                  {current.tagline ? (
                    <p className="text-sm text-lavender-600 font-medium">
                      {current.tagline}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {current.cuisine ? (
                      <Tag tint="pink">{current.cuisine}</Tag>
                    ) : null}
                    {current.time_minutes !== null ? (
                      <Tag tint="lavender">{current.time_minutes} min</Tag>
                    ) : null}
                    {current.moods.map((m) => (
                      <Tag key={m} tint="amber">
                        {m}
                      </Tag>
                    ))}
                    {current.source === "themealdb" ? (
                      <Tag tint="lavender">from themealdb</Tag>
                    ) : null}
                  </div>
                </div>

                <StatusRow
                  status={currentStatus}
                  isAdmin={isAdmin}
                  saving={statusSaving}
                  onTriedToggle={() =>
                    patchStatus(current, {
                      tried: !(currentStatus?.tried ?? false),
                    })
                  }
                  onWantToTryToggle={() =>
                    patchStatus(current, {
                      want_to_try: !(currentStatus?.want_to_try ?? false),
                    })
                  }
                  onRatingChange={(r) =>
                    patchStatus(current, {
                      rating: currentStatus?.rating === r ? null : r,
                    })
                  }
                />

                {current.ingredients_detail.length > 0 ? (
                  <div>
                    <p className="label text-pink-600 mb-2">ingredients</p>
                    <ul className="text-sm text-ink/80 space-y-1 columns-1 sm:columns-2 md:columns-1 lg:columns-2 gap-x-6">
                      {current.ingredients_detail.map((it, i) => (
                        <li
                          key={i}
                          className="leading-snug flex gap-2 break-inside-avoid"
                        >
                          <span className="text-pink-300 shrink-0">·</span>
                          <span>{it}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : current.ingredients.length > 0 ? (
                  <div>
                    <p className="label text-pink-600 mb-2">ingredients</p>
                    <p className="text-[11px] text-ink/65 font-mono">
                      {current.ingredients.join(" · ")}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            {current.instructions ? (
              <div className="pt-4 border-t border-pink-50">
                <p className="label text-pink-600 mb-2">how to</p>
                <ol className="text-sm text-ink/80 leading-relaxed space-y-2 list-decimal pl-5 marker:text-pink-400 marker:font-semibold">
                  {splitInstructions(current.instructions).map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            ) : null}

            <NotesSection
              status={currentStatus}
              isAdmin={isAdmin}
              draft={notesDraft}
              setDraft={setNotesDraft}
              editing={notesEditing}
              setEditing={setNotesEditing}
              saving={statusSaving}
              onSave={() =>
                patchStatus(current, {
                  notes: notesDraft.trim() === "" ? null : notesDraft.trim(),
                })
              }
            />

            {statusError ? (
              <p className="text-xs text-pink-600 font-semibold">
                couldn’t save status: {statusError}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={shuffle}
                className="lift rounded-pill bg-pink-200 text-white border border-pink-200 shadow-soft hover:border-pink-400 px-4 py-2 text-sm font-semibold"
              >
                ↻ shuffle
              </button>
              <button
                type="button"
                onClick={surpriseMe}
                disabled={surpriseLoading}
                title="random recipe from themealdb"
                className="lift rounded-pill bg-white text-pink-800 border border-pink-100 hover:border-pink-200 px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {surpriseLoading ? "asking…" : "✦ surprise me"}
              </button>
              <button
                type="button"
                onClick={() => toggleFavorite(current)}
                title={isFavorite ? "remove from favorites" : "save to favorites"}
                className={
                  "lift rounded-pill border shadow-soft px-4 py-2 text-sm font-semibold " +
                  (isFavorite
                    ? "bg-pink-100 text-pink-800 border-pink-400"
                    : "bg-white text-pink-800 border-pink-100 hover:border-pink-200")
                }
              >
                {isFavorite ? "♥ saved" : "♡ favorite"}
              </button>
              {error ? (
                <span className="text-xs text-pink-600 font-semibold">{error}</span>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-center text-sm text-lavender-600">
            no meals match yet — try clearing a filter, or ✦ surprise me.
          </p>
        )}
      </section>
    </div>
  );
}

function StatusRow({
  status,
  isAdmin,
  saving,
  onTriedToggle,
  onWantToTryToggle,
  onRatingChange,
}: {
  status: MealStatus | null;
  isAdmin: boolean;
  saving: boolean;
  onTriedToggle: () => void;
  onWantToTryToggle: () => void;
  onRatingChange: (n: number) => void;
}) {
  const tried = status?.tried ?? false;
  const wantToTry = status?.want_to_try ?? false;
  const rating = status?.rating ?? 0;

  // Public viewers: only show pills/stars that are actually set
  if (!isAdmin) {
    const anything = tried || wantToTry || rating > 0;
    if (!anything) return null;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {tried ? <StatusPill tone="solid">✓ tried</StatusPill> : null}
        {wantToTry ? (
          <StatusPill tone="soft">✿ on my list</StatusPill>
        ) : null}
        {rating > 0 ? <Stars value={rating} /> : null}
      </div>
    );
  }
  // Admin: always render all controls so they're easy to toggle.
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onTriedToggle}
        disabled={saving}
        className={
          "rounded-pill px-3 py-1 text-xs font-semibold border transition-colors disabled:opacity-60 " +
          (tried
            ? "bg-pink-200 text-white border-pink-200"
            : "bg-pink-50 text-pink-800 border-pink-100 hover:border-pink-200")
        }
      >
        {tried ? "✓ tried" : "○ tried"}
      </button>
      <button
        type="button"
        onClick={onWantToTryToggle}
        disabled={saving}
        className={
          "rounded-pill px-3 py-1 text-xs font-semibold border transition-colors disabled:opacity-60 " +
          (wantToTry
            ? "bg-lavender-200 text-white border-lavender-200"
            : "bg-lavender-50 text-lavender-800 border-lavender-100 hover:border-lavender-200")
        }
      >
        {wantToTry ? "✿ on my list" : "+ on my list"}
      </button>
      <Stars value={rating} onChange={onRatingChange} disabled={saving} />
    </div>
  );
}

function Stars({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange?: (n: number) => void;
  disabled?: boolean;
}) {
  const interactive = !!onChange;
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        if (!interactive) {
          return (
            <span
              key={n}
              className={
                "text-base " + (filled ? "text-amber-400" : "text-pink-200")
              }
            >
              {filled ? "★" : "☆"}
            </span>
          );
        }
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange!(n)}
            disabled={disabled}
            aria-label={`rate ${n} star${n === 1 ? "" : "s"}`}
            className={
              "text-lg leading-none px-0.5 disabled:opacity-60 " +
              (filled ? "text-amber-400" : "text-pink-200 hover:text-pink-400")
            }
          >
            {filled ? "★" : "☆"}
          </button>
        );
      })}
    </div>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: "solid" | "soft";
  children: React.ReactNode;
}) {
  const cls =
    tone === "solid"
      ? "bg-pink-200 text-white border-pink-200"
      : "bg-lavender-50 text-lavender-800 border-lavender-200";
  return (
    <span
      className={`text-[11px] font-semibold rounded-pill px-2.5 py-[2px] border ${cls}`}
    >
      {children}
    </span>
  );
}

function NotesSection({
  status,
  isAdmin,
  draft,
  setDraft,
  editing,
  setEditing,
  saving,
  onSave,
}: {
  status: MealStatus | null;
  isAdmin: boolean;
  draft: string;
  setDraft: (s: string) => void;
  editing: boolean;
  setEditing: (b: boolean) => void;
  saving: boolean;
  onSave: () => void;
}) {
  const stored = status?.notes ?? "";

  // Public viewer with no notes: render nothing.
  if (!isAdmin && !stored) return null;

  // Public viewer with notes: read-only.
  if (!isAdmin) {
    return (
      <div className="pt-4 border-t border-pink-50">
        <p className="label text-pink-600 mb-2">notes</p>
        <p className="text-sm text-ink/80 whitespace-pre-line leading-relaxed">
          {stored}
        </p>
      </div>
    );
  }

  // Admin idle (not editing): show the stored note (or an "add" affordance).
  if (!editing) {
    return (
      <div className="pt-4 border-t border-pink-50">
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <p className="label text-pink-600">notes</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11px] text-pink-600 font-semibold hover:underline"
          >
            {stored ? "edit ✎" : "add a note +"}
          </button>
        </div>
        {stored ? (
          <p className="text-sm text-ink/80 whitespace-pre-line leading-relaxed">
            {stored}
          </p>
        ) : (
          <p className="text-sm text-lavender-600 italic">no notes yet.</p>
        )}
      </div>
    );
  }

  // Admin editing: textarea + save/cancel.
  return (
    <div className="pt-4 border-t border-pink-50">
      <p className="label text-pink-600 mb-2">notes</p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="how it went, what to change next time…"
        rows={3}
        className="w-full bg-pink-50 border border-pink-100 rounded-sm px-3 py-2 text-sm text-ink placeholder:text-pink-400 focus:outline-none focus:border-pink-200 resize-y"
      />
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          onClick={() => {
            onSave();
            setEditing(false);
          }}
          disabled={saving}
          className="rounded-pill bg-pink-200 text-white border border-pink-200 px-3 py-1 text-xs font-semibold disabled:opacity-60"
        >
          {saving ? "saving…" : "save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(stored);
            setEditing(false);
          }}
          disabled={saving}
          className="rounded-pill bg-white text-pink-800 border border-pink-100 px-3 py-1 text-xs font-semibold disabled:opacity-60"
        >
          cancel
        </button>
      </div>
    </div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label text-pink-600">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "rounded-pill px-3 py-1 text-xs font-semibold border transition-colors " +
        (active
          ? "bg-pink-200 text-white border-pink-200 shadow-soft"
          : "bg-pink-50 text-pink-800 border-pink-100 hover:border-pink-200")
      }
    >
      {label}
    </button>
  );
}

function Tag({
  tint,
  children,
}: {
  tint: "pink" | "lavender" | "amber";
  children: React.ReactNode;
}) {
  const cls =
    tint === "pink"
      ? "bg-pink-100 text-pink-800 border-pink-200"
      : tint === "lavender"
        ? "bg-lavender-50 text-lavender-800 border-lavender-200"
        : "bg-amber-100/70 text-amber-800 border-amber-400/40";
  return (
    <span
      className={`text-[10px] uppercase tracking-wider font-semibold rounded-pill px-2 py-[2px] border ${cls}`}
    >
      {children}
    </span>
  );
}
