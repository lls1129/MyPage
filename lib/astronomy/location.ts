export type Location = {
  name: string;
  lat: number;
  lon: number;
  timezone: string; // IANA tz name
};

// Default for v1 — wire up geolocation/picker later.
export const DEFAULT_LOCATION: Location = {
  name: "santa clara, ca",
  lat: 37.3541,
  lon: -121.9552,
  timezone: "America/Los_Angeles",
};

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat([], { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Build a Location from URL search params, falling back to DEFAULT_LOCATION
// for missing/invalid values. Safe against any user input.
export function locationFromSearchParams(params: {
  lat?: string;
  lon?: string;
  tz?: string;
  name?: string;
}): Location {
  const lat = parseFloat(params.lat ?? "");
  const lon = parseFloat(params.lon ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return DEFAULT_LOCATION;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return DEFAULT_LOCATION;

  const tz = params.tz && isValidTimezone(params.tz)
    ? params.tz
    : DEFAULT_LOCATION.timezone;

  const trimmedName = (params.name ?? "").trim();
  const name = trimmedName.length > 0 && trimmedName.length <= 80
    ? trimmedName
    : `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;

  return { name, lat, lon, timezone: tz };
}
