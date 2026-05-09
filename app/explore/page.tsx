import type { Metadata } from "next";
import { PageShell } from "../components/PageShell";
import { listPins } from "@/lib/supabase/pins";
import { getCurrentAdmin } from "@/lib/supabase/server";
import { getExplorePinMode } from "@/lib/supabase/settings";
import { Explorer } from "./Explorer";

export const metadata: Metadata = {
  title: "explore · my world",
  description: "earth + moon, drop a pin",
};

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const [result, admin, pinMode] = await Promise.all([
    listPins(),
    getCurrentAdmin(),
    getExplorePinMode(),
  ]);
  const pins = result.kind === "ok" ? result.pins : [];

  return (
    <PageShell>
      <header className="mt-2">
        <p className="label text-lavender-600 mb-2">explore ✦</p>
        <h1 className="font-script text-pink-600 text-[40px] md:text-[48px] leading-none">
          earth + moon
        </h1>
        <p className="text-ink/80 text-sm mt-3 max-w-prose">
          spin the globe, zoom in,{" "}
          {admin
            ? "tap the surface to drop a pin and leave yourself a memory"
            : "tap pins to read the note that came with them"}
          .
        </p>
      </header>

      {result.kind === "schema-missing" ? (
        <div className="rounded-lg bg-white border border-pink-100 shadow-soft p-6">
          <p className="label text-lavender-600">setup ✦</p>
          <h2 className="font-script text-pink-600 text-3xl mt-1">
            run the pins migration first
          </h2>
          <p className="text-sm text-ink/80 mt-3">
            paste{" "}
            <code className="font-mono bg-pink-50 px-1.5 rounded text-xs">
              supabase/migrations/0004_pins.sql
            </code>{" "}
            into Supabase Dashboard → SQL Editor → Run, then refresh.
          </p>
        </div>
      ) : null}

      {result.kind === "unconfigured" ? (
        <div className="rounded-lg bg-white border border-pink-100 shadow-soft p-6 text-center">
          <p className="font-script text-pink-600 text-3xl">
            supabase isn&apos;t configured yet
          </p>
        </div>
      ) : null}

      {result.kind === "error" ? (
        <div className="rounded-lg bg-white border border-pink-100 shadow-soft p-6">
          <p className="label text-lavender-600">error ✦</p>
          <p className="font-mono text-sm text-pink-600 mt-2">{result.message}</p>
        </div>
      ) : null}

      <Explorer
        initialPins={pins}
        isAdmin={Boolean(admin)}
        initialPinMode={pinMode}
      />
    </PageShell>
  );
}
