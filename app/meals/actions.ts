"use server";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { MealStatus } from "@/lib/supabase/meals";

export async function setMealsListPublic(isPublic: boolean) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("app_settings")
    .upsert({
      key: "meals_list_public",
      value: isPublic,
      updated_at: new Date().toISOString(),
    });
  if (error) return { ok: false as const, message: error.message };
  revalidatePath("/meals");
  return { ok: true as const };
}

export type StatusPatch = {
  mealId: string;
  tried?: boolean;
  wantToTry?: boolean;
  rating?: number | null;
  notes?: string | null;
};

export type StatusResult =
  | { ok: true; status: MealStatus }
  | { ok: false; message: string };

// Upsert per-meal status. Partial: any field left undefined is preserved
// from the existing row (or defaulted on first write). Service-role client
// bypasses RLS; requireAdmin gates the entry point.
export async function setMealStatus(patch: StatusPatch): Promise<StatusResult> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: existing, error: fetchErr } = await admin
    .from("meal_status")
    .select("*")
    .eq("meal_id", patch.mealId)
    .maybeSingle();
  if (fetchErr) return { ok: false, message: fetchErr.message };

  const merged = {
    meal_id: patch.mealId,
    tried: patch.tried !== undefined ? patch.tried : (existing?.tried ?? false),
    want_to_try:
      patch.wantToTry !== undefined
        ? patch.wantToTry
        : (existing?.want_to_try ?? false),
    rating:
      patch.rating !== undefined
        ? patch.rating
        : ((existing?.rating ?? null) as number | null),
    notes:
      patch.notes !== undefined
        ? patch.notes
        : ((existing?.notes ?? null) as string | null),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("meal_status")
    .upsert(merged, { onConflict: "meal_id" })
    .select()
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/meals");
  return { ok: true, status: data as MealStatus };
}
