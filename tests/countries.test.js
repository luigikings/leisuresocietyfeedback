import { test } from "node:test";
import assert from "node:assert/strict";
import * as countries from "../js/lib/countries.js";
import { countryTiles, OTHER_ENTRY } from "../js/lib/countries.js";
import { OTHER_CODE } from "../js/lib/sites.js";
import { CONTENT } from "../js/content.js";

const LIST = [
  { code: "PL", name: "Poland" },
  { code: "DE", name: "Germany" },
  { code: "JP", name: "Japan" },
];
const codes = (items) => items.map((c) => c.code);

test("OTHER_ENTRY uses the reserved code and the name 'Other' (RF-11)", () => {
  assert.equal(OTHER_ENTRY.code, OTHER_CODE);
  assert.equal(OTHER_ENTRY.name, "Other");
  assert.ok(Object.isFrozen(OTHER_ENTRY));
});

test("countryTiles keeps the order of the data, without sorting (RF-10)", () => {
  assert.deepEqual(codes(countryTiles(LIST)), ["PL", "DE", "JP", OTHER_CODE]);
});

test("countryTiles puts Other last, exactly once (RF-11)", () => {
  const tiles = countryTiles(LIST);
  assert.equal(tiles.at(-1), OTHER_ENTRY);
  assert.equal(tiles.filter((c) => c.code === OTHER_CODE).length, 1);
});

test("countryTiles keeps each country object as given", () => {
  const tiles = countryTiles(LIST);
  LIST.forEach((c, i) => assert.equal(tiles[i], c));
});

test("countryTiles does not mutate the input and returns a new array", () => {
  const input = LIST.slice();
  const tiles = countryTiles(input);
  assert.deepEqual(input, LIST);
  assert.notEqual(tiles, input);
});

test("countryTiles with no countries gives only Other", () => {
  assert.deepEqual(countryTiles([]), [OTHER_ENTRY]);
});

test("with the real content there are 9 tiles: the 8 countries in order + Other", () => {
  const tiles = countryTiles(CONTENT.countries);
  assert.equal(tiles.length, 9);
  assert.deepEqual(codes(tiles), ["NL", "HU", "VE", "IT", "RO", "PL", "GB", "MD", OTHER_CODE]);
});

test("the module only exports OTHER_ENTRY and countryTiles (search and sort removed, RF-12 to RF-14)", () => {
  assert.deepEqual(Object.keys(countries).sort(), ["OTHER_ENTRY", "countryTiles"]);
});
