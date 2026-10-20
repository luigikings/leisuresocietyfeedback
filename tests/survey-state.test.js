import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTENT } from "../js/content.js";
import { OTHER_CODE } from "../js/lib/sites.js";
import {
  initialState,
  start,
  chooseCountry,
  currentQuestion,
  selectOption,
  setText,
  fieldFor,
  canGoNext,
  next,
  back,
  systemBack,
  litSites,
  resumeState,
  settle,
  currentField,
} from "../js/lib/survey-state.js";

const C = CONTENT;
// Q1: normal/normal; Q2: A open-required, B normal; Q9: A normal, B open-optional
const atQ1 = () => chooseCountry(start(initialState()), "FR");

/** Answers questions from the current one up to `n` (exclusive) choosing A with text "t". */
function answerUntil(state, n) {
  let s = state;
  while (s.screen === "question" && s.current < n) {
    s = selectOption(s, C, "A");
    s = setText(s, C, "t");
    s = next(s, C).state;
  }
  return s;
}

test("initialState starts on the intro with no country and nothing answered (RF-5)", () => {
  const s = initialState();
  assert.equal(s.screen, "intro");
  assert.equal(s.country, null);
  assert.equal(s.current, 1);
  assert.deepEqual(s.answers, {});
  assert.deepEqual(s.drafts, {});
  assert.deepEqual(s.answered, []);
  assert.equal(s.status, "in_progress");
});

test("start goes from intro to country selection (RF-9)", () => {
  const s = start(initialState());
  assert.equal(s.screen, "country");
});

test("start does nothing outside the intro", () => {
  const q = atQ1();
  assert.equal(start(q), q);
});

test("chooseCountry stores the code and shows question 1 with all sites off (RF-15)", () => {
  const s = atQ1();
  assert.equal(s.country, "FR");
  assert.equal(s.screen, "question");
  assert.equal(s.current, 1);
  assert.deepEqual(litSites(s, C), []);
});

test("chooseCountry accepts the reserved Other code (RF-15)", () => {
  const s = chooseCountry(start(initialState()), OTHER_CODE);
  assert.equal(s.country, OTHER_CODE);
  assert.equal(s.screen, "question");
});

test("chooseCountry is ignored once a country is chosen (RF-16)", () => {
  const s = atQ1();
  const again = chooseCountry(s, "DE");
  assert.equal(again, s);
  assert.equal(again.country, "FR");
});

test("chooseCountry is ignored outside the country screen", () => {
  const intro = initialState();
  assert.equal(chooseCountry(intro, "FR"), intro);
});

test("functions do not mutate the input state", () => {
  const s = atQ1();
  const snapshot = JSON.stringify(s);
  const s2 = setText(selectOption(s, C, "A"), C, "hello");
  next(s2, C);
  back(s2);
  assert.equal(JSON.stringify(s), snapshot);
});

test("currentQuestion returns the content question being shown", () => {
  assert.equal(currentQuestion(atQ1(), C).id, "q1");
  assert.equal(currentQuestion(initialState(), C), null);
});

test("selectOption keeps a single choice per question (RF-19)", () => {
  let s = atQ1();
  s = selectOption(s, C, "A");
  assert.equal(s.drafts.q1.option, "A");
  s = selectOption(s, C, "B");
  assert.equal(s.drafts.q1.option, "B");
});

test("selectOption in Q3 (multiple choice) adds the second option instead of replacing it (RF-155)", () => {
  let s = answerUntil(atQ1(), 3);
  assert.equal(s.current, 3);
  s = selectOption(s, C, "A");
  s = selectOption(s, C, "C");
  assert.equal(s.drafts.q3.option, "AC");
});

test("selectOption ignores letters that the question does not have", () => {
  const s = atQ1();
  assert.equal(selectOption(s, C, "C"), s); // Q1 has only A and B
  assert.equal(selectOption(s, C, "Z"), s);
});

test("selectOption keeps the text already written when the option changes (RF-26)", () => {
  let s = answerUntil(atQ1(), 2);
  s = selectOption(s, C, "A"); // open-required
  s = setText(s, C, "the music");
  s = selectOption(s, C, "B"); // normal → "Want to tell us why?"
  assert.equal(s.drafts.q2.text, "the music");
  assert.equal(fieldFor(currentOption(s)), "why");
});

test("setText clamps to 280 code points (RF-24, RF-25)", () => {
  let s = selectOption(atQ1(), C, "A");
  s = setText(s, C, "😀".repeat(300));
  assert.equal([...s.drafts.q1.text].length, 280);
});

test("setText before choosing an option keeps the text for later", () => {
  let s = setText(atQ1(), C, "early");
  assert.equal(s.drafts.q1.text, "early");
  assert.equal(s.drafts.q1.option, null);
  s = selectOption(s, C, "A");
  assert.equal(s.drafts.q1.text, "early");
});

function currentOption(s) {
  const q = currentQuestion(s, C);
  const d = s.drafts[q.id];
  return d && d.option ? q.options.find((o) => o.letter === d.option) : null;
}

test("fieldFor maps option types to the visible text field (RF-20, RF-21, RF-22)", () => {
  assert.equal(fieldFor(null), null);
  assert.equal(fieldFor(undefined), null);
  assert.equal(fieldFor({ letter: "A", type: "normal" }), "why");
  assert.equal(fieldFor({ letter: "A", type: "open-required" }), "required");
  assert.equal(fieldFor({ letter: "A", type: "open-optional" }), "optional");
});

test("canGoNext is false without a chosen option (RF-23)", () => {
  assert.equal(canGoNext(atQ1(), C), false);
  assert.equal(canGoNext(setText(atQ1(), C, "text but no option"), C), false);
});

test("canGoNext is true with a normal option and no text", () => {
  assert.equal(canGoNext(selectOption(atQ1(), C, "B"), C), true);
});

test("canGoNext with open-required needs text of length > 0 (RF-23)", () => {
  let s = answerUntil(atQ1(), 2);
  s = selectOption(s, C, "A");
  assert.equal(canGoNext(s, C), false);
  assert.equal(canGoNext(setText(s, C, "   \n\t "), C), false);
  assert.equal(canGoNext(setText(s, C, " x "), C), true);
});

test("canGoNext with open-optional does not need text (RF-22)", () => {
  let s = answerUntil(atQ1(), 9);
  assert.equal(s.current, 9);
  s = selectOption(s, C, "B");
  assert.equal(fieldFor(currentOption(s)), "optional");
  assert.equal(canGoNext(s, C), true);
});

test("canGoNext is false outside the question screen", () => {
  assert.equal(canGoNext(initialState(), C), false);
});

test("next without a valid answer does nothing and does not commit (RF-23)", () => {
  const s = atQ1();
  const r = next(s, C);
  assert.equal(r.state, s);
  assert.equal(r.commit, false);
});

test("next commits the normalized answer, marks it answered, lights its site and advances (RF-27, RF-28)", () => {
  let s = selectOption(atQ1(), C, "A");
  s = setText(s, C, "  felt free  ");
  const r = next(s, C);
  assert.equal(r.commit, true);
  assert.deepEqual(r.state.answers.q1, { option: "A", text: "felt free" });
  assert.deepEqual(r.state.answered, ["q1"]);
  assert.equal(r.state.current, 2);
  assert.equal(r.state.screen, "question");
  assert.deepEqual(litSites(r.state, C), ["park"]);
});

test("next stores whitespace-only text as null (RF-28)", () => {
  let s = setText(selectOption(atQ1(), C, "A"), C, "    ");
  assert.deepEqual(next(s, C).state.answers.q1, { option: "A", text: null });
});

test("choosing an option without Next does not mark the question answered", () => {
  const s = selectOption(atQ1(), C, "A");
  assert.deepEqual(s.answered, []);
  assert.deepEqual(s.answers, {});
  assert.deepEqual(litSites(s, C), []);
});

test("back keeps drafts and shows n-1 with its option and text (RF-30, RF-31)", () => {
  let s = setText(selectOption(atQ1(), C, "A"), C, "one");
  s = next(s, C).state; // Q2
  s = setText(selectOption(s, C, "B"), C, "draft two");
  s = back(s);
  assert.equal(s.current, 1);
  assert.deepEqual(s.drafts.q1, { option: "A", text: "one" });
  assert.deepEqual(s.drafts.q2, { option: "B", text: "draft two" });
  assert.deepEqual(s.answered, ["q1"]); // q2 not answered
  assert.equal(s.answers.q2, undefined);
  s = next(s, C).state; // back to Q2
  assert.equal(s.current, 2);
  assert.deepEqual(s.drafts.q2, { option: "B", text: "draft two" });
});

test("back on question 1 does nothing (RF-18)", () => {
  const s = atQ1();
  assert.equal(back(s), s);
});

test("back does nothing outside the question screen", () => {
  const intro = initialState();
  assert.equal(back(intro), intro);
});

test("systemBack on questions 2-10 behaves like Back (RF-33)", () => {
  for (const n of [2, 5, 10]) {
    const s = answerUntil(atQ1(), n);
    assert.equal(s.current, n);
    assert.deepEqual(systemBack(s), back(s));
    assert.equal(systemBack(s).current, n - 1);
  }
});

test("systemBack on intro, country, Q1 and final keeps the same state (RF-34)", () => {
  const intro = initialState();
  const country = start(intro);
  const q1 = selectOption(atQ1(), C, "A");
  const fin = answerUntil(atQ1(), 11);
  assert.equal(fin.screen, "final");
  for (const s of [intro, country, q1, fin]) assert.equal(systemBack(s), s);
});

test("changing an answer and pressing Next replaces it and the site stays lit (RF-32)", () => {
  let s = answerUntil(atQ1(), 3); // q1, q2 answered with A/"t"
  s = back(back(s)); // Q1
  s = setText(selectOption(s, C, "B"), C, "changed");
  const r = next(s, C);
  assert.equal(r.commit, true);
  assert.deepEqual(r.state.answers.q1, { option: "B", text: "changed" });
  assert.deepEqual(r.state.answered, ["q1", "q2"]);
  assert.deepEqual(litSites(r.state, C), ["park", "concert-hall"]);
  assert.equal(r.state.current, 2);
});

test("Next on Q10 completes the survey and shows the final screen (RF-36)", () => {
  const s = answerUntil(atQ1(), 10);
  assert.equal(s.current, 10);
  const r = next(setText(selectOption(s, C, "A"), C, "last"), C);
  assert.equal(r.commit, true);
  assert.equal(r.state.status, "completed");
  assert.equal(r.state.screen, "final");
  assert.equal(r.state.answered.length, 10);
  assert.deepEqual(r.state.answers.q10, { option: "A", text: "last" });
});

test("a completed survey accepts no changes", () => {
  const fin = answerUntil(atQ1(), 11);
  assert.equal(selectOption(fin, C, "B"), fin);
  assert.equal(setText(fin, C, "x"), fin);
  assert.deepEqual(next(fin, C), { state: fin, commit: false });
  assert.equal(back(fin), fin);
  assert.equal(chooseCountry(fin, "DE"), fin);
  assert.equal(start(fin), fin);
});

test("litSites returns exactly the sites of answered questions, in question order (RF-29)", () => {
  let s = answerUntil(atQ1(), 4);
  assert.deepEqual(litSites(s, C), ["park", "concert-hall", "museum"]);
  s = back(s); // drafts in Q3 don't change anything
  assert.deepEqual(litSites(s, C), ["park", "concert-hall", "museum"]);
  const fin = answerUntil(atQ1(), 11);
  assert.deepEqual(litSites(fin, C), C.questions.map((q) => q.site));
});

test("resumeState without a country starts on the intro (RF-5)", () => {
  assert.deepEqual(resumeState(null, C), initialState());
  assert.deepEqual(resumeState(start(initialState()), C), initialState());
});

test("resumeState mid-survey goes to the first unanswered question with sites lit (RF-51)", () => {
  let s = answerUntil(atQ1(), 4); // q1-q3 answered
  s = setText(selectOption(s, C, "B"), C, "draft four"); // Q4 draft
  s = back(back(s)); // user is on Q2 when reloading
  const r = resumeState(s, C);
  assert.equal(r.screen, "question");
  assert.equal(r.current, 4);
  assert.equal(r.country, "FR");
  assert.deepEqual(litSites(r, C), ["park", "concert-hall", "museum"]);
  assert.deepEqual(r.drafts.q4, { option: "B", text: "draft four" });
});

test("resumeState restores drafts from answers when the draft is missing", () => {
  const saved = {
    ...initialState(),
    screen: "question",
    country: "JP",
    current: 2,
    answers: { q1: { option: "B", text: null } },
    drafts: {},
    answered: ["q1"],
  };
  const r = resumeState(saved, C);
  assert.equal(r.current, 2);
  assert.deepEqual(r.drafts.q1, { option: "B", text: "" });
  assert.equal(back(r).current, 1);
  assert.deepEqual(back(r).drafts.q1, { option: "B", text: "" });
});

test("resumeState for a completed survey shows the final screen (RF-56)", () => {
  const fin = answerUntil(atQ1(), 11);
  const r = resumeState({ ...fin, screen: "question", current: 3 }, C);
  assert.equal(r.screen, "final");
  assert.equal(r.status, "completed");
  assert.equal(litSites(r, C).length, 10);
});

test("resumeState ignores unknown ids in answered", () => {
  const saved = {
    ...atQ1(),
    answers: { q1: { option: "A", text: null } },
    answered: ["q1", "q99", "q1"],
  };
  const r = resumeState(saved, C);
  assert.deepEqual(r.answered, ["q1"]);
  assert.equal(r.current, 2);
});

// ---- Q3, multiple choice (change 2026-10-19): RF-154 to RF-163, RF-169 ----
const atQ3 = () => answerUntil(atQ1(), 3); // q1, q2 answered; Q3 shown
const toggle = (s, ...letters) => letters.reduce((acc, l) => selectOption(acc, C, l), s);
const toQ4 = (s) => next(s, C).state;

test("Q3: marking 1, 2 and 3 options and unmarking them, without touching the others (RF-155)", () => {
  let s = atQ3();
  s = toggle(s, "A");
  assert.equal(s.drafts.q3.option, "A");
  s = toggle(s, "B");
  assert.equal(s.drafts.q3.option, "AB");
  s = toggle(s, "C");
  assert.equal(s.drafts.q3.option, "ABC");
  s = toggle(s, "B");
  assert.equal(s.drafts.q3.option, "AC");
  s = toggle(s, "A", "C");
  assert.equal(s.drafts.q3.option, null);
  assert.deepEqual(s.drafts.q1, { option: "A", text: "t" }, "other drafts unchanged");
  assert.deepEqual(s.drafts.q2, { option: "A", text: "t" });
});

test("Q3: options are kept in A, B, C order without repeats, whatever the tap order (RF-161)", () => {
  assert.equal(toggle(atQ3(), "C", "A").drafts.q3.option, "AC");
  assert.equal(toggle(atQ3(), "B", "A").drafts.q3.option, "AB");
  assert.equal(toggle(atQ3(), "C", "B", "A").drafts.q3.option, "ABC");
});

test("Q3: a letter the question does not have is ignored", () => {
  const s = toggle(atQ3(), "A");
  assert.equal(selectOption(s, C, "D"), s);
});

test("Q1 stays single answer next to the multiple-choice Q3 (RF-19, RF-154)", () => {
  const s = toggle(atQ1(), "A", "B");
  assert.equal(s.drafts.q1.option, "B");
});

test("Q3: Next is enabled with 1, 2 or 3 marked options and disabled with 0 (RF-23)", () => {
  const s = atQ3();
  assert.equal(canGoNext(s, C), false);
  assert.equal(canGoNext(toggle(s, "B"), C), true);
  assert.equal(canGoNext(toggle(s, "A", "C"), C), true);
  assert.equal(canGoNext(toggle(s, "A", "B", "C"), C), true);
  assert.equal(canGoNext(toggle(s, "A", "A"), C), false);
  assert.equal(next(toggle(s, "A", "A"), C).commit, false);
});

test("Q3: a single 'why' field with 1+ marked; hidden with 0 and its text kept (RF-158, RF-159, RF-26)", () => {
  let s = atQ3();
  assert.equal(currentField(s, C), null);
  s = setText(toggle(s, "A", "C"), C, "both");
  assert.equal(currentField(s, C), "why");
  s = toggle(s, "A", "C");
  assert.equal(currentField(s, C), null);
  assert.equal(s.drafts.q3.text, "both");
  s = toggle(s, "B");
  assert.equal(currentField(s, C), "why");
  assert.equal(s.drafts.q3.text, "both");
});

test("currentField matches fieldFor in single-answer questions (RF-20 to RF-22)", () => {
  assert.equal(currentField(atQ1(), C), null);
  assert.equal(currentField(selectOption(atQ1(), C, "A"), C), "why");
  const q2 = answerUntil(atQ1(), 2);
  assert.equal(currentField(selectOption(q2, C, "A"), C), "required");
  const q9 = answerUntil(atQ1(), 9);
  assert.equal(currentField(selectOption(q9, C, "B"), C), "optional");
  assert.equal(currentField(initialState(), C), null);
});

test("Q3: Next stores 'AC' with the single text and lights only the museum (RF-160, RF-29)", () => {
  const r = next(setText(toggle(atQ3(), "C", "A"), C, " why not "), C);
  assert.equal(r.commit, true);
  assert.deepEqual(r.state.answers.q3, { option: "AC", text: "why not" });
  assert.ok(r.state.answered.includes("q3"));
  assert.equal(r.state.current, 4);
  assert.deepEqual(litSites(r.state, C), ["park", "concert-hall", "museum"]);
});

test("Q3: Next with 3 options still lights exactly one site (RF-160)", () => {
  const s = toQ4(toggle(atQ3(), "A", "B", "C"));
  assert.equal(s.answers.q3.option, "ABC");
  assert.equal(litSites(s, C).filter((x) => x === "museum").length, 1);
  assert.equal(litSites(s, C).length, 3);
});

test("Q3: Next stores the letters in A, B, C order even from an unordered draft (RF-161)", () => {
  const s = atQ3();
  const messy = { ...s, drafts: { ...s.drafts, q3: { option: "CA", text: "" } } };
  assert.equal(next(messy, C).state.answers.q3.option, "AC");
});

test("Q3: changing 'ABC' to 'B' replaces the set and the text; the site stays lit (RF-163, RF-32)", () => {
  let s = toQ4(setText(toggle(atQ3(), "A", "B", "C"), C, "all"));
  s = back(s, C);
  assert.equal(s.current, 3);
  s = setText(toggle(s, "A", "C"), C, "only B");
  s = toQ4(s);
  assert.deepEqual(s.answers.q3, { option: "B", text: "only B" });
  assert.deepEqual(s.answered, ["q1", "q2", "q3"]);
  assert.deepEqual(litSites(s, C), ["park", "concert-hall", "museum"]);
});

test("Q3: Back and Next keep the marked options and the text of the draft (RF-162, RF-31)", () => {
  let s = setText(toggle(atQ3(), "B", "C"), C, "draft");
  s = back(s, C);
  assert.equal(s.current, 2);
  s = next(s, C).state;
  assert.equal(s.current, 3);
  assert.deepEqual(s.drafts.q3, { option: "BC", text: "draft" });
  assert.equal(s.answered.includes("q3"), false);
});

// RF-169: an answered Q3 with everything unmarked goes back to what was saved when leaving it.
function answeredQ3ThenUnmarked() {
  let s = toQ4(setText(toggle(atQ3(), "A", "C"), C, "saved text")); // Q3 answered "AC"
  s = back(s, C); // on Q3 again
  s = setText(toggle(s, "A", "C"), C, "edited"); // all unmarked, text edited
  assert.equal(s.drafts.q3.option, null);
  return s;
}

test("RF-169: answered Q3, all unmarked, Back -> the draft goes back to 'AC' with its text", () => {
  const s = back(answeredQ3ThenUnmarked(), C);
  assert.equal(s.current, 2);
  assert.deepEqual(s.drafts.q3, { option: "AC", text: "saved text" });
  assert.deepEqual(s.answers.q3, { option: "AC", text: "saved text" });
  assert.ok(s.answered.includes("q3"));
  assert.ok(litSites(s, C).includes("museum"));
});

test("RF-169: the same with the system back", () => {
  const s = systemBack(answeredQ3ThenUnmarked(), C);
  assert.equal(s.current, 2);
  assert.deepEqual(s.drafts.q3, { option: "AC", text: "saved text" });
});

test("RF-169: the same when reloading in that state (resumeState)", () => {
  const r = resumeState(answeredQ3ThenUnmarked(), C);
  assert.equal(r.screen, "question");
  assert.equal(r.current, 4, "first unanswered question");
  assert.deepEqual(r.drafts.q3, { option: "AC", text: "saved text" });
  assert.equal(back(r, C).current, 3);
  assert.deepEqual(back(r, C).drafts.q3, { option: "AC", text: "saved text" });
});

test("RF-169: a saved text of null comes back as an empty draft text", () => {
  let s = toQ4(toggle(atQ3(), "B")); // answered "B" without text -> text null
  assert.equal(s.answers.q3.text, null);
  s = toggle(back(s, C), "B");
  s = back(s, C);
  assert.deepEqual(s.drafts.q3, { option: "B", text: "" });
});

test("RF-169 / RF-31: unanswered Q3, all unmarked, Back -> the empty draft and its text are kept", () => {
  let s = setText(toggle(atQ3(), "A", "A"), C, "still thinking");
  s = back(s, C);
  assert.equal(s.current, 2);
  assert.deepEqual(s.drafts.q3, { option: null, text: "still thinking" });
  assert.equal(s.answered.includes("q3"), false);
  assert.equal(s.answers.q3, undefined);
  assert.equal(litSites(s, C).includes("museum"), false);
});

test("settle: no change for single-answer questions, unanswered Q3 or Q3 with options marked", () => {
  const q3 = atQ3();
  assert.equal(settle(q3, "q3", C), q3, "unanswered");
  assert.equal(settle(q3, "q1", C), q3, "single answer");
  let s = toQ4(toggle(q3, "A"));
  s = toggle(back(s, C), "B"); // "AB", answered "A"
  assert.equal(settle(s, "q3", C), s, "options marked: the draft stays");
  assert.equal(settle(s, "q99", C), s, "unknown question");
});

test("settle does not mutate its input", () => {
  const s = answeredQ3ThenUnmarked();
  const before = JSON.stringify(s);
  settle(s, "q3", C);
  back(s, C);
  resumeState(s, C);
  assert.equal(JSON.stringify(s), before);
});

test("back and systemBack without content behave as before (no settle)", () => {
  const s = answeredQ3ThenUnmarked();
  assert.equal(back(s).current, 2);
  assert.deepEqual(back(s).drafts.q3, { option: null, text: "edited" });
  assert.deepEqual(systemBack(s), back(s));
});

test("back with content on question 1 and outside the questions still does nothing (RF-18, RF-34)", () => {
  const q1 = atQ1();
  assert.equal(back(q1, C), q1);
  const intro = initialState();
  assert.equal(systemBack(intro, C), intro);
});
