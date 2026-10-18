// Intro entry timeline and loops (RF-86, RF-98, RF-100, RF-119 to RF-123). Pure module: no DOM, no network, no clock.
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

/**
 * Intro loops (RF-119 to RF-121): 4 bulbs in a 1.6 s chase, a highlight that stops 400 ms on each of the
 * 13 valued board cells, and the 3 marker screens with a 1.5 s cycle. css/survey.css uses the same values.
 */
export const INTRO_LOOPS = Object.freeze({
  bulbs: Object.freeze({ count: 4, cycleMs: 1600 }),
  board: Object.freeze({ count: 13, stepMs: 400 }),
  markers: Object.freeze({ count: 3, cycleMs: 1500 }),
});

/** Flashes per second of a loop (RF-86): count per cycle, or one per step. */
export function flashesPerSecond(loop) {
  if (loop.stepMs !== undefined) return 1000 / loop.stepMs;
  return loop.count / (loop.cycleMs / 1000);
}

const BOARD_COLUMNS = ["Well-being", "Community", "Economy", "Culture & identity", "Access & inclusion"];
const BOARD_EMPTY = new Set(["1-1", "3-2"]); // [col-row]: Community 200 and Culture & identity 300, already played

/** The 13 valued board cells in reading order (RF-120): { col, row, column, value }. */
export const BOARD_SEQUENCE = Object.freeze(
  [0, 1, 2].flatMap((row) => BOARD_COLUMNS.flatMap((column, col) =>
    BOARD_EMPTY.has(`${col}-${row}`) ? [] : [Object.freeze({ col, row, column, value: (row + 1) * 100 })])),
);

/** The markers count from 0 to their value from 1000 ms for 800 ms, inside the 2 s entry (RF-123). */
export const MARKER_COUNT = Object.freeze({ start: 1000, duration: 800 });

/** Value a marker shows `elapsedMs` after the entry starts: 0, then increasing multiples of 10, then target. */
export function markerValueAt(target, elapsedMs, count = MARKER_COUNT) {
  const p = Math.min(1, Math.max(0, (elapsedMs - count.start) / count.duration));
  if (p >= 1) return target;
  return Math.floor((target * p) / 10) * 10;
}

/** Whether to count: only if the count has not started yet; otherwise the HTML keeps its final values. */
export function markerCountPlan(elapsedMs, count = MARKER_COUNT) {
  return Number.isFinite(elapsedMs) && elapsedMs < count.start ? "count" : "skip";
}
