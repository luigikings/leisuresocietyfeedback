// Static checks of index.html and css/survey.css read as text (plan §14.8).
// T13: survey style (RF-17, RF-92 to RF-97). Later tasks add the intro, country, city and final checks.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

const CSS = read("css/survey.css").replace(/\/\*[\s\S]*?\*\//g, ""); // comments out: they may name what is gone
const HTML = read("index.html");
const QUESTION_JS = read("js/app/screens/question.js");

/** Innermost CSS rules as { selector, body } (rules inside @media are included). */
function cssRules(css) {
  const rules = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    rules.push({ selector: m[1].trim(), body: m[2] });
  }
  return rules;
}

/** Value of a custom property declared in :root. */
function rootVar(name) {
  const root = cssRules(CSS).find((r) => r.selector === ":root");
  const m = root?.body.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim().toLowerCase() : undefined;
}

// --- RF-95: sans-serif type, normal case --------------------------------------

test("CSS never turns text into all capitals (RF-95)", () => {
  assert.doesNotMatch(CSS, /uppercase/i);
});

test('CSS does not use "Arial Black" (RF-95)', () => {
  assert.doesNotMatch(CSS, /Arial Black/i);
});

test("the survey uses the system sans-serif stack (no web fonts)", () => {
  const body = cssRules(CSS).find((r) => r.selector === "body");
  assert.match(body.body, /font:[^;]*var\(--sans\)/);
  assert.match(rootVar("--sans"), /^system-ui,.*sans-serif$/);
  assert.doesNotMatch(CSS, /@font-face|@import/);
  assert.doesNotMatch(HTML, /fonts\.googleapis|fonts\.gstatic/);
});

// --- RF-93: no metallic gradients on options or buttons ------------------------

test("no linear-gradient on .option or .btn rules (RF-93)", () => {
  const offenders = cssRules(CSS).filter(
    (r) => /\.(option|btn)/.test(r.selector) && /linear-gradient/.test(r.body), // also .option__letter, .btn--*
  );
  assert.deepEqual(offenders.map((r) => r.selector), []);
});

// --- RF-94: night-city palette (plan §14.3) -------------------------------------

test("the palette tokens of plan §14.3 are declared in :root (RF-94)", () => {
  assert.deepEqual(
    {
      night: rootVar("--night"),
      street: rootVar("--street"),
      block: rootVar("--block"),
      line: rootVar("--line"),
      text: rootVar("--text"),
      muted: rootVar("--muted"),
      window: rootVar("--window"),
      neon: rootVar("--neon"),
    },
    {
      night: "#0b1026",
      street: "#141b3d",
      block: "#1c2550",
      line: "#8a94c7",
      text: "#f4f6ff",
      muted: "#b9c1e8",
      window: "#ffd36b",
      neon: "#ff5fd2",
    },
  );
});

test("the quiz tokens are gone: --blue, --blue-deep, --gold, --display (RF-93, RF-94)", () => {
  for (const name of ["--blue", "--blue-deep", "--gold", "--display"]) {
    assert.doesNotMatch(CSS, new RegExp(`${name}(?![\\w-])`), `${name} is still in the CSS`);
  }
});

test("focus ring uses the warm window light", () => {
  const focus = cssRules(CSS).find((r) => r.selector === ":focus-visible");
  assert.match(focus.body, /outline:\s*3px solid var\(--window\)/);
});

// --- RF-97: buttons --------------------------------------------------------------

test("buttons use .btn--primary, never .btn--gold (RF-97)", () => {
  assert.doesNotMatch(HTML, /btn--gold/);
  assert.doesNotMatch(CSS, /btn--gold/);
  assert.match(HTML, /class="btn btn--primary" data-action="next"/);
  assert.match(HTML, /class="btn btn--primary" data-action="start"/);
  assert.match(HTML, /class="btn btn--ghost" data-action="back"/);
});

test(".btn--primary is a flat warm pill with dark text (RF-97)", () => {
  const primary = cssRules(CSS).find((r) => r.selector === ".btn--primary");
  assert.ok(primary, ".btn--primary rule missing");
  assert.match(primary.body, /background:\s*var\(--window\)/);
  assert.match(primary.body, /color:\s*var\(--night\)/);
  assert.match(primary.body, /border-radius:\s*999px/);
});

// --- RF-96: chosen option is "lit" with a check mark ------------------------------

test("the chosen option has a warm border and a check that shows only when chosen (RF-96)", () => {
  const rules = cssRules(CSS);
  const chosen = rules.find((r) => r.selector === '.option[aria-checked="true"]');
  assert.match(chosen.body, /border-color:\s*var\(--window\)/);
  assert.match(chosen.body, /box-shadow:[^;]*var\(--window\)/);
  const checkOn = rules.find((r) => r.selector === '.option[aria-checked="true"] .option__check');
  assert.ok(checkOn, "no style showing the check on the chosen option");
});

test("question screen adds an aria-hidden SVG check to each option (RF-96)", () => {
  assert.match(QUESTION_JS, /option__check/);
  assert.match(QUESTION_JS, /createElementNS\(\s*SVG_NS/);
  assert.match(QUESTION_JS, /aria-hidden/);
});

// --- T14: country picker as a grid of square flags (RF-10, RF-11, RF-89 to RF-91) ---

const COUNTRY_JS = read("js/app/screens/country.js");
const MAIN_JS = read("js/app/main.js");

test("the country picker has no search box and no empty-result text (RF-90)", () => {
  assert.doesNotMatch(HTML, /country-search/);
  assert.doesNotMatch(HTML, /No countries found/);
  assert.doesNotMatch(HTML, /class="search"/);
  assert.doesNotMatch(HTML, /countries__empty/);
  assert.match(HTML, /<ul class="countries" aria-label="Countries"><\/ul>/);
});

test("country tiles have no visible name: the accessible name is the image alt (RF-10, RF-11, RF-89)", () => {
  assert.doesNotMatch(COUNTRY_JS, /country__name/);
  assert.doesNotMatch(COUNTRY_JS, /textContent/);
  assert.match(COUNTRY_JS, /\.alt\s*=\s*code === OTHER_CODE \? "Other" : name/);
});

test("the country grid has 3 columns of square tiles with cover-fit flags (RF-10, RF-91)", () => {
  const rules = cssRules(CSS);
  const list = rules.find((r) => r.selector === ".countries");
  assert.match(list.body, /display:\s*grid/);
  assert.match(list.body, /grid-template-columns:\s*repeat\(3,\s*1fr\)/);
  const tile = rules.find((r) => r.selector === ".country");
  assert.match(tile.body, /aspect-ratio:\s*1/);
  assert.match(tile.body, /overflow:\s*hidden/);
  const flag = rules.find((r) => r.selector === ".country__flag");
  assert.match(flag.body, /width:\s*100%/);
  assert.match(flag.body, /height:\s*100%/);
  assert.match(flag.body, /object-fit:\s*cover/);
  const other = rules.find((r) => /\.country__flag--other/.test(r.selector));
  assert.ok(other, "no rule for the Other globe");
  assert.match(other.body, /55%/);
  assert.doesNotMatch(CSS, /\.search|\.countries__empty|\.country__name/);
});

test("main.js marks the screen on #app and intro/country keep the title margin inside #app (RF-91)", () => {
  assert.match(MAIN_JS, /dataset\.screen\s*=\s*survey\.screen/);
  const rule = cssRules(CSS).find(
    (r) => r.selector.includes('[data-screen="intro"]') && r.selector.includes('[data-screen="country"]'),
  );
  assert.ok(rule, "no rule for intro/country");
  assert.match(rule.body, /display:\s*flow-root/);
  // the bottom room is the same 16 px + safe area on every screen now (plan §14.11)
  const app = cssRules(CSS).find((r) => r.selector === ".app");
  assert.match(app.body, /calc\(16px \+ env\(safe-area-inset-bottom\)\)/);
});

// --- T15: intro = stage of Annex B + two texts + "Give feedback" (RF-5 to RF-9, RF-80 to RF-85, RF-88) ---

const INTRO_JS = read("js/app/screens/intro.js");
const INTRO = HTML.match(/<section id="screen-intro"[\s\S]*?<\/section>/)?.[0] ?? "";
const PLATO_SVG = INTRO.match(/<svg[\s\S]*?<\/svg>/)?.[0] ?? "";
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
/** Text of every <text> element with the given class, tspans joined with a space. */
function svgTexts(svg, cls) {
  const out = [];
  for (const m of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    if (cls && !new RegExp(`class="([^"]* )?${cls}[ "]`).test(m[1])) continue;
    const parts = [...m[2].matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((t) => t[1].trim());
    out.push(decode(parts.length ? parts.join(" ") : m[2].trim()));
  }
  return out;
}

test("intro shows, in order, the hidden title, the stage, the two literal texts and the button (RF-80 to RF-82, RF-7)", () => {
  assert.ok(INTRO, "no #screen-intro section");
  const order = [
    /<h1 id="intro-title" class="visually-hidden" tabindex="-1" data-title>Leisure in Jeopardy<\/h1>/,
    /<div class="plato">/,
    /<p class="intro__thanks">Thank you for being part of our first event! We hope you enjoyed it as much as we did<\/p>/,
    /<p class="intro__ask">Do you want to help us with our new assignment\?<\/p>/,
    /<button type="button" class="btn btn--primary" data-action="start">Give feedback<\/button>/,
  ];
  let last = -1;
  for (const re of order) {
    const at = INTRO.search(re);
    assert.ok(at > last, `${re} missing or out of order`);
    last = at;
  }
});

test('there is no "Start" button any more (RF-7)', () => {
  assert.doesNotMatch(HTML, />\s*Start\s*</);
});

test("the stage is one decorative inline SVG, 300 x 400 (RF-83, RNF-4)", () => {
  assert.ok(PLATO_SVG, "no SVG in the intro");
  assert.match(PLATO_SVG, /^<svg[^>]*viewBox="0 0 300 400"/);
  assert.match(PLATO_SVG, /^<svg[^>]*aria-hidden="true"/);
  assert.match(PLATO_SVG, /^<svg[^>]*preserveAspectRatio="xMidYMid meet"/);
  assert.doesNotMatch(INTRO, /class="(stage|board|tile)[\s"_-]/);
});

test('the stage sign reads "Leisure in" / "Jeopardy" with 4 bulbs, under 4 spots (RF-83)', () => {
  assert.deepEqual(svgTexts(PLATO_SVG, "plato__sign-small"), ["Leisure in"]);
  assert.deepEqual(svgTexts(PLATO_SVG, "plato__sign-big"), ["Jeopardy"]);
  assert.equal((PLATO_SVG.match(/class="plato__bulb"/g) ?? []).length, 4);
  assert.equal((PLATO_SVG.match(/class="plato__spot"/g) ?? []).length, 4);
  assert.ok((PLATO_SVG.match(/class="plato__beam"/g) ?? []).length >= 4, "fewer than 4 light beams");
  assert.equal((PLATO_SVG.match(/class="plato__post"/g) ?? []).length, 2);
});

test("the board has the 5 headers and 13 values with Community-200 and Culture & identity-300 empty (RF-84)", () => {
  assert.deepEqual(svgTexts(PLATO_SVG, "plato__head"), [
    "Well-being",
    "Community",
    "Economy",
    "Culture & identity",
    "Access & inclusion",
  ]);
  assert.deepEqual(svgTexts(PLATO_SVG, "plato__value"), [
    "100", "100", "100", "100", "100",
    "200", "200", "200", "200",
    "300", "300", "300", "300",
  ]);
  const empties = [...PLATO_SVG.matchAll(/<rect\b[^>]*class="plato__empty"[^>]*>/g)].map((m) => m[0]);
  assert.equal(empties.length, 2);
  for (const e of empties) assert.match(e, /fill="#0B1035"/i);
  assert.match(PLATO_SVG, /data-cell="community-200"[^>]*class="plato__empty"|class="plato__empty"[^>]*data-cell="community-200"/);
  assert.match(PLATO_SVG, /data-cell="culture-300"[^>]*class="plato__empty"|class="plato__empty"[^>]*data-cell="culture-300"/);
});

test('"On air" sign and 3 podiums Group 1/300, Group 2/500, Group 3/200 with a red buzzer and 3 contestants each (RF-83, RF-85)', () => {
  assert.deepEqual(svgTexts(PLATO_SVG, "plato__onair-text"), ["On air"]);
  assert.deepEqual(svgTexts(PLATO_SVG, "plato__group"), ["Group 1", "Group 2", "Group 3"]);
  assert.deepEqual(svgTexts(PLATO_SVG, "plato__score"), ["300", "500", "200"]);
  const buzzers = [...PLATO_SVG.matchAll(/<circle\b[^>]*class="plato__buzzer"[^>]*>/g)];
  assert.equal(buzzers.length, 3);
  for (const b of buzzers) assert.match(b[0], /fill="#D93025"/i);
  assert.equal((PLATO_SVG.match(/class="plato__contestant"/g) ?? []).length, 9);
});

test("the stage has no logo, image or extra text (RF-6)", () => {
  assert.doesNotMatch(PLATO_SVG, /<image|<use|href=/);
  const all = svgTexts(PLATO_SVG).join("|");
  assert.equal(
    all,
    "Leisure in|Jeopardy|Well-being|Community|Economy|Culture & identity|Access & inclusion|" +
      "100|100|100|100|100|200|200|200|200|300|300|300|300|On air|Group 1|300|Group 2|500|Group 3|200",
  );
});

test("CSS: intro is a 100dvh flex column with a flexible stage, scroll allowed below 568 px (RF-88)", () => {
  const rules = cssRules(CSS);
  const intro = rules.find((r) => r.selector === ".screen--intro");
  assert.match(intro.body, /display:\s*flex/);
  assert.match(intro.body, /flex-direction:\s*column/);
  assert.match(intro.body, /height:\s*calc\(100dvh/);
  const plato = rules.find((r) => r.selector === ".plato");
  assert.match(plato.body, /min-height:\s*0/);
  assert.match(CSS, /@media \(max-height:\s*567px\)\s*\{[^@]*\.screen--intro\s*\{[^}]*height:\s*auto/);
  const hidden = rules.find((r) => r.selector === ".visually-hidden");
  assert.ok(hidden, "no .visually-hidden rule");
  assert.match(hidden.body, /position:\s*absolute/);
  assert.match(hidden.body, /clip/);
});

test("CSS: the old stage, board and tile styles are gone, and so is .intro--done (plan §14.4)", () => {
  assert.doesNotMatch(CSS, /\.(stage|board|tile)\b/);
  assert.doesNotMatch(CSS, /intro--done/);
  assert.doesNotMatch(CSS, /@keyframes (beam-left|beam-right|tile-in|title-pop)\b/);
});

test("intro.js only wires the button to onStart (RF-9)", () => {
  assert.match(INTRO_JS, /\[data-action=start\]/);
  assert.match(INTRO_JS, /onStart\(\)/);
  assert.doesNotMatch(INTRO_JS, /animationend|intro--done|reducedMotion/);
});

// --- T16: continuous loop, at most 3 flashes per second, static with reduced motion (RF-8, RF-86, RF-87) ---

/** Duration in ms of the first time token of an animation shorthand ("2.4s", "800ms"), or undefined. */
function firstTimeMs(value) {
  const m = value.match(/(?:^|\s)(\d*\.?\d+)(ms|s)\b/);
  if (!m) return undefined;
  return m[2] === "ms" ? Number(m[1]) : Number(m[1]) * 1000;
}

/** CSS rules (outside the reduced-motion block) whose selector mentions `.plato`. */
function platoRules() {
  const css = CSS.replace(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/, "");
  return cssRules(css).filter((r) => /\.plato/.test(r.selector));
}

test("every infinite animation in the CSS lasts at least 1 s (RF-86: at most 3 flashes per second)", () => {
  const decls = [...CSS.matchAll(/animation(?:-duration)?\s*:\s*([^;]+);/g)].map((m) => m[1]);
  const infinite = decls.filter((d) => /\binfinite\b/.test(d));
  assert.ok(infinite.length > 0, "no infinite animation at all");
  for (const d of infinite) {
    const ms = firstTimeMs(d);
    assert.ok(ms !== undefined && ms >= 1000, `infinite animation shorter than 1 s: "${d}"`);
  }
  // no separate iteration-count or duration override that could sneak a short loop in
  assert.doesNotMatch(CSS, /animation-iteration-count\s*:\s*infinite/);
  for (const r of platoRules()) {
    const dur = r.body.match(/animation-duration\s*:\s*([^;]+);/);
    if (dur) assert.ok(firstTimeMs(dur[1]) >= 1000, `${r.selector} shortens its loop to "${dur[1]}"`);
  }
});

test("the stage loops forever: beams, bulbs, spots, On air, buzzers and contestants (RF-8, plan §14.4)", () => {
  const rules = platoRules();
  for (const cls of ["beam", "bulb", "spot", "onair", "buzzer", "contestant"]) {
    const rule = rules.find(
      (r) => new RegExp(String.raw`\.plato__${cls}(?![\w-])`).test(r.selector) && /animation\s*:[^;]*\binfinite\b/.test(r.body),
    );
    assert.ok(rule, `.plato__${cls} has no infinite animation`);
    const name = rule.body.match(/animation\s*:\s*([\w-]+)/)[1];
    assert.match(CSS, new RegExp(String.raw`@keyframes ${name}\s*\{`), `missing @keyframes ${name}`);
  }
  // no end frame: no animation on the stage runs a fixed number of times or stays "forwards"
  for (const r of rules) {
    for (const m of r.body.matchAll(/animation\s*:\s*([^;]+);/g)) {
      assert.match(m[1], /\binfinite\b/, `${r.selector} has a finite animation "${m[1]}"`);
    }
  }
});

test("the stage animations are smooth opacity or small movements, never steps (RF-86)", () => {
  for (const r of platoRules()) {
    for (const m of r.body.matchAll(/animation\s*:\s*([^;]+);/g)) {
      assert.doesNotMatch(m[1], /steps\(|step-start|step-end/, `${r.selector} uses stepped timing`);
    }
  }
});

test("reduced motion stops every animation, so the stage is static and complete (RF-87, RNF-2)", () => {
  const block = CSS.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(block, "no reduced-motion block");
  assert.match(block[1], /\*,\s*\*::before,\s*\*::after\s*\{[^}]*animation:\s*none\s*!important/);
  // nothing on the stage is hidden at rest: the static frame shows every element
  for (const r of platoRules()) {
    assert.doesNotMatch(r.body, /(^|[^-])opacity\s*:\s*0\s*;|visibility\s*:\s*hidden|display\s*:\s*none/, `${r.selector} hides part of the stage`);
  }
});

// --- T17: city in plan view (RF-69 to RF-72, RF-76, RF-78, plan §14.6) ---------

const CITY_SVG = HTML.match(/<svg id="city"[\s\S]*?<\/svg>/)?.[0] ?? "";

test("the city is a 2D map: viewBox 0 0 400 300, no sky, moon, stars or skyline (RF-69)", () => {
  assert.ok(CITY_SVG, "no #city SVG");
  assert.match(CITY_SVG, /<svg id="city"[^>]*viewBox="0 0 400 300"/);
  for (const cls of ["city__sky", "city__moon", "city__stars", "city__skyline"]) {
    assert.ok(!HTML.includes(cls), `index.html still has ${cls}`);
    assert.ok(!CSS.includes(cls), `survey.css still has ${cls}`);
  }
  assert.match(CITY_SVG, /class="city__streets"[^>]*aria-hidden="true"/);
  assert.match(CITY_SVG, /class="city__blocks"[^>]*aria-hidden="true"/);
});

test("the city has between 15 and 25 filler buildings, each with --fx in 0-1 (RF-70)", () => {
  const fillers = [...CITY_SVG.matchAll(/<[^>]*\bdata-filler\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(fillers.length >= 15 && fillers.length <= 25, `found ${fillers.length} fillers`);
  for (const tag of fillers) {
    assert.match(tag, /class="filler"/, tag);
    const fx = tag.match(/--fx:\s*([\d.]+)/);
    assert.ok(fx, `filler without --fx: ${tag}`);
    assert.ok(Number(fx[1]) >= 0 && Number(fx[1]) <= 1, `--fx out of 0-1: ${tag}`);
  }
  // fillers are decorative: hidden from screen readers (RNF-4)
  assert.match(CITY_SVG, /class="city__fillers"[^>]*aria-hidden="true"/);
});

test("each leisure site is one <g class=\"site\"> with its own icon and no visible text (RF-71)", () => {
  const sites = [...CITY_SVG.matchAll(/<g class="site" data-site="([\w-]+)"/g)].map((m) => m[1]);
  assert.equal(sites.length, 10);
  assert.equal(new Set(sites).size, 10);
  assert.doesNotMatch(CITY_SVG, /<text\b/);
});

test("fillers, windows and street lamps are off unless the city is all lit (RF-72)", () => {
  const rules = cssRules(CSS);
  const selectors = (r) => r.selector.split(",").map((s) => s.trim());
  // off by default: a rule without data-all-lit gives .win and .lamp opacity 0
  for (const cls of ["win", "lamp"]) {
    const off = rules.find(
      (r) => selectors(r).some((s) => s.endsWith(`.${cls}`) && !s.includes("data-all-lit")) && /opacity\s*:\s*0\s*;/.test(r.body),
    );
    assert.ok(off, `.${cls} is not off by default`);
  }
  // every rule that turns them (or the fillers) on needs #city[data-all-lit]
  const on = rules.filter((r) => /\.(filler|win|lamp)\b/.test(r.selector) && /opacity\s*:\s*1\b/.test(r.body));
  assert.ok(on.length > 0, "no rule lights fillers, windows or lamps");
  for (const r of on) {
    for (const s of selectors(r)) assert.match(s, /\[data-all-lit\]/, `${s} lights the city without data-all-lit`);
  }
});

test("on questions the city is at most 40 % of the screen height and never zoomed (RF-76, RF-78)", () => {
  const wrap = cssRules(CSS).find((r) => /\[data-screen="question"\] \.city-wrap$/.test(r.selector));
  assert.ok(wrap, 'no [data-screen="question"] .city-wrap rule');
  assert.match(wrap.body, /height\s*:\s*min\(40dvh,/);
  assert.match(wrap.body, /overflow\s*:\s*hidden/);
  const svg = cssRules(CSS).find((r) => /\[data-screen="question"\] \.city$/.test(r.selector));
  assert.ok(svg, 'no [data-screen="question"] .city rule');
  assert.match(svg.body, /height\s*:\s*100%/);
  assert.match(svg.body, /max-width\s*:\s*100%/);
  assert.doesNotMatch(CITY_SVG.match(/<svg[^>]*>/)[0], /preserveAspectRatio="[^"]*slice/);
});

// --- T18: final with the light wave, cars, full-screen city and "Leisure for Society" ------------

const FINAL_JS = read("js/app/screens/final.js");

test('the final says "Leisure for Society" and "Thank you", never "Society of Leisure" (RF-53, RF-54)', () => {
  assert.match(HTML, /<h1 id="final-title"[^>]*>Leisure for Society<\/h1>/);
  assert.match(HTML, /<p class="final__thanks">Thank you<\/p>/);
  for (const [name, text] of [["index.html", HTML], ["css", CSS], ["screens/final.js", FINAL_JS]]) {
    assert.doesNotMatch(text, /Society of Leisure/, name);
  }
});

test("the final shows the whole city full screen, centred and never zoomed (RF-79)", () => {
  const wrap = cssRules(CSS).find((r) => /\[data-screen="final"\] \.city-wrap$/.test(r.selector));
  assert.ok(wrap, 'no [data-screen="final"] .city-wrap rule');
  assert.match(wrap.body, /position\s*:\s*fixed/);
  assert.match(wrap.body, /inset\s*:\s*0/);
  assert.match(wrap.body, /background\s*:\s*var\(--night\)/);
  const svg = cssRules(CSS).find((r) => /\[data-screen="final"\] \.city$/.test(r.selector));
  assert.ok(svg, 'no [data-screen="final"] .city rule');
  assert.match(svg.body, /width\s*:\s*100%/);
  assert.match(svg.body, /height\s*:\s*100%/);
  assert.doesNotMatch(CITY_SVG.match(/<svg[^>]*>/)[0], /preserveAspectRatio="[^"]*slice/);
});

test("flags and texts sit on a translucent night panel above the city (RF-79, RNF-4)", () => {
  const panel = cssRules(CSS).filter((r) => /\.screen--final/.test(r.selector) && /rgb\(11 16 38 \/ \.82\)/.test(r.body));
  assert.ok(panel.length > 0, "no .screen--final panel with rgb(11 16 38 / .82)");
  assert.ok(panel.some((r) => /border-radius\s*:\s*20px/.test(r.body)), "the panel has a 20 px radius");
  const screen = cssRules(CSS).find((r) => r.selector === ".screen--final");
  assert.match(screen.body, /z-index\s*:\s*1/);
});

test("while the final plays, the wave lights fillers, windows, lamps and streets as it passes (--fx) (RF-73)", () => {
  const play = cssRules(CSS).filter((r) => /\[data-final="play"\]/.test(r.selector) && /animation/.test(r.body));
  for (const cls of ["win", "lamp", "filler__roof", "street--v"]) {
    const rule = play.find((r) => r.selector.split(",").some((s) => s.trim().endsWith(`.${cls}`)));
    assert.ok(rule, `no play animation for .${cls}`);
    assert.match(rule.body, /var\(--fx\)/, `.${cls} is not delayed by its position`);
    assert.match(rule.body, /var\(--final-wave-start\)/);
    assert.match(rule.body, /var\(--final-wave-dur\)/);
    assert.match(rule.selector, /#city\[data-all-lit\]/);
  }
  // the vertical streets carry their position; the wave moves at a constant speed so the delays match it
  const vertical = [...CITY_SVG.matchAll(/<rect class="street street--v"[^>]*style="--fx:([\d.]+)"/g)];
  assert.equal(vertical.length, 4);
  for (const m of vertical) assert.ok(Number(m[1]) >= 0 && Number(m[1]) <= 1);
  const wave = cssRules(CSS).find((r) => /\[data-final="play"\] \.city__wave$/.test(r.selector));
  assert.match(wave.body, /animation\s*:\s*final-wave var\(--final-wave-dur\) linear/);
});

test("while the final plays the city has no transitions that would light it before the wave", () => {
  const rule = cssRules(CSS).find(
    (r) => /\[data-final="play"\]/.test(r.selector) && /\.win/.test(r.selector) && /transition\s*:\s*none/.test(r.body),
  );
  assert.ok(rule, "no transition: none for the city while playing");
});

// --- T19 decision (plan §14.11): the offline notice lives inside the page, never fixed (RF-49, RF-50) ---

/** Inner HTML of a <section id="…"> (sections are not nested in index.html). */
function sectionHtml(id) {
  const m = HTML.match(new RegExp(`<section id="${id}"[\\s\\S]*?</section>`));
  return m ? m[0] : "";
}

test("the offline notice is a status line inside the question and final screens only (RF-49, RNF-4)", () => {
  const notices = [...HTML.matchAll(/<[^>]*data-offline-notice[^>]*>/g)].map((m) => m[0]);
  assert.equal(notices.length, 2, "one notice in the question screen and one in the final panel");
  for (const tag of notices) {
    assert.match(tag, /class="offline-notice"/);
    assert.match(tag, /role="status"/);
    assert.match(tag, /aria-live="polite"/);
  }
  assert.doesNotMatch(HTML, /id="offline-notice"/, "the fixed notice outside <main> is gone");
  const question = sectionHtml("screen-question");
  assert.match(question, /actions--nav[\s\S]*data-offline-notice/, "question: right after Back/Next");
  const final = sectionHtml("screen-final");
  assert.match(final, /final__thanks[\s\S]*data-offline-notice/, 'final: under "Thank you", inside the panel');
  for (const id of ["screen-intro", "screen-country"]) {
    assert.doesNotMatch(sectionHtml(id), /data-offline-notice/, `no notice in ${id}`);
  }
});

test("main.js shows and hides every in-page notice (RF-49, RF-50)", () => {
  assert.match(MAIN_JS, /querySelectorAll\(\s*["']\[data-offline-notice\]["']\s*\)/);
  assert.doesNotMatch(MAIN_JS, /getElementById\(\s*["']offline-notice["']\s*\)/);
});

test("the notice is in the normal flow: no fixed position, no reserved bottom room, the panel does not move up", () => {
  for (const r of cssRules(CSS).filter((r) => /\.offline-notice/.test(r.selector))) {
    assert.doesNotMatch(r.body, /position\s*:\s*(fixed|absolute|sticky)/, `${r.selector} is not in the flow`);
    assert.doesNotMatch(r.body, /pointer-events/, `${r.selector} needs no pointer-events trick`);
  }
  assert.doesNotMatch(CSS, /body:has\(\.offline-notice/);
  assert.doesNotMatch(CSS, /84px/);
  const app = cssRules(CSS).find((r) => r.selector === ".app");
  assert.match(app.body, /padding:\s*0 16px calc\(16px \+ env\(safe-area-inset-bottom\)\)/);
  // in the final, the panel gives the notice line back from its own bottom space, so its top stays put
  const fin = cssRules(CSS).find((r) => /\.screen--final:has\(\.offline-notice\.is-visible\)/.test(r.selector));
  assert.ok(fin, "no compensation rule for the final panel with the notice");
  assert.match(fin.body, /bottom\s*:/);
  assert.match(fin.body, /padding-bottom\s*:/);
});
