// Multiple-choice answers (Q3) as one ordered string of letters: "A", "AC", "ABC" (RF-161, RF-164).
// Pure module: no DOM, no network, no clock. Shared by the survey and the /admin panel.

/** The only 7 values the table accepts for Q3, in A, B, C order (same list as the DB rule). */
export const MULTI_VALUES = Object.freeze(["A", "B", "C", "AB", "AC", "BC", "ABC"]);

/** True only when the content data marks the question as multiple choice (RF-154). */
export function isMultiple(question) {
  return question != null && question.multiple === true;
}

/** Distinct letters of a value, in the order they appear ("AC" → ["A", "C"]; "" or null → []). */
export function lettersOf(value) {
  if (typeof value !== "string") return [];
  return [...new Set(value)];
}

/**
 * Adds `letter` if it is not marked, or removes it if it is.
 * @param {string|null} value  current letters ("AC") or null
 * @param {string} letter  the tapped letter
 * @param {string[]} allLetters  the question letters, in order (["A", "B", "C"])
 * @returns {string|null} the letters ordered as in allLetters, without repeats; null if none is left.
 *   A letter that is not in allLetters leaves the value unchanged (normalised).
 */
export function toggleLetter(value, letter, allLetters) {
  const marked = new Set(lettersOf(value));
  if (allLetters.includes(letter)) {
    if (marked.has(letter)) marked.delete(letter);
    else marked.add(letter);
  }
  const result = allLetters.filter((l) => marked.has(l)).join("");
  return result === "" ? null : result;
}
