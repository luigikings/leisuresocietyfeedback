// What the night city shows: lit sites, full light-up and screen-reader text. Pure module: no DOM, no network.
import { SITE_IDS, SITE_NAMES } from "./sites.js";
import { SITE_CELLS, ROWS } from "./city-grid.js";

/**
 * @param {string[]} litIds ids of the lit sites (from litSites() in survey-state.js), in any order
 * @param {readonly string[]} siteIds all site ids, in question order
 * @param {Record<string, string>} names English name of each site
 * @returns {{ lit: string[], allLit: boolean, label: string }}
 *   lit: sites to light, in question order, without duplicates or unknown ids (RF-29);
 *   allLit: true only with every site lit, which lights fillers and streets (RF-72, RF-73);
 *   label: alternative text with the count and the names of the lit sites (RF-75).
 */
export function cityView(litIds, siteIds = SITE_IDS, names = SITE_NAMES) {
  const wanted = new Set(litIds);
  const lit = siteIds.filter((id) => wanted.has(id));
  const allLit = lit.length === siteIds.length;
  const count = `Night city: ${lit.length} of ${siteIds.length} places lit`;
  const label = lit.length === 0 ? count : `${count}: ${lit.map((id) => names[id]).join(", ")}`;
  return { lit, allLit, label };
}

/**
 * The same view without the full light-up. When "Next" on Q10 lights the stadium at once (RF-105), the
 * fillers, windows and streets wait for the final screen, so the light wave is what lights them (RF-73).
 * Returns a new object; the input is not changed.
 */
export function holdFullLight(view) {
  return { ...view, lit: [...view.lit], allLit: false };
}

/** How long the "Lit up" toast stays (RF-135), the ring lasts (RF-134) and the halo fades in (RF-133), in ms. */
export const TOAST_MS = 1500;
export const RING_MS = 1200;
export const HALO_FADE_MS = 900;

const NO_CELEBRATION = Object.freeze({ siteId: null, ring: false, toast: null });

/**
 * What to celebrate when the city is painted again (RF-134 to RF-138, RF-148).
 * - firstPaint (first paint, resume, reopening): nothing (RF-138);
 * - no site in nextLit that was not in prevLit (changed answer, Back): nothing (RF-138);
 * - toFinal (Next on Q10): the new site, without ring or toast (RF-148);
 * - otherwise: the new site with the ring and "Lit up: <name>" (RF-134, RF-135).
 * If several sites are new at once, the first one in nextLit order is used. The inputs are not changed.
 * @returns {{ siteId: string|null, ring: boolean, toast: string|null }}
 */
export function celebration(prevLit, nextLit, { firstPaint = false, toFinal = false } = {}, names = SITE_NAMES) {
  if (firstPaint) return { ...NO_CELEBRATION };
  const before = new Set(prevLit);
  const siteId = nextLit.find((id) => !before.has(id)) ?? null;
  if (siteId === null) return { ...NO_CELEBRATION };
  if (toFinal) return { siteId, ring: false, toast: null };
  return { siteId, ring: true, toast: `Lit up: ${names[siteId]}` };
}

/** Where the toast goes: "top" for a site in the bottom row of the grid, "bottom" otherwise (RF-137). */
export function toastPlacement(siteId, cells = SITE_CELLS) {
  const cell = cells[siteId];
  return cell && cell[1] === ROWS - 1 ? "top" : "bottom";
}
