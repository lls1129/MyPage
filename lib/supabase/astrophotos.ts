import { readSupabaseEnv } from "./env";
import { createClient } from "./server";
import { createAdminClient, isAdminConfigured } from "./admin";

export type Astrophoto = {
  id: string;
  image_url: string;
  object_name: string;
  caption: string;
  taken_at: string | null;
  hidden: boolean;
  rotation: number;
  flipped: boolean;
  width: number | null;
  height: number | null;
  telescope: string | null;
  mount: string | null;
  camera: string | null;
  exposure_stack: string | null;
  processing: string | null;
  location: string | null;
  created_at: string;
  album_id: string | null;
  // Per-photo decoration overrides. NULL = inherit album setting.
  // See resolveDecoration() in lib/supabase/photos.ts for the
  // shared fallback rule.
  cover_frame: string | null;
  cover_filter: string | null;
  cover_frame_width: string | null;
  cover_overlays: unknown[];
  crop_x: number;
  crop_y: number;
  crop_w: number;
  crop_h: number;
  sort_order: number;
};

export type AstrophotosResult =
  | { kind: "ok"; astrophotos: Astrophoto[] }
  | { kind: "unconfigured" }
  | { kind: "schema-missing" }
  | { kind: "error"; message: string };

export type AstrophotoResult =
  | { kind: "ok"; astrophoto: Astrophoto }
  | { kind: "not-found" }
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

export async function listAstrophotos(): Promise<AstrophotosResult> {
  const { configured } = readSupabaseEnv();
  if (!configured) return { kind: "unconfigured" };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("astrophotos")
      .select("*")
      .order("taken_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) return classify(error);
    return { kind: "ok", astrophotos: (data ?? []) as Astrophoto[] };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

export async function listAllAstrophotosAsAdmin(): Promise<AstrophotosResult> {
  if (!isAdminConfigured()) return { kind: "unconfigured" };
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("astrophotos")
      .select("*")
      .order("taken_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) return classify(error);
    return { kind: "ok", astrophotos: (data ?? []) as Astrophoto[] };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

export async function getAstrophoto(id: string): Promise<AstrophotoResult> {
  const { configured } = readSupabaseEnv();
  if (!configured) return { kind: "unconfigured" };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("astrophotos")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return classify(error);
    if (!data) return { kind: "not-found" };
    return { kind: "ok", astrophoto: data as Astrophoto };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

export function storageKeyFromAstrophotoUrl(url: string): string | null {
  const marker = "/storage/v1/object/public/astrophotos/";
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const tail = url.slice(i + marker.length);
  return tail.split("?")[0] || null;
}
