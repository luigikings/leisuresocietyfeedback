// Statistics and common filters for /admin (spec 002: RF-22 a RF-25, RF-29 a RF-37, RF-57, RF-70, RF-71, RF-72, RF-76).
// Pure module: no DOM, no network, no date. The same functions feed the screen and "Download statistics"
// (RF-57), so both show exactly the same numbers. Texts of questions, options and countries come from the
// content data passed in (js/content.js, RF-28), never copied here.
import { OTHER_CODE, flagPath } from "./sites.js";
import { isMultiple, lettersOf } from "./choice.js";

const ALL_COUNTRIES = "ALL";
const OTHER_LABEL = "Other";
const OTHER_ICON = "assets/icons/other.svg";
const OPEN_SUFFIX = " (open answer)";

/** Notice of the multiple-choice block, shown always, also with "No answers yet" (RF-72, propuestas 34 y 39). */
export const MULTIPLE_NOTE = "Multiple choice – percentages can add up to more than 100%";

/** Initial filters: unfiltered, so no country is ever required (RF-23, RF-24). */
export const INITIAL_FILTERS = Object.freeze({ country: ALL_COUNTRIES, status: "all" });

/** "Status" choices (RF-24); values are the stored statuses. */
export const STATUS_CHOICES = Object.freeze([
  Object.freeze({ value: "all", label: "All" }),
  Object.freeze({ value: "completed", label: "Completed" }),
  Object.freeze({ value: "in_progress", label: "In progress" }),
]);

/**
 * Percentage rounded to the nearest integer, halves up, with integers only (no floating point drift).
 * 0 when total is 0.
 */
export function percent(count, total) {
  if (total === 0) return 0;
  return Math.floor((200 * count + total) / (2 * total));
}

/** Rows of the current version, and how many loaded rows belong to other versions, before filters (RF-22). */
export function splitByVersion(rows, version) {
  const current = [];
  let hiddenCount = 0;
  for (const r of rows) {
    if (r.content_version === version) current.push(r);
    else hiddenCount += 1;
  }
  return { current, hiddenCount };
}

/** Notice above the filters (RF-22), or null when nothing is hidden; singular for 1. */
export function hiddenVersionsNotice(hiddenCount) {
  if (hiddenCount <= 0) return null;
  if (hiddenCount === 1) return "1 response from other content versions is hidden.";
  return `${hiddenCount} responses from other content versions are hidden.`;
}

function contentCountry(code, content) {
  return content.countries.find((c) => c.code === code) ?? null;
}

/** Display name: content name, "Other", or the bare code when it is not in the content. */
export function countryName(code, content) {
  if (code === OTHER_CODE) return OTHER_LABEL;
  return contentCountry(code, content)?.name ?? code;
}

/** Site-relative image for a country: its flag, the "Other" icon, or null for an unknown code (RF-30). */
export function countryFlag(code, content) {
  if (code === OTHER_CODE) return OTHER_ICON;
  return contentCountry(code, content) ? flagPath(code) : null;
}

/** Codes present in the rows (plus `extra`, if given) that are neither content countries nor "Other", A-Z. */
function unknownCodes(rows, content, extra) {
  const known = new Set(content.countries.map((c) => c.code));
  known.add(OTHER_CODE);
  known.add(ALL_COUNTRIES);
  const unknown = new Set();
  for (const r of rows) if (r.country && !known.has(r.country)) unknown.add(r.country);
  if (typeof extra === "string" && extra !== "" && !known.has(extra)) unknown.add(extra);
  return [...unknown].sort();
}

/**
 * "Country" choices (RF-23): "All countries" (initial, unfiltered), the content countries in their order,
 * "Other", then any unknown code found in the current-version rows, A-Z. `selected` (the current filter) is
 * kept among the unknown codes even when a "Refresh" left it with no rows, so the filter is preserved (RF-20).
 */
export function countryChoices(current, content, selected) {
  return [
    { value: ALL_COUNTRIES, label: "All countries" },
    ...content.countries.map((c) => ({ value: c.code, label: c.name })),
    { value: OTHER_CODE, label: OTHER_LABEL },
    ...unknownCodes(current, content, selected).map((code) => ({ value: code, label: code })),
  ];
}

/** "Country" and "Status" applied together (RF-25); defaults keep every row. Does not mutate the input. */
export function applyCommonFilters(rows, { country = ALL_COUNTRIES, status = "all" } = {}) {
  return rows.filter(
    (r) => (country === ALL_COUNTRIES || r.country === country) && (status === "all" || r.status === status),
  );
}

/** "Participants", "Completed" and "In progress" of the filtered set (RF-29). */
export function summary(rows) {
  let completed = 0;
  let inProgress = 0;
  for (const r of rows) {
    if (r.status === "completed") completed += 1;
    else if (r.status === "in_progress") inProgress += 1;
  }
  return { participants: rows.length, completed, inProgress };
}

function hasOption(value) {
  return typeof value === "string" && value !== "";
}

/** A comment is a stored text with something other than spaces (definición "Comentario"). */
export function hasComment(value) {
  return typeof value === "string" && value.trim() !== "";
}

/** Questions of a row with a stored option, known or not (0-10). */
export function answeredCount(row) {
  let n = 0;
  for (let i = 1; i <= 10; i++) if (hasOption(row[`q${i}_option`])) n += 1;
  return n;
}

/**
 * One block per content question, in order (RF-31 a RF-37):
 * { id, n, text, answers, comments, options: [{ letter, label, count, percent }],
 *   unknown: null | { count, percent, options: [{ letter, count, percent }] }, multiple, note }.
 * `answers` includes unknown options, which are therefore in the denominator but never in a bar.
 * Multiple choice (Q3, RF-71, RF-76): each row counts once in `answers`, and once in every distinct letter it
 * marked, so percentages may add up to more than 100 (RF-34); `unknown.count` counts rows with at least one
 * unknown letter, while `unknown.options` counts, per unknown letter, the rows that have it. In a
 * single-choice question the whole stored value is the option ("AC" in Q1 is one unknown option).
 */
export function questionStats(rows, content) {
  return content.questions.map((q, index) => {
    const multiple = isMultiple(q);
    const known = new Set(q.options.map((o) => o.letter));
    const counts = new Map();
    let answers = 0;
    let comments = 0;
    let unknownRows = 0;
    for (const r of rows) {
      const option = r[`${q.id}_option`];
      if (hasOption(option)) {
        answers += 1;
        const marked = multiple ? lettersOf(option) : [option];
        for (const letter of marked) counts.set(letter, (counts.get(letter) ?? 0) + 1);
        if (marked.some((letter) => !known.has(letter))) unknownRows += 1;
      }
      if (hasComment(r[`${q.id}_text`])) comments += 1;
    }
    const options = q.options.map((o) => {
      const count = counts.get(o.letter) ?? 0;
      return {
        letter: o.letter,
        label: o.type === "open-required" ? o.label + OPEN_SUFFIX : o.label,
        count,
        percent: percent(count, answers),
      };
    });
    const unknownOptions = [...counts.keys()]
      .filter((letter) => !known.has(letter))
      .sort()
      .map((letter) => ({ letter, count: counts.get(letter), percent: percent(counts.get(letter), answers) }));
    return {
      id: q.id,
      n: index + 1,
      text: q.text,
      answers,
      comments,
      options,
      unknown:
        unknownOptions.length === 0
          ? null
          : { count: unknownRows, percent: percent(unknownRows, answers), options: unknownOptions },
      multiple,
      note: multiple ? MULTIPLE_NOTE : null,
    };
  });
}

/**
 * "Participants by country" (RF-30), shown last (RF-70): one entry per country with rows,
 * { code, name, flag, count, percent } with percent over the filtered set; most rows first, and on ties
 * the content countries in order, then "Other", then unknown codes A-Z (propuesta 30).
 */
export function byCountry(rows, content) {
  const counts = new Map();
  for (const r of rows) counts.set(r.country, (counts.get(r.country) ?? 0) + 1);
  const total = rows.length;
  const contentRank = new Map(content.countries.map((c, i) => [c.code, i]));
  const rank = (code) => {
    if (contentRank.has(code)) return [0, contentRank.get(code)];
    if (code === OTHER_CODE) return [1, 0];
    return [2, 0];
  };
  return [...counts.entries()]
    .sort(([a, ca], [b, cb]) => {
      if (ca !== cb) return cb - ca;
      const [ga, ia] = rank(a);
      const [gb, ib] = rank(b);
      if (ga !== gb) return ga - gb;
      if (ia !== ib) return ia - ib;
      return a < b ? -1 : a > b ? 1 : 0;
    })
    .map(([code, count]) => ({
      code,
      name: countryName(code, content),
      flag: countryFlag(code, content),
      count,
      percent: percent(count, total),
    }));
}
