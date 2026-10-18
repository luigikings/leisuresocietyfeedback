// The two CSV downloads of /admin (spec 002: RF-55, RF-56, RF-57, RF-59, RF-60, RF-62; propuestas 13, 17, 21, 29).
import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTENT } from "../js/content.js";
import { protectFormula, csvCell, toCsv, responsesCsv, statisticsCsv, buildStatistics } from "../js/lib/csv.js";
import { summary, questionStats, byCountry, applyCommonFilters } from "../js/lib/admin-stats.js";
import { visibleEntries } from "../js/lib/admin-list.js";

const BOM = "﻿";
const V = CONTENT.version;

let seq = 0;
/** A row like the ones the panel loads; `answers` maps "q1" → ["A", "text"?]. */
function row({ country = "NL", status = "completed", answers = {}, created, updated } = {}) {
  seq += 1;
  const r = {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    content_version: V,
    country,
    status,
    created_at: created ?? "2026-10-18T19:00:00.000000+00:00",
    updated_at: updated ?? "2026-10-18T19:30:00.000000+00:00",
  };
  for (let i = 1; i <= 10; i++) {
    const a = answers[`q${i}`];
    r[`q${i}_option`] = a ? a[0] : null;
    r[`q${i}_text`] = a && a[1] !== undefined ? a[1] : null;
  }
  return r;
}

/** RFC 4180 parser for the tests: BOM stripped, CRLF records, quoted fields with "" escapes. */
function parseCsv(text) {
  assert.ok(text.startsWith(BOM), "starts with the BOM");
  const s = text.slice(1);
  const records = [];
  let rec = [];
  let field = "";
  let i = 0;
  let quoted = false;
  while (i < s.length) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        field += '"';
        i += 2;
      } else if (ch === '"') {
        quoted = false;
        i += 1;
      } else {
        field += ch;
        i += 1;
      }
    } else if (ch === '"' && field === "") {
      quoted = true;
      i += 1;
    } else if (ch === ",") {
      rec.push(field);
      field = "";
      i += 1;
    } else if (ch === "\r" && s[i + 1] === "\n") {
      rec.push(field);
      records.push(rec);
      rec = [];
      field = "";
      i += 2;
    } else {
      assert.notEqual(ch, "\n", "no bare LF outside quotes");
      assert.notEqual(ch, "\r", "no bare CR outside quotes");
      field += ch;
      i += 1;
    }
  }
  assert.equal(field, "", "ends with CRLF");
  assert.equal(rec.length, 0, "ends with CRLF");
  return records;
}

// ---- protectFormula (RF-60) ----

test("protectFormula: = + - @ at the start get an apostrophe, the rest unchanged", () => {
  assert.equal(protectFormula("=SUM(A1)"), "'=SUM(A1)");
  assert.equal(protectFormula("+1"), "'+1");
  assert.equal(protectFormula("-1"), "'-1");
  assert.equal(protectFormula("@cmd"), "'@cmd");
});

test("protectFormula: tab or CR as first character", () => {
  assert.equal(protectFormula("\tabc"), "'\tabc");
  assert.equal(protectFormula("\rabc"), "'\rabc");
});

test("protectFormula: spaces of any kind before = + - @, including U+00A0", () => {
  assert.equal(protectFormula("  =1+1"), "'  =1+1");
  assert.equal(protectFormula(" =1+1"), "' =1+1");
  assert.equal(protectFormula(" +x"), "' +x");
  assert.equal(protectFormula("　-x"), "'　-x");
  assert.equal(protectFormula("\n@x"), "'\n@x");
  assert.equal(protectFormula(" \t =x"), "' \t =x");
});

test("protectFormula: normal text untouched, also with = later or spaces before letters", () => {
  assert.equal(protectFormula("Loved it"), "Loved it");
  assert.equal(protectFormula("a=b"), "a=b");
  assert.equal(protectFormula("  hello"), "  hello");
  assert.equal(protectFormula(""), "");
  assert.equal(protectFormula("'=already"), "'=already");
  assert.equal(protectFormula("😀 =x"), "😀 =x");
});

// ---- csvCell / toCsv (RF-59) ----

test("csvCell: numbers untouched, also negative ones and percentages", () => {
  assert.equal(csvCell(0), "0");
  assert.equal(csvCell(67), "67");
  assert.equal(csvCell(-5), "-5");
});

test("csvCell: null and undefined are empty", () => {
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(undefined), "");
});

test("csvCell: commas, quotes and line breaks are quoted, inner quotes doubled", () => {
  assert.equal(csvCell("a,b"), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell("line1\nline2"), '"line1\nline2"');
  assert.equal(csvCell("line1\r\nline2"), '"line1\r\nline2"');
  assert.equal(csvCell("plain"), "plain");
});

test("csvCell: leading or trailing spaces are quoted so they survive", () => {
  assert.equal(csvCell(" x"), '" x"');
  assert.equal(csvCell("x "), '"x "');
});

test("csvCell: protection applied to text before quoting", () => {
  assert.equal(csvCell("=1,2"), "\"'=1,2\"");
  assert.equal(csvCell("\t=x"), "'\t=x");
});

test("csvCell: accents and emojis kept as is", () => {
  assert.equal(csvCell("Café 😀 — ñ"), "Café 😀 — ñ");
});

test("toCsv: BOM, comma separator, CRLF after every record", () => {
  assert.equal(toCsv([["a", 1], ["b,c", null]]), BOM + 'a,1\r\n"b,c",\r\n');
});

test("toCsv: round trip of tricky values", () => {
  const values = ['He said "wow", then\nleft', "😀🎉", "=HYPERLINK(\"x\")", " @x", "-3", "naïve"];
  const parsed = parseCsv(toCsv([values]));
  assert.deepEqual(parsed, [
    ['He said "wow", then\nleft', "😀🎉", "'=HYPERLINK(\"x\")", "' @x", "'-3", "naïve"],
  ]);
});

// ---- responsesCsv (RF-55, RF-62, propuestas 13, 17, 29) ----

const RESPONSE_HEADER = [
  "started_at (UTC)",
  "updated_at (UTC)",
  "content_version",
  "country_code",
  "country_name",
  "status",
  "answered",
  ...Array.from({ length: 10 }, (_, i) => [`q${i + 1}_option`, `q${i + 1}_label`, `q${i + 1}_comment`]).flat(),
];

test("responsesCsv: header with the time zone and 37 columns", () => {
  const records = parseCsv(responsesCsv([], CONTENT, { timeZone: "UTC" }));
  assert.deepEqual(records, [RESPONSE_HEADER]);
  const ams = parseCsv(responsesCsv([], CONTENT, { timeZone: "Europe/Amsterdam" }));
  assert.equal(ams[0][0], "started_at (Europe/Amsterdam)");
  assert.equal(ams[0][1], "updated_at (Europe/Amsterdam)");
});

test("responsesCsv: values of a full row (propuesta 29)", () => {
  const r = row({
    country: "NL",
    status: "completed",
    created: "2026-10-18T19:05:00.000000+00:00",
    updated: "2026-10-18T19:34:59.900000+00:00",
    answers: { q1: ["A"], q2: ["A", 'Music, "loud"\nand fun'], q9: ["B", "   "] },
  });
  const [, line] = parseCsv(responsesCsv([{ row: r, matched: [] }], CONTENT, { timeZone: "Europe/Amsterdam" }));
  assert.equal(line.length, 37);
  assert.deepEqual(line.slice(0, 7), ["2026-10-18 21:05", "2026-10-18 21:34", V, "NL", "Netherlands", "Completed", "3"]);
  assert.deepEqual(line.slice(7, 10), ["A", "I stopped thinking and felt truly in the moment.", ""]);
  assert.deepEqual(line.slice(10, 13), ["A", "Tell us…", 'Music, "loud"\nand fun']);
  assert.deepEqual(line.slice(13, 16), ["", "", ""], "unanswered: three empty columns");
  assert.deepEqual(line.slice(31, 34), ["B", "Something was a bit messy", ""], "blank comment is empty");
});

test("responsesCsv: Other, unknown country code with empty name, In progress, unknown option", () => {
  const other = row({ country: "OTHER", status: "in_progress", answers: { q1: ["B"] } });
  const unknown = row({ country: "FR", status: "in_progress", answers: { q1: ["C", "hm"] } });
  const records = parseCsv(responsesCsv([{ row: other }, { row: unknown }], CONTENT, { timeZone: "UTC" }));
  assert.deepEqual(records[1].slice(3, 7), ["OTHER", "Other", "In progress", "1"]);
  assert.deepEqual(records[2].slice(3, 7), ["FR", "", "In progress", "1"]);
  assert.deepEqual(records[2].slice(7, 10), ["C", "(unknown option)", "hm"]);
});

test("responsesCsv: comments protected against formulas, no participant id anywhere", () => {
  const r = row({ answers: { q2: ["A", "=cmd|' /C calc'!A0"], q5: ["A", " +1"] } });
  const csv = responsesCsv([{ row: r }], CONTENT, { timeZone: "UTC" });
  const [, line] = parseCsv(csv);
  assert.equal(line[12], "'=cmd|' /C calc'!A0");
  assert.equal(line[21], "' +1");
  assert.ok(!csv.includes(r.id), "the participant id is never exported (RF-62)");
  assert.ok(!RESPONSE_HEADER.some((h) => /(^|_)id$/.test(h)));
});

test("responsesCsv: same rows and order as the visible list, with filters (RF-55)", () => {
  const a = row({ country: "NL", updated: "2026-10-18T19:00:00.000000+00:00", answers: { q2: ["A", "Great music"] } });
  const b = row({ country: "DE", updated: "2026-10-18T20:00:00.000000+00:00", answers: { q2: ["A", "music!"] } });
  const c = row({ country: "NL", updated: "2026-10-18T21:00:00.000000+00:00", answers: { q2: ["A", "Music"] } });
  const d = row({ country: "NL", updated: "2026-10-18T22:00:00.000000+00:00", answers: { q2: ["A", "food"] } });
  const filtered = applyCommonFilters([a, b, c, d], { country: "NL", status: "all" });
  const { entries } = visibleEntries(filtered, { query: "MUSIC", comments: "all", order: "newest" });
  const records = parseCsv(responsesCsv(entries, CONTENT, { timeZone: "UTC" }));
  assert.deepEqual(
    records.slice(1).map((l) => l[12]),
    ["Music", "Great music"],
  );
});

test("responsesCsv: also accepts plain rows", () => {
  const r = row({ country: "IT" });
  const records = parseCsv(responsesCsv([r], CONTENT, { timeZone: "UTC" }));
  assert.equal(records[1][4], "Italy");
});

// ---- statisticsCsv (RF-56, RF-57, propuesta 21) ----

const AT = new Date("2026-10-18T19:34:00Z");

function sampleRows() {
  return [
    row({ country: "NL", answers: { q1: ["A", "yes"], q2: ["A", "Music"], q3: ["C"] } }),
    row({ country: "NL", status: "in_progress", answers: { q1: ["B"], q2: ["X"] } }),
    row({ country: "OTHER", answers: { q1: ["A"], q3: ["A", "=bad"] } }),
    row({ country: "FR", status: "in_progress", answers: { q1: ["A"] } }),
  ];
}

function sections(records) {
  const out = [];
  let current = null;
  for (const r of records) {
    if (r.length === 1 && r[0] === "") {
      current = null;
      continue;
    }
    if (!current) {
      current = { title: r[0], rows: [] };
      out.push(current);
    } else current.rows.push(r);
  }
  return out;
}

test("buildStatistics uses the admin-stats functions (RF-57)", () => {
  const rows = sampleRows();
  assert.deepEqual(buildStatistics(rows, CONTENT), {
    summary: summary(rows),
    questions: questionStats(rows, CONTENT),
    countries: byCountry(rows, CONTENT),
  });
});

test("statisticsCsv: four sections in order Filters, Summary, Questions, Participants by country", () => {
  const rows = sampleRows();
  const csv = statisticsCsv(buildStatistics(rows, CONTENT), {
    content: CONTENT,
    filters: { country: "ALL", status: "all" },
    generatedAt: AT,
    timeZone: "Europe/Amsterdam",
  });
  const records = parseCsv(csv);
  const s = sections(records);
  assert.deepEqual(
    s.map((x) => x.title),
    ["Filters", "Summary", "Questions", "Participants by country"],
  );
  // Sections are separated by exactly one empty record.
  const empties = records.filter((r) => r.length === 1 && r[0] === "").length;
  assert.equal(empties, 3);
  assert.deepEqual(s[0].rows, [
    ["country", "All countries"],
    ["status", "All"],
    ["content_version", V],
    ["downloaded_at (Europe/Amsterdam)", "2026-10-18 21:34"],
    ["participants", "4"],
  ]);
  assert.deepEqual(s[1].rows, [
    ["Participants", "4"],
    ["Completed", "2"],
    ["In progress", "2"],
  ]);
  assert.deepEqual(s[2].rows[0], [
    "question",
    "question_text",
    "option",
    "option_label",
    "count",
    "percent",
    "answers",
    "comments",
  ]);
  assert.deepEqual(s[3].rows[0], ["country_code", "country_name", "participants", "percent"]);
});

test("statisticsCsv: question rows match questionStats, with (open answer) and unknown option rows", () => {
  const rows = sampleRows();
  const stats = buildStatistics(rows, CONTENT);
  const s = sections(
    parseCsv(statisticsCsv(stats, { content: CONTENT, filters: { country: "ALL", status: "all" }, generatedAt: AT, timeZone: "UTC" })),
  );
  const qRows = s[2].rows.slice(1);
  const expected = [];
  for (const q of questionStats(rows, CONTENT)) {
    for (const o of q.options) {
      expected.push([`Q${q.n}`, q.text, o.letter, o.label, String(o.count), String(o.percent), String(q.answers), String(q.comments)]);
    }
    for (const u of q.unknown?.options ?? []) {
      expected.push([`Q${q.n}`, q.text, u.letter, "(unknown option)", String(u.count), String(u.percent), String(q.answers), String(q.comments)]);
    }
  }
  assert.deepEqual(qRows, expected);
  // Spot checks of the numbers on screen.
  const q1a = qRows.find((r) => r[0] === "Q1" && r[2] === "A");
  assert.deepEqual(q1a.slice(4), ["3", "75", "4", "1"]);
  const q2 = qRows.filter((r) => r[0] === "Q2");
  assert.deepEqual(q2.map((r) => [r[2], r[3], r[4], r[5]]), [
    ["A", "Tell us… (open answer)", "1", "50"],
    ["B", "Nothing really had that effect on me.", "0", "0"],
    ["X", "(unknown option)", "1", "50"],
  ]);
  const q10 = qRows.filter((r) => r[0] === "Q10");
  assert.deepEqual(q10.map((r) => r.slice(4)), [["0", "0", "0", "0"], ["0", "0", "0", "0"]]);
});

test("statisticsCsv: Participants by country last, in the byCountry order, unknown code with empty name", () => {
  const rows = sampleRows();
  const s = sections(
    parseCsv(
      statisticsCsv(buildStatistics(rows, CONTENT), {
        content: CONTENT,
        filters: { country: "ALL", status: "all" },
        generatedAt: AT,
        timeZone: "UTC",
      }),
    ),
  );
  assert.deepEqual(s[3].rows.slice(1), [
    ["NL", "Netherlands", "2", "50"],
    ["OTHER", "Other", "1", "25"],
    ["FR", "", "1", "25"],
  ]);
  const expected = byCountry(rows, CONTENT).map((c) => [c.code, String(c.count), String(c.percent)]);
  assert.deepEqual(s[3].rows.slice(1).map((r) => [r[0], r[2], r[3]]), expected);
});

test("statisticsCsv: filters shown with their labels and stats of the filtered set only", () => {
  const filters = { country: "NL", status: "in_progress" };
  const filtered = applyCommonFilters(sampleRows(), filters);
  const s = sections(
    parseCsv(statisticsCsv(buildStatistics(filtered, CONTENT), { content: CONTENT, filters, generatedAt: AT, timeZone: "UTC" })),
  );
  assert.deepEqual(s[0].rows.slice(0, 2), [
    ["country", "Netherlands"],
    ["status", "In progress"],
  ]);
  assert.deepEqual(s[0].rows[4], ["participants", "1"]);
  assert.deepEqual(s[1].rows, [
    ["Participants", "1"],
    ["Completed", "0"],
    ["In progress", "1"],
  ]);
  const other = { country: "OTHER", status: "completed" };
  const s2 = sections(
    parseCsv(statisticsCsv(buildStatistics([], CONTENT), { content: CONTENT, filters: other, generatedAt: AT, timeZone: "UTC" })),
  );
  assert.deepEqual(s2[0].rows.slice(0, 2), [
    ["country", "Other"],
    ["status", "Completed"],
  ]);
  const unknown = { country: "FR", status: "all" };
  const s3 = sections(
    parseCsv(statisticsCsv(buildStatistics([], CONTENT), { content: CONTENT, filters: unknown, generatedAt: AT, timeZone: "UTC" })),
  );
  assert.deepEqual(s3[0].rows[0], ["country", "FR"]);
});

test("statisticsCsv: empty set downloads zeros, 20 option rows and no country rows (RF-61)", () => {
  const s = sections(
    parseCsv(
      statisticsCsv(buildStatistics([], CONTENT), {
        content: CONTENT,
        filters: { country: "ALL", status: "all" },
        generatedAt: AT,
        timeZone: "UTC",
      }),
    ),
  );
  assert.deepEqual(s[1].rows, [
    ["Participants", "0"],
    ["Completed", "0"],
    ["In progress", "0"],
  ]);
  const optionRows = s[2].rows.slice(1);
  const totalOptions = CONTENT.questions.reduce((n, q) => n + q.options.length, 0);
  assert.equal(optionRows.length, totalOptions);
  assert.ok(optionRows.every((r) => r[4] === "0" && r[5] === "0" && r[6] === "0"));
  assert.deepEqual(s[3].rows, [["country_code", "country_name", "participants", "percent"]]);
});

test("statisticsCsv: text cells protected, numeric cells not; no participant id", () => {
  const evil = {
    ...CONTENT,
    questions: CONTENT.questions.map((q, i) =>
      i === 0 ? { ...q, text: "=evil()", options: q.options.map((o) => ({ ...o, label: "-" + o.label })) } : q,
    ),
  };
  const rows = sampleRows();
  const csv = statisticsCsv(buildStatistics(rows, evil), {
    content: evil,
    filters: { country: "ALL", status: "all" },
    generatedAt: AT,
    timeZone: "UTC",
  });
  const qRows = sections(parseCsv(csv))[2].rows.slice(1);
  assert.equal(qRows[0][1], "'=evil()");
  assert.ok(qRows[0][3].startsWith("'-"));
  assert.match(qRows[0][4], /^\d+$/);
  for (const r of rows) assert.ok(!csv.includes(r.id));
});
