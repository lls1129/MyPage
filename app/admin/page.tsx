import { PageShell } from "../components/PageShell";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <PageShell>
      <section className="max-w-[640px] mx-auto w-full mt-6">
        <header>
          <p className="label text-lavender-600">admin ✦</p>
          <h1 className="font-script text-pink-600 text-[44px] md:text-[52px] leading-none mt-2">
            welcome back ✿
          </h1>
          <p className="text-sm text-ink/80 mt-3">
            signed in as <strong className="text-pink-800">{user?.email}</strong>
          </p>
        </header>

        <div className="mt-8 rounded-lg bg-white border border-pink-100 shadow-soft p-6">
          <p className="font-serif text-ink/85 text-[15px] leading-[1.7]">
            your tools will live here. next up: photo upload, meal library, and
            admin overlays for editing tags and captions inline.
          </p>
        </div>

        <form action={signOut} className="mt-6">
          <button
            type="submit"
            className="lift rounded-pill bg-white text-pink-800 border border-pink-100 hover:border-pink-200 px-4 py-2 text-sm font-semibold"
          >
            ↻ sign out
          </button>
        </form>
      </section>
    </PageShell>
  );
}
