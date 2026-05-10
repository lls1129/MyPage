// Bagua — the eight trigrams that underlie the I Ching, paired with the
// classical family/element associations. Each one is a short reading on its
// own. Glyphs are Unicode trigram symbols (U+2630..U+2637).

export type Element = "wood" | "fire" | "earth" | "metal" | "water";

export type Trigram = {
  glyph: string;
  pinyin: string;
  english: string;
  family: string;
  element: string; // display string ("metal · creative")
  pureElement: Element;
  meaning: string;
};

export const TRIGRAMS: Trigram[] = [
  {
    glyph: "☰",
    pinyin: "Qián",
    english: "Heaven",
    family: "father",
    element: "metal · creative",
    pureElement: "metal",
    meaning: "set the direction with clarity. the day belongs to whoever sees the long horizon.",
  },
  {
    glyph: "☱",
    pinyin: "Duì",
    english: "Lake",
    family: "youngest daughter",
    element: "metal · joyous",
    pureElement: "metal",
    meaning: "joy as nourishment. speak softly; the right words land like rain on a still surface.",
  },
  {
    glyph: "☲",
    pinyin: "Lí",
    english: "Fire",
    family: "middle daughter",
    element: "fire · clinging",
    pureElement: "fire",
    meaning: "see what is in front of you. clarity is its own warmth — and its own discipline.",
  },
  {
    glyph: "☳",
    pinyin: "Zhèn",
    english: "Thunder",
    family: "eldest son",
    element: "wood · arousing",
    pureElement: "wood",
    meaning: "stir something. the loudest part of the day is asking you to wake one thing that's been sleeping.",
  },
  {
    glyph: "☴",
    pinyin: "Xùn",
    english: "Wind",
    family: "eldest daughter",
    element: "wood · gentle",
    pureElement: "wood",
    meaning: "persistence over force. the wind shapes the stone by being there every day, not by trying.",
  },
  {
    glyph: "☵",
    pinyin: "Kǎn",
    english: "Water",
    family: "middle son",
    element: "water · abysmal",
    pureElement: "water",
    meaning: "danger met with depth. flow around what you cannot move; trust the path the water finds.",
  },
  {
    glyph: "☶",
    pinyin: "Gèn",
    english: "Mountain",
    family: "youngest son",
    element: "earth · keeping still",
    pureElement: "earth",
    meaning: "stillness is also action. sit, watch — let the situation reveal what it is when you stop pushing.",
  },
  {
    glyph: "☷",
    pinyin: "Kūn",
    english: "Earth",
    family: "mother",
    element: "earth · receptive",
    pureElement: "earth",
    meaning: "receive what arrives. nourish what wants to grow. you don't have to invent the day — you can welcome it.",
  },
];

// Wu Xing — the five-element cycles. Each element produces (nourishes) the
// next; each element controls (overcomes) one across the cycle.
const PRODUCES: Record<Element, Element> = {
  wood: "fire",
  fire: "earth",
  earth: "metal",
  metal: "water",
  water: "wood",
};

const PRODUCED_BY: Record<Element, Element> = {
  fire: "wood",
  earth: "fire",
  metal: "earth",
  water: "metal",
  wood: "water",
};

const CONTROLS: Record<Element, Element> = {
  wood: "earth",
  earth: "water",
  water: "fire",
  fire: "metal",
  metal: "wood",
};

const CONTROLLED_BY: Record<Element, Element> = {
  earth: "wood",
  water: "earth",
  fire: "water",
  metal: "fire",
  wood: "metal",
};

const PRODUCE_VERB: Record<Element, string> = {
  wood: "feeds",
  fire: "warms",
  earth: "nourishes",
  metal: "carries",
  water: "softens",
};

const CONTROL_VERB: Record<Element, string> = {
  wood: "breaks",
  fire: "melts",
  earth: "absorbs",
  metal: "cuts",
  water: "extinguishes",
};

export type ElementCycle = {
  yours: Element;
  fedBy: { element: Element; verb: string };
  feeds: { element: Element; verb: string };
  controlledBy: { element: Element; verb: string };
  controls: { element: Element; verb: string };
};

export function elementCycle(e: Element): ElementCycle {
  return {
    yours: e,
    fedBy: { element: PRODUCED_BY[e], verb: PRODUCE_VERB[PRODUCED_BY[e]] },
    feeds: { element: PRODUCES[e], verb: PRODUCE_VERB[e] },
    controlledBy: {
      element: CONTROLLED_BY[e],
      verb: CONTROL_VERB[CONTROLLED_BY[e]],
    },
    controls: { element: CONTROLS[e], verb: CONTROL_VERB[e] },
  };
}
