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
