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
};

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
    return {
      id: `themealdb-${hit.idMeal}`,
      name: hit.strMeal.toLowerCase(),
      tagline: hit.strCategory ? hit.strCategory.toLowerCase() : "themealdb",
      glyph: pickGlyph(hit.strArea, hit.strCategory),
      moods: [],
      cuisine,
      time_minutes: null,
      ingredients: [],
      image_url: hit.strMealThumb,
      hidden: false,
      created_at: new Date().toISOString(),
      source: "themealdb",
    };
  } catch {
    return null;
  }
}
