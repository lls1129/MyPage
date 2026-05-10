// I Ching — the 64 hexagrams. Glyphs are Unicode (U+4DC0..U+4DFF). Pinyin +
// English names follow the Wilhelm/Baynes tradition; the one-line guidance
// is written here, intentionally short. Casting is uniform-random in the
// UI — a "modern feel" rather than yarrow-stalk fidelity.

export type Hexagram = {
  number: number;
  glyph: string;
  pinyin: string;
  name: string;
  meaning: string;
};

export const HEXAGRAMS: Hexagram[] = [
  { number: 1, glyph: "䷀", pinyin: "Qián", name: "The Creative", meaning: "set the direction; pure intention shapes the field." },
  { number: 2, glyph: "䷁", pinyin: "Kūn", name: "The Receptive", meaning: "yield, listen, let what is coming arrive." },
  { number: 3, glyph: "䷂", pinyin: "Zhūn", name: "Difficulty at the Beginning", meaning: "early growth is awkward; persist gently." },
  { number: 4, glyph: "䷃", pinyin: "Méng", name: "Youthful Folly", meaning: "ask the question with humility; teach with patience." },
  { number: 5, glyph: "䷄", pinyin: "Xū", name: "Waiting", meaning: "the way is right; the timing is not yet ripe." },
  { number: 6, glyph: "䷅", pinyin: "Sòng", name: "Conflict", meaning: "step back from the quarrel; you don't have to win it." },
  { number: 7, glyph: "䷆", pinyin: "Shī", name: "The Army", meaning: "discipline before action; clear command before the march." },
  { number: 8, glyph: "䷇", pinyin: "Bǐ", name: "Holding Together", meaning: "find your people; bind without grasping." },
  { number: 9, glyph: "䷈", pinyin: "Xiǎo Xù", name: "Small Taming", meaning: "small adjustments now spare large ones later." },
  { number: 10, glyph: "䷉", pinyin: "Lǚ", name: "Treading", meaning: "walk carefully through the lion's territory." },
  { number: 11, glyph: "䷊", pinyin: "Tài", name: "Peace", meaning: "heaven and earth meet; trust the harmony you're in." },
  { number: 12, glyph: "䷋", pinyin: "Pǐ", name: "Standstill", meaning: "the channels are blocked; preserve your integrity quietly." },
  { number: 13, glyph: "䷌", pinyin: "Tóng Rén", name: "Fellowship", meaning: "open your heart in shared company." },
  { number: 14, glyph: "䷍", pinyin: "Dà Yǒu", name: "Great Possession", meaning: "abundance arrives; meet it with grace, not pride." },
  { number: 15, glyph: "䷎", pinyin: "Qiān", name: "Modesty", meaning: "lower yourself and the world raises you." },
  { number: 16, glyph: "䷏", pinyin: "Yù", name: "Enthusiasm", meaning: "joyful momentum carries others along." },
  { number: 17, glyph: "䷐", pinyin: "Suí", name: "Following", meaning: "let your action follow what is true, not what is loud." },
  { number: 18, glyph: "䷑", pinyin: "Gǔ", name: "Work on the Decayed", meaning: "what was neglected can be restored, but not without honesty." },
  { number: 19, glyph: "䷒", pinyin: "Lín", name: "Approach", meaning: "good times arrive; ride them with care, not arrogance." },
  { number: 20, glyph: "䷓", pinyin: "Guān", name: "Contemplation", meaning: "watch first; understand before you intervene." },
  { number: 21, glyph: "䷔", pinyin: "Shì Hé", name: "Biting Through", meaning: "name the obstacle; clear judgment is mercy too." },
  { number: 22, glyph: "䷕", pinyin: "Bì", name: "Grace", meaning: "form matters, but only when it serves the heart." },
  { number: 23, glyph: "䷖", pinyin: "Bō", name: "Splitting Apart", meaning: "what's rotten falls away; let it." },
  { number: 24, glyph: "䷗", pinyin: "Fù", name: "Return", meaning: "the smallest light returns; tend it." },
  { number: 25, glyph: "䷘", pinyin: "Wú Wàng", name: "Innocence", meaning: "act without ulterior motive; the unforced thing is right." },
  { number: 26, glyph: "䷙", pinyin: "Dà Xù", name: "Great Taming", meaning: "store your strength now for the work that's coming." },
  { number: 27, glyph: "䷚", pinyin: "Yí", name: "Nourishment", meaning: "watch what you take in — words, food, company." },
  { number: 28, glyph: "䷛", pinyin: "Dà Guò", name: "Great Excess", meaning: "the load is too much; ask for help or set some down." },
  { number: 29, glyph: "䷜", pinyin: "Kǎn", name: "The Abysmal", meaning: "danger comes; depth answers depth — keep moving." },
  { number: 30, glyph: "䷝", pinyin: "Lí", name: "The Clinging", meaning: "what you depend on is also what shines through you." },
  { number: 31, glyph: "䷞", pinyin: "Xián", name: "Influence", meaning: "be moved without being swept; respond from center." },
  { number: 32, glyph: "䷟", pinyin: "Héng", name: "Duration", meaning: "the steady thing endures; show up again tomorrow." },
  { number: 33, glyph: "䷠", pinyin: "Dùn", name: "Retreat", meaning: "step back without bitterness; this is also strategy." },
  { number: 34, glyph: "䷡", pinyin: "Dà Zhuàng", name: "Great Power", meaning: "strong but not yet wise — pause before pushing." },
  { number: 35, glyph: "䷢", pinyin: "Jìn", name: "Progress", meaning: "the sun rises on your efforts; visibility brings duty." },
  { number: 36, glyph: "䷣", pinyin: "Míng Yí", name: "Darkening of the Light", meaning: "be wise quietly; not every truth is for now." },
  { number: 37, glyph: "䷤", pinyin: "Jiā Rén", name: "The Family", meaning: "tend the inner circle; the outer one rests on it." },
  { number: 38, glyph: "䷥", pinyin: "Kuí", name: "Opposition", meaning: "differences sharpen meaning; argue without contempt." },
  { number: 39, glyph: "䷦", pinyin: "Jiǎn", name: "Obstruction", meaning: "the path is blocked; turn inward, ask for counsel." },
  { number: 40, glyph: "䷧", pinyin: "Xiè", name: "Deliverance", meaning: "the storm passes; release what you held during it." },
  { number: 41, glyph: "䷨", pinyin: "Sǔn", name: "Decrease", meaning: "give up the small; the large becomes possible." },
  { number: 42, glyph: "䷩", pinyin: "Yì", name: "Increase", meaning: "share the surplus; the river is still flowing." },
  { number: 43, glyph: "䷪", pinyin: "Guài", name: "Breakthrough", meaning: "speak the truth in the council; the time is now." },
  { number: 44, glyph: "䷫", pinyin: "Gòu", name: "Coming to Meet", meaning: "an unexpected presence arrives; greet without yielding." },
  { number: 45, glyph: "䷬", pinyin: "Cuì", name: "Gathering Together", meaning: "the people assemble; find your place at the table." },
  { number: 46, glyph: "䷭", pinyin: "Shēng", name: "Pushing Upward", meaning: "growth one inch at a time; don't break the climb." },
  { number: 47, glyph: "䷮", pinyin: "Kùn", name: "Oppression", meaning: "stuck and tired; speak less, mean more." },
  { number: 48, glyph: "䷯", pinyin: "Jǐng", name: "The Well", meaning: "the source is still there; lower the rope." },
  { number: 49, glyph: "䷰", pinyin: "Gé", name: "Revolution", meaning: "the old skin must go; molt with intention." },
  { number: 50, glyph: "䷱", pinyin: "Dǐng", name: "The Cauldron", meaning: "transform the raw into the offered; cook slowly." },
  { number: 51, glyph: "䷲", pinyin: "Zhèn", name: "The Arousing", meaning: "thunder shakes; let the shock teach what calm could not." },
  { number: 52, glyph: "䷳", pinyin: "Gèn", name: "Keeping Still", meaning: "stillness is action too; sit and let the dust settle." },
  { number: 53, glyph: "䷴", pinyin: "Jiàn", name: "Development", meaning: "the right things grow slowly; step, then step." },
  { number: 54, glyph: "䷵", pinyin: "Guī Mèi", name: "The Marrying Maiden", meaning: "joining without illusion; know your place in the new whole." },
  { number: 55, glyph: "䷶", pinyin: "Fēng", name: "Abundance", meaning: "the noon is bright but brief; share while it lasts." },
  { number: 56, glyph: "䷷", pinyin: "Lǚ", name: "The Wanderer", meaning: "you are passing through; travel light, leave no debts." },
  { number: 57, glyph: "䷸", pinyin: "Xùn", name: "The Gentle", meaning: "the wind shapes stone — repeat with patience." },
  { number: 58, glyph: "䷹", pinyin: "Duì", name: "The Joyous", meaning: "joy multiplies in good company; gather, speak, rest." },
  { number: 59, glyph: "䷺", pinyin: "Huàn", name: "Dispersion", meaning: "what was rigid softens; stiffness ends, flow begins." },
  { number: 60, glyph: "䷻", pinyin: "Jié", name: "Limitation", meaning: "the limit is the form; the form is the freedom." },
  { number: 61, glyph: "䷼", pinyin: "Zhōng Fú", name: "Inner Truth", meaning: "be sincere all the way down; people can feel it." },
  { number: 62, glyph: "䷽", pinyin: "Xiǎo Guò", name: "Small Excess", meaning: "small extras now; avoid the great gesture." },
  { number: 63, glyph: "䷾", pinyin: "Jì Jì", name: "After Completion", meaning: "the goal is reached — and now the harder, quieter work." },
  { number: 64, glyph: "䷿", pinyin: "Wèi Jì", name: "Before Completion", meaning: "almost there; one more careful step, not two quick ones." },
];

// LineValue follows the classical three-coin casting:
//   6 = old yin (changing → yang)
//   7 = young yang (stable)
//   8 = young yin (stable)
//   9 = old yang (changing → yin)
// Lines are listed bottom-to-top (line 1 is the floor of the hexagram).
export type LineValue = 6 | 7 | 8 | 9;

export function isYang(v: LineValue): boolean {
  return v === 7 || v === 9;
}

export function isMoving(v: LineValue): boolean {
  return v === 6 || v === 9;
}

export function tossOneLine(): LineValue {
  // Three coins, heads = 3, tails = 2, sum is one of {6,7,8,9}.
  const sum =
    (Math.random() < 0.5 ? 2 : 3) +
    (Math.random() < 0.5 ? 2 : 3) +
    (Math.random() < 0.5 ? 2 : 3);
  return sum as LineValue;
}

export function castSixLines(): LineValue[] {
  return Array.from({ length: 6 }, tossOneLine);
}
