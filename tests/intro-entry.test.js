import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INTRO_ENTRY, INTRO_ENTRY_MAX_MS, BUTTON_HIGHLIGHT_MAX_MS, introEntryEndMs, introEntryCssVars,
  INTRO_LOOPS, flashesPerSecond, BOARD_SEQUENCE, MARKER_COUNT, markerValueAt, markerCountPlan,
} from "../js/lib/intro-entry.js";

test("entry steps follow the order of RF-98", () => {
  assert.deepEqual(INTRO_ENTRY.map((s) => s.id), [
    "lights", "sign", "board", "onair", "floor", "people", "thanks", "ask", "button",
  ]);
  assert.ok(Object.isFrozen(INTRO_ENTRY));
  for (const s of INTRO_ENTRY) assert.ok(Object.isFrozen(s));
});

test("starts never decrease and every step has a positive duration (RF-98)", () => {
  for (let i = 0; i < INTRO_ENTRY.length; i++) {
    const s = INTRO_ENTRY[i];
    assert.ok(Number.isInteger(s.start) && s.start >= 0, s.id);
    assert.ok(Number.isInteger(s.duration) && s.duration > 0, s.id);
    if (i > 0) assert.ok(s.start >= INTRO_ENTRY[i - 1].start, s.id);
  }
});

test("the whole entry lasts 2 s at most (RF-98)", () => {
  assert.equal(INTRO_ENTRY_MAX_MS, 2000);
  assert.equal(introEntryEndMs(INTRO_ENTRY), 2000);
  assert.ok(introEntryEndMs() <= INTRO_ENTRY_MAX_MS);
});

test("the button highlight is the last step and lasts 600 ms at most (RF-100)", () => {
  assert.equal(BUTTON_HIGHLIGHT_MAX_MS, 600);
  const last = INTRO_ENTRY[INTRO_ENTRY.length - 1];
  assert.equal(last.id, "button");
  assert.ok(last.duration <= BUTTON_HIGHLIGHT_MAX_MS);
  assert.equal(last.start + last.duration, introEntryEndMs());
});

test("introEntryEndMs is the latest start + duration", () => {
  assert.equal(introEntryEndMs([{ id: "a", start: 100, duration: 900 }, { id: "b", start: 300, duration: 200 }]), 1000);
  assert.equal(introEntryEndMs([]), 0);
});

test("CSS variables use the --enter-<id>-start/-dur format in ms", () => {
  const vars = introEntryCssVars();
  assert.equal(Object.keys(vars).length, INTRO_ENTRY.length * 2);
  for (const s of INTRO_ENTRY) {
    assert.equal(vars[`--enter-${s.id}-start`], `${s.start}ms`);
    assert.equal(vars[`--enter-${s.id}-dur`], `${s.duration}ms`);
  }
  for (const [k, v] of Object.entries(vars)) {
    assert.match(k, /^--enter-[a-z]+-(start|dur)$/);
    assert.match(v, /^\d+ms$/);
  }
  assert.deepEqual(introEntryCssVars([{ id: "x", start: 5, duration: 10 }]), { "--enter-x-start": "5ms", "--enter-x-dur": "10ms" });
});

test("INTRO_LOOPS: the three loops of RF-119 to RF-121", () => {
  assert.deepEqual(INTRO_LOOPS, {
    bulbs: { count: 4, cycleMs: 1600 },
    board: { count: 13, stepMs: 400 },
    markers: { count: 3, cycleMs: 1500 },
  });
  assert.ok(Object.isFrozen(INTRO_LOOPS));
  for (const loop of Object.values(INTRO_LOOPS)) assert.ok(Object.isFrozen(loop));
  assert.ok(INTRO_LOOPS.bulbs.cycleMs >= 1600);
  assert.ok(INTRO_LOOPS.board.stepMs >= 400);
  assert.ok(INTRO_LOOPS.markers.cycleMs >= 1500);
});

test("flashesPerSecond: at most 3 in every loop (RF-86, RF-124)", () => {
  assert.equal(flashesPerSecond(INTRO_LOOPS.bulbs), 2.5);
  assert.equal(flashesPerSecond(INTRO_LOOPS.board), 2.5);
  assert.equal(flashesPerSecond(INTRO_LOOPS.markers), 2);
  for (const loop of Object.values(INTRO_LOOPS)) assert.ok(flashesPerSecond(loop) <= 3);
  assert.equal(flashesPerSecond({ count: 6, cycleMs: 1000 }), 6);
  assert.equal(flashesPerSecond({ count: 1, stepMs: 250 }), 4);
});

test("BOARD_SEQUENCE: the 13 valued cells in reading order, without the 2 empty ones (RF-120)", () => {
  assert.equal(BOARD_SEQUENCE.length, 13);
  assert.equal(BOARD_SEQUENCE.length, INTRO_LOOPS.board.count);
  assert.ok(Object.isFrozen(BOARD_SEQUENCE));
  const key = (c) => `${c.column}-${c.value}`;
  const keys = BOARD_SEQUENCE.map(key);
  assert.ok(!keys.includes("Community-200"));
  assert.ok(!keys.includes("Culture & identity-300"));
  assert.equal(new Set(keys).size, 13);
  for (let i = 1; i < BOARD_SEQUENCE.length; i++) {
    const a = BOARD_SEQUENCE[i - 1];
    const b = BOARD_SEQUENCE[i];
    assert.ok(b.row > a.row || (b.row === a.row && b.col > a.col), `reading order at ${i}`);
  }
  for (const c of BOARD_SEQUENCE) {
    assert.equal(c.value, (c.row + 1) * 100);
    assert.ok(c.col >= 0 && c.col < 5);
  }
  assert.deepEqual(BOARD_SEQUENCE.slice(0, 5).map((c) => c.column),
    ["Well-being", "Community", "Economy", "Culture & identity", "Access & inclusion"]);
});

test("MARKER_COUNT ends within the 2 s entry (RF-123)", () => {
  assert.deepEqual(MARKER_COUNT, { start: 1000, duration: 800 });
  assert.ok(MARKER_COUNT.start + MARKER_COUNT.duration <= INTRO_ENTRY_MAX_MS);
  assert.ok(Object.isFrozen(MARKER_COUNT));
});

test("markerValueAt: 0 before the start, increasing multiples of 10, exact value at the end (RF-123)", () => {
  const end = MARKER_COUNT.start + MARKER_COUNT.duration;
  for (const target of [300, 500, 200]) {
    assert.equal(markerValueAt(target, 0), 0);
    assert.equal(markerValueAt(target, MARKER_COUNT.start - 1), 0);
    assert.equal(markerValueAt(target, MARKER_COUNT.start), 0);
    assert.equal(markerValueAt(target, end), target);
    assert.equal(markerValueAt(target, end + 5000), target);
    let last = 0;
    for (let t = 0; t <= end + 100; t += 16) {
      const v = markerValueAt(target, t);
      assert.ok(Number.isInteger(v) && v % 10 === 0, `${target} at ${t}: ${v}`);
      assert.ok(v >= last && v <= target, `${target} at ${t}: ${v}`);
      last = v;
    }
    const mid = markerValueAt(target, MARKER_COUNT.start + MARKER_COUNT.duration / 2);
    assert.ok(mid > 0 && mid < target);
  }
});

test("markerCountPlan: count only if the module runs before the count starts (RF-123)", () => {
  assert.equal(markerCountPlan(0), "count");
  assert.equal(markerCountPlan(MARKER_COUNT.start - 1), "count");
  assert.equal(markerCountPlan(MARKER_COUNT.start), "skip");
  assert.equal(markerCountPlan(5000), "skip");
  assert.equal(markerCountPlan(null), "skip");
  assert.equal(markerCountPlan(Number.NaN), "skip");
});
