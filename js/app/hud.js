// Progress header, question bar, ring and "Lit up" toast (RF-125 to RF-138, RF-148, plan §16.5).
// UI adapter: paints what js/lib/progress.js (progressView) and js/lib/city-view.js (celebration) computed.
import { RING_MS, TOAST_MS, toastPlacement } from "../lib/city-view.js";

/** One toast timer and one ring timer per #city-wrap, so a new toast cancels the old one (RF-136). */
const timersOf = new WeakMap();

function state(wrap) {
  let s = timersOf.get(wrap);
  if (!s) {
    s = { toast: 0, ring: 0, ringEl: null };
    timersOf.set(wrap, s);
  }
  return s;
}

/**
 * Creates the segments of the question bar (.segs) as <i> elements, one per question (RF-128).
 * A second call rebuilds them.
 * @param {Element} wrap #city-wrap
 * @param {number} [total]
 */
export function mountHud(wrap, total = 10) {
  const segs = wrap.querySelector(".segs");
  const doc = segs.ownerDocument;
  segs.replaceChildren(...Array.from({ length: total }, () => doc.createElement("i")));
}

/**
 * Writes the percentage and "N of 10 places" and marks the filled and current segments (RF-125 to RF-130).
 * @param {Element} wrap #city-wrap
 * @param {{ percentText: string, placesText: string, segments: Array<{ filled: boolean, current: boolean }> }} view
 */
export function paintHud(wrap, view) {
  wrap.querySelector(".hud__pct").textContent = view.percentText;
  wrap.querySelector(".hud__count").textContent = view.placesText;
  const segs = wrap.querySelector(".segs").children;
  view.segments.forEach((seg, i) => {
    const el = segs[i];
    if (!el) return;
    el.classList.toggle("is-filled", seg.filled);
    el.classList.toggle("is-current", seg.current);
  });
}

/**
 * Plays what celebration() decided (RF-134 to RF-138, RF-148):
 * - ring: .is-new on the new site's <g data-site> for RING_MS (the CSS animation; none with reduced motion);
 * - toast: "Lit up: <name>" with textContent, data-place top|bottom (toastPlacement) and .is-shown for
 *   TOAST_MS, with a single timer that a new toast cancels and restarts (RF-136);
 * - a new site without a toast (Q10 towards the final, RF-148) also hides a toast still shown;
 * - nothing new (first paint, changed answer, Back): nothing changes.
 * @param {Element} wrap #city-wrap
 * @param {{ siteId: string|null, ring: boolean, toast: string|null }} c
 * @param {{ timers?: { setTimeout: Function, clearTimeout: Function } }} [options]
 */
export function celebrate(wrap, c, { timers = globalThis } = {}) {
  if (c.siteId === null) return;
  const s = state(wrap);
  const toast = wrap.querySelector(".city__toast");

  if (c.ring) {
    const site = wrap.querySelector(`[data-site="${c.siteId}"]`);
    if (site) {
      if (s.ringEl && s.ringEl !== site) s.ringEl.classList.toggle("is-new", false);
      timers.clearTimeout(s.ring);
      site.classList.toggle("is-new", true);
      s.ringEl = site;
      s.ring = timers.setTimeout(() => {
        site.classList.toggle("is-new", false);
        s.ringEl = null;
        s.ring = 0;
      }, RING_MS);
    }
  }

  timers.clearTimeout(s.toast);
  s.toast = 0;
  if (!c.toast) {
    toast.classList.toggle("is-shown", false);
    return;
  }
  toast.textContent = c.toast;
  toast.setAttribute("data-place", toastPlacement(c.siteId));
  toast.classList.toggle("is-shown", true);
  s.toast = timers.setTimeout(() => {
    toast.classList.toggle("is-shown", false);
    s.toast = 0;
  }, TOAST_MS);
}
