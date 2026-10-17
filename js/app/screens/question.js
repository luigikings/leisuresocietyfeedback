// Question screen: options A/B/C as a radio group (letter in a round "bulb", check icon when chosen), one text
// field whose label depends on the chosen option, the characters-left counter and Back/Next (RF-17 to RF-36,
// RF-96, RNF-4). It only paints the object from questionView() and reports user actions; every rule lives in js/lib/.
import { optionForKey } from "../../lib/question-view.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Check mark shown on the chosen option: the mark besides colour of RF-96. Decorative (aria-checked says it). */
function checkIcon() {
  const wrap = document.createElement("span");
  wrap.className = "option__check";
  wrap.setAttribute("aria-hidden", "true");
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("focusable", "false");
  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "12");
  circle.setAttribute("r", "11");
  circle.setAttribute("fill", "currentColor");
  const tick = document.createElementNS(SVG_NS, "path");
  tick.setAttribute("d", "M6.5 12.5l3.5 3.5 7.5-8");
  tick.setAttribute("fill", "none");
  tick.setAttribute("stroke", "#0b1026");
  tick.setAttribute("stroke-width", "2.6");
  tick.setAttribute("stroke-linecap", "round");
  tick.setAttribute("stroke-linejoin", "round");
  svg.append(circle, tick);
  wrap.append(svg);
  return wrap;
}

function optionButton({ letter, label }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "option";
  btn.setAttribute("role", "radio");
  btn.dataset.letter = letter;
  btn.setAttribute("aria-label", `${letter}: ${label}`); // explicit name: not every reader takes it from content

  const box = document.createElement("span");
  box.className = "option__letter";
  box.setAttribute("aria-hidden", "true");
  box.textContent = letter;

  const text = document.createElement("span");
  text.className = "option__label";
  text.textContent = label;

  btn.append(box, text, checkIcon());
  return btn;
}

/**
 * @param {HTMLElement} section the #screen-question section
 * @param {{ onSelect(letter: string): void, onText(value: string): void, onNext(): void, onBack(): void }} handlers
 * @returns {{ paint(view: object): void }}
 */
export function mountQuestion(section, { onSelect, onText, onNext, onBack }) {
  const count = section.querySelector(".question__count");
  const title = section.querySelector(".question__text");
  const group = section.querySelector(".options");
  const textBox = section.querySelector(".answer-text");
  const label = section.querySelector(".answer-text__label");
  const input = section.querySelector(".answer-text__input");
  const left = section.querySelector(".answer-text__left");
  const backBtn = section.querySelector("[data-action=back]");
  const nextBtn = section.querySelector("[data-action=next]");
  let shownId = null;
  let letters = [];
  let checked = null;

  group.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-letter]");
    if (btn) onSelect(btn.dataset.letter);
  });
  group.addEventListener("keydown", (e) => {
    const letter = optionForKey(letters, checked, e.key);
    if (!letter) return;
    e.preventDefault();
    onSelect(letter);
    group.querySelector(`[data-letter="${letter}"]`)?.focus();
  });
  input.addEventListener("input", () => onText(input.value));
  nextBtn.addEventListener("click", () => onNext());
  backBtn.addEventListener("click", () => onBack());

  function paint(view) {
    const newQuestion = view.questionId !== shownId;
    if (newQuestion) {
      shownId = view.questionId;
      count.textContent = view.countText;
      title.textContent = view.text;
      group.replaceChildren(...view.options.map(optionButton));
      letters = view.options.map((o) => o.letter);
    }
    checked = view.checkedLetter;

    // Roving tabindex: Tab reaches the chosen option (or the first one); arrows move inside (RNF-4).
    const buttons = group.querySelectorAll("button[data-letter]");
    buttons.forEach((btn, i) => {
      const on = btn.dataset.letter === view.checkedLetter;
      btn.setAttribute("aria-checked", String(on));
      btn.tabIndex = on || (view.checkedLetter === null && i === 0) ? 0 : -1;
    });

    textBox.hidden = view.field === null;
    if (view.field !== null) {
      label.textContent = view.fieldLabel;
      input.required = view.required;
      input.setAttribute("aria-required", String(view.required));
    }
    // Only rewrite the value when it differs (new question, or clamped to 280): keeps the caret and IME input.
    if (newQuestion || input.value !== view.fieldText) input.value = view.fieldText;
    left.textContent = view.remainingText;

    backBtn.hidden = !view.showBack;
    nextBtn.disabled = !view.canNext;
  }

  return { paint };
}
