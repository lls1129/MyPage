import { readSupabaseEnv } from "./env";
import { createClient } from "./server";
import { createAdminClient, isAdminConfigured } from "./admin";

export type Pet = {
  id: string;
  name: string;
  breed: string | null;
  notes: string | null;
  image_url: string | null;
  hidden: boolean;
  sort_order: number;
  created_at: string;
};

export type PetsResult =
  | { kind: "ok"; pets: Pet[] }
  | { kind: "unconfigured" }
  | { kind: "schema-missing" }
  | { kind: "error"; message: string };

function classifyError(error: {
  code?: string;
  message: string;
}): PetsResult {
  const looksLikeMissingTable =
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist/i.test(error.message) ||
    /schema cache/i.test(error.message);
  if (looksLikeMissingTable) return { kind: "schema-missing" };
  return { kind: "error", message: error.message };
}

// Public listing — RLS hides removed + hidden rows for visitors.
export async function listPets(): Promise<PetsResult> {
  const { configured } = readSupabaseEnv();
  if (!configured) return { kind: "unconfigured" };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("pets")
      .select("*")
      .is("removed_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) return classifyError(error);
    return { kind: "ok", pets: (data ?? []) as Pet[] };
  } catch (e) {
    return {
      kind: "error",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

// Admin listing — bypasses RLS, returns hidden rows too.
export async function listAllPetsAsAdmin(): Promise<PetsResult> {
  if (!isAdminConfigured()) return { kind: "unconfigured" };
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("pets")
      .select("*")
      .is("removed_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) return classifyError(error);
    return { kind: "ok", pets: (data ?? []) as Pet[] };
  } catch (e) {
    return {
      kind: "error",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
