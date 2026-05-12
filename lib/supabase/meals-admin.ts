import { createAdminClient, isAdminConfigured } from "./admin";
import type { Meal, TrashedMeal } from "./meals";

const TRASH_LIMIT = 3;

// Admin-only trash list. RLS hides trashed rows from public reads, so we
// have to go through the service-role client. Returns the most recent
// TRASH_LIMIT removed meals across both library + external snapshots,
// newest first.
export async function listTrashedMealsAsAdmin(): Promise<TrashedMeal[]> {
  if (!isAdminConfigured()) return [];
  try {
    const admin = createAdminClient();
    const [{ data: libRows }, { data: extRows }] = await Promise.all([
      admin
        .from("meals")
        .select("*")
        .not("removed_at", "is", null)
        .order("removed_at", { ascending: false }),
      admin
        .from("external_meal_snapshots")
        .select("*")
        .not("removed_at", "is", null)
        .order("removed_at", { ascending: false }),
    ]);

    const lib: TrashedMeal[] = (libRows ?? []).map((row) => ({
      removed_at: row.removed_at as string,
      is_external: false,
      meal: {
        id: row.id,
        name: row.name,
        tagline: row.tagline ?? "",
        glyph: row.glyph ?? "",
        moods: row.moods ?? [],
        cuisine: row.cuisine ?? "",
        time_minutes: row.time_minutes,
        ingredients: row.ingredients ?? [],
        ingredients_detail: row.ingredients_detail ?? [],
        instructions: row.instructions ?? null,
        image_url: row.image_url ?? null,
        hidden: row.hidden ?? false,
        created_at: row.created_at,
        source: "library",
      } as Meal,
    }));
    const ext: TrashedMeal[] = (extRows ?? []).map((row) => ({
      removed_at: row.removed_at as string,
      is_external: true,
      meal: {
        id: row.meal_id,
        name: row.name,
        tagline: row.tagline ?? "",
        glyph: row.glyph ?? "",
        moods: row.moods ?? [],
        cuisine: row.cuisine ?? "",
        time_minutes: row.time_minutes,
        ingredients: row.ingredients ?? [],
        ingredients_detail: row.ingredients_detail ?? [],
        instructions: row.instructions ?? null,
        image_url: row.image_url ?? null,
        hidden: false,
        created_at: row.created_at,
        source: "themealdb",
      } as Meal,
    }));

    const merged = [...lib, ...ext].sort((a, b) =>
      a.removed_at < b.removed_at ? 1 : -1
    );
    return merged.slice(0, TRASH_LIMIT);
  } catch {
    return [];
  }
}

export { TRASH_LIMIT };
