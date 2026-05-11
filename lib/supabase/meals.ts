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
      source: "library" as const,
    })) as Meal[];
    return { kind: "ok", meals };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
