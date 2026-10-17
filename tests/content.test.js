import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONTENT } from "../js/content.js";
import { SITE_IDS, OTHER_CODE, flagPath } from "../js/lib/sites.js";
import { validateContent, OPTION_TYPES } from "../js/lib/content-validate.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hasFlag = (code) => fs.existsSync(path.join(ROOT, flagPath(code)));

/** Deep copy of the real content, so each test can break exactly one rule. */
const copy = () => structuredClone(CONTENT);

/** Asserts that validating `content` reports at least one error matching `pattern`. */
function assertError(content, pattern, options) {
  const errors = validateContent(content, SITE_IDS, options);
  assert.ok(
    errors.some((e) => pattern.test(e)),
    `expected an error matching ${pattern}, got: ${JSON.stringify(errors)}`,
  );
}

// --- Sites and reserved code -------------------------------------------------

test("SITE_IDS lists the 10 leisure sites in question order", () => {
  assert.deepEqual(SITE_IDS, [
    "park", "concert-hall", "museum", "theatre", "cinema",
    "fairground", "town-square", "food-market", "nightclub", "stadium",
  ]);
});

test("OTHER_CODE is a reserved code that is not ISO alpha-2", () => {
  assert.equal(OTHER_CODE, "OTHER");
  assert.doesNotMatch(OTHER_CODE, /^[A-Z]{2}$/);
});

test("flagPath resolves the lowercase ISO code under assets/flags", () => {
  assert.equal(flagPath("FR"), "assets/flags/fr.svg");
  assert.equal(flagPath("CI"), "assets/flags/ci.svg");
});

// --- Real content --------------------------------------------------------------

test("the real content is valid (no errors), including flag files", () => {
  assert.deepEqual(validateContent(CONTENT, SITE_IDS, { hasFlag }), []);
});

test("content version is the test version", () => {
  assert.equal(CONTENT.version, "2026-10-test-2");
});

test("the countries are exactly NL, DE, IT, PL, JP, NG in that order (RF-3)", () => {
  assert.deepEqual(CONTENT.countries, [
    { code: "NL", name: "Netherlands" },
    { code: "DE", name: "Germany" },
    { code: "IT", name: "Italy" },
    { code: "PL", name: "Poland" },
    { code: "JP", name: "Japan" },
    { code: "NG", name: "Nigeria" },
  ]);
});

test("only the flags of the 6 countries remain in assets/flags", () => {
  const files = fs.readdirSync(path.join(ROOT, "assets/flags")).filter((f) => f.endsWith(".svg")).sort();
  assert.deepEqual(files, ["de.svg", "it.svg", "jp.svg", "ng.svg", "nl.svg", "pl.svg"]);
});

test("every country has an SVG flag served by the site", () => {
  for (const { code } of CONTENT.countries) {
    const file = path.join(ROOT, flagPath(code));
    assert.ok(fs.existsSync(file), `missing flag ${flagPath(code)}`);
    assert.match(fs.readFileSync(file, "utf8"), /<svg[\s>]/, `${flagPath(code)} is not an SVG`);
  }
});

test("the Other icon exists and is a globe with a square viewBox (RF-11)", () => {
  const file = path.join(ROOT, "assets/icons/other.svg");
  assert.ok(fs.existsSync(file));
  const svg = fs.readFileSync(file, "utf8");
  assert.match(svg, /<svg[\s>]/);
  const m = svg.match(/viewBox="\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*"/);
  assert.ok(m, "other.svg needs a viewBox");
  assert.equal(m[1], m[2], "the viewBox must be square");
  assert.match(svg, /<circle/, "the globe needs its outline circle");
  assert.match(svg, /<ellipse/, "the globe needs a meridian");
});

test("every SITE_ID is present as data-site in the city SVG of index.html", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  for (const id of SITE_IDS) {
    assert.ok(html.includes(`data-site="${id}"`), `index.html is missing data-site="${id}"`);
  }
});

test("questions match Annex A literally (texts, options, types and sites)", () => {
  const N = "normal", AO = "open-required", AP = "open-optional";
  const expected = [
    ["q1", "park", "Was there a moment when you stopped thinking about work, study or daily worries? What caused it?",
      [["I stopped thinking and felt truly in the moment.", N], ["I couldn't fully detach.", N]]],
    ["q2", "concert-hall", "Which part of the event made you feel most at ease or most energized?",
      [["Tell us…", AO], ["Nothing really had that effect on me.", N]]],
    ["q3", "museum", "Did the event feel meaningful to you? In what way?",
      [["The theme", N], ["The people", N], ["A message", N]]],
    ["q4", "theatre", "Did the event reach you in a way that other leisure activities don't?",
      [["It was different than I'm used to.", N], ["It didn't reach me differently.", N]]],
    ["q5", "cinema", "Which moment will you remember or tell others about?",
      [["Tell us…", AO], ["I won't remember this event.", N]]],
    ["q6", "fairground", "Did the atmosphere, location and set-up create a world of its own, or did it feel like just a gathering?",
      [["The set-up helped create its own atmosphere", N], ["It felt like a regular gathering", N]]],
    ["q7", "town-square", "Do you think events like this matter for society, for example for social cohesion, wellbeing or local community?",
      [["Social cohesion/wellbeing/local community", N], ["They don't matter", N]]],
    ["q8", "food-market", "Did you notice sustainability choices (food, materials, waste)? Did they affect how you felt about the event?",
      [["I was happy to see them", N], ["I didn't notice or there were no sustainability choices", N]]],
    ["q9", "nightclub", "Was the flow clear and the atmosphere consistent? Did anything feel out of place?",
      [["Nothing felt out of place", N], ["Something was a bit messy", AP]]],
    ["q10", "stadium", "Did anything practical (sound, queues, signage, timing) bother you during the event?",
      [["They didn't bother me at all", N], ["Something bothered me", AP]]],
  ];
  const actual = CONTENT.questions.map((q) => [
    q.id, q.site, q.text, q.options.map((o) => [o.label, o.type]),
  ]);
  assert.deepEqual(actual, expected);
  CONTENT.questions.forEach((q) =>
    assert.deepEqual(q.options.map((o) => o.letter), ["A", "B", "C"].slice(0, q.options.length)));
});

test("Q6-B uses the corrected wording", () => {
  assert.equal(CONTENT.questions[5].options[1].label, "It felt like a regular gathering");
});

test("no UI label carries the [open question]/[open answer] markers", () => {
  for (const q of CONTENT.questions) {
    for (const o of q.options) assert.doesNotMatch(o.label, /\[open/i);
  }
});

test("OPTION_TYPES are the three valid option types", () => {
  assert.deepEqual([...OPTION_TYPES], ["normal", "open-required", "open-optional"]);
});

// --- One case per RF-4 rule ---------------------------------------------------

test("rule: version must not be empty", () => {
  const c = copy(); c.version = "   ";
  assertError(c, /version/i);
  const d = copy(); delete d.version;
  assertError(d, /version/i);
});

test("rule: exactly 10 questions", () => {
  const c = copy(); c.questions.pop();
  assertError(c, /exactly 10 questions/i);
  const d = copy(); d.questions.push(structuredClone(d.questions[0]));
  assertError(d, /exactly 10 questions/i);
});

test("rule: question ids must be unique", () => {
  const c = copy(); c.questions[1].id = "q1";
  assertError(c, /duplicate question id/i);
});

test("rule: question id must not be empty", () => {
  const c = copy(); c.questions[2].id = "";
  assertError(c, /question #3.*id/i);
});

test("rule: question text must not be empty", () => {
  const c = copy(); c.questions[0].text = "  ";
  assertError(c, /q1.*text/i);
});

test("rule: 2 or 3 options per question", () => {
  const c = copy(); c.questions[0].options = c.questions[0].options.slice(0, 1);
  assertError(c, /q1.*2 or 3 options/i);
  const d = copy();
  d.questions[2].options.push({ letter: "D", label: "Extra", type: "normal" });
  assertError(d, /q3.*2 or 3 options/i);
});

test("rule: option letters A, B (and C) in that order", () => {
  const c = copy(); c.questions[0].options.reverse();
  assertError(c, /q1.*letters/i);
  const d = copy(); d.questions[2].options[2].letter = "D";
  assertError(d, /q3.*letters/i);
});

test("rule: option labels must not be empty", () => {
  const c = copy(); c.questions[3].options[1].label = "";
  assertError(c, /q4 option B.*label/i);
});

test("rule: option type must be valid", () => {
  const c = copy(); c.questions[4].options[0].type = "open";
  assertError(c, /q5 option A.*type/i);
});

test("rule: each question has a site", () => {
  const c = copy(); delete c.questions[0].site;
  assertError(c, /q1.*site/i);
});

test("rule: site must exist among the 10 city sites", () => {
  const c = copy(); c.questions[0].site = "library";
  assertError(c, /q1.*site "library"/i);
});

test("rule: site must be different in each question", () => {
  const c = copy(); c.questions[1].site = "park";
  assertError(c, /duplicate site "park"/i);
});

const fakeCountries = (n) =>
  Array.from({ length: n }, (_, i) => ({ code: `Z${String.fromCharCode(65 + i)}`, name: `Test ${i + 1}` }));
const countErrors = (c) => validateContent(c, SITE_IDS).filter((e) => /between \d+ and \d+ countries/i.test(e));

test("rule: between 6 and 11 countries", () => {
  const c = copy(); c.countries = c.countries.slice(0, 5);
  assertError(c, /between 6 and 11 countries/i);
  const d = copy(); d.countries = fakeCountries(12);
  assertError(d, /between 6 and 11 countries/i);
});

test("6 and 11 countries are accepted (limits of RF-4)", () => {
  const c = copy(); c.countries = fakeCountries(6);
  assert.deepEqual(countErrors(c), []);
  const d = copy(); d.countries = fakeCountries(11);
  assert.deepEqual(countErrors(d), []);
});

test("rule: country codes must be unique", () => {
  const c = copy(); c.countries[1].code = c.countries[0].code;
  assertError(c, /duplicate country code/i);
});

test("rule: country codes must be ISO alpha-2", () => {
  for (const bad of ["fr", "FRA", "F", "", "F1"]) {
    const c = copy(); c.countries[0].code = bad;
    assertError(c, /ISO 3166-1 alpha-2/i);
  }
});

test("rule: no country may use the reserved Other code", () => {
  const c = copy(); c.countries[0].code = OTHER_CODE;
  assertError(c, /reserved/i);
});

test("rule: every country has a name", () => {
  const c = copy(); c.countries[0].name = " ";
  assertError(c, /country NL.*name/i);
});

test("rule: every country has a flag", () => {
  const c = copy();
  assertError(c, /country NL.*flag/i, { hasFlag: (code) => code !== "NL" });
});

test("validation does not throw on a malformed content object", () => {
  assert.ok(validateContent(null, SITE_IDS).length > 0);
  assert.ok(validateContent({}, SITE_IDS).length > 0);
  const c = copy(); c.questions[0] = null; c.countries[0] = 42;
  assert.ok(validateContent(c, SITE_IDS).length > 0);
});
