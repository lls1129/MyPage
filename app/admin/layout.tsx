import { redirect } from "next/navigation";
import { PageShell } from "../components/PageShell";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseEnv, getAdminEmail } from "@/lib/supabase/env";

// Defense-in-depth: middleware (proxy.ts) already redirects unauthorized hits,
// but checking again here means a misconfigured matcher can't accidentally
// expose admin pages.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { configured } = readSupabaseEnv();
  if (!configured) {
    return (
      <PageShell>
        <section className="max-w-[520px] mx-auto w-full mt-10 rounded-lg bg-white border border-pink-100 shadow-soft p-8 text-center">
          <p className="label text-lavender-600">setup ✦</p>
          <h1 className="font-script text-pink-600 text-[36px] mt-2">
            supabase isn&apos;t configured yet
          </h1>
          <p className="text-sm text-ink/80 mt-4">
            set <code className="font-mono bg-pink-50 px-1.5 rounded">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
            <code className="font-mono bg-pink-50 px-1.5 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>,{" "}
            and <code className="font-mono bg-pink-50 px-1.5 rounded">ADMIN_EMAIL</code> in
            your environment, then come back.
          </p>
        </section>
      </PageShell>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const adminEmail = getAdminEmail();
  const authorized = user && adminEmail && user.email?.toLowerCase() === adminEmail;
  if (!authorized) {
    redirect("/login?next=/admin");
  }

  return <>{children}</>;
}
