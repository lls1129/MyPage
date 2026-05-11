import type { Metadata } from "next";
import { PageShell } from "../components/PageShell";
import { listMeals, listMealStatuses } from "@/lib/supabase/meals";
import { getCurrentAdmin } from "@/lib/supabase/server";
import { MealPicker } from "./MealPicker";

export const metadata: Metadata = {
  title: "meals · my world",
  description: "a little library of meals, with a shuffle button",
};

export const dynamic = "force-dynamic";

export default async function MealsPage() {
  const [result, statuses, admin] = await Promise.all([
    listMeals(),
    listMealStatuses(),
    getCurrentAdmin(),
  ]);
  const library = result.kind === "ok" ? result.meals : [];
  const isAdmin = admin !== null;

  return (
    <PageShell>
      <header className="mt-2">
        <p className="label text-lavender-600 mb-2">meals ✦</p>
        <h1 className="font-script text-pink-600 text-[40px] md:text-[48px] leading-none">
          what to eat?
        </h1>
        <p className="text-ink/80 text-sm mt-3 max-w-prose">
          filter by mood, time, cuisine, or what's in the fridge. shuffle for a
          fresh pick from the album, or ✦ surprise me pulls a random recipe
          from themealdb.
        </p>
      </header>

      {result.kind === "schema-missing" ? (
        <div className="rounded-lg bg-white border border-pink-100 shadow-soft p-6">
          <p className="label text-lavender-600">setup ✦</p>
          <h2 className="font-script text-pink-600 text-3xl mt-1">
            run the meals migration first
          </h2>
          <p className="text-sm text-ink/80 mt-3">
            paste{" "}
            <code className="font-mono bg-pink-50 px-1.5 rounded text-xs">
              supabase/migrations/0007_meals.sql
            </code>{" "}
            (and optionally{" "}
            <code className="font-mono bg-pink-50 px-1.5 rounded text-xs">
              supabase/seed_meals.sql
            </code>{" "}
            for sample data) into Supabase SQL Editor.
          </p>
        </div>
      ) : null}

      {result.kind === "ok" && result.meals.length === 0 ? (
        <div className="rounded-lg bg-white border border-pink-100 shadow-soft p-6 text-center">
          <p className="font-script text-pink-600 text-3xl">no meals yet ✿</p>
          <p className="text-sm text-ink/80 mt-3">
            run the seed file or wait for the admin editor — meanwhile, you can
            still tap ✦ surprise me below for a themealdb pick.
          </p>
        </div>
      ) : null}

      <MealPicker
        library={library}
        statuses={statuses}
        isAdmin={isAdmin}
      />
    </PageShell>
  );
}
