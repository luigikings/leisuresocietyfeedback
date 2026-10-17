// Browser / Android back button and gesture (RF-33, RF-34), with the History API.
// The page keeps one extra "guard" history entry on top of its own. A back press pops the guard: we call
// onBack() (systemBack in js/lib/survey-state.js: like Back on questions 2-10, nothing elsewhere) and push the
// guard again, so the survey never leaves its screen through back. Progress is already in storage, so even
// if the browser skips the guard and leaves the page, nothing is lost.

const GUARD = { leisureCity: "guard" };
const isGuard = (state) => Boolean(state && state.leisureCity === "guard");

/**
 * @param {{ onBack(): void }} opts
 * @returns {{ ensureGuard(): void }} call ensureGuard() after user actions (some browsers ignore entries
 *   pushed without a user gesture, so the guard is re-checked on every interaction).
 */
export function createHistoryGuard({ onBack }) {
  const ensureGuard = () => {
    if (!isGuard(history.state)) history.pushState(GUARD, "");
  };

  window.addEventListener("popstate", (e) => {
    if (isGuard(e.state)) return; // forward navigation back onto the guard: nothing to do
    onBack();
    ensureGuard();
  });

  ensureGuard();
  return { ensureGuard };
}
