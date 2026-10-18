// js/app/hud.js with a tiny fake DOM (T34): progress header, question bar, ring and "Lit up" toast
// (RF-125 to RF-138, RF-148, plan §16.5).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mountHud, paintHud, celebrate } from "../js/app/hud.js";
import { progressView } from "../js/lib/progress.js";
import { celebration, RING_MS, TOAST_MS } from "../js/lib/city-view.js";

/** Minimal element: attributes, classes, children, textContent, dataset and a few selectors. */
class FakeEl {
  constructor(doc, tag, attrs = {}) {
    this.ownerDocument = doc;
    this.tagName = tag.toUpperCase();
    this.attrs = new Map(Object.entries(attrs));
    this.children = [];
    this.textContent = "";
    const el = this;
    const classes = () => new Set((el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean));
    this.classList = {
      toggle(cls, on = !classes().has(cls)) {
        const set = classes();
        if (on) set.add(cls);
        else set.delete(cls);
        el.setAttribute("class", [...set].join(" "));
        return on;
      },
      add: (cls) => el.classList.toggle(cls, true),
      remove: (cls) => el.classList.toggle(cls, false),
      contains: (cls) => classes().has(cls),
    };
    this.dataset = new Proxy({}, {
      get: (_, k) => el.getAttribute(`data-${String(k)}`) ?? undefined,
      set: (_, k, v) => (el.setAttribute(`data-${String(k)}`, v), true),
    });
  }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  append(...kids) { this.children.push(...kids); }
  replaceChildren(...kids) { this.children = [...kids]; }
  matches(sel) {
    const cls = sel.match(/^\.([\w-]+)$/);
    if (cls) return this.classList.contains(cls[1]);
    const attr = sel.match(/^\[([\w-]+)="([^"]*)"\]$/);
    if (attr) return this.getAttribute(attr[1]) === attr[2];
    throw new Error(`unsupported selector ${sel}`);
  }
  querySelectorAll(sel) {
    const out = [];
    const walk = (el) => {
      for (const c of el.children) {
        if (c.matches(sel)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
}

const doc = { createElement: (tag) => new FakeEl(doc, tag) };

/** #city-wrap as in index.html: header, .city-box with the SVG sites and the toast, and the bar. */
function makeWrap() {
  const el = (tag, cls, attrs = {}) => new FakeEl(doc, tag, cls ? { class: cls, ...attrs } : attrs);
  const wrap = el("div", "city-wrap");
  const hud = el("header", "hud");
  const pct = el("span", "hud__pct");
  const count = el("small", "hud__count");
  hud.append(el("span", "hud__brand"), pct, count);
  const box = el("div", "city-box");
  const svg = el("svg", "city");
  for (const id of ["cinema", "theatre", "stadium"]) svg.append(el("g", "site", { "data-site": id }));
  const toast = el("p", "city__toast");
  box.append(svg, toast);
  const segs = el("div", "segs");
  wrap.append(hud, box, segs);
  return { wrap, pct, count, segs, toast, svg };
}

/** Fake timers: setTimeout/clearTimeout and a clock to run them. */
function fakeTimers() {
  let now = 0;
  let nextId = 1;
  const pending = new Map();
  return {
    setTimeout(fn, ms) { const id = nextId++; pending.set(id, { at: now + ms, fn }); return id; },
    clearTimeout(id) { pending.delete(id); },
    get count() { return pending.size; },
    advance(ms) {
      now += ms;
      for (const [id, t] of [...pending].sort((a, b) => a[1].at - b[1].at)) {
        if (t.at <= now && pending.has(id)) { pending.delete(id); t.fn(); }
      }
    },
  };
}

const site = (svg, id) => svg.querySelector(`[data-site="${id}"]`);

test("mountHud creates the 10 segments of the question bar, and a second call rebuilds them (RF-128)", () => {
  const { wrap, segs } = makeWrap();
  mountHud(wrap);
  assert.equal(segs.children.length, 10);
  assert.ok(segs.children.every((i) => i.tagName === "I"));
  mountHud(wrap, 10);
  assert.equal(segs.children.length, 10);
});

test("paintHud writes the percentage and 'N of 10 places' and marks filled and current segments (RF-125 to RF-129)", () => {
  const { wrap, pct, count, segs } = makeWrap();
  mountHud(wrap);
  paintHud(wrap, progressView({ litCount: 3, current: 1, answeredIndexes: [0, 1, 2] }));
  assert.equal(pct.textContent, "30%");
  assert.equal(count.textContent, "3 of 10 places");
  const filled = segs.children.map((i) => i.classList.contains("is-filled"));
  const current = segs.children.map((i) => i.classList.contains("is-current"));
  assert.deepEqual(filled, [true, true, true, false, false, false, false, false, false, false]);
  assert.deepEqual(current.indexOf(true), 1); // Back to Q2: answered and current at once (RF-129)
  assert.equal(current.filter(Boolean).length, 1);

  // the final screen: 100 %, all filled, no current segment (RF-130)
  paintHud(wrap, progressView({ litCount: 10, current: null }));
  assert.equal(pct.textContent, "100%");
  assert.equal(count.textContent, "10 of 10 places");
  assert.ok(segs.children.every((i) => i.classList.contains("is-filled") && !i.classList.contains("is-current")));
});

test("celebrate with a new site rings it for RING_MS and shows 'Lit up' for TOAST_MS (RF-134, RF-135)", () => {
  const { wrap, toast, svg } = makeWrap();
  const timers = fakeTimers();
  celebrate(wrap, celebration(["stadium"], ["stadium", "cinema"], {}), { timers });
  assert.ok(site(svg, "cinema").classList.contains("is-new"));
  assert.ok(!site(svg, "stadium").classList.contains("is-new"));
  assert.equal(toast.textContent, "Lit up: Cinema");
  assert.equal(toast.getAttribute("data-place"), "bottom");
  assert.ok(toast.classList.contains("is-shown"));

  timers.advance(RING_MS);
  assert.ok(!site(svg, "cinema").classList.contains("is-new"));
  assert.ok(toast.classList.contains("is-shown"));
  timers.advance(TOAST_MS - RING_MS);
  assert.ok(!toast.classList.contains("is-shown"));
});

test("celebrate places the toast at the top for a site in the bottom row (RF-137)", () => {
  const { wrap, toast } = makeWrap();
  celebrate(wrap, celebration([], ["theatre"], {}), { timers: fakeTimers() });
  assert.equal(toast.getAttribute("data-place"), "top");
  assert.equal(toast.textContent, "Lit up: Theatre");
});

test("a second toast replaces the first and restarts its time, with a single timer (RF-136)", () => {
  const { wrap, toast } = makeWrap();
  const timers = fakeTimers();
  celebrate(wrap, celebration([], ["cinema"], {}), { timers });
  timers.advance(1000);
  celebrate(wrap, celebration(["cinema"], ["cinema", "theatre"], {}), { timers });
  assert.equal(toast.textContent, "Lit up: Theatre");
  assert.equal(toast.getAttribute("data-place"), "top");
  timers.advance(TOAST_MS - 100); // 2400 ms after the first toast: the first timer must not hide the second
  assert.ok(toast.classList.contains("is-shown"));
  timers.advance(100);
  assert.ok(!toast.classList.contains("is-shown"));
  assert.equal(timers.count, 0);
});

test("celebrate shows nothing on a first paint, a changed answer or Q10, and Q10 hides a toast still shown (RF-138, RF-148)", () => {
  const { wrap, toast, svg } = makeWrap();
  const timers = fakeTimers();
  const noneShown = () =>
    !toast.classList.contains("is-shown") && svg.querySelectorAll(".is-new").length === 0;

  celebrate(wrap, celebration(null, ["cinema"], { firstPaint: true }), { timers });
  assert.ok(noneShown());
  celebrate(wrap, celebration(["cinema"], ["cinema"], {}), { timers });
  assert.ok(noneShown());

  celebrate(wrap, celebration([], ["theatre"], {}), { timers });
  celebrate(wrap, celebration(["theatre"], ["theatre", "stadium"], { toFinal: true }), { timers });
  // the theatre ring may finish on its own; the toast goes at once and no new ring starts
  assert.ok(!toast.classList.contains("is-shown"));
  assert.ok(!site(svg, "stadium").classList.contains("is-new"));
});
