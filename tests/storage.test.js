import { test } from "node:test";
import assert from "node:assert/strict";
import { createStorage } from "../js/app/storage.js";

function fakeLocalStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

test("uses the given localStorage when it works", () => {
  const ls = fakeLocalStorage();
  const s = createStorage(() => ls);
  s.set("k", "v");
  assert.equal(ls.getItem("k"), "v");
  assert.equal(s.get("k"), "v");
  assert.equal(s.persistent, true);
});

test("falls back to memory when localStorage throws on access", () => {
  const s = createStorage(() => {
    throw new Error("SecurityError");
  });
  assert.equal(s.get("k"), null);
  s.set("k", "v");
  assert.equal(s.get("k"), "v");
  assert.equal(s.persistent, false);
});

test("falls back to memory when writing fails (quota or blocked)", () => {
  const s = createStorage(() => ({
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {},
  }));
  s.set("k", "v");
  assert.equal(s.get("k"), "v");
  assert.equal(s.persistent, false);
});

test("missing localStorage (undefined) uses memory", () => {
  const s = createStorage(() => undefined);
  s.set("a", "1");
  assert.equal(s.get("a"), "1");
  assert.equal(s.persistent, false);
});
