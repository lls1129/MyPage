// Lingqian (灵签) — fortune sticks. Traditionally drawn from a bamboo tube
// in temples (most famously the 100-stick set at Lord Guan's shrine). 99
// here, written original to fit the site's voice — gentle, contemplative,
// pastel rather than oracular. Each one has a tier (the temple usual: 上
// auspicious / 中 neutral / 下 cautious), a verse line, and a brief reading.

export type Tier = "auspicious" | "neutral" | "cautious";

export type Lingqian = {
  n: number;
  tier: Tier;
  title: string;
  verse: string;
  meaning: string;
};

const ZH_DIGITS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

// Convert 1..99 into the Chinese numeral that would be carved on a temple
// fortune stick (e.g. 99 → 九十九). Falls back to the base-10 digits for
// anything outside that range, but the stick set itself is bounded 1..99.
export function toChineseNumeral(n: number): string {
  if (n <= 0) return "〇";
  if (n < 10) return ZH_DIGITS[n];
  if (n === 10) return "十";
  if (n < 20) {
    const ones = n - 10;
    return "十" + (ones > 0 ? ZH_DIGITS[ones] : "");
  }
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return ZH_DIGITS[tens] + "十" + (ones > 0 ? ZH_DIGITS[ones] : "");
  }
  return String(n);
}

export const LINGQIAN: Lingqian[] = [
  { n: 1, tier: "auspicious", title: "first light", verse: "the eastern sky brightens", meaning: "a new beginning is closer than you think — start the small thing." },
  { n: 2, tier: "auspicious", title: "spring rain", verse: "a soft rain on dry earth", meaning: "what was waiting will accept what you offer." },
  { n: 3, tier: "neutral", title: "still water", verse: "the pond holds its own sky", meaning: "stay where you are; clarity comes from not stirring the surface." },
  { n: 4, tier: "auspicious", title: "open road", verse: "the gate is unlatched", meaning: "the path forward is clear; take the first step today." },
  { n: 5, tier: "cautious", title: "hidden stones", verse: "watch your footing on the rocks", meaning: "the obstacle isn't where you're looking; slow down." },
  { n: 6, tier: "auspicious", title: "warm hearth", verse: "the fire keeps the room awake", meaning: "your home is the answer this week — tend it." },
  { n: 7, tier: "neutral", title: "patient loom", verse: "the thread crosses the thread", meaning: "the pattern emerges from doing it again, not from doing it bigger." },
  { n: 8, tier: "auspicious", title: "fellow traveler", verse: "two pairs of footprints in snow", meaning: "ask for the help you've been postponing." },
  { n: 9, tier: "cautious", title: "false bridge", verse: "the planks look new but creak", meaning: "verify before you commit; not everything offered is sound." },
  { n: 10, tier: "auspicious", title: "lantern", verse: "a small light, all the way home", meaning: "you have what you need; trust the lamp you already carry." },
  { n: 11, tier: "neutral", title: "low tide", verse: "the sea folds back", meaning: "this is a withdrawing season — gather, don't reach." },
  { n: 12, tier: "auspicious", title: "ripe pear", verse: "the branch bends with weight", meaning: "an effort is finishing well; receive the fruit gracefully." },
  { n: 13, tier: "cautious", title: "shifting sand", verse: "the dune is not where it was", meaning: "the situation changed under you; check your assumptions." },
  { n: 14, tier: "neutral", title: "two bowls", verse: "one for you, one for the guest", meaning: "share what you have; the hospitality returns." },
  { n: 15, tier: "auspicious", title: "river thaw", verse: "the ice cracks at noon", meaning: "what was frozen between you is ready to move again." },
  { n: 16, tier: "cautious", title: "careless cup", verse: "tea spills on the silk", meaning: "a small carelessness becomes a story you carry — slow down." },
  { n: 17, tier: "auspicious", title: "young bamboo", verse: "the shoot pushes through stone", meaning: "you are growing in the place where you were told you couldn't." },
  { n: 18, tier: "neutral", title: "long letter", verse: "ink fills the page slowly", meaning: "say it all the way through; the partial sentence is not the truth yet." },
  { n: 19, tier: "auspicious", title: "harvest moon", verse: "the field is bright at night", meaning: "an old effort will pay quietly this month." },
  { n: 20, tier: "cautious", title: "borrowed coat", verse: "the sleeves don't quite fit", meaning: "you are wearing someone else's expectation; check whose it is." },
  { n: 21, tier: "neutral", title: "shared umbrella", verse: "the rain falls on both shoulders", meaning: "compromise this week; the dryness costs less than the argument." },
  { n: 22, tier: "auspicious", title: "swallow returning", verse: "the eaves remember the bird", meaning: "someone who left is coming back; receive without testing." },
  { n: 23, tier: "cautious", title: "cracked vessel", verse: "water leaks where you can't see", meaning: "the source is fine; the container needs mending." },
  { n: 24, tier: "auspicious", title: "kindling", verse: "small dry sticks make the fire", meaning: "many small actions outperform one large gesture this week." },
  { n: 25, tier: "neutral", title: "two paths", verse: "the road forks under the pine", meaning: "either is good; the agony is the choosing, not the choice." },
  { n: 26, tier: "auspicious", title: "old friend", verse: "a familiar voice on the line", meaning: "reach out to someone you've lost touch with — they'll be glad." },
  { n: 27, tier: "cautious", title: "boundary stone", verse: "the marker has been moved", meaning: "an agreement is being quietly redrawn; clarify before it sets." },
  { n: 28, tier: "neutral", title: "stone tablet", verse: "the names have weathered", meaning: "what mattered then matters less now; release the old grievance." },
  { n: 29, tier: "auspicious", title: "morning bell", verse: "the temple wakes the valley", meaning: "an opportunity wants you to wake to it — don't sleep through the call." },
  { n: 30, tier: "cautious", title: "tangled net", verse: "the more you pull, the worse it gets", meaning: "stop trying to fix it from inside; ask someone with fresh hands." },
  { n: 31, tier: "auspicious", title: "calm sea", verse: "the boat barely needs the rudder", meaning: "the currents are with you this month; let the water do half the work." },
  { n: 32, tier: "neutral", title: "lantern festival", verse: "many small lights, one warm street", meaning: "be in company, not alone; the answer is a group answer." },
  { n: 33, tier: "auspicious", title: "ripening rice", verse: "the heads bow with grain", meaning: "the work you can't see is almost done; don't lift the cover early." },
  { n: 34, tier: "cautious", title: "thin ice", verse: "the surface looks like floor", meaning: "an apparent stability isn't; test before you cross." },
  { n: 35, tier: "auspicious", title: "carp leaping", verse: "the fish meets the gate", meaning: "a long effort meets its mark; recognition is near." },
  { n: 36, tier: "neutral", title: "evening star", verse: "the first light in the dusk", meaning: "the day's noise is over; listen for the quieter signal." },
  { n: 37, tier: "cautious", title: "uninvited guest", verse: "footsteps you didn't expect", meaning: "someone is asking for more than the situation allows; set the limit kindly." },
  { n: 38, tier: "auspicious", title: "rain after drought", verse: "the leaves remember themselves", meaning: "a long lack ends; receive without bracing for the next dryness." },
  { n: 39, tier: "neutral", title: "wandering monk", verse: "one bowl, one road", meaning: "travel light this week — physically, mentally, in commitments." },
  { n: 40, tier: "auspicious", title: "quiet promotion", verse: "the praise comes in private", meaning: "good news arrives without fanfare; trust it anyway." },
  { n: 41, tier: "cautious", title: "false dawn", verse: "the light shines and fades", meaning: "an opening that closes too quickly — don't read it as more than it was." },
  { n: 42, tier: "auspicious", title: "lotus opening", verse: "the bloom rises through mud", meaning: "your beauty in this moment is also your difficulty; don't separate them." },
  { n: 43, tier: "neutral", title: "shared rice", verse: "two bowls from one pot", meaning: "the small portion is enough if it's shared." },
  { n: 44, tier: "auspicious", title: "river joining", verse: "two streams find each other", meaning: "an alliance forms this week; meet it openly." },
  { n: 45, tier: "cautious", title: "borrowed name", verse: "someone speaks for you", meaning: "your reputation is being told without you in the room — show up." },
  { n: 46, tier: "neutral", title: "still loom", verse: "the shuttle paused mid-row", meaning: "rest the work; resume tomorrow." },
  { n: 47, tier: "auspicious", title: "first frost", verse: "the field hardens for winter", meaning: "an ending now is the foundation for spring — let it freeze." },
  { n: 48, tier: "cautious", title: "leaking roof", verse: "the rain finds the same spot", meaning: "the small problem you keep ignoring is getting worse." },
  { n: 49, tier: "auspicious", title: "quiet feast", verse: "the table is full but not loud", meaning: "the people you love are nearby; lean in without performance." },
  { n: 50, tier: "neutral", title: "half moon", verse: "a face that is also a profile", meaning: "you are seeing one side; the other is also true." },
  { n: 51, tier: "cautious", title: "wrong key", verse: "the lock turns but won't open", meaning: "the door isn't yours; stop trying to unlock it." },
  { n: 52, tier: "auspicious", title: "found coin", verse: "the ground gives a small gift", meaning: "luck visits in a tiny form; thank it without scaling it up." },
  { n: 53, tier: "neutral", title: "letter unsent", verse: "the page is folded, not delivered", meaning: "you said the thing to yourself; that may be enough this time." },
  { n: 54, tier: "auspicious", title: "bridge of stones", verse: "step, then step, then step", meaning: "you cannot do it all at once; the next stone is allowed to be small." },
  { n: 55, tier: "cautious", title: "narrow gate", verse: "the gate fits one but not two", meaning: "you can't bring everything you've packed; choose what to leave." },
  { n: 56, tier: "auspicious", title: "paper kite", verse: "the wind carries the string", meaning: "let go of control; the lift is doing its work." },
  { n: 57, tier: "neutral", title: "borrowed lamp", verse: "the light is real but not yours", meaning: "you are operating on someone else's energy; thank them and rest." },
  { n: 58, tier: "auspicious", title: "warming kiln", verse: "the clay accepts the fire", meaning: "a transformation is on schedule; trust the temperature." },
  { n: 59, tier: "cautious", title: "old grievance", verse: "the wound hasn't quite scarred", meaning: "stop reopening it for the audience; tend it in private." },
  { n: 60, tier: "neutral", title: "soft snow", verse: "everything quieter than yesterday", meaning: "the world wants you slower right now; match it." },
  { n: 61, tier: "auspicious", title: "guest house", verse: "a clean room for the traveler", meaning: "be hospitable to a feeling that arrived uninvited — it has news." },
  { n: 62, tier: "cautious", title: "loose tile", verse: "the wall holds, but the corner shifts", meaning: "a minor failure is foreshadowing a larger one; address it now." },
  { n: 63, tier: "auspicious", title: "double rainbow", verse: "the sky wears two arcs", meaning: "a coincidence is more than coincidence; pay attention." },
  { n: 64, tier: "neutral", title: "morning fog", verse: "shapes without their names yet", meaning: "you don't have to know what it is yet; keep walking." },
  { n: 65, tier: "auspicious", title: "open palm", verse: "the hand offers, doesn't grip", meaning: "give without measuring the return; the season is generous." },
  { n: 66, tier: "cautious", title: "borrowed time", verse: "the clock keeps running", meaning: "the deadline you've ignored is real; act this week, not next." },
  { n: 67, tier: "auspicious", title: "evening tea", verse: "the cup warms two hands", meaning: "a quiet conversation will do more than a meeting." },
  { n: 68, tier: "neutral", title: "empty page", verse: "the brush hovers", meaning: "the thing you cannot start yet is already half-formed; come back tomorrow." },
  { n: 69, tier: "cautious", title: "loose tongue", verse: "the words run faster than the heart", meaning: "say less than you want to today; tomorrow you'll be glad." },
  { n: 70, tier: "auspicious", title: "rising tide", verse: "the boats lift together", meaning: "a wave is bringing many things up at once; let your good news ride along." },
  { n: 71, tier: "neutral", title: "winter pine", verse: "green when nothing else is", meaning: "you are the steady one in the room right now — that is enough." },
  { n: 72, tier: "auspicious", title: "first plum", verse: "a single bloom in the cold", meaning: "courage in an unkind season; the rest will follow." },
  { n: 73, tier: "cautious", title: "fading dye", verse: "the cloth pales in the sun", meaning: "what was vivid is losing color; refresh or accept the change." },
  { n: 74, tier: "auspicious", title: "trusted boat", verse: "the hull has crossed before", meaning: "an experienced ally — trust the one who's done this with you." },
  { n: 75, tier: "neutral", title: "shifting wind", verse: "the sail finds a new angle", meaning: "the plan needs to bend, not break; adjust without ceremony." },
  { n: 76, tier: "auspicious", title: "candle in the window", verse: "someone left a light for you", meaning: "you are being thought of more kindly than you know." },
  { n: 77, tier: "cautious", title: "broken seal", verse: "the letter was opened by another", meaning: "a confidence has slipped; assume the room knows." },
  { n: 78, tier: "neutral", title: "shared road", verse: "the path widens for many", meaning: "you are not the first to walk this; ask the ones before you." },
  { n: 79, tier: "auspicious", title: "deep well", verse: "the bucket comes up full", meaning: "an old source you forgot has water still — return to it." },
  { n: 80, tier: "cautious", title: "borrowed silver", verse: "what shines isn't yours yet", meaning: "the credit you're enjoying is on loan; pay the underlying debt." },
  { n: 81, tier: "auspicious", title: "soft answer", verse: "the harsh word turns away", meaning: "your gentleness this week disarms more than your strength would." },
  { n: 82, tier: "neutral", title: "long silence", verse: "the room holds the unsaid", meaning: "wait the silence out; the other person needs the room to find their words." },
  { n: 83, tier: "auspicious", title: "found path", verse: "the trail returns under your feet", meaning: "you were not lost; you were taking a longer way home." },
  { n: 84, tier: "cautious", title: "thin coat", verse: "the wind finds every gap", meaning: "you're underprepared for what's coming — add a layer." },
  { n: 85, tier: "neutral", title: "evening market", verse: "the vendors begin to close", meaning: "the time to choose is almost past; pick or leave with empty hands." },
  { n: 86, tier: "auspicious", title: "old garden", verse: "the seeds remember", meaning: "a relationship you tended long ago is ready to flower again." },
  { n: 87, tier: "cautious", title: "false weight", verse: "the scale tips the wrong way", meaning: "a measurement you trust is off; double-check the numbers." },
  { n: 88, tier: "auspicious", title: "doubled luck", verse: "two birds on one branch", meaning: "good news arrives in pairs this week; be ready to thank twice." },
  { n: 89, tier: "neutral", title: "hand on door", verse: "the latch isn't yet lifted", meaning: "you are about to begin; pause one breath before you do." },
  { n: 90, tier: "auspicious", title: "river return", verse: "the water remembers the sea", meaning: "a long detour ends; the place you were going has been waiting." },
  { n: 91, tier: "cautious", title: "thin hope", verse: "the candle gutters", meaning: "your hope here is real but small — protect it from drafts of cynicism." },
  { n: 92, tier: "neutral", title: "two seasons", verse: "the same tree, different leaves", meaning: "the relationship has changed; love it as what it is now." },
  { n: 93, tier: "auspicious", title: "warm broth", verse: "what the body asked for", meaning: "the small kindness to yourself this week is the real medicine." },
  { n: 94, tier: "cautious", title: "shifting allies", verse: "the table is rearranged", meaning: "a friendship is repositioning; don't take the early signal as the final story." },
  { n: 95, tier: "auspicious", title: "ancestral tea", verse: "the cup steadies you", meaning: "remember who you come from this week; the steadiness is theirs too." },
  { n: 96, tier: "neutral", title: "long shadow", verse: "the day stretches the form", meaning: "a thing you did is being seen larger than it was — neither lean in nor flinch." },
  { n: 97, tier: "auspicious", title: "found language", verse: "the right word, finally", meaning: "you've been close to it for weeks; today you'll find what to say." },
  { n: 98, tier: "cautious", title: "open window", verse: "the wind takes the page", meaning: "what you didn't secure is gone now; let it leave without chasing." },
  { n: 99, tier: "auspicious", title: "evening bell", verse: "the day closes the day", meaning: "a chapter ends gently; thank it and rest." },
];
