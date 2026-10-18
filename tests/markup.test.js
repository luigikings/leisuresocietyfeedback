// Static checks of index.html and css/survey.css read as text (plan §14.8).
// T13: survey style (RF-17, RF-92 to RF-97). Later tasks add the intro, country, city and final checks.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_LAYOUT } from "../js/lib/site-labels.js";

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
  // no end frame: no loop on the stage runs a fixed number of times or stays "forwards"
  // (the one-off entry lives on the .plato__enter groups, never on the looping children: plan §15.2)
  for (const r of rules.filter((r) => !/\.plato__enter/.test(r.selector))) {
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

// --- T22: intro entry, button highlight and hand-over to the loop (RF-7, RF-8, RF-87, RF-98 to RF-102, plan §15.2) ---

const STAGE_GROUPS = ["lights", "sign", "board", "onair", "floor", "people"]; // RF-98 order

/** Minimal SVG tree: { tag, attrs, children, parent } from the stage markup (no text nodes). */
function svgTree(svg) {
  const root = { tag: "#root", attrs: "", children: [], parent: null };
  let cur = root;
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
    const [, closing, tag, attrs, selfClosing] = m;
    if (closing) { cur = cur.parent; continue; }
    const node = { tag, attrs, children: [], parent: cur };
    cur.children.push(node);
    if (!selfClosing) cur = node;
  }
  return root;
}

function walk(node, fn) {
  for (const c of node.children) { fn(c); walk(c, fn); }
}

const hasClass = (node, cls) => new RegExp(`class="([^"]* )?${cls}( [^"]*)?"`).test(node.attrs);

/** The CSS rule (outside reduced motion) whose selector is exactly `selector`. */
function ruleFor(selector) {
  const css = CSS.replace(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/, "");
  return cssRules(css).find((r) => r.selector === selector);
}

function keyframesBody(name) {
  const m = CSS.match(new RegExp(String.raw`@keyframes ${name}\s*\{([\s\S]*?)\n\}`));
  return m?.[1];
}

test("the stage is grouped in 6 entry groups, in the order of RF-98, right under the svg (plan §15.2)", () => {
  const svg = svgTree(PLATO_SVG).children[0];
  assert.equal(svg.tag, "svg");
  const groups = svg.children.filter((n) => hasClass(n, "plato__enter"));
  assert.deepEqual(groups.map((g) => g.attrs.match(/data-enter="([^"]+)"/)?.[1]), STAGE_GROUPS);
  // the wall stays first and outside every group: it never fades in
  assert.equal(svg.children[0].tag, "rect");
  assert.match(svg.children[0].attrs, /width="300" height="400"/);
  assert.ok(!hasClass(svg.children[0], "plato__enter"));
  // only the wall is left outside the groups, so every drawn element enters
  assert.equal(svg.children.length, 1 + STAGE_GROUPS.length);
  // no group nested in another: each one animates on its own
  for (const g of groups) {
    walk(g, (n) => assert.ok(!hasClass(n, "plato__enter"), "nested .plato__enter"));
    // the group carries only the entry class: the loop classes stay on the children (RF-99)
    assert.match(g.attrs, /class="plato__enter"/);
  }
});

test("each entry group holds its own pieces of the stage (RF-98)", () => {
  const svg = svgTree(PLATO_SVG).children[0];
  const group = (id) => svg.children.find((n) => n.attrs.includes(`data-enter="${id}"`));
  const count = (id, pred) => { let n = 0; walk(group(id), (c) => { if (pred(c)) n++; }); return n; };
  assert.equal(count("lights", (c) => hasClass(c, "plato__beam")), 8);
  assert.equal(count("lights", (c) => hasClass(c, "plato__spot")), 4);
  assert.equal(count("lights", (c) => c.tag === "rect"), 1, "the rail");
  assert.equal(count("sign", (c) => hasClass(c, "plato__bulb")), 4);
  assert.equal(count("sign", (c) => /plato__sign-(small|big)/.test(c.attrs)), 2);
  assert.equal(count("board", (c) => hasClass(c, "plato__value")), 13);
  assert.equal(count("board", (c) => hasClass(c, "plato__head")), 5);
  assert.equal(count("onair", (c) => hasClass(c, "plato__post")), 2);
  assert.equal(count("onair", (c) => hasClass(c, "plato__onair")), 1);
  assert.equal(count("floor", (c) => c.tag === "ellipse"), 1);
  assert.equal(count("floor", (c) => c.tag === "rect"), 2, "floor and stage edge");
  assert.equal(count("people", (c) => hasClass(c, "plato__contestant")), 9);
  assert.equal(count("people", (c) => hasClass(c, "plato__buzzer")), 3);
});

test("the :nth-of-type and :nth-child offsets of the stage hit their own elements inside the groups", () => {
  const svg = svgTree(PLATO_SVG).children[0];
  const all = [];
  walk(svg, (n) => all.push(n));
  const selectors = cssRules(CSS).flatMap((r) => r.selector.split(",").map((s) => s.trim()));
  let checked = 0;
  for (const sel of selectors) {
    for (const m of sel.matchAll(/\.(plato__[\w-]+):(nth-of-type|nth-child)\((\d*n|\d+)\)/g)) {
      const [, cls, kind, arg] = m;
      const owners = all.filter((n) => hasClass(n, cls));
      assert.ok(owners.length > 0, `${sel}: no .${cls}`);
      const parents = new Set(owners.map((n) => n.parent));
      let hits = 0;
      for (const p of parents) {
        p.children.forEach((c) => {
          const pool = kind === "nth-child" ? p.children : p.children.filter((x) => x.tag === c.tag);
          const pos = pool.indexOf(c) + 1;
          const match = /n$/.test(arg) ? pos % (Number(arg.slice(0, -1)) || 1) === 0 : pos === Number(arg);
          if (match && hasClass(c, cls)) hits++;
        });
      }
      assert.ok(hits > 0, `${sel} matches no .${cls} inside its group`);
      checked++;
    }
  }
  assert.ok(checked >= 10, "the stage offsets were not found");
  // the 4 bulbs are now circles 1-4 of the sign group: no offset beyond 4
  for (const sel of selectors) {
    const m = sel.match(/\.plato__bulb:nth-of-type\((\d+)\)/);
    if (m) assert.ok(Number(m[1]) <= 4, `${sel} still counts the circles of the whole svg`);
  }
});

test("the entry variables in .screen--intro equal INTRO_ENTRY (RF-98, RF-100)", async () => {
  const { introEntryCssVars } = await import("../js/lib/intro-entry.js");
  const intro = ruleFor(".screen--intro");
  assert.ok(intro, "no .screen--intro rule");
  const expected = introEntryCssVars();
  assert.equal(Object.keys(expected).length, 18);
  for (const [name, value] of Object.entries(expected)) {
    const m = intro.body.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
    assert.ok(m, `${name} missing in .screen--intro`);
    assert.equal(m[1].trim(), value, name);
  }
});

test("each stage group and both texts play a finite entry with their own variables (RF-98, RF-102)", () => {
  const targets = [
    ...STAGE_GROUPS.map((id) => [id, `.plato__enter[data-enter="${id}"]`]),
    ["thanks", ".intro__thanks"],
    ["ask", ".intro__ask"],
  ];
  for (const [id, selector] of targets) {
    const rule = ruleFor(selector);
    assert.ok(rule, `no rule ${selector}`);
    const m = rule.body.match(/animation\s*:\s*([^;]+);/);
    assert.ok(m, `${selector} has no animation`);
    const value = m[1];
    assert.doesNotMatch(value, /\binfinite\b/, `${selector} entry must play once`);
    assert.match(value, /\bboth\b/, `${selector} entry must hold its first frame during the delay`);
    assert.match(value, new RegExp(String.raw`var\(--enter-${id}-dur\)[^,]*var\(--enter-${id}-start\)`), selector);
    const name = value.trim().split(/\s+/)[0];
    const frames = keyframesBody(name);
    assert.ok(frames, `missing @keyframes ${name}`);
    // only opacity and transform: nothing changes size, so no element pushes another (RF-102)
    for (const prop of frames.matchAll(/([a-z-]+)\s*:/g)) {
      assert.ok(["opacity", "transform"].includes(prop[1]), `@keyframes ${name} animates ${prop[1]}`);
    }
    assert.match(frames, /opacity\s*:\s*0\b/, `@keyframes ${name} does not fade in`);
  }
  // the lights only fade (they are the light itself)
  const lights = keyframesBody(ruleFor('.plato__enter[data-enter="lights"]').body.match(/animation\s*:\s*([\w-]+)/)[1]);
  assert.doesNotMatch(lights, /transform/);
});

test('"Give feedback" only gets a box-shadow highlight at the end and is never hidden or moved (RF-7, RF-100, RF-101)', () => {
  const rule = ruleFor(".screen--intro .btn");
  assert.ok(rule, "no .screen--intro .btn rule");
  const m = rule.body.match(/animation\s*:\s*([^;]+);/);
  assert.ok(m, "the button has no highlight");
  assert.match(m[1], /^intro-btn-glow\b/);
  assert.match(m[1], /var\(--enter-button-dur\)[^,]*var\(--enter-button-start\)/);
  assert.doesNotMatch(m[1], /\binfinite\b/);
  assert.doesNotMatch(rule.body, /opacity|visibility|transform|pointer-events/);
  const frames = keyframesBody("intro-btn-glow");
  assert.ok(frames, "missing @keyframes intro-btn-glow");
  const props = [...frames.matchAll(/([a-z-]+)\s*:/g)].map((p) => p[1]);
  assert.ok(props.length > 0);
  for (const p of props) assert.equal(p, "box-shadow", `@keyframes intro-btn-glow animates ${p}`);
  // the button is in the HTML, enabled, from the first paint
  assert.match(INTRO, /<button type="button" class="btn btn--primary" data-action="start">Give feedback<\/button>/);
});

test("the intro texts and button are visible at rest, so reduced motion shows them at once (RF-87)", () => {
  for (const sel of [".intro__thanks", ".intro__ask", ".screen--intro .btn", ".plato__enter"]) {
    for (const r of cssRules(CSS).filter((r) => r.selector.split(",").some((s) => s.trim().startsWith(sel)))) {
      assert.doesNotMatch(r.body, /(^|[^-])opacity\s*:\s*0\s*;|visibility\s*:\s*hidden|display\s*:\s*none/, `${r.selector} hides part of the intro`);
    }
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

// --- T18: final with the light wave, cars and "Leisure for Society" ------------

const FINAL_JS = read("js/app/screens/final.js");

test('the final says "Leisure for Society" and "Thank you", never "Society of Leisure" (RF-53, RF-54)', () => {
  assert.match(HTML, /<h1 id="final-title"[^>]*>Leisure for Society<\/h1>/);
  assert.match(HTML, /<p class="final__thanks">Thank you<\/p>/);
  for (const [name, text] of [["index.html", HTML], ["css", CSS], ["screens/final.js", FINAL_JS]]) {
    assert.doesNotMatch(text, /Society of Leisure/, name);
  }
});

// --- T26: the final shows the bounded map centred, with the panel below it in the flow (RF-79, plan §15.6) ---

test("the final is a flex column as tall as the screen: map on top, panel below (RF-79, plan §15.6)", () => {
  const app = cssRules(CSS).find((r) => r.selector === '.app[data-screen="final"]');
  assert.ok(app, 'no .app[data-screen="final"] rule');
  assert.match(app.body, /display\s*:\s*flex/);
  assert.match(app.body, /flex-direction\s*:\s*column/);
  assert.match(app.body, /gap\s*:\s*8px/);
  assert.match(app.body, /height\s*:\s*100dvh/);
  // the map comes before the panel in the page, so the column puts it on top
  assert.ok(HTML.indexOf('id="city-wrap"') < HTML.indexOf('id="screen-final"'));
});

test("the final shows the whole bounded map, centred, 8 px from the screen edges and never zoomed (RF-79)", () => {
  const wraps = cssRules(CSS).filter((r) => /\[data-screen="final"\] \.city-wrap$/.test(r.selector));
  assert.equal(wraps.length, 1, 'one [data-screen="final"] .city-wrap rule');
  const wrap = wraps[0];
  assert.doesNotMatch(wrap.body, /position\s*:\s*(fixed|absolute)/, "the map is not full screen any more");
  assert.doesNotMatch(wrap.body, /inset\s*:/);
  assert.match(wrap.body, /flex\s*:\s*1 1 auto/);
  assert.match(wrap.body, /min-height\s*:\s*0/);
  assert.match(wrap.body, /display\s*:\s*flex/);
  assert.match(wrap.body, /align-items\s*:\s*center/);
  assert.match(wrap.body, /justify-content\s*:\s*center/);
  // .app has 16 px of side padding: -8 px leaves the 8 px minimum of RF-79 to the screen edge
  assert.match(wrap.body, /margin\s*:\s*8px -8px 0/);
  const svg = cssRules(CSS).find((r) => /\[data-screen="final"\] \.city$/.test(r.selector));
  assert.ok(svg, 'no [data-screen="final"] .city rule');
  assert.match(svg.body, /height\s*:\s*100%/);
  assert.match(svg.body, /width\s*:\s*auto/);
  assert.match(svg.body, /max-width\s*:\s*100%/);
  assert.doesNotMatch(CITY_SVG.match(/<svg[^>]*>/)[0], /preserveAspectRatio="[^"]*slice/);
  const city = cssRules(CSS).find((r) => r.selector === ".city");
  assert.match(city.body, /overflow\s*:\s*hidden/);
});

test("flags and texts sit on a translucent night panel in the flow, under the map (RF-79, RNF-4)", () => {
  const panel = cssRules(CSS).filter((r) => /\.screen--final/.test(r.selector) && /rgb\(11 16 38 \/ \.82\)/.test(r.body));
  assert.ok(panel.length > 0, "no .screen--final panel with rgb(11 16 38 / .82)");
  assert.ok(panel.some((r) => /border-radius\s*:\s*20px/.test(r.body)), "the panel has a 20 px radius");
  const screen = cssRules(CSS).find((r) => r.selector === ".screen--final");
  assert.doesNotMatch(screen.body, /position\s*:\s*(fixed|absolute|sticky)/, "the panel is in the flow");
  assert.doesNotMatch(screen.body, /(bottom|left|right|inset)\s*:/);
  assert.match(screen.body, /flex\s*:\s*none/);
  assert.doesNotMatch(screen.body, /transform/, "a transform would pin the fixed confetti to the panel");
  assert.doesNotMatch(CSS, /\.screen--final:has\(/, "no compensation rule for the offline notice");
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

test("the notice is in the normal flow: no fixed position, no reserved bottom room, no panel compensation", () => {
  for (const r of cssRules(CSS).filter((r) => /\.offline-notice/.test(r.selector))) {
    assert.doesNotMatch(r.body, /position\s*:\s*(fixed|absolute|sticky)/, `${r.selector} is not in the flow`);
    assert.doesNotMatch(r.body, /pointer-events/, `${r.selector} needs no pointer-events trick`);
  }
  assert.doesNotMatch(CSS, /body:has\(\.offline-notice/);
  assert.doesNotMatch(CSS, /84px/);
  const app = cssRules(CSS).find((r) => r.selector === ".app");
  assert.match(app.body, /padding:\s*0 16px calc\(16px \+ env\(safe-area-inset-bottom\)\)/);
  // in the final the panel is in the flow (T26): the notice only makes the map a little smaller
  assert.doesNotMatch(CSS, /:has\(\.offline-notice/);
});

// --- T23: screen and question transitions with the input gate (RF-103 to RF-108, RNF-4, plan §15.3) ---

const FADE_JS = fs.existsSync(path.join(ROOT, "js/app/fade.js")) ? read("js/app/fade.js") : "";

test("the old screen-in fade is gone, also from reduced motion (RF-107, plan §15.3)", () => {
  assert.doesNotMatch(CSS, /screen-in/);
  for (const r of cssRules(CSS).filter((r) => r.selector.split(",").some((s) => s.trim() === ".screen"))) {
    assert.doesNotMatch(r.body, /animation/, ".screen still has an animation");
  }
});

test("the intro button highlight does not hold its last frame, so :hover still works (RF-100)", () => {
  const m = ruleFor(".screen--intro .btn").body.match(/animation\s*:\s*([^;]+);/);
  assert.doesNotMatch(m[1], /\b(both|forwards)\b/);
});

test("main.js plans every change with transition.js and gates every handler (RF-103, RF-106)", () => {
  assert.match(MAIN_JS, /import\s*\{[^}]*\bplanTransition\b[^}]*\}\s*from\s*["']\.\.\/lib\/transition\.js["']/);
  assert.match(MAIN_JS, /import\s*\{[^}]*\bgateAllows\b[^}]*\}\s*from\s*["']\.\.\/lib\/transition\.js["']/);
  assert.match(MAIN_JS, /import\s*\{[^}]*\bholdFullLight\b[^}]*\}\s*from\s*["']\.\.\/lib\/city-view\.js["']/);
  assert.match(MAIN_JS, /gateAllows\(\s*gate\s*,\s*performance\.now\(\)\s*\)/);
  // the system back and every screen handler go through act()
  assert.match(MAIN_JS, /createHistoryGuard\(\{\s*onBack:\s*\(\)\s*=>\s*act\(/);
  for (const name of ["onStart", "onChoose", "onSelect", "onText", "onNext", "onBack"]) {
    const re = new RegExp(String.raw`\b${name}(\s*:\s*\([^)]*\)\s*=>\s*act\(|\([^)]*\)\s*\{\s*act\()`);
    assert.match(MAIN_JS, re, `${name} is not wrapped in act()`);
  }
});

test("onNext saves right after update(), before any fade ends (RF-105)", () => {
  const onNext = MAIN_JS.match(/onNext\([^)]*\)\s*\{([\s\S]*?)\n  \},/)?.[1] ?? "";
  assert.match(onNext, /update\(result\.state\);[^\n]*\n\s*commit\(\);/);
});

test("fade.js fades with the Web Animations API, only opacity, and cancels when done (plan §15.3)", () => {
  assert.ok(FADE_JS, "missing js/app/fade.js");
  assert.match(FADE_JS, /export function fadeOut\b/);
  assert.match(FADE_JS, /export function fadeIn\b/);
  assert.match(FADE_JS, /\.animate\(/);
  assert.match(FADE_JS, /\.cancel\(\)/);
  const props = [...FADE_JS.matchAll(/\{\s*([a-zA-Z]+)\s*:\s*[01]\s*\}/g)].map((m) => m[1]);
  assert.ok(props.length >= 2);
  for (const p of props) assert.equal(p, "opacity");
  assert.match(MAIN_JS, /import\s*\{[^}]*\bfadeOut\b[^}]*\bfadeIn\b[^}]*\}\s*from\s*["']\.\/fade\.js["']/);
});

// --- T24: bounded map with a border, nature, water and 16 fillers with volume (RF-69, RF-70, RF-109 to RF-111, plan §15.4) ---

/**
 * Elements of the #city SVG in document order, each with its attributes, the classes of its open ancestors
 * and the sum of the translate() of itself and its ancestors (the city only uses translate()).
 */
function cityElements() {
  const out = [];
  const stack = [];
  const attrsOf = (s) => Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  const flagsOf = (s) => [...s.replace(/"[^"]*"/g, "").matchAll(/\s([\w:-]+)(?=\s|$)/g)].map((m) => m[1]);
  const shift = (a) => {
    const m = a.transform?.match(/^translate\(([-\d.]+)[ ,]+([-\d.]+)\)$/);
    return m ? [Number(m[1]), Number(m[2])] : [0, 0];
  };
  for (const m of CITY_SVG.matchAll(/<(\/?)([\w:-]+)([^>]*?)(\/?)>/g)) {
    const [, closing, tag, rest, selfClosing] = m;
    if (closing) {
      stack.pop();
      continue;
    }
    const attrs = attrsOf(rest);
    for (const flag of flagsOf(rest)) attrs[flag] = "";
    const parent = stack.at(-1) ?? { dx: 0, dy: 0, classes: [] };
    const [sx, sy] = shift(attrs);
    const el = { tag, attrs, dx: parent.dx + sx, dy: parent.dy + sy, classes: parent.classes, index: m.index };
    out.push(el);
    if (!selfClosing) stack.push({ dx: el.dx, dy: el.dy, classes: [...parent.classes, ...(attrs.class ?? "").split(/\s+/)] });
  }
  return out;
}

/** Bounding box of a rect, circle, ellipse or absolute path (x/y pairs only), in map units. */
function elBox(el) {
  const n = (k) => Number(el.attrs[k] ?? 0);
  if (el.tag === "rect") return { x: n("x") + el.dx, y: n("y") + el.dy, w: n("width"), h: n("height") };
  if (el.tag === "circle") return { x: n("cx") - n("r") + el.dx, y: n("cy") - n("r") + el.dy, w: 2 * n("r"), h: 2 * n("r") };
  if (el.tag === "ellipse") return { x: n("cx") - n("rx") + el.dx, y: n("cy") - n("ry") + el.dy, w: 2 * n("rx"), h: 2 * n("ry") };
  if (el.tag === "path") {
    const nums = (el.attrs.d.match(/-?[\d.]+/g) ?? []).map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0).map((v) => v + el.dx);
    const ys = nums.filter((_, i) => i % 2 === 1).map((v) => v + el.dy);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  return undefined;
}

const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a, b) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
const union = (a, b) => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};
const elHas = (el, cls) => (el.attrs.class ?? "").split(/\s+/).includes(cls);
const within = (el, cls) => el.classes.includes(cls);

const CITY_ELS = cityElements();
const SITE_BLOCKS = Object.values(SITE_LAYOUT).map((s) => s.block);
const BLOCKS = CITY_ELS.filter((el) => elHas(el, "block")).map(elBox);

/** Each filler group with its parts (descendants) and its roof. */
function fillerGroups() {
  const groups = [];
  let current;
  for (const el of CITY_ELS) {
    if (el.tag === "g" && "data-filler" in el.attrs) groups.push((current = { tag: el, parts: [] }));
    else if (current && within(el, "filler")) current.parts.push(el);
  }
  return groups.map((g) => {
    const part = (cls) => g.parts.filter((el) => elHas(el, cls));
    return { ...g, roof: part("filler__roof")[0], part };
  });
}

/** Each tree: crown box and the box of crown and shadow together. */
function trees() {
  const out = [];
  let current;
  for (const el of CITY_ELS) {
    if (el.tag === "g" && elHas(el, "tree")) out.push((current = { parts: [] }));
    else if (current && within(el, "tree")) current.parts.push(el);
  }
  return out.map((t) => {
    const crown = elBox(t.parts.find((el) => elHas(el, "tree__crown")));
    const shadowEl = t.parts.find((el) => elHas(el, "shadow"));
    const shadow = shadowEl && elBox(shadowEl);
    return { crown, all: shadow ? union(crown, shadow) : crown, hasShadow: !!shadow };
  });
}

test("the city map is bounded: nothing of streets, blocks, nature, fillers or cars outside 0-400 x 0-300 (RF-111)", () => {
  const groups = ["city__streets", "city__blocks", "city__nature", "city__fillers", "city__cars"];
  let checked = 0;
  for (const el of CITY_ELS) {
    if (!groups.some((g) => within(el, g))) continue;
    const b = elBox(el);
    if (!b) continue;
    checked += 1;
    assert.ok(
      b.x >= 0 && b.y >= 0 && b.x + b.w <= 400 && b.y + b.h <= 300,
      `${el.tag}.${el.attrs.class} is outside the map: ${JSON.stringify(b)}`,
    );
  }
  assert.ok(checked > 100, `only ${checked} shapes checked`);
  assert.match(CITY_SVG, /<rect class="city__ground" width="400" height="300"\/>/);
});

test("the map is clipped to a rounded 400 x 300 rect and has a visible border on top (RF-111)", () => {
  assert.match(CITY_SVG, /<clipPath id="map-clip"><rect width="400" height="300" rx="12"\/><\/clipPath>/);
  const open = CITY_SVG.indexOf('<g class="city__map" clip-path="url(#map-clip)">');
  assert.ok(open > 0, "no .city__map group with the clip");
  const border = CITY_SVG.indexOf('<rect class="city__border" x="1" y="1" width="398" height="298" rx="11"/>');
  assert.ok(border > open, "no .city__border after the map");
  const close = CITY_SVG.lastIndexOf("</g>", border);
  // the border is outside (on top of) the clipped map, and every drawing group is inside it, in the order of plan §15.4
  const map = CITY_ELS.find((el) => elHas(el, "city__map"));
  const borderEl = CITY_ELS.find((el) => elHas(el, "city__border"));
  assert.ok(!within(borderEl, "city__map"), "the border is clipped");
  const order = ["city__ground", "city__streets", "city__blocks", "city__nature", "city__fillers", 'class="site"', "city__cars", "city__wave"];
  let last = open;
  for (const cls of order) {
    const at = CITY_SVG.indexOf(cls, last);
    assert.ok(at > last && at < close, `${cls} is not inside .city__map in order`);
    last = at;
  }
  assert.ok(map);
  const rules = cssRules(CSS);
  const city = rules.find((r) => r.selector === ".city");
  assert.match(city.body, /overflow\s*:\s*hidden/);
  const borderCss = rules.find((r) => r.selector === ".city__border");
  assert.ok(borderCss, "no .city__border rule");
  assert.match(borderCss.body, /fill\s*:\s*none/);
  assert.match(borderCss.body, /stroke\s*:\s*var\(--line\)/);
  assert.match(borderCss.body, /stroke-opacity\s*:\s*\.6/);
  assert.match(borderCss.body, /stroke-width\s*:\s*2\b/);
});

test("16 fillers, each with a shadow, a two-tone roof, a ridge and its lights (RF-70, RF-109)", () => {
  const groups = fillerGroups();
  assert.equal(groups.length, 16);
  for (const g of groups) {
    const name = JSON.stringify(g.roof?.attrs);
    for (const cls of ["shadow", "filler__roof", "filler__face", "filler__ridge"]) {
      assert.equal(g.part(cls).length, 1, `filler ${name} needs one .${cls}`);
    }
    assert.ok(g.parts.some((el) => el.tag === "g" && elHas(el, "filler__lights")), `filler ${name} has no .filler__lights`);
    assert.ok(g.parts.some((el) => elHas(el, "win") && within(el, "filler__lights")), `filler ${name}: no .win in .filler__lights`);
    // the lit face is inside its roof, and the shadow is a copy of the roof
    const roof = elBox(g.roof);
    assert.ok(inside(elBox(g.part("filler__face")[0]), roof), `face outside the roof of ${name}`);
    const shadow = g.part("shadow")[0];
    for (const k of ["x", "y", "width", "height"]) assert.equal(shadow.attrs[k], g.roof.attrs[k], `shadow ${k} of ${name}`);
    // each filler stands inside a block with no site
    assert.ok(BLOCKS.some((b) => inside(roof, b)), `filler ${name} is not inside a block`);
    assert.ok(!SITE_BLOCKS.some((s) => overlap(s, roof)), `filler ${name} is on a site block`);
  }
});

test("every shadow in the city is moved by translate(2.5 3): one light direction, no filters (RF-109)", () => {
  const shadows = CITY_SVG.match(/<[^>]*class="shadow"[^>]*>/g) ?? [];
  assert.ok(shadows.length >= 16 + 12, `only ${shadows.length} shadows`);
  for (const tag of shadows) assert.match(tag, /transform="translate\(2\.5 3\)"/, tag);
  const rule = cssRules(CSS).find((r) => r.selector === ".shadow");
  assert.ok(rule, "no .shadow rule");
  assert.match(rule.body, /fill\s*:\s*#050816/);
  assert.match(rule.body, /opacity\s*:\s*\.45/);
  assert.doesNotMatch(CITY_SVG, /<filter\b|feDropShadow|feGaussianBlur/, "shadows are shapes, not filters");
  for (const r of cssRules(CSS).filter((r) => /city|filler|tree|green|water|shadow|\.site/.test(r.selector))) {
    assert.doesNotMatch(r.body, /filter\s*:/, `${r.selector} uses a filter`);
  }
});

test("2 green zones, a pond with ripples and at least 12 trees, all decorative (RF-110, RNF-4)", () => {
  assert.match(CITY_SVG, /<g class="city__nature" aria-hidden="true">/);
  const greens = CITY_ELS.filter((el) => "data-green" in el.attrs);
  assert.ok(greens.length >= 2, `${greens.length} green zones`);
  for (const g of greens) {
    assert.ok(elHas(g, "green") && within(g, "city__nature"));
    const box = elBox(g);
    assert.ok(BLOCKS.some((b) => inside(box, b)), "a green zone is not on a block");
    assert.ok(!SITE_BLOCKS.some((s) => overlap(s, box)), "a green zone is on a site block (Park does not count)");
  }
  const water = CITY_ELS.filter((el) => "data-water" in el.attrs);
  assert.ok(water.length >= 1, "no water");
  assert.ok(elHas(water[0], "water") && within(water[0], "city__nature"));
  assert.ok(greens.some((g) => inside(elBox(water[0]), elBox(g))), "the pond is not inside a green zone");
  const ripples = CITY_ELS.filter((el) => elHas(el, "water__ripple"));
  assert.ok(ripples.length >= 2 && ripples.length <= 3, `${ripples.length} ripples`);
  for (const r of ripples) assert.ok(inside(elBox(r), elBox(water[0])), "a ripple is outside the pond");
  assert.ok(trees().length >= 12, `${trees().length} trees`);
});

test("trees stand on blocks with no site and never touch streets, fillers, the pond or each other (RF-110)", () => {
  const fillers = fillerGroups().flatMap((g) => [elBox(g.roof), elBox(g.part("shadow")[0])]);
  const water = CITY_ELS.filter((el) => "data-water" in el.attrs).map(elBox);
  const greens = CITY_ELS.filter((el) => "data-green" in el.attrs).map(elBox);
  const all = trees();
  let onFillerBlocks = 0;
  all.forEach((t, i) => {
    assert.ok(t.hasShadow, `tree ${i} has no shadow`);
    assert.ok(BLOCKS.some((b) => inside(t.crown, b)), `tree ${i} is not inside a block (it would be on a street): ${JSON.stringify(t.crown)}`);
    assert.ok(!SITE_BLOCKS.some((s) => overlap(s, t.all)), `tree ${i} is on a site block`);
    for (const f of fillers) assert.ok(!overlap(t.all, f), `tree ${i} touches a filler`);
    for (const w of water) assert.ok(!overlap(t.all, w), `tree ${i} touches the pond`);
    all.forEach((u, j) => {
      if (j > i) assert.ok(!overlap(t.crown, u.crown), `trees ${i} and ${j} overlap`);
    });
    if (!greens.some((g) => inside(t.crown, g))) onFillerBlocks += 1;
  });
  assert.ok(onFillerBlocks >= 2, `${onFillerBlocks} trees on filler blocks`);
  for (const g of greens) {
    const n = all.filter((t) => inside(t.crown, g)).length;
    assert.ok(n >= 4, `a green zone has ${n} trees`);
  }
});

test("faces, green zones, water and trees brighten only with the city all lit, and the wave lights the faces (RF-72, RF-73, RF-109)", () => {
  const rules = cssRules(CSS);
  const base = (sel) => rules.find((r) => r.selector === sel);
  for (const sel of [".filler__face", ".filler__ridge", ".green", ".water", ".water__ripple", ".tree__crown"]) {
    assert.ok(base(sel), `no ${sel} rule`);
  }
  const lit = (cls) => rules.find((r) => r.selector.split(",").some((s) => s.trim() === `#city[data-all-lit] .${cls}`));
  for (const cls of ["filler__face", "green", "tree__crown", "water"]) {
    const rule = lit(cls);
    assert.ok(rule, `no #city[data-all-lit] .${cls} rule`);
    assert.match(rule.body, /fill\s*:/);
  }
  // the face is lighter than the roof, both off and lit
  const fill = (r) => r.body.match(/fill\s*:\s*(#[0-9a-f]{6})/i)[1];
  const light = (hex) => [1, 3, 5].reduce((s, i) => s + parseInt(hex.slice(i, i + 2), 16), 0);
  assert.ok(light(fill(base(".filler__face"))) > light(fill(base(".filler__roof"))), "the face is not lighter than the roof");
  assert.ok(light(fill(lit("filler__face"))) > light(fill(lit("filler__roof"))), "the lit face is not lighter than the lit roof");
  // the wave also lights the faces as it passes, with no transition before it
  const play = rules.filter((r) => /\[data-final="play"\]/.test(r.selector) && /animation/.test(r.body));
  const face = play.find((r) => r.selector.split(",").some((s) => s.trim().endsWith(".filler__face")));
  assert.ok(face, "no play animation for .filler__face");
  assert.match(face.selector, /#city\[data-all-lit\]/);
  assert.match(face.body, /var\(--fx\)/);
  const noTransition = rules.find(
    (r) => /\[data-final="play"\]/.test(r.selector) && /\.filler__face/.test(r.selector) && /transition\s*:\s*none/.test(r.body),
  );
  assert.ok(noTransition, "the faces would light up before the wave");
});

// --- T25: site icons with volume and site labels (RF-71, RF-75, RF-77, RF-109, RF-112, RF-113, plan §15.4, §15.5) ---

const CITY_JS = read("js/app/city.js");

/** Each site: its id and its elements (descendants), outside the glow halo. */
function siteGroups() {
  const out = [];
  let current;
  for (const el of CITY_ELS) {
    if (el.tag === "g" && "data-site" in el.attrs) out.push((current = { id: el.attrs["data-site"], parts: [] }));
    else if (current && within(el, "site")) current.parts.push(el);
  }
  return out;
}

test("the labels group is empty in the HTML, decorative and drawn over the cars, under the wave (plan §15.4, RNF-4)", () => {
  assert.doesNotMatch(CITY_SVG, /<text\b|<tspan\b/, "labels are built by city.js, not written in the HTML");
  const m = CITY_SVG.match(/<g class="city__labels" aria-hidden="true">([\s\S]*?)<\/g>/);
  assert.ok(m, 'no <g class="city__labels" aria-hidden="true">');
  assert.equal(m[1].trim(), "", "the labels group is filled by mountCityLabels");
  const at = CITY_SVG.indexOf('class="city__labels"');
  assert.ok(CITY_SVG.indexOf('class="city__cars"') < at, "labels must be drawn after (over) the cars (RF-117)");
  assert.ok(at < CITY_SVG.indexOf('class="city__wave"'), "labels go under the wave");
  assert.ok(within(CITY_ELS.find((el) => elHas(el, "city__labels")), "city__map"), "labels are inside the clipped map");
  // the SVG stays one image with the RF-75 text: its children are never exposed
  assert.match(CITY_SVG, /<svg id="city"[^>]*role="img"[^>]*aria-label="Night city: 0 of 10 places lit"/);
});

test("city.js builds the labels from SITE_LAYOUT with textContent and paintCity lights them (RF-112)", () => {
  assert.match(CITY_JS, /export function mountCityLabels\(svg, layout = SITE_LAYOUT\)/);
  assert.match(CITY_JS, /from "\.\.\/lib\/site-labels\.js"/);
  assert.match(CITY_JS, /data-site-label/);
  assert.match(CITY_JS, /createElementNS\(/);
  assert.match(CITY_JS, /\.textContent\s*=/);
  assert.doesNotMatch(CITY_JS, /innerHTML|insertAdjacentHTML/);
  assert.match(CITY_JS, /querySelectorAll\("\[data-site-label\]"\)/);
});

test("main.js mounts the labels once, before the first render", () => {
  assert.match(MAIN_JS, /import \{[^}]*\bmountCityLabels\b[^}]*\} from "\.\/city\.js"/);
  const mount = MAIN_JS.indexOf("mountCityLabels(city)");
  assert.ok(mount > 0, "main.js does not call mountCityLabels(city)");
  assert.equal(MAIN_JS.split("mountCityLabels(city)").length, 2, "mountCityLabels is called more than once");
  assert.ok(mount < MAIN_JS.lastIndexOf("render();"), "labels are mounted after the first render");
});

test("a label is off by default and fades in within 400 ms only with .is-lit (RF-112, RF-77)", () => {
  const rules = cssRules(CSS);
  const sel = (r) => r.selector.split(",").map((s) => s.trim());
  const base = rules.find((r) => r.selector === ".site-label");
  assert.ok(base, "no .site-label rule");
  assert.match(base.body, /opacity\s*:\s*0\s*;/);
  const t = base.body.match(/transition\s*:\s*opacity\s+(\d+)ms/);
  assert.ok(t, ".site-label has no opacity transition");
  assert.ok(Number(t[1]) > 0 && Number(t[1]) <= 400, `${t[1]} ms fade`);
  const lit = rules.find((r) => r.selector === ".site-label.is-lit");
  assert.ok(lit, "no .site-label.is-lit rule");
  assert.match(lit.body, /opacity\s*:\s*1\s*;/);
  for (const r of rules.filter((r) => /site-label/.test(r.selector) && /opacity\s*:\s*1\b/.test(r.body))) {
    for (const s of sel(r)) assert.match(s, /\.is-lit/, `${s} shows a label of a site that is not lit`);
  }
  // only opacity: no movement, so reduced motion (global 200 ms) only shortens it (RF-77, RNF-2)
  for (const r of rules.filter((r) => /site-label/.test(r.selector))) {
    assert.doesNotMatch(r.body, /transform|animation/, `${r.selector} moves the label`);
  }
});

test("label text and background follow plan §15.5: --text, 700 11.5px/1.15, centred, dark translucent box (RF-113)", () => {
  const rules = cssRules(CSS);
  const text = rules.find((r) => r.selector === ".site-label__text");
  assert.ok(text, "no .site-label__text rule");
  assert.match(text.body, /fill\s*:\s*var\(--text\)/);
  assert.match(text.body, /font\s*:\s*700 11\.5px\/1\.15 var\(--sans\)/);
  assert.match(text.body, /text-anchor\s*:\s*middle/);
  const bg = rules.find((r) => r.selector === ".site-label__bg");
  assert.ok(bg, "no .site-label__bg rule");
  assert.match(bg.body, /fill\s*:\s*rgb\(11 16 38 \/ \.78\)/);
  assert.match(CITY_JS, /rx", ?3|"rx", "3"|rx: 3/);
});

test("every block of SITE_LAYOUT is a block of the city map", () => {
  for (const [id, { block }] of Object.entries(SITE_LAYOUT)) {
    assert.ok(
      BLOCKS.some((b) => b.x === block.x && b.y === block.y && b.w === block.w && b.h === block.h),
      `the block of ${id} is not in index.html: ${JSON.stringify(block)}`,
    );
  }
});

test("each site has a cast shadow and at least two roof tones, .body and .body--top (RF-109)", () => {
  const sites = siteGroups();
  assert.equal(sites.length, 10);
  for (const s of sites) {
    const has = (cls) => s.parts.filter((el) => elHas(el, cls));
    const shadows = has("shadow");
    assert.ok(shadows.length >= 1, `${s.id} has no .shadow`);
    for (const sh of shadows) assert.equal(sh.attrs.transform, "translate(2.5 3)", `${s.id}: shadow not moved by translate(2.5 3)`);
    assert.ok(has("body").length >= 1, `${s.id} has no .body`);
    assert.ok(has("body--top").length >= 1, `${s.id} has no .body--top`);
    assert.ok(has("site__icon").length === 1, `${s.id} needs one .site__icon group`);
    assert.equal(has("glow").filter((el) => within(el, "site__icon")).length, 0, `${s.id}: the halo is not part of the icon`);
  }
  const rules = cssRules(CSS);
  const fill = (sel) => rules.find((r) => r.selector === sel)?.body.match(/fill\s*:\s*(#[0-9a-f]{6})/i)?.[1];
  const light = (hex) => [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0);
  assert.ok(fill(".site .body--top"), "no .site .body--top fill");
  assert.ok(light(fill(".site .body--top")) > light(fill(".site .body")), ".body--top is not lighter than .body");
});

test("the Ferris wheel is its own <g class=\"wheel\"> inside the fairground", () => {
  const wheel = CITY_ELS.filter((el) => el.tag === "g" && elHas(el, "wheel"));
  assert.equal(wheel.length, 1);
  const fair = siteGroups().find((s) => s.id === "fairground");
  assert.ok(fair.parts.includes(wheel[0]), "the wheel is not in the fairground");
});

test("rects, circles and ellipses of each icon (shadows included) fit in its SITE_LAYOUT icon box (RF-71, RF-113)", () => {
  for (const s of siteGroups()) {
    const icon = SITE_LAYOUT[s.id].icon;
    const shapes = s.parts.filter((el) => ["rect", "circle", "ellipse"].includes(el.tag) && within(el, "site__icon"));
    assert.ok(shapes.length >= 2, `${s.id}: ${shapes.length} basic shapes`);
    for (const el of shapes) {
      const b = elBox(el);
      // shadows are moved by translate(2.5 3), which elBox already adds
      assert.ok(
        b.x >= icon.x - 1e-9 && b.y >= icon.y - 1e-9 && b.x + b.w <= icon.x + icon.w + 1e-9 && b.y + b.h <= icon.y + icon.h + 1e-9,
        `${s.id}: ${el.tag}.${el.attrs.class} ${JSON.stringify(b)} is outside the icon box ${JSON.stringify(icon)}`,
      );
    }
  }
});

// --- T27: the living city after the full light-up (RF-53, RF-54, RF-56, RF-114 to RF-118, plan §15.7) ---

const LIVE = ".app[data-final-live] #city[data-all-lit]";
const CSS_MOTION = CSS.replace(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/, "");

/** Each car group with its number, its axis and the box of all its parts. */
function cars() {
  const out = [];
  let current;
  for (const el of CITY_ELS) {
    if (el.tag === "g" && elHas(el, "car")) out.push((current = { el, parts: [] }));
    else if (current && within(el, "car")) current.parts.push(el);
  }
  return out.map((c) => {
    const n = (c.el.attrs.class.match(/\bcar--(\d+)\b/) ?? [])[1];
    const box = c.parts.map(elBox).filter(Boolean).reduce(union);
    return { n, axis: c.el.attrs["data-axis"], box };
  });
}

const STREETS = CITY_ELS.filter((el) => el.tag === "rect" && elHas(el, "street")).map((el) => ({
  vertical: elHas(el, "street--v"),
  box: elBox(el),
}));

/** Rules (outside reduced motion) of the living-city loops, each with its animation shorthand. */
function liveRules() {
  return cssRules(CSS_MOTION)
    .filter((r) => r.selector.includes("[data-final-live]") && /animation\s*:/.test(r.body))
    .map((r) => ({ ...r, animation: r.body.match(/animation\s*:\s*([^;]+);/)[1].trim() }));
}

/** Keyframe stops of @keyframes name as [{ at: 0-100, body }]. */
function stops(name) {
  const body = keyframesBody(name);
  assert.ok(body, `missing @keyframes ${name}`);
  const out = [];
  for (const m of body.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    for (const s of m[1].split(",").map((t) => t.trim()).filter(Boolean)) {
      const at = s === "from" ? 0 : s === "to" ? 100 : Number(s.replace("%", ""));
      out.push({ at, body: m[2] });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

test("4 cars, 3 on the horizontal avenues and 1 on a vertical street, each inside a street of its axis (RF-114)", () => {
  const list = cars();
  assert.equal(list.length, 4, "4 .car groups");
  assert.deepEqual(list.map((c) => c.n), ["1", "2", "3", "4"]);
  assert.equal(list.filter((c) => c.axis === "x").length, 3);
  assert.equal(list.filter((c) => c.axis === "y").length, 1);
  const avenues = new Set();
  for (const c of list) {
    const street = STREETS.find((s) =>
      c.axis === "x"
        ? !s.vertical && c.box.y >= s.box.y && c.box.y + c.box.h <= s.box.y + s.box.h
        : s.vertical && c.box.x >= s.box.x && c.box.x + c.box.w <= s.box.x + s.box.w,
    );
    assert.ok(street, `car ${c.n} (${c.axis}) is not inside a street of its axis: ${JSON.stringify(c.box)}`);
    if (c.axis === "x") avenues.add(street.box.y);
  }
  assert.equal(avenues.size, 3, "one car on each horizontal avenue");
});

test("each car loops along its own axis only, from its resting place, across the whole map and back in (RF-114, RF-117)", () => {
  const rules = liveRules();
  const dirs = [];
  for (const c of cars()) {
    const rule = rules.find((r) => r.selector === `${LIVE} .car--${c.n}`);
    assert.ok(rule, `no living loop for .car--${c.n}`);
    const m = rule.animation.match(/^(car-([xy])-\d+) (\d*\.?\d+)s linear var\(--live-cars-delay\) infinite$/);
    assert.ok(m, `.car--${c.n}: "${rule.animation}"`);
    assert.equal(m[2], c.axis, `car ${c.n} moves along ${m[2]}, not its axis ${c.axis}`);
    const secs = Number(m[3]);
    assert.ok(secs >= 8 && secs <= 12, `car ${c.n} lasts ${secs} s`);
    const fn = c.axis === "x" ? "translateX" : "translateY";
    const values = stops(m[1]).map((s) => {
      assert.doesNotMatch(s.body, c.axis === "x" ? /translateY|translate\(|rotate|scale/ : /translateX|translate\(|rotate|scale/);
      const v = s.body.match(new RegExp(String.raw`transform\s*:\s*${fn}\((-?[\d.]+)px\)`));
      assert.ok(v, `${m[1]} ${s.at}%: "${s.body.trim()}"`);
      return { at: s.at, v: Number(v[1]) };
    });
    // starts and ends at the resting place (where reduced motion leaves it): no jump when it starts or loops
    assert.deepEqual([values[0].at, values[0].v], [0, 0]);
    assert.deepEqual([values.at(-1).at, values.at(-1).v], [100, 0]);
    // it leaves the map fully through one edge and comes back in through the other one, hidden by the clip
    const pos = c.axis === "x" ? c.box.x : c.box.y;
    const size = c.axis === "x" ? c.box.w : c.box.h;
    const edge = c.axis === "x" ? 400 : 300;
    const lo = Math.min(...values.map((p) => p.v));
    const hi = Math.max(...values.map((p) => p.v));
    assert.ok(pos + lo + size <= 0, `car ${c.n} never leaves through the start edge`);
    assert.ok(pos + hi >= edge, `car ${c.n} never leaves through the far edge`);
    // the only jump happens off the map, and the speed is the same everywhere else
    const speeds = [];
    for (let i = 1; i < values.length; i++) {
      const dt = values[i].at - values[i - 1].at;
      const dv = values[i].v - values[i - 1].v;
      if (dt < 0.01) {
        for (const p of [values[i], values[i - 1]]) {
          assert.ok(pos + p.v + size <= 0 || pos + p.v >= edge, `car ${c.n} jumps inside the map`);
        }
        continue;
      }
      speeds.push(dv / dt);
    }
    for (const s of speeds) assert.ok(Math.abs(s - speeds[0]) <= Math.abs(speeds[0]) * 0.02, `car ${c.n} changes speed`);
    if (c.axis === "x") dirs.push(Math.sign(speeds[0]));
  }
  // the 3 avenue cars run in alternate directions, from the top avenue down
  assert.deepEqual(dirs, [1, -1, 1]);
});

test("the cars no longer park: final-car and --car-from are gone (RF-53, RF-114)", () => {
  assert.doesNotMatch(CSS, /final-car|--car-from/);
  assert.doesNotMatch(HTML, /--car-from/);
});

test("a third of the filler lights twinkle and the lamps are split in two groups (RF-115)", () => {
  const lights = [...CITY_SVG.matchAll(/<g class="filler__lights"([^>]*)>/g)];
  assert.equal(lights.length, 16);
  const twinkle = lights.filter((m) => /\sdata-twinkle\b/.test(m[1]));
  assert.ok(twinkle.length >= 5 && twinkle.length <= 6, `${twinkle.length} of 16 twinkle`);
  const lamps = CITY_ELS.filter((el) => elHas(el, "lamp"));
  assert.ok(lamps.length > 40, `${lamps.length} lamps`);
  const a = lamps.filter((el) => within(el, "lamps__a")).length;
  const b = lamps.filter((el) => within(el, "lamps__b")).length;
  assert.equal(a + b, lamps.length, "every lamp is in .lamps__a or .lamps__b");
  assert.ok(Math.abs(a - b) <= 1, `${a} / ${b} lamps`);
});

test("windows, lamps, water, stadium, Ferris wheel and nightclub loop under [data-final-live] and [data-all-lit] (RF-115, RF-116)", () => {
  const rules = liveRules();
  const targets = [
    ".filler__lights[data-twinkle]",
    ".lamps__a",
    ".lamps__b",
    ".water__ripple",
    '[data-site="stadium"] .lt',
    '[data-site="fairground"] .wheel',
    '[data-site="nightclub"] .lt--pink',
    '[data-site="nightclub"] .lt-stroke--pink',
  ];
  for (const t of targets) {
    const rule = rules.find((r) => r.selector.split(",").some((s) => s.trim() === `${LIVE} ${t}`));
    assert.ok(rule, `no living loop for ${t}`);
    assert.match(rule.animation, /var\(--live-delay\)/, `${t} does not wait for the wave`);
  }
  // the white nightclub lights pulse too, against the pink ones
  assert.ok(
    rules.some((r) => r.selector.split(",").some((s) => s.trim().startsWith(`${LIVE} [data-site="nightclub"] .lt:not(`))),
    "no white nightclub loop",
  );
  // every living rule hangs on both attributes, never on the play/done step (so it never restarts)
  for (const r of rules) {
    for (const s of r.selector.split(",")) {
      assert.ok(s.trim().startsWith(`${LIVE} `), `"${s.trim()}" does not hang on ${LIVE}`);
      assert.doesNotMatch(s, /data-final=/);
    }
    assert.match(r.animation, /\binfinite\b/, `${r.selector} is not a loop`);
  }
});

test("the living loops are smooth, at least 1 s per change, never fully off, and only animate cheap properties (RF-115, RF-117, RNF-12)", () => {
  const rules = liveRules();
  assert.ok(rules.length >= 12, `${rules.length} living rules`);
  for (const r of rules) {
    const a = r.animation;
    assert.doesNotMatch(a, /steps\(|step-start|step-end/, r.selector);
    assert.match(a, /\b(linear|ease-in-out)\b/, r.selector);
    const name = a.match(/^([\w-]+)/)[1];
    const ms = firstTimeMs(a);
    assert.ok(ms >= 1000, `${r.selector} lasts ${ms} ms`);
    const st = stops(name);
    // each rise or fall of brightness lasts at least 1 s
    for (let i = 1; i < st.length; i++) {
      if (!/opacity/.test(st[i].body + st[i - 1].body)) continue;
      const span = ((st[i].at - st[i - 1].at) / 100) * ms;
      assert.ok(span >= 1000, `${name}: a ${span} ms brightness change`);
    }
    for (const s of st) {
      for (const p of [...s.body.matchAll(/([\w-]+)\s*:/g)].map((m) => m[1])) {
        assert.ok(["opacity", "transform", "stroke-dashoffset"].includes(p), `${name} animates ${p}`);
      }
      const op = s.body.match(/opacity\s*:\s*([\d.]+)/);
      if (op) assert.ok(Number(op[1]) >= 0.55, `${name} dims to ${op[1]}`);
    }
  }
  assert.doesNotMatch(CITY_SVG, /<filter|filter=/, "no filters in the city");
});

test("flags, texts and site labels never loop (RF-54, RF-117)", () => {
  let checked = 0;
  for (const r of cssRules(CSS_MOTION)) {
    if (!/final-flag|final__title|final__thanks|site-label|final__flags/.test(r.selector)) continue;
    checked += 1;
    assert.doesNotMatch(r.body, /animation\s*:[^;]*\binfinite\b/, r.selector);
  }
  assert.ok(checked > 3);
});

test("final.js sets data-final-live and the live delays in show() and removes them in hide() (RF-56, RF-117)", () => {
  assert.match(FINAL_JS, /import \{[^}]*\bliveDelays\b[^}]*\} from "\.\.\/\.\.\/lib\/final-view\.js"/);
  assert.match(FINAL_JS, /"--live-cars-delay"/);
  assert.match(FINAL_JS, /"--live-delay"/);
  assert.match(FINAL_JS, /dataset\.finalLive\s*=/);
  assert.match(FINAL_JS, /delete root\.dataset\.finalLive/);
});
