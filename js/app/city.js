// Night city: builds the generated parts of the grid map and paints the view computed by cityView()
// (js/lib/city-view.js). The fades are CSS.
import { SITE_LAYOUT, labelBox, labelLines } from "../lib/site-labels.js";
import * as cityGrid from "../lib/city-grid.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const round = (v) => Math.round(v * 100) / 100;

function svgEl(doc, tag, attrs) {
  const el = doc.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

function groupOf(svg, cls) {
  const group = svg.querySelector(`.${cls}`);
  if (!group) throw new Error(`the city SVG has no .${cls} group`);
  return group;
}

/** Warm tones of the lit filler buildings, as in the demo (one per building, in turn). */
const WARM = ["#ffd36e", "#ffe3a0", "#ffb86b", "#fff0c4", "#ffc978", "#ffd9a0", "#cfe0ff"];

/**
 * Builds the generated parts of the grid map from js/lib/city-grid.js (RF-69, RF-70, RF-140, plan §16.4):
 * - .city__streets: a dashed line on each inner street axis and the inner ring (.street);
 * - .city__fillers: per filler cell, <g class="filler" data-filler> with the cell's .filler__pad and, in a
 *   <g class="filler__lights">, the buildings of fillerBuildings(11) (.filler__b) with their window (.win).
 *   A third of the light groups carry data-twinkle and their own --tw offset for the living final (RF-115);
 * - .city__lamps: at every lampPoints() point, a dim .lamp-off in .lamps__off, always visible (RF-140, Anexo C),
 *   and over it the lit .lamp, in turn in .lamps__a and .lamps__b, that fades in with opacity (RF-115, RF-140).
 * Every street, building, window and lamp gets --fd = waveDelayFraction of its centre, for the wave (RF-73).
 * All of it is decorative: the groups are aria-hidden in the HTML. A second call rebuilds them.
 * @param {SVGElement} svg the #city SVG
 * @param {typeof cityGrid} grid
 */
export function mountCityGrid(svg, grid = cityGrid) {
  const streets = groupOf(svg, "city__streets");
  const fillers = groupOf(svg, "city__fillers");
  const lampsGroup = groupOf(svg, "city__lamps");
  const doc = svg.ownerDocument;
  const fd = (x, y) => `--fd:${Math.round(grid.waveDelayFraction(x, y) * 1000) / 1000}`;
  const { VIEW_W, VIEW_H, CENTER } = grid;

  const ring = svgEl(doc, "rect", { class: "street", x: 6, y: 5, width: VIEW_W - 12, height: VIEW_H - 10, rx: 8, style: fd(6, 5) });
  const hLines = grid.STREETS.h.map((y) =>
    svgEl(doc, "line", { class: "street", x1: 0, y1: y, x2: VIEW_W, y2: y, style: fd(CENTER.x, y) }));
  const vLines = grid.STREETS.v.map((x) =>
    svgEl(doc, "line", { class: "street", x1: x, y1: 0, x2: x, y2: VIEW_H, style: fd(x, CENTER.y) }));
  streets.replaceChildren(ring, ...hLines, ...vLines);

  let tone = 0;
  const blocks = grid.fillerBuildings(11).map(({ cell, buildings }, i) => {
    const box = grid.cellBox(...cell);
    const g = svgEl(doc, "g", { class: "filler", "data-filler": "" });
    const pad = svgEl(doc, "rect", { class: "filler__pad", x: box.x, y: box.y, width: box.w, height: box.h, rx: 3 });
    const lights = svgEl(doc, "g", { class: "filler__lights" });
    if (i % 3 === 1) {
      lights.setAttribute("data-twinkle", "");
      lights.setAttribute("style", `--tw:${round(((i - 1) / 3) * 0.7)}s`);
    }
    for (const b of buildings) {
      const style = fd(b.x + b.w / 2, b.y + b.h / 2);
      lights.append(
        svgEl(doc, "rect", {
          class: "filler__b", x: round(b.x), y: round(b.y), width: round(b.w), height: round(b.h), rx: 1.5,
          style: `${style};--wl:${WARM[tone++ % WARM.length]}`,
        }),
        svgEl(doc, "rect", { class: "win", x: round(b.win.x), y: round(b.win.y), width: round(b.win.w), height: round(b.win.h), style }),
      );
    }
    g.append(pad, lights);
    return g;
  });
  fillers.replaceChildren(...blocks);

  const off = svgEl(doc, "g", { class: "lamps__off" });
  const a = svgEl(doc, "g", { class: "lamps__a" });
  const b = svgEl(doc, "g", { class: "lamps__b" });
  grid.lampPoints().forEach((p, i) => {
    const cx = round(p.x);
    const cy = round(p.y);
    off.append(svgEl(doc, "circle", { class: "lamp-off", cx, cy, r: 1.4 }));
    (i % 2 === 0 ? a : b).append(svgEl(doc, "circle", { class: "lamp", cx, cy, r: 1.4, style: fd(p.x, p.y) }));
  });
  lampsGroup.replaceChildren(off, a, b);
}

/**
 * Builds one label per site in the SVG's <g class="city__labels"> (drawn over the cars, under the wave), from
 * SITE_LAYOUT: a dark translucent box and 1 or 2 centred lines, in the bottom band of the site's own cell.
 * Labels start off; paintCity lights them with .is-lit and the CSS fades them in (RF-112, RF-113). The group is
 * aria-hidden: the names are already in the SVG's aria-label (RF-75, RNF-4). Call it once, before the first
 * paint; a second call rebuilds them.
 * @param {SVGElement} svg the #city SVG
 * @param {Record<string, { label: { x: number, y: number, lines: readonly string[] } }>} layout
 */
export function mountCityLabels(svg, layout = SITE_LAYOUT) {
  const group = groupOf(svg, "city__labels");
  const doc = svg.ownerDocument;
  const labels = Object.entries(layout).map(([id, { label }]) => {
    const box = labelBox(label);
    const g = svgEl(doc, "g", { class: "site-label", "data-site-label": id });
    const bg = svgEl(doc, "rect", {
      class: "site-label__bg", x: round(box.x), y: round(box.y), width: round(box.w), height: round(box.h), rx: 3,
    });
    const text = svgEl(doc, "text", { class: "site-label__text" });
    for (const line of labelLines(label)) {
      const tspan = svgEl(doc, "tspan", { x: round(line.x), y: round(line.y) });
      tspan.textContent = line.text;
      text.append(tspan);
    }
    g.append(bg, text);
    return g;
  });
  group.replaceChildren(...labels);
}

/**
 * Lights exactly the sites in view.lit (RF-29), their halos (RF-133) and their labels (RF-112), marks the full
 * light-up with data-all-lit (RF-72, RF-73) and sets the screen-reader text (RF-75).
 * With instant (the first paint: a resume or a reopening, RF-112, RF-138) the SVG carries data-instant, which
 * turns the fades off, until the first frame with them is drawn, so halos and labels show at once.
 * @param {SVGElement} svg the #city SVG with one <g data-site> per leisure site
 * @param {{ lit: string[], allLit: boolean, label: string }} view
 * @param {{ instant?: boolean, raf?: (fn: () => void) => void }} [options]
 */
export function paintCity(svg, view, { instant = false, raf = globalThis.requestAnimationFrame } = {}) {
  if (instant) svg.setAttribute("data-instant", "");
  const lit = new Set(view.lit);
  for (const g of svg.querySelectorAll("[data-site]")) g.classList.toggle("is-lit", lit.has(g.dataset.site));
  for (const el of svg.querySelectorAll("[data-halo]")) el.classList.toggle("is-lit", lit.has(el.getAttribute("data-halo")));
  for (const g of svg.querySelectorAll("[data-site-label]")) {
    g.classList.toggle("is-lit", lit.has(g.getAttribute("data-site-label")));
  }
  svg.toggleAttribute("data-all-lit", view.allLit);
  svg.setAttribute("aria-label", view.label);
  // a rAF callback runs before its frame is styled, so the mark is removed in the callback of the next frame
  if (instant) raf(() => raf(() => svg.removeAttribute("data-instant")));
}
