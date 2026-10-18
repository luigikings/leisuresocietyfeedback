import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INTRO_ENTRY, INTRO_ENTRY_MAX_MS, BUTTON_HIGHLIGHT_MAX_MS, introEntryEndMs, introEntryCssVars,
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
