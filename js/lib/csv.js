// The two CSV downloads of /admin (spec 002: RF-55, RF-56, RF-57, RF-59, RF-60, RF-62; propuestas 13, 17, 21, 29).
// Pure module: no DOM, no network, no current date (the download moment and the time zone are parameters).
// Format for the team's English Excel: UTF-8 with BOM, comma separator, CRLF, RFC 4180 quoting (RF-59).
// The numbers of "Download statistics" come from admin-stats.js, the same functions as the screen (RF-57).
// The participant id is never written (RF-62).
import { OTHER_CODE } from "./sites.js";
import { STATUS_CHOICES, answeredCount, byCountry, hasComment, questionStats, summary } from "./admin-stats.js";
import { formatCsvDate } from "./admin-format.js";
import { isMultiple, lettersOf } from "./choice.js";

const BOM = "﻿";
const EOL = "\r\n";
const UNKNOWN_OPTION = "(unknown option)";
const QUESTIONS = 10;

/**
 * Formula protection for text cells (RF-60): an apostrophe in front when the first character is
 * = + - @ tab or CR, or when the first non-whitespace character (any Unicode space, U+00A0 included) is
 * = + - @. The rest of the text is unchanged.
 */
export function protectFormula(text) {
  if (/^[=+\-@\t\r]/.test(text) || /^\s*[=+\-@]/u.test(text)) return "'" + text;
  return text;
}

/**
 * One CSV cell: null/undefined → empty; numbers as is (never protected); text protected (RF-60) and quoted,
 * with inner quotes doubled, when it has a comma, a quote, a line break or leading/trailing whitespace.
 */
export function csvCell(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  const text = protectFormula(String(value));
  if (/[",\r\n]/.test(text) || /^\s|\s$/u.test(text)) return '"' + text.replace(/"/g, '""') + '"';
  return text;
}

/** The whole document: BOM + records joined by commas, each record ended by CRLF. */
export function toCsv(records) {
  return BOM + records.map((r) => r.map(csvCell).join(",") + EOL).join("");
}

const STATUS_LABELS = new Map(STATUS_CHOICES.map((c) => [c.value, c.label]));

/** "Completed" / "In progress" (and "All" for the filter) as on screen; any other stored value as is. */
function statusLabel(status) {
  return STATUS_LABELS.get(status) ?? status ?? "";
}

/** country_name of the CSV files: content name, "Other", or empty for an unknown code (propuesta 29). */
function csvCountryName(code, content) {
  if (code === OTHER_CODE) return "Other";
  return content.countries.find((c) => c.code === code)?.name ?? "";
}

/** "Country" filter as shown on screen: "All countries", content name, "Other" or the bare code. */
function countryFilterLabel(code, content) {
  if (code === undefined || code === "ALL") return "All countries";
  if (code === OTHER_CODE) return "Other";
  return content.countries.find((c) => c.code === code)?.name ?? code;
}

/**
 * The three cells of one question in "Download responses": option letter, label, comment. In the
 * multiple-choice question the marked letters go in A, B, C order as "A, C" and their labels as
 * "The theme; A message", with "(unknown option)" in place of an unknown letter (RF-74).
 */
function answerCells(row, question) {
  const option = row[`${question.id}_option`];
  if (typeof option !== "string" || option === "") return ["", "", ""];
  const marked = isMultiple(question) ? lettersOf(option).sort() : [option];
  const labels = marked.map((letter) => question.options.find((o) => o.letter === letter)?.label ?? UNKNOWN_OPTION);
  const text = row[`${question.id}_text`];
  return [marked.join(", "), labels.join("; "), hasComment(text) ? text : ""];
}

/**
 * "Download responses" (RF-55): one record per visible entry, in the given order (the caller passes the
 * entries of the list: common filters, search, comments filter and order already applied). Entries may be
 * { row } objects (from visibleEntries) or plain rows. Columns of propuesta 13, values of propuesta 29,
 * dates "AAAA-MM-DD HH:MM" in `timeZone` (propuesta 17).
 */
export function responsesCsv(entries, content, { timeZone }) {
  const questions = content.questions.slice(0, QUESTIONS);
  const header = [
    `started_at (${timeZone})`,
    `updated_at (${timeZone})`,
    "content_version",
    "country_code",
    "country_name",
    "status",
    "answered",
    ...questions.flatMap((q) => [`${q.id}_option`, `${q.id}_label`, `${q.id}_comment`]),
  ];
  const records = [header];
  for (const entry of entries) {
    const row = entry && entry.row ? entry.row : entry;
    records.push([
      formatCsvDate(row.created_at, timeZone),
      formatCsvDate(row.updated_at, timeZone),
      row.content_version ?? "",
      row.country ?? "",
      row.country ? csvCountryName(row.country, content) : "",
      statusLabel(row.status),
      answeredCount(row),
      ...questions.flatMap((q) => answerCells(row, q)),
    ]);
  }
  return toCsv(records);
}

/** The statistics of a filtered set with the same functions as the screen (RF-57). */
export function buildStatistics(rows, content) {
  return {
    summary: summary(rows),
    questions: questionStats(rows, content),
    countries: byCountry(rows, content),
  };
}

/**
 * "Download statistics" (RF-56, propuesta 21): one file with the sections "Filters", "Summary", "Questions"
 * (with one "(unknown option)" record per unknown letter and a last "choice" column, "single" or
 * "multiple", RF-74) and, last as on screen (RF-70),
 * "Participants by country", separated by one empty record. Percentages are integers without "%".
 * `stats` comes from buildStatistics on the filtered set; `filters` are the applied { country, status }.
 */
export function statisticsCsv(stats, { content, filters = {}, generatedAt, timeZone }) {
  const { summary: sum, questions, countries } = stats;
  const records = [
    ["Filters"],
    ["country", countryFilterLabel(filters.country, content)],
    ["status", statusLabel(filters.status ?? "all")],
    ["content_version", content.version],
    [`downloaded_at (${timeZone})`, formatCsvDate(generatedAt, timeZone)],
    ["participants", sum.participants],
    [""],
    ["Summary"],
    ["Participants", sum.participants],
    ["Completed", sum.completed],
    ["In progress", sum.inProgress],
    [""],
    ["Questions"],
    ["question", "question_text", "option", "option_label", "count", "percent", "answers", "comments", "choice"],
  ];
  for (const q of questions) {
    // "choice" on every row of the question, "(unknown option)" rows included (RF-74, propuestas 36 y 39).
    const tail = [q.answers, q.comments, q.multiple ? "multiple" : "single"];
    for (const o of q.options) records.push([`Q${q.n}`, q.text, o.letter, o.label, o.count, o.percent, ...tail]);
    for (const u of q.unknown?.options ?? []) {
      records.push([`Q${q.n}`, q.text, u.letter, UNKNOWN_OPTION, u.count, u.percent, ...tail]);
    }
  }
  records.push([""], ["Participants by country"], ["country_code", "country_name", "participants", "percent"]);
  for (const c of countries) records.push([c.code, csvCountryName(c.code, content), c.count, c.percent]);
  return toCsv(records);
}
