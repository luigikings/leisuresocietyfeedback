// "Responses" list logic for /admin (spec 002: RF-39 a RF-46, RF-64).
// Pure module: no DOM, no network, no date. It works on the filtered set (current version + "Country" and
// "Status", see admin-stats.js) and adds the search, the "Comments" filter and the order.
import { INITIAL_FILTERS, STATUS_CHOICES, answeredCount, countryFlag, countryName, hasComment } from "./admin-stats.js";
import { formatDisplay } from "./admin-format.js";
import { isMultiple, lettersOf } from "./choice.js";

export { hasComment };

const QUESTIONS = 10;

/** Lower case without accents (NFD + no combining marks), for comparisons only (RF-43). */
export function fold(s) {
  return String(s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** "Comments" filter choices (RF-44); "all" is the initial value. */
export const COMMENT_CHOICES = Object.freeze([
  Object.freeze({ value: "all", label: "All responses" }),
  Object.freeze({ value: "any", label: "With any comment" }),
  ...Array.from({ length: QUESTIONS }, (_, i) =>
    Object.freeze({ value: `q${i + 1}`, label: `With a comment in Q${i + 1}` }),
  ),
]);

/** Order control (RF-41); "newest" is the initial value. */
export const ORDER_CHOICES = Object.freeze([
  Object.freeze({ value: "newest", label: "Newest first" }),
  Object.freeze({ value: "oldest", label: "Oldest first" }),
]);

export const INITIAL_LIST_STATE = Object.freeze({ query: "", comments: "all", order: "newest" });

export const EMPTY_LIST_MESSAGE = "No responses match your filters.";

/** True while the search or the "Comments" filter is active (RF-64: show matched comments in the card). */
export function isListFiltered({ query = "", comments = "all" } = {}) {
  return query.trim() !== "" || comments !== "all";
}

/** "Clear filters" (RF-46): country, status, search, comments filter and order back to their initial values. */
export function clearFilters() {
  return { filters: { ...INITIAL_FILTERS }, list: { ...INITIAL_LIST_STATE } };
}

/** Question numbers the filter looks at: one question for "qN", every question otherwise. */
function scope(comments) {
  const m = /^q(\d+)$/.exec(comments);
  if (m) return [Number(m[1])];
  return Array.from({ length: QUESTIONS }, (_, i) => i + 1);
}

/**
 * Whether a row passes the search and the "Comments" filter, and which comments make it pass:
 * { visible, matched: [{ q, text }] } with `text` as stored and in Q order (RF-43, RF-44, RF-64).
 * With "All responses" and no search every row is visible and nothing is matched.
 */
export function matchRow(row, { query = "", comments = "all" } = {}) {
  const needle = fold(query.trim());
  if (needle === "" && comments === "all") return { visible: true, matched: [] };
  const matched = [];
  for (const q of scope(comments)) {
    const text = row[`q${q}_text`];
    if (!hasComment(text)) continue;
    if (needle === "" || fold(text).includes(needle)) matched.push({ q, text });
  }
  return { visible: matched.length > 0, matched };
}

/**
 * Comparable instant in microseconds; PostgreSQL keeps microseconds, Date only milliseconds.
 * A missing or invalid date sorts as the oldest.
 */
function instant(iso) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return -Infinity;
  const frac = /T\d{2}:\d{2}:\d{2}\.(\d+)/.exec(String(iso));
  const extra = frac ? Number(frac[1].slice(3, 6).padEnd(3, "0")) : 0;
  return ms * 1000 + extra;
}

function compareAsc(a, b) {
  const byUpdated = instant(a.updated_at) - instant(b.updated_at);
  if (byUpdated) return byUpdated;
  const byCreated = instant(a.created_at) - instant(b.created_at);
  if (byCreated) return byCreated;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Last update, then start, then the internal id, so equal dates always give the same order (RF-41,
 * propuesta 30). "newest" is the descending order; "oldest" reverses the whole comparison. New array.
 */
export function sortRows(rows, order = "newest") {
  const sign = order === "oldest" ? 1 : -1;
  return [...rows].sort((a, b) => sign * compareAsc(a, b));
}

/**
 * The list of "Responses" for the filtered set: entries [{ row, matched }] in order, and the counts for
 * "Showing X of Y" (shown = visible entries, total = rows of the filtered set) (RF-39, RF-45).
 */
export function visibleEntries(rows, listState = INITIAL_LIST_STATE) {
  const entries = [];
  for (const row of sortRows(rows, listState.order)) {
    const { visible, matched } = matchRow(row, listState);
    if (visible) entries.push({ row, matched });
  }
  return { entries, counts: { shown: entries.length, total: rows.length } };
}

/** "Showing X of Y responses" (RF-45), with "response" when Y is 1. */
export function showingText({ shown, total }) {
  return `Showing ${shown} of ${total} ${total === 1 ? "response" : "responses"}`;
}

/** "No responses yet." when the current version has no rows at all (casos límite). */
export const NO_RESPONSES_MESSAGE = "No responses yet.";

/** Label of a stored letter that is not in the content (as in "Download responses"). */
export const UNKNOWN_OPTION_LABEL = "(unknown option)";

const STATUS_LABELS = new Map(STATUS_CHOICES.map((c) => [c.value, c.label]));

/**
 * What one entry of "Responses" shows (RF-40), as text: start and last update in `timeZone`, the country
 * ({ code, name, flag } with a site-relative flag or null), "Completed"/"In progress", "n/10 answered" and,
 * for Q1-Q10, { n, answer: "A · label" | "—", lines: ["A · label", …] | [], comment: stored text | null }; in the
 * multiple-choice question `lines` has one "letter · label" per marked letter and `answer` joins them with "\n" (RF-73). Comments are returned as stored:
 * the interface puts them in with textContent (RF-47). The participant id is never part of it (RF-48).
 */
export function describeEntry(row, content, { timeZone }) {
  const code = typeof row.country === "string" ? row.country : "";
  const answered = answeredCount(row);
  const answers = content.questions.slice(0, QUESTIONS).map((q, index) => {
    const option = row[`${q.id}_option`];
    const text = row[`${q.id}_text`];
    let lines = [];
    if (typeof option === "string" && option !== "") {
      // Multiple choice: one line per marked letter, A, B, C order (RF-73). Single: the whole value is the option.
      const marked = isMultiple(q) ? lettersOf(option).sort() : [option];
      lines = marked.map((letter) => {
        const known = q.options.find((o) => o.letter === letter);
        return `${letter} · ${known ? known.label : UNKNOWN_OPTION_LABEL}`;
      });
    }
    const answer = lines.length > 0 ? lines.join("\n") : "—";
    return { n: index + 1, answer, lines, comment: hasComment(text) ? text : null };
  });
  return {
    started: formatDisplay(row.created_at, timeZone),
    updated: formatDisplay(row.updated_at, timeZone),
    country: code === "" ? { code: "", name: "—", flag: null } : { code, name: countryName(code, content), flag: countryFlag(code, content) },
    status: STATUS_LABELS.get(row.status) ?? String(row.status ?? ""),
    answered,
    answeredText: `${answered}/${QUESTIONS} answered`,
    answers,
  };
}
