// Renderers for the album-name / photo-count strip on an album
// card. Five placements — see migration 0020 for the value set.
// Both the live grid (AlbumCardGrid) and the admin's card preview
// pull these from here so they stay in sync.

// Optional styling tuners stored on albums.title_style (migration
// 0022). All fields optional; renderer falls back to per-placement
// defaults for missing ones.
export type TitleStyle = {
  /** Tailwind rounded class for placements with a card shape
   *  (caption-bar, corner). Defaults to placement-specific value. */
  radius?: string;
  /** Loose t-shirt size that scales padding + font size. */
  size?: "sm" | "md" | "lg";
  /** 0..1 — applied to the caption-bar bg + corner chip bg so admin
   *  can tune how strongly the label sits over the cover. */
  opacity?: number;
};

export function readTitleStyle(raw: unknown): TitleStyle {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: TitleStyle = {};
  if (typeof o.radius === "string" && o.radius.length > 0) out.radius = o.radius;
  if (o.size === "sm" || o.size === "md" || o.size === "lg") out.size = o.size;
  if (typeof o.opacity === "number" && o.opacity >= 0 && o.opacity <= 1)
    out.opacity = o.opacity;
  return out;
}

const SIZE_PADDING: Record<NonNullable<TitleStyle["size"]>, string> = {
  sm: "px-2 py-1",
  md: "px-3 py-2",
  lg: "px-4 py-3",
};

const SIZE_NAME_TEXT: Record<NonNullable<TitleStyle["size"]>, string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
};

const SIZE_STACKED_NAME_TEXT: Record<NonNullable<TitleStyle["size"]>, string> =
  {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
  };

export function countLabel(count: number): string {
  return count === 0
    ? "soon ✦"
    : `${count} photo${count === 1 ? "" : "s"}`;
}

// "Below" — default. Plain strip below the cover.
export function BelowTitle({
  name,
  count,
  style = {},
}: {
  name: string;
  count: number;
  style?: TitleStyle;
}) {
  const pad = SIZE_PADDING[style.size ?? "md"];
  const nameText = SIZE_NAME_TEXT[style.size ?? "md"];
  return (
    <div className={"flex items-baseline justify-between gap-2 " + pad}>
      <p
        className={
          "font-script text-skynavy-900 leading-tight truncate pr-1 " +
          nameText
        }
      >
        {name}
      </p>
      <p className="text-[10px] text-ink/60 font-semibold shrink-0">
        {countLabel(count)}
      </p>
    </div>
  );
}

// Polaroid-style label — a soft "card" that floats below the cover
// with rounded corners + inset margins, so it reads as a dedicated
// label rather than a flat strip joined to the cover. Tunable via
// `style`: size scales padding + font, opacity sets the bg alpha.
export function CaptionBarTitle({
  name,
  count,
  style = {},
}: {
  name: string;
  count: number;
  style?: TitleStyle;
}) {
  const pad = SIZE_PADDING[style.size ?? "md"];
  const nameText = SIZE_NAME_TEXT[style.size ?? "md"];
  const opacity = style.opacity ?? 0.85;
  return (
    <div className="px-2 pt-2 pb-2.5">
      <div
        className={
          "flex items-baseline justify-between gap-2 border border-cream shadow-[0_1px_2px_rgba(64,40,82,0.08)] rounded-lg " +
          pad
        }
        style={{ backgroundColor: `rgba(255, 248, 231, ${opacity})` }}
      >
        <p
          className={
            "font-script text-skynavy-900 leading-tight truncate pr-1 " +
            nameText
          }
        >
          {name}
        </p>
        <p className="text-[10px] text-pink-700 font-semibold shrink-0">
          {countLabel(count)}
        </p>
      </div>
    </div>
  );
}

// Two rows, museum-label style. Name in larger script on top, then
// a thin divider, then the count in muted small caps on its own
// row. When `style.radius` is set to a real value (anything other
// than "none" / unset) the label is wrapped in a tinted card with
// that radius. Default is plain text — no card chrome at all.
export function StackedTitle({
  name,
  count,
  style = {},
}: {
  name: string;
  count: number;
  style?: TitleStyle;
}) {
  const pad = SIZE_PADDING[style.size ?? "md"];
  const nameText = SIZE_STACKED_NAME_TEXT[style.size ?? "md"];
  const radius = style.radius && style.radius !== "none" ? style.radius : null;
  const body = (
    <>
      <p
        className={
          "block font-script text-skynavy-900 leading-tight truncate " +
          nameText
        }
      >
        {name}
      </p>
      <hr className="border-t border-pink-100/70 my-1.5" aria-hidden />
      <p className="block text-[10px] text-ink/60 font-semibold uppercase tracking-wider">
        {countLabel(count)}
      </p>
    </>
  );
  if (!radius) {
    return <div className={"block " + pad}>{body}</div>;
  }
  return (
    <div className="px-2 pt-2 pb-2.5">
      <div
        className={
          "block bg-cream/40 border border-pink-100/70 " +
          radius +
          " " +
          pad
        }
      >
        {body}
      </div>
    </div>
  );
}

// Tucked into the cover's bottom-left — a small soft chip with a
// backdrop blur so it reads cleanly over busy photos without a
// full gradient. Caller is responsible for the positioning context
// (it uses `absolute`). Tunable via `style`: size scales chip
// padding + font, opacity sets the chip bg alpha.
export function CornerTitle({
  name,
  count,
  style = {},
}: {
  name: string;
  count: number;
  style?: TitleStyle;
}) {
  const opacity = style.opacity ?? 0.85;
  const sizeKey = style.size ?? "md";
  const pad =
    sizeKey === "sm"
      ? "px-1.5 py-0.5"
      : sizeKey === "lg"
      ? "px-2.5 py-1.5"
      : "px-2 py-1";
  const nameText =
    sizeKey === "sm" ? "text-sm" : sizeKey === "lg" ? "text-lg" : "text-base";
  return (
    <span
      className={
        "absolute left-2 bottom-2 right-2 flex items-baseline gap-2 rounded-md backdrop-blur-sm shadow-soft " +
        pad
      }
      style={{ backgroundColor: `rgba(255, 248, 231, ${opacity})` }}
    >
      <span
        className={
          "font-script text-skynavy-900 leading-none truncate flex-1 " +
          nameText
        }
      >
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
// Tunable via `style`: opacity sets the gradient peak alpha.
export function HoverTitle({
  name,
  count,
  alwaysVisible = false,
  style = {},
}: {
  name: string;
  count: number;
  alwaysVisible?: boolean;
  style?: TitleStyle;
}) {
  const opacity = style.opacity ?? 0.85;
  const sizeKey = style.size ?? "md";
  const nameText =
    sizeKey === "sm" ? "text-base" : sizeKey === "lg" ? "text-xl" : "text-lg";
  return (
    <span
      className={
        "pointer-events-none absolute inset-x-0 bottom-0 px-3 pt-6 pb-2 transition-opacity " +
        (alwaysVisible
          ? "opacity-100"
          : "opacity-0 group-hover:opacity-100 focus-within:opacity-100")
      }
      style={{
        backgroundImage: `linear-gradient(to top, rgba(64, 40, 82, ${opacity}), transparent)`,
      }}
    >
      <p
        className={
          "font-script text-cream leading-tight truncate " + nameText
        }
      >
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
  count: number,
  style: TitleStyle = {}
) {
  if (placement === "caption-bar")
    return <CaptionBarTitle name={name} count={count} style={style} />;
  if (placement === "stacked")
    return <StackedTitle name={name} count={count} style={style} />;
  if (placement === "corner" || placement === "hover") return null;
  return <BelowTitle name={name} count={count} style={style} />;
}

// Helper: returns the title node positioned INSIDE the cover (or
// null if the placement renders below). Caller renders it inside
// the cover's positioning container.
export function onCoverTitle(
  placement: string,
  name: string,
  count: number,
  style: TitleStyle = {},
  alwaysVisible = false
) {
  if (placement === "corner")
    return <CornerTitle name={name} count={count} style={style} />;
  if (placement === "hover")
    return (
      <HoverTitle
        name={name}
        count={count}
        alwaysVisible={alwaysVisible}
        style={style}
      />
    );
  return null;
}
