// Night city: paints the view computed by cityView() (js/lib/city-view.js). The fades are CSS.

/**
 * Lights exactly the sites in view.lit (RF-29), marks the full light-up with data-all-lit (RF-72, RF-73)
 * and sets the screen-reader text (RF-75).
 * @param {SVGElement} svg the #city SVG with one <g data-site> per leisure site
 * @param {{ lit: string[], allLit: boolean, label: string }} view
 */
export function paintCity(svg, view) {
  const lit = new Set(view.lit);
  for (const g of svg.querySelectorAll("[data-site]")) g.classList.toggle("is-lit", lit.has(g.dataset.site));
  svg.toggleAttribute("data-all-lit", view.allLit);
  svg.setAttribute("aria-label", view.label);
}
