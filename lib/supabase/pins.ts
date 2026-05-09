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
  photo_ids: string[];
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
    // photo_ids was added in migration 0005 — default it to [] for rows
    // returned before the migration was run so client useEffects don't crash
    // on `.length` of undefined.
    const pins = (data ?? []).map((row) => ({
      ...row,
      photo_ids: Array.isArray(row.photo_ids) ? row.photo_ids : [],
    })) as Pin[];
    return { kind: "ok", pins };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
