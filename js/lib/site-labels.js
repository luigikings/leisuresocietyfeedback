// Where each leisure site is drawn in its grid cell and where its name label goes (RF-112, RF-113, RF-141).
// Pure module: no DOM, no network. All measures are in viewBox units (viewBox 0 0 400 292).
// js/app/city.js builds the labels from SITE_LAYOUT, so the overlap tests check what is painted.
import { SITE_IDS, SITE_NAMES } from "./sites.js";
import { SITE_CELLS, cellBox, CELL_H, VIEW_W } from "./city-grid.js";

/** Label font size: 11.5 × 288 / 400 = 8.3 px on a 320 px screen, where the map is 288 px wide (RF-113). */
export const LABEL_FONT = 11.5;
/** Line height, as a multiple of LABEL_FONT. */
export const LABEL_LINE = 1.15;
/** Estimated average width of a bold character, in em (conservative). */
export const CHAR_WIDTH = 0.62;
/** Horizontal and vertical padding of the label background, in total (2 + 2 and 1 + 1). */
const PAD_X = 4;
const PAD_Y = 2;

const freezeBox = ({ x, y, w, h }) => Object.freeze({ x, y, w, h });

/** Top of the icon band inside the cell and its height: 2-40 of the 62-unit cell, ≥ 55 % (RF-141). */
const ICON_TOP = 2;
const ICON_H = 38;

/** Label lines of each site: two-word names go in two lines so they fit in the 56-unit cell (RF-113). */
const LINES = Object.freeze({
  "concert-hall": ["Concert", "hall"],
  "town-square": ["Town", "square"],
  "food-market": ["Food", "market"],
});

function layoutOf(id) {
  const cell = cellBox(...SITE_CELLS[id]);
  const lines = Object.freeze(LINES[id] ? [...LINES[id]] : [SITE_NAMES[id]]);
  const height = lines.length * LABEL_FONT * LABEL_LINE + PAD_Y;
  return Object.freeze({
    cell: freezeBox(cell),
    icon: freezeBox({ x: cell.x, y: cell.y + ICON_TOP, w: cell.w, h: ICON_H }),
    // bottom band of its own cell, 1 unit above the bottom; a 2-line label covers the low part of the icon,
    // and its dark background keeps the contrast (RF-112, RF-113, RF-141)
    label: Object.freeze({ x: cell.x + cell.w / 2, y: cell.y + CELL_H - height - 1, lines }),
  });
}

/**
 * Per site, from its grid cell (js/lib/city-grid.js): cell = the cell's box; icon = the top band the icon is
 * drawn in; label = { x: centre, y: top of the label box, lines }. A label wider than its cell spills
 * sideways over the street and the filler cells next to it, never over another site (RF-141).
 */
export const SITE_LAYOUT = Object.freeze(Object.fromEntries(SITE_IDS.map((id) => [id, layoutOf(id)])));

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
  return (LABEL_FONT * mapWidthPx) / VIEW_W;
}

/**
 * How far a site's label sticks out of its cell on the left and on the right (0 when it fits), RF-141.
 * @param {string} id
 * @returns {{ left: number, right: number }}
 */
export function labelSpill(id) {
  const { cell, label } = SITE_LAYOUT[id];
  const box = labelBox(label);
  return { left: Math.max(0, cell.x - box.x), right: Math.max(0, box.x + box.w - (cell.x + cell.w)) };
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
