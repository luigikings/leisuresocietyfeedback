import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TRANSITION_OUT_MS, TRANSITION_IN_MS, REDUCED_FADE_MS,
  cityMode, planTransition, openGate, closeGate, gateAllows,
} from "../js/lib/transition.js";

const intro = { screen: "intro", current: 0 };
const country = { screen: "country", current: 0 };
const q = (n) => ({ screen: "question", current: n });
const final = { screen: "final", current: 9 };
const normal = { reduced: false };
const reduced = { reduced: true };

test("durations fit RF-103 and RF-108", () => {
  assert.equal(TRANSITION_OUT_MS, 200);
  assert.equal(TRANSITION_IN_MS, 350);
  assert.equal(REDUCED_FADE_MS, 200);
  assert.ok(TRANSITION_OUT_MS + TRANSITION_IN_MS <= 550);
});

test("cityMode by screen", () => {
  assert.equal(cityMode("intro"), "none");
  assert.equal(cityMode("country"), "none");
  assert.equal(cityMode("question"), "question");
  assert.equal(cityMode("final"), "final");
});

test("first paint (prev null) has no transition (RF-107)", () => {
  for (const next of [intro, country, q(3), final]) {
    for (const opts of [normal, reduced]) {
      const p = planTransition(null, next, opts);
      assert.equal(p.scope, "none");
      assert.equal(p.totalMs, 0);
      assert.equal(p.cityFades, false);
      assert.equal(p.rise, false);
    }
  }
  assert.equal(planTransition(undefined, q(0)).scope, "none");
});

test("same screen and same question: no transition (choosing, typing)", () => {
  assert.equal(planTransition(q(2), q(2), normal).scope, "none");
  assert.equal(planTransition(intro, intro, normal).scope, "none");
  assert.equal(planTransition(country, country, normal).scope, "none");
  assert.equal(planTransition(final, final, normal).scope, "none");
  assert.equal(planTransition(q(2), q(2), normal).totalMs, 0);
});

test("question to question: panel only, the city does not fade (RF-104)", () => {
  for (const [a, b] of [[0, 1], [5, 4], [8, 9]]) {
    const p = planTransition(q(a), q(b), normal);
    assert.deepEqual(p, { scope: "panel", outMs: 200, inMs: 350, totalMs: 550, cityFades: false, rise: true });
  }
});

test("intro to country: screen, without city fade", () => {
  assert.deepEqual(planTransition(intro, country, normal), { scope: "screen", outMs: 200, inMs: 350, totalMs: 550, cityFades: false, rise: true });
});

test("country to question and question to final: screen with city fade", () => {
  assert.deepEqual(planTransition(country, q(0), normal), { scope: "screen", outMs: 200, inMs: 350, totalMs: 550, cityFades: true, rise: true });
  assert.deepEqual(planTransition(q(9), final, normal), { scope: "screen", outMs: 200, inMs: 0, totalMs: 200, cityFades: true, rise: false });
  assert.equal(planTransition(q(0), country, normal).cityFades, true); // Back from Q1
});

test("reduced motion: a single 200 ms fade (RF-108)", () => {
  assert.deepEqual(planTransition(q(1), q(2), reduced), { scope: "panel", outMs: 0, inMs: 200, totalMs: 200, cityFades: false, rise: false });
  assert.deepEqual(planTransition(intro, country, reduced), { scope: "screen", outMs: 0, inMs: 200, totalMs: 200, cityFades: false, rise: false });
  assert.deepEqual(planTransition(q(9), final, reduced), { scope: "screen", outMs: 0, inMs: 200, totalMs: 200, cityFades: true, rise: false });
});

test("every transition lasts 550 ms at most (RF-103)", () => {
  const states = [intro, country, q(0), q(5), q(9), final];
  for (const a of states) for (const b of states) for (const opts of [normal, reduced]) {
    const p = planTransition(a, b, opts);
    assert.ok(p.totalMs <= 550);
    assert.equal(p.totalMs, p.outMs + p.inMs);
    assert.ok(p.outMs <= TRANSITION_OUT_MS && p.inMs <= TRANSITION_IN_MS);
    if (opts.reduced) assert.equal(p.outMs, 0);
    if (opts.reduced || p.inMs === 0 || b.screen === "final") assert.equal(p.rise, false);
  }
});

test("gate: open at first, closed during the transition, open after it (RF-106)", () => {
  const g0 = openGate();
  assert.deepEqual(g0, { busyUntil: 0 });
  assert.equal(gateAllows(g0, 0), true);
  assert.equal(gateAllows(g0, 12345.6), true);

  const g1 = closeGate(g0, 1000, 400);
  assert.deepEqual(g1, { busyUntil: 1400 });
  assert.deepEqual(g0, { busyUntil: 0 }); // not mutated
  assert.equal(gateAllows(g1, 1000), false);
  assert.equal(gateAllows(g1, 1200), false);
  assert.equal(gateAllows(g1, 1399.9), false);
  assert.equal(gateAllows(g1, 1400), true);
  assert.equal(gateAllows(g1, 5000), true);
});

test("gate with a zero-length transition stays open", () => {
  assert.equal(gateAllows(closeGate(openGate(), 500, 0), 500), true);
});

test("rise: between questions and from the country picker to Q1, never with reduced motion or to the final (RF-143)", () => {
  assert.equal(planTransition(q(3), q(4), normal).rise, true);
  assert.equal(planTransition(q(4), q(3), normal).rise, true);
  assert.equal(planTransition(country, q(0), normal).rise, true);
  assert.equal(planTransition(intro, country, normal).rise, true);
  assert.equal(planTransition(q(9), final, normal).rise, false);
  assert.equal(planTransition(q(3), q(4), reduced).rise, false);
  assert.equal(planTransition(country, q(0), reduced).rise, false);
  assert.equal(planTransition(q(2), q(2), normal).rise, false);
});
