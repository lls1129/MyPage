import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { readSupabaseEnv, getAdminEmail } from "@/lib/supabase/env";

// In Next 16 the file-level convention is `proxy.ts` (renamed from middleware).
// Two jobs: refresh Supabase auth cookies on every request, and gate /admin/*.
export async function proxy(request: NextRequest) {
  const { url, anonKey, configured } = readSupabaseEnv();
  if (!configured) {
    // Unconfigured deploy: don't break the public site. /admin will render
    // its own "configure first" notice from the layout.
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url!, anonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const adminEmail = getAdminEmail();

  if (path.startsWith("/admin")) {
    const authorized = user && adminEmail && user.email?.toLowerCase() === adminEmail;
    if (!authorized) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", path);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  // Match everything except static assets + image optimization + favicon.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
