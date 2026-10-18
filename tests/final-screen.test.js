// js/app/screens/final.js with a tiny fake DOM (T27): data-final-live and the live delays (RF-54, RF-56, RF-117).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mountFinal } from "../js/app/screens/final.js";

class FakeStyle {
  constructor() {
    this.props = new Map();
  }
  setProperty(k, v) {
    this.props.set(k, String(v));
  }
  removeProperty(k) {
    this.props.delete(k);
  }
  getPropertyValue(k) {
    return this.props.get(k) ?? "";
  }
}

class FakeEl {
  constructor(tag = "div") {
    this.tagName = tag;
    this.style = new FakeStyle();
    this.dataset = {};
    this.children = [];
    this.listeners = new Map();
  }
  append(...kids) {
    this.children.push(...kids);
  }
  replaceChildren(...kids) {
    this.children = kids;
  }
  addEventListener(type, fn) {
    this.listeners.set(type, fn);
  }
  removeEventListener(type, fn) {
    if (this.listeners.get(type) === fn) this.listeners.delete(type);
  }
}

globalThis.document = { createElement: (tag) => new FakeEl(tag) };

function setup({ reduced = false } = {}) {
  const parts = { ".final__flags": new FakeEl("ul"), ".confetti": new FakeEl(), ".final__thanks": new FakeEl("p") };
  const section = new FakeEl("section");
  section.querySelector = (sel) => parts[sel];
  const root = new FakeEl("main");
  const countries = [
    { code: "DE", name: "Germany" },
    { code: "OTHER", name: "Other" },
  ];
  const final = mountFinal(section, { root, countries, reducedMotion: () => reduced, random: () => 0.5 });
  return { final, root, section, thanks: parts[".final__thanks"] };
}

const vars = (root) => [root.style.getPropertyValue("--live-cars-delay"), root.style.getPropertyValue("--live-delay")];

test("with the arrival, the loops hang on data-final-live and wait for the cars and the wave (RF-54, RF-114)", () => {
  const { final, root } = setup();
  final.show({ animate: true });
  assert.equal(root.dataset.final, "play");
  assert.equal(root.dataset.finalLive, "");
  assert.deepEqual(vars(root), ["900ms", "1400ms"]);
  final.hide();
});

test("play → done keeps data-final-live and the delays, so the loops never restart (RF-117)", () => {
  const { final, root, section, thanks } = setup();
  final.show({ animate: true });
  section.listeners.get("animationend")({ target: thanks });
  assert.equal(root.dataset.final, "done");
  assert.equal(root.dataset.finalLive, "");
  assert.deepEqual(vars(root), ["900ms", "1400ms"]);
  final.hide();
});

test("reopening a finished survey shows the loops at once, with no arrival (RF-56)", () => {
  const { final, root } = setup();
  final.show({ animate: false });
  assert.equal(root.dataset.final, "done");
  assert.equal(root.dataset.finalLive, "");
  assert.deepEqual(vars(root), ["0ms", "0ms"]);
  final.hide();
});

test("with reduced motion the final goes straight to done (the CSS stops every loop) (RF-118)", () => {
  const { final, root } = setup({ reduced: true });
  final.show({ animate: true });
  assert.equal(root.dataset.final, "done");
  assert.equal(root.dataset.finalLive, "");
  assert.deepEqual(vars(root), ["0ms", "0ms"]);
  final.hide();
});

test("hide() removes data-final-live, the step and the live delays", () => {
  const { final, root } = setup();
  final.show({ animate: true });
  final.hide();
  assert.equal("final" in root.dataset, false);
  assert.equal("finalLive" in root.dataset, false);
  assert.deepEqual(vars(root), ["", ""]);
});
