import type { TonightSky } from "./sky";
import type { WeatherSnapshot } from "./weather";

export type Recommendation = {
  headline: string;
  body: string;
};

// Rules-based recommendation. Order matters — first match wins.
export function pickRecommendation(
  sky: TonightSky,
  weather: WeatherSnapshot
): Recommendation {
  const cloud = weather.cloudCoverPct ?? 50;
  const moonUp = sky.objects.find((o) => o.id === "moon")?.visible ?? false;
  const moonBright = sky.moon.illumination > 0.7;
  const visiblePlanets = sky.objects.filter(
    (o) => o.kind === "planet" && o.visible && o.brightness !== "dim"
  );

  if (cloud >= 80) {
    return {
      headline: "stay in tonight ☁",
      body: `${cloud}% cloud cover — even bright targets won't show much. perfect excuse for tea + a book.`,
    };
  }

  if (moonUp && moonBright) {
    return {
      headline: "moon-watching weather ✦",
      body: `the moon is ${Math.round(sky.moon.illumination * 100)}% lit and up — crater shadows look gorgeous near the terminator. a small scope or even binoculars will make your night.`,
    };
  }

  if (visiblePlanets.length > 0) {
    const names = visiblePlanets.map((p) => p.name).join(" + ");
    return {
      headline: "planet hunt ✦",
      body: `${names} ${visiblePlanets.length === 1 ? "is" : "are"} above the horizon and bright enough to spot with the naked eye. cloud cover is ${cloud}%.`,
    };
  }

  if (!moonUp && cloud < 40) {
    return {
      headline: "dark-sky window ✦",
      body: `the moon is below the horizon and clouds are at ${cloud}%. if you have any escape from city lights, this is your night for the milky way.`,
    };
  }

  return {
    headline: "fair night ✦",
    body: `cloud cover ${cloud}%, ${
      moonUp ? `moon ${Math.round(sky.moon.illumination * 100)}% lit` : "moon down"
    }. easy targets like brighter stars + planets will be visible — fainter ones will struggle.`,
  };
}
