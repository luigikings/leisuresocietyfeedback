// Static checks of index.html and css/survey.css read as text (plan §14.8).
// T32: survey style of the demo (RF-17, RF-92 to RF-97, plan §16.3). Later tasks add the intro, country, city and final checks.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STREETS as GRID_STREETS, GAP, VIEW_W, VIEW_H, SITE_CELLS, CELL_W, CELL_H, cellBox } from "../js/lib/city-grid.js";
import { SITE_IDS } from "../js/lib/sites.js";

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

// --- T32: survey style of the demo (RF-17, RF-92 to RF-97, RF-144, RNF-4, plan §16.3) -------------

/** WCAG contrast ratio of two #rrggbb colours. */
function contrast(a, b) {
  const lum = (hex) => {
    const [r, g, b2] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b2);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Text of every `@media <query> { ... }` block (one nesting level). */
function mediaBlocks(css, query) {
  const out = [];
  let from = 0;
  for (;;) {
    const at = css.indexOf(`@media ${query}`, from);
    if (at < 0) return out;
    let i = css.indexOf("{", at) + 1;
    const start = i;
    for (let depth = 1; depth > 0; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
    }
    out.push(css.slice(start, i - 1));
    from = i;
  }
}

/** Every rule whose selector list contains `selector` exactly. */
const rulesWith = (selector) =>
  cssRules(CSS).filter((r) => r.selector.split(",").some((s) => s.trim() === selector));

test("the palette of plan §16.3 is declared in :root (RF-94)", () => {
  assert.deepEqual(
    {
      night: rootVar("--night"),
      night2: rootVar("--night-2"),
      royalDeep: rootVar("--royal-deep"),
      gold: rootVar("--gold"),
      lit: rootVar("--lit"),
      text: rootVar("--text"),
      muted: rootVar("--muted"),
      line: rootVar("--line"),
    },
    {
      night: "#060a22",
      night2: "#0e1648",
      royalDeep: "#0b1138",
      gold: "#f6b93b",
      lit: "#ffd36e",
      text: "#eef0ff",
      muted: "#9aa3d6",
      line: "#2a3787",
    },
  );
});

test("the palette contrasts are met: texts >= 4.5:1, gold borders and --seg-off >= 3:1 (RNF-4, RF-144, proposal 40)", () => {
  const v = (n) => rootVar(n);
  assert.ok(contrast(v("--text"), v("--night")) >= 4.5, "text on night");
  assert.ok(contrast(v("--text"), v("--royal-deep")) >= 4.5, "option text, not chosen");
  assert.ok(contrast(v("--night"), v("--gold")) >= 4.5, "option text chosen / button text on gold");
  assert.ok(contrast(v("--muted"), v("--night")) >= 4.5, "secondary text on night");
  assert.ok(contrast(v("--gold"), v("--night")) >= 3, "gold hexagon border on night");
  assert.match(v("--seg-off") ?? "", /^#[0-9a-f]{6}$/, "--seg-off missing");
  assert.ok(contrast(v("--seg-off"), v("--night")) >= 3, "off segment on night");
});

test("the old tokens are gone: --blue, --blue-deep, --street, --block, --window, --radius (plan §16.3)", () => {
  for (const name of ["--blue", "--blue-deep", "--street", "--block", "--window", "--radius"]) {
    assert.doesNotMatch(CSS, new RegExp(`${name}(?![\\w-])`), `${name} is still in the CSS`);
  }
});

test("body has the night background with the --night-2 glow on top (plan §16.3)", () => {
  const body = cssRules(CSS).find((r) => r.selector === "body");
  assert.match(body.body, /background-color:\s*var\(--night\)/);
  assert.match(body.body, /background-image:\s*radial-gradient\([^;]*var\(--night-2\)/);
});

// --- RF-95: capitals only on the screen titles, in the condensed type ---------------

test("only the screen titles and the brand are in capitals (RF-95)", () => {
  const offenders = cssRules(CSS).filter(
    (r) => /text-transform\s*:\s*uppercase/.test(r.body) && !/^(\.screen__title|\.final__thanks|\.brand|\.hud__brand)\b/.test(r.selector), // T34: the brand is .hud__brand
  );
  assert.deepEqual(offenders.map((r) => r.selector), []);
});

test("the screen titles use Big Shoulders Display 800 in capitals; the statement does not (RF-95, RF-142)", () => {
  for (const sel of [".screen__title", ".final__thanks"]) {
    const body = rulesWith(sel).map((r) => r.body).join("\n");
    assert.match(body, /font:\s*800\b[^;]*var\(--display\)/, `${sel} font`);
    assert.match(body, /text-transform:\s*uppercase/, `${sel} case`);
    assert.match(body, /letter-spacing:\s*\.02em/, `${sel} spacing`);
  }
  assert.match(HTML, /class="screen__title final__title"/, '"Leisure for Society" is a screen title');
  const q = rulesWith(".question__text").map((r) => r.body).join("\n");
  assert.match(q, /font:\s*700 1\.35rem\/1\.25 var\(--body\)/);
  assert.doesNotMatch(q, /uppercase/);
});

// T38: Chrome exposes text-transformed text to the accessibility tree, so every capitalised title
// carries its literal text for screen readers ("the capitals are only visual", RF-95).
test("screen readers get the literal text of the capitalised titles, not the capitals (RF-95, RNF-4)", () => {
  const titles = [...HTML.matchAll(/<h1\b([^>]*class="[^"]*\bscreen__title\b[^"]*"[^>]*)>([^<]*)<\/h1>/g)];
  assert.equal(titles.length, 2, "the country picker and the final have a screen title");
  for (const [, attrs, text] of titles) {
    assert.ok(attrs.includes(`aria-label="${text}"`), `<h1> "${text}" names itself with its literal text`);
  }
  const thanks = HTML.match(/<p class="final__thanks">([\s\S]*?)<\/p>/);
  assert.ok(thanks, "missing .final__thanks");
  assert.equal(
    thanks[1].trim(),
    '<span aria-hidden="true">Thank you</span><span class="visually-hidden">Thank you</span>',
    '"Thank you": visible capitals hidden from the reader, plus a hidden copy in its literal case',
  );
  const hidden = cssRules(CSS).find((r) => r.selector === ".visually-hidden");
  assert.match(hidden.body, /text-transform\s*:\s*none/, "the hidden copy must not inherit the capitals");
});

test('CSS does not use "Arial Black" (RF-95)', () => {
  assert.doesNotMatch(CSS, /Arial Black/i);
});

test("the survey text uses Figtree over the system sans-serif fallback, with no @import (RF-142, RF-145)", () => {
  const body = cssRules(CSS).find((r) => r.selector === "body");
  assert.match(body.body, /font:[^;]*var\(--body\)/);
  assert.match(rootVar("--sans"), /^system-ui,.*sans-serif$/);
  assert.doesNotMatch(CSS, /@import/);
  assert.doesNotMatch(HTML, /fonts\.googleapis|fonts\.gstatic/);
});

test("only the stage text keeps the system --sans: the survey rules use --body or --display (RF-142)", () => {
  const offenders = cssRules(CSS).filter(
    (r) => /font(-family)?\s*:[^;]*var\(--sans\)/.test(r.body) && r.selector !== ".plato text",
  );
  assert.deepEqual(offenders.map((r) => r.selector), []);
});

// --- RF-93: no metallic gradients nor gold text effects -------------------------------

test("no linear-gradient on .option or .btn rules, and no gradient anywhere with gold (RF-93)", () => {
  const offenders = cssRules(CSS).filter((r) => /\.(option|btn)/.test(r.selector) && /linear-gradient/.test(r.body));
  assert.deepEqual(offenders.map((r) => r.selector), []);
  for (const m of CSS.matchAll(/linear-gradient\(([^;]*)/g)) {
    assert.doesNotMatch(m[1], /--gold|--lit|#f6b93b|#ffd36|246 185 59|255 211 1/i, `golden gradient: ${m[0]}`);
  }
});

test("no text-shadow or text stroke anywhere (RF-93)", () => {
  assert.doesNotMatch(CSS, /text-shadow\s*:/);
  assert.doesNotMatch(CSS, /text-stroke/);
});

// --- RF-17, RF-93, RF-96, RF-144: hexagon options without a letter -------------------

const HEX = /clip-path:\s*polygon\(18px 0,\s*calc\(100% - 18px\) 0,\s*100% 50%,\s*calc\(100% - 18px\) 100%,\s*18px 100%,\s*0 50%\)/;

test("question.js builds .option > .option__shape > .option__in with no visible letter (RF-17, RF-93)", () => {
  assert.doesNotMatch(QUESTION_JS, /option__letter/);
  assert.match(QUESTION_JS, /"option__shape"/);
  assert.match(QUESTION_JS, /"option__in"/);
  assert.match(QUESTION_JS, /setAttribute\(\s*"aria-label"\s*,\s*label\s*\)/, "the accessible name is the label only");
  assert.doesNotMatch(QUESTION_JS, /`\$\{letter\}:/);
  assert.doesNotMatch(CSS, /option__letter/);
});

test("the button is not clipped; the gold hexagon and the inner hexagon are (RF-93, RNF-4)", () => {
  for (const r of rulesWith(".option")) assert.doesNotMatch(r.body, /clip-path/, ".option must keep its outline");
  const shape = rulesWith(".option__shape").map((r) => r.body).join("\n");
  assert.match(shape, HEX);
  assert.match(shape, /background:\s*var\(--gold\)/);
  assert.match(shape, /padding:\s*2px/);
  const inner = rulesWith(".option__in").map((r) => r.body).join("\n");
  assert.match(inner, HEX);
  assert.match(inner, /background:\s*var\(--royal-deep\)/);
  assert.match(inner, /padding:\s*\.9rem 1\.8rem/, "1.8 rem at the sides: more than the 18 px tips (RF-144)");
  assert.match(inner, /min-height:\s*56px/);
});

test("the chosen option is filled with gold, dark text and its check (RF-96)", () => {
  const chosen = rulesWith('.option[aria-checked="true"] .option__in').map((r) => r.body).join("\n");
  assert.match(chosen, /background:\s*var\(--gold\)/);
  assert.match(chosen, /color:\s*var\(--night\)/);
  const check = rulesWith('.option[aria-checked="true"] .option__check').map((r) => r.body).join("\n");
  assert.match(check, /opacity:\s*1/);
});

test("question screen adds an aria-hidden SVG check to each option (RF-96)", () => {
  assert.match(QUESTION_JS, /option__check/);
  assert.match(QUESTION_JS, /createElementNS\(\s*SVG_NS/);
  assert.match(QUESTION_JS, /aria-hidden/);
});

test("focus is a 3 px light outline on the option and on the buttons, never gold (RNF-4)", () => {
  const opt = rulesWith(".option:focus-visible").map((r) => r.body).join("\n");
  assert.match(opt, /outline:\s*3px solid var\(--text\)/);
  assert.match(opt, /outline-offset:\s*3px/);
  const btn = rulesWith(".btn:focus-visible").map((r) => r.body).join("\n");
  assert.match(btn, /outline:\s*3px solid var\(--text\)/);
  assert.match(btn, /outline-offset:\s*2px/);
  for (const r of cssRules(CSS).filter((r) => /:focus-visible/.test(r.selector))) {
    assert.doesNotMatch(r.body, /outline[^;]*var\(--gold\)/, `${r.selector}: a gold focus looks like "chosen"`);
  }
});

// --- RF-97: buttons -----------------------------------------------------------------------

test("Give feedback and Next are .btn; Back is .btn--secondary (RF-97)", () => {
  assert.doesNotMatch(HTML, /btn--gold|btn--ghost/);
  assert.doesNotMatch(CSS, /btn--gold|btn--ghost/);
  assert.match(HTML, /class="btn btn--primary" data-action="next"/);
  assert.match(HTML, /class="btn btn--primary" data-action="start"/);
  assert.match(HTML, /class="btn btn--secondary" data-action="back"/);
});

test(".btn is gold with dark text, 12 px corners, at least 52 px tall and in Figtree 700 (RF-97, RF-142)", () => {
  const btn = rulesWith(".btn").map((r) => r.body).join("\n");
  assert.match(btn, /background:\s*var\(--gold\)/);
  assert.match(btn, /color:\s*var\(--night\)/);
  assert.match(btn, /border-radius:\s*12px/);
  const h = btn.match(/min-height:\s*(\d+)px/);
  assert.ok(h && Number(h[1]) >= 52, "min-height >= 52 px");
  assert.match(btn, /font:\s*700 1\.05rem[^;]*var\(--body\)/);
});

test(".btn--secondary is transparent with a thin line and at least 44 x 44 (RF-97)", () => {
  const sec = rulesWith(".btn--secondary").map((r) => r.body).join("\n");
  assert.match(sec, /background:\s*transparent/);
  assert.match(sec, /box-shadow:\s*inset 0 0 0 1\.5px var\(--line\)/);
  assert.match(sec, /color:\s*var\(--text\)/);
  const w = sec.match(/min-width:\s*(\d+)px/);
  assert.ok(w && Number(w[1]) >= 44, "min-width >= 44 px");
});

test("a disabled button is told apart by more than colour: opacity and cursor (RF-97)", () => {
  const dis = rulesWith(".btn:disabled").map((r) => r.body).join("\n");
  assert.match(dis, /opacity:\s*\.45/);
  assert.match(dis, /cursor:\s*not-allowed/);
});

test(":active presses only move with no reduced-motion preference (RF-97, RNF-2)", () => {
  const motion = mediaBlocks(CSS, "(prefers-reduced-motion: no-preference)").join("\n");
  assert.match(motion, /\.btn:active\s*\{[^}]*transform:\s*scale\(\.98\)/);
  let rest = CSS;
  for (const block of mediaBlocks(CSS, "(prefers-reduced-motion: no-preference)")) rest = rest.replace(block, "");
  const moving = cssRules(rest).filter((r) => /:active/.test(r.selector) && /transform\s*:\s*(?!none)/.test(r.body));
  assert.deepEqual(moving.map((r) => r.selector), []);
});

test('there is no "final answer" confirmation (RF-35)', () => {
  assert.doesNotMatch(HTML, /final answer/i);
  assert.doesNotMatch(QUESTION_JS, /final answer/i);
  assert.doesNotMatch(read("js/app/main.js"), /final answer/i);
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

// --- T36: intro loops of RF-119 to RF-122 and the marker count of RF-123 (plan §16.8) ---------------

const LOOPS_LIB = await import("../js/lib/intro-entry.js");

/** Seconds or ms token → ms. */
const toMs = (t) => (t.endsWith("ms") ? Number(t.slice(0, -2)) : Number(t.slice(0, -1)) * 1000);

/** Every `<prop>: <value>` pair of a keyframes body, in order. */
const keyframeProps = (body) => [...body.matchAll(/([a-z-]+)\s*:\s*([^;}]+)/g)].map((m) => [m[1], m[2].trim()]);

/** The opacity values set in a keyframes body. */
const keyframeOpacities = (body) => keyframeProps(body).filter(([p]) => p === "opacity").map(([, v]) => Number(v));

const stageGroup = (id) => svgTree(PLATO_SVG).children[0].children.find((n) => n.attrs.includes(`data-enter="${id}"`));
const attr = (node, name) => node.attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1];

test("bulbs chase clockwise with plato-chase, one bulb per INTRO_LOOPS.bulbs step, never off (RF-119)", () => {
  const { bulbs } = LOOPS_LIB.INTRO_LOOPS;
  const rule = ruleFor(".plato__bulb");
  assert.ok(rule, "no .plato__bulb rule");
  const m = rule.body.match(/animation\s*:\s*([^;]+);/);
  assert.match(m[1], /^plato-chase\b/);
  assert.match(m[1], /\binfinite\b/);
  assert.equal(firstTimeMs(m[1]), bulbs.cycleMs);
  // circles 1-4 of the sign group
  const circles = stageGroup("sign").children.filter((n) => n.tag === "circle" && hasClass(n, "plato__bulb"));
  assert.equal(circles.length, 4);
  const at = circles.map((c) => [Number(attr(c, "cx")), Number(attr(c, "cy"))]);
  const centre = [at.reduce((s, p) => s + p[0], 0) / 4, at.reduce((s, p) => s + p[1], 0) / 4];
  // delay of each bulb = its place in the clockwise round × the step
  const step = bulbs.cycleMs / bulbs.count;
  const delayOf = (n) => {
    if (n === 1) return 0;
    const r = ruleFor(`.plato__bulb:nth-of-type(${n})`);
    assert.ok(r, `no delay for bulb ${n}`);
    return toMs(r.body.match(/animation-delay\s*:\s*([\d.]+m?s)/)[1]);
  };
  const angle = ([x, y]) => (Math.atan2(y - centre[1], x - centre[0]) * 180) / Math.PI; // grows clockwise (y down)
  const byDelay = [1, 2, 3, 4].map((n) => ({ n, delay: delayOf(n), angle: angle(at[n - 1]) })).sort((a, b) => a.delay - b.delay);
  assert.deepEqual(byDelay.map((b) => b.delay), [0, step, 2 * step, 3 * step]);
  for (let i = 1; i < 4; i++) {
    const turn = (byDelay[i].angle - byDelay[i - 1].angle + 360) % 360;
    assert.ok(turn > 0 && turn < 180, `bulb ${byDelay[i].n} is not clockwise after bulb ${byDelay[i - 1].n}`);
  }
  const frames = keyframesBody("plato-chase");
  assert.ok(frames, "missing @keyframes plato-chase");
  for (const [p] of keyframeProps(frames)) assert.equal(p, "opacity", `plato-chase animates ${p}`);
  const ops = keyframeOpacities(frames);
  assert.ok(Math.min(...ops) >= 0.5, "a bulb goes (almost) off");
  assert.equal(Math.max(...ops), 1);
  assert.doesNotMatch(CSS, /plato-glow-bulb/);
});

test("13 cell glows sit under the 13 board values, none on the 2 empty cells, off at rest (RF-120, RF-84)", () => {
  const kids = stageGroup("board").children;
  const glows = kids.filter((n) => hasClass(n, "plato__cell-glow"));
  assert.equal(glows.length, LOOPS_LIB.BOARD_SEQUENCE.length);
  const values = kids.filter((n) => hasClass(n, "plato__value"));
  glows.forEach((g, i) => {
    assert.equal(g.tag, "rect");
    assert.equal(attr(g, "style"), `--i:${i}`, `glow ${i} has no --i`);
    assert.equal(attr(g, "opacity"), "0", "the glow is off at rest (reduced motion)");
    assert.equal(attr(g, "fill"), "#fff");
    // right under its value text, so the number stays on top and unchanged
    assert.equal(kids[kids.indexOf(g) + 1], values[i], `glow ${i} is not right before its value`);
    // on its cell: the cell rect just before it has the same box
    const cell = kids[kids.indexOf(g) - 1];
    assert.equal(cell.tag, "rect");
    for (const a of ["x", "y", "width", "height"]) assert.equal(attr(g, a), attr(cell, a), `glow ${i} ${a}`);
    const { col, row } = LOOPS_LIB.BOARD_SEQUENCE[i];
    assert.ok(Math.abs(Number(attr(g, "x")) - (43 + col * 43.4)) < 0.01, `glow ${i} column`);
    assert.equal(Number(attr(g, "y")), 117.5 + row * 30, `glow ${i} row`);
  });
  for (const e of kids.filter((n) => hasClass(n, "plato__empty"))) {
    for (const g of glows) assert.ok(attr(g, "x") !== attr(e, "x") || attr(g, "y") !== attr(e, "y"), "glow on an empty cell");
  }
});

test("the board glow walks one cell per INTRO_LOOPS.board step and only changes opacity (RF-120, RF-86)", () => {
  const { board } = LOOPS_LIB.INTRO_LOOPS;
  const rule = ruleFor(".plato__cell-glow");
  assert.ok(rule, "no .plato__cell-glow rule");
  const m = rule.body.match(/animation\s*:\s*([^;]+);/);
  assert.match(m[1], /^plato-cell\b/);
  assert.match(m[1], /\binfinite\b/);
  assert.match(m[1], /\blinear\b/);
  assert.equal(firstTimeMs(m[1]), board.count * board.stepMs);
  assert.match(rule.body, new RegExp(String.raw`animation-delay\s*:\s*calc\(var\(--i\)\s*\*\s*${board.stepMs}ms\)`));
  const frames = keyframesBody("plato-cell");
  assert.ok(frames, "missing @keyframes plato-cell");
  for (const [p] of keyframeProps(frames)) assert.equal(p, "opacity", `plato-cell animates ${p}`);
  // lit only during its own turn: every stop past 100/13 % is off
  const turn = 100 / board.count;
  let stops = 0;
  for (const st of frames.matchAll(/([\d.,%\s]+)\{([^}]*)\}/g)) {
    const op = Number(st[2].match(/opacity\s*:\s*([\d.]+)/)?.[1]);
    for (const pct of st[1].split(",").map((s) => parseFloat(s))) {
      stops++;
      if (pct > turn + 1e-9) assert.equal(op, 0, `the glow is still on at ${pct}%`);
      assert.ok(op <= 0.4, "the glow hides the value");
    }
  }
  assert.ok(stops >= 3);
});

test("each marker screen has a glow under its score, out of step by INTRO_LOOPS.markers (RF-121, RF-85)", () => {
  const { markers } = LOOPS_LIB.INTRO_LOOPS;
  const people = stageGroup("people");
  for (const n of [1, 2, 3]) {
    const g = people.children.find((c) => hasClass(c, `plato__group-${n}`));
    const glow = g.children.filter((c) => hasClass(c, "plato__score-glow"));
    assert.equal(glow.length, 1, `group ${n} has no score glow`);
    assert.equal(glow[0].tag, "rect");
    assert.equal(attr(glow[0], "opacity"), "0");
    const i = g.children.indexOf(glow[0]);
    assert.equal(g.children[i - 1].tag, "rect", "the glow is not on the screen");
    assert.ok(hasClass(g.children[i + 1], "plato__score"), "the glow is not right under the score");
  }
  const rule = ruleFor(".plato__score-glow");
  assert.ok(rule, "no .plato__score-glow rule");
  const m = rule.body.match(/animation\s*:\s*([^;]+);/);
  assert.match(m[1], /^plato-screen\b/);
  assert.match(m[1], /\binfinite\b/);
  assert.equal(firstTimeMs(m[1]), markers.cycleMs);
  const step = markers.cycleMs / markers.count;
  for (const n of [2, 3]) {
    const r = ruleFor(`.plato__group-${n} .plato__score-glow`);
    assert.ok(r, `no delay for group ${n}`);
    assert.equal(toMs(r.body.match(/animation-delay\s*:\s*([\d.]+m?s)/)[1]), (n - 1) * step);
  }
  const frames = keyframesBody("plato-screen");
  assert.ok(frames, "missing @keyframes plato-screen");
  for (const [p] of keyframeProps(frames)) assert.equal(p, "opacity", `plato-screen animates ${p}`);
  assert.ok(Math.max(...keyframeOpacities(frames)) <= 0.3, "the screen glow hides the score");
});

test("the 4 spots swing from the rail in their own <g>, apart from their glow (RF-122, RF-99)", () => {
  const lights = stageGroup("lights");
  const swings = lights.children.filter((n) => hasClass(n, "plato__swing"));
  assert.equal(swings.length, 4);
  for (const s of swings) {
    assert.equal(s.tag, "g");
    assert.equal(s.children.length, 1);
    assert.ok(hasClass(s.children[0], "plato__spot"), "the swing group does not hold its spot");
    assert.ok(!hasClass(s, "plato__spot"), "swing and glow on the same element");
    const cx = attr(s.children[0], "cx");
    assert.match(attr(s, "style"), new RegExp(`^transform-origin:\\s*${cx}px\\s+\\d+(\\.\\d+)?px$`), "not pivoting on its rail hook");
  }
  const rule = ruleFor(".plato__swing");
  assert.ok(rule, "no .plato__swing rule");
  assert.match(rule.body, /transform-box\s*:\s*view-box/);
  const m = rule.body.match(/animation\s*:\s*([^;]+);/);
  assert.match(m[1], /^plato-swing\b/);
  assert.match(m[1], /\binfinite\b/);
  assert.match(m[1], /\balternate\b/);
  assert.ok(firstTimeMs(m[1]) >= 1000);
  const frames = keyframesBody("plato-swing");
  assert.ok(frames, "missing @keyframes plato-swing");
  for (const [p] of keyframeProps(frames)) assert.equal(p, "transform");
  const degs = [...frames.matchAll(/rotate\((-?[\d.]+)deg\)/g)].map((d) => Number(d[1]));
  assert.deepEqual(degs.sort((a, b) => a - b), [-6, 6]);
});

test("the floor light ellipse drifts sideways, inside the stage (RF-122)", () => {
  const ellipse = stageGroup("floor").children.find((n) => n.tag === "ellipse");
  assert.ok(hasClass(ellipse, "plato__floor-light"));
  const rule = ruleFor(".plato__floor-light");
  assert.ok(rule, "no .plato__floor-light rule");
  assert.match(rule.body, /transform-box\s*:\s*fill-box/);
  const m = rule.body.match(/animation\s*:\s*([^;]+);/);
  assert.match(m[1], /^plato-floor\b/);
  assert.match(m[1], /\binfinite\b/);
  assert.match(m[1], /\balternate\b/);
  assert.ok(firstTimeMs(m[1]) >= 1000);
  const frames = keyframesBody("plato-floor");
  assert.ok(frames, "missing @keyframes plato-floor");
  for (const [p] of keyframeProps(frames)) assert.equal(p, "transform");
  const shifts = [...frames.matchAll(/translateX\((-?[\d.]+)%\)/g)].map((d) => Number(d[1]));
  assert.deepEqual(shifts.sort((a, b) => a - b), [-4, 4]);
  // ±4 % of its width keeps it inside the 300-unit stage
  const cx = Number(attr(ellipse, "cx"));
  const rx = Number(attr(ellipse, "rx"));
  const d = 0.04 * 2 * rx;
  assert.ok(cx - rx - d >= 0 && cx + rx + d <= 300, "the ellipse leaves the stage");
});

test("the new loops run forever and stay off with reduced motion (RF-8, RF-87, RF-124)", () => {
  const rules = platoRules();
  for (const cls of ["swing", "cell-glow", "score-glow", "floor-light", "bulb", "onair", "contestant", "beam", "spot"]) {
    const rule = rules.find(
      (r) => new RegExp(String.raw`\.plato__${cls}(?![\w-])`).test(r.selector) && /animation\s*:[^;]*\binfinite\b/.test(r.body),
    );
    assert.ok(rule, `.plato__${cls} has no infinite animation`);
  }
  // the glows are off by their opacity attribute, not by CSS, so with animation: none they stay off
  for (const r of rules.filter((r) => /glow/.test(r.selector))) assert.doesNotMatch(r.body, /(^|[^-])opacity\s*:/);
  // the spots' glow offsets now count the swing groups, since each spot is alone in its group
  assert.ok(ruleFor(".plato__swing:nth-of-type(2n) .plato__spot"), "no offset for every other spot");
});

test("the HTML keeps the final scores 300/500/200 and intro.js counts with intro-entry.js (RF-85, RF-87, RF-123)", () => {
  assert.deepEqual(svgTexts(PLATO_SVG, "plato__score"), ["300", "500", "200"]);
  assert.match(INTRO_JS, /import\s*\{[^}]*markerValueAt[^}]*\}\s*from\s*"\.\.\/\.\.\/lib\/intro-entry\.js"/);
  assert.match(INTRO_JS, /markerCountPlan/);
  assert.match(INTRO_JS, /getAnimations/);
  assert.doesNotMatch(INTRO_JS, /setInterval|innerHTML/);
});

test("main.js starts the intro count when the intro shows and stops it when it leaves (RF-123, RF-124)", () => {
  const MAIN = read("js/app/main.js");
  assert.match(MAIN, /introScreen\s*=\s*mountIntro\(/);
  assert.match(MAIN, /introScreen\.show\(\)/);
  assert.match(MAIN, /introScreen\.hide\(\)/);
});

// --- T17: city in plan view (RF-69 to RF-72, RF-76, RF-78, plan §14.6) ---------

const CITY_SVG = HTML.match(/<svg id="city"[\s\S]*?<\/svg>/)?.[0] ?? "";

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
  // T34 (user decision, option a): the 40 % box is .city-box, the map alone; .city-wrap also holds header and bar
  const wrap = cssRules(CSS).find((r) => /\[data-screen="question"\] \.city-box$/.test(r.selector));
  assert.ok(wrap, 'no [data-screen="question"] .city-box rule');
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
  assert.match(HTML, /<p class="final__thanks"><span aria-hidden="true">Thank you<\/span><span class="visually-hidden">Thank you<\/span><\/p>/); // T38: literal copy for readers
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
  assert.doesNotMatch(screen.body, /\b(bottom|left|right|inset)\s*:/);
  assert.match(screen.body, /flex\s*:\s*none/);
  assert.doesNotMatch(screen.body, /transform/, "a transform would pin the fixed confetti to the panel");
  assert.doesNotMatch(CSS, /\.screen--final:has\(/, "no compensation rule for the offline notice");
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

test("fade.js fades with the Web Animations API and cancels when done (plan §15.3)", () => {
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

// --- T35: "rise" on the fade-in, back to the top and focus without scroll (RF-103, RF-143, RF-147, plan §16.6) ---

/** Body of an exported function of fade.js (up to the next top-level closing brace). */
function fadeFn(name) {
  return FADE_JS.match(new RegExp(String.raw`export function ${name}\b[\s\S]*?\n\}`))?.[0] ?? "";
}

test("fade.js only animates opacity and transform, rising 10 px at most (RF-143, plan §16.6)", () => {
  const keyframes = [...FADE_JS.matchAll(/\{\s*opacity\s*:[^{}]*\}/g)].map((m) => m[0]);
  assert.ok(keyframes.length >= 4, "fade-out, plain fade-in and rise keyframes");
  for (const kf of keyframes) {
    const props = [...kf.matchAll(/([a-zA-Z]+)\s*:/g)].map((m) => m[1]);
    for (const p of props) assert.ok(p === "opacity" || p === "transform", `fade.js animates ${p}`);
  }
  const shifts = [...FADE_JS.matchAll(/translateY\(\s*(-?[\d.]+)px\s*\)/g)].map((m) => Number(m[1]));
  assert.ok(shifts.length >= 1, "the rise moves the content with translateY()");
  for (const y of shifts) assert.ok(Math.abs(y) <= 10, `translateY(${y}px) is more than 10 px`);
  assert.doesNotMatch(FADE_JS, /translate(X|3d)?\(|rotate|scale|skew/i);
});

test("fadeIn takes a rise option and fadeOut stays opacity only (RF-143, plan §16.6)", () => {
  assert.match(FADE_JS, /export function fadeIn\(\s*elements\s*,\s*ms\s*,\s*\{\s*rise\s*=\s*false\s*\}\s*=\s*\{\}\s*\)/);
  assert.match(fadeFn("fadeIn"), /\brise\s*\?/);
  assert.doesNotMatch(fadeFn("fadeOut"), /transform/);
});

test("main.js passes plan.rise and fades in from the top, focusing the title without scroll (RF-143, RF-147)", () => {
  assert.match(MAIN_JS, /fadeIn\([^;]*,\s*plan\.inMs\s*,\s*\{\s*rise\s*:\s*plan\.rise\s*\}\s*\)/);
  assert.match(MAIN_JS, /scrollTo\(\s*0\s*,\s*0\s*\)/);
  assert.match(MAIN_JS, /\[data-title\]"\)\?\.focus\(\{\s*preventScroll\s*:\s*true\s*\}\)/);
  assert.doesNotMatch(MAIN_JS, /\.focus\(\s*\)/, "a plain focus() would scroll the page to the title");
  // back to the top before the focus moves, in the same step that starts the fade-in
  const render = MAIN_JS.match(/function render\(\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.ok(render.indexOf("scrollTo(0, 0)") >= 0 && render.indexOf("scrollTo(0, 0)") < render.indexOf("preventScroll"));
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

// --- T33: city on the 6 x 4 grid of the demo (RF-69 to RF-72, RF-111 to RF-113, RF-133, RF-141, plan §16.4) ---

test("the city is a 2D grid map: viewBox 0 0 400 292, no sky, moon, stars or skyline (RF-69)", () => {
  assert.ok(CITY_SVG, "no #city SVG");
  assert.match(CITY_SVG, new RegExp(`<svg id="city"[^>]*viewBox="0 0 ${VIEW_W} ${VIEW_H}"`));
  for (const cls of ["city__sky", "city__moon", "city__stars", "city__skyline"]) {
    assert.ok(!HTML.includes(cls), `index.html still has ${cls}`);
    assert.ok(!CSS.includes(cls), `survey.css still has ${cls}`);
  }
});

test("the map is clipped to a rounded 400 x 292 rect with a visible border on top (RF-111)", () => {
  assert.match(CITY_SVG, /<clipPath id="map-clip"><rect width="400" height="292" rx="12"\/><\/clipPath>/);
  assert.match(CITY_SVG, /<g class="city__map" clip-path="url\(#map-clip\)">/);
  assert.match(CITY_SVG, /<rect class="city__ground" width="400" height="292"\/>/);
  const borderEl = CITY_ELS.find((el) => elHas(el, "city__border"));
  assert.ok(borderEl, "no .city__border");
  assert.deepEqual(["x", "y", "width", "height", "rx"].map((k) => borderEl.attrs[k]), ["1", "1", "398", "290", "11"]);
  assert.ok(!within(borderEl, "city__map"), "the border is clipped");
  const rules = cssRules(CSS);
  assert.match(rules.find((r) => r.selector === ".city").body, /overflow\s*:\s*hidden/);
  const borderCss = rules.find((r) => r.selector === ".city__border");
  assert.ok(borderCss, "no .city__border rule");
  assert.match(borderCss.body, /fill\s*:\s*none/);
  assert.match(borderCss.body, /stroke\s*:\s*var\(--line\)/);
  assert.match(borderCss.body, /stroke-width\s*:\s*2\b/);
});

test("the drawing groups are in the order of plan §16.4, and the generated ones are empty and decorative (RF-70, RNF-4)", () => {
  const open = CITY_SVG.indexOf('<g class="city__map"');
  const close = CITY_SVG.indexOf('class="city__border"');
  const order = [
    'class="city__ground"', 'class="city__streets"', 'class="city__fillers"', 'class="city__lamps"',
    'class="city__halos"', 'class="site"', 'class="city__cars"', 'class="city__labels"', 'class="city__wave"',
  ];
  let last = open;
  for (const cls of order) {
    const at = CITY_SVG.indexOf(cls, last);
    assert.ok(at > last && at < close, `${cls} is not inside .city__map in order`);
    last = at;
  }
  for (const cls of ["city__streets", "city__fillers", "city__lamps"]) {
    const m = CITY_SVG.match(new RegExp(`<g class="${cls}" aria-hidden="true">([\\s\\S]*?)</g>`));
    assert.ok(m, `no <g class="${cls}" aria-hidden="true">`);
    assert.equal(m[1].trim(), "", `${cls} is filled by mountCityGrid`);
  }
  assert.match(CITY_SVG, /<g class="city__halos" aria-hidden="true">/);
});

test("the old city is gone: no blocks, nature, water, trees, shadows, roof faces, --fx or window pattern (RF-109, RF-110 derogated)", () => {
  const gone = [
    "city__blocks", "city__nature", "shadow", "filler__roof", "filler__face", "filler__ridge", "green", "water",
    "tree", "block", "body--top", "glow-pink", "street--v", "street__line", "street__zebra",
  ];
  for (const cls of gone) {
    assert.doesNotMatch(CITY_SVG, new RegExp(`class="(?:[^"]*\\s)?${cls}(?:\\s[^"]*)?"`), `index.html still has .${cls}`);
    assert.doesNotMatch(CSS, new RegExp(`\\.${cls}(?![\\w-])`), `survey.css still has .${cls}`);
  }
  assert.doesNotMatch(CITY_SVG, /--fx/);
  assert.doesNotMatch(CSS, /--fx\b/);
  assert.doesNotMatch(CITY_SVG, /id="windows"/);
  for (const name of ["city-face-on", "city-green-on", "city-water-on", "water-ripple"]) {
    assert.doesNotMatch(CSS, new RegExp(`@keyframes ${name}\\b`), `@keyframes ${name} is still there`);
  }
  assert.doesNotMatch(CITY_SVG, /<filter\b|filter=/);
});

test("each site sits in its SITE_CELLS cell with a pad and a ring of the cell, and one icon band (RF-71, RF-134, RF-139)", () => {
  const sites = siteGroups();
  assert.deepEqual(sites.map((s) => s.id).sort(), [...SITE_IDS].sort());
  for (const s of sites) {
    const g = CITY_ELS.find((el) => el.tag === "g" && el.attrs["data-site"] === s.id);
    const box = cellBox(...SITE_CELLS[s.id]);
    assert.equal(g.attrs.class, "site");
    assert.equal(g.attrs.transform, `translate(${box.x} ${box.y})`, `${s.id} is not in its cell`);
    const of = (cls) => s.parts.filter((el) => elHas(el, cls));
    for (const cls of ["site__pad", "site__ring"]) {
      assert.equal(of(cls).length, 1, `${s.id} needs one .${cls}`);
      const r = of(cls)[0];
      assert.equal(r.tag, "rect");
      assert.deepEqual(["x", "y", "width", "height"].map((k) => Number(r.attrs[k] ?? 0)), [0, 0, CELL_W, CELL_H], `${s.id} .${cls}`);
    }
    const icon = of("site__icon");
    assert.equal(icon.length, 1, `${s.id} needs one .site__icon group`);
    assert.equal(icon[0].attrs.transform, "translate(0 2)", `${s.id}: the icon band starts 2 units down (SITE_LAYOUT.icon)`);
    assert.ok(s.parts.some((el) => elHas(el, "body")), `${s.id} has no .body`);
    assert.ok(s.parts.some((el) => elHas(el, "lt") || elHas(el, "lt-stroke")), `${s.id} has no light`);
  }
  assert.doesNotMatch(CITY_SVG, /<text\b/, "no visible text in the HTML: labels come from city.js");
});

test("every icon shape stays inside its 0-56 x 0-38 band, so the label fits in the cell below it (RF-141)", () => {
  let checked = 0;
  for (const s of siteGroups()) {
    const box = cellBox(...SITE_CELLS[s.id]);
    for (const el of s.parts.filter((p) => within(p, "site__icon") && ["rect", "circle", "ellipse"].includes(p.tag))) {
      const b = elBox(el);
      const local = { x: b.x - box.x, y: b.y - box.y - 2, w: b.w, h: b.h };
      const eps = 1e-6;
      assert.ok(
        local.x >= -eps && local.y >= -eps && local.x + local.w <= CELL_W + eps && local.y + local.h <= 38 + eps,
        `${s.id}: ${el.tag}.${el.attrs.class} leaves its band: ${JSON.stringify(local)}`,
      );
      checked += 1;
    }
  }
  assert.ok(checked >= 60, `only ${checked} shapes checked`);
});

test("the icons only use translate(): the shapes are where the tests measure them", () => {
  for (const m of CITY_SVG.matchAll(/transform="([^"]*)"/g)) {
    assert.match(m[1], /^translate\([-\d.]+ [-\d.]+\)$/, m[1]);
  }
});

test("each site has a warm halo in .city__halos, centred on its cell, under the icons and labels (RF-133)", () => {
  const halos = CITY_ELS.filter((el) => elHas(el, "site__halo"));
  assert.deepEqual(halos.map((h) => h.attrs["data-halo"]).sort(), [...SITE_IDS].sort());
  for (const h of halos) {
    assert.ok(within(h, "city__halos"), "the halo is not in .city__halos");
    assert.equal(h.tag, "ellipse");
    assert.equal(h.attrs.fill, "url(#glow)");
    const box = cellBox(...SITE_CELLS[h.attrs["data-halo"]]);
    assert.equal(Number(h.attrs.cx) + h.dx, box.x + CELL_W / 2);
    assert.equal(Number(h.attrs.cy) + h.dy, box.y + CELL_H / 2);
    assert.equal(h.attrs.rx, "50");
    assert.equal(h.attrs.ry, "50");
  }
  assert.match(CITY_SVG, /<radialGradient id="glow">/);
  const rules = cssRules(CSS);
  const base = rules.find((r) => r.selector === ".site__halo");
  assert.ok(base, "no .site__halo rule");
  assert.match(base.body, /opacity\s*:\s*0\s*;/);
  const t = base.body.match(/transition\s*:\s*opacity\s+(\d+)ms/);
  assert.ok(t && Number(t[1]) <= 900, "the halo fades in within 900 ms");
  const lit = rules.find((r) => r.selector === ".site__halo.is-lit");
  assert.ok(lit, "no .site__halo.is-lit rule");
  assert.match(lit.body, /opacity\s*:\s*1\s*;/);
  for (const r of rules.filter((r) => /site__halo/.test(r.selector) && /opacity\s*:\s*1\b/.test(r.body))) {
    for (const s of r.selector.split(",")) assert.match(s, /\.is-lit/, `${s.trim()} shows a halo of a site that is not lit`);
  }
});

test("data-instant switches off the fades of halos and labels for the first paint (RF-112, RF-138)", () => {
  const rule = cssRules(CSS).find(
    (r) => /#city\[data-instant\] \.site__halo/.test(r.selector) && /#city\[data-instant\] \.site-label/.test(r.selector),
  );
  assert.ok(rule, "no #city[data-instant] rule for halos and labels");
  assert.match(rule.body, /transition\s*:\s*none/);
});

test("the ring of a new site is off at rest: a gold stroke on the cell box (RF-134)", () => {
  const rule = cssRules(CSS).find((r) => r.selector === ".site__ring");
  assert.ok(rule, "no .site__ring rule");
  assert.match(rule.body, /fill\s*:\s*none/);
  assert.match(rule.body, /stroke\s*:\s*var\(--gold\)/);
  assert.match(rule.body, /opacity\s*:\s*0\s*;/);
});

test("labels: gold Big Shoulders 700 at 11.5 units with a dark stroke over a dark translucent box (RF-113, RF-141, RF-142)", () => {
  const rules = cssRules(CSS);
  const text = rules.find((r) => r.selector === ".site-label__text");
  assert.ok(text, "no .site-label__text rule");
  assert.match(text.body, /fill\s*:\s*var\(--gold\)/);
  assert.match(text.body, /font\s*:\s*700 11\.5px\/1\.15 var\(--display\)/);
  assert.match(text.body, /stroke\s*:\s*var\(--night\)/);
  assert.match(text.body, /paint-order\s*:\s*stroke/);
  assert.match(text.body, /text-anchor\s*:\s*middle/);
  assert.doesNotMatch(text.body, /text-transform/, "normal case: CHAR_WIDTH is measured on it");
  const bg = rules.find((r) => r.selector === ".site-label__bg");
  assert.ok(bg, "no .site-label__bg rule");
  assert.match(bg.body, /fill\s*:\s*rgb\(6 10 34 \/ \.8\)/);
  assert.match(CITY_JS, /rx: 3/);
  // gold on the night box: well over 4.5:1 (the halo under the box is at most half as bright as the box)
  assert.ok(contrast(rootVar("--gold"), rootVar("--night")) >= 4.5);
});

test("city.js generates streets, fillers and lamps from city-grid.js; main.js mounts the grid before the labels", () => {
  assert.match(CITY_JS, /export function mountCityGrid\(svg/);
  assert.match(CITY_JS, /from "\.\.\/lib\/city-grid\.js"/);
  assert.match(CITY_JS, /export function paintCity\(svg, view, \{ instant = false, raf = /);
  assert.match(CITY_JS, /querySelectorAll\("\[data-halo\]"\)/);
  assert.match(MAIN_JS, /import \{[^}]*\bmountCityGrid\b[^}]*\} from "\.\/city\.js"/);
  const grid = MAIN_JS.indexOf("mountCityGrid(city)");
  assert.ok(grid > 0, "main.js does not call mountCityGrid(city)");
  assert.equal(MAIN_JS.split("mountCityGrid(city)").length, 2, "mountCityGrid is called more than once");
  assert.ok(grid < MAIN_JS.indexOf("mountCityLabels(city)"), "the grid is mounted before the labels");
  assert.match(MAIN_JS, /instant: shownScreen === null/);
});

test("off street lamps are visible in a dim tone and never animated; the lit layer fades in over them (RF-140, Anexo C)", () => {
  const rules = cssRules(CSS);
  const off = rules.find((r) => r.selector === ".lamp-off");
  assert.ok(off, "no .lamp-off rule");
  assert.match(off.body, /fill\s*:\s*#1c2670/i, "off lamps take the dim tone of the demo");
  assert.doesNotMatch(off.body, /opacity\s*:\s*0\b/, "off lamps are visible");
  for (const r of rules.filter((r) => /\.lamp-off\b|\.lamps__off\b/.test(r.selector))) {
    assert.doesNotMatch(r.body, /opacity\s*:\s*0\b|display\s*:\s*none|visibility\s*:\s*hidden|animation\s*:/, `${r.selector} hides or animates the off lamps`);
  }
  // the lit lamp keeps its warm fill and is only faded with opacity (RNF-12)
  const lamp = rules.find((r) => r.selector === ".lamp");
  assert.match(lamp.body, /fill\s*:\s*var\(--lit\)/);
  assert.match(lamp.body, /transition\s*:\s*opacity\b/);
});

test("pads, buildings, lamps and streets have their off and all-lit looks (RF-72, RF-140)", () => {
  const rules = cssRules(CSS);
  const base = (sel) => rules.find((r) => r.selector === sel);
  for (const sel of [".filler__pad", ".filler__b", ".street", ".site__pad"]) assert.ok(base(sel), `no ${sel} rule`);
  for (const cls of ["filler__pad", "filler__b", "street"]) {
    assert.ok(
      rules.some((r) => r.selector.split(",").some((s) => s.trim() === `#city[data-all-lit] .${cls}`)),
      `no #city[data-all-lit] .${cls} rule`,
    );
  }
});

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

test("the Ferris wheel is its own <g class=\"wheel\"> inside the fairground", () => {
  const wheel = CITY_ELS.filter((el) => el.tag === "g" && elHas(el, "wheel"));
  assert.equal(wheel.length, 1);
  const fair = siteGroups().find((s) => s.id === "fairground");
  assert.ok(fair.parts.includes(wheel[0]), "the wheel is not in the fairground");
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

/** Box of a street of the grid (js/lib/city-grid.js): GAP wide, along the whole map. */
const STREET_BOXES = [
  ...GRID_STREETS.h.map((y) => ({ vertical: false, box: { x: 0, y: y - GAP / 2, w: VIEW_W, h: GAP } })),
  ...GRID_STREETS.v.map((x) => ({ vertical: true, box: { x: x - GAP / 2, y: 0, w: GAP, h: VIEW_H } })),
];

test("4 cars, one on each horizontal street and 1 on the vertical one at x = 200, inside its street (RF-114, T33)", () => {
  const list = cars();
  assert.equal(list.length, 4, "4 .car groups");
  assert.deepEqual(list.map((c) => c.n), ["1", "2", "3", "4"]);
  assert.equal(list.filter((c) => c.axis === "x").length, 3);
  assert.equal(list.filter((c) => c.axis === "y").length, 1);
  const avenues = [];
  for (const c of list) {
    const street = STREET_BOXES.find((s) =>
      c.axis === "x"
        ? !s.vertical && c.box.y >= s.box.y && c.box.y + c.box.h <= s.box.y + s.box.h
        : s.vertical && c.box.x >= s.box.x && c.box.x + c.box.w <= s.box.x + s.box.w,
    );
    assert.ok(street, `car ${c.n} (${c.axis}) is not inside a street of its axis: ${JSON.stringify(c.box)}`);
    if (c.axis === "x") avenues.push(street.box.y + GAP / 2);
    else assert.equal(street.box.x + GAP / 2, 200, "the vertical car drives down the middle street");
  }
  assert.deepEqual(avenues, [...GRID_STREETS.h], "one car on each horizontal street, from the top down");
});

test("each car loops along its own axis only, from its resting place, across the whole 400 x 292 map and back in (RF-114, RF-117)", () => {
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
    assert.deepEqual([values[0].at, values[0].v], [0, 0]);
    assert.deepEqual([values.at(-1).at, values.at(-1).v], [100, 0]);
    const pos = c.axis === "x" ? c.box.x : c.box.y;
    const size = c.axis === "x" ? c.box.w : c.box.h;
    const edge = c.axis === "x" ? VIEW_W : VIEW_H;
    const lo = Math.min(...values.map((p) => p.v));
    const hi = Math.max(...values.map((p) => p.v));
    assert.ok(pos + lo + size <= 0, `car ${c.n} never leaves through the start edge`);
    assert.ok(pos + hi >= edge, `car ${c.n} never leaves through the far edge`);
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
  assert.deepEqual(dirs, [1, -1, 1]);
});

test("the cars no longer park: final-car and --car-from are gone (RF-53, RF-114)", () => {
  assert.doesNotMatch(CSS, /final-car|--car-from/);
  assert.doesNotMatch(HTML, /--car-from/);
});

test("windows, lamps, stadium, Ferris wheel and nightclub loop under [data-final-live] and [data-all-lit] (RF-115, RF-116)", () => {
  const rules = liveRules();
  const targets = [
    ".filler__lights[data-twinkle]",
    ".lamps__a",
    ".lamps__b",
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
  assert.ok(rules.length >= 11, `${rules.length} living rules`); // 12 until T33 removed the pond
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

// --- T31: own type, served from the site (plan §16.2; RF-142, RF-145, RNF-5, RNF-13) ---

const FONTS_DIR = path.join(ROOT, "assets", "fonts");
const FONT_FILES = [
  "big-shoulders-display-latin-700.woff2",
  "big-shoulders-display-latin-800.woff2",
  "figtree-latin-400.woff2",
  "figtree-latin-600.woff2",
  "figtree-latin-700.woff2",
];
const fontFaces = () => [...CSS.matchAll(/@font-face\s*\{([^{}]*)\}/g)].map((m) => m[1]);

test("assets/fonts holds at most 5 woff2, the 5 of the plan, valid and 150 KB or less in total (RNF-13)", () => {
  const woff2 = fs.readdirSync(FONTS_DIR).filter((f) => f.endsWith(".woff2")).sort();
  assert.ok(woff2.length <= 5, `${woff2.length} woff2 files`);
  assert.deepEqual(woff2, [...FONT_FILES].sort());
  let total = 0;
  for (const f of woff2) {
    const file = path.join(FONTS_DIR, f);
    total += fs.statSync(file).size;
    assert.equal(fs.readFileSync(file).subarray(0, 4).toString("latin1"), "wOF2", `${f} is not woff2`);
  }
  assert.ok(total <= 150 * 1024, `${total} bytes`);
});

test("the SIL Open Font License of each family sits next to the fonts (RNF-13)", () => {
  for (const f of ["OFL-BigShouldersDisplay.txt", "OFL-Figtree.txt"]) {
    const text = fs.readFileSync(path.join(FONTS_DIR, f), "utf8");
    assert.match(text, /SIL Open Font License, Version 1\.1/, f);
  }
  assert.match(fs.readFileSync(path.join(FONTS_DIR, "OFL-BigShouldersDisplay.txt"), "utf8"), /Big Shoulders/);
  assert.match(fs.readFileSync(path.join(FONTS_DIR, "OFL-Figtree.txt"), "utf8"), /Figtree/);
});

test("5 @font-face with font-display: optional, a latin unicode-range and a relative url() to each file (RF-142, RF-145)", () => {
  const faces = fontFaces();
  assert.equal(faces.length, 5);
  const urls = [];
  for (const body of faces) {
    assert.match(body, /font-display\s*:\s*optional\s*;/);
    assert.match(body, /unicode-range\s*:\s*U\+0000-00FF/i);
    assert.match(body, /format\(\s*["']woff2["']\s*\)/);
    const url = body.match(/url\(\s*["']?([^"')]+)["']?\s*\)/)[1];
    assert.match(url, /^\.\.\/assets\/fonts\/[a-z0-9-]+\.woff2$/);
    urls.push(url.split("/").pop());
  }
  assert.deepEqual(urls.sort(), [...FONT_FILES].sort());
});

test("--display and --body fall back to the system --sans stack; .plato text keeps var(--sans) (RF-142, RF-145)", () => {
  assert.equal(rootVar("--display"), '"big shoulders display", var(--sans)');
  assert.equal(rootVar("--body"), '"figtree", var(--sans)');
  const plato = cssRules(CSS).find((r) => r.selector === ".plato text");
  assert.match(plato.body, /font-family\s*:\s*var\(--sans\)/);
});

test("index.html preloads only Figtree 400 and 700, same-origin and crossorigin (RNF-5)", () => {
  const preloads = [...HTML.matchAll(/<link[^>]*rel="preload"[^>]*>/g)].map((m) => m[0]).filter((l) => /as="font"/.test(l));
  const hrefs = preloads.map((l) => l.match(/href="([^"]+)"/)[1]).sort();
  assert.deepEqual(hrefs, ["assets/fonts/figtree-latin-400.woff2", "assets/fonts/figtree-latin-700.woff2"]);
  for (const l of preloads) {
    assert.match(l, /type="font\/woff2"/);
    assert.match(l, /\scrossorigin(\s|>|=)/);
  }
});

test("no external font service: no http font URL in any stylesheet or in index.html (RF-142, RNF-13)", () => {
  const sheets = fs.readdirSync(path.join(ROOT, "css")).filter((f) => f.endsWith(".css")).map((f) => read(`css/${f}`).replace(/\/\*[\s\S]*?\*\//g, ""));
  for (const text of [...sheets, HTML.replace(/<!--[\s\S]*?-->/g, "")]) {
    assert.doesNotMatch(text, /fonts\.googleapis|fonts\.gstatic|use\.typekit|fontsource/i);
    for (const m of text.matchAll(/url\(\s*["']?(https?:[^"')]+)/gi)) assert.fail(`external url(): ${m[1]}`);
    assert.doesNotMatch(text, /<link[^>]*href="https?:[^"]*"[^>]*as="font"|<link[^>]*as="font"[^>]*href="https?:/i);
  }
});

// --- T34: progress header, question bar, ring and "Lit up" toast (RF-125 to RF-138, RF-148, RF-77, RNF-4, plan §16.5) ---

const GAP_RE = String.raw`(?:\s|<!--[\s\S]*?-->)*`; // spaces and HTML comments
const CITY_WRAP_HTML = HTML.match(new RegExp(
  String.raw`<div class="city-wrap" id="city-wrap"[\s\S]*?<\/svg>${GAP_RE}<p class="city__toast"[^>]*><\/p>${GAP_RE}<\/div>` +
  String.raw`${GAP_RE}<div class="segs"[^>]*><\/div>${GAP_RE}<\/div>`,
))?.[0] ?? "";

test("#city-wrap holds the header, the .city-box with the SVG and the toast, and the bar, all aria-hidden but the SVG (RF-125, RF-128, RF-131, RNF-4)", () => {
  assert.ok(CITY_WRAP_HTML, "#city-wrap is not header + .city-box (svg + toast) + .segs");
  const hud = CITY_WRAP_HTML.match(/<header class="hud"[^>]*>[\s\S]*?<\/header>/)?.[0] ?? "";
  assert.match(hud, /^<header class="hud" aria-hidden="true">/);
  assert.match(hud, /<span class="hud__brand">Leisure City<\/span>/);
  assert.match(hud, /<span class="hud__pct">0%<\/span>/);
  assert.match(hud, /<small class="hud__count">0 of 10 places<\/small>/);
  assert.ok(CITY_WRAP_HTML.indexOf('class="hud"') < CITY_WRAP_HTML.indexOf('class="city-box"'));
  assert.match(CITY_WRAP_HTML, /<div class="city-box">\s*<svg id="city"/);
  assert.match(CITY_WRAP_HTML, /<p class="city__toast" aria-hidden="true"><\/p>/);
  assert.match(CITY_WRAP_HTML, /<div class="segs" aria-hidden="true"><\/div>/);
});

test("the header and the bar fit RF-132: header <= 52 px, percentage <= 36 px on one line, bar 6 px, gaps <= 8 px", () => {
  const rule = (sel) => cssRules(CSS).find((r) => r.selector === sel);
  const hud = rule(".hud");
  assert.ok(hud, "no .hud rule");
  assert.match(hud.body, /display\s*:\s*flex/);
  assert.match(hud.body, /justify-content\s*:\s*space-between/);
  assert.match(hud.body, /align-items\s*:\s*flex-end/);
  assert.ok(Number(hud.body.match(/max-height\s*:\s*(\d+)px/)?.[1]) <= 52, ".hud max-height <= 52px");
  const pct = rule(".hud__pct");
  assert.ok(pct, "no .hud__pct rule");
  const size = Number(pct.body.match(/font\s*:\s*800 (\d+)px\/\.9 var\(--display\)/)?.[1]);
  assert.ok(size > 0 && size <= 36, "percentage in 800 <= 36px/.9 var(--display)");
  assert.match(pct.body, /tabular-nums/);
  const count = rule(".hud__count");
  assert.match(count?.body ?? "", /white-space\s*:\s*nowrap/);
  const brand = rule(".hud__brand");
  assert.match(brand?.body ?? "", /color\s*:\s*var\(--gold\)/);
  const segs = rule(".segs");
  assert.match(segs?.body ?? "", /grid-template-columns\s*:\s*repeat\(10,\s*1fr\)/);
  assert.ok(Number(segs.body.match(/gap\s*:\s*(\d+)px/)?.[1]) <= 8);
  const seg = rule(".segs i");
  assert.match(seg?.body ?? "", /height\s*:\s*6px/);
  const wrap = rule(".city-wrap");
  assert.match(wrap.body, /flex-direction\s*:\s*column/);
  assert.ok(Number(wrap.body.match(/(?:^|[^-])gap\s*:\s*(\d+)px/)?.[1]) <= 8, ".city-wrap gap <= 8px");
});

test("bar: filled segments gold, the current one outlined and never pulsing (RF-128, RF-129, RNF-2)", () => {
  const filled = cssRules(CSS).find((r) => r.selector === ".segs i.is-filled");
  assert.match(filled?.body ?? "", /background\s*:\s*var\(--gold\)/);
  const current = cssRules(CSS).find((r) => r.selector === ".segs i.is-current");
  assert.match(current?.body ?? "", /outline\s*:\s*1\.5px solid var\(--text\)/);
  assert.doesNotMatch(current.body, /animation/);
  const off = cssRules(CSS).find((r) => r.selector === ".segs i");
  assert.match(off.body, /background\s*:\s*var\(--seg-off\)/);
});

test("the ring grows at most 25 % and lasts at most 1.2 s, only on .site.is-new (RF-134)", () => {
  const kf = CSS.match(/@keyframes ring\s*\{([\s\S]*?)\}\s*\}/)?.[1] ?? "";
  assert.ok(kf, "no @keyframes ring");
  const scales = [...kf.matchAll(/scale\(([\d.]+)\)/g)].map((m) => Number(m[1]));
  assert.ok(scales.length >= 2 && scales.every((v) => v <= 1.25), `ring scales ${scales}`);
  assert.doesNotMatch(kf, /(width|height|stroke-width)\s*:/, "the ring animates only opacity and transform");
  const rule = cssRules(CSS).find((r) => r.selector === ".site.is-new .site__ring");
  assert.ok(rule, "no .site.is-new .site__ring rule");
  const dur = rule.body.match(/animation\s*:\s*ring ([\d.]+)(m?s)/);
  assert.ok(dur, "the ring rule plays @keyframes ring");
  const ms = Number(dur[1]) * (dur[2] === "s" ? 1000 : 1);
  assert.ok(ms <= 1200, `ring lasts ${ms} ms`);
  assert.doesNotMatch(rule.body, /infinite/);
});

test("toast: inside the map, bottom or top, never taking taps, night on gold with --lit text (RF-135, RF-137, RNF-4)", () => {
  const rule = (sel) => cssRules(CSS).find((r) => r.selector === sel);
  const box = rule(".city-box");
  assert.match(box?.body ?? "", /position\s*:\s*relative/);
  const toast = rule(".city__toast");
  assert.ok(toast, "no .city__toast rule");
  assert.match(toast.body, /position\s*:\s*absolute/);
  assert.match(toast.body, /pointer-events\s*:\s*none/);
  assert.match(toast.body, /opacity\s*:\s*0\s*;/);
  assert.match(toast.body, /background\s*:\s*var\(--night\)/);
  assert.match(toast.body, /color\s*:\s*var\(--lit\)/);
  assert.match(toast.body, /border\s*:\s*1px solid var\(--gold\)/);
  assert.match(toast.body, /white-space\s*:\s*nowrap/);
  assert.ok(contrast(rootVar("--lit"), rootVar("--night")) >= 4.5);
  assert.match(rule('.city__toast[data-place="top"]')?.body ?? "", /top\s*:\s*8px/);
  assert.match(rule('.city__toast[data-place="bottom"]')?.body ?? "", /bottom\s*:\s*8px/);
  assert.match(rule(".city__toast.is-shown")?.body ?? "", /opacity\s*:\s*1/);
});

test("reduced motion: the toast does not move, only fades (RF-77, RNF-2)", () => {
  const blocks = mediaBlocks(CSS, "(prefers-reduced-motion: reduce)").join("\n");
  const rule = cssRules(blocks).find((r) => /\.city__toast/.test(r.selector) && /transform/.test(r.body));
  assert.ok(rule, "no fixed transform for the toast with reduced motion");
  assert.match(rule.body, /transform\s*:\s*translate\(-50%,\s*0\)/);
});

test("header, map box and bar are in the page flow, never fixed or sticky (RF-146)", () => {
  for (const r of cssRules(CSS).filter((r) => /\.(hud|city-wrap|city-box|segs)\b/.test(r.selector))) {
    assert.doesNotMatch(r.body, /position\s*:\s*(fixed|sticky)/, r.selector);
  }
});

test("main.js mounts the bar and paints header and celebration with the city, in the same tick (RF-127, RF-138)", () => {
  assert.match(MAIN_JS, /import \{[^}]*\bmountHud\b[^}]*\bpaintHud\b[^}]*\bcelebrate\b[^}]*\} from "\.\/hud\.js"/);
  assert.match(MAIN_JS, /import \{ progressView \} from "\.\.\/lib\/progress\.js"/);
  assert.match(MAIN_JS, /\bcelebration\(/);
  assert.match(MAIN_JS, /mountHud\(cityWrap[,)]/);
  assert.match(MAIN_JS, /let prevLit = null/);
});

// --- T37: final on the grid: wave from the centre, living loops and layout with header and bar (plan §16.7) ---

test("the wave is a circle centred on the map, filled with the #wave-ring radial gradient (RF-73)", () => {
  const circle = CITY_SVG.match(/<circle class="city__wave"[^>]*\/>/)?.[0];
  assert.ok(circle, "no <circle class=\"city__wave\">");
  assert.match(circle, /cx="200"/);
  assert.match(circle, /cy="146"/);
  assert.match(circle, /fill="url\(#wave-ring\)"/);
  assert.doesNotMatch(CITY_SVG, /<rect class="city__wave"/, "the sweeping band is gone");
  assert.doesNotMatch(CITY_SVG, /id="wave"/, "the old linear gradient is gone");
  const gradient = CITY_SVG.match(/<radialGradient id="wave-ring"[\s\S]*?<\/radialGradient>/)?.[0];
  assert.ok(gradient, "no radialGradient#wave-ring");
  // a light ring: transparent inside, a bright stop, transparent at the edge
  const stops = [...gradient.matchAll(/<stop offset="([\d.]+)"[^>]*stop-opacity="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.ok(stops.length >= 3);
  assert.equal(stops[0][1], 0, "the centre of the ring is clear");
  assert.equal(stops.at(-1)[1], 0, "the edge of the ring fades out");
  const bright = stops.reduce((a, b) => (b[1] > a[1] ? b : a));
  assert.ok(bright[1] > 0 && bright[0] >= 0.8, "the bright band is near the edge");
  // in sync with --fd: at the end of the wave the bright band reaches the corners (distance 247.6), ±5 %
  const r = Number(circle.match(/\br="([\d.]+)"/)[1]);
  const corner = Math.hypot(200, 146);
  assert.ok(Math.abs(bright[0] * r - corner) / corner <= 0.05, `bright band ends at ${bright[0] * r}, corners at ${corner}`);
});

test("the wave only scales from the centre and fades: scale and opacity, linear over the wave phase (RF-73, RNF-12)", () => {
  const base = rulesWith(".city__wave").find((r) => /transform-box/.test(r.body));
  assert.ok(base, "no .city__wave rule with transform-box");
  assert.match(base.body, /transform-box\s*:\s*fill-box/);
  assert.match(base.body, /transform-origin\s*:\s*center/);
  const body = keyframesBody("final-wave");
  assert.ok(body, "no @keyframes final-wave");
  assert.match(body, /from\s*\{[^}]*transform\s*:\s*scale\(0\)/);
  assert.match(body, /to\s*\{[^}]*transform\s*:\s*scale\(1\)[^}]*opacity\s*:\s*0/);
  assert.doesNotMatch(body, /translate/, "no sweeping band any more");
  for (const m of body.matchAll(/([a-z-]+)\s*:/g)) assert.ok(["transform", "opacity"].includes(m[1]), m[1]);
  const play = rulesWith('.app[data-final="play"] .city__wave')[0];
  assert.match(play.body, /final-wave var\(--final-wave-dur\) linear var\(--final-wave-start\)/);
});

test("buildings, windows, lamps and streets light up with the wave by their --fd (RF-73, RF-140)", () => {
  const delay = /calc\(var\(--final-wave-start\) \+ var\(--final-wave-dur\) \* var\(--fd\)\)/;
  for (const cls of ["win", "lamp", "filler__b", "street"]) {
    const rule = rulesWith(`.app[data-final="play"] #city[data-all-lit] .${cls}`)[0];
    assert.ok(rule, `no wave rule for .${cls}`);
    assert.match(rule.body, delay, `.${cls} does not wait for its distance to the centre`);
  }
  assert.doesNotMatch(CSS, /var\(--fd, 0\)/, "no provisional fallback");
  // lit lamps are warm (RF-140)
  assert.ok(rulesWith("#city[data-all-lit] .lamp").length > 0);
  assert.match(rulesWith(".lamp")[0].body, /fill\s*:\s*var\(--lit\)/);
});

test("every living loop of the final hangs on [data-final-live] and [data-all-lit], never on play or done (RF-54, RF-117)", () => {
  const rules = liveRules();
  assert.ok(rules.length >= 11);
  for (const r of rules) {
    for (const s of r.selector.split(",")) {
      assert.ok(s.trim().startsWith(LIVE), s);
      assert.doesNotMatch(s, /data-final="/, s);
    }
  }
});

test("final layout: header, map and bar share the map width and sit together, centred, in the flow (RF-79, RF-130)", () => {
  const wrap = rulesWith('.app[data-screen="final"] .city-wrap')[0];
  assert.match(wrap.body, /container-type\s*:\s*size/, "the wrap is the size container of the map width");
  assert.match(wrap.body, /justify-content\s*:\s*center/);
  assert.match(wrap.body, /align-items\s*:\s*center/);
  // one width for header, map box and bar: as wide as the wrap, or as the height left for the map allows
  const kids = rulesWith('.app[data-screen="final"] .city-wrap > *')[0];
  assert.ok(kids, "no rule for the children of the final wrap");
  assert.match(kids.body, /width\s*:\s*min\(100cqw,\s*\(100cqh - 74px\) \* 400 \/ 292\)/);
  assert.match(kids.body, /flex\s*:\s*none/);
  // 74 px = header (52 at most) + 8 + 8 gaps + 6 bar
  assert.match(rulesWith(".hud")[0].body, /max-height\s*:\s*52px/);
  const box = rulesWith('.app[data-screen="final"] .city-box')[0];
  assert.match(box.body, /aspect-ratio\s*:\s*400 \/ 292/, "the box is exactly the map, no gaps above or below");
  for (const r of [wrap, kids, box]) assert.doesNotMatch(r.body, /position\s*:\s*(fixed|sticky|absolute)/, r.selector);
});
