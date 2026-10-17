// What the night city shows: lit sites, full light-up and screen-reader text. Pure module: no DOM, no network.
import { SITE_IDS, SITE_NAMES } from "./sites.js";

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
