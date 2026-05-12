import type { Metadata } from "next";
import { PageShell } from "../components/PageShell";
import { locationFromSearchParams } from "@/lib/astronomy/location";
import {
  tonightSky,
  tonightSnapshots,
  nearestSnapshotIndex,
  formatTime,
} from "@/lib/astronomy/sky";
import { moonAt } from "@/lib/astronomy/moon";
import { nextPhaseEvents, nextEclipses } from "@/lib/astronomy/moon-events";
import {
  computeTonightDSOs,
  darkWindowTonight,
} from "@/lib/astronomy/deepsky";
import SunCalc from "suncalc";
import { fetchTonightWeather, fetchHourlyForecast } from "@/lib/astronomy/weather";
import { pickRecommendation } from "@/lib/astronomy/recommendation";
import { listAstrophotos, listAllAstrophotosAsAdmin } from "@/lib/supabase/astrophotos";
import { getCurrentAdmin } from "@/lib/supabase/server";
import { LocationPicker } from "./LocationPicker";
import { TimeSlider } from "./components/TimeSlider";
import { WeatherGrid } from "./components/WeatherGrid";
import { MoonPanel } from "./components/MoonPanel";
import { DeepSkyPanel } from "./components/DeepSkyPanel";
import { AstrophotoGrid } from "./components/AstrophotoGrid";

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

  // Snapshot range: 30 min before sunset → next sunrise + 30 min, every 30 min.
  // Falls back to a 14-hour window centered on now if SunCalc returns null
  // (extreme latitudes / polar nights).
  const sunsetTs = sky.sunset?.getTime() ?? now.getTime() - 60 * 60_000;
  // SunCalc.getTimes returns today's sunrise (which is in the past at night).
  // Compute tomorrow's sunrise by asking SunCalc with a date 24h later.
  const tomorrowSky = tonightSky(new Date(now.getTime() + 24 * 60 * 60_000), location);
  const sunriseTs =
    tomorrowSky.sunrise?.getTime() ?? now.getTime() + 12 * 60 * 60_000;

  const snapshotStart = new Date(Math.min(sunsetTs - 30 * 60_000, now.getTime()));
  const snapshotEnd = new Date(Math.max(sunriseTs + 30 * 60_000, now.getTime() + 60_000));
  const snapshots = tonightSnapshots(snapshotStart, snapshotEnd, 30, location, now);
  const initialIndex = nearestSnapshotIndex(snapshots, now);

  // Moon: ship just an initial snapshot + bounds + events; MoonPanel
  // computes the slider snapshots on the fly (5-minute granularity)
  // via suncalc, which is already in the client bundle. The window
  // spans 3 days back → 3 days past the last phase event, so all 4
  // "next phases" pills land within the slider.
  const phaseEvents = nextPhaseEvents(now, 4);
  const { lunar, solar } = nextEclipses(now);
  // Pills shown on the moon panel: 4 quarter phases + the next lunar
  // and solar eclipses, sorted by date so they read chronologically.
  const moonEvents = [
    ...phaseEvents,
    ...(lunar ? [lunar] : []),
    ...(solar ? [solar] : []),
  ].sort((a, b) => a.iso.localeCompare(b.iso));
  const lastEventTs =
    phaseEvents.length > 0
      ? new Date(phaseEvents[phaseEvents.length - 1].iso).getTime()
      : now.getTime() + 30 * 24 * 60 * 60_000;
  const moonStart = new Date(now.getTime() - 3 * 24 * 60 * 60_000);
  const moonEnd = new Date(lastEventTs + 3 * 24 * 60 * 60_000);
  const moonInitialSnapshot = moonAt(now, location);

  // Deep sky tonight: dark window, then rank DSOs by composite
  // observability score across that window. Moon penalty is scaled by
  // the moon's illumination × the fraction of the dark window it's
  // above the horizon (a full moon that sets early is much less of a
  // problem than one that stays up all night).
  const dark = darkWindowTonight(now, location);
  let topTargets: ReturnType<typeof computeTonightDSOs> = [];
  let photographicCount = 0;
  let moonNote: string | null = null;
  if (dark) {
    // Sample moon altitude across the dark window in ~30-min chunks.
    let moonUp = 0;
    let moonSamples = 0;
    const step = 30 * 60_000;
    for (let t = dark.start.getTime(); t <= dark.end.getTime(); t += step) {
      const pos = SunCalc.getMoonPosition(
        new Date(t),
        location.lat,
        location.lon
      );
      moonSamples++;
      if (pos.altitude > 0) moonUp++;
    }
    const moonAboveFrac = moonSamples > 0 ? moonUp / moonSamples : 0;
    const ill = sky.moon.illumination;
    const impact = ill * moonAboveFrac;
    if (impact > 0.55) {
      moonNote = `${Math.round(ill * 100)}% lit, up for ${Math.round(moonAboveFrac * 100)}% of dark — bright sky, faint targets are tough`;
    } else if (impact > 0.25) {
      moonNote = `${Math.round(ill * 100)}% lit, up for ${Math.round(moonAboveFrac * 100)}% of dark — partial moonlight`;
    } else if (ill < 0.15 || moonAboveFrac < 0.1) {
      moonNote = `${Math.round(ill * 100)}% lit — minimal moon, great for faint nebulae`;
    }
    const ranked = computeTonightDSOs(now, location, dark, {
      minPeakAlt: 25,
      maxMag: 10,
      moonIllumination: ill,
      moonAboveHorizonFraction: moonAboveFrac,
    });
    topTargets = ranked.slice(0, 8);
    photographicCount = ranked.filter(
      (r) => r.peakAltDeg >= 35 && r.dso.mag !== null && r.dso.mag < 10
    ).length;
  }

  const weather = await fetchTonightWeather(location);
  const hourly = await fetchHourlyForecast(
    location,
    snapshotStart.toISOString(),
    snapshotEnd.toISOString()
  );
  const admin = await getCurrentAdmin();
  const astrophotosResult = admin
    ? await listAllAstrophotosAsAdmin()
    : await listAstrophotos();
  const astrophotos =
    astrophotosResult.kind === "ok" ? astrophotosResult.astrophotos : [];
  const rec = pickRecommendation(sky, weather);

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
          live snapshot — sun/moon via SunCalc, planets via astronomy-engine,
          weather via Open-Meteo. drag the slider to walk through tonight, or
          hit refresh in the picker for fresh data.
        </p>
      </header>

      <LocationPicker current={location} />

      {/* Dark navy panel */}
      <section className="rounded-lg bg-skynavy-700 border border-skynavy-500 shadow-soft text-cream p-6 md:p-8 flex flex-col gap-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="label text-pink-200 capitalize">{location.name}</p>
            <p className="font-script text-cream text-3xl leading-none mt-1">
              {formatTime(now, location.timezone)}
            </p>
            <p className="text-[11px] text-cream/55 font-semibold mt-0.5">
              local time
            </p>
          </div>
        </div>

        {/* 4 metric cards (static for the night) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          <Metric label="cloud now" value={cloudLabel} />
        </div>

        <TimeSlider snapshots={snapshots} initialIndex={initialIndex} />

        <WeatherGrid hours={hourly} nowISO={now.toISOString()} />
      </section>

      <MoonPanel
        initialSnapshot={moonInitialSnapshot}
        startISO={moonStart.toISOString()}
        endISO={moonEnd.toISOString()}
        nowISO={now.toISOString()}
        events={moonEvents}
        location={location}
      />

      <DeepSkyPanel
        darkStartISO={dark ? dark.start.toISOString() : null}
        darkEndISO={dark ? dark.end.toISOString() : null}
        darkHours={dark ? dark.hours : null}
        nowISO={now.toISOString()}
        topTargets={topTargets}
        photographicCount={photographicCount}
        moonNote={moonNote}
        location={location}
      />

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

      {/* Astrophoto album */}
      <section className="mt-2">
        <header className="mb-5">
          <p className="label text-lavender-600 mb-2">astrophotos ✦</p>
          <h2 className="font-script text-pink-600 text-[32px] md:text-[40px] leading-none">
            slow album
          </h2>
          <p className="text-ink/80 text-sm mt-3 max-w-prose">
            things i pointed a telescope at. click any image for the full
            equipment story.
          </p>
        </header>
        <AstrophotoGrid astrophotos={astrophotos} isAdmin={Boolean(admin)} />
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
