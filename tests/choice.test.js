import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MULTI_VALUES, isMultiple, lettersOf, toggleLetter } from "../js/lib/choice.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ABC = ["A", "B", "C"];

test("MULTI_VALUES are the 7 valid Q3 values, sorted A, B, C (RF-164)", () => {
  assert.deepEqual([...MULTI_VALUES], ["A", "B", "C", "AB", "AC", "BC", "ABC"]);
  assert.ok(Object.isFrozen(MULTI_VALUES));
});

test("isMultiple is true only when the question says multiple: true (RF-154)", () => {
  assert.equal(isMultiple({ id: "q3", multiple: true }), true);
  assert.equal(isMultiple({ id: "q1" }), false);
  assert.equal(isMultiple({ id: "q1", multiple: false }), false);
  assert.equal(isMultiple({ id: "q1", multiple: "true" }), false);
  assert.equal(isMultiple(null), false);
  assert.equal(isMultiple(undefined), false);
});

test("lettersOf splits a value into its distinct letters in order", () => {
  assert.deepEqual(lettersOf("AC"), ["A", "C"]);
  assert.deepEqual(lettersOf("ABC"), ["A", "B", "C"]);
  assert.deepEqual(lettersOf("B"), ["B"]);
  assert.deepEqual(lettersOf("AAC"), ["A", "C"]);
  assert.deepEqual(lettersOf(""), []);
  assert.deepEqual(lettersOf(null), []);
  assert.deepEqual(lettersOf(undefined), []);
});

test("toggleLetter adds a letter (RF-155)", () => {
  assert.equal(toggleLetter(null, "A", ABC), "A");
  assert.equal(toggleLetter("A", "C", ABC), "AC");
  assert.equal(toggleLetter("AC", "B", ABC), "ABC");
});

test("toggleLetter removes a marked letter", () => {
  assert.equal(toggleLetter("AC", "A", ABC), "C");
  assert.equal(toggleLetter("ABC", "B", ABC), "AC");
});

test("toggleLetter keeps the A, B, C order whatever the tap order (RF-161)", () => {
  assert.equal(toggleLetter("C", "A", ABC), "AC");
  assert.equal(toggleLetter(toggleLetter(toggleLetter(null, "C", ABC), "B", ABC), "A", ABC), "ABC");
  assert.equal(toggleLetter("BC", "A", ABC), "ABC");
});

test("toggleLetter returns null when the last letter is removed", () => {
  assert.equal(toggleLetter("A", "A", ABC), null);
  assert.equal(toggleLetter("C", "C", ABC), null);
});

test("toggleLetter never repeats letters", () => {
  assert.equal(toggleLetter("AAC", "B", ABC), "ABC");
  assert.equal(toggleLetter("AAC", "A", ABC), "C");
});

test("toggleLetter ignores a letter that is not in the question", () => {
  assert.equal(toggleLetter("A", "D", ABC), "A");
  assert.equal(toggleLetter(null, "D", ABC), null);
  assert.equal(toggleLetter("A", "C", ["A", "B"]), "A");
});

test("every result of toggleLetter on A/B/C is one of MULTI_VALUES or null", () => {
  for (const v of [null, ...MULTI_VALUES]) {
    for (const l of ABC) {
      const r = toggleLetter(v, l, ABC);
      assert.ok(r === null || MULTI_VALUES.includes(r), `${v} + ${l} → ${r}`);
    }
  }
});

test("choice.js uses no DOM, network or clock (RNF-7)", () => {
  const src = fs.readFileSync(path.join(ROOT, "js/lib/choice.js"), "utf8");
  assert.doesNotMatch(src, /\b(document|window|fetch|localStorage|Date|performance|setTimeout|navigator)\b/);
});
