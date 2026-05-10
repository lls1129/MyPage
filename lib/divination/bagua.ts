// Bagua — the eight trigrams that underlie the I Ching, paired with the
// classical family/element associations. Each one is a short reading on its
// own. Glyphs are Unicode trigram symbols (U+2630..U+2637).

export type Trigram = {
  glyph: string;
  pinyin: string;
  english: string;
  family: string;
  element: string;
  meaning: string;
};

export const TRIGRAMS: Trigram[] = [
  {
    glyph: "☰",
    pinyin: "Qián",
    english: "Heaven",
    family: "father",
    element: "metal · creative",
    meaning: "set the direction with clarity. the day belongs to whoever sees the long horizon.",
  },
  {
    glyph: "☱",
    pinyin: "Duì",
    english: "Lake",
    family: "youngest daughter",
    element: "metal · joyous",
    meaning: "joy as nourishment. speak softly; the right words land like rain on a still surface.",
  },
  {
    glyph: "☲",
    pinyin: "Lí",
    english: "Fire",
    family: "middle daughter",
    element: "fire · clinging",
    meaning: "see what is in front of you. clarity is its own warmth — and its own discipline.",
  },
  {
    glyph: "☳",
    pinyin: "Zhèn",
    english: "Thunder",
    family: "eldest son",
    element: "wood · arousing",
    meaning: "stir something. the loudest part of the day is asking you to wake one thing that's been sleeping.",
  },
  {
    glyph: "☴",
    pinyin: "Xùn",
    english: "Wind",
    family: "eldest daughter",
    element: "wood · gentle",
    meaning: "persistence over force. the wind shapes the stone by being there every day, not by trying.",
  },
  {
    glyph: "☵",
    pinyin: "Kǎn",
    english: "Water",
    family: "middle son",
    element: "water · abysmal",
    meaning: "danger met with depth. flow around what you cannot move; trust the path the water finds.",
  },
  {
    glyph: "☶",
    pinyin: "Gèn",
    english: "Mountain",
    family: "youngest son",
    element: "earth · keeping still",
    meaning: "stillness is also action. sit, watch — let the situation reveal what it is when you stop pushing.",
  },
  {
    glyph: "☷",
    pinyin: "Kūn",
    english: "Earth",
    family: "mother",
    element: "earth · receptive",
    meaning: "receive what arrives. nourish what wants to grow. you don't have to invent the day — you can welcome it.",
  },
];
