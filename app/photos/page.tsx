import type { Metadata } from "next";
import { PageShell } from "../components/PageShell";
import { listPhotos, listAllPhotosAsAdmin } from "@/lib/supabase/photos";
import { getCurrentAdmin } from "@/lib/supabase/server";
import { PhotoGrid } from "./PhotoGrid";

export const metadata: Metadata = {
  title: "photos · my world",
  description: "little moments, kept here",
};

// Don't cache — we want fresh photo lists when admin adds/removes.
export const dynamic = "force-dynamic";

export default async function PhotosPage() {
  const admin = await getCurrentAdmin();
  const result = admin ? await listAllPhotosAsAdmin() : await listPhotos();

  return (
    <PageShell>
      <header className="mt-2">
        <p className="label text-lavender-600 mb-2">photos ✦</p>
        <h1 className="font-script text-pink-600 text-[40px] md:text-[48px] leading-none">
          little moments
        </h1>
        <p className="text-ink/80 text-sm mt-3 max-w-prose">
          a slow album. tap any photo to open it · arrow keys to walk through.
        </p>
      </header>

      {result.kind === "ok" && result.photos.length > 0 ? (
        <PhotoGrid photos={result.photos} isAdmin={Boolean(admin)} />
      ) : null}

      {result.kind === "ok" && result.photos.length === 0 ? (
        <div className="mt-6 rounded-lg bg-white border border-pink-100 shadow-soft p-8 text-center">
          <p className="font-script text-pink-600 text-3xl">no photos yet ✿</p>
          <p className="text-sm text-ink/80 mt-3">
            run the seed file (
            <code className="font-mono bg-pink-50 px-1.5 rounded text-xs">
              supabase/seed_photos.sql
            </code>
            ) in your Supabase SQL editor to drop in a few placeholders, or wait
            for the upload milestone.
          </p>
        </div>
      ) : null}

      {result.kind === "schema-missing" ? (
        <div className="mt-6 rounded-lg bg-white border border-pink-100 shadow-soft p-8">
          <p className="label text-lavender-600">setup ✦</p>
          <h2 className="font-script text-pink-600 text-3xl mt-1">
            run the photos migration first
          </h2>
          <p className="text-sm text-ink/80 mt-3">
            open Supabase Dashboard → <strong>SQL Editor</strong>, paste the
            contents of{" "}
            <code className="font-mono bg-pink-50 px-1.5 rounded text-xs">
              supabase/migrations/0001_photos.sql
            </code>
            , click <strong>Run</strong>. Then refresh this page.
          </p>
        </div>
      ) : null}

      {result.kind === "unconfigured" ? (
        <div className="mt-6 rounded-lg bg-white border border-pink-100 shadow-soft p-8 text-center">
          <p className="font-script text-pink-600 text-3xl">
            supabase isn&apos;t configured yet
          </p>
          <p className="text-sm text-ink/80 mt-3">
            set <code className="font-mono bg-pink-50 px-1.5 rounded text-xs">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
            and{" "}
            <code className="font-mono bg-pink-50 px-1.5 rounded text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
            in your environment to load this page.
          </p>
        </div>
      ) : null}

      {result.kind === "error" ? (
        <div className="mt-6 rounded-lg bg-white border border-pink-100 shadow-soft p-8">
          <p className="label text-lavender-600">error ✦</p>
          <p className="text-sm text-ink/80 mt-3 font-mono">{result.message}</p>
        </div>
      ) : null}
    </PageShell>
  );
}
