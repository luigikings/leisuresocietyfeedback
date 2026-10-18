// Final screen: timeline, flags, their positions and the confetti. Pure module: no DOM, no network, no
// Math.random (the random source is injected). The UI (js/app/screens/final.js) turns this into CSS
// variables and elements; the animations themselves are CSS. RF-53 to RF-55, RNF-1, RNF-4.
import { OTHER_CODE, flagPath } from "./sites.js";

/** RF-53: the whole final animation lasts 8 s at most. */
export const FINAL_MAX_MS = 8000;

/** RF-53 order: light wave → cars → confetti → flags spin → flags join → flash → texts. */
export const PHASE_ORDER = Object.freeze(["wave", "cars", "confetti", "spin", "converge", "flash", "texts"]);

/** Start and duration of each phase in ms. Phases overlap a little so it flows; the texts end last (7.2 s). */
export const FINAL_PHASES = Object.freeze([
  { id: "wave", start: 0, duration: 1400 },
  { id: "cars", start: 900, duration: 2600 },
  { id: "confetti", start: 1800, duration: 3000 },
  { id: "spin", start: 3400, duration: 1800 },
  { id: "converge", start: 4600, duration: 1200 },
  { id: "flash", start: 5600, duration: 700 },
  { id: "texts", start: 5900, duration: 1300 },
].map(Object.freeze));

/** Size of a flag in the final, in CSS px (4:3). */
export const FLAG_WIDTH = 44;
export const FLAG_HEIGHT = 33;

export const CONFETTI_COLORS = Object.freeze(["#f5c242", "#ff5fd2", "#5fd3ff", "#7dff8a", "#ffffff", "#ff6b6b"]);

/** Time at which the last phase ends (ms). */
export function finalEndMs(phases = FINAL_PHASES) {
  return Math.max(0, ...phases.map((p) => p.start + p.duration));
}

/** CSS custom properties for the timeline: --final-<id>-start / --final-<id>-dur, in ms. */
export function finalCssVars(phases = FINAL_PHASES) {
  const vars = {};
  for (const p of phases) {
    vars[`--final-${p.id}-start`] = `${p.start}ms`;
    vars[`--final-${p.id}-dur`] = `${p.duration}ms`;
  }
  return vars;
}

/** Flags of the content countries, in content order, without "Other" (RF-53). The name is the alt text (RNF-4). */
export function finalFlags(countries) {
  return countries
    .filter((c) => c.code !== OTHER_CODE)
    .map((c) => ({ code: c.code, name: c.name, src: flagPath(c.code) }));
}

const RING_RX = 110; // ±110 px + half a flag stays inside 288 px (320 px screen minus the 16 px gutters)
const RING_RY = 50;
const MAX_STEP = 24;
const MAX_CLUSTER = 180;
const MAX_TILT = 18;

/**
 * Positions (px, relative to the centre of the flag area) for n flags: start (sx, sy) on an ellipse,
 * end (ex, ey) in an overlapping fan, and the end tilt in degrees.
 * @returns {Array<{sx: number, sy: number, ex: number, ey: number, rot: number}>}
 */
export function flagLayout(n) {
  const out = [];
  const mid = (n - 1) / 2;
  const step = n > 1 ? Math.min(MAX_STEP, MAX_CLUSTER / (n - 1)) : 0;
  for (let i = 0; i < n; i++) {
    const angle = (i * 2 * Math.PI) / n - Math.PI / 2;
    const rel = n > 1 ? (i - mid) / mid : 0; // -1 … 1
    out.push({
      sx: round1(RING_RX * Math.cos(angle)),
      sy: round1(RING_RY * Math.sin(angle)),
      ex: (i - mid) * step,
      ey: round1(Math.abs(rel) * 6),
      rot: round1(rel * MAX_TILT),
    });
  }
  return out;
}

/**
 * Confetti pieces for the confetti phase. Times are relative to the start of the phase and every piece
 * has finished by its end.
 * @param {number} count
 * @param {() => number} random a source of numbers in [0, 1)
 * @returns {Array<{x: number, delay: number, duration: number, spin: number, drift: number, color: string}>}
 */
export function confettiPieces(count, random) {
  const phase = FINAL_PHASES.find((p) => p.id === "confetti").duration;
  const pieces = [];
  for (let i = 0; i < count; i++) {
    const x = round1(random() * 100);
    const delay = Math.floor(random() * phase * 0.4);
    const duration = Math.floor(phase * 0.45 + random() * phase * 0.15);
    const r = random();
    const spin = Math.round((r < 0.5 ? -1 : 1) * (360 + r * 540));
    const drift = Math.round((random() - 0.5) * 80);
    const color = CONFETTI_COLORS[Math.floor(random() * CONFETTI_COLORS.length)];
    pieces.push({ x, delay, duration, spin, drift, color });
  }
  return pieces;
}

function round1(v) {
  return Math.round(v * 10) / 10 || 0; // || 0 avoids -0
}

/**
 * Delays of the living-city loops of the final (RF-114 to RF-116), as --live-cars-delay and --live-delay.
 * With the arrival, cars start with the cars phase and windows, lamps, water and site lights when the wave
 * ends; when a finished survey is reopened (RF-56), every loop runs from the start.
 * @returns {{ cars: string, city: string }}
 */
export function liveDelays({ animate = false } = {}) {
  if (!animate) return { cars: "0ms", city: "0ms" };
  const cars = FINAL_PHASES.find((p) => p.id === "cars");
  const wave = FINAL_PHASES.find((p) => p.id === "wave");
  return { cars: `${cars.start}ms`, city: `${wave.start + wave.duration}ms` };
}
