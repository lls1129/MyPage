"use server";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// Create a new pet row. Returns the new id so the client can
// optimistically focus the just-created card / open it for editing.
export async function createPet(opts: {
  name: string;
  breed?: string | null;
  notes?: string | null;
}) {
  await requireAdmin();
  const name = (opts.name ?? "").trim();
  if (!name) return { ok: false as const, error: "name is required" };
  const norm = (v: string | null | undefined): string | null => {
    if (v === undefined || v === null) return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
  };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pets")
    .insert({
      name,
      breed: norm(opts.breed),
      notes: norm(opts.notes),
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/pets");
  return { ok: true as const, id: data?.id as string };
}

// Partial-patch update for name / breed / notes. Each field is
// trimmed and empty strings normalize to null so the renderer
// treats "blank" consistently.
export async function updatePet(opts: {
  id: string;
  name?: string;
  breed?: string | null;
  notes?: string | null;
}) {
  await requireAdmin();
  if (!opts.id) return { ok: false as const, error: "missing pet id" };
  const norm = (v: string | null | undefined): string | null => {
    if (v === undefined || v === null) return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
  };
  const updates: Record<string, string | null> = {};
  if ("name" in opts) {
    const t = (opts.name ?? "").trim();
    if (!t) return { ok: false as const, error: "name is required" };
    updates.name = t;
  }
  if ("breed" in opts) updates.breed = norm(opts.breed);
  if ("notes" in opts) updates.notes = norm(opts.notes);
  if (Object.keys(updates).length === 0) return { ok: true as const };
  const admin = createAdminClient();
  const { error } = await admin
    .from("pets")
    .update(updates)
    .eq("id", opts.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/pets");
  return { ok: true as const };
}

// Pin (or clear) the pet's photo URL — uploaded via the shared
// signed-upload pattern (same as MealUploader), then this action
// just writes the resulting public URL.
export async function setPetImage(opts: {
  id: string;
  imageUrl: string | null;
}) {
  await requireAdmin();
  if (!opts.id) return { ok: false as const, error: "missing pet id" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("pets")
    .update({ image_url: opts.imageUrl })
    .eq("id", opts.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/pets");
  return { ok: true as const };
}

export async function setPetHidden(id: string, hidden: boolean) {
  await requireAdmin();
  if (!id) return { ok: false as const, error: "missing pet id" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("pets")
    .update({ hidden })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/pets");
  return { ok: true as const };
}

// Soft-delete by stamping removed_at. Keeps the row recoverable for
// a follow-up trash / undo UI if we ever want one.
export async function deletePet(id: string) {
  await requireAdmin();
  if (!id) return { ok: false as const, error: "missing pet id" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("pets")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/pets");
  return { ok: true as const };
}
