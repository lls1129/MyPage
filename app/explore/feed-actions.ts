"use server";

import * as THREE from "three";
import { listPhotos } from "@/lib/supabase/photos";
import { tonightSky, formatTime } from "@/lib/astronomy/sky";
import { fetchTonightWeather } from "@/lib/astronomy/weather";
import type { Pin } from "@/lib/supabase/pins";

export type WikiSummary = {
  title: string;
  extract: string;
  url: string;
  thumbnail: string | null;
  distanceM: number;
};

export type PinFeed =
  | { kind: "earth-travel"; articles: WikiSummary[] }
  | { kind: "earth-diary"; photoCount: number }
  | {
      kind: "earth-astronomy";
      sunset: string;
      sunrise: string;
      moonPhase: string;
      moonIllumination: number;
      cloudCoverPct: number | null;
      timezone: string;
      lat: number;
      lon: number;
    }
  | { kind: "moon-travel"; region: string }
  | { kind: "moon-diary"; region: string }
  | { kind: "moon-astronomy"; region: string }
  | { kind: "empty" }
  | { kind: "error"; message: string };

function pointToLatLon(p: { x: number; y: number; z: number }) {
  const v = new THREE.Vector3(p.x, p.y, p.z).normalize();
  // See client-side note in Explorer.tsx: SphereGeometry UV mapping requires
  // a negative Z when computing east-west longitude.
  return {
    lat: (Math.asin(v.y) * 180) / Math.PI,
    lon: (Math.atan2(-v.z, v.x) * 180) / Math.PI,
  };
}

function moonRegion(lat: number, lon: number): string {
  if (lat > 30) return "Northern highlands";
  if (lat < -30) return "Southern highlands";
  if (lon > -90 && lon < 90) return "Near side · mare region";
  return "Far side";
}

// Best-effort tz lookup from longitude — good enough for picking sunrise
// in the pin's local time without a tz API. (Within ~1h of true tz.)
function approxTimezoneFromLon(lon: number): string {
  const offsetHours = Math.round(lon / 15);
  const sign = offsetHours >= 0 ? "+" : "-";
  const abs = Math.abs(offsetHours).toString().padStart(2, "0");
  return `Etc/GMT${sign === "+" ? "-" : "+"}${parseInt(abs, 10)}`;
}

async function fetchWikipediaNearby(
  lat: number,
  lon: number,
  limit = 3
): Promise<WikiSummary[]> {
  try {
    const geo = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=10000&gslimit=${limit}&format=json&origin=*`,
      { next: { revalidate: 3600 } }
    );
    if (!geo.ok) return [];
    const geoData = (await geo.json()) as {
      query?: { geosearch?: { pageid: number; title: string; dist: number }[] };
    };
    const hits = geoData.query?.geosearch ?? [];
    if (hits.length === 0) return [];

    const summaries = await Promise.all(
      hits.map(async (hit) => {
        try {
          const res = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
              hit.title
            )}`,
            { next: { revalidate: 3600 } }
          );
          if (!res.ok) return null;
          const data = (await res.json()) as {
            title?: string;
            extract?: string;
            content_urls?: { desktop?: { page?: string } };
            thumbnail?: { source?: string };
          };
          const url =
            data.content_urls?.desktop?.page ??
            `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title)}`;
          return {
            title: data.title ?? hit.title,
            extract: data.extract ?? "",
            url,
            thumbnail: data.thumbnail?.source ?? null,
            distanceM: hit.dist,
          } satisfies WikiSummary;
        } catch {
          return null;
        }
      })
    );

    return summaries.filter((s): s is WikiSummary => s !== null);
  } catch {
    return [];
  }
}

export async function getPinFeed(pin: Pin): Promise<PinFeed> {
  try {
    const { lat, lon } = pointToLatLon({
      x: pin.position_x,
      y: pin.position_y,
      z: pin.position_z,
    });

    if (pin.body === "moon") {
      const region = moonRegion(lat, lon);
      return { kind: `moon-${pin.type}`, region } as PinFeed;
    }

    if (pin.type === "travel") {
      const articles = await fetchWikipediaNearby(lat, lon);
      return { kind: "earth-travel", articles };
    }

    if (pin.type === "diary") {
      const result = await listPhotos();
      const photoCount = result.kind === "ok" ? result.photos.length : 0;
      return { kind: "earth-diary", photoCount };
    }

    // earth astronomy
    const tz = approxTimezoneFromLon(lon);
    const location = { name: "pin", lat, lon, timezone: tz };
    const now = new Date();
    const sky = tonightSky(now, location);
    const weather = await fetchTonightWeather(location);
    return {
      kind: "earth-astronomy",
      sunset: formatTime(sky.sunset, tz),
      sunrise: formatTime(sky.sunrise, tz),
      moonPhase: sky.moon.phaseName,
      moonIllumination: sky.moon.illumination,
      cloudCoverPct: weather.cloudCoverPct,
      timezone: tz,
      lat,
      lon,
    };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
