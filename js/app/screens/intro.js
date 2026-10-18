// Intro: stage of the first event "Leisure in Jeopardy" (Annex B), two texts and "Give feedback"
// (RF-5 to RF-9, RF-80 to RF-88). The stage is an inline SVG; its loops are pure CSS and never block the
// button, which is in the HTML from the first paint and works at any moment (RF-7, RF-9, RF-101).
// The only JS animation is the count of the 3 markers from 0 to 300/500/200 during the entry (RF-123, plan §16.8).
import { markerValueAt, markerCountPlan } from "../../lib/intro-entry.js";

/**
 * @param {HTMLElement} section the #screen-intro section
 * @param {{ onStart: () => void, now?: () => number, frame?: (cb: FrameRequestCallback) => number,
 *   cancel?: (id: number) => void }} opts clock and frame scheduler, injectable for the tests
 * @returns {{ show: () => void, hide: () => void }}
 */
export function mountIntro(section, {
  onStart,
  now = () => performance.now(),
  frame = (cb) => requestAnimationFrame(cb),
  cancel = (id) => cancelAnimationFrame(id),
}) {
  const scores = [...section.querySelectorAll(".plato__score")];
  const targets = scores.map((el) => el.textContent); // the HTML holds the final values (RF-85, RF-87)
  let pending = 0;

  /** Stops the count and puts back the final values. */
  function stop() {
    if (!pending) return;
    cancel(pending);
    pending = 0;
    scores.forEach((el, i) => { if (el.textContent !== targets[i]) el.textContent = targets[i]; });
  }

  /** Writes each marker's value at `elapsed` ms of the entry, only when it changes; true while still counting. */
  function paint(elapsed) {
    let counting = false;
    scores.forEach((el, i) => {
      const target = Number(targets[i]);
      const text = String(markerValueAt(target, elapsed));
      if (el.textContent !== text) el.textContent = text;
      if (text !== targets[i]) counting = true;
    });
    return counting;
  }

  /**
   * Starts the count if the entry is early enough (markerCountPlan). The time comes from the entry animation of
   * the "people" group, so it is in step with the CSS; with reduced motion there is no such animation (the
   * global rule sets animation: none) and the markers keep their final values without counting (RF-87, RF-124).
   */
  function show() {
    stop();
    const people = section.querySelector('[data-enter="people"]');
    const entry = people?.getAnimations?.().find((a) => a.animationName === "intro-enter");
    const elapsed = entry && entry.currentTime !== null ? Number(entry.currentTime) : Number.NaN;
    if (markerCountPlan(elapsed) !== "count") return;
    const origin = now() - elapsed;
    const tick = () => {
      pending = 0;
      if (paint(now() - origin)) pending = frame(tick);
    };
    paint(elapsed);
    pending = frame(tick);
  }

  section.querySelector("[data-action=start]").addEventListener("click", () => {
    stop(); // "Give feedback" works at once, even mid-count (RF-101, RF-124)
    onStart();
  });

  return { show, hide: stop };
}
