import { readSupabaseEnv } from "./env";
import { createClient } from "./server";

export type ExplorePinMode = "inline" | "popup";
export type PinDisplayMode = "dot" | "card";

export async function getSetting<T = unknown>(
  key: string
): Promise<T | null> {
  const { configured } = readSupabaseEnv();
  if (!configured) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) return null;
    return (data?.value as T) ?? null;
  } catch {
    return null;
  }
}

export async function getExplorePinMode(): Promise<ExplorePinMode> {
  const value = await getSetting<ExplorePinMode>("explore_pin_mode");
  return value === "popup" ? "popup" : "inline";
}

export async function getPinDisplayMode(): Promise<PinDisplayMode> {
  const value = await getSetting<PinDisplayMode>("explore_pin_display");
  return value === "card" ? "card" : "dot";
}
