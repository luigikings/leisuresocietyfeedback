// Free-text helpers. Pure module: no DOM, no network.
// Lengths are counted in Unicode code points after trimming, like Postgres char_length (RF-24, RF-25, RF-28).

/** Maximum length of any free-text field, in code points. */
export const MAX_TEXT = 280;

const str = (s) => (s == null ? "" : String(s));

/** Removes leading and trailing Unicode whitespace. */
export function trimText(s) {
  return str(s).trim();
}

/** Length in code points of the trimmed text (an emoji outside the BMP counts as 1). */
export function textLength(s) {
  return [...trimText(s)].length;
}

/** Cuts `s` to its first `max` code points (never splits a surrogate pair). */
export function clampText(s, max = MAX_TEXT) {
  const chars = [...str(s)];
  return chars.length <= max ? str(s) : chars.slice(0, max).join("");
}

/** Characters left before reaching MAX_TEXT (counter shown under the field). */
export function remaining(s) {
  return MAX_TEXT - textLength(s);
}

/** Text as stored: trimmed, or null when it is empty (RF-28). */
export function normalizeForStore(s) {
  const t = trimText(s);
  return t.length === 0 ? null : t;
}
