"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PinBody, PinType } from "@/lib/supabase/pins";
import { listAllPhotosAsAdmin, type Photo } from "@/lib/supabase/photos";

export async function createPin(input: {
  body: PinBody;
  type: PinType;
  position: [number, number, number];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireAdmin();
  if (input.body !== "earth" && input.body !== "moon") {
    return { ok: false, error: "Invalid body." };
  }
  if (!["travel", "diary", "astronomy"].includes(input.type)) {
    return { ok: false, error: "Invalid type." };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pins")
    .insert({
      body: input.body,
      type: input.type,
      position_x: input.position[0],
      position_y: input.position[1],
      position_z: input.position[2],
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/explore");
  return { ok: true, id: data.id as string };
}

export async function updatePinNote(id: string, note: string) {
  await requireAdmin();
  if (!id) return { ok: false, error: "Missing id." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("pins")
    .update({ note: note.slice(0, 4000) })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/explore");
  return { ok: true };
}

export async function updatePinType(id: string, type: PinType) {
  await requireAdmin();
  if (!id) return { ok: false, error: "Missing id." };
  if (!["travel", "diary", "astronomy"].includes(type)) {
    return { ok: false, error: "Invalid type." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("pins")
    .update({ type })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/explore");
  return { ok: true };
}

export async function deletePin(id: string) {
  await requireAdmin();
  if (!id) return { ok: false, error: "Missing id." };
  const admin = createAdminClient();
  const { error } = await admin.from("pins").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/explore");
  return { ok: true };
}

export async function linkPinPhotos(id: string, photoIds: string[]) {
  await requireAdmin();
  if (!id) return { ok: false, error: "Missing id." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("pins")
    .update({ photo_ids: photoIds })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/explore");
  return { ok: true };
}

// For the photo picker modal — pulls all photos (incl. hidden) so the admin
// can attach any of them to a pin.
export async function listPhotosForPicker(): Promise<
  { ok: true; photos: Photo[] } | { ok: false; error: string }
> {
  await requireAdmin();
  const result = await listAllPhotosAsAdmin();
  if (result.kind === "ok") return { ok: true, photos: result.photos };
  if (result.kind === "unconfigured" || result.kind === "schema-missing") {
    return { ok: false, error: "Photos aren't configured yet." };
  }
  return { ok: false, error: result.message };
}

export async function setExplorePinMode(mode: "inline" | "popup") {
  await requireAdmin();
  if (mode !== "inline" && mode !== "popup") {
    return { ok: false, error: "Invalid mode." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("app_settings")
    .upsert({ key: "explore_pin_mode", value: mode, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/explore");
  return { ok: true };
}

export async function setPinDisplayMode(mode: "dot" | "card") {
  await requireAdmin();
  if (mode !== "dot" && mode !== "card") {
    return { ok: false, error: "Invalid mode." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("app_settings")
    .upsert({ key: "explore_pin_display", value: mode, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/explore");
  return { ok: true };
}

export async function setCardPhotoMode(mode: "on-select" | "always") {
  await requireAdmin();
  if (mode !== "on-select" && mode !== "always") {
    return { ok: false, error: "Invalid mode." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("app_settings")
    .upsert({ key: "explore_card_photo", value: mode, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/explore");
  return { ok: true };
}

export async function clearPinsForBody(body: PinBody) {
  await requireAdmin();
  if (body !== "earth" && body !== "moon") {
    return { ok: false, error: "Invalid body." };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("pins").delete().eq("body", body);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/explore");
  return { ok: true };
}
