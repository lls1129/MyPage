import type { Metadata } from "next";
import { PageShell } from "../components/PageShell";
import { Divination } from "./Divination";

export const metadata: Metadata = {
  title: "divination · my world",
  description: "tarot, i ching, and bagua — three small ways to ask",
};

export default function DivinationPage() {
  return (
    <PageShell>
      <header className="mt-2">
        <p className="label text-lavender-600 mb-2">divination ✦</p>
        <h1 className="font-script text-pink-600 text-[40px] md:text-[48px] leading-none">
          three quiet questions
        </h1>
        <p className="text-ink/80 text-sm mt-3 max-w-prose">
          a tarot card, a hexagram, a trigram. randomly drawn each visit. take
          them as company more than counsel — the prompt itself is the
          practice.
        </p>
      </header>

      <Divination />

      <p className="text-center text-xs text-lavender-600 italic mt-2">
        ✿ for fun and contemplation · not a substitute for the people you trust
      </p>
    </PageShell>
  );
}
