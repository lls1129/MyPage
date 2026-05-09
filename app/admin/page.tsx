import Link from "next/link";
import { PageShell } from "../components/PageShell";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

const TOOLS = [
  {
    href: "/admin/photos/upload",
    label: "upload photo",
    desc: "drop a new photo into the album. EXIF date is read automatically.",
    glyph: "✿",
  },
];

export default async function AdminHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <PageShell>
      <section className="max-w-[680px] mx-auto w-full mt-6">
        <header>
          <p className="label text-lavender-600">admin ✦</p>
          <h1 className="font-script text-pink-600 text-[44px] md:text-[52px] leading-none mt-2">
            welcome back ✿
          </h1>
          <p className="text-sm text-ink/80 mt-3">
            signed in as <strong className="text-pink-800">{user?.email}</strong>
          </p>
        </header>

        <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TOOLS.map((tool) => (
            <li key={tool.href}>
              <Link
                href={tool.href}
                className="lift block rounded-lg bg-white border border-pink-100 shadow-soft p-5 hover:border-pink-200"
              >
                <div className="flex items-start gap-3">
                  <span className="font-script text-pink-600 text-2xl leading-none">
                    {tool.glyph}
                  </span>
                  <div>
                    <p className="font-script text-pink-800 text-xl leading-tight">
                      {tool.label}
                    </p>
                    <p className="text-xs text-ink/75 mt-1 leading-relaxed">
                      {tool.desc}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <form action={signOut} className="mt-8">
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
