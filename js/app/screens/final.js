// Final screen (RF-53 to RF-56, RF-73, RF-74, RF-77, RF-79): the city goes full screen and the light wave
// crosses it, lighting the filler buildings, windows, lamps and streets as it passes (each one delayed by its
// --fx position); then cars drive along the avenues, confetti falls, the flags (no "Other") spin and join with
// a flash, and "Leisure for Society" + "Thank you" appear on a translucent panel. The timeline and positions
// come from js/lib/final-view.js; the animations are CSS and only run while the root has data-final="play".
// The base styles are the last state, so data-final="done" (end, reload, reduced motion) shows it directly.
// No team photo and no replay button (RF-55).
import { finalFlags, flagLayout, finalCssVars, finalEndMs, confettiPieces, FLAG_WIDTH, FLAG_HEIGHT } from "../../lib/final-view.js";

const CONFETTI_COUNT = 36;

function flagItem(flag, pos) {
  const li = document.createElement("li");
  li.className = "final-flag";
  li.style.setProperty("--sx", pos.sx);
  li.style.setProperty("--sy", pos.sy);
  li.style.setProperty("--ex", pos.ex);
  li.style.setProperty("--ey", pos.ey);
  li.style.setProperty("--rot", pos.rot);
  const img = document.createElement("img");
  img.className = "final-flag__img";
  img.width = FLAG_WIDTH;
  img.height = FLAG_HEIGHT;
  img.decoding = "async";
  img.loading = "lazy"; // built while hidden: never competes with the intro on first load (RNF-5)
  img.src = flag.src;
  img.alt = flag.name; // RNF-4
  li.append(img);
  return li;
}

function confettiPiece(p) {
  const el = document.createElement("i");
  el.className = "confetti__piece";
  el.style.setProperty("--x", `${p.x}%`);
  el.style.setProperty("--d", `${p.delay}ms`);
  el.style.setProperty("--t", `${p.duration}ms`);
  el.style.setProperty("--spin", `${p.spin}deg`);
  el.style.setProperty("--drift", `${p.drift}px`);
  el.style.setProperty("--c", p.color);
  return el;
}

/**
 * @param {HTMLElement} section the #screen-final section
 * @param {{ root: HTMLElement, countries: Array<{code, name}>, reducedMotion: () => boolean,
 *   random?: () => number }} opts
 * @returns {{ show(opts: { animate: boolean }): void, hide(): void }}
 */
export function mountFinal(section, { root, countries, reducedMotion, random = Math.random }) {
  const flags = finalFlags(countries);
  const layout = flagLayout(flags.length);
  section.querySelector(".final__flags").replaceChildren(...flags.map((f, i) => flagItem(f, layout[i])));

  const confetti = section.querySelector(".confetti");
  const thanks = section.querySelector(".final__thanks");
  for (const [name, value] of Object.entries(finalCssVars())) root.style.setProperty(name, value);

  let fallback = 0;
  const onEnd = (e) => {
    if (e.target === thanks) done();
  };

  function done() {
    clearTimeout(fallback);
    section.removeEventListener("animationend", onEnd);
    confetti.replaceChildren();
    root.dataset.final = "done"; // fixed last state (RF-54)
  }

  return {
    show({ animate }) {
      // Reload of a finished survey (RF-56) or reduced motion (RNF-2): last state, no animation.
      if (!animate || reducedMotion()) {
        done();
        return;
      }
      confetti.replaceChildren(...confettiPieces(CONFETTI_COUNT, random).map(confettiPiece));
      section.addEventListener("animationend", onEnd);
      // Safety net if animationend never arrives (e.g. animations paused in a background tab).
      fallback = setTimeout(done, finalEndMs() + 1500);
      root.dataset.final = "play";
    },
    hide() {
      clearTimeout(fallback);
      section.removeEventListener("animationend", onEnd);
      confetti.replaceChildren();
      delete root.dataset.final;
    },
  };
}
