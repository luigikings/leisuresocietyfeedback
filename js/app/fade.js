// Fades for screen and question changes (RF-103, RF-104, RF-108, RF-143), with the Web Animations API: the
// fade-out is opacity only; the fade-in can also rise 10 px ("rise", RF-143), never with reduced motion.
// UI adapter only: the durations come from js/lib/transition.js. WAAPI and not CSS keyframes because the
// question section stays the same between two questions (a CSS animation would need a forced reflow to
// restart) and because the reduced-motion rule (animation: none !important) must not cancel the 200 ms fade
// that RF-108 keeps. Only this module's own fades are cancelled: CSS animations (intro loop, final) are kept.

const fades = new WeakMap(); // element → its running fade

/** Stops the fade on each element and gives it back its normal opacity. */
export function cancelFades(elements) {
  for (const el of elements) {
    fades.get(el)?.cancel();
    fades.delete(el);
  }
}

/** Fades the elements out in `ms` and holds them at opacity 0 until cancelFades() or fadeIn(). 0 → nothing. */
export function fadeOut(elements, ms) {
  cancelFades(elements);
  if (!(ms > 0)) return;
  for (const el of elements) {
    fades.set(el, el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: "ease-in", fill: "forwards" }));
  }
}

// Keyframes of the fade-in: plain, or with the 10 px rise of the reference demo (plan §16.6).
const FADE_IN = [{ opacity: 0 }, { opacity: 1 }];
const RISE_IN = [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }];

/**
 * Fades the elements in from opacity 0 in `ms`, then cancels the animation so no style is left. 0 → shown at once.
 * rise: they also move up from 10 px below (RF-143); the caller only asks for it without reduced motion.
 */
export function fadeIn(elements, ms, { rise = false } = {}) {
  cancelFades(elements);
  if (!(ms > 0)) return;
  const keyframes = rise ? RISE_IN : FADE_IN;
  for (const el of elements) {
    const anim = el.animate(keyframes, { duration: ms, easing: "ease-out" });
    fades.set(el, anim);
    anim.onfinish = () => {
      anim.cancel();
      if (fades.get(el) === anim) fades.delete(el);
    };
  }
}
