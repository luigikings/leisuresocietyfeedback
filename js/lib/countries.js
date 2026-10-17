// Country tiles: the content countries in data order, with "Other" last. Pure module: no DOM, no network.
// RF-10, RF-11.
import { OTHER_CODE } from "./sites.js";

/** The "Other" entry, always the last tile (RF-11). It shows a globe icon instead of a flag. */
export const OTHER_ENTRY = Object.freeze({ code: OTHER_CODE, name: "Other" });

/**
 * Tiles to show in the country grid: the countries in the order of the data, then "Other".
 * Does not mutate the input.
 * @param {Array<{code: string, name: string}>} countries
 * @returns {Array<{code: string, name: string}>}
 */
export function countryTiles(countries) {
  return [...countries, OTHER_ENTRY];
}
