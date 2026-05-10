// Tarot Major Arcana — 22 cards. Names + brief meanings are based on the
// public-domain Rider–Waite–Smith tradition; prompts are written here in a
// gentle voice that fits the rest of the site. `reversed` is the shadow /
// blocked reading shown in advanced mode when the card lands inverted.

export type TarotCard = {
  number: number;
  name: string;
  glyph: string;
  meaning: string;
  reversed: string;
  prompt: string;
};

export const TAROT_MAJOR: TarotCard[] = [
  { number: 0, name: "The Fool", glyph: "✦", meaning: "beginnings, innocence, a leap of faith", reversed: "recklessness, naivety, hesitation at the cliff", prompt: "what would you start if you knew nothing could go wrong?" },
  { number: 1, name: "The Magician", glyph: "♂", meaning: "manifestation, will, focused intention", reversed: "scattered focus, untapped potential, manipulation", prompt: "what is yours to make today?" },
  { number: 2, name: "The High Priestess", glyph: "☾", meaning: "intuition, mystery, the inner voice", reversed: "secrets withheld from yourself, intuition ignored", prompt: "what does the part of you that already knows say?" },
  { number: 3, name: "The Empress", glyph: "♀", meaning: "abundance, nurturing, creative life", reversed: "creative block, smothering, neglect of self", prompt: "what is asking to be tended?" },
  { number: 4, name: "The Emperor", glyph: "♃", meaning: "structure, authority, steady foundations", reversed: "rigidity, control, structures that no longer fit", prompt: "what needs a clear edge today?" },
  { number: 5, name: "The Hierophant", glyph: "✟", meaning: "tradition, learning, established paths", reversed: "dogma, conformity for its own sake, unlearning needed", prompt: "what wisdom have you not yet asked for?" },
  { number: 6, name: "The Lovers", glyph: "♡", meaning: "union, choice, deep alignment", reversed: "misalignment, avoidance of a choice, half-hearted yes", prompt: "where are you being asked to choose with your whole heart?" },
  { number: 7, name: "The Chariot", glyph: "↟", meaning: "willpower, direction, controlled momentum", reversed: "directionless force, control surrendered to others", prompt: "what would you steer toward if you trusted yourself?" },
  { number: 8, name: "Strength", glyph: "∞", meaning: "courage, gentle force, patient power", reversed: "force without grace, self-doubt, exhaustion", prompt: "where can softness do what force cannot?" },
  { number: 9, name: "The Hermit", glyph: "☉", meaning: "introspection, solitude, an inner light", reversed: "isolation past usefulness, refusal to come back", prompt: "what wants to be heard in the quiet?" },
  { number: 10, name: "Wheel of Fortune", glyph: "⊛", meaning: "cycles, change, the turn of fate", reversed: "resistance to change, a wheel stuck in mud", prompt: "what is moving even when you can't see it move?" },
  { number: 11, name: "Justice", glyph: "⚖", meaning: "fairness, truth, cause and effect", reversed: "denial of consequence, unfair scales, dishonesty with self", prompt: "where is the balance asking to be restored?" },
  { number: 12, name: "The Hanged Man", glyph: "✥", meaning: "surrender, new perspective, willing pause", reversed: "stubborn resistance, sacrifice without purpose", prompt: "what would change if you stopped trying to fix it?" },
  { number: 13, name: "Death", glyph: "✿", meaning: "endings, transformation, release", reversed: "clinging to what's already over, fear of the next chapter", prompt: "what is ready to be let go of?" },
  { number: 14, name: "Temperance", glyph: "✶", meaning: "balance, blending, patient measure", reversed: "extremes, impatience, rushing the alchemy", prompt: "what two things in you are asking to be reconciled?" },
  { number: 15, name: "The Devil", glyph: "⛧", meaning: "attachment, shadow, the chains we forge", reversed: "the chains loosening, light entering the dark", prompt: "what story keeps you small?" },
  { number: 16, name: "The Tower", glyph: "⚡", meaning: "sudden upheaval, revealed truth, awakening", reversed: "delayed reckoning, structures cracking quietly", prompt: "what would freedom on the other side of this look like?" },
  { number: 17, name: "The Star", glyph: "✩", meaning: "hope, renewal, calm faith", reversed: "lost faith, hope deferred, overcast skies", prompt: "what is the small light you can keep walking toward?" },
  { number: 18, name: "The Moon", glyph: "☽", meaning: "illusion, dreams, hidden currents", reversed: "fog lifting, anxiety quieting, what was hidden becomes seen", prompt: "what is true in the dark that you forget in the light?" },
  { number: 19, name: "The Sun", glyph: "☀", meaning: "joy, vitality, simple delight", reversed: "joy dimmed but still there, cloud across the sun", prompt: "what's already going well that you haven't celebrated?" },
  { number: 20, name: "Judgement", glyph: "✝", meaning: "reckoning, rebirth, an honest look", reversed: "self-judgment too harsh, the call ignored", prompt: "what are you ready to call by its true name?" },
  { number: 21, name: "The World", glyph: "♁", meaning: "completion, wholeness, integration", reversed: "almost-complete, the final piece still pending", prompt: "what chapter is quietly ending?" },
];

export const SPREADS = [
  { id: "ppf", label: "past · present · future", positions: ["past", "present", "future"] },
  { id: "mbs", label: "mind · body · spirit", positions: ["mind", "body", "spirit"] },
  { id: "sao", label: "situation · action · outcome", positions: ["situation", "action", "outcome"] },
] as const;

export type Spread = (typeof SPREADS)[number];
