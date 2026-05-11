import { listMeals } from "@/lib/supabase/meals";
import { MealStripClient } from "./MealStripClient";

export async function MealStrip() {
  const result = await listMeals();
  const meals = result.kind === "ok" ? result.meals : [];
  if (meals.length === 0) return null;
  return <MealStripClient meals={meals} />;
}
