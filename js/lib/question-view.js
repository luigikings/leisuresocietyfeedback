// What the question screen shows, derived from the survey state. Pure module: no DOM, no network.
// The UI (js/app/screens/question.js) only paints this object. RF-17 to RF-26, RF-30, RF-31, RNF-4.
import { currentQuestion, fieldFor, canGoNext } from "./survey-state.js";
import { remaining } from "./text.js";

/** Label of the single text field, by the kind returned by fieldFor() (RF-20 to RF-22). */
export const FIELD_LABELS = Object.freeze({
  why: "Want to tell us why? (optional)",
  required: "Tell us… (required)",
  optional: "Tell us more (optional)",
});

/**
 * @returns {null | {
 *   questionId: string, number: number, total: number, countText: string, text: string,
 *   options: Array<{letter: string, label: string, checked: boolean}>, checkedLetter: string|null,
 *   field: null|"why"|"required"|"optional", fieldLabel: string|null, required: boolean,
 *   fieldText: string, remaining: number, remainingText: string, canNext: boolean, showBack: boolean }}
 */
export function questionView(state, content) {
  const q = currentQuestion(state, content);
  if (!q) return null;
  const draft = state.drafts[q.id] ?? { option: null, text: "" };
  const chosen = q.options.find((o) => o.letter === draft.option) ?? null;
  const field = fieldFor(chosen);
  const fieldText = draft.text ?? "";
  const left = remaining(fieldText);
  const total = content.questions.length;
  return {
    questionId: q.id,
    number: state.current,
    total,
    countText: `Question ${state.current} of ${total}`,
    text: q.text,
    options: q.options.map((o) => ({ letter: o.letter, label: o.label, checked: o === chosen })),
    checkedLetter: chosen ? chosen.letter : null,
    field,
    fieldLabel: field ? FIELD_LABELS[field] : null,
    required: field === "required",
    fieldText,
    remaining: left,
    remainingText: `${left} ${left === 1 ? "character" : "characters"} left`,
    canNext: canGoNext(state, content),
    showBack: state.current > 1,
  };
}

/**
 * Radio-group keyboard pattern (RNF-4): letter to select for a key, or null when the key is not handled.
 * Arrows move (and wrap), Home/End jump to the ends. Without a selection, forward keys pick the first.
 */
export function optionForKey(letters, current, key) {
  const n = letters.length;
  if (n === 0) return null;
  const i = letters.indexOf(current);
  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
      return letters[i === -1 ? 0 : (i + 1) % n];
    case "ArrowUp":
    case "ArrowLeft":
      return letters[i === -1 ? n - 1 : (i - 1 + n) % n];
    case "Home":
      return letters[0];
    case "End":
      return letters[n - 1];
    default:
      return null;
  }
}
