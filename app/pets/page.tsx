import type { Metadata } from "next";
import { PageShell } from "../components/PageShell";
import { listPets, listAllPetsAsAdmin } from "@/lib/supabase/pets";
import { getCurrentAdmin } from "@/lib/supabase/server";
import { PetsGrid } from "./PetsGrid";

export const metadata: Metadata = {
  title: "pets · my world",
  description: "a little corner for the pets in our world",
};

export const dynamic = "force-dynamic";

export default async function PetsPage() {
  const admin = await getCurrentAdmin();
  const isAdmin = admin !== null;
  const result = isAdmin ? await listAllPetsAsAdmin() : await listPets();
  const pets = result.kind === "ok" ? result.pets : [];

  return (
    <PageShell>
      <header className="mt-2">
        <p className="label text-lavender-600 mb-2">pets ♡</p>
        <h1 className="font-script text-pink-600 text-[40px] md:text-[48px] leading-none">
          our little crew
        </h1>
        <p className="text-ink/80 text-sm mt-3 max-w-prose">
          a place for the small + furry ones — names, breeds, the things only
          the people who live with them know.
        </p>
      </header>

      {result.kind === "schema-missing" ? (
        <p className="text-sm text-pink-700 font-semibold mt-6">
          ⚠ pets table is missing — run migration 0029 in supabase to enable
          this section.
        </p>
      ) : result.kind === "error" ? (
        <p className="text-sm text-pink-700 font-semibold mt-6">
          {result.message}
        </p>
      ) : (
        <PetsGrid pets={pets} isAdmin={isAdmin} />
      )}
    </PageShell>
  );
}
