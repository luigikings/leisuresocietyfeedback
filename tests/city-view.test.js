import { test } from "node:test";
import assert from "node:assert/strict";
import { SITE_IDS, SITE_NAMES } from "../js/lib/sites.js";
import { cityView } from "../js/lib/city-view.js";

test("SITE_NAMES has an English name for each SITE_ID and nothing else (RF-75)", () => {
  assert.deepEqual(Object.keys(SITE_NAMES).sort(), [...SITE_IDS].sort());
  assert.deepEqual(SITE_IDS.map((id) => SITE_NAMES[id]), [
    "Park", "Concert hall", "Museum", "Theatre", "Cinema",
    "Fairground", "Town square", "Food market", "Nightclub", "Stadium",
  ]);
  assert.ok(Object.isFrozen(SITE_NAMES));
});

test("lit follows question order, without unknown ids or duplicates (RF-29)", () => {
  const view = cityView(["stadium", "park", "unknown", "park", "museum"]);
  assert.deepEqual(view.lit, ["park", "museum", "stadium"]);
});

test("no sites lit: allLit false and the 0-of-10 label (RF-72, RF-75)", () => {
  const view = cityView([]);
  assert.deepEqual(view.lit, []);
  assert.equal(view.allLit, false);
  assert.equal(view.label, "Night city: 0 of 10 places lit");
});

test("3 sites lit: label with the English names in question order (RF-75)", () => {
  const view = cityView(["cinema", "park", "concert-hall"]);
  assert.equal(view.allLit, false);
  assert.equal(view.label, "Night city: 3 of 10 places lit: Park, Concert hall, Cinema");
});

test("9 sites lit, also with a duplicate: allLit false (RF-72)", () => {
  const nine = SITE_IDS.slice(0, 9);
  assert.equal(cityView(nine).allLit, false);
  assert.equal(cityView([...nine, nine[0]]).allLit, false);
  assert.equal(cityView([...nine, "unknown"]).allLit, false);
});

test("all 10 sites lit: allLit true and the full label (RF-73, RF-75)", () => {
  const view = cityView([...SITE_IDS].reverse());
  assert.deepEqual(view.lit, [...SITE_IDS]);
  assert.equal(view.allLit, true);
  assert.equal(
    view.label,
    "Night city: 10 of 10 places lit: Park, Concert hall, Museum, Theatre, Cinema, " +
      "Fairground, Town square, Food market, Nightclub, Stadium",
  );
});

test("does not mutate its input and accepts injected site ids and names", () => {
  const input = ["b", "a"];
  const view = cityView(input, ["a", "b"], { a: "A", b: "B" });
  assert.deepEqual(input, ["b", "a"]);
  assert.deepEqual(view.lit, ["a", "b"]);
  assert.equal(view.allLit, true);
  assert.equal(view.label, "Night city: 2 of 2 places lit: A, B");
});
