// js/app/city.js with a tiny fake SVG DOM (T25): labels built from SITE_LAYOUT and lit by paintCity (RF-112).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mountCityLabels, paintCity } from "../js/app/city.js";
import { SITE_IDS, SITE_NAMES } from "../js/lib/sites.js";
import { SITE_LAYOUT, labelBox, labelLines } from "../js/lib/site-labels.js";
import { cityView } from "../js/lib/city-view.js";

const NS = "http://www.w3.org/2000/svg";

/** Minimal element: attributes, classes, children, textContent and a few selectors. */
class FakeEl {
  constructor(doc, ns, tag) {
    this.ownerDocument = doc;
    this.namespaceURI = ns;
    this.tagName = tag;
    this.attrs = new Map();
    this.children = [];
    this.text = "";
    const el = this;
    this.classList = {
      toggle(cls, on) {
        const set = new Set((el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean));
        if (on) set.add(cls);
        else set.delete(cls);
        el.setAttribute("class", [...set].join(" "));
      },
      contains: (cls) => (el.getAttribute("class") ?? "").split(/\s+/).includes(cls),
    };
  }
  setAttribute(k, v) {
    this.attrs.set(k, String(v));
  }
  getAttribute(k) {
    return this.attrs.has(k) ? this.attrs.get(k) : null;
  }
  toggleAttribute(k, on) {
    if (on) this.attrs.set(k, "");
    else this.attrs.delete(k);
  }
  get dataset() {
    return { site: this.getAttribute("data-site") ?? undefined };
  }
  append(...kids) {
    for (const k of kids) {
      if (typeof k === "string") throw new Error("strings are not appended: use textContent");
      this.children.push(k);
    }
  }
  replaceChildren(...kids) {
    this.children = [];
    this.append(...kids);
  }
  set textContent(v) {
    this.children = [];
    this.text = String(v);
  }
  get textContent() {
    return this.text + this.children.map((c) => c.textContent).join("");
  }
  set innerHTML(_) {
    throw new Error("innerHTML is not allowed");
  }
  all() {
    return this.children.flatMap((c) => [c, ...c.all()]);
  }
  matches(sel) {
    const cls = sel.match(/^\.([\w-]+)$/);
    if (cls) return this.classList.contains(cls[1]);
    const attr = sel.match(/^\[([\w-]+)\]$/);
    if (attr) return this.attrs.has(attr[1]);
    throw new Error(`selector not supported: ${sel}`);
  }
  querySelectorAll(sel) {
    return this.all().filter((e) => e.matches(sel));
  }
  querySelector(sel) {
    return this.querySelectorAll(sel)[0] ?? null;
  }
}

function fakeCity() {
  const doc = {
    createElementNS: (ns, tag) => new FakeEl(doc, ns, tag),
    createElement: () => {
      throw new Error("SVG elements need createElementNS");
    },
  };
  const svg = new FakeEl(doc, NS, "svg");
  for (const id of SITE_IDS) {
    const g = new FakeEl(doc, NS, "g");
    g.setAttribute("class", "site");
    g.setAttribute("data-site", id);
    svg.append(g);
  }
  const labels = new FakeEl(doc, NS, "g");
  labels.setAttribute("class", "city__labels");
  labels.setAttribute("aria-hidden", "true");
  svg.append(labels);
  return { svg, labels };
}

const round = (v) => Math.round(v * 100) / 100;

test("mountCityLabels draws one hidden label per site in .city__labels, from SITE_LAYOUT (RF-112, RF-113)", () => {
  const { svg, labels } = fakeCity();
  mountCityLabels(svg);
  assert.equal(labels.children.length, SITE_IDS.length);
  labels.children.forEach((g, i) => {
    const id = SITE_IDS[i];
    assert.equal(g.namespaceURI, NS);
    assert.equal(g.tagName, "g");
    assert.equal(g.getAttribute("class"), "site-label", "a new label starts off (no is-lit)");
    assert.equal(g.getAttribute("data-site-label"), id);
    const [bg, text] = g.children;
    assert.equal(bg.tagName, "rect");
    assert.equal(bg.getAttribute("class"), "site-label__bg");
    const box = labelBox(SITE_LAYOUT[id].label);
    assert.deepEqual(
      ["x", "y", "width", "height"].map((k) => Number(bg.getAttribute(k))),
      [box.x, box.y, box.w, box.h].map(round),
      `${id} background`,
    );
    assert.equal(bg.getAttribute("rx"), "3");
    assert.equal(text.tagName, "text");
    const lines = labelLines(SITE_LAYOUT[id].label);
    assert.equal(text.children.length, lines.length);
    text.children.forEach((tspan, j) => {
      assert.equal(tspan.tagName, "tspan");
      assert.equal(tspan.textContent, lines[j].text);
      assert.equal(Number(tspan.getAttribute("x")), round(lines[j].x));
      assert.equal(Number(tspan.getAttribute("y")), round(lines[j].y));
    });
    assert.equal(text.textContent, SITE_NAMES[id].replace(" ", ""), "the label says the site's English name");
  });
});

test("mountCityLabels can run twice without doubling the labels", () => {
  const { svg, labels } = fakeCity();
  mountCityLabels(svg);
  mountCityLabels(svg);
  assert.equal(labels.children.length, SITE_IDS.length);
});

test("mountCityLabels needs the .city__labels group of the HTML (drawing order of plan §15.4)", () => {
  const { svg } = fakeCity();
  svg.children.pop();
  assert.throws(() => mountCityLabels(svg), /city__labels/);
});

test("paintCity lights the label of each lit site and only those (RF-112)", () => {
  const { svg, labels } = fakeCity();
  mountCityLabels(svg);
  const litOf = () => labels.children.filter((g) => g.classList.contains("is-lit")).map((g) => g.getAttribute("data-site-label"));
  paintCity(svg, cityView(["museum", "park"]));
  assert.deepEqual(litOf(), ["park", "museum"]);
  paintCity(svg, cityView(["museum", "park"])); // changing an answer keeps the label lit, no off/on (RF-32)
  assert.deepEqual(litOf(), ["park", "museum"]);
  paintCity(svg, cityView([...SITE_IDS]));
  assert.deepEqual(litOf(), [...SITE_IDS]);
  paintCity(svg, cityView([]));
  assert.deepEqual(litOf(), []);
  // the sites follow the same set
  assert.equal(svg.querySelectorAll("[data-site]").filter((g) => g.classList.contains("is-lit")).length, 0);
});
