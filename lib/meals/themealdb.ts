import type { Meal } from "@/lib/supabase/meals";

// TheMealDB is keyless on v1 (https://www.themealdb.com/api.php). We use it
// purely as the "surprise me" fallback when the user's filtered library is
// empty — returning a random meal mapped onto our Meal shape.

type ThemealdbMeal = {
  idMeal: string;
  strMeal: string;
  strCategory: string | null;
  strArea: string | null;
  strInstructions: string | null;
  strMealThumb: string | null;
} & Record<string, string | null>;

function pickGlyph(area: string | null, category: string | null): string {
  const k = `${area ?? ""} ${category ?? ""}`.toLowerCase();
  if (/dessert|sweet/.test(k)) return "🍰";
  if (/seafood|fish/.test(k)) return "🐟";
  if (/breakfast/.test(k)) return "🍳";
  if (/pasta/.test(k)) return "🍝";
  if (/chicken/.test(k)) return "🍗";
  if (/beef|lamb/.test(k)) return "🥩";
  if (/vegetarian|vegan/.test(k)) return "🥗";
  if (/italian/.test(k)) return "🍕";
  if (/japanese|chinese|thai/.test(k)) return "🍜";
  if (/mexican/.test(k)) return "🌮";
  if (/indian/.test(k)) return "🍛";
  return "🍽";
}

function extractIngredients(hit: ThemealdbMeal): {
  names: string[];
  detail: string[];
} {
  const names: string[] = [];
  const detail: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (hit[`strIngredient${i}`] ?? "").trim();
    const measure = (hit[`strMeasure${i}`] ?? "").trim();
    if (!name) continue;
    const lower = name.toLowerCase();
    names.push(lower);
    detail.push(measure ? `${measure} ${lower}` : lower);
  }
  return { names, detail };
}

function normalizeInstructions(raw: string | null): string | null {
  if (!raw) return null;
  // TheMealDB uses \r\n; collapse to single newlines and lowercase the
  // first letter of each sentence to match the brand voice loosely.
  return raw.replace(/\r\n/g, "\n").trim().toLowerCase();
}

// Try to find an image for a library meal by searching TheMealDB, then
// Wikipedia. Many of our seeded meals don't have an image_url; rather than
// hardcoding URLs we look one up at view-time. The full meal name often
// won't match TheMealDB exactly, so we fall back to individual significant
// words (longest first), then to a Wikipedia article search.
function buildSearchQueries(name: string): string[] {
  const queries: string[] = [name];
  const words = name.split(/\s+/).filter((w) => w.length > 3);
  words.sort((a, b) => b.length - a.length);
  for (const w of words) {
    if (!queries.includes(w)) queries.push(w);
  }
  return queries;
}

// Last-resort overrides for meals neither TheMealDB nor Wikipedia can place
// from a free-text search. Keyed by exact lowercase meal name.
const KNOWN_IMAGE_FALLBACKS: Record<string, string> = {
  "tomato burrata toast":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Burrata2.jpg/500px-Burrata2.jpg",
  "scallion pancakes":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Spring_onion_pancake_2013.JPG/500px-Spring_onion_pancake_2013.JPG",
};

async function findThemealdbImage(name: string): Promise<string | null> {
  for (const q of buildSearchQueries(name)) {
    try {
      const res = await fetch(
        `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`
      );
      if (!res.ok) continue;
      const data = (await res.json()) as {
        meals: { strMealThumb: string | null }[] | null;
      };
      const hit = data.meals?.[0];
      if (hit?.strMealThumb) return hit.strMealThumb;
    } catch {
      continue;
    }
  }
  return null;
}

async function findWikipediaImage(name: string): Promise<string | null> {
  try {
    const url =
      "https://en.wikipedia.org/w/api.php?" +
      new URLSearchParams({
        action: "query",
        generator: "search",
        gsrsearch: name,
        gsrlimit: "1",
        prop: "pageimages",
        pithumbsize: "500",
        format: "json",
        origin: "*",
      }).toString();
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      query?: {
        pages?: Record<string, { thumbnail?: { source?: string } }>;
      };
    };
    const pages = data.query?.pages ?? {};
    for (const page of Object.values(pages)) {
      const src = page?.thumbnail?.source;
      if (src) return src;
    }
    return null;
  } catch {
    return null;
  }
}

export async function findMealImage(name: string): Promise<string | null> {
  const key = name.trim().toLowerCase();
  if (KNOWN_IMAGE_FALLBACKS[key]) return KNOWN_IMAGE_FALLBACKS[key];
  const themealdb = await findThemealdbImage(name);
  if (themealdb) return themealdb;
  return findWikipediaImage(name);
}

export async function fetchSurpriseMeal(): Promise<Meal | null> {
  try {
    const res = await fetch(
      "https://www.themealdb.com/api/json/v1/1/random.php"
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { meals: ThemealdbMeal[] | null };
    const hit = data.meals?.[0];
    if (!hit) return null;
    const cuisine = (hit.strArea ?? "").toLowerCase();
    const { names, detail } = extractIngredients(hit);
    return {
      id: `themealdb-${hit.idMeal}`,
      name: hit.strMeal.toLowerCase(),
      tagline: hit.strCategory ? hit.strCategory.toLowerCase() : "themealdb",
      glyph: pickGlyph(hit.strArea, hit.strCategory),
      moods: [],
      cuisine,
      time_minutes: null,
      ingredients: names,
      ingredients_detail: detail,
      instructions: normalizeInstructions(hit.strInstructions),
      image_url: hit.strMealThumb,
      hidden: false,
      created_at: new Date().toISOString(),
      source: "themealdb",
    };
  } catch {
    return null;
  }
}
