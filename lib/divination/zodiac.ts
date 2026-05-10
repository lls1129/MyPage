// Western zodiac — 12 tropical sun signs plus a rising-sign calculator and
// a sign-pair "synastry-lite" reading. The rising-sign formula is the
// classical one (Meeus); we compute Greenwich sidereal time directly from
// the Julian date so we don't need an extra dependency.

export type Element = "fire" | "earth" | "air" | "water";
export type Modality = "cardinal" | "fixed" | "mutable";

export type ZodiacSign = {
  index: number; // 0 = Aries, ..., 11 = Pisces
  name: string;
  glyph: string;
  element: Element;
  modality: Modality;
  ruler: string;
  dateRange: string;
  start: { month: number; day: number };
  end: { month: number; day: number };
  vibe: string;
  strength: string;
  shadow: string;
};

export const ZODIAC: ZodiacSign[] = [
  {
    index: 0, name: "Aries", glyph: "♈", element: "fire", modality: "cardinal", ruler: "Mars",
    dateRange: "Mar 21 — Apr 19",
    start: { month: 3, day: 21 }, end: { month: 4, day: 19 },
    vibe: "spark, beginning, eager forward motion.",
    strength: "starts things others only think about.",
    shadow: "starts things and asks others to finish them.",
  },
  {
    index: 1, name: "Taurus", glyph: "♉", element: "earth", modality: "fixed", ruler: "Venus",
    dateRange: "Apr 20 — May 20",
    start: { month: 4, day: 20 }, end: { month: 5, day: 20 },
    vibe: "steadiness, sensual presence, slow accumulation.",
    strength: "makes the world feel solid and lived-in.",
    shadow: "roots so deeply that nothing else can move.",
  },
  {
    index: 2, name: "Gemini", glyph: "♊", element: "air", modality: "mutable", ruler: "Mercury",
    dateRange: "May 21 — Jun 20",
    start: { month: 5, day: 21 }, end: { month: 6, day: 20 },
    vibe: "curiosity, language, holding two truths at once.",
    strength: "makes connection from any subject.",
    shadow: "scatters before depth arrives.",
  },
  {
    index: 3, name: "Cancer", glyph: "♋", element: "water", modality: "cardinal", ruler: "Moon",
    dateRange: "Jun 21 — Jul 22",
    start: { month: 6, day: 21 }, end: { month: 7, day: 22 },
    vibe: "feeling, home, soft armor.",
    strength: "holds the room together emotionally.",
    shadow: "takes care of others to avoid being seen themselves.",
  },
  {
    index: 4, name: "Leo", glyph: "♌", element: "fire", modality: "fixed", ruler: "Sun",
    dateRange: "Jul 23 — Aug 22",
    start: { month: 7, day: 23 }, end: { month: 8, day: 22 },
    vibe: "warmth, performance, generous radiance.",
    strength: "makes other people feel chosen.",
    shadow: "needs the spotlight to feel real.",
  },
  {
    index: 5, name: "Virgo", glyph: "♍", element: "earth", modality: "mutable", ruler: "Mercury",
    dateRange: "Aug 23 — Sep 22",
    start: { month: 8, day: 23 }, end: { month: 9, day: 22 },
    vibe: "precision, service, the small right thing.",
    strength: "notices what everyone else missed.",
    shadow: "mistakes fixing for loving.",
  },
  {
    index: 6, name: "Libra", glyph: "♎", element: "air", modality: "cardinal", ruler: "Venus",
    dateRange: "Sep 23 — Oct 22",
    start: { month: 9, day: 23 }, end: { month: 10, day: 22 },
    vibe: "balance, beauty, the relationship as art.",
    strength: "keeps the peace beautifully.",
    shadow: "postpones their own preferences for too long.",
  },
  {
    index: 7, name: "Scorpio", glyph: "♏", element: "water", modality: "fixed", ruler: "Pluto",
    dateRange: "Oct 23 — Nov 21",
    start: { month: 10, day: 23 }, end: { month: 11, day: 21 },
    vibe: "depth, transformation, what is beneath the surface.",
    strength: "goes where others won't.",
    shadow: "makes mystery of what could just be said.",
  },
  {
    index: 8, name: "Sagittarius", glyph: "♐", element: "fire", modality: "mutable", ruler: "Jupiter",
    dateRange: "Nov 22 — Dec 21",
    start: { month: 11, day: 22 }, end: { month: 12, day: 21 },
    vibe: "questing, philosophy, the wider horizon.",
    strength: "keeps the horizon wide and the questions open.",
    shadow: "promises more than they deliver.",
  },
  {
    index: 9, name: "Capricorn", glyph: "♑", element: "earth", modality: "cardinal", ruler: "Saturn",
    dateRange: "Dec 22 — Jan 19",
    start: { month: 12, day: 22 }, end: { month: 1, day: 19 },
    vibe: "structure, ambition, the long climb.",
    strength: "builds things that last.",
    shadow: "forgets to enjoy what they've built.",
  },
  {
    index: 10, name: "Aquarius", glyph: "♒", element: "air", modality: "fixed", ruler: "Uranus",
    dateRange: "Jan 20 — Feb 18",
    start: { month: 1, day: 20 }, end: { month: 2, day: 18 },
    vibe: "vision, community, the future arriving.",
    strength: "sees the future of a system before others do.",
    shadow: "stays aloof from the individual person in front of them.",
  },
  {
    index: 11, name: "Pisces", glyph: "♓", element: "water", modality: "mutable", ruler: "Neptune",
    dateRange: "Feb 19 — Mar 20",
    start: { month: 2, day: 19 }, end: { month: 3, day: 20 },
    vibe: "dream, dissolution, the merging tide.",
    strength: "feels the weather of the room without being told.",
    shadow: "loses themselves in the feeling.",
  },
];

export function sunSignFromDate(dateInput: string | Date): ZodiacSign | null {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return null;
  const m = date.getMonth() + 1;
  const d = date.getDate();
  for (const sign of ZODIAC) {
    if (
      (m === sign.start.month && d >= sign.start.day) ||
      (m === sign.end.month && d <= sign.end.day)
    ) {
      return sign;
    }
  }
  return null;
}

// Greenwich mean sidereal time, hours, from a JS Date. Meeus formula.
function greenwichSiderealHours(date: Date): number {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525;
  let gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    T * T * 0.000387933 -
    (T * T * T) / 38710000;
  gmst = ((gmst % 360) + 360) % 360;
  return gmst / 15; // hours
}

export type AscendantResult = {
  sign: ZodiacSign;
  degInSign: number; // 0..30
};

export function ascendantFromBirth(
  birth: Date,
  latitudeDeg: number,
  longitudeDeg: number
): AscendantResult | null {
  if (Number.isNaN(birth.getTime())) return null;
  const gst = greenwichSiderealHours(birth);
  let lstHours = gst + longitudeDeg / 15;
  lstHours = ((lstHours % 24) + 24) % 24;
  const lstRad = (lstHours * Math.PI) / 12;
  const obliquity = (23.4393 * Math.PI) / 180;
  const latRad = (latitudeDeg * Math.PI) / 180;
  const y = -Math.cos(lstRad);
  const x =
    Math.sin(lstRad) * Math.cos(obliquity) +
    Math.tan(latRad) * Math.sin(obliquity);
  let ascRad = Math.atan2(y, x);
  if (ascRad < 0) ascRad += 2 * Math.PI;
  const ascDeg = (ascRad * 180) / Math.PI;
  const idx = Math.floor(ascDeg / 30);
  const degInSign = ascDeg % 30;
  return { sign: ZODIAC[idx], degInSign };
}

export type PairReading = {
  aspect: string;
  angularDistance: number; // 0, 30, 60, 90, 120, 150, 180
  elementRelation: string; // "shared element", "complementary", "challenging"
  summary: string;
};

const ELEMENT_PAIRS: Record<string, string> = {
  "fire+air": "complementary — air feeds fire, fire moves air.",
  "earth+water": "complementary — water nourishes earth, earth contains water.",
  "fire+water": "challenging — steam, evaporation, mutual interruption.",
  "earth+air": "challenging — different speeds, ground vs sky.",
  "fire+earth": "tension that builds things; you'll forge each other.",
  "air+water": "tension that softens things; you'll change each other.",
};

function elementRelation(a: Element, b: Element): string {
  if (a === b) return "shared element — deeply familiar, possibly insular.";
  const key = [a, b].sort().join("+");
  return ELEMENT_PAIRS[key] ?? "complex elemental dance.";
}

export function pairReading(a: ZodiacSign, b: ZodiacSign): PairReading {
  const diff = Math.abs(a.index - b.index);
  const angularDistance = Math.min(diff, 12 - diff) * 30;

  let aspect: string;
  let summary: string;
  switch (angularDistance) {
    case 0:
      aspect = "conjunction";
      summary = "two of the same — deeply familiar, mirroring strengths and shadows.";
      break;
    case 30:
      aspect = "semi-sextile";
      summary = "neighboring signs — different languages with overlapping vocabularies.";
      break;
    case 60:
      aspect = "sextile";
      summary = "easygoing — supportive without too much friction; talk often.";
      break;
    case 90:
      aspect = "square";
      summary = "tension — your differences provoke growth if you don't take it personally.";
      break;
    case 120:
      aspect = "trine";
      summary = "harmony — same element, natural flow; risk is too easy, no edges.";
      break;
    case 150:
      aspect = "quincunx";
      summary = "awkward — you have to keep adjusting; rewarding when both keep showing up.";
      break;
    default:
      aspect = "opposition";
      summary = "mirrored — you each show the other their blind spots; powerful, polarizing.";
      break;
  }

  return {
    aspect,
    angularDistance,
    elementRelation: elementRelation(a.element, b.element),
    summary,
  };
}
