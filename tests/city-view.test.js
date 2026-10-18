import { test } from "node:test";
import assert from "node:assert/strict";
import { SITE_IDS, SITE_NAMES } from "../js/lib/sites.js";
import {
  cityView, holdFullLight, celebration, toastPlacement, TOAST_MS, RING_MS, HALO_FADE_MS,
} from "../js/lib/city-view.js";
import { SITE_CELLS } from "../js/lib/city-grid.js";

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

test("holdFullLight keeps lit and label, turns allLit off and does not mutate its input (RF-73, RF-105)", () => {
  const view = cityView([...SITE_IDS]);
  const snapshot = structuredClone(view);
  const held = holdFullLight(view);
  assert.equal(held.allLit, false);
  assert.deepEqual(held.lit, view.lit);
  assert.equal(held.label, view.label);
  assert.notEqual(held, view);
  assert.notEqual(held.lit, view.lit);
  assert.deepEqual(view, snapshot);
});

test("holdFullLight on a partly lit city changes nothing but the object identity", () => {
  const view = cityView(["park"]);
  assert.deepEqual(holdFullLight(view), view);
});

test("celebration: a newly lit site gets the ring and the toast (RF-134, RF-135)", () => {
  assert.deepEqual(celebration(["park"], ["park", "cinema"], { firstPaint: false, toFinal: false }),
    { siteId: "cinema", ring: true, toast: "Lit up: Cinema" });
  assert.deepEqual(celebration([], ["park"]), { siteId: "park", ring: true, toast: "Lit up: Park" });
  for (const id of SITE_IDS) {
    assert.equal(celebration([], [id]).toast, `Lit up: ${SITE_NAMES[id]}`);
  }
});

test("celebration: already lit sites (changed answer, Back) give nothing (RF-138)", () => {
  const none = { siteId: null, ring: false, toast: null };
  assert.deepEqual(celebration(["park", "cinema"], ["park", "cinema"]), none);
  assert.deepEqual(celebration(["park", "cinema"], ["cinema", "park"]), none);
  assert.deepEqual(celebration(["park", "cinema"], ["park"]), none);
  assert.deepEqual(celebration([], []), none);
});

test("celebration: the first paint (resume, reopening) gives nothing (RF-138)", () => {
  assert.deepEqual(celebration([], ["park", "museum"], { firstPaint: true }), { siteId: null, ring: false, toast: null });
  assert.deepEqual(celebration([], [...SITE_IDS], { firstPaint: true, toFinal: true }), { siteId: null, ring: false, toast: null });
});

test("celebration: Next on Q10 lights the site without ring or toast (RF-148)", () => {
  const before = SITE_IDS.slice(0, 9);
  assert.deepEqual(celebration(before, [...SITE_IDS], { toFinal: true }), { siteId: "stadium", ring: false, toast: null });
  assert.deepEqual(celebration([...SITE_IDS], [...SITE_IDS], { toFinal: true }), { siteId: null, ring: false, toast: null });
});

test("celebration does not mutate its inputs", () => {
  const prev = Object.freeze(["park"]);
  const next = Object.freeze(["park", "museum"]);
  const opts = Object.freeze({ firstPaint: false, toFinal: false });
  assert.equal(celebration(prev, next, opts).siteId, "museum");
  assert.deepEqual(prev, ["park"]);
  assert.deepEqual(next, ["park", "museum"]);
});

test("toastPlacement: top for sites in the bottom row, bottom for the rest (RF-137)", () => {
  assert.equal(toastPlacement("theatre"), "top");
  assert.equal(toastPlacement("food-market"), "top");
  for (const id of SITE_IDS) {
    assert.equal(toastPlacement(id), SITE_CELLS[id][1] === 3 ? "top" : "bottom", id);
  }
  assert.equal(toastPlacement("cinema"), "bottom");
});

test("celebration times fit RF-133 to RF-135", () => {
  assert.equal(TOAST_MS, 1500);
  assert.ok(RING_MS <= 1200);
  assert.ok(HALO_FADE_MS <= 900);
});
