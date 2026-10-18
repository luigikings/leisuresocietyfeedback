import { test } from "node:test";
import assert from "node:assert/strict";
import { progressView } from "../js/lib/progress.js";

const filled = (v) => v.segments.map((s) => s.filled);
const currents = (v) => v.segments.flatMap((s, i) => (s.current ? [i] : []));

test("nothing answered: 0% and 0 of 10 places, every segment off (RF-125, RF-126, RF-128)", () => {
  const v = progressView({ litCount: 0, current: 0, answeredIndexes: [] });
  assert.equal(v.percentText, "0%");
  assert.equal(v.placesText, "0 of 10 places");
  assert.equal(v.segments.length, 10);
  assert.deepEqual(filled(v), Array(10).fill(false));
});

test("4 answered: 40% and 4 of 10 places (RF-126)", () => {
  const v = progressView({ litCount: 4, current: 4, answeredIndexes: [0, 1, 2, 3] });
  assert.equal(v.percentText, "40%");
  assert.equal(v.placesText, "4 of 10 places");
  assert.deepEqual(filled(v), [true, true, true, true, false, false, false, false, false, false]);
});

test("10 answered: 100% and 10 of 10 places (RF-126, RF-130)", () => {
  const all = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const v = progressView({ litCount: 10, current: null, answeredIndexes: all });
  assert.equal(v.percentText, "100%");
  assert.equal(v.placesText, "10 of 10 places");
  assert.deepEqual(filled(v), Array(10).fill(true));
});

test("filled segments are the answered questions, also out of order after Back (RF-128)", () => {
  const v = progressView({ litCount: 3, current: 1, answeredIndexes: [0, 1, 2] });
  assert.deepEqual(filled(v).slice(0, 4), [true, true, true, false]);
  const gap = progressView({ litCount: 2, current: 1, answeredIndexes: [2, 0] });
  assert.deepEqual(filled(gap).slice(0, 4), [true, false, true, false]);
  assert.equal(gap.percentText, "20%");
});

test("current marks exactly one segment, even an answered one (RF-129)", () => {
  const v = progressView({ litCount: 5, current: 2, answeredIndexes: [0, 1, 2, 3, 4] });
  assert.deepEqual(currents(v), [2]);
  assert.equal(v.segments[2].filled, true);
  const fresh = progressView({ litCount: 5, current: 5, answeredIndexes: [0, 1, 2, 3, 4] });
  assert.deepEqual(currents(fresh), [5]);
  assert.equal(fresh.segments[5].filled, false);
});

test("final screen: no current segment (RF-130)", () => {
  const v = progressView({ litCount: 10, current: null, answeredIndexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
  assert.deepEqual(currents(v), []);
  assert.deepEqual(currents(progressView({ litCount: 10, answeredIndexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] })), []);
});

test("without answeredIndexes, the first litCount segments are filled", () => {
  assert.deepEqual(filled(progressView({ litCount: 2, current: 2 })).slice(0, 3), [true, true, false]);
});

test("total changes the segment count and the places text; inputs are not mutated", () => {
  const answered = Object.freeze([1, 0]);
  const v = progressView({ litCount: 2, total: 4, current: 2, answeredIndexes: answered });
  assert.equal(v.segments.length, 4);
  assert.equal(v.placesText, "2 of 4 places");
  assert.deepEqual(answered, [1, 0]);
});
