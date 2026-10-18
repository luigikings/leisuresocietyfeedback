// Intro entry timeline (RF-98, RF-100). Pure module: no DOM, no network, no clock.
// The same values are written literally in css/survey.css (`.screen--intro`); a test checks they match.

/** The whole entry lasts 2 s at most (RF-98). */
export const INTRO_ENTRY_MAX_MS = 2000;

/** The button highlight lasts 600 ms at most and never hides or moves it (RF-100). */
export const BUTTON_HIGHLIGHT_MAX_MS = 600;

const step = (id, start, duration) => Object.freeze({ id, start, duration });

/** Entry steps in the order of RF-98; times in ms. */
export const INTRO_ENTRY = Object.freeze([
  step("lights", 0, 500), //    rail, 4 spotlights and beams
  step("sign", 200, 400), //    "Leisure in / Jeopardy" sign and bulbs
  step("board", 400, 500), //   board
  step("onair", 650, 350), //   posts and "On air"
  step("floor", 800, 300), //   stage edge and floor
  step("people", 950, 500), //  contestants and lecterns
  step("thanks", 1200, 400), // RF-81 text
  step("ask", 1350, 400), //    RF-82 text
  step("button", 1400, 600), // button highlight (no opacity, no movement)
]);

/** End of the entry: the latest start + duration (0 for no steps). */
export function introEntryEndMs(steps = INTRO_ENTRY) {
  return steps.reduce((end, s) => Math.max(end, s.start + s.duration), 0);
}

/** CSS custom properties for each step: { "--enter-<id>-start": "<n>ms", "--enter-<id>-dur": "<n>ms" }. */
export function introEntryCssVars(steps = INTRO_ENTRY) {
  const vars = {};
  for (const s of steps) {
    vars[`--enter-${s.id}-start`] = `${s.start}ms`;
    vars[`--enter-${s.id}-dur`] = `${s.duration}ms`;
  }
  return vars;
}
