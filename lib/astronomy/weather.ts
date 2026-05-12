import type { Location } from "./location";

export type WeatherSnapshot = {
  cloudCoverPct: number | null;
  temperatureC: number | null;
};

export type HourlyForecast = {
  iso: string;
  hourLabel: string;
  cloudCoverPct: number | null;
  humidityPct: number | null;
  windKph: number | null;
  precipProbPct: number | null;
  temperatureC: number | null;
};

// Open-Meteo is keyless. Cache 10 min so quick refreshes don't hammer it.
export async function fetchTonightWeather(
  location: Location
): Promise<WeatherSnapshot> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${location.lat}` +
      `&longitude=${location.lon}` +
      `&current=cloud_cover,temperature_2m` +
      `&timezone=${encodeURIComponent(location.timezone)}`;

    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return { cloudCoverPct: null, temperatureC: null };
    const data = await res.json();
    return {
      cloudCoverPct: data?.current?.cloud_cover ?? null,
      temperatureC: data?.current?.temperature_2m ?? null,
    };
  } catch {
    return { cloudCoverPct: null, temperatureC: null };
  }
}

/**
 * Pull the next ~24 hours of forecast for the parameters that matter to
 * astronomy: cloud cover, humidity (proxy for transparency), wind (proxy for
 * seeing), precipitation probability, and temperature.
 */
export async function fetchHourlyForecast(
  location: Location,
  startISO: string,
  endISO: string
): Promise<HourlyForecast[]> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${location.lat}` +
      `&longitude=${location.lon}` +
      `&hourly=cloud_cover,relative_humidity_2m,wind_speed_10m,precipitation_probability,temperature_2m` +
      // 3 days so we always have at least the next 48 hours available
      // regardless of what time of day the page was loaded.
      `&forecast_days=3` +
      `&timezone=${encodeURIComponent(location.timezone)}`;
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return [];
    const data = await res.json();
    const times: string[] = data?.hourly?.time ?? [];
    const cloud: number[] = data?.hourly?.cloud_cover ?? [];
    const hum: number[] = data?.hourly?.relative_humidity_2m ?? [];
    const wind: number[] = data?.hourly?.wind_speed_10m ?? [];
    const precip: number[] = data?.hourly?.precipitation_probability ?? [];
    const temp: number[] = data?.hourly?.temperature_2m ?? [];

    const start = new Date(startISO).getTime();
    const end = new Date(endISO).getTime();

    const out: HourlyForecast[] = [];
    for (let i = 0; i < times.length; i++) {
      // Open-Meteo returns local-ISO without offset; treat as the location's tz.
      const t = new Date(times[i]).getTime();
      if (Number.isNaN(t)) continue;
      if (t < start || t > end) continue;
      const date = new Date(times[i]);
      out.push({
        iso: date.toISOString(),
        hourLabel: date.toLocaleTimeString("en-US", {
          hour: "numeric",
          hour12: true,
          timeZone: location.timezone,
        }),
        cloudCoverPct: cloud[i] ?? null,
        humidityPct: hum[i] ?? null,
        windKph: wind[i] ?? null,
        precipProbPct: precip[i] ?? null,
        temperatureC: temp[i] ?? null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** 0 (excellent for astronomy) → 4 (terrible). Used to color forecast cells. */
export function gradeFor(
  param: "cloud" | "humid" | "wind" | "precip",
  value: number | null
): 0 | 1 | 2 | 3 | 4 {
  if (value === null) return 2;
  switch (param) {
    case "cloud":
      if (value <= 15) return 0;
      if (value <= 35) return 1;
      if (value <= 60) return 2;
      if (value <= 80) return 3;
      return 4;
    case "humid":
      if (value <= 40) return 0;
      if (value <= 60) return 1;
      if (value <= 75) return 2;
      if (value <= 90) return 3;
      return 4;
    case "wind":
      if (value <= 8) return 0;
      if (value <= 18) return 1;
      if (value <= 28) return 2;
      if (value <= 40) return 3;
      return 4;
    case "precip":
      if (value <= 5) return 0;
      if (value <= 20) return 1;
      if (value <= 40) return 2;
      if (value <= 70) return 3;
      return 4;
  }
}
