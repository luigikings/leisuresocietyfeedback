// Leisure sites of the night city and reserved codes. Pure module: no DOM, no network.

/** The 10 leisure sites, in question order (Q1 → park … Q10 → stadium). */
export const SITE_IDS = Object.freeze([
  "park",
  "concert-hall",
  "museum",
  "theatre",
  "cinema",
  "fairground",
  "town-square",
  "food-market",
  "nightclub",
  "stadium",
]);

/** Reserved country code for "Other". It is not an ISO 3166-1 alpha-2 code. */
export const OTHER_CODE = "OTHER";

/** Site-relative path of a country's flag: assets/flags/<iso code in lowercase>.svg */
export function flagPath(code) {
  return `assets/flags/${String(code).toLowerCase()}.svg`;
}

/** English name of each leisure site, for the city's screen-reader text (RF-75). */
export const SITE_NAMES = Object.freeze({
  park: "Park",
  "concert-hall": "Concert hall",
  museum: "Museum",
  theatre: "Theatre",
  cinema: "Cinema",
  fairground: "Fairground",
  "town-square": "Town square",
  "food-market": "Food market",
  nightclub: "Nightclub",
  stadium: "Stadium",
});
