import { readSupabaseEnv } from "./env";
import { createClient } from "./server";

export type Meal = {
  id: string;
  name: string;
  tagline: string;
  glyph: string;
  moods: string[];
  cuisine: string;
  time_minutes: number | null;
  ingredients: string[];
  ingredients_detail: string[];
  instructions: string | null;
  image_url: string | null;
  hidden: boolean;
  created_at: string;
  source?: "library" | "themealdb";
};

export type MealsResult =
  | { kind: "ok"; meals: Meal[] }
  | { kind: "unconfigured" }
  | { kind: "schema-missing" }
  | { kind: "error"; message: string };

export type MealStatus = {
  meal_id: string;
  tried: boolean;
  want_to_try: boolean;
  rating: number | null;
  notes: string | null;
  updated_at: string;
};

function classify(error: { code?: string; message: string }) {
  const looksLikeMissingTable =
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist/i.test(error.message) ||
    /schema cache/i.test(error.message);
  return looksLikeMissingTable
    ? ({ kind: "schema-missing" } as const)
    : ({ kind: "error", message: error.message } as const);
}

export async function listMeals(): Promise<MealsResult> {
  const { configured } = readSupabaseEnv();
  if (!configured) return { kind: "unconfigured" };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("meals")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return classify(error);
    const meals = (data ?? []).map((row) => ({
      ...row,
      moods: row.moods ?? [],
      ingredients: row.ingredients ?? [],
      ingredients_detail: row.ingredients_detail ?? [],
      instructions: row.instructions ?? null,
      source: "library" as const,
    })) as Meal[];
    return { kind: "ok", meals };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

// Returns the meal_status rows as a map keyed by meal_id. If the table is
// missing (migration not yet applied) we return an empty map rather than
// surfacing an error — the picker degrades gracefully.
export async function listMealStatuses(): Promise<Record<string, MealStatus>> {
  const { configured } = readSupabaseEnv();
  if (!configured) return {};
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("meal_status").select("*");
    if (error) return {};
    const map: Record<string, MealStatus> = {};
    for (const row of data ?? []) {
      map[row.meal_id] = row as MealStatus;
    }
    return map;
  } catch {
    return {};
  }
}
