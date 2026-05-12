"use server";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { MealStatus } from "@/lib/supabase/meals";
import { TRASH_LIMIT } from "@/lib/supabase/meals-admin";

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

export async function setMealsFavoritesPublic(isPublic: boolean) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("app_settings")
    .upsert({
      key: "meals_favorites_public",
      value: isPublic,
      updated_at: new Date().toISOString(),
    });
  if (error) return { ok: false as const, message: error.message };
  revalidatePath("/meals");
  return { ok: true as const };
}

// Payload that lets a TheMealDB snapshot ride along with a status change,
// so the meal data persists in Postgres (visible across devices) the first
// time the admin interacts with it.
export type ExternalSnapshot = {
  meal_id: string;
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
};

export type StatusPatch = {
  mealId: string;
  tried?: boolean;
  wantToTry?: boolean;
  favorited?: boolean;
  rating?: number | null;
  notes?: string | null;
  snapshot?: ExternalSnapshot;
};

export type StatusResult =
  | { ok: true; status: MealStatus }
  | { ok: false; message: string };

// Upsert per-meal status. Partial: any field left undefined is preserved
// from the existing row (or defaulted on first write). If a snapshot is
// included it's also upserted into external_meal_snapshots, with
// removed_at cleared (interacting with a meal pulls it out of trash).
export async function setMealStatus(patch: StatusPatch): Promise<StatusResult> {
  await requireAdmin();
  const admin = createAdminClient();

  if (patch.snapshot) {
    const { error: snapErr } = await admin
      .from("external_meal_snapshots")
      .upsert(
        {
          ...patch.snapshot,
          removed_at: null,
        },
        { onConflict: "meal_id" }
      );
    if (snapErr) return { ok: false, message: snapErr.message };
  }

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
    favorited:
      patch.favorited !== undefined
        ? patch.favorited
        : (existing?.favorited ?? false),
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

// Move a meal to trash by stamping removed_at. After the stamp we enforce
// the TRASH_LIMIT cap by hard-purging the oldest trashed rows across both
// tables, plus their meal_status rows. The picker only ever shows the
// top TRASH_LIMIT items in the undo panel.
export async function removeMeal(opts: {
  mealId: string;
  isExternal: boolean;
}) {
  await requireAdmin();
  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (opts.isExternal) {
    const { error } = await admin
      .from("external_meal_snapshots")
      .update({ removed_at: now })
      .eq("meal_id", opts.mealId);
    if (error) return { ok: false as const, message: error.message };
  } else {
    const { error } = await admin
      .from("meals")
      .update({ removed_at: now })
      .eq("id", opts.mealId);
    if (error) return { ok: false as const, message: error.message };
  }

  // Enforce TRASH_LIMIT.
  await purgeOldestBeyondTrashLimit();
  revalidatePath("/meals");
  return { ok: true as const };
}

export async function restoreMeal(opts: {
  mealId: string;
  isExternal: boolean;
}) {
  await requireAdmin();
  const admin = createAdminClient();
  if (opts.isExternal) {
    const { error } = await admin
      .from("external_meal_snapshots")
      .update({ removed_at: null })
      .eq("meal_id", opts.mealId);
    if (error) return { ok: false as const, message: error.message };
  } else {
    const { error } = await admin
      .from("meals")
      .update({ removed_at: null })
      .eq("id", opts.mealId);
    if (error) return { ok: false as const, message: error.message };
  }
  revalidatePath("/meals");
  return { ok: true as const };
}

// Internal: fetch all trashed rows, sort by removed_at desc, hard-delete
// anything past the TRASH_LIMIT-th. Status rows for purged ids get
// cascade-deleted (we delete by id list, not FK).
async function purgeOldestBeyondTrashLimit() {
  const admin = createAdminClient();
  const [{ data: libRows }, { data: extRows }] = await Promise.all([
    admin
      .from("meals")
      .select("id, removed_at")
      .not("removed_at", "is", null),
    admin
      .from("external_meal_snapshots")
      .select("meal_id, removed_at")
      .not("removed_at", "is", null),
  ]);
  type Entry = { id: string; removed_at: string; isExternal: boolean };
  const all: Entry[] = [
    ...(libRows ?? []).map((r) => ({
      id: r.id as string,
      removed_at: r.removed_at as string,
      isExternal: false,
    })),
    ...(extRows ?? []).map((r) => ({
      id: r.meal_id as string,
      removed_at: r.removed_at as string,
      isExternal: true,
    })),
  ].sort((a, b) => (a.removed_at < b.removed_at ? 1 : -1));

  const toPurge = all.slice(TRASH_LIMIT);
  if (toPurge.length === 0) return;

  const libIds = toPurge.filter((e) => !e.isExternal).map((e) => e.id);
  const extIds = toPurge.filter((e) => e.isExternal).map((e) => e.id);

  if (libIds.length > 0) {
    await admin.from("meals").delete().in("id", libIds);
    await admin.from("meal_status").delete().in("meal_id", libIds);
  }
  if (extIds.length > 0) {
    await admin.from("external_meal_snapshots").delete().in("meal_id", extIds);
    await admin.from("meal_status").delete().in("meal_id", extIds);
  }
}
