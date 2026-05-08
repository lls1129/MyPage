import { Clock } from "./Clock";
import { Weather } from "./Weather";
import { SearchBox } from "./SearchBox";

export function UtilityStrip() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Clock />
      <Weather />
      <SearchBox />
    </section>
  );
}
