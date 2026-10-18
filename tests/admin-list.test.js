// List logic for /admin "Responses" (spec 002: RF-39 a RF-46, RF-64).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fold,
  hasComment,
  COMMENT_CHOICES,
  ORDER_CHOICES,
  INITIAL_LIST_STATE,
  isListFiltered,
  clearFilters,
  matchRow,
  sortRows,
  visibleEntries,
  showingText,
  EMPTY_LIST_MESSAGE,
} from "../js/lib/admin-list.js";
import { INITIAL_FILTERS } from "../js/lib/admin-stats.js";

let seq = 0;
/** A loaded row; `comments` maps "q3" → text. */
function row({ id, created = "2026-10-18T20:00:00+00:00", updated = created, comments = {} } = {}) {
  seq += 1;
  const r = {
    id: id ?? `id-${String(seq).padStart(3, "0")}`,
    content_version: "v",
    country: "NL",
    status: "completed",
    created_at: created,
    updated_at: updated,
  };
  for (let i = 1; i <= 10; i++) {
    r[`q${i}_option`] = "A";
    r[`q${i}_text`] = comments[`q${i}`] ?? null;
  }
  return r;
}

// ---- fold: no case, no accents (RF-43) ----

test("fold removes accents and case", () => {
  assert.equal(fold("Árbol CAFÉ Niño Ü"), "arbol cafe nino u");
  assert.equal(fold("café"), "cafe"); // already decomposed
});

test("fold keeps emojis and other text", () => {
  assert.equal(fold("Fun 🎉 Party"), "fun 🎉 party");
});

test("hasComment: empty or whitespace text is no comment", () => {
  assert.equal(hasComment("ok"), true);
  assert.equal(hasComment(""), false);
  assert.equal(hasComment("   "), false);
  assert.equal(hasComment(null), false);
  assert.equal(hasComment(undefined), false);
});

// ---- choices and initial state (RF-41, RF-44, RF-46) ----

test("Comments choices: All responses (initial), With any comment, then Q1-Q10", () => {
  assert.equal(COMMENT_CHOICES.length, 12);
  assert.deepEqual(COMMENT_CHOICES[0], { value: "all", label: "All responses" });
  assert.deepEqual(COMMENT_CHOICES[1], { value: "any", label: "With any comment" });
  assert.deepEqual(COMMENT_CHOICES[2], { value: "q1", label: "With a comment in Q1" });
  assert.deepEqual(COMMENT_CHOICES[11], { value: "q10", label: "With a comment in Q10" });
});

test("Order choices: Newest first, Oldest first", () => {
  assert.deepEqual(ORDER_CHOICES, [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
  ]);
});

test("initial list state: no search, all responses, newest first", () => {
  assert.deepEqual(INITIAL_LIST_STATE, { query: "", comments: "all", order: "newest" });
  assert.equal(isListFiltered(INITIAL_LIST_STATE), false);
});

test("isListFiltered: search (not only spaces) or comments filter (RF-64)", () => {
  assert.equal(isListFiltered({ ...INITIAL_LIST_STATE, query: "  " }), false);
  assert.equal(isListFiltered({ ...INITIAL_LIST_STATE, query: "x" }), true);
  assert.equal(isListFiltered({ ...INITIAL_LIST_STATE, comments: "any" }), true);
  assert.equal(isListFiltered({ ...INITIAL_LIST_STATE, comments: "q4" }), true);
  assert.equal(isListFiltered({ ...INITIAL_LIST_STATE, order: "oldest" }), false);
});

test("clearFilters resets country, status, search, comments and order (RF-46)", () => {
  const cleared = clearFilters();
  assert.deepEqual(cleared, { filters: { ...INITIAL_FILTERS }, list: { ...INITIAL_LIST_STATE } });
  // fresh objects each time: the caller may change them
  cleared.list.query = "x";
  assert.equal(clearFilters().list.query, "");
});

// ---- matchRow (RF-43, RF-44, RF-64) ----

test("no search, All responses: visible, nothing matched", () => {
  const r = row({ comments: { q2: "hi" } });
  assert.deepEqual(matchRow(r, INITIAL_LIST_STATE), { visible: true, matched: [] });
  assert.deepEqual(matchRow(row(), INITIAL_LIST_STATE), { visible: true, matched: [] });
});

test("search ignores case and accents on both sides", () => {
  const r = row({ comments: { q3: "Me encantó el MUSEO" } });
  const res = matchRow(r, { ...INITIAL_LIST_STATE, query: "encanto el museo" });
  assert.deepEqual(res, { visible: true, matched: [{ q: 3, text: "Me encantó el MUSEO" }] });
  assert.equal(matchRow(r, { ...INITIAL_LIST_STATE, query: "MUSÉO" }).visible, true);
});

test("search trims the query; a query of spaces is no search", () => {
  const r = row({ comments: { q1: "night clubs" } });
  assert.equal(matchRow(r, { ...INITIAL_LIST_STATE, query: "  clubs  " }).visible, true);
  assert.deepEqual(matchRow(row(), { ...INITIAL_LIST_STATE, query: "   " }), { visible: true, matched: [] });
});

test("search keeps inner spaces of the query", () => {
  const r = row({ comments: { q1: "night clubs" } });
  assert.equal(matchRow(r, { ...INITIAL_LIST_STATE, query: "night  clubs" }).visible, false);
});

test("search without a match hides the row; rows without comments never match", () => {
  const r = row({ comments: { q1: "cinema" } });
  assert.deepEqual(matchRow(r, { ...INITIAL_LIST_STATE, query: "park" }), { visible: false, matched: [] });
  assert.equal(matchRow(row(), { ...INITIAL_LIST_STATE, query: "park" }).visible, false);
});

test("search lists every matching comment in Q order, with the original text", () => {
  const r = row({ comments: { q7: "Park run", q2: "the PARK", q4: "beach" } });
  assert.deepEqual(matchRow(r, { ...INITIAL_LIST_STATE, query: "park" }).matched, [
    { q: 2, text: "the PARK" },
    { q: 7, text: "Park run" },
  ]);
});

test("With any comment, no search: visible only with a comment, all comments matched", () => {
  const state = { ...INITIAL_LIST_STATE, comments: "any" };
  assert.deepEqual(matchRow(row(), state), { visible: false, matched: [] });
  assert.deepEqual(matchRow(row({ comments: { q5: "   " } }), state), { visible: false, matched: [] });
  assert.deepEqual(matchRow(row({ comments: { q5: "b", q1: "a" } }), state), {
    visible: true,
    matched: [
      { q: 1, text: "a" },
      { q: 5, text: "b" },
    ],
  });
});

test("With a comment in Qn: only that question's comment counts", () => {
  const state = { ...INITIAL_LIST_STATE, comments: "q4" };
  assert.equal(matchRow(row({ comments: { q3: "x" } }), state).visible, false);
  assert.deepEqual(matchRow(row({ comments: { q3: "x", q4: "y" } }), state), {
    visible: true,
    matched: [{ q: 4, text: "y" }],
  });
  assert.deepEqual(matchRow(row({ comments: { q10: "ten" } }), { ...state, comments: "q10" }).matched, [
    { q: 10, text: "ten" },
  ]);
});

test("With a comment in Qn + search: the search only looks at Qn (RF-44)", () => {
  const r = row({ comments: { q2: "museum", q4: "beach" } });
  assert.equal(matchRow(r, { query: "museum", comments: "q4", order: "newest" }).visible, false);
  assert.deepEqual(matchRow(r, { query: "BEACH", comments: "q4", order: "newest" }), {
    visible: true,
    matched: [{ q: 4, text: "beach" }],
  });
});

test("With any comment + search: like the search alone", () => {
  const r = row({ comments: { q2: "museum", q4: "beach" } });
  assert.deepEqual(matchRow(r, { query: "beach", comments: "any", order: "newest" }), {
    visible: true,
    matched: [{ q: 4, text: "beach" }],
  });
});

// ---- sortRows (RF-41, propuesta 30) ----

test("newest first by updated_at; ties by created_at, then by id", () => {
  const a = row({ id: "a", created: "2026-10-18T10:00:00+00:00", updated: "2026-10-18T12:00:00+00:00" });
  const b = row({ id: "b", created: "2026-10-18T11:00:00+00:00", updated: "2026-10-18T12:00:00+00:00" });
  const c = row({ id: "c", created: "2026-10-18T09:00:00+00:00", updated: "2026-10-18T13:00:00+00:00" });
  const d = row({ id: "d", created: "2026-10-18T11:00:00+00:00", updated: "2026-10-18T12:00:00+00:00" });
  const e = row({ id: "e", created: "2026-10-18T08:00:00+00:00", updated: "2026-10-18T08:30:00+00:00" });
  const ids = (rows) => rows.map((r) => r.id);
  assert.deepEqual(ids(sortRows([a, b, c, d, e], "newest")), ["c", "d", "b", "a", "e"]);
  // same result whatever the input order
  assert.deepEqual(ids(sortRows([e, d, c, b, a], "newest")), ["c", "d", "b", "a", "e"]);
  // "Oldest first" reverses the whole order, tie-breaks included
  assert.deepEqual(ids(sortRows([a, b, c, d, e], "oldest")), ["e", "a", "b", "d", "c"]);
});

test("sorts by instant, not by text: offsets and microseconds", () => {
  const x = row({ id: "x", updated: "2026-10-18T22:00:00+02:00" }); // 20:00 UTC
  const y = row({ id: "y", updated: "2026-10-18T21:00:00+00:00" }); // 21:00 UTC
  const p = row({ id: "p", updated: "2026-10-18T20:00:00.123401+00:00" });
  const q = row({ id: "q", updated: "2026-10-18T20:00:00.1234+00:00" });
  const ids = (rows) => rows.map((r) => r.id);
  assert.deepEqual(ids(sortRows([x, y], "newest")), ["y", "x"]);
  assert.deepEqual(ids(sortRows([q, p], "newest")), ["p", "q"]);
});

test("sortRows does not mutate its input", () => {
  const rows = [row({ updated: "2026-10-18T01:00:00Z" }), row({ updated: "2026-10-18T02:00:00Z" })];
  const copy = [...rows];
  sortRows(rows, "newest");
  assert.deepEqual(rows, copy);
});

// ---- visibleEntries and "Showing X of Y" (RF-39, RF-45, RF-46) ----

test("visibleEntries filters, sorts and counts over the filtered set", () => {
  const a = row({ id: "a", updated: "2026-10-18T10:00:00Z", comments: { q1: "Música" } });
  const b = row({ id: "b", updated: "2026-10-18T12:00:00Z", comments: { q2: "musica" } });
  const c = row({ id: "c", updated: "2026-10-18T11:00:00Z" });
  const res = visibleEntries([a, b, c], { ...INITIAL_LIST_STATE, query: "MUSICA" });
  assert.deepEqual(
    res.entries.map((e) => [e.row.id, e.matched]),
    [
      ["b", [{ q: 2, text: "musica" }]],
      ["a", [{ q: 1, text: "Música" }]],
    ],
  );
  assert.deepEqual(res.counts, { shown: 2, total: 3 });
});

test("visibleEntries with the initial state shows every row, newest first", () => {
  const a = row({ id: "a", updated: "2026-10-18T10:00:00Z" });
  const b = row({ id: "b", updated: "2026-10-18T12:00:00Z" });
  const res = visibleEntries([a, b], INITIAL_LIST_STATE);
  assert.deepEqual(res.entries.map((e) => e.row.id), ["b", "a"]);
  assert.deepEqual(res.counts, { shown: 2, total: 2 });
});

test("visibleEntries on an empty set", () => {
  assert.deepEqual(visibleEntries([], INITIAL_LIST_STATE), { entries: [], counts: { shown: 0, total: 0 } });
});

test("Showing X of Y responses (singular when Y is 1)", () => {
  assert.equal(showingText({ shown: 2, total: 3 }), "Showing 2 of 3 responses");
  assert.equal(showingText({ shown: 0, total: 0 }), "Showing 0 of 0 responses");
  assert.equal(showingText({ shown: 1, total: 1 }), "Showing 1 of 1 response");
  assert.equal(showingText({ shown: 0, total: 1 }), "Showing 0 of 1 response");
});

test("empty list message (RF-46)", () => {
  assert.equal(EMPTY_LIST_MESSAGE, "No responses match your filters.");
});

// ---- describeEntry: what one entry shows (RF-40, RF-47, RF-48), T9 ----
import { describeEntry, NO_RESPONSES_MESSAGE, UNKNOWN_OPTION_LABEL } from "../js/lib/admin-list.js";

const CONTENT_T9 = {
  version: "v",
  countries: [
    { code: "NL", name: "Netherlands" },
    { code: "DE", name: "Germany" },
  ],
  questions: Array.from({ length: 10 }, (_, i) => ({
    id: `q${i + 1}`,
    text: `Question ${i + 1}?`,
    options: [
      { letter: "A", label: i === 1 ? "Tell us…" : `Yes ${i + 1}`, type: i === 1 ? "open-required" : "normal" },
      { letter: "B", label: `No ${i + 1}`, type: "normal" },
    ],
  })),
};

function partial(extra = {}) {
  const r = {
    id: "secret-id-123",
    content_version: "v",
    country: "NL",
    status: "in_progress",
    created_at: "2026-10-18T19:34:00Z",
    updated_at: "2026-10-18T20:05:00Z",
  };
  for (let i = 1; i <= 10; i++) {
    r[`q${i}_option`] = null;
    r[`q${i}_text`] = null;
  }
  return { ...r, ...extra };
}

test("describeEntry: dates in the given zone, country, status and n/10 answered (RF-40)", () => {
  const e = describeEntry(partial({ q1_option: "A", q2_option: "B" }), CONTENT_T9, { timeZone: "Europe/Amsterdam" });
  assert.equal(e.started, "18 Oct 2026, 21:34");
  assert.equal(e.updated, "18 Oct 2026, 22:05");
  assert.deepEqual(e.country, { code: "NL", name: "Netherlands", flag: "assets/flags/nl.svg" });
  assert.equal(e.status, "In progress");
  assert.equal(e.answeredText, "2/10 answered");
  const done = describeEntry(partial({ status: "completed" }), CONTENT_T9, { timeZone: "UTC" });
  assert.equal(done.status, "Completed");
  assert.equal(done.started, "18 Oct 2026, 19:34");
  assert.equal(done.answeredText, "0/10 answered");
});

test("describeEntry: Other, unknown code without flag, missing country", () => {
  const tz = { timeZone: "UTC" };
  assert.deepEqual(describeEntry(partial({ country: "OTHER" }), CONTENT_T9, tz).country, {
    code: "OTHER",
    name: "Other",
    flag: "assets/icons/other.svg",
  });
  assert.deepEqual(describeEntry(partial({ country: "BR" }), CONTENT_T9, tz).country, { code: "BR", name: "BR", flag: null });
  assert.deepEqual(describeEntry(partial({ country: null }), CONTENT_T9, tz).country, { code: "", name: "—", flag: null });
});

test("describeEntry: Q1-Q10 with letter · label, comment below, or — (RF-40)", () => {
  const e = describeEntry(
    partial({ q1_option: "A", q1_text: "Great\nnight", q2_option: "A", q2_text: "The music", q3_option: "B", q3_text: "   " }),
    CONTENT_T9,
    { timeZone: "UTC" },
  );
  assert.equal(e.answers.length, 10);
  assert.deepEqual(e.answers[0], { n: 1, answer: "A · Yes 1", comment: "Great\nnight" });
  assert.deepEqual(e.answers[1], { n: 2, answer: "A · Tell us…", comment: "The music" });
  assert.deepEqual(e.answers[2], { n: 3, answer: "B · No 3", comment: null }, "only spaces is no comment");
  assert.deepEqual(e.answers[9], { n: 10, answer: "—", comment: null });
});

test("describeEntry: unknown option letter, and a comment kept as stored text (RF-47)", () => {
  const html = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
  const e = describeEntry(partial({ q1_option: "C", q4_option: "A", q4_text: html }), CONTENT_T9, { timeZone: "UTC" });
  assert.equal(e.answers[0].answer, `C · ${UNKNOWN_OPTION_LABEL}`);
  assert.equal(UNKNOWN_OPTION_LABEL, "(unknown option)");
  assert.equal(e.answers[3].comment, html);
  assert.equal(e.answeredText, "2/10 answered");
});

test("describeEntry never carries the participant id (RF-48)", () => {
  const e = describeEntry(partial({ q1_option: "A" }), CONTENT_T9, { timeZone: "UTC" });
  assert.equal(JSON.stringify(e).includes("secret-id-123"), false);
  assert.equal("id" in e, false);
});

test("no responses at all: 'No responses yet.'", () => {
  assert.equal(NO_RESPONSES_MESSAGE, "No responses yet.");
});
