import type { Metadata } from "next";
import { PageShell } from "../components/PageShell";
import { locationFromSearchParams } from "@/lib/astronomy/location";
import { tonightSky, formatTime, type SkyObject } from "@/lib/astronomy/sky";
import { fetchTonightWeather } from "@/lib/astronomy/weather";
import { pickRecommendation } from "@/lib/astronomy/recommendation";
import { SkyChart } from "./components/SkyChart";
import { LocationPicker } from "./LocationPicker";

export const metadata: Metadata = {
  title: "astronomy · my world",
  description: "tonight's sky + a slow album of astrophotos",
};

export const dynamic = "force-dynamic";

export default async function AstronomyPage(
  props: PageProps<"/astronomy">
) {
  const sp = await props.searchParams;
  const pickFirst = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const location = locationFromSearchParams({
    lat: pickFirst(sp?.lat),
    lon: pickFirst(sp?.lon),
    tz: pickFirst(sp?.tz),
    name: pickFirst(sp?.name),
  });
  const now = new Date();
  const sky = tonightSky(now, location);
  const weather = await fetchTonightWeather(location);
  const rec = pickRecommendation(sky, weather);

  const visible = sky.objects.filter((o) => o.visible);
  // Sort visible: sun/moon first, then by brightness, then alphabetical.
  const brightnessRank = { bright: 0, moderate: 1, dim: 2 } as const;
  visible.sort((a, b) => {
    if (a.kind === "sun" || a.kind === "moon") return -1;
    if (b.kind === "sun" || b.kind === "moon") return 1;
    const r = brightnessRank[a.brightness] - brightnessRank[b.brightness];
    if (r !== 0) return r;
    return a.name.localeCompare(b.name);
  });

  const cloudLabel =
    weather.cloudCoverPct === null
      ? "—"
      : `${Math.round(weather.cloudCoverPct)}%`;

  return (
    <PageShell>
      <header className="mt-2">
        <p className="label text-lavender-600 mb-2">astronomy ✦</p>
        <h1 className="font-script text-pink-600 text-[40px] md:text-[48px] leading-none">
          tonight&apos;s sky
        </h1>
        <p className="text-ink/80 text-sm mt-3 max-w-prose">
          live snapshot. sun/moon via SunCalc, planet positions via
          astronomy-engine, cloud cover via Open-Meteo. hit refresh for newer
          data.
        </p>
      </header>

      <LocationPicker current={location} />

      {/* Dark navy panel */}
      <section className="rounded-lg bg-skynavy-700 border border-skynavy-500 shadow-soft text-cream p-6 md:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="label text-pink-200 capitalize">{location.name}</p>
            <p className="font-script text-cream text-3xl leading-none mt-1">
              {formatTime(now, location.timezone)}
            </p>
          </div>
          <p className="text-xs text-cream/60 font-semibold">
            ✦ {visible.length} object{visible.length === 1 ? "" : "s"} above the horizon
          </p>
        </div>

        {/* 4 metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <Metric label="sunset" value={formatTime(sky.sunset, location.timezone)} />
          <Metric
            label="moonrise"
            value={formatTime(
              sky.moon.riseISO ? new Date(sky.moon.riseISO) : null,
              location.timezone
            )}
          />
          <Metric
            label="moon phase"
            value={sky.moon.phaseName}
            sub={`${Math.round(sky.moon.illumination * 100)}% lit`}
          />
          <Metric label="cloud cover" value={cloudLabel} />
        </div>

        {/* Sky chart */}
        <div className="mt-8">
          <SkyChart objects={sky.objects} />
        </div>

        {/* Visible objects list */}
        <div className="mt-8">
          <p className="label text-pink-200 mb-3">visible right now</p>
          {visible.length === 0 ? (
            <p className="text-sm text-cream/70">nothing above the horizon — patience.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {visible.map((obj) => (
                <li key={obj.id}>
                  <ObjectChip obj={obj} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Recommendation card */}
      <section
        className="rounded-lg p-5 md:p-6 border-2 border-amber-100"
        style={{
          background:
            "linear-gradient(135deg, rgba(250,199,117,0.18) 0%, rgba(239,159,39,0.10) 100%)",
        }}
      >
        <p className="label text-amber-600 mb-2">tonight&apos;s recommendation</p>
        <p className="font-script text-amber-800 text-3xl leading-tight">
          {rec.headline}
        </p>
        <p className="text-sm text-ink/85 mt-2 leading-relaxed">{rec.body}</p>
      </section>
    </PageShell>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md bg-skynavy-900/60 border border-skynavy-500 px-4 py-3">
      <p className="label text-pink-200">{label}</p>
      <p className="font-script text-cream text-2xl leading-tight mt-1">{value}</p>
      {sub ? (
        <p className="text-[11px] text-cream/60 font-semibold mt-0.5">{sub}</p>
      ) : null}
    </div>
  );
}

function ObjectChip({ obj }: { obj: SkyObject }) {
  const brightnessClasses: Record<SkyObject["brightness"], string> = {
    bright: "bg-amber-100/20 text-amber-100 border-amber-100/40",
    moderate: "bg-cream/10 text-cream border-cream/25",
    dim: "bg-cream/5 text-cream/60 border-cream/15",
  };
  const altLabel = `${Math.round(obj.altDeg)}° up`;
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-semibold border " +
        brightnessClasses[obj.brightness]
      }
    >
      <span className="capitalize">{obj.name}</span>
      <span className="text-[10px] opacity-70">· {altLabel}</span>
      <span className="text-[10px] opacity-60">{obj.brightness}</span>
    </span>
  );
}
