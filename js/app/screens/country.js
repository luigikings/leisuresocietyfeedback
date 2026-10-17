// Country selection: a grid of square flag tiles in data order, "Other" (a globe) always last
// (RF-10, RF-11, RF-15, RF-16, RF-89 to RF-91). The tile list comes from js/lib/countries.js; this module
// only paints. No visible text: each tile's accessible name is its image alt (country name or "Other").
import { countryTiles } from "../../lib/countries.js";
import { OTHER_CODE, flagPath } from "../../lib/sites.js";

const OTHER_ICON = "assets/icons/other.svg";

function countryTile({ code, name }) {
  const li = document.createElement("li");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "country";
  btn.dataset.code = code;

  const img = document.createElement("img");
  img.className = code === OTHER_CODE ? "country__flag country__flag--other" : "country__flag";
  img.decoding = "async";
  img.loading = "lazy"; // the grid is built while hidden: do not compete with the intro on first load
  img.src = code === OTHER_CODE ? OTHER_ICON : flagPath(code);
  img.alt = code === OTHER_CODE ? "Other" : name;

  btn.append(img);
  li.append(btn);
  return li;
}

/**
 * @param {HTMLElement} section the #screen-country section
 * @param {{ countries: Array<{code, name}>, onChoose: (code: string) => void }} opts
 */
export function mountCountry(section, { countries, onChoose }) {
  const list = section.querySelector(".countries");
  list.replaceChildren(...countryTiles(countries).map(countryTile));
  list.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-code]");
    if (btn) onChoose(btn.dataset.code);
  });
}
