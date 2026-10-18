// js/app/city.js with a tiny fake SVG DOM (T25, T33): grid, labels and halos built and lit by city.js (RF-70, RF-112, RF-133).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mountCityGrid, mountCityLabels, paintCity } from "../js/app/city.js";
import { SITE_IDS, SITE_NAMES } from "../js/lib/sites.js";
import { SITE_LAYOUT, labelBox, labelLines } from "../js/lib/site-labels.js";
import { cityView } from "../js/lib/city-view.js";
import { STREETS, VIEW_W, VIEW_H, cellBox, fillerBuildings, lampPoints, waveDelayFraction } from "../js/lib/city-grid.js";

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
  removeAttribute(k) {
    this.attrs.delete(k);
  }
  hasAttribute(k) {
    return this.attrs.has(k);
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
  const groups = {};
  for (const name of ["city__streets", "city__fillers", "city__lamps", "city__halos"]) {
    const g = new FakeEl(doc, NS, "g");
    g.setAttribute("class", name);
    g.setAttribute("aria-hidden", "true");
    svg.append((groups[name] = g));
  }
  for (const id of SITE_IDS) {
    const halo = new FakeEl(doc, NS, "ellipse");
    halo.setAttribute("class", "site__halo");
    halo.setAttribute("data-halo", id);
    groups.city__halos.append(halo);
  }
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
  return { svg, labels, groups };
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

// --- T33: grid of the demo generated from js/lib/city-grid.js (RF-69, RF-70, RF-72, RF-133, RF-140, plan §16.4) ---

const fdOf = (el) => {
  const m = (el.getAttribute("style") ?? "").match(/(?:^|;)\s*--fd:\s*([\d.]+)\s*(?:;|$)/);
  assert.ok(m, `${el.tagName}.${el.getAttribute("class")} has no --fd: ${el.getAttribute("style")}`);
  return Number(m[1]);
};
const fd3 = (x, y) => Math.round(waveDelayFraction(x, y) * 1000) / 1000;
const num = (el, k) => Number(el.getAttribute(k));
const cls = (el) => el.getAttribute("class");

test("mountCityGrid draws the dashed streets on each STREETS axis and the inner ring, each with its --fd (RF-69, RF-73)", () => {
  const { svg, groups } = fakeCity();
  mountCityGrid(svg);
  const kids = groups.city__streets.children;
  const lines = kids.filter((el) => el.tagName === "line");
  const rings = kids.filter((el) => el.tagName === "rect");
  assert.equal(lines.length, STREETS.h.length + STREETS.v.length);
  assert.equal(rings.length, 1, "one inner ring");
  for (const el of kids) {
    assert.equal(el.namespaceURI, NS);
    assert.equal(cls(el), "street");
  }
  const hs = lines.filter((l) => l.getAttribute("y1") === l.getAttribute("y2"));
  const vs = lines.filter((l) => l.getAttribute("x1") === l.getAttribute("x2"));
  assert.deepEqual(hs.map((l) => num(l, "y1")), [...STREETS.h]);
  assert.deepEqual(vs.map((l) => num(l, "x1")), [...STREETS.v]);
  for (const l of hs) assert.deepEqual([num(l, "x1"), num(l, "x2")], [0, VIEW_W]);
  for (const l of vs) assert.deepEqual([num(l, "y1"), num(l, "y2")], [0, VIEW_H]);
  for (const l of hs) assert.equal(fdOf(l), fd3(VIEW_W / 2, num(l, "y1")));
  for (const l of vs) assert.equal(fdOf(l), fd3(num(l, "x1"), VIEW_H / 2));
  const ring = rings[0];
  assert.ok(num(ring, "x") > 0 && num(ring, "y") > 0, "the ring is inside the map");
  assert.ok(num(ring, "x") + num(ring, "width") < VIEW_W && num(ring, "y") + num(ring, "height") < VIEW_H);
  fdOf(ring);
});

test("mountCityGrid draws the 14 filler blocks: a pad of the cell and the buildings of fillerBuildings(11) (RF-70)", () => {
  const { svg, groups } = fakeCity();
  mountCityGrid(svg);
  const fillers = groups.city__fillers.children;
  const data = fillerBuildings(11);
  assert.equal(fillers.length, 14);
  fillers.forEach((g, i) => {
    assert.equal(g.tagName, "g");
    assert.equal(cls(g), "filler");
    assert.ok(g.hasAttribute("data-filler"));
    const [pad, lights] = g.children;
    const box = cellBox(...data[i].cell);
    assert.equal(cls(pad), "filler__pad");
    assert.deepEqual(["x", "y", "width", "height"].map((k) => num(pad, k)), [box.x, box.y, box.w, box.h]);
    assert.equal(cls(lights), "filler__lights");
    const bs = lights.children.filter((el) => cls(el) === "filler__b");
    const ws = lights.children.filter((el) => cls(el) === "win");
    assert.equal(bs.length, data[i].buildings.length);
    assert.ok(bs.length >= 2 && bs.length <= 4);
    assert.equal(ws.length, bs.length, "one window per building");
    data[i].buildings.forEach((b, j) => {
      assert.deepEqual(["x", "y", "width", "height"].map((k) => num(bs[j], k)), [b.x, b.y, b.w, b.h].map(round));
      assert.deepEqual(["x", "y", "width", "height"].map((k) => num(ws[j], k)), [b.win.x, b.win.y, b.win.w, b.win.h].map(round));
      const fd = fd3(b.x + b.w / 2, b.y + b.h / 2);
      assert.equal(fdOf(bs[j]), fd);
      assert.equal(fdOf(ws[j]), fd);
    });
  });
});

test("a third of the filler lights twinkle, each with its own offset (RF-115)", () => {
  const { svg, groups } = fakeCity();
  mountCityGrid(svg);
  const lights = groups.city__fillers.children.map((g) => g.children[1]);
  const twinkle = lights.filter((g) => g.hasAttribute("data-twinkle"));
  assert.ok(twinkle.length >= 4 && twinkle.length <= 5, `${twinkle.length} of 14 twinkle`);
  const tws = twinkle.map((g) => g.getAttribute("style"));
  for (const tw of tws) assert.match(tw, /^--tw:\s*[\d.]+s$/);
  assert.equal(new Set(tws).size, twinkle.length, "each twinkling block has its own offset");
});

test("mountCityGrid draws an off lamp at every lampPoints() point, under the lit ones (RF-140, Anexo C)", () => {
  const { svg, groups } = fakeCity();
  mountCityGrid(svg);
  const [off] = groups.city__lamps.children;
  assert.equal(cls(off), "lamps__off", "the off lamps go first, so they are drawn under the lit ones");
  const points = lampPoints();
  assert.equal(off.children.length, points.length);
  const key = (x, y) => `${round(x)},${round(y)}`;
  assert.deepEqual(new Set(off.children.map((l) => key(num(l, "cx"), num(l, "cy")))), new Set(points.map((p) => key(p.x, p.y))));
  for (const l of off.children) {
    assert.equal(l.tagName, "circle");
    assert.equal(cls(l), "lamp-off");
    assert.equal(l.getAttribute("r"), "1.4");
  }
});

test("mountCityGrid draws a lamp at every lampPoints() point, split in .lamps__a and .lamps__b (RF-115, RF-140)", () => {
  const { svg, groups } = fakeCity();
  mountCityGrid(svg);
  const [, a, b] = groups.city__lamps.children;
  assert.deepEqual([cls(a), cls(b)], ["lamps__a", "lamps__b"]);
  const lamps = [...a.children, ...b.children];
  const points = lampPoints();
  assert.equal(lamps.length, points.length);
  assert.ok(lamps.length >= 20);
  assert.ok(Math.abs(a.children.length - b.children.length) <= 1, `${a.children.length} / ${b.children.length}`);
  const key = (x, y) => `${round(x)},${round(y)}`;
  assert.deepEqual(new Set(lamps.map((l) => key(num(l, "cx"), num(l, "cy")))), new Set(points.map((p) => key(p.x, p.y))));
  for (const l of lamps) {
    assert.equal(l.tagName, "circle");
    assert.equal(cls(l), "lamp");
    assert.equal(l.getAttribute("r"), "1.4");
    assert.equal(fdOf(l), fd3(num(l, "cx"), num(l, "cy")));
  }
});

test("mountCityGrid can run twice without doubling anything, and needs the empty groups of the HTML", () => {
  const { svg, groups } = fakeCity();
  mountCityGrid(svg);
  mountCityGrid(svg);
  assert.equal(groups.city__fillers.children.length, 14);
  assert.equal(groups.city__lamps.children.length, 3); // lamps__off, lamps__a, lamps__b
  assert.equal(groups.city__streets.children.length, STREETS.h.length + STREETS.v.length + 1);
  const { svg: bare } = fakeCity();
  bare.children.shift(); // no .city__streets
  assert.throws(() => mountCityGrid(bare), /city__streets/);
});

test("paintCity lights the halo of each lit site with its site and label (RF-133)", () => {
  const { svg, groups } = fakeCity();
  mountCityLabels(svg);
  const halosLit = () =>
    groups.city__halos.children.filter((h) => h.classList.contains("is-lit")).map((h) => h.getAttribute("data-halo"));
  paintCity(svg, cityView(["cinema"]));
  assert.deepEqual(halosLit(), ["cinema"]);
  paintCity(svg, cityView([...SITE_IDS]));
  assert.deepEqual(halosLit(), [...SITE_IDS]);
  paintCity(svg, cityView([]));
  assert.deepEqual(halosLit(), []);
});

test("paintCity with instant marks the SVG data-instant until the first frame is drawn, so halo and label appear without a fade (RF-112, RF-138)", () => {
  const { svg } = fakeCity();
  mountCityLabels(svg);
  const frames = [];
  const raf = (fn) => frames.push(fn);
  paintCity(svg, cityView(["park"]), { instant: true, raf });
  assert.ok(svg.hasAttribute("data-instant"), "no data-instant while the first frame is drawn");
  // a rAF callback runs before its frame is styled: the mark goes in the callback of the frame after it
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.ok(svg.hasAttribute("data-instant"), "data-instant is gone before the first frame is drawn");
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.ok(!svg.hasAttribute("data-instant"), "data-instant stays after the frame");
  assert.equal(frames.length, 0);
  // without instant nothing is marked and no frame is asked for
  paintCity(svg, cityView(["park", "cinema"]), { raf });
  assert.ok(!svg.hasAttribute("data-instant"));
  assert.equal(frames.length, 0);
  paintCity(svg, cityView(["park"])); // the default options still work
});
