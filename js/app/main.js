// Boot: loads the local progress, decides the screen and wires the events. It keeps the state, calls the
// pure logic in js/lib/ after each action, saves the local copy, queues the payload when there is a commit
// and repaints. Plan §5.
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
import { paintCity } from "./city.js";
import { cityView } from "../lib/city-view.js";
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

function update(nextSurvey) {
  if (nextSurvey === local.survey) return;
  local = { ...local, survey: nextSurvey };
  persist();
  render();
}

// Browser / system back behaves like Back on questions 2-10 and does nothing elsewhere (RF-33, RF-34).
const historyGuard = createHistoryGuard({ onBack: () => update(systemBack(local.survey)) });

mountIntro(sections.intro, {
  onStart: () => {
    historyGuard.ensureGuard();
    update(start(local.survey));
  },
});

mountCountry(sections.country, {
  countries: CONTENT.countries,
  onChoose(code) {
    const nextSurvey = chooseCountry(local.survey, code);
    if (nextSurvey === local.survey) return;
    historyGuard.ensureGuard();
    update(nextSurvey);
    commit(); // first save creates the participant's row with the country (RF-15, RF-42)
  },
});

questionScreen = mountQuestion(sections.question, {
  onSelect(letter) {
    historyGuard.ensureGuard();
    update(selectOption(local.survey, CONTENT, letter));
  },
  // Drafts are local only: stored on the device, never sent until Next (RF-31).
  onText: (value) => update(setText(local.survey, CONTENT, value)),
  onNext() {
    const result = next(local.survey, CONTENT);
    if (!result.commit) return;
    historyGuard.ensureGuard();
    update(result.state); // lights the site and shows the next question, or the final screen after Q10
    commit(); // full state with the new answer (RF-27, RF-32, RF-36)
  },
  onBack() {
    historyGuard.ensureGuard();
    update(back(local.survey));
  },
});

finalScreen = mountFinal(sections.final, {
  root: appRoot,
  countries: CONTENT.countries,
  reducedMotion: prefersReducedMotion,
});

render();

// Retry when the connection comes back and every time the survey opens (RF-45).
window.addEventListener("online", () => sync.kick());
sync.kick();
