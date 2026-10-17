import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_TEXT,
  trimText,
  textLength,
  clampText,
  remaining,
  normalizeForStore,
} from "../js/lib/text.js";

test("MAX_TEXT is 280 (RF-24)", () => {
  assert.equal(MAX_TEXT, 280);
});

test("trimText removes leading/trailing Unicode whitespace only", () => {
  assert.equal(trimText("  hi there \n\t"), "hi there");
  assert.equal(trimText("  hi　"), "hi");
  assert.equal(trimText(""), "");
});

test("textLength counts code points after trimming (RF-24, RF-28)", () => {
  assert.equal(textLength("hello"), 5);
  assert.equal(textLength("  hello  "), 5);
  assert.equal(textLength(""), 0);
});

test("textLength counts an emoji outside the BMP as 1 (not 2 UTF-16 units)", () => {
  assert.equal("😀".length, 2);
  assert.equal(textLength("😀"), 1);
  assert.equal(textLength("a😀b"), 3);
});

test("textLength counts each code point of combined sequences", () => {
  // Family emoji: 3 people joined by 2 ZWJ = 5 code points
  assert.equal(textLength("👨‍👩‍👧"), 5);
  // Flag = 2 regional indicators
  assert.equal(textLength("🇫🇷"), 2);
  // e + combining acute = 2 code points; precomposed é = 1
  assert.equal(textLength("é"), 2);
  assert.equal(textLength("é"), 1);
});

test("textLength of only spaces is 0 (RF-28)", () => {
  assert.equal(textLength("     "), 0);
  assert.equal(textLength("\n\t  "), 0);
});

test("clampText keeps text up to 280 code points unchanged", () => {
  const s = "a".repeat(280);
  assert.equal(clampText(s), s);
  assert.equal(clampText("short"), "short");
  assert.equal(clampText(""), "");
});

test("clampText cuts pasted text to the first 280 code points (RF-25)", () => {
  const s = "b".repeat(300);
  assert.equal(clampText(s), "b".repeat(280));
  assert.equal(remaining(clampText(s)), 0);
});

test("clampText never splits an emoji surrogate pair", () => {
  const s = "😀".repeat(300);
  const out = clampText(s);
  assert.equal([...out].length, 280);
  assert.equal(out, "😀".repeat(280));
  assert.equal(remaining(out), 0);
});

test("clampText accepts a custom max", () => {
  assert.equal(clampText("abcdef", 3), "abc");
  assert.equal(clampText("😀😀😀", 2), "😀😀");
});

test("remaining shows characters left (RF-24)", () => {
  assert.equal(remaining(""), 280);
  assert.equal(remaining("abc"), 277);
  assert.equal(remaining("  abc  "), 277);
  assert.equal(remaining("😀"), 279);
});

test("normalizeForStore trims and maps empty to null (RF-28)", () => {
  assert.equal(normalizeForStore("  great night  "), "great night");
  assert.equal(normalizeForStore(""), null);
  assert.equal(normalizeForStore("   \n "), null);
  assert.equal(normalizeForStore(null), null);
  assert.equal(normalizeForStore(undefined), null);
});

test("functions tolerate null/undefined as empty text", () => {
  assert.equal(textLength(null), 0);
  assert.equal(textLength(undefined), 0);
  assert.equal(clampText(null), "");
  assert.equal(remaining(undefined), 280);
});
