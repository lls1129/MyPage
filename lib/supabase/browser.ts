import { createBrowserClient } from "@supabase/ssr";
import { readSupabaseEnv } from "./env";

export function createClient() {
  const { url, anonKey, configured } = readSupabaseEnv();
  if (!configured) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return createBrowserClient(url!, anonKey!);
}
