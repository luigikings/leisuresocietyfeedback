// Geometry of the city map: a 6×4 grid of cells, as in the reference demo (RF-69, RF-70, RF-73, RF-139 to RF-141).
// Pure module: no DOM, no network, no clock and no Math.random. All measures are in viewBox units (0 0 400 292).
// js/app/city.js draws streets, filler blocks and lamps from here, so the tests check what is painted.
import { SITE_IDS } from "./sites.js";

export const COLS = 6;
export const ROWS = 4;
export const CELL_W = 56;
export const CELL_H = 62;
export const GAP = 8;
export const MARGIN_X = 12;
export const MARGIN_Y = 10;
export const VIEW_W = 400;
export const VIEW_H = 292;
export const CENTER = Object.freeze({ x: 200, y: 146 });

/** Box of the cell in column `col`, row `row` (0-based, from the top left). */
export function cellBox(col, row) {
  return { x: MARGIN_X + col * (CELL_W + GAP), y: MARGIN_Y + row * (CELL_H + GAP), w: CELL_W, h: CELL_H };
}

const cell = (col, row) => Object.freeze([col, row]);

/**
 * [column, row] of each leisure site (proposal 29). In question order (Q1 → Q10) no two consecutive sites
 * are in the same or neighbouring cells and the order follows neither rows nor columns (RF-139).
 * Fairground and Nightclub have filler cells on both sides, where their long labels may spill (RF-141).
 */
export const SITE_CELLS = Object.freeze({
  park: cell(1, 2),
  "concert-hall": cell(4, 0),
  museum: cell(0, 0),
  theatre: cell(3, 3),
  cinema: cell(5, 1),
  fairground: cell(3, 2),
  "town-square": cell(2, 0),
  "food-market": cell(5, 3),
  nightclub: cell(3, 1),
  stadium: cell(0, 1),
});

for (const id of SITE_IDS) if (!SITE_CELLS[id]) throw new Error(`SITE_CELLS is missing "${id}"`);

const isSiteCell = (col, row) => SITE_IDS.some((id) => SITE_CELLS[id][0] === col && SITE_CELLS[id][1] === row);

/** The 14 cells without a site, in reading order (rows top to bottom, each left to right). New arrays. */
export function fillerCells() {
  const out = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) if (!isSiteCell(col, row)) out.push([col, row]);
  }
  return out;
}

/** Whether two different cells touch, also diagonally. */
export function areNeighbours(a, b) {
  const dc = Math.abs(a[0] - b[0]);
  const dr = Math.abs(a[1] - b[1]);
  return dc <= 1 && dr <= 1 && (dc > 0 || dr > 0);
}

/** A copy of the cells sorted in reading order: by row, then by column. */
export function readingOrder(cells) {
  return [...cells].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/** A copy of the cells sorted by column, then by row. */
export function columnOrder(cells) {
  return [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** Axes of the inner streets: h = y of the horizontal ones, v = x of the vertical ones (middle of each gap). */
export const STREETS = Object.freeze({
  h: Object.freeze(Array.from({ length: ROWS - 1 }, (_, r) => MARGIN_Y + r * (CELL_H + GAP) + CELL_H + GAP / 2)),
  v: Object.freeze(Array.from({ length: COLS - 1 }, (_, c) => MARGIN_X + c * (CELL_W + GAP) + CELL_W + GAP / 2)),
});

/**
 * Street lamps (RF-140), as in the demo: in the middle of each block side along an inner street and at every
 * inner crossing. 18 + 20 + 15 = 53 points. New objects on each call.
 * @returns {{ x: number, y: number }[]}
 */
export function lampPoints() {
  const out = [];
  for (const y of STREETS.h) for (let c = 0; c < COLS; c++) out.push({ x: cellBox(c, 0).x + CELL_W / 2, y });
  for (const x of STREETS.v) {
    for (let r = 0; r < ROWS; r++) out.push({ x, y: cellBox(0, r).y + CELL_H / 2 });
    for (const y of STREETS.h) out.push({ x, y });
  }
  return out;
}

const MAX_DIST = Math.hypot(Math.max(CENTER.x, VIEW_W - CENTER.x), Math.max(CENTER.y, VIEW_H - CENTER.y));

/** Wave delay of a point as a fraction (RF-73): distance to CENTER / distance from CENTER to a corner, in [0, 1]. */
export function waveDelayFraction(x, y) {
  return Math.min(1, Math.hypot(x - CENTER.x, y - CENTER.y) / MAX_DIST);
}

/** Park–Miller pseudo-random generator, as in the demo: values in (0, 1), fixed for a seed. */
function parkMiller(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Filler buildings of each filler cell (RF-70), as in the demo: a 2×2 layout of slots (26 × 29 apart), each
 * with one building of 15-24 × 17-27 placed at random inside its slot and one window (38 % × 30 % of it).
 * A slot may stay empty (8 %), but never more than 2 per cell, so each cell has 2 to 4 buildings.
 * Fixed for a seed, so every participant sees the same city. New objects on each call.
 * @param {number} seed
 * @returns {{ cell: number[], buildings: { x: number, y: number, w: number, h: number,
 *   win: { x: number, y: number, w: number, h: number } }[] }[]}
 */
export function fillerBuildings(seed) {
  const rnd = parkMiller(seed);
  return fillerCells().map((fc) => {
    const box = cellBox(...fc);
    const buildings = [];
    let empty = 0;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        if (rnd() < 0.08 && empty < 2) {
          empty++;
          continue;
        }
        const w = 15 + rnd() * 9;
        const h = 17 + rnd() * 10;
        const x = box.x + 3 + c * 26 + rnd() * (24 - w);
        const y = box.y + 3 + r * 29 + rnd() * (27 - h);
        const ww = w * 0.38;
        const wh = h * 0.3;
        const win = { x: x + rnd() * (w - ww), y: y + rnd() * (h - wh), w: ww, h: wh };
        buildings.push({ x, y, w, h, win });
      }
    }
    return { cell: fc, buildings };
  });
}
