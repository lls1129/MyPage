import { PageShell } from "./components/PageShell";
import { Hero } from "./components/home/Hero";
import { UtilityStrip } from "./components/home/UtilityStrip";
import { HomeGrid } from "./components/home/HomeGrid";
import { MealStrip } from "./components/home/MealStrip";
import { MoonStrip } from "./components/home/MoonStrip";
import { DeepSkyStrip } from "./components/home/DeepSkyStrip";

export default function Home() {
  return (
    <PageShell>
      <Hero />
      <UtilityStrip />
      <HomeGrid />
      <MoonStrip />
      <DeepSkyStrip />
      <MealStrip />
    </PageShell>
  );
}
