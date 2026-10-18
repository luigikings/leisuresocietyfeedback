// Screen and question transitions (RF-103 to RF-108). Pure module: no DOM, no network, no clock
// (the current time is passed in as `now`).

/** Fade-out and fade-in durations, in ms (RF-103: 200 + 350 = 550 at most). */
export const TRANSITION_OUT_MS = 200;
export const TRANSITION_IN_MS = 350;

/** With reduced motion: a single fade-in, in ms (RF-108). */
export const REDUCED_FADE_MS = 200;

/** How the city is shown on each screen: "none" (intro, country), "question" or "final". */
export function cityMode(screen) {
  if (screen === "question") return "question";
  if (screen === "final") return "final";
  return "none";
}

const NONE = Object.freeze({ scope: "none", outMs: 0, inMs: 0, totalMs: 0, cityFades: false, rise: false });

/**
 * Plans the transition between two painted states `{ screen, current }`.
 * prev null (first paint, reload, resume) or the same screen and question → no transition (RF-107).
 * Question → question fades only the panel (RF-104); any other screen change fades the screen, and the city too
 * when its mode changes. Reduced motion: a single 200 ms fade-in (RF-108). Towards the final screen there is
 * no fade-in: the final screen brings its own arrival (RF-74).
 * rise: the fade-in also moves up 10 px ("rise", RF-143); only with a fade-in, without reduced motion and not
 * towards the final screen.
 * @returns {{ scope: "none"|"panel"|"screen", outMs: number, inMs: number, totalMs: number, cityFades: boolean,
 *   rise: boolean }}
 */
export function planTransition(prev, next, { reduced = false } = {}) {
  if (!prev || !next) return { ...NONE };
  const sameScreen = prev.screen === next.screen;
  if (sameScreen && (prev.screen !== "question" || prev.current === next.current)) return { ...NONE };

  const scope = sameScreen ? "panel" : "screen";
  const cityFades = scope === "screen" && cityMode(prev.screen) !== cityMode(next.screen);
  const outMs = reduced ? 0 : TRANSITION_OUT_MS;
  const inMs = reduced ? REDUCED_FADE_MS : next.screen === "final" ? 0 : TRANSITION_IN_MS;
  const rise = inMs > 0 && !reduced && next.screen !== "final";
  return { scope, outMs, inMs, totalMs: outMs + inMs, cityFades, rise };
}

/** A gate that lets every action through. */
export function openGate() {
  return { busyUntil: 0 };
}

/** Closes the gate from `now` for `totalMs` (returns a new gate; the input is not changed). */
export function closeGate(gate, now, totalMs) {
  return { ...gate, busyUntil: now + totalMs };
}

/** Whether an action is allowed at `now` (RF-106). Time-based only, so it never stays closed for good. */
export function gateAllows(gate, now) {
  return now >= gate.busyUntil;
}
