// js/lib/site-labels.js (rebuilt in T29): each site's cell, icon band and label inside the 6×4 grid.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SITE_IDS, SITE_NAMES } from "../js/lib/sites.js";
import { SITE_CELLS, cellBox, CELL_H, VIEW_W, VIEW_H } from "../js/lib/city-grid.js";
import {
  SITE_LAYOUT,
  LABEL_FONT,
  LABEL_LINE,
  CHAR_WIDTH,
  labelBox,
  boxesOverlap,
  minLabelPx,
  labelLines,
  labelSpill,
} from "../js/lib/site-labels.js";

const inside = (inner, outer) =>
  inner.x >= outer.x - 1e-9 && inner.y >= outer.y - 1e-9 &&
  inner.x + inner.w <= outer.x + outer.w + 1e-9 && inner.y + inner.h <= outer.y + outer.h + 1e-9;

const MAP = { x: 0, y: 0, w: VIEW_W, h: VIEW_H };
const near = (a, b) => Math.abs(a - b) < 1e-9;

test("SITE_LAYOUT has one frozen entry per SITE_ID, built from its grid cell", () => {
  assert.deepEqual(Object.keys(SITE_LAYOUT).sort(), [...SITE_IDS].sort());
  assert.ok(Object.isFrozen(SITE_LAYOUT));
  for (const id of SITE_IDS) {
    const entry = SITE_LAYOUT[id];
    assert.ok(Object.isFrozen(entry) && Object.isFrozen(entry.cell) && Object.isFrozen(entry.icon), id);
    assert.ok(Object.isFrozen(entry.label) && Object.isFrozen(entry.label.lines), id);
    assert.deepEqual({ ...entry.cell }, cellBox(...SITE_CELLS[id]), id);
  }
});

test("label lines joined with a space give the site's English name, in 1 or 2 lines (RF-112, RF-113)", () => {
  for (const id of SITE_IDS) {
    const { lines } = SITE_LAYOUT[id].label;
    assert.ok(lines.length >= 1 && lines.length <= 2, id);
    assert.equal(lines.join(" "), SITE_NAMES[id], id);
  }
  assert.deepEqual(SITE_LAYOUT["concert-hall"].label.lines, ["Concert", "hall"]);
  assert.deepEqual(SITE_LAYOUT["town-square"].label.lines, ["Town", "square"]);
  assert.deepEqual(SITE_LAYOUT["food-market"].label.lines, ["Food", "market"]);
  assert.deepEqual(SITE_LAYOUT.fairground.label.lines, ["Fairground"]);
  assert.deepEqual(SITE_LAYOUT.nightclub.label.lines, ["Nightclub"]);
});

test("labels are at least 8 px tall on a 320 px screen, where the map is 288 px wide (RF-113)", () => {
  assert.equal(LABEL_FONT, 11.5);
  assert.equal(CHAR_WIDTH, 0.62);
  assert.ok(minLabelPx(288) >= 8);
  assert.equal(minLabelPx(400), LABEL_FONT);
  assert.ok(near(minLabelPx(288), 8.28));
});

test("the icon band is the top of the cell, at least 55 % of its height (RF-141)", () => {
  for (const id of SITE_IDS) {
    const { cell, icon } = SITE_LAYOUT[id];
    assert.ok(inside(icon, cell), `${id} icon in its cell`);
    assert.ok(icon.h >= 0.55 * CELL_H, `${id} icon ${icon.h} < 55 %`);
    assert.equal(icon.x, cell.x);
    assert.equal(icon.w, cell.w);
    assert.equal(icon.y, cell.y + 2);
    assert.equal(icon.h, 38);
  }
});

test("each label is centred on its cell and, vertically, inside its bottom band, 1 unit above the bottom (RF-112, RF-141)", () => {
  for (const id of SITE_IDS) {
    const { cell, label } = SITE_LAYOUT[id];
    const box = labelBox(label);
    assert.ok(near(label.x, cell.x + cell.w / 2), `${id} centred`);
    assert.ok(box.y >= cell.y && near(box.y + box.h, cell.y + CELL_H - 1), `${id} vertical`);
    assert.ok(box.y > SITE_LAYOUT[id].icon.y, `${id} label below the top of the icon band`);
  }
});

test("labelBox is centred on label.x, starts at label.y and grows with the longest line and the line count", () => {
  const one = labelBox({ x: 100, y: 50, lines: ["Park"] });
  assert.equal(one.w, 4 * CHAR_WIDTH * LABEL_FONT + 4);
  assert.equal(one.x, 100 - one.w / 2);
  assert.equal(one.y, 50);
  const two = labelBox({ x: 100, y: 50, lines: ["Concert", "hall"] });
  assert.equal(two.w, 7 * CHAR_WIDTH * LABEL_FONT + 4);
  assert.ok(near(two.h - one.h, LABEL_FONT * LABEL_LINE));
});

test("boxesOverlap: overlapping, touching, apart and contained boxes", () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };
  assert.equal(boxesOverlap(a, { x: 5, y: 5, w: 10, h: 10 }), true);
  assert.equal(boxesOverlap(a, { x: 2, y: 2, w: 2, h: 2 }), true);
  assert.equal(boxesOverlap(a, { x: 10, y: 0, w: 5, h: 5 }), false); // touching edges
  assert.equal(boxesOverlap(a, { x: 0, y: 10, w: 5, h: 5 }), false);
  assert.equal(boxesOverlap(a, { x: 20, y: 20, w: 5, h: 5 }), false);
  assert.equal(boxesOverlap({ x: 5, y: 5, w: 10, h: 10 }, a), true);
});

test("labelSpill: how far each label sticks out of its cell on each side (RF-141)", () => {
  const fair = labelSpill("fairground");
  assert.ok(Math.abs(fair.left - 9.65) < 0.01 && Math.abs(fair.left - fair.right) < 1e-9, JSON.stringify(fair));
  const night = labelSpill("nightclub");
  assert.ok(Math.abs(night.left - 6.1) < 0.02 && Math.abs(night.left - night.right) < 1e-9, JSON.stringify(night));
  for (const id of SITE_IDS) {
    if (id === "fairground" || id === "nightclub") continue;
    assert.deepEqual(labelSpill(id), { left: 0, right: 0 }, id);
  }
});

test("every label is inside the 400×292 map (RF-113)", () => {
  for (const id of SITE_IDS) assert.ok(inside(labelBox(SITE_LAYOUT[id].label), MAP), id);
});

test("a label that spills sideways never touches another site's cell (RF-113, RF-141)", () => {
  for (const id of SITE_IDS) {
    const box = labelBox(SITE_LAYOUT[id].label);
    for (const other of SITE_IDS) {
      if (other === id) continue;
      assert.equal(boxesOverlap(box, SITE_LAYOUT[other].cell), false, `${id} label / ${other} cell`);
    }
  }
});

test("no two labels overlap (RF-113)", () => {
  for (let i = 0; i < SITE_IDS.length; i++) {
    for (let j = i + 1; j < SITE_IDS.length; j++) {
      const a = labelBox(SITE_LAYOUT[SITE_IDS[i]].label);
      const b = labelBox(SITE_LAYOUT[SITE_IDS[j]].label);
      assert.equal(boxesOverlap(a, b), false, `${SITE_IDS[i]} / ${SITE_IDS[j]}`);
    }
  }
});

test("labelLines gives one centred line per label line, with its baseline inside the label box (RF-112, RF-113)", () => {
  for (const id of SITE_IDS) {
    const { label } = SITE_LAYOUT[id];
    const lines = labelLines(label);
    const box = labelBox(label);
    assert.deepEqual(lines.map((l) => l.text), [...label.lines], id);
    lines.forEach((line, i) => {
      assert.equal(line.x, label.x, `${id} line ${i} is not centred`);
      assert.ok(line.y - 0.75 * LABEL_FONT >= box.y, `${id} line ${i} sticks out at the top`);
      assert.ok(line.y + 0.22 * LABEL_FONT <= box.y + box.h, `${id} line ${i} sticks out at the bottom`);
      if (i > 0) assert.ok(near(line.y - lines[i - 1].y, LABEL_FONT * LABEL_LINE), `${id} line spacing`);
    });
  }
});

test("labelLines returns new objects and does not change the layout", () => {
  const { label } = SITE_LAYOUT["concert-hall"];
  const a = labelLines(label);
  a[0].text = "x";
  assert.equal(labelLines(label)[0].text, "Concert");
  assert.equal(label.lines[0], "Concert");
});

test("site-labels.js is pure: no document, window, fetch, Date, performance or Math.random (RNF-7)", () => {
  const src = readFileSync(new URL("../js/lib/site-labels.js", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  for (const banned of [/\bdocument\b/, /\bwindow\b/, /\bfetch\b/, /\bDate\b/, /\bperformance\b/, /Math\.random/]) {
    assert.doesNotMatch(src, banned);
  }
});
