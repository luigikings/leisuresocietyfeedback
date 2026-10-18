// Boot: loads the local progress, decides the screen and wires the events. It keeps the state, calls the
// pure logic in js/lib/ after each action, saves the local copy, queues the payload when there is a commit
// and repaints. Screen and question changes fade (plan §15.3): save and light the site first, then fade
// out, repaint and fade in, with a time gate that ignores every input meanwhile (RF-103 to RF-108).
import { CONTENT } from "../content.js";
import { loadOrCreate, serialize } from "../lib/persistence.js";
import { buildPayload, uuidV4FromBytes } from "../lib/payload.js";
import {
  resumeState, start, chooseCountry, litSites, selectOption, setText, next, back, systemBack,
} from "../lib/survey-state.js";
import { questionView } from "../lib/question-view.js";
import { createStorage } from "./storage.js";
import { createSync } from "./sync.js";
import { saveResponse } from "./db.js";
import { mountCityLabels, paintCity } from "./city.js";
import { cityView, holdFullLight } from "../lib/city-view.js";
import { planTransition, openGate, closeGate, gateAllows } from "../lib/transition.js";
import { fadeOut, fadeIn, cancelFades } from "./fade.js";
import { prefersReducedMotion } from "./motion.js";
import { mountIntro } from "./screens/intro.js";
import { mountCountry } from "./screens/country.js";
import { mountQuestion } from "./screens/question.js";
import { mountFinal } from "./screens/final.js";
import { createHistoryGuard } from "./history.js";

const STORAGE_KEY = "leisure-city:local";
const newId = () => uuidV4FromBytes(crypto.getRandomValues(new Uint8Array(16)));

const storage = createStorage();
let local = loadOrCreate(storage.get(STORAGE_KEY), CONTENT.version, newId);
local = { ...local, survey: resumeState(local.survey, CONTENT) };

function persist() {
  storage.set(STORAGE_KEY, serialize(local));
}
persist();

// --- Offline notice (RF-49, RF-50) -------------------------------------------------
// One status line in the question screen (under Back/Next) and one in the final panel (under "Thank you"):
// in the page flow, never fixed over the content. Only the one in the visible screen is seen and announced.
const notices = document.querySelectorAll("[data-offline-notice]");
function setNotice(visible) {
  for (const notice of notices) {
    notice.textContent = visible ? "Saved offline – will sync" : "";
    notice.classList.toggle("is-visible", visible);
  }
}

// --- Sync ------------------------------------------------------------------------------
const sync = createSync({
  initialQueue: local.queue,
  save: saveResponse,
  persist(q) {
    local = { ...local, queue: q };
    persist();
  },
  onNotice: setNotice,
});
setNotice(Boolean(local.queue.offline && local.queue.pending));

/** Saves the full state now: new payload with a higher seq, stored locally, then queued (RF-27, RF-43). */
function commit() {
  const built = buildPayload(local);
  local = built.local;
  persist();
  sync.push(built.payload);
}

// --- Screens -----------------------------------------------------------------------------
const sections = {
  intro: document.getElementById("screen-intro"),
  country: document.getElementById("screen-country"),
  question: document.getElementById("screen-question"),
  final: document.getElementById("screen-final"),
};
const appRoot = document.getElementById("app");
const cityWrap = document.getElementById("city-wrap");
const city = document.getElementById("city");
let shownScreen = null;
let shownQuestion = null;

let questionScreen = null; // mounted below, before the first render
let finalScreen = null;

function render() {
  const survey = local.survey;
  appRoot.dataset.screen = survey.screen; // per-screen layout in CSS (plan §14.4, §14.5)
  for (const [name, el] of Object.entries(sections)) el.hidden = name !== survey.screen;
  cityWrap.hidden = survey.screen !== "question" && survey.screen !== "final";
  paintCity(city, cityView(litSites(survey, CONTENT)));
  if (survey.screen === "question") questionScreen.paint(questionView(survey, CONTENT));

  const changed = survey.screen !== shownScreen || (survey.screen === "question" && survey.current !== shownQuestion);
  // Final: plays once right after Q10; on reopening a finished survey it shows the last state (RF-53, RF-56).
  if (survey.screen === "final" && shownScreen !== "final") finalScreen.show({ animate: shownScreen === "question" });
  else if (survey.screen !== "final" && shownScreen === "final") finalScreen.hide();
  // Focus goes to the title of the new screen (RNF-4); not on the very first paint of the page.
  if (changed && shownScreen !== null) sections[survey.screen].querySelector("[data-title]")?.focus();
  shownScreen = survey.screen;
  shownQuestion = survey.current;
}

// --- Transitions (RF-103 to RF-108) ------------------------------------------------------
let gate = openGate();
let enterTimer = 0;
let openTimer = 0;

/** Runs a user action only when no transition is playing; taps and back presses meanwhile are dropped (RF-106). */
function act(fn) {
  if (!gateAllows(gate, performance.now())) return;
  fn();
}

/** Section and, when the city changes mode, the city that leave or enter (RF-104: between questions, only the panel). */
function fading(screen, cityFades) {
  const els = [sections[screen]];
  if (cityFades && !cityWrap.hidden) els.push(cityWrap);
  return els;
}

/**
 * Saves the new state at once, then shows it: straight away when nothing changes screen or question (and on
 * the first paint, RF-107); otherwise the site is lit now (RF-105), the old screen fades out, render() swaps
 * the screen and moves the focus to the title as the new one fades in (RNF-4).
 */
function update(nextSurvey) {
  if (nextSurvey === local.survey) return;
  local = { ...local, survey: nextSurvey };
  persist();

  const prev = shownScreen === null ? null : { screen: shownScreen, current: shownQuestion };
  const plan = planTransition(prev, { screen: nextSurvey.screen, current: nextSurvey.current }, {
    reduced: prefersReducedMotion(),
  });
  if (plan.scope === "none") {
    render();
    return;
  }

  // Light the answered site now; towards the final the full light-up waits for the wave (RF-73, RF-105).
  const view = cityView(litSites(nextSurvey, CONTENT));
  paintCity(city, nextSurvey.screen === "final" ? holdFullLight(view) : view);

  gate = closeGate(gate, performance.now(), plan.totalMs);
  const leaving = fading(prev.screen, plan.cityFades);
  fadeOut(leaving, plan.outMs);

  const enter = () => {
    cancelFades(leaving); // a hidden section must not keep opacity 0 for the next time it shows
    render();
    fadeIn(fading(local.survey.screen, plan.cityFades), plan.inMs);
    // Once the gate opens, repaint the question: text typed during the fade was dropped (plan §15.3).
    openTimer = setTimeout(() => {
      if (local.survey.screen === "question") questionScreen.paint(questionView(local.survey, CONTENT));
    }, plan.inMs);
  };
  clearTimeout(enterTimer);
  clearTimeout(openTimer);
  if (plan.outMs > 0) enterTimer = setTimeout(enter, plan.outMs);
  else enter(); // reduced motion: a single fade-in (RF-108)
}

// Browser / system back behaves like Back on questions 2-10 and does nothing elsewhere (RF-33, RF-34);
// during a transition it is ignored and history.js puts the guard back as always (RF-106).
const historyGuard = createHistoryGuard({ onBack: () => act(() => update(systemBack(local.survey))) });

mountIntro(sections.intro, {
  onStart: () => act(() => {
    historyGuard.ensureGuard();
    update(start(local.survey));
  }),
});

mountCountry(sections.country, {
  countries: CONTENT.countries,
  onChoose(code) {
    act(() => {
      const nextSurvey = chooseCountry(local.survey, code);
      if (nextSurvey === local.survey) return;
      historyGuard.ensureGuard();
      update(nextSurvey);
      commit(); // first save creates the participant's row with the country (RF-15, RF-42)
    });
  },
});

questionScreen = mountQuestion(sections.question, {
  onSelect(letter) {
    act(() => {
      historyGuard.ensureGuard();
      update(selectOption(local.survey, CONTENT, letter));
    });
  },
  // Drafts are local only: stored on the device, never sent until Next (RF-31).
  onText: (value) => act(() => update(setText(local.survey, CONTENT, value))),
  onNext() {
    act(() => {
      const result = next(local.survey, CONTENT);
      if (!result.commit) return;
      historyGuard.ensureGuard();
      update(result.state); // saves, lights the site and starts the fade to the next question or the final
      commit(); // full state with the new answer, queued before the fade ends (RF-27, RF-32, RF-36, RF-105)
    });
  },
  onBack() {
    act(() => {
      historyGuard.ensureGuard();
      update(back(local.survey));
    });
  },
});

finalScreen = mountFinal(sections.final, {
  root: appRoot,
  countries: CONTENT.countries,
  reducedMotion: prefersReducedMotion,
});

mountCityLabels(city); // site labels from SITE_LAYOUT, before the first paint so a resume shows them without a fade
render();

// Retry when the connection comes back and every time the survey opens (RF-45).
window.addEventListener("online", () => sync.kick());
sync.kick();
