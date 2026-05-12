import { listMeals, listExternalMeals } from "@/lib/supabase/meals";
import { MealStripClient } from "./MealStripClient";

export async function MealStrip() {
  const [result, externals] = await Promise.all([
    listMeals(),
    listExternalMeals(),
  ]);
  const library = result.kind === "ok" ? result.meals : [];
  const seen = new Set(library.map((m) => m.id));
  const combined = [
    ...library,
    ...externals.filter((m) => !seen.has(m.id)),
  ];
  if (combined.length === 0) return null;
  return <MealStripClient meals={combined} />;
}
