// js/app/screens/intro.js with a tiny fake DOM (T36): the markers count from 0 to 300/500/200 during the entry
// and stop at once on "Give feedback" or when the intro hides (RF-85, RF-87, RF-123, RF-124, plan §16.8).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mountIntro } from "../js/app/screens/intro.js";
import { MARKER_COUNT, markerValueAt } from "../js/lib/intro-entry.js";

const END = MARKER_COUNT.start + MARKER_COUNT.duration;

/** Fake intro: 3 scores, the "people" entry group with its CSS animation, and the button. */
function fakeIntro({ entry = { animationName: "intro-enter", currentTime: 0 } } = {}) {
  const writes = [];
  const score = (value) => {
    let text = value;
    return {
      get textContent() { return text; },
      set textContent(v) { writes.push(v); text = v; },
    };
  };
  const scores = [score("300"), score("500"), score("200")];
  const listeners = {};
  const button = { addEventListener: (type, fn) => { listeners[type] = fn; } };
  const people = { getAnimations: () => (entry ? [entry] : []) };
  const section = {
    querySelector(sel) {
      if (sel === "[data-action=start]") return button;
      if (sel === '[data-enter="people"]') return people;
      throw new Error(`unsupported selector ${sel}`);
    },
    querySelectorAll(sel) {
      if (sel === ".plato__score") return scores;
      throw new Error(`unsupported selector ${sel}`);
    },
  };
  return { section, scores, writes, click: () => listeners.click(), values: () => scores.map((s) => s.textContent) };
}

/** Manual clock and frame queue. */
function fakeFrames() {
  let t = 0;
  let next = 1;
  const queue = new Map();
  return {
    now: () => t,
    frame: (cb) => { const id = next++; queue.set(id, cb); return id; },
    cancel: (id) => queue.delete(id),
    pending: () => queue.size,
    /** Moves the clock to `ms` and runs the frames queued so far. */
    runAt(ms) {
      t = ms;
      const cbs = [...queue.values()];
      queue.clear();
      for (const cb of cbs) cb(ms);
    },
  };
}

test("show() early in the entry sets the markers to 0 and counts up to 300/500/200 by the end (RF-123)", () => {
  const ui = fakeIntro({ entry: { animationName: "intro-enter", currentTime: 100 } });
  const f = fakeFrames();
  const intro = mountIntro(ui.section, { onStart() {}, now: f.now, frame: f.frame, cancel: f.cancel });
  intro.show(); // 100 ms after the entry started
  assert.deepEqual(ui.values(), ["0", "0", "0"]);
  const mid = MARKER_COUNT.start + MARKER_COUNT.duration / 2;
  f.runAt(mid - 100);
  assert.deepEqual(ui.values(), [300, 500, 200].map((v) => String(markerValueAt(v, mid))));
  f.runAt(END - 100 + 5);
  assert.deepEqual(ui.values(), ["300", "500", "200"]);
  assert.equal(f.pending(), 0, "the count goes on after reaching the values");
});

test("each marker is only written when its value changes", () => {
  const ui = fakeIntro();
  const f = fakeFrames();
  const intro = mountIntro(ui.section, { onStart() {}, now: f.now, frame: f.frame, cancel: f.cancel });
  intro.show();
  const before = ui.writes.length;
  f.runAt(10);
  f.runAt(20); // still before MARKER_COUNT.start: the values stay 0
  assert.equal(ui.writes.length, before);
});

test("too late, without the entry animation (reduced motion) or with no animation API, nothing counts (RF-87, plan §16.8)", () => {
  for (const entry of [
    { animationName: "intro-enter", currentTime: MARKER_COUNT.start },
    { animationName: "intro-enter", currentTime: 1500 },
    null,
    { animationName: "intro-enter", currentTime: null },
  ]) {
    const ui = fakeIntro({ entry });
    const f = fakeFrames();
    mountIntro(ui.section, { onStart() {}, now: f.now, frame: f.frame, cancel: f.cancel }).show();
    assert.deepEqual(ui.values(), ["300", "500", "200"]);
    assert.equal(ui.writes.length, 0);
    assert.equal(f.pending(), 0);
  }
});

test('"Give feedback" while counting stops the count, restores 300/500/200 and starts at once (RF-101, RF-124)', () => {
  const ui = fakeIntro();
  const f = fakeFrames();
  let started = 0;
  const intro = mountIntro(ui.section, { onStart: () => started++, now: f.now, frame: f.frame, cancel: f.cancel });
  intro.show();
  f.runAt(1200);
  assert.notDeepEqual(ui.values(), ["300", "500", "200"]);
  ui.click();
  assert.equal(started, 1);
  assert.deepEqual(ui.values(), ["300", "500", "200"]);
  assert.equal(f.pending(), 0);
});

test("hide() stops the count and leaves the final values; a second hide() is harmless", () => {
  const ui = fakeIntro();
  const f = fakeFrames();
  const intro = mountIntro(ui.section, { onStart() {}, now: f.now, frame: f.frame, cancel: f.cancel });
  intro.show();
  f.runAt(1300);
  intro.hide();
  intro.hide();
  assert.deepEqual(ui.values(), ["300", "500", "200"]);
  assert.equal(f.pending(), 0);
});
