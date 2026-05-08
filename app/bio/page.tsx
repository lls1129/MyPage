import type { Metadata } from "next";
import { PageShell } from "../components/PageShell";

export const metadata: Metadata = {
  title: "bio · my world",
  description: "a little about who's behind this corner of the internet",
};

const HIGHLIGHTS = [
  { label: "writes about", text: "soft systems & quiet skies" },
  { label: "currently", text: "santa clara, pacific time" },
  { label: "loving", text: "milk-tea afternoons & long walks" },
];

const LINKS = [
  { label: "github", href: "#" },
  { label: "letterboxd", href: "#" },
  { label: "email", href: "#" },
];

export default function BioPage() {
  return (
    <PageShell>
      <article className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-10 lg:gap-14 mt-4">
        {/* Side column — avatar, highlights, links */}
        <aside className="flex flex-col items-center lg:items-start gap-6 lg:sticky lg:top-8 self-start">
          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-pink-100 border-2 border-white shadow-soft flex items-center justify-center font-script text-pink-800 text-5xl">
              ✿
            </div>
            <span
              aria-hidden
              className="absolute -top-2 -right-1 font-script text-pink-400 text-2xl"
            >
              ✦
            </span>
            <span
              aria-hidden
              className="absolute -bottom-2 -left-2 font-script text-lavender-400 text-xl"
            >
              ✿
            </span>
          </div>

          <dl className="flex flex-col gap-4 w-full max-w-[240px] lg:max-w-none">
            {HIGHLIGHTS.map((h) => (
              <div key={h.label}>
                <dt className="label text-pink-600">{h.label}</dt>
                <dd className="text-ink/90 text-sm font-medium mt-1">{h.text}</dd>
              </div>
            ))}
          </dl>

          <ul className="flex flex-wrap gap-2 w-full">
            {LINKS.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  className="lift inline-flex items-center rounded-pill px-3 py-1.5 text-xs font-semibold bg-white text-pink-800 border border-pink-100 hover:border-pink-200"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main editorial column */}
        <section className="max-w-[640px]">
          <p className="label text-lavender-600 mb-2">about ✦</p>
          <h1 className="font-script text-pink-600 text-[40px] md:text-[56px] leading-none">
            hi, i&apos;m here
          </h1>

          <div className="mt-8">
            <p className="font-serif text-ink/90 text-[17px] leading-[1.8] mb-5">
              this is a small corner of the internet that i made for myself —
              part scrapbook, part observatory, part kitchen. i grew up
              somewhere between long bus rides and the kind of skies that make
              you want to keep looking up.
            </p>

            <p className="font-serif text-ink/90 text-[17px] leading-[1.8] mb-5">
              by day i write code. by evening i collect things: receipts from
              tiny restaurants, the names of constellations i can&apos;t quite
              remember, photos of the same flowers in different lights. this
              site is where those collections live.
            </p>

            <blockquote className="font-serif italic text-pink-800 border-l-2 border-pink-200 pl-5 my-8 text-[18px] leading-relaxed">
              if a place is worth remembering, it&apos;s worth a pin and a
              sentence.
            </blockquote>

            <p className="font-serif text-ink/90 text-[17px] leading-[1.8] mb-5">
              you&apos;ll find a 3d earth and moon you can drop pins on, an
              album of photos that keeps getting longer, a tiny astronomy hub
              for figuring out what to look for tonight, and a meal picker for
              the days when deciding feels like work.
            </p>

            <p className="font-serif text-ink/90 text-[17px] leading-[1.8]">
              thanks for visiting ✿ stay as long as you like.
            </p>
          </div>

          <div
            aria-hidden
            className="mt-12 text-center font-script text-pink-400 text-3xl"
          >
            ✦ ✿ ✦
          </div>
        </section>
      </article>
    </PageShell>
  );
}
