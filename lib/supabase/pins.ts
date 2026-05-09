import { readSupabaseEnv } from "./env";
import { createClient } from "./server";

export type PinBody = "earth" | "moon";
export type PinType = "travel" | "diary" | "astronomy";

export type Pin = {
  id: string;
  body: PinBody;
  type: PinType;
  position_x: number;
  position_y: number;
  position_z: number;
  note: string;
  created_at: string;
};

export type PinsResult =
  | { kind: "ok"; pins: Pin[] }
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

export async function listPins(): Promise<PinsResult> {
  const { configured } = readSupabaseEnv();
  if (!configured) return { kind: "unconfigured" };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("pins")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return classify(error);
    return { kind: "ok", pins: (data ?? []) as Pin[] };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
