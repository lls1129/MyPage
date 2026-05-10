// Jiaobei (筊杯) — moon blocks. Two crescent-shaped pieces, each with a flat
// face and a curved face. Toss them; the combined outcome is the answer.
//
// Conventional readings (Hokkien temple practice):
//   聖筊 (sing bwa) — one flat up, one curved up: yes / agreement
//   笑筊 (chio bwa) — both curved up: laughing — the question or the asker
//                     needs refining, ask again differently
//   陰筊 (im bwa)  — both flat up: no / not now

export type Face = "flat" | "curved";

export type JiaoBeiOutcome = {
  kind: "yes" | "no" | "laughing";
  chinese: string;
  english: string;
  meaning: string;
  prompt: string;
};

export function tossOneBlock(): Face {
  return Math.random() < 0.5 ? "flat" : "curved";
}

export function readJiaoBei(left: Face, right: Face): JiaoBeiOutcome {
  const flats = (left === "flat" ? 1 : 0) + (right === "flat" ? 1 : 0);
  if (flats === 1) {
    return {
      kind: "yes",
      chinese: "聖筊",
      english: "agreement",
      meaning: "the answer is yes — the path you're considering has support.",
      prompt: "what would you do today if you trusted that yes?",
    };
  }
  if (flats === 0) {
    return {
      kind: "laughing",
      chinese: "笑筊",
      english: "laughing blocks",
      meaning: "the question itself isn't quite right yet — refine and ask again.",
      prompt: "what is the real question underneath the one you asked?",
    };
  }
  return {
    kind: "no",
    chinese: "陰筊",
    english: "not now",
    meaning: "the answer is no, or not yet — wait, or take a different shape.",
    prompt: "if this no were a kindness, what would it be protecting you from?",
  };
}
