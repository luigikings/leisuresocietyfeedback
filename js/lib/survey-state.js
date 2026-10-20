// Survey state machine. Pure module: no DOM, no network, no clock, no storage.
// Every function returns a NEW state (or the same object when nothing changes) and never mutates its input.
// RF-5, RF-9, RF-15 to RF-36, RF-51, RF-56; multiple-choice Q3: RF-154 to RF-163, RF-169.
import { clampText, textLength, normalizeForStore } from "./text.js";
import { isMultiple, lettersOf, toggleLetter } from "./choice.js";

/**
 * State shape:
 * { screen: "intro"|"country"|"question"|"final",
 *   current: 1..10,                       // question being shown
 *   country: string|null,
 *   answers: { [qid]: {option, text} },   // confirmed with Next (sent to the database);
 *                                         // option is one letter, or "A".."ABC" in a multiple-choice question
 *   drafts:  { [qid]: {option, text} },   // choice in progress per question (local only)
 *   answered: [qid, ...],                 // questions confirmed with Next
 *   status: "in_progress"|"completed" }
 */
export function initialState() {
  return {
    screen: "intro",
    current: 1,
    country: null,
    answers: {},
    drafts: {},
    answered: [],
    status: "in_progress",
  };
}

const isCompleted = (state) => state.status === "completed";
const onQuestion = (state) => state.screen === "question" && !isCompleted(state);

/** Intro → country selection (RF-9). */
export function start(state) {
  if (state.screen !== "intro" || isCompleted(state)) return state;
  return { ...state, screen: "country" };
}

/** Stores the country (or OTHER) and shows question 1. The country never changes once set (RF-15, RF-16). */
export function chooseCountry(state, code) {
  if (state.screen !== "country" || state.country != null || isCompleted(state)) return state;
  if (typeof code !== "string" || code.length === 0) return state;
  return { ...state, country: code, screen: "question", current: 1 };
}

/** The content question being shown, or null outside the question screen. */
export function currentQuestion(state, content) {
  if (state.screen !== "question") return null;
  return content.questions[state.current - 1] ?? null;
}

function draftOf(state, qid) {
  return state.drafts[qid] ?? { option: null, text: "" };
}

function withDraft(state, qid, patch) {
  const draft = { ...draftOf(state, qid), ...patch };
  return { ...state, drafts: { ...state.drafts, [qid]: draft } };
}

function chosenOption(state, question) {
  const { option } = draftOf(state, question.id);
  return option ? question.options.find((o) => o.letter === option) ?? null : null;
}

const lettersOfQuestion = (question) => question.options.map((o) => o.letter);

/** Marked letters of a multiple-choice question, in A, B, C order and only those the question has (RF-161). */
function markedLetters(state, question) {
  const marked = lettersOf(draftOf(state, question.id).option);
  return lettersOfQuestion(question).filter((l) => marked.includes(l));
}

/**
 * Taps one option of the current question; keeps the text already written (RF-26).
 * Single answer: it replaces the choice (RF-19). Multiple choice: it marks or unmarks only that option (RF-155).
 */
export function selectOption(state, content, letter) {
  if (!onQuestion(state)) return state;
  const q = currentQuestion(state, content);
  if (!q || !q.options.some((o) => o.letter === letter)) return state;
  if (isMultiple(q)) {
    return withDraft(state, q.id, { option: toggleLetter(draftOf(state, q.id).option, letter, lettersOfQuestion(q)) });
  }
  return withDraft(state, q.id, { option: letter });
}

/** Updates the single text of the current question, clamped to 280 code points (RF-24, RF-25). */
export function setText(state, content, value) {
  if (!onQuestion(state)) return state;
  const q = currentQuestion(state, content);
  if (!q) return state;
  return withDraft(state, q.id, { text: clampText(value ?? "") });
}

/**
 * Text field visible for the chosen option (RF-20 to RF-22):
 * "why" (optional "Want to tell us why?"), "required", "optional", or null without an option.
 */
export function fieldFor(option) {
  if (!option) return null;
  if (option.type === "open-required") return "required";
  if (option.type === "open-optional") return "optional";
  return "why";
}

/**
 * Text field visible in the current question (RF-20 to RF-22): fieldFor() of the chosen option, or in a
 * multiple-choice question one "why" field while at least one option is marked (RF-158, RF-159).
 */
export function currentField(state, content) {
  const q = currentQuestion(state, content);
  if (!q) return null;
  if (isMultiple(q)) return markedLetters(state, q).length > 0 ? "why" : null;
  return fieldFor(chosenOption(state, q));
}

/**
 * Next is enabled only with a chosen option and, for open-required, text of length > 0 (RF-23).
 * Multiple choice: with at least one marked option.
 */
export function canGoNext(state, content) {
  if (!onQuestion(state)) return false;
  const q = currentQuestion(state, content);
  if (!q) return false;
  if (isMultiple(q)) return markedLetters(state, q).length > 0;
  const option = chosenOption(state, q);
  if (!option) return false;
  if (fieldFor(option) === "required") return textLength(draftOf(state, q.id).text) > 0;
  return true;
}

/**
 * Confirms the current answer (RF-27, RF-28, RF-32, RF-36).
 * @returns {{state: object, commit: boolean}} commit=true means "save the full state now".
 */
export function next(state, content) {
  if (!canGoNext(state, content)) return { state, commit: false };
  const q = currentQuestion(state, content);
  const draft = draftOf(state, q.id);
  const option = isMultiple(q) ? markedLetters(state, q).join("") : draft.option; // "AC", in order (RF-161)
  const answers = { ...state.answers, [q.id]: { option, text: normalizeForStore(draft.text) } };
  const answered = state.answered.includes(q.id) ? state.answered : [...state.answered, q.id];
  const last = state.current >= content.questions.length;
  const nextState = last
    ? { ...state, answers, answered, status: "completed", screen: "final" }
    : { ...state, answers, answered, current: state.current + 1 };
  return { state: nextState, commit: true };
}

/**
 * RF-169: an answered multiple-choice question left with no option marked gets back its saved draft
 * (options and text of the last Next). Any other question, or one that is not answered, stays as it is
 * (an empty draft is kept, RF-31).
 */
export function settle(state, qid, content) {
  const q = content.questions.find((x) => x.id === qid);
  if (!q || !isMultiple(q) || !state.answered.includes(qid) || !state.answers[qid]) return state;
  if (markedLetters(state, q).length > 0) return state;
  const saved = state.answers[qid];
  return { ...state, drafts: { ...state.drafts, [qid]: { option: saved.option, text: saved.text ?? "" } } };
}

/**
 * Back button: question n → n-1 keeping all drafts; nothing on question 1 (RF-18, RF-30, RF-31).
 * With `content`, the question left is settled first (RF-169); without it, it behaves as before.
 */
export function back(state, content) {
  if (!onQuestion(state) || state.current <= 1) return state;
  const q = content ? content.questions[state.current - 1] : null;
  const settled = q ? settle(state, q.id, content) : state;
  return { ...settled, current: state.current - 1 };
}

/** Browser/system back: like Back on questions 2-10; same state everywhere else (RF-33, RF-34, RF-169). */
export function systemBack(state, content) {
  return back(state, content);
}

/** Sites of the answered questions, in question order (RF-29). */
export function litSites(state, content) {
  return content.questions.filter((q) => state.answered.includes(q.id)).map((q) => q.site);
}

/**
 * State to show when the survey is reopened (RF-5, RF-51, RF-56).
 * - no country → intro
 * - completed → final screen (last state, no animation: the UI decides that)
 * - otherwise → first unanswered question, drafts restored from answers where missing
 */
export function resumeState(saved, content) {
  if (!saved || typeof saved !== "object" || typeof saved.country !== "string" || !saved.country) {
    return initialState();
  }
  const ids = content.questions.map((q) => q.id);
  const answers = saved.answers && typeof saved.answers === "object" ? saved.answers : {};
  const savedAnswered = Array.isArray(saved.answered) ? saved.answered : [];
  const answered = ids.filter((id) => savedAnswered.includes(id) && answers[id]);

  const drafts = { ...(saved.drafts && typeof saved.drafts === "object" ? saved.drafts : {}) };
  for (const id of answered) {
    if (!drafts[id]) drafts[id] = { option: answers[id].option, text: answers[id].text ?? "" };
  }

  // Reloading with an answered multiple-choice question left with nothing marked: back to what was saved (RF-169).
  const base = content.questions.reduce(
    (acc, q) => settle(acc, q.id, content),
    { ...initialState(), country: saved.country, answers, drafts, answered },
  );
  if (saved.status === "completed") {
    return { ...base, status: "completed", screen: "final", current: ids.length };
  }
  const firstOpen = ids.findIndex((id) => !answered.includes(id));
  const current = firstOpen === -1 ? ids.length : firstOpen + 1;
  return { ...base, screen: "question", current };
}
