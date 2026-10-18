// Start of the /admin panel (plan §4.2): login form, admin check, remembered session, "Log out" and the
// "session ended" notice. Phases: "login" (only the form, RF-3) → "checking" (is_admin, RF-11) → "ready".
// Then (T8) the load of every row (data.js, RF-17), "Loading responses…", "Last updated" and "Refresh"
// (RF-18 to RF-21), the common filters (RF-22 to RF-25), the tabs (RF-26, RF-27) and "Statistics" with its
// download (RF-29 to RF-38, RF-56, RF-70), and (T9) "Responses": search, comments filter, order, "Clear filters",
// open cards and "Download responses" (RF-39 to RF-48, RF-55, RF-61 to RF-64).
// It only paints and delegates: what each answer means and every number come from js/lib.
import { ADMIN_LOGIN_EMAIL } from "../../config.js";
import { CONTENT } from "../../content.js";
import { prepareLogin, MESSAGES } from "../../lib/admin-auth.js";
import {
  INITIAL_FILTERS,
  STATUS_CHOICES,
  applyCommonFilters,
  countryChoices,
  hiddenVersionsNotice,
  splitByVersion,
} from "../../lib/admin-stats.js";
import {
  COMMENT_CHOICES,
  EMPTY_LIST_MESSAGE,
  INITIAL_LIST_STATE,
  NO_RESPONSES_MESSAGE,
  ORDER_CHOICES,
  clearFilters,
  isListFiltered,
  showingText,
  visibleEntries,
} from "../../lib/admin-list.js";
import { countText, fileName, formatHHMM } from "../../lib/admin-format.js";
import { buildStatistics, responsesCsv, statisticsCsv } from "../../lib/csv.js";
import { hasStoredSession } from "./client.js";
import { signIn, checkAdmin, restoreSession, signOutLocal, onSessionEnd } from "./auth.js";
import { loadResponses } from "./data.js";
import { renderStatistics } from "./stats-view.js";
import { renderList, wideQuery } from "./list-view.js";
import { downloadCsv } from "./download.js";

// RF-66: the module has loaded, so the "couldn't load" message must never appear.
document.getElementById("boot-fail")?.remove();

const $ = (id) => document.getElementById(id);
const el = {
  loginView: $("login-view"),
  form: $("login"),
  username: $("username"),
  password: $("password"),
  loginButton: $("login-button"),
  loginMessage: $("login-message"),
  panel: $("panel"),
  panelTitle: $("panel-title"),
  panelMessage: $("panel-message"),
  retry: $("retry"),
  logout: $("logout"),
  refresh: $("refresh"),
  lastUpdated: $("last-updated"),
  loading: $("loading"),
  content: $("panel-content"),
  hiddenVersions: $("hidden-versions"),
  country: $("filter-country"),
  status: $("filter-status"),
  participants: $("participants-count"),
  tabs: [$("tab-statistics"), $("tab-responses")],
  panels: { statistics: $("panel-statistics"), responses: $("panel-responses") },
  statistics: $("statistics"),
  responses: $("responses"),
  downloadStatistics: $("download-statistics"),
  downloadResponses: $("download-responses"),
  search: $("list-search"),
  comments: $("list-comments"),
  order: $("list-order"),
  listCount: $("list-count"),
  listEmpty: $("list-empty"),
  clearFilters: $("clear-filters"),
};

/** What a "Log out" or an ended session wipes (RF-12, RF-15, RF-16): data, filters, tab and list state. */
function initialData() {
  return {
    rows: null, // every loaded row of the last COMPLETE load (null before the first one)
    current: [], // those rows of the current content version (RF-22)
    lastUpdated: null, // Date of the last complete load (RF-19)
    loading: false, // a check + load started by the panel is running (RF-20)
    verified: false, // the admin check passed in this run: "Refresh" is offered
    tab: "statistics", // RF-26
    filters: { ...INITIAL_FILTERS }, // RF-23, RF-24
    list: { ...INITIAL_LIST_STATE }, // search, comments filter and order of "Responses" (RF-41, RF-43, RF-44)
    open: new Set(), // keys of the open cards, reapplied on every repaint (RF-64)
    listDirty: true, // the list must be repainted the next time "Responses" is shown
  };
}

const state = {
  phase: "login", // "login" | "checking" | "ready"
  busy: false, // a login attempt or a check is running (RF-10)
  run: 0, // bumped on every return to the form: answers of an older run are ignored
  ...initialData(),
};
let pendingSignOut = Promise.resolve();

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Sets an announced message (role="alert"); the same text again is re-announced. */
function say(node, text) {
  if (node.textContent === text && text !== "") {
    node.textContent = "";
    requestAnimationFrame(() => {
      node.textContent = text;
    });
  } else {
    node.textContent = text;
  }
}

/** RF-10: while an attempt runs the button is disabled, reads "Logging in…" and new submits are ignored. */
function setBusy(busy) {
  state.busy = busy;
  el.loginButton.disabled = busy;
  el.loginButton.textContent = busy ? "Logging in…" : "Log in";
}

/** RF-18, RF-20: "Loading responses…" shown; "Refresh" and "Try again" disabled while a check + load runs. */
function setLoading(on) {
  state.loading = on;
  el.loading.hidden = !on;
  el.refresh.disabled = on;
  el.retry.disabled = on;
}

/** Removes every loaded datum from the screen and from memory (RF-12, RF-15, RF-16). */
function clearData() {
  Object.assign(state, initialData());
  el.statistics.replaceChildren();
  el.responses.replaceChildren();
  el.search.value = "";
  el.listCount.textContent = "";
  el.listEmpty.textContent = "";
  el.country.replaceChildren();
  el.hiddenVersions.textContent = "";
  el.participants.textContent = "";
  el.lastUpdated.textContent = "";
  el.lastUpdated.hidden = true;
  el.refresh.hidden = true;
  el.content.hidden = true;
  setLoading(false);
  selectTab("statistics");
  say(el.panelMessage, "");
  el.retry.hidden = true;
}

/** Back to the login form (RF-3), with an optional message of MESSAGES. */
function showLogin(key, { clearUsername = false } = {}) {
  state.run += 1;
  state.phase = "login";
  clearData();
  el.panel.hidden = true;
  el.loginView.hidden = false;
  el.password.value = "";
  if (clearUsername) el.username.value = "";
  setBusy(false);
  say(el.loginMessage, key ? MESSAGES[key] : "");
  if (key) (el.username.value.trim() === "" ? el.username : el.password).focus();
}

/** The panel, with no message (admin checked) or with RF-21's text and "Try again" (RF-69). */
function showPanel(key) {
  const wasHidden = el.panel.hidden;
  state.phase = key ? "checking" : "ready";
  setBusy(false);
  say(el.loginMessage, "");
  el.loginView.hidden = true;
  el.panel.hidden = false;
  say(el.panelMessage, key ? MESSAGES[key] : "");
  el.retry.hidden = !key;
  el.retry.disabled = state.loading;
  el.refresh.hidden = !state.verified;
  if (wasHidden) el.panelTitle.focus();
  else if (key) el.retry.focus();
}

/** RF-11: the account must be in the admin list before any response is loaded. */
async function verify() {
  const run = state.run;
  state.phase = "checking";
  if (!el.loginView.hidden) setBusy(true);
  setLoading(true);
  const result = await checkAdmin();
  if (run !== state.run) return; // logged out meanwhile
  if (result === "admin") {
    state.verified = true;
    showPanel(null);
    return load(run); // RF-17
  }
  setLoading(false);
  if (result === "network") {
    showPanel("load_failed"); // RF-69: no new data (earlier complete data stays, RF-21), the session is kept
    return;
  }
  // "no_access" (RF-12) or "session_ended" (RF-16): this browser's session goes, the data too
  showLogin(result);
  pendingSignOut = signOutLocal();
}

/**
 * RF-17, RF-21: every row, or nothing. A failed load keeps the previous complete data and its "Last updated";
 * a rejected session ends like RF-16.
 */
async function load(run) {
  setLoading(true);
  const result = await loadResponses();
  if (run !== state.run) return; // logged out meanwhile: the rows are dropped
  setLoading(false);
  if (result.error === "session_ended") {
    showLogin("session_ended");
    pendingSignOut = signOutLocal();
    return;
  }
  if (result.error) {
    showPanel("load_failed"); // "network", or a server that doesn't advance ("stalled")
    return;
  }
  state.rows = result.rows;
  state.lastUpdated = new Date();
  state.phase = "ready";
  render();
}

/** Remembered session (RF-13): on start and on "Try again". */
async function resume({ onStart = false } = {}) {
  const run = state.run;
  if (!onStart) {
    setLoading(true);
    state.phase = "checking";
  }
  const result = await restoreSession();
  if (run !== state.run || (onStart && state.busy)) return; // a login attempt started meanwhile
  if (result === "session") return verify();
  setLoading(false);
  if (result === "network") {
    // Can't tell whether the session is still valid: keep it and offer "Try again" (RF-69).
    // With nothing remembered (CDN down at start) the form stays as it is; RF-9 applies on "Log in".
    if (!onStart || hasStoredSession()) showPanel("load_failed");
    return;
  }
  if (onStart && result === "none") return;
  showLogin("session_ended"); // RF-16 (or the session vanished before "Try again")
}

// --- Data on screen ---------------------------------------------------------------------------------------

/** RF-26, RF-27: shows one tab; the state of the other (filters, search, order) is untouched. */
function selectTab(name, { focus = false } = {}) {
  state.tab = name;
  for (const tab of el.tabs) {
    const selected = tab.getAttribute("aria-controls") === `panel-${name}`;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  }
  for (const [key, panel] of Object.entries(el.panels)) panel.hidden = key !== name;
  if (name === "responses" && state.listDirty) paintResponses();
}

const tabName = (tab) => tab.getAttribute("aria-controls").replace("panel-", "");

function fillSelect(select, choices, value) {
  select.replaceChildren(
    ...choices.map((c) => {
      const option = document.createElement("option");
      option.value = c.value;
      option.textContent = c.label;
      return option;
    }),
  );
  select.value = value;
}

const filtered = () => applyCommonFilters(state.current, state.filters);

/** The parts that depend on the filters: "N participants", the statistics and the list (RF-25, RF-29 to RF-46). */
function renderFiltered() {
  const rows = filtered();
  el.participants.textContent = countText(rows.length, "participant");
  renderStatistics(el.statistics, buildStatistics(rows, CONTENT), { onSeeComments: seeComments });
  paintResponses();
}

/** The entries of "Responses" now: common filters, then search, comments filter and order (RF-39, RF-41). */
const listEntries = () => visibleEntries(filtered(), state.list);

/**
 * "Responses" (RF-39 to RF-46, RF-61, RF-64): controls as in state.list, "Showing X of Y", the empty
 * messages, "Download responses" and the entries. Painted only while the tab is shown (1000 rows, RNF-8).
 */
function paintResponses() {
  if (state.rows === null) return;
  if (state.tab !== "responses") {
    state.listDirty = true;
    return;
  }
  state.listDirty = false;
  const { entries, counts } = listEntries();
  if (el.search.value !== state.list.query) el.search.value = state.list.query; // never while typing
  el.comments.value = state.list.comments;
  el.order.value = state.list.order;
  el.listCount.textContent = showingText(counts); // RF-45
  const nothing = state.current.length === 0;
  const empty = nothing ? NO_RESPONSES_MESSAGE : entries.length === 0 ? EMPTY_LIST_MESSAGE : "";
  el.listEmpty.textContent = empty;
  el.listEmpty.parentElement.hidden = empty === "";
  el.clearFilters.hidden = nothing || entries.length > 0; // RF-46
  el.downloadResponses.disabled = entries.length === 0; // RF-61
  renderList(el.responses, entries, {
    content: CONTENT,
    timeZone: timeZone(),
    wide: wideQuery().matches,
    filtered: isListFiltered(state.list),
    open: state.open,
    onToggle: (key, isOpen) => (isOpen ? state.open.add(key) : state.open.delete(key)),
  });
}

/** After a complete load: notice, filter choices, "Last updated", then the filtered parts. */
function render() {
  const { current, hiddenCount } = splitByVersion(state.rows, CONTENT.version);
  state.current = current;
  const notice = hiddenVersionsNotice(hiddenCount); // RF-22, over every loaded row, before the filters
  el.hiddenVersions.textContent = notice ?? "";
  el.hiddenVersions.hidden = notice === null;
  fillSelect(el.country, countryChoices(current, CONTENT, state.filters.country), state.filters.country);
  el.lastUpdated.textContent = `Last updated ${formatHHMM(state.lastUpdated, timeZone())}`; // RF-19
  el.lastUpdated.hidden = false;
  el.refresh.hidden = false;
  renderFiltered();
  selectTab(state.tab);
  el.content.hidden = false;
}

/** RF-38: "Responses" with "With a comment in Q<n>", the common filters as they are, the search empty. */
function seeComments(n) {
  state.list = { ...state.list, comments: `q${n}`, query: "" };
  state.listDirty = true;
  selectTab("responses", { focus: true });
}

fillSelect(el.status, STATUS_CHOICES, state.filters.status);
fillSelect(el.comments, COMMENT_CHOICES, state.list.comments);
fillSelect(el.order, ORDER_CHOICES, state.list.order);

// RF-43: every keystroke filters; the open cards stay as they are (RF-64).
el.search.addEventListener("input", () => {
  state.list = { ...state.list, query: el.search.value };
  paintResponses();
});

el.comments.addEventListener("change", () => {
  state.list = { ...state.list, comments: el.comments.value }; // RF-44
  paintResponses();
});

el.order.addEventListener("change", () => {
  state.list = { ...state.list, order: el.order.value }; // RF-41
  paintResponses();
});

// RF-46: country, status, search, comments filter and order back to their initial values.
el.clearFilters.addEventListener("click", () => {
  const initial = clearFilters();
  state.filters = initial.filters;
  state.list = initial.list;
  el.country.value = state.filters.country;
  el.status.value = state.filters.status;
  renderFiltered();
  el.search.focus(); // the button has just been hidden
});

// RF-42 / RF-63: table ↔ cards when the window crosses 768 px.
wideQuery().addEventListener("change", () => paintResponses());

// RF-55, RF-61, RF-62: exactly the entries the list shows now, in its order, built in the browser.
el.downloadResponses.addEventListener("click", () => {
  if (state.rows === null) return;
  const { entries } = listEntries();
  if (entries.length === 0) return;
  const now = new Date();
  const zone = timeZone();
  downloadCsv(fileName("responses", now, zone), responsesCsv(entries, CONTENT, { timeZone: zone }));
});

el.country.addEventListener("change", () => {
  state.filters = { ...state.filters, country: el.country.value };
  renderFiltered();
});

el.status.addEventListener("change", () => {
  state.filters = { ...state.filters, status: el.status.value };
  renderFiltered();
});

for (const tab of el.tabs) tab.addEventListener("click", () => selectTab(tabName(tab)));

// Tabs pattern (RNF-7): the arrows move between tabs and select them; Home and End go to the ends.
el.tabs[0].parentElement.addEventListener("keydown", (event) => {
  const at = el.tabs.indexOf(document.activeElement);
  if (at < 0) return;
  const last = el.tabs.length - 1;
  const moves = { ArrowRight: at === last ? 0 : at + 1, ArrowLeft: at === 0 ? last : at - 1, Home: 0, End: last };
  const to = moves[event.key];
  if (to === undefined) return;
  event.preventDefault();
  selectTab(tabName(el.tabs[to]), { focus: true });
});

// RF-56, RF-57: what "Statistics" shows now, with the same functions, built in the browser (RF-62).
el.downloadStatistics.addEventListener("click", () => {
  if (state.rows === null) return;
  const now = new Date();
  const zone = timeZone();
  const csv = statisticsCsv(buildStatistics(filtered(), CONTENT), {
    content: CONTENT,
    filters: state.filters,
    generatedAt: now,
    timeZone: zone,
  });
  downloadCsv(fileName("statistics", now, zone), csv);
});

// RF-20: the admin check again, then every row; tab, filters, search and order are kept.
el.refresh.addEventListener("click", () => {
  if (state.loading || state.phase === "login") return;
  verify();
});

el.form.addEventListener("submit", async (event) => {
  event.preventDefault(); // RF-65: never a native submit
  if (state.busy || state.phase !== "login") return;
  const prep = prepareLogin({ username: el.username.value, password: el.password.value }, ADMIN_LOGIN_EMAIL);
  if (prep.error) {
    // RF-67 and RF-6: no request at all
    if (prep.error === "credentials") el.password.value = "";
    say(el.loginMessage, MESSAGES[prep.error]);
    (el.username.value.trim() === "" ? el.username : el.password).focus();
    return;
  }
  const run = state.run;
  say(el.loginMessage, "");
  setBusy(true);
  await pendingSignOut; // a "Log out" still finishing
  const result = await signIn(prep.email, prep.password);
  if (run !== state.run) return;
  if (result !== "ok") {
    setBusy(false);
    if (result === "credentials") el.password.value = ""; // RF-7 (RF-9: Username is kept)
    say(el.loginMessage, MESSAGES[result]);
    (result === "credentials" ? el.password : el.username).focus();
    return;
  }
  el.password.value = "";
  await verify();
});

// RF-15: this browser only; data off the screen and out of memory first, the form empty.
el.logout.addEventListener("click", () => {
  showLogin(null, { clearUsername: true });
  pendingSignOut = signOutLocal();
  el.username.focus();
});

el.retry.addEventListener("click", () => {
  if (el.retry.disabled || state.loading) return;
  resume();
});

// RF-16: the session ended on its own (refresh rejected, sessions revoked).
onSessionEnd(() => {
  if (state.phase === "login") return;
  showLogin("session_ended");
});

// Ready: "Log in" only works from here on (RF-66).
setBusy(false);
resume({ onStart: true });
