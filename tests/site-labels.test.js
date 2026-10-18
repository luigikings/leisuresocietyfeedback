import { test } from "node:test";
import assert from "node:assert/strict";
import { SITE_IDS, SITE_NAMES } from "../js/lib/sites.js";
import {
  SITE_LAYOUT,
  LABEL_FONT,
  LABEL_LINE,
  CHAR_WIDTH,
  labelBox,
  boxesOverlap,
  minLabelPx,
  labelLines,
} from "../js/lib/site-labels.js";

const inside = (inner, outer) =>
  inner.x >= outer.x && inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

const MAP = { x: 0, y: 0, w: 400, h: 300 };

test("SITE_LAYOUT has one entry per SITE_ID and nothing else, frozen", () => {
  assert.deepEqual(Object.keys(SITE_LAYOUT).sort(), [...SITE_IDS].sort());
  assert.ok(Object.isFrozen(SITE_LAYOUT));
  for (const id of SITE_IDS) {
    const { block, icon, label } = SITE_LAYOUT[id];
    for (const box of [block, icon]) {
      for (const k of ["x", "y", "w", "h"]) assert.equal(typeof box[k], "number", `${id} ${k}`);
      assert.ok(box.w > 0 && box.h > 0, id);
    }
    assert.equal(typeof label.x, "number");
    assert.equal(typeof label.y, "number");
    assert.ok(Object.isFrozen(label.lines), id);
  }
});

test("label lines joined with a space give the site's English name, in 1 or 2 lines (RF-112)", () => {
  for (const id of SITE_IDS) {
    const { lines } = SITE_LAYOUT[id].label;
    assert.ok(lines.length >= 1 && lines.length <= 2, id);
    assert.equal(lines.join(" "), SITE_NAMES[id], id);
  }
  assert.deepEqual(SITE_LAYOUT["concert-hall"].label.lines, ["Concert", "hall"]);
  assert.deepEqual(SITE_LAYOUT["town-square"].label.lines, ["Town", "square"]);
  assert.deepEqual(SITE_LAYOUT["food-market"].label.lines, ["Food", "market"]);
});

test("labels are at least 8 px tall on a 320 px screen, where the map is 288 px wide (RF-113)", () => {
  assert.equal(LABEL_FONT, 11.5);
  assert.ok(minLabelPx(288) >= 8);
  assert.equal(minLabelPx(400), LABEL_FONT);
  assert.ok(Math.abs(minLabelPx(288) - 8.28) < 1e-9);
});

test("labelBox is centred on label.x, starts at label.y and grows with the longest line and the line count", () => {
  const one = labelBox({ x: 100, y: 50, lines: ["Park"] });
  assert.equal(one.w, 4 * CHAR_WIDTH * LABEL_FONT + 4);
  assert.equal(one.x, 100 - one.w / 2);
  assert.equal(one.y, 50);
  const two = labelBox({ x: 100, y: 50, lines: ["Concert", "hall"] });
  assert.equal(two.w, 7 * CHAR_WIDTH * LABEL_FONT + 4);
  assert.ok(two.h > one.h);
  assert.ok(Math.abs(two.h - one.h - LABEL_FONT * LABEL_LINE) < 1e-9);
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

test("every icon fits in its block and every block, icon and label is inside the 400×300 map", () => {
  for (const id of SITE_IDS) {
    const { block, icon, label } = SITE_LAYOUT[id];
    assert.ok(inside(block, MAP), `${id} block`);
    assert.ok(inside(icon, block), `${id} icon in block`);
    assert.ok(inside(labelBox(label), MAP), `${id} label in map`);
  }
});

test("each label sits under its own icon (RF-112)", () => {
  for (const id of SITE_IDS) {
    const { icon, label } = SITE_LAYOUT[id];
    assert.ok(label.y >= icon.y + icon.h, id);
    const box = labelBox(label);
    assert.ok(box.x < icon.x + icon.w && box.x + box.w > icon.x, `${id} label under the icon horizontally`);
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

test("no label overlaps another site's icon or block (RF-113)", () => {
  for (const id of SITE_IDS) {
    const box = labelBox(SITE_LAYOUT[id].label);
    for (const other of SITE_IDS) {
      if (other === id) continue;
      assert.equal(boxesOverlap(box, SITE_LAYOUT[other].icon), false, `${id} label / ${other} icon`);
      assert.equal(boxesOverlap(box, SITE_LAYOUT[other].block), false, `${id} label / ${other} block`);
    }
  }
});

test("no two site blocks overlap", () => {
  for (let i = 0; i < SITE_IDS.length; i++) {
    for (let j = i + 1; j < SITE_IDS.length; j++) {
      assert.equal(
        boxesOverlap(SITE_LAYOUT[SITE_IDS[i]].block, SITE_LAYOUT[SITE_IDS[j]].block),
        false,
        `${SITE_IDS[i]} / ${SITE_IDS[j]}`,
      );
    }
  }
});

// --- T25: text lines of each label, as js/app/city.js draws them -----------------------------------

test("labelLines gives one centred line per label line, with its baseline inside the label box (RF-112, RF-113)", () => {
  for (const id of SITE_IDS) {
    const { label } = SITE_LAYOUT[id];
    const lines = labelLines(label);
    const box = labelBox(label);
    assert.deepEqual(lines.map((l) => l.text), [...label.lines], id);
    lines.forEach((line, i) => {
      assert.equal(line.x, label.x, `${id} line ${i} is not centred`);
      // glyphs: caps up to ~0.75 em above the baseline, descenders ~0.22 em below; both inside the box
      assert.ok(line.y - 0.75 * LABEL_FONT >= box.y, `${id} line ${i} sticks out at the top`);
      assert.ok(line.y + 0.22 * LABEL_FONT <= box.y + box.h, `${id} line ${i} sticks out at the bottom`);
      if (i > 0) assert.ok(Math.abs(line.y - lines[i - 1].y - LABEL_FONT * LABEL_LINE) < 1e-9, `${id} line spacing`);
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
