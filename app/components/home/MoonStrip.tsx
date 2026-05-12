import { DEFAULT_LOCATION } from "@/lib/astronomy/location";
import { moonAt } from "@/lib/astronomy/moon";
import { nextPhaseEvents } from "@/lib/astronomy/moon-events";
import { MoonStripClient } from "./MoonStripClient";

// Server wrapper — pre-computes a current snapshot at DEFAULT_LOCATION (so
// the SSR pass renders something meaningful) and the next 4 phase events
// (location-independent). The client component hydrates with the user's
// saved astronomy location from localStorage, if any, and rebuilds.
export function MoonStrip() {
  const now = new Date();
  const initialSnapshot = moonAt(now, DEFAULT_LOCATION);
  const events = nextPhaseEvents(now, 4);
  return (
    <MoonStripClient initialSnapshot={initialSnapshot} events={events} />
  );
}
