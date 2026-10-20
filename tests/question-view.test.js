import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTENT } from "../js/content.js";
import { initialState, start, chooseCountry, selectOption, setText, next, back } from "../js/lib/survey-state.js";
import { questionView, FIELD_LABELS, optionForKey } from "../js/lib/question-view.js";

const C = CONTENT;
const atQ1 = () => chooseCountry(start(initialState()), "FR");

function goTo(n) {
  let s = atQ1();
  while (s.current < n) {
    s = selectOption(s, C, "B"); // B is "normal" in Q1-Q8: always valid without text
    s = next(s, C).state;
  }
  return s;
}

test("questionView is null outside the question screen", () => {
  assert.equal(questionView(initialState(), C), null);
  assert.equal(questionView(start(initialState()), C), null);
});

test("questionView shows 'Question n of 10', the statement and the options A/B(/C) (RF-17)", () => {
  const v = questionView(atQ1(), C);
  assert.equal(v.countText, "Question 1 of 10");
  assert.equal(v.number, 1);
  assert.equal(v.total, 10);
  assert.equal(v.questionId, "q1");
  assert.equal(v.text, C.questions[0].text);
  assert.deepEqual(
    v.options.map((o) => [o.letter, o.label, o.checked]),
    [
      ["A", C.questions[0].options[0].label, false],
      ["B", C.questions[0].options[1].label, false],
    ],
  );
  const q3 = questionView(goTo(3), C);
  assert.deepEqual(q3.options.map((o) => o.letter), ["A", "B", "C"]);
});

test("Back is hidden on question 1 and shown from question 2 (RF-17, RF-18)", () => {
  assert.equal(questionView(atQ1(), C).showBack, false);
  assert.equal(questionView(goTo(2), C).showBack, true);
  assert.equal(questionView(goTo(10), C).showBack, true);
});

test("without an option there is no text field and Next is disabled (RF-20 to RF-23)", () => {
  const v = questionView(atQ1(), C);
  assert.equal(v.field, null);
  assert.equal(v.fieldLabel, null);
  assert.equal(v.canNext, false);
});

test("exactly one option is checked in a single-answer question (RF-19)", () => {
  let s = selectOption(atQ1(), C, "A");
  s = selectOption(s, C, "B");
  const v = questionView(s, C);
  assert.deepEqual(v.options.map((o) => o.checked), [false, true]);
  assert.equal(v.checkedLetter, "B");
});

test("a normal option shows the optional 'Want to tell us why?' field (RF-20)", () => {
  const v = questionView(selectOption(atQ1(), C, "A"), C);
  assert.equal(v.field, "why");
  assert.equal(v.fieldLabel, FIELD_LABELS.why);
  assert.match(v.fieldLabel, /^Want to tell us why\?/);
  assert.equal(v.required, false);
  assert.equal(v.canNext, true);
});

test("an open-required option shows its own required field, not 'why' (RF-21, RF-23)", () => {
  const v = questionView(selectOption(goTo(2), C, "A"), C);
  assert.equal(v.field, "required");
  assert.equal(v.fieldLabel, FIELD_LABELS.required);
  assert.doesNotMatch(v.fieldLabel, /why/i);
  assert.match(v.fieldLabel, /required/i);
  assert.equal(v.required, true);
  assert.equal(v.canNext, false, "empty required text keeps Next disabled");
  const spaces = questionView(setText(selectOption(goTo(5), C, "A"), C, "   \n "), C);
  assert.equal(spaces.canNext, false, "only spaces keeps Next disabled (Q5-A)");
  const filled = questionView(setText(selectOption(goTo(2), C, "A"), C, "music"), C);
  assert.equal(filled.canNext, true);
});

test("an open-optional option shows its own optional field, not 'why' (RF-22)", () => {
  const v = questionView(selectOption(goTo(9), C, "B"), C);
  assert.equal(v.field, "optional");
  assert.equal(v.fieldLabel, FIELD_LABELS.optional);
  assert.doesNotMatch(v.fieldLabel, /why/i);
  assert.match(v.fieldLabel, /optional/i);
  assert.equal(v.required, false);
  assert.equal(v.canNext, true);
});

test("the counter shows the characters left and reaches 0 when more than 280 are pasted (RF-24, RF-25)", () => {
  let s = selectOption(atQ1(), C, "A");
  assert.equal(questionView(s, C).remaining, 280);
  s = setText(s, C, "hello");
  assert.equal(questionView(s, C).remaining, 275);
  assert.equal(questionView(s, C).remainingText, "275 characters left");
  s = setText(s, C, "😀".repeat(300));
  const v = questionView(s, C);
  assert.equal(v.remaining, 0);
  assert.equal([...v.fieldText].length, 280);
  assert.equal(v.remainingText, "0 characters left");
  assert.equal(questionView(setText(s, C, "x".repeat(279)), C).remainingText, "1 character left");
});

test("changing option keeps the written text and moves it to the new field (RF-26)", () => {
  let s = selectOption(goTo(2), C, "A");
  s = setText(s, C, "the band");
  s = selectOption(s, C, "B");
  const v = questionView(s, C);
  assert.equal(v.field, "why");
  assert.equal(v.fieldText, "the band");
});

test("Back shows the previous question with its option and text (RF-30, RF-31)", () => {
  let s = setText(selectOption(atQ1(), C, "A"), C, "sunset");
  s = next(s, C).state;
  s = setText(selectOption(s, C, "A"), C, "draft only");
  s = back(s);
  const v1 = questionView(s, C);
  assert.equal(v1.number, 1);
  assert.equal(v1.checkedLetter, "A");
  assert.equal(v1.fieldText, "sunset");
  const v2 = questionView(next(s, C).state, C);
  assert.equal(v2.checkedLetter, "A");
  assert.equal(v2.fieldText, "draft only");
});

test("optionForKey moves through the radio group with the arrow keys, wrapping around (RNF-4)", () => {
  const letters = ["A", "B", "C"];
  assert.equal(optionForKey(letters, "A", "ArrowDown"), "B");
  assert.equal(optionForKey(letters, "B", "ArrowRight"), "C");
  assert.equal(optionForKey(letters, "C", "ArrowDown"), "A");
  assert.equal(optionForKey(letters, "A", "ArrowUp"), "C");
  assert.equal(optionForKey(letters, "B", "ArrowLeft"), "A");
  assert.equal(optionForKey(letters, "B", "Home"), "A");
  assert.equal(optionForKey(letters, "A", "End"), "C");
  assert.equal(optionForKey(letters, null, "ArrowDown"), "A", "no selection: first option");
  assert.equal(optionForKey(letters, null, "ArrowUp"), "C", "no selection: last option");
  assert.equal(optionForKey(letters, "A", "Tab"), null, "other keys are not handled");
  assert.equal(optionForKey(letters, "A", "x"), null);
});

// ---- Q3, multiple choice (change 2026-10-19): RF-17, RF-156, RF-157, RF-158, RF-159 ----
test("only Q3 is multiple and shows the 'Choose one or more' hint (RF-154, RF-156)", () => {
  const v3 = questionView(goTo(3), C);
  assert.equal(v3.multiple, true);
  assert.equal(v3.hint, "Choose one or more");
  for (const n of [1, 2, 4, 10]) {
    const v = questionView(goTo(n), C);
    assert.equal(v.multiple, false, `Q${n}`);
    assert.equal(v.hint, null, `Q${n}`);
    assert.deepEqual(v.checkedLetters, [], `Q${n} without a choice`);
  }
});

test("Q3: checked per letter, checkedLetters in order and checkedLetter null (RF-157)", () => {
  let s = selectOption(goTo(3), C, "C");
  s = selectOption(s, C, "A");
  const v = questionView(s, C);
  assert.deepEqual(v.options.map((o) => o.checked), [true, false, true]);
  assert.deepEqual(v.checkedLetters, ["A", "C"]);
  assert.equal(v.checkedLetter, null);
});

test("single-answer questions list their one letter in checkedLetters", () => {
  const v = questionView(selectOption(atQ1(), C, "B"), C);
  assert.deepEqual(v.checkedLetters, ["B"]);
  assert.equal(v.checkedLetter, "B");
});

test("Q3: one 'why' field with 1+ marked, none with 0, text kept; Next follows (RF-158, RF-159, RF-23)", () => {
  const empty = questionView(goTo(3), C);
  assert.equal(empty.field, null);
  assert.equal(empty.canNext, false);
  let s = setText(selectOption(goTo(3), C, "A"), C, "nice");
  s = selectOption(s, C, "B");
  const two = questionView(s, C);
  assert.equal(two.field, "why");
  assert.equal(two.fieldLabel, FIELD_LABELS.why);
  assert.equal(two.required, false);
  assert.equal(two.canNext, true);
  s = selectOption(selectOption(s, C, "A"), C, "B");
  const none = questionView(s, C);
  assert.equal(none.field, null);
  assert.equal(none.fieldLabel, null);
  assert.equal(none.canNext, false);
  assert.equal(none.fieldText, "nice");
  assert.deepEqual(none.checkedLetters, []);
});
