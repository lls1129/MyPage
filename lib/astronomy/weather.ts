import type { Location } from "./location";

export type WeatherSnapshot = {
  cloudCoverPct: number | null;
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
