import type { DSOObservability } from "@/lib/astronomy/deepsky";
import { dsoTypeGlyph, dsoTypeLabel } from "@/lib/astronomy/deepsky";

function fmtTime(date: Date, tz: string): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  });
}

function fmtDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

export function DeepSkyPanel({
  dark,
  topTargets,
  photographicCount,
  moonNote,
  locationName,
  timezone,
}: {
  dark: { start: Date; end: Date; hours: number } | null;
  topTargets: DSOObservability[];
  photographicCount: number;
  moonNote: string | null;
  locationName: string;
  timezone: string;
}) {
  if (!dark) {
    return (
      <section className="rounded-lg bg-skynavy-700 border border-skynavy-500 shadow-soft text-cream p-6 md:p-8">
        <header className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
          <div>
            <p className="label text-pink-200">deep sky ✦</p>
            <p className="font-script text-cream text-3xl leading-none mt-1">
              no true dark tonight
            </p>
            <p className="text-[11px] text-cream/55 font-semibold mt-0.5 capitalize">
              {locationName}
            </p>
          </div>
        </header>
        <p className="text-sm text-cream/75 leading-relaxed">
          the sun doesn&apos;t dip below −18° (astronomical twilight) tonight,
          so deep-sky observation isn&apos;t practical from this location.
          this is typical at high latitudes near the summer solstice.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg bg-skynavy-700 border border-skynavy-500 shadow-soft text-cream p-6 md:p-8 flex flex-col gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="label text-pink-200">deep sky tonight ✦</p>
          <p className="font-script text-cream text-3xl leading-none mt-1">
            {fmtTime(dark.start, timezone)} → {fmtTime(dark.end, timezone)}
          </p>
          <p className="text-[11px] text-cream/55 font-semibold mt-0.5">
            {fmtDuration(dark.hours)} of true dark ·{" "}
            <span className="capitalize">{locationName}</span>
          </p>
        </div>
        {moonNote ? (
          <p className="text-xs text-cream/65 font-semibold max-w-[260px] text-right">
            🌙 {moonNote}
          </p>
        ) : null}
      </header>

      {topTargets.length === 0 ? (
        <p className="text-sm text-cream/75">
          no deep-sky targets above 25° tonight — try later in the night, or
          adjust your location.
        </p>
      ) : (
        <div>
          <p className="label text-pink-200 mb-3">
            best targets · ranked by altitude × brightness × moon
          </p>
          <ul className="flex flex-col gap-1.5">
            {topTargets.map((t) => (
              <li
                key={t.dso.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 px-3 rounded-md bg-skynavy-900/40 border border-skynavy-500/60"
              >
                <span className="text-lg leading-none" aria-hidden>
                  {dsoTypeGlyph(t.dso.type)}
                </span>
                <span className="font-script text-cream text-xl leading-none">
                  {t.dso.m ? `M${t.dso.m}` : t.dso.id}
                </span>
                {t.dso.name ? (
                  <span className="text-sm text-cream/85">
                    · {t.dso.name}
                  </span>
                ) : null}
                <span className="text-[10px] uppercase tracking-wider text-pink-200/80 font-semibold">
                  {dsoTypeLabel(t.dso.type)}
                </span>
                <span className="flex-1" />
                {t.dso.mag !== null ? (
                  <span className="text-xs text-cream/70 font-mono">
                    mag {t.dso.mag.toFixed(1)}
                  </span>
                ) : null}
                <span className="text-xs text-cream/70 font-mono">
                  {Math.round(t.peakAltDeg)}° @{" "}
                  {fmtTime(new Date(t.peakAtISO), timezone)}
                </span>
                <span className="text-[10px] text-cream/55 font-semibold uppercase">
                  {t.dso.con}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-cream/55 font-semibold mt-3">
            +{photographicCount} more targets workable for photography
            (mag &lt; 10, peak &gt; 35°)
          </p>
        </div>
      )}
    </section>
  );
}
