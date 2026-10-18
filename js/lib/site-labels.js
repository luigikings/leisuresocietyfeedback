// Where each leisure site is drawn on the city map and where its name label goes (RF-112, RF-113).
// Pure module: no DOM, no network. All measures are in viewBox units (viewBox 0 0 400 300).
// js/app/city.js builds the labels from SITE_LAYOUT, so the overlap tests check what is painted.
import { SITE_IDS } from "./sites.js";

/** Label font size: 11.5 × 288 / 400 = 8.3 px on a 320 px screen, where the map is 288 px wide (RF-113). */
export const LABEL_FONT = 11.5;
/** Line height, as a multiple of LABEL_FONT. */
export const LABEL_LINE = 1.15;
/** Estimated average width of a bold character, in em (conservative). */
export const CHAR_WIDTH = 0.62;
/** Horizontal and vertical padding of the label background, in total (2 + 2 and 1 + 1). */
const PAD_X = 4;
const PAD_Y = 2;

const box = (x, y, w, h) => Object.freeze({ x, y, w, h });
const label = (x, y, lines) => Object.freeze({ x, y, lines: Object.freeze(lines) });

/**
 * Per site: block = the city block it stands on; icon = the box the drawn icon must fit in (reduced and
 * moved up inside the block); label = { x: centre, y: top of the label box, lines }. Each label goes under
 * its icon, at the bottom of its block or, when it does not fit, over the street below (never over a
 * block with another site). Wide one-line labels may spill over the side street next to a filler block.
 */
export const SITE_LAYOUT = Object.freeze({
  park: Object.freeze({ block: box(3, 3, 69, 64), icon: box(13, 5, 49, 45), label: label(37.5, 51, ["Park"]) }),
  "concert-hall": Object.freeze({
    block: box(168, 3, 64, 64), icon: box(174, 5, 52, 41), label: label(200, 47, ["Concert", "hall"]),
  }),
  museum: Object.freeze({ block: box(328, 3, 69, 64), icon: box(340, 5, 45, 45), label: label(362.5, 51, ["Museum"]) }),
  theatre: Object.freeze({ block: box(88, 83, 64, 59), icon: box(97, 85, 46, 40), label: label(120, 126, ["Theatre"]) }),
  cinema: Object.freeze({ block: box(248, 83, 64, 59), icon: box(257, 87, 46, 36), label: label(280, 126, ["Cinema"]) }),
  fairground: Object.freeze({
    block: box(3, 158, 69, 59), icon: box(8, 160, 59, 40), label: label(40, 201, ["Fairground"]),
  }),
  "town-square": Object.freeze({
    block: box(168, 158, 64, 59), icon: box(180, 160, 40, 39), label: label(200, 200, ["Town", "square"]),
  }),
  "food-market": Object.freeze({
    block: box(328, 158, 69, 59), icon: box(340, 160, 45, 39), label: label(362.5, 200, ["Food", "market"]),
  }),
  nightclub: Object.freeze({
    block: box(88, 233, 64, 64), icon: box(99, 236, 42, 44), label: label(120, 281, ["Nightclub"]),
  }),
  stadium: Object.freeze({ block: box(248, 233, 64, 64), icon: box(254, 236, 52, 44), label: label(280, 281, ["Stadium"]) }),
});

// Keep SITE_LAYOUT in step with SITE_IDS (a missing site would be caught at import time, not only in tests).
for (const id of SITE_IDS) if (!SITE_LAYOUT[id]) throw new Error(`SITE_LAYOUT is missing "${id}"`);

/**
 * Box taken by a label and its background: centred on label.x, starting at label.y.
 * width = longest line × CHAR_WIDTH × LABEL_FONT + 4; height = lines × LABEL_FONT × LABEL_LINE + 2.
 * @param {{ x: number, y: number, lines: readonly string[] }} lbl
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function labelBox(lbl) {
  const longest = Math.max(...lbl.lines.map((line) => line.length));
  const w = longest * CHAR_WIDTH * LABEL_FONT + PAD_X;
  const h = lbl.lines.length * LABEL_FONT * LABEL_LINE + PAD_Y;
  return { x: lbl.x - w / 2, y: lbl.y, w, h };
}

/** Whether two boxes overlap. Boxes that only touch at an edge do not. */
export function boxesOverlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Label font size in CSS px when the 400-unit-wide map is drawn mapWidthPx wide (RF-113). */
export function minLabelPx(mapWidthPx) {
  return (LABEL_FONT * mapWidthPx) / 400;
}

/** Baseline of the first line below its line-box top, in em: chosen so the capitals sit centred in the box. */
const BASELINE = 0.82;

/**
 * Text lines of a label as js/app/city.js draws them (text-anchor: middle): centred on label.x, one line
 * every LABEL_FONT × LABEL_LINE, with the baseline placed so the glyphs sit in the middle of each line box.
 * @param {{ x: number, y: number, lines: readonly string[] }} lbl
 * @returns {{ text: string, x: number, y: number }[]} new objects
 */
export function labelLines(lbl) {
  const top = lbl.y + PAD_Y / 2;
  return lbl.lines.map((text, i) => ({ text, x: lbl.x, y: top + (i + BASELINE) * LABEL_FONT * LABEL_LINE }));
}
