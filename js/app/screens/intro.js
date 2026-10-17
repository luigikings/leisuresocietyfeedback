// Intro: stage of the first event "Leisure in Jeopardy" (Annex B), two texts and "Give feedback"
// (RF-5 to RF-9, RF-80 to RF-88). The stage is an inline SVG; its loop is pure CSS and never blocks the
// button, which is in the HTML from the first paint and works at any moment of the loop (RF-7, RF-9).

/**
 * @param {HTMLElement} section the #screen-intro section
 * @param {{ onStart: () => void }} opts
 */
export function mountIntro(section, { onStart }) {
  section.querySelector("[data-action=start]").addEventListener("click", () => onStart());
}
