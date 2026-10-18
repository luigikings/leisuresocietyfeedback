// js/lib/city-grid.js (T29): the 6×4 grid of the map, site cells, streets, lamps, wave and filler buildings.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SITE_IDS } from "../js/lib/sites.js";
import {
  COLS, ROWS, CELL_W, CELL_H, GAP, MARGIN_X, MARGIN_Y, VIEW_W, VIEW_H, CENTER,
  cellBox, SITE_CELLS, fillerCells, areNeighbours, readingOrder, columnOrder,
  STREETS, lampPoints, waveDelayFraction, fillerBuildings,
} from "../js/lib/city-grid.js";

const key = ([c, r]) => `${c},${r}`;
const inside = (inner, outer) =>
  inner.x >= outer.x && inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
const MAP = { x: 0, y: 0, w: VIEW_W, h: VIEW_H };
const allCells = () => {
  const out = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) out.push([c, r]);
  return out;
};

test("grid constants match the demo: 6×4 cells of 56×62 with 8 gaps in a 400×292 viewBox", () => {
  assert.deepEqual(
    [COLS, ROWS, CELL_W, CELL_H, GAP, MARGIN_X, MARGIN_Y, VIEW_W, VIEW_H],
    [6, 4, 56, 62, 8, 12, 10, 400, 292],
  );
  assert.deepEqual(CENTER, { x: 200, y: 146 });
  assert.ok(Object.isFrozen(CENTER));
});

test("cellBox gives the box of a cell and every cell is inside the map (RF-69, RF-111)", () => {
  assert.deepEqual(cellBox(0, 0), { x: 12, y: 10, w: 56, h: 62 });
  assert.deepEqual(cellBox(5, 3), { x: 332, y: 220, w: 56, h: 62 });
  assert.deepEqual(cellBox(3, 2), { x: 204, y: 150, w: 56, h: 62 });
  for (const [c, r] of allCells()) assert.ok(inside(cellBox(c, r), MAP), key([c, r]));
  // symmetric margins: the last cell ends 12 / 10 units before the edge
  assert.equal(cellBox(5, 0).x + CELL_W, VIEW_W - MARGIN_X);
  assert.equal(cellBox(0, 3).y + CELL_H, VIEW_H - MARGIN_Y);
});

test("SITE_CELLS: proposal 29, one distinct cell per site, inside 6×4, frozen", () => {
  assert.deepEqual(Object.keys(SITE_CELLS).sort(), [...SITE_IDS].sort());
  assert.ok(Object.isFrozen(SITE_CELLS));
  assert.deepEqual(
    SITE_IDS.map((id) => [...SITE_CELLS[id]]),
    [[1, 2], [4, 0], [0, 0], [3, 3], [5, 1], [3, 2], [2, 0], [5, 3], [3, 1], [0, 1]],
  );
  const seen = new Set();
  for (const id of SITE_IDS) {
    const [c, r] = SITE_CELLS[id];
    assert.ok(Object.isFrozen(SITE_CELLS[id]), id);
    assert.ok(Number.isInteger(c) && c >= 0 && c < COLS, `${id} column`);
    assert.ok(Number.isInteger(r) && r >= 0 && r < ROWS, `${id} row`);
    seen.add(key(SITE_CELLS[id]));
  }
  assert.equal(seen.size, 10);
});

test("fillerCells: the 14 cells without a site, in reading order (RF-70)", () => {
  const fillers = fillerCells();
  assert.equal(fillers.length, 14);
  const siteKeys = new Set(SITE_IDS.map((id) => key(SITE_CELLS[id])));
  for (const cell of fillers) assert.ok(!siteKeys.has(key(cell)), key(cell));
  assert.equal(new Set(fillers.map(key)).size, 14);
  assert.deepEqual(fillers, readingOrder(fillers));
  assert.deepEqual(fillers[0], [1, 0]);
  assert.deepEqual(fillers.at(-1), [4, 3]);
});

test("areNeighbours: same row, column and diagonal neighbours; not the same cell; not two apart", () => {
  assert.equal(areNeighbours([1, 1], [2, 1]), true);
  assert.equal(areNeighbours([1, 1], [1, 0]), true);
  assert.equal(areNeighbours([1, 1], [2, 2]), true);
  assert.equal(areNeighbours([1, 1], [0, 0]), true);
  assert.equal(areNeighbours([1, 1], [1, 1]), false);
  assert.equal(areNeighbours([1, 1], [3, 1]), false);
  assert.equal(areNeighbours([1, 1], [1, 3]), false);
  assert.equal(areNeighbours([0, 0], [5, 3]), false);
});

test("readingOrder and columnOrder sort a copy of the cells by rows or by columns", () => {
  const cells = [[2, 1], [0, 1], [1, 0], [0, 0]];
  const before = JSON.stringify(cells);
  assert.deepEqual(readingOrder(cells), [[0, 0], [1, 0], [0, 1], [2, 1]]);
  assert.deepEqual(columnOrder(cells), [[0, 0], [0, 1], [1, 0], [2, 1]]);
  assert.equal(JSON.stringify(cells), before, "the input is not changed");
});

test("RF-139: consecutive questions never have their sites in the same or neighbouring cells", () => {
  for (let i = 0; i + 1 < SITE_IDS.length; i++) {
    const a = SITE_CELLS[SITE_IDS[i]];
    const b = SITE_CELLS[SITE_IDS[i + 1]];
    assert.notEqual(key(a), key(b));
    assert.equal(areNeighbours(a, b), false, `Q${i + 1} ${SITE_IDS[i]} / Q${i + 2} ${SITE_IDS[i + 1]}`);
  }
});

test("RF-139: question order is neither the reading order nor the column order of the map (nor their reverse)", () => {
  const order = SITE_IDS.map((id) => SITE_CELLS[id]);
  const str = (cells) => JSON.stringify(cells.map((c) => [...c]));
  for (const sorted of [readingOrder(order), columnOrder(order)]) {
    assert.notEqual(str(order), str(sorted));
    assert.notEqual(str(order), str([...sorted].reverse()));
  }
});

test("RF-141: Fairground and Nightclub (long one-line names) have filler cells on their left and right", () => {
  const fillers = new Set(fillerCells().map(key));
  for (const id of ["fairground", "nightclub"]) {
    const [c, r] = SITE_CELLS[id];
    assert.ok(fillers.has(key([c - 1, r])), `${id} left`);
    assert.ok(fillers.has(key([c + 1, r])), `${id} right`);
  }
});

test("STREETS: inner street axes run through the middle of the gaps between cells", () => {
  assert.deepEqual(STREETS, { h: [76, 146, 216], v: [72, 136, 200, 264, 328] });
  assert.ok(Object.isFrozen(STREETS) && Object.isFrozen(STREETS.h) && Object.isFrozen(STREETS.v));
  STREETS.h.forEach((y, r) => assert.equal(y, cellBox(0, r).y + CELL_H + GAP / 2));
  STREETS.v.forEach((x, c) => assert.equal(x, cellBox(c, 0).x + CELL_W + GAP / 2));
  assert.equal(STREETS.h[1], CENTER.y);
  assert.equal(STREETS.v[2], CENTER.x);
});

test("lampPoints: at least 20 lamps, all on a street, outside every cell, inside the map, no duplicates (RF-140)", () => {
  const lamps = lampPoints();
  assert.ok(lamps.length >= 20);
  assert.equal(lamps.length, 53); // 18 on horizontal streets + 20 on vertical streets + 15 crossings
  const seen = new Set();
  for (const p of lamps) {
    assert.ok(STREETS.h.includes(p.y) || STREETS.v.includes(p.x), `${p.x},${p.y} not on a street`);
    assert.ok(p.x > 0 && p.x < VIEW_W && p.y > 0 && p.y < VIEW_H, `${p.x},${p.y} outside the map`);
    for (const [c, r] of allCells()) {
      const b = cellBox(c, r);
      const inCell = p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
      assert.equal(inCell, false, `${p.x},${p.y} inside cell ${c},${r}`);
    }
    seen.add(`${p.x},${p.y}`);
  }
  assert.equal(seen.size, lamps.length);
  // every inner crossing has a lamp
  for (const x of STREETS.v) for (const y of STREETS.h) assert.ok(seen.has(`${x},${y}`), `crossing ${x},${y}`);
  assert.notEqual(lampPoints(), lamps, "a new array each call");
});

test("waveDelayFraction: 0 at the centre, 1 at the corners, in [0, 1] and growing with the distance (RF-73)", () => {
  assert.equal(waveDelayFraction(CENTER.x, CENTER.y), 0);
  for (const [x, y] of [[0, 0], [400, 0], [0, 292], [400, 292]]) {
    assert.ok(Math.abs(waveDelayFraction(x, y) - 1) < 1e-12, `${x},${y}`);
  }
  const steps = [0, 20, 60, 120, 199].map((dx) => waveDelayFraction(CENTER.x + dx, CENTER.y));
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i] > steps[i - 1]);
  // same distance in any direction → same fraction
  assert.ok(Math.abs(waveDelayFraction(CENTER.x + 30, CENTER.y) - waveDelayFraction(CENTER.x, CENTER.y - 30)) < 1e-12);
  for (const p of lampPoints()) {
    const f = waveDelayFraction(p.x, p.y);
    assert.ok(f >= 0 && f <= 1);
  }
});

test("fillerBuildings(11): one entry per filler cell, 2 to 4 buildings inside the cell, each with a window inside it (RF-70)", () => {
  const blocks = fillerBuildings(11);
  assert.equal(blocks.length, 14);
  assert.deepEqual(blocks.map((b) => b.cell), fillerCells());
  let total = 0;
  for (const { cell, buildings } of blocks) {
    const box = cellBox(...cell);
    assert.ok(buildings.length >= 2 && buildings.length <= 4, `${key(cell)}: ${buildings.length}`);
    total += buildings.length;
    for (const b of buildings) {
      for (const k of ["x", "y", "w", "h"]) assert.ok(Number.isFinite(b[k]), `${key(cell)} ${k}`);
      assert.ok(b.w > 0 && b.h > 0);
      assert.ok(inside(b, box), `${key(cell)} building outside its cell`);
      assert.ok(inside(b.win, b), `${key(cell)} window outside its building`);
    }
    // buildings of one cell do not overlap
    for (let i = 0; i < buildings.length; i++) {
      for (let j = i + 1; j < buildings.length; j++) {
        const a = buildings[i];
        const o = buildings[j];
        const overlap = a.x < o.x + o.w && o.x < a.x + a.w && a.y < o.y + o.h && o.y < a.y + a.h;
        assert.equal(overlap, false, `${key(cell)} buildings ${i} / ${j}`);
      }
    }
  }
  assert.ok(total >= 28 && total <= 56);
});

test("fillerBuildings is fixed for a seed (same for every participant) and changes with the seed (RF-70)", () => {
  assert.deepEqual(fillerBuildings(11), fillerBuildings(11));
  assert.notDeepEqual(fillerBuildings(11), fillerBuildings(12));
  // still 2 to 4 per cell with other seeds
  for (const seed of [1, 7, 42, 2024, 2147483646]) {
    for (const { buildings } of fillerBuildings(seed)) {
      assert.ok(buildings.length >= 2 && buildings.length <= 4, `seed ${seed}`);
    }
  }
});

test("city-grid.js is pure: no document, window, fetch, Date, performance or Math.random (RNF-7)", () => {
  const src = readFileSync(new URL("../js/lib/city-grid.js", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  for (const banned of [/\bdocument\b/, /\bwindow\b/, /\bfetch\b/, /\bDate\b/, /\bperformance\b/, /Math\.random/]) {
    assert.doesNotMatch(src, banned);
  }
});
