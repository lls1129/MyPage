// Renderers for the album-name / photo-count strip on an album
// card. Five placements — see migration 0020 for the value set.
// Both the live grid (AlbumCardGrid) and the admin's card preview
// pull these from here so they stay in sync.

export function countLabel(count: number): string {
  return count === 0
    ? "soon ✦"
    : `${count} photo${count === 1 ? "" : "s"}`;
}

// "Below" — default. Plain strip below the cover.
export function BelowTitle({
  name,
  count,
}: {
  name: string;
  count: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-3 py-2">
      <p className="font-script text-skynavy-900 text-lg leading-tight truncate pr-1">
        {name}
      </p>
      <p className="text-[10px] text-ink/60 font-semibold shrink-0">
        {countLabel(count)}
      </p>
    </div>
  );
}

// Polaroid-style strip — tinted bg + a bit more padding so the
// caption reads as part of the same card rather than a separate
// label.
export function CaptionBarTitle({
  name,
  count,
}: {
  name: string;
  count: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 bg-cream/70 px-3 py-2.5">
      <p className="font-script text-skynavy-900 text-lg leading-tight truncate pr-1">
        {name}
      </p>
      <p className="text-[10px] text-pink-700 font-semibold shrink-0">
        {countLabel(count)}
      </p>
    </div>
  );
}

// Two rows — name on top in slightly larger script, count under
// it like a museum label. Best for short names + clean covers.
export function StackedTitle({
  name,
  count,
}: {
  name: string;
  count: number;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2.5">
      <p className="font-script text-skynavy-900 text-xl leading-tight truncate">
        {name}
      </p>
      <p className="text-[10px] text-ink/55 font-semibold tracking-wide">
        {countLabel(count)}
      </p>
    </div>
  );
}

// Tucked into the cover's bottom-left — a small soft chip with a
// backdrop blur so it reads cleanly over busy photos without a
// full gradient. Caller is responsible for the positioning context
// (it uses `absolute`).
export function CornerTitle({
  name,
  count,
}: {
  name: string;
  count: number;
}) {
  return (
    <span className="absolute left-2 bottom-2 right-2 flex items-baseline gap-2 rounded-md bg-cream/85 backdrop-blur-sm px-2 py-1 shadow-soft">
      <span className="font-script text-skynavy-900 text-base leading-none truncate flex-1">
        {name}
      </span>
      <span className="text-[10px] text-ink/60 font-semibold shrink-0">
        {countLabel(count)}
      </span>
    </span>
  );
}

// Hover-only gradient overlay — cover stays untouched at rest;
// hovering (or focusing) on the card surfaces the title. Pass
// `alwaysVisible` to show it without hover (used by the admin's
// card preview so admin can see what the placement looks like).
export function HoverTitle({
  name,
  count,
  alwaysVisible = false,
}: {
  name: string;
  count: number;
  alwaysVisible?: boolean;
}) {
  return (
    <span
      className={
        "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-skynavy-900/85 to-transparent px-3 pt-6 pb-2 transition-opacity " +
        (alwaysVisible
          ? "opacity-100"
          : "opacity-0 group-hover:opacity-100 focus-within:opacity-100")
      }
    >
      <p className="font-script text-cream text-lg leading-tight truncate">
        {name}
      </p>
      <p className="text-[10px] text-cream/75 font-semibold">
        {countLabel(count)}
      </p>
    </span>
  );
}

// Helper: returns the title node positioned BELOW the cover (or
// null if the placement renders inside the cover). Caller renders
// it as a sibling to the cover container.
export function belowCoverTitle(
  placement: string,
  name: string,
  count: number
) {
  if (placement === "caption-bar") return <CaptionBarTitle name={name} count={count} />;
  if (placement === "stacked") return <StackedTitle name={name} count={count} />;
  if (placement === "corner" || placement === "hover") return null;
  return <BelowTitle name={name} count={count} />;
}

// Helper: returns the title node positioned INSIDE the cover (or
// null if the placement renders below). Caller renders it inside
// the cover's positioning container.
export function onCoverTitle(
  placement: string,
  name: string,
  count: number,
  alwaysVisible = false
) {
  if (placement === "corner") return <CornerTitle name={name} count={count} />;
  if (placement === "hover")
    return <HoverTitle name={name} count={count} alwaysVisible={alwaysVisible} />;
  return null;
}
