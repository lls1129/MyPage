"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Location } from "@/lib/astronomy/location";

type GeocodeHit = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country?: string;
  admin1?: string;
};

const STORAGE_KEY = "myworld:astronomy:location:v1";

function locationToParams(loc: Location): URLSearchParams {
  return new URLSearchParams({
    lat: loc.lat.toFixed(4),
    lon: loc.lon.toFixed(4),
    tz: loc.timezone,
    name: loc.name,
  });
}

function describeHit(hit: GeocodeHit): string {
  const parts = [hit.name, hit.admin1, hit.country].filter(Boolean);
  return parts.join(", ").toLowerCase();
}

export function LocationPicker({ current }: { current: Location }) {
  const router = useRouter();
  const params = useSearchParams();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [geoState, setGeoState] = useState<"idle" | "loading" | "denied" | "unsupported">("idle");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // First-load restore: if the URL has no location params and we have one
  // saved from a previous session, swap to it silently.
  useEffect(() => {
    if (params?.get("lat")) return;
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const loc = JSON.parse(saved) as Location;
      if (
        typeof loc.lat === "number" &&
        typeof loc.lon === "number" &&
        typeof loc.name === "string" &&
        typeof loc.timezone === "string"
      ) {
        router.replace(`/astronomy?${locationToParams(loc).toString()}`);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    // Run only once on mount; the searchParams check above guards against loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyLocation(loc: Location) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
    }
    router.push(`/astronomy?${locationToParams(loc).toString()}`);
    setQuery("");
    setResults([]);
  }

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoState("unsupported");
      return;
    }
    setGeoState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoState("idle");
        // Browser tz is a reasonable proxy for the user's coords.
        const tz =
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          current.timezone;
        applyLocation({
          name: "my location",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          timezone: tz,
        });
      },
      () => {
        setGeoState("denied");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 }
    );
  }

  function refresh() {
    router.refresh();
  }

  // Debounced geocoding search.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        const url =
          `https://geocoding-api.open-meteo.com/v1/search` +
          `?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;
        const res = await fetch(url);
        const data = await res.json();
        setResults(Array.isArray(data?.results) ? data.results : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  return (
    <div className="rounded-lg bg-white border border-pink-100 shadow-soft p-4 md:p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <p className="text-sm font-semibold text-pink-800">
          📍 <span className="capitalize">{current.name}</span>
          <span className="text-xs text-lavender-600 font-medium ml-2">
            {current.lat.toFixed(2)}°, {current.lon.toFixed(2)}°
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={geoState === "loading"}
            className="lift rounded-pill bg-pink-200 text-white border border-pink-200 shadow-soft hover:border-pink-400 px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
          >
            {geoState === "loading" ? "locating…" : "use my location"}
          </button>
          <button
            type="button"
            onClick={refresh}
            className="lift rounded-pill bg-white text-pink-800 border border-pink-100 hover:border-pink-200 px-3 py-1.5 text-xs font-semibold"
          >
            ↻ refresh
          </button>
        </div>
      </div>

      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search a city…"
          className="w-full bg-pink-50 border border-pink-100 rounded-sm px-3 py-2 text-sm text-ink placeholder:text-pink-400 focus:outline-none focus:border-pink-200"
        />
        {results.length > 0 ? (
          <ul className="absolute z-10 mt-1 left-0 right-0 max-h-64 overflow-auto bg-white border border-pink-100 rounded-md shadow-soft">
            {results.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  onClick={() =>
                    applyLocation({
                      name: describeHit(hit),
                      lat: hit.latitude,
                      lon: hit.longitude,
                      timezone: hit.timezone,
                    })
                  }
                  className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-pink-50"
                >
                  <span className="capitalize">{hit.name}</span>
                  {hit.admin1 ? (
                    <span className="text-lavender-600">, {hit.admin1}</span>
                  ) : null}
                  {hit.country ? (
                    <span className="text-lavender-600">, {hit.country}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : query.length >= 2 && !searching ? (
          <p className="text-xs text-lavender-600 mt-1">no matches.</p>
        ) : null}
      </div>

      {geoState === "denied" ? (
        <p className="text-xs text-pink-600">
          location permission denied. you can still search for a city above.
        </p>
      ) : null}
      {geoState === "unsupported" ? (
        <p className="text-xs text-pink-600">
          your browser doesn&apos;t expose geolocation. search instead.
        </p>
      ) : null}
    </div>
  );
}
