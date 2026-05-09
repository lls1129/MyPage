"use client";

import Link from "next/link";
import type { PinFeed } from "./feed-actions";

export function FeedCard({ feed }: { feed: PinFeed | null }) {
  if (!feed || feed.kind === "empty") return null;

  if (feed.kind === "error") {
    return (
      <CardShell tint="travel">
        <strong className="block text-pink-600 text-[11px] uppercase tracking-wider mb-1">
          ✦ feed error
        </strong>
        <p className="text-sm text-ink/85">{feed.message}</p>
      </CardShell>
    );
  }

  if (feed.kind === "earth-travel") {
    return (
      <CardShell tint="travel">
        <strong className="block text-pink-600 text-[11px] uppercase tracking-wider mb-1">
          ✈ travel guide
        </strong>
        {feed.articles.length === 0 ? (
          <p className="text-sm text-ink/85">
            no nearby Wikipedia articles within 10km. probably remote ocean or
            unmapped.
          </p>
        ) : (
          <ul className="flex flex-col gap-3 mt-1">
            {feed.articles.slice(0, 3).map((a) => (
              <li key={a.url} className="flex gap-3">
                {a.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.thumbnail}
                    alt=""
                    className="w-12 h-12 object-cover rounded-sm border border-pink-100 shrink-0"
                  />
                ) : null}
                <div className="min-w-0">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-pink-800 text-sm hover:text-pink-600 leading-snug"
                  >
                    {a.title}
                  </a>
                  <p className="text-[11px] text-lavender-600 font-semibold">
                    {(a.distanceM / 1000).toFixed(1)} km away
                  </p>
                  {a.extract ? (
                    <p className="font-serif text-ink/85 text-[13px] leading-snug mt-1 line-clamp-3">
                      {a.extract}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardShell>
    );
  }

  if (feed.kind === "earth-diary") {
    return (
      <CardShell tint="diary">
        <strong className="block text-lavender-600 text-[11px] uppercase tracking-wider mb-1">
          ✿ my memories
        </strong>
        <p className="text-sm text-ink/85">
          {feed.photoCount === 0
            ? "no photos in your album yet."
            : `your album has ${feed.photoCount} photo${feed.photoCount === 1 ? "" : "s"} so far.`}{" "}
          <Link
            href="/photos"
            className="text-lavender-600 underline decoration-lavender-200 underline-offset-2 hover:decoration-lavender-400 font-semibold"
          >
            browse the album →
          </Link>
        </p>
      </CardShell>
    );
  }

  if (feed.kind === "earth-astronomy") {
    const cloudLabel =
      feed.cloudCoverPct === null
        ? "—"
        : `${Math.round(feed.cloudCoverPct)}%`;
    const params = new URLSearchParams({
      lat: feed.lat.toFixed(4),
      lon: feed.lon.toFixed(4),
      tz: feed.timezone,
      name: "pin",
    });
    return (
      <CardShell tint="astronomy">
        <strong className="block text-amber-600 text-[11px] uppercase tracking-wider mb-1">
          ✦ sky tonight
        </strong>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-ink/85 mt-1">
          <li>
            <span className="text-amber-600 font-semibold">sunset</span>{" "}
            <span className="font-mono">{feed.sunset}</span>
          </li>
          <li>
            <span className="text-amber-600 font-semibold">sunrise</span>{" "}
            <span className="font-mono">{feed.sunrise}</span>
          </li>
          <li>
            <span className="text-amber-600 font-semibold">moon</span>{" "}
            {feed.moonPhase} · {Math.round(feed.moonIllumination * 100)}%
          </li>
          <li>
            <span className="text-amber-600 font-semibold">cloud</span>{" "}
            {cloudLabel}
          </li>
        </ul>
        <p className="text-xs text-amber-800 mt-2">
          <Link
            href={{ pathname: "/astronomy", query: Object.fromEntries(params) }}
            className="underline decoration-amber-200 underline-offset-2 hover:decoration-amber-400 font-semibold"
          >
            full sky tool for this spot →
          </Link>
        </p>
      </CardShell>
    );
  }

  if (feed.kind === "moon-travel") {
    return (
      <CardShell tint="travel">
        <strong className="block text-pink-600 text-[11px] uppercase tracking-wider mb-1">
          ✈ mission landings
        </strong>
        <p className="text-sm text-ink/85">
          Apollo, Luna, and Chang&apos;e missions explored regions like{" "}
          <em className="text-pink-800">{feed.region.toLowerCase()}</em>. (a
          real LROC dataset is on the roadmap.)
        </p>
      </CardShell>
    );
  }

  if (feed.kind === "moon-diary") {
    return (
      <CardShell tint="diary">
        <strong className="block text-lavender-600 text-[11px] uppercase tracking-wider mb-1">
          ✿ my moon notes
        </strong>
        <p className="text-sm text-ink/85">
          your personal observations of the{" "}
          <em className="text-lavender-800">{feed.region.toLowerCase()}</em>.
          telescope photos live in{" "}
          <Link
            href="/astronomy"
            className="text-lavender-600 underline decoration-lavender-200 underline-offset-2 hover:decoration-lavender-400 font-semibold"
          >
            the astrophoto album
          </Link>
          .
        </p>
      </CardShell>
    );
  }

  if (feed.kind === "moon-astronomy") {
    return (
      <CardShell tint="astronomy">
        <strong className="block text-amber-600 text-[11px] uppercase tracking-wider mb-1">
          ✦ lunar feature info
        </strong>
        <p className="text-sm text-ink/85">
          named craters, mare, and ridges near the{" "}
          <em className="text-amber-800">{feed.region.toLowerCase()}</em>. (a
          NASA LRO database lookup is on the roadmap.)
        </p>
      </CardShell>
    );
  }

  return null;
}

function CardShell({
  tint,
  children,
}: {
  tint: "travel" | "diary" | "astronomy";
  children: React.ReactNode;
}) {
  const bg =
    tint === "travel"
      ? "from-pink-100 to-pink-50"
      : tint === "diary"
        ? "from-lavender-100 to-lavender-50"
        : "from-amber-100/70 to-amber-100/30";
  return (
    <div
      className={`rounded-md px-4 py-3 bg-gradient-to-br ${bg} border border-pink-100`}
    >
      {children}
    </div>
  );
}
