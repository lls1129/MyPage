import { readSupabaseEnv } from "./env";
import { createClient } from "./server";

export type Photo = {
  id: string;
  image_url: string;
  caption: string;
  tags: string[];
  hidden: boolean;
  width: number | null;
  height: number | null;
  taken_at: string | null;
  created_at: string;
};

export type PhotosResult =
  | { kind: "ok"; photos: Photo[] }
  | { kind: "unconfigured" }
  | { kind: "schema-missing" }
  | { kind: "error"; message: string };

export async function listPhotos(): Promise<PhotosResult> {
  const { configured } = readSupabaseEnv();
  if (!configured) return { kind: "unconfigured" };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      // Postgres "undefined_table" is 42P01 over plain Postgres; PostgREST
      // surfaces the same condition as PGRST205 with a "schema cache" message.
      const looksLikeMissingTable =
        error.code === "42P01" ||
        error.code === "PGRST205" ||
        /does not exist/i.test(error.message) ||
        /schema cache/i.test(error.message);
      if (looksLikeMissingTable) return { kind: "schema-missing" };
      return { kind: "error", message: error.message };
    }
    return { kind: "ok", photos: (data ?? []) as Photo[] };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
