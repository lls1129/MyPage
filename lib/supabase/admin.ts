import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { readSupabaseEnv, getServiceRoleKey } from "./env";

// Admin client backed by the service-role / secret key. Bypasses RLS, so it
// must NEVER ship to the browser — the `server-only` import enforces that
// at build time. Use only inside Server Actions, Route Handlers, or pages
// that have already verified the caller is an authenticated admin.
export function createAdminClient() {
  const { url, configured } = readSupabaseEnv();
  const serviceKey = getServiceRoleKey();
  if (!configured || !serviceKey) {
    throw new Error(
      "Admin Supabase env not set. Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createSupabaseClient(url!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function isAdminConfigured() {
  const { configured } = readSupabaseEnv();
  return configured && Boolean(getServiceRoleKey());
}
