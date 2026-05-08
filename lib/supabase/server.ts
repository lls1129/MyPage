import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readSupabaseEnv, getAdminEmail } from "./env";

// Read the current admin user (or null) without throwing when Supabase isn't
// configured. Use this from layouts that render on every page.
export async function getCurrentAdmin() {
  const { configured } = readSupabaseEnv();
  if (!configured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const adminEmail = getAdminEmail();
  if (!user || !adminEmail) return null;
  if (user.email?.toLowerCase() !== adminEmail) return null;
  return { id: user.id, email: user.email! };
}

// Server-side Supabase client. v16's `cookies()` is async, so this wrapper is too.
// Throws if Supabase env vars aren't set — call `readSupabaseEnv().configured`
// first if you're rendering a path that should still work without auth.
export async function createClient() {
  const { url, anonKey, configured } = readSupabaseEnv();
  if (!configured) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  const cookieStore = await cookies();
  return createServerClient(url!, anonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Setting cookies inside a pure Server Component read is a no-op;
          // the proxy/middleware path is responsible for refreshing them.
        }
      },
    },
  });
}
