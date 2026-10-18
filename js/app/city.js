// Night city: paints the view computed by cityView() (js/lib/city-view.js). The fades are CSS.
import { SITE_LAYOUT, labelBox, labelLines } from "../lib/site-labels.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const round = (v) => Math.round(v * 100) / 100;

function svgEl(doc, tag, attrs) {
  const el = doc.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/**
 * Builds one label per site in the SVG's <g class="city__labels"> (drawn over the cars, under the wave), from
 * SITE_LAYOUT: a dark translucent box and 1 or 2 centred lines. Labels start off; paintCity lights them with
 * .is-lit and the CSS fades them in (RF-112, RF-113). The group is aria-hidden: the names are already in the
 * SVG's aria-label (RF-75, RNF-4). Call it once, before the first paint; a second call rebuilds them.
 * @param {SVGElement} svg the #city SVG
 * @param {Record<string, { label: { x: number, y: number, lines: readonly string[] } }>} layout
 */
export function mountCityLabels(svg, layout = SITE_LAYOUT) {
  const group = svg.querySelector(".city__labels");
  if (!group) throw new Error("the city SVG has no .city__labels group");
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
 * Lights exactly the sites in view.lit (RF-29) and their labels (RF-112), marks the full light-up with
 * data-all-lit (RF-72, RF-73) and sets the screen-reader text (RF-75).
 * @param {SVGElement} svg the #city SVG with one <g data-site> per leisure site
 * @param {{ lit: string[], allLit: boolean, label: string }} view
 */
export function paintCity(svg, view) {
  const lit = new Set(view.lit);
  for (const g of svg.querySelectorAll("[data-site]")) g.classList.toggle("is-lit", lit.has(g.dataset.site));
  for (const g of svg.querySelectorAll("[data-site-label]")) {
    g.classList.toggle("is-lit", lit.has(g.getAttribute("data-site-label")));
  }
  svg.toggleAttribute("data-all-lit", view.allLit);
  svg.setAttribute("aria-label", view.label);
}
