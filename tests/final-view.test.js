import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTENT } from "../js/content.js";
import { OTHER_CODE } from "../js/lib/sites.js";
import {
  FINAL_MAX_MS, FINAL_PHASES, PHASE_ORDER, finalEndMs, finalCssVars, finalFlags, flagLayout,
  confettiPieces, CONFETTI_COLORS, FLAG_WIDTH,
} from "../js/lib/final-view.js";

// Deterministic "random" for tests: cycles through fixed values in [0, 1).
function fakeRandom(values = [0, 0.25, 0.5, 0.75, 0.999]) {
  let i = 0;
  return () => values[i++ % values.length];
}

test("the final timeline has the phases of RF-53 in that order", () => {
  assert.deepEqual(PHASE_ORDER, ["wave", "cars", "confetti", "spin", "converge", "flash", "texts"]);
  assert.deepEqual(FINAL_PHASES.map((p) => p.id), PHASE_ORDER);
  for (let i = 1; i < FINAL_PHASES.length; i++) {
    assert.ok(
      FINAL_PHASES[i].start > FINAL_PHASES[i - 1].start,
      `${FINAL_PHASES[i].id} starts after ${FINAL_PHASES[i - 1].id}`,
    );
  }
});

test("flags converge after spinning, the flash comes when they meet and the texts after the flash (RF-53)", () => {
  const p = Object.fromEntries(FINAL_PHASES.map((x) => [x.id, x]));
  assert.ok(p.converge.start >= p.spin.start + p.spin.duration / 2, "converge after most of the spin");
  assert.ok(p.flash.start >= p.converge.start + p.converge.duration - 200, "flash when the flags meet");
  assert.ok(p.texts.start >= p.flash.start, "texts after the flash starts");
});

test("the whole final lasts 8 s at most and every phase is positive (RF-53)", () => {
  assert.equal(FINAL_MAX_MS, 8000);
  for (const ph of FINAL_PHASES) {
    assert.ok(ph.start >= 0 && ph.duration > 0, ph.id);
    assert.ok(ph.start + ph.duration <= FINAL_MAX_MS, `${ph.id} ends within 8 s`);
  }
  assert.ok(finalEndMs() <= FINAL_MAX_MS);
  assert.equal(finalEndMs(), Math.max(...FINAL_PHASES.map((x) => x.start + x.duration)));
});

test("the texts are the last thing to end, so their animationend marks the end of the final (RF-54)", () => {
  const texts = FINAL_PHASES.find((x) => x.id === "texts");
  assert.equal(texts.start + texts.duration, finalEndMs());
});

test("finalCssVars exposes start and duration of each phase in ms", () => {
  const vars = finalCssVars();
  for (const ph of FINAL_PHASES) {
    assert.equal(vars[`--final-${ph.id}-start`], `${ph.start}ms`);
    assert.equal(vars[`--final-${ph.id}-dur`], `${ph.duration}ms`);
  }
  assert.equal(Object.keys(vars).length, FINAL_PHASES.length * 2);
});

test("finalFlags lists the content countries in order, with flag path and name as alt, never 'Other' (RF-53, RNF-4)", () => {
  const flags = finalFlags(CONTENT.countries);
  assert.equal(flags.length, CONTENT.countries.length);
  assert.deepEqual(flags[0], { code: "NL", name: "Netherlands", src: "assets/flags/nl.svg" });
  assert.equal(flags.find((f) => f.code === "NG").name, "Nigeria");
  const withOther = [...CONTENT.countries, { code: OTHER_CODE, name: "Other" }];
  assert.ok(!finalFlags(withOther).some((f) => f.code === OTHER_CODE));
  assert.deepEqual(finalFlags([]), []);
});

test("flagLayout: one position per flag, spread on a ring at the start and together at the end", () => {
  const n = 10;
  const layout = flagLayout(n);
  assert.equal(layout.length, n);
  const starts = new Set(layout.map((f) => `${f.sx},${f.sy}`));
  assert.equal(starts.size, n, "distinct start positions");
  const endSum = layout.reduce((a, f) => a + f.ex, 0);
  assert.ok(Math.abs(endSum) < 1e-9, "end cluster centred");
  // End positions overlap: neighbours closer than a flag width (they "join").
  for (let i = 1; i < n; i++) assert.ok(layout[i].ex - layout[i - 1].ex < FLAG_WIDTH);
  // Start ring is clearly wider than the end cluster.
  const spread = (k) => Math.max(...layout.map((f) => Math.abs(f[k])));
  assert.ok(spread("sx") > spread("ex"));
});

test("flagLayout fits a 320 px screen (288 px of content) for 1 to 20 flags (RNF-1)", () => {
  for (let n = 1; n <= 20; n++) {
    const layout = flagLayout(n);
    for (const f of layout) {
      assert.ok(Math.abs(f.sx) + FLAG_WIDTH / 2 <= 144, `n=${n} start fits`);
      assert.ok(Math.abs(f.ex) + FLAG_WIDTH / 2 <= 144, `n=${n} end fits`);
      assert.ok(Number.isFinite(f.sy) && Number.isFinite(f.rot));
    }
  }
  assert.deepEqual(flagLayout(0), []);
  assert.equal(flagLayout(1)[0].ex, 0);
});

test("confettiPieces: count pieces inside the screen, within the confetti phase, deterministic with the injected random", () => {
  const conf = FINAL_PHASES.find((x) => x.id === "confetti");
  const pieces = confettiPieces(40, fakeRandom());
  assert.equal(pieces.length, 40);
  for (const p of pieces) {
    assert.ok(p.x >= 0 && p.x <= 100, "x in %");
    assert.ok(p.delay >= 0 && p.delay + p.duration <= conf.duration, "inside the phase");
    assert.ok(p.duration > 0);
    assert.ok(CONFETTI_COLORS.includes(p.color));
    assert.ok(Number.isFinite(p.spin) && Number.isFinite(p.drift));
  }
  assert.deepEqual(confettiPieces(40, fakeRandom()), pieces, "same random → same pieces");
  assert.deepEqual(confettiPieces(0, fakeRandom()), []);
});
