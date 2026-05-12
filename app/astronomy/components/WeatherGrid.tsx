import type { HourlyForecast } from "@/lib/astronomy/weather";
import { gradeFor } from "@/lib/astronomy/weather";

// Dark = good for astronomy, light = bad. Mirrors ClearDarkSky's logic in our
// palette: skynavy for excellent transparency, escalating to amber/pink for
// trouble.
const GRADE_BG: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-skynavy-900",
  1: "bg-skynavy-700",
  2: "bg-skynavy-500",
  3: "bg-amber-100/70",
  4: "bg-pink-200",
};

const GRADE_FG: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "text-cream",
  1: "text-cream",
  2: "text-cream",
  3: "text-skynavy-900",
  4: "text-skynavy-900",
};

type Param = "cloud" | "humid" | "wind" | "precip" | "temp";

const ROWS: { key: Param; label: string; unit: string; fmt: (v: number) => string }[] = [
  { key: "cloud", label: "cloud", unit: "%", fmt: (v) => Math.round(v).toString() },
  { key: "humid", label: "humid", unit: "%", fmt: (v) => Math.round(v).toString() },
  { key: "wind", label: "wind", unit: "km/h", fmt: (v) => Math.round(v).toString() },
  { key: "precip", label: "precip", unit: "%", fmt: (v) => Math.round(v).toString() },
  { key: "temp", label: "temp", unit: "°C", fmt: (v) => Math.round(v).toString() },
];

function rawValue(row: Param, hour: HourlyForecast): number | null {
  switch (row) {
    case "cloud":
      return hour.cloudCoverPct;
    case "humid":
      return hour.humidityPct;
    case "wind":
      return hour.windKph;
    case "precip":
      return hour.precipProbPct;
    case "temp":
      return hour.temperatureC;
  }
}

function tempCellStyle(value: number | null) {
  // Temperature is informational, not a quality grade. Use a neutral cream
  // shade with the value visible.
  if (value === null) return { bg: "bg-cream/10", fg: "text-cream/70" };
  return { bg: "bg-cream/10", fg: "text-cream" };
}

export function WeatherGrid({
  hours,
  nowISO,
}: {
  hours: HourlyForecast[];
  nowISO: string;
}) {
  if (hours.length === 0) return null;

  const nowTs = new Date(nowISO).getTime();
  const nowIdx = hours.findIndex(
    (h) => Math.abs(new Date(h.iso).getTime() - nowTs) < 30 * 60_000
  );

  return (
    <div className="rounded-md bg-skynavy-900/40 border border-skynavy-500 p-3 md:p-4">
      <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
        <p className="label text-pink-200">tonight&apos;s forecast</p>
        <Legend />
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full border-separate border-spacing-x-[2px] border-spacing-y-[3px] text-center text-[11px] font-semibold whitespace-nowrap">
          <thead>
            <tr>
              <th className="text-left text-cream/55 font-semibold pr-2 sticky left-0 bg-skynavy-900/90 z-10 w-[58px]">
                hour
              </th>
              {hours.map((h, i) => (
                <th
                  key={h.iso}
                  className={
                    "text-cream/65 font-semibold w-8 " +
                    (i === nowIdx ? "text-amber-100" : "")
                  }
                >
                  {h.hourLabel.replace(" ", "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key}>
                <th
                  scope="row"
                  className="text-left text-cream/70 font-semibold pr-2 sticky left-0 bg-skynavy-900/90 z-10 w-[58px]"
                  title={`${row.label} (${row.unit})`}
                >
                  <span className="lowercase">{row.label}</span>
                </th>
                {hours.map((h, i) => {
                  const v = rawValue(row.key, h);
                  let bg: string;
                  let fg: string;
                  if (row.key === "temp") {
                    const t = tempCellStyle(v);
                    bg = t.bg;
                    fg = t.fg;
                  } else {
                    const grade = gradeFor(row.key, v);
                    bg = GRADE_BG[grade];
                    fg = GRADE_FG[grade];
                  }
                  const isNow = i === nowIdx;
                  return (
                    <td
                      key={h.iso}
                      className={
                        `${bg} ${fg} rounded-sm h-7 align-middle ` +
                        (isNow ? "ring-1 ring-amber-100" : "")
                      }
                      title={`${row.label} · ${h.hourLabel}: ${v ?? "—"}${row.unit}`}
                    >
                      {v === null ? "—" : row.fmt(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Legend() {
  const items: { grade: 0 | 1 | 2 | 3 | 4; label: string }[] = [
    { grade: 0, label: "excellent" },
    { grade: 1, label: "good" },
    { grade: 2, label: "ok" },
    { grade: 3, label: "poor" },
    { grade: 4, label: "bad" },
  ];
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-cream/55 font-semibold">
      {items.map((it) => (
        <span key={it.grade} className="inline-flex items-center gap-1">
          <span className={`w-3 h-3 rounded-sm ${GRADE_BG[it.grade]}`} aria-hidden />
          <span className="lowercase">{it.label}</span>
        </span>
      ))}
    </div>
  );
}
