// Single place to read Supabase env vars + check whether auth is configured.
// We bail gracefully when env is missing so an unconfigured deploy still serves
// the public pages — only auth-dependent routes need to fail.

export function readSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url, anonKey, configured: Boolean(url && anonKey) };
}

export function getAdminEmail() {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase();
}

// Service-role key (server-only). Bypasses RLS for admin writes.
// Supabase rebranded this to "Secret API key" — either env name works.
export function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
}
