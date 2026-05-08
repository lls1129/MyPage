import { FeaturedExplorerTile } from "./FeaturedExplorerTile";
import { PhotosTile } from "./PhotosTile";
import { AstronomyTile } from "./AstronomyTile";
import { BioTile } from "./BioTile";
import { BlogTile } from "./BlogTile";

export function HomeGrid() {
  return (
    <section
      className="grid grid-cols-3 gap-4"
      style={{ gridAutoRows: "minmax(140px, auto)" }}
    >
      <FeaturedExplorerTile />
      <PhotosTile />
      <AstronomyTile />
      <BioTile />
      <BlogTile />
    </section>
  );
}
