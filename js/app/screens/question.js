// Question screen: options A/B/C as a radio group of gold hexagons with no visible letter (check icon when chosen),
// one text field whose label depends on the chosen option, the characters-left counter and Back/Next (RF-17 to
// RF-36, RF-93, RF-96, RNF-4). The letter stays in data-letter only (RF-17). It only paints the object from questionView() and reports user actions; every rule lives in js/lib/.
// Multiple choice (Q3, RF-155 to RF-159, RNF-4, plan §17.3): a group of checkboxes described once by the
// "Choose one or more" hint, a square box instead of the round check, every option in the Tab order and no arrow keys.
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
  tick.setAttribute("class", "option__tick"); // stroke colour in CSS: gold on the dark disc
  tick.setAttribute("d", "M6.5 12.5l3.5 3.5 7.5-8");
  tick.setAttribute("fill", "none");
  tick.setAttribute("stroke", "currentColor");
  tick.setAttribute("stroke-width", "2.6");
  tick.setAttribute("stroke-linecap", "round");
  tick.setAttribute("stroke-linejoin", "round");
  svg.append(circle, tick);
  wrap.append(svg);
  return wrap;
}

/** Square box of a multiple-choice option (RF-157): empty when unchecked, filled with a tick when checked (CSS). */
function boxIcon() {
  const box = document.createElement("span");
  box.className = "option__box";
  box.setAttribute("aria-hidden", "true");
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("focusable", "false");
  const tick = document.createElementNS(SVG_NS, "path");
  tick.setAttribute("class", "option__box-tick"); // stroke and visibility in CSS
  tick.setAttribute("d", "M3.5 8.5l3 3 6-7");
  tick.setAttribute("fill", "none");
  tick.setAttribute("stroke", "currentColor");
  tick.setAttribute("stroke-width", "2.4");
  tick.setAttribute("stroke-linecap", "round");
  tick.setAttribute("stroke-linejoin", "round");
  svg.append(tick);
  box.append(svg);
  return box;
}

/**
 * .option (the unclipped button, so its focus outline shows whole) > .option__shape (the gold hexagon, the border)
 * > .option__in (the inner night hexagon) with the label and the check (RF-93, RF-144, plan §16.3).
 */
function optionButton({ letter, label }, multiple) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "option";
  btn.setAttribute("role", multiple ? "checkbox" : "radio");
  btn.dataset.letter = letter;
  btn.setAttribute("aria-label", label); // explicit name: not every reader takes it from content; no letter (RF-17)

  const shape = document.createElement("span");
  shape.className = "option__shape";
  const inner = document.createElement("span");
  inner.className = "option__in";

  const text = document.createElement("span");
  text.className = "option__label";
  text.textContent = label;

  inner.append(text, multiple ? boxIcon() : checkIcon());
  shape.append(inner);
  btn.append(shape);
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
  const hint = section.querySelector(".question__hint");
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
  let multiple = false;

  group.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-letter]");
    if (btn) onSelect(btn.dataset.letter);
  });
  group.addEventListener("keydown", (e) => {
    if (multiple) return; // checkboxes: Tab moves, Space/Enter toggle through the native button click (RNF-4)
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
      multiple = view.multiple;
      hint.textContent = view.hint ?? "";
      hint.hidden = !view.hint;
      if (multiple) {
        group.setAttribute("role", "group");
        group.setAttribute("aria-describedby", "question-hint");
      } else {
        group.setAttribute("role", "radiogroup");
        group.removeAttribute("aria-describedby");
      }
      group.replaceChildren(...view.options.map((o) => optionButton(o, multiple)));
      letters = view.options.map((o) => o.letter);
    }
    checked = view.checkedLetter;

    // Only aria-checked and tabIndex change: the buttons are not rebuilt, so focus stays on the option (RNF-4).
    // Single answer: roving tabindex, Tab reaches the chosen option (or the first one) and arrows move inside.
    // Multiple choice: every option is a Tab stop.
    const buttons = group.querySelectorAll("button[data-letter]");
    buttons.forEach((btn, i) => {
      const on = view.options[i]?.checked === true;
      btn.setAttribute("aria-checked", String(on));
      btn.tabIndex = multiple || on || (view.checkedLetter === null && i === 0) ? 0 : -1;
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
