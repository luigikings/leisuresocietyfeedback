// Statistics and common filters for /admin (spec 002: RF-22 a RF-25, RF-29 a RF-37, RF-57, RF-70).
import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTENT } from "../js/content.js";
import {
  percent,
  splitByVersion,
  hiddenVersionsNotice,
  countryChoices,
  STATUS_CHOICES,
  INITIAL_FILTERS,
  applyCommonFilters,
  summary,
  answeredCount,
  questionStats,
  byCountry,
  countryFlag,
  MULTIPLE_NOTE,
} from "../js/lib/admin-stats.js";

const V = CONTENT.version;
let seq = 0;
/** A row like the ones the panel loads; `answers` maps "q1" → ["A", "text"?]. */
function row({ version = V, country = "NL", status = "completed", answers = {} } = {}) {
  seq += 1;
  const r = { id: `id-${seq}`, content_version: version, country, status };
  for (let i = 1; i <= 10; i++) {
    const a = answers[`q${i}`];
    r[`q${i}_option`] = a ? a[0] : null;
    r[`q${i}_text`] = a && a[1] !== undefined ? a[1] : null;
  }
  return r;
}

// ---- percent: integer rounding, halves up (definición "Redondeo") ----

test("percent: 0 of 0 is 0", () => {
  assert.equal(percent(0, 0), 0);
});

test("percent: 1/3 = 33, 2/3 = 67, 1/8 = 13 (12.5 up), 5/8 = 63 (62.5 up)", () => {
  assert.equal(percent(1, 3), 33);
  assert.equal(percent(2, 3), 67);
  assert.equal(percent(1, 8), 13);
  assert.equal(percent(5, 8), 63);
  assert.equal(percent(3, 8), 38); // 37.5 up
  assert.equal(percent(1, 200), 1); // 0.5 up
  assert.equal(percent(1, 201), 0); // 0.497…
});

test("percent: 0 and all", () => {
  assert.equal(percent(0, 7), 0);
  assert.equal(percent(7, 7), 100);
});

test("percent: halves up without floating point drift for every n/d up to 400", () => {
  for (let d = 1; d <= 400; d++) {
    for (let n = 0; n <= d; n++) {
      // exact: round half up of 100n/d, computed with integers only
      const q = Math.floor((100 * n) / d);
      const rem = 100 * n - q * d; // fractional part = rem/d
      const expected = 2 * rem >= d ? q + 1 : q;
      assert.equal(percent(n, d), expected, `${n}/${d}`);
    }
  }
});

// ---- RF-22: current version only, notice counted before filters ----

test("splitByVersion keeps the current version and counts the others over all loaded rows", () => {
  const rows = [
    row(),
    row({ version: "2026-10-test-1", country: "HU" }),
    row({ status: "in_progress", country: "IT" }),
    row({ version: "old", status: "in_progress" }),
    row({ version: "old" }),
  ];
  const { current, hiddenCount } = splitByVersion(rows, V);
  assert.deepEqual(current.map((r) => r.id), [rows[0].id, rows[2].id]);
  assert.equal(hiddenCount, 3);
});

test("splitByVersion: hiddenCount does not depend on the filters (counted before them)", () => {
  const rows = [row({ version: "old", country: "HU" }), row({ version: "old", country: "IT", status: "in_progress" })];
  const { current, hiddenCount } = splitByVersion(rows, V);
  assert.equal(hiddenCount, 2);
  assert.equal(applyCommonFilters(current, { country: "NL", status: "completed" }).length, 0);
});

test("splitByVersion with no rows", () => {
  assert.deepEqual(splitByVersion([], V), { current: [], hiddenCount: 0 });
});

test("hiddenVersionsNotice: literal text of RF-22, nothing when 0", () => {
  assert.equal(hiddenVersionsNotice(0), null);
  assert.equal(hiddenVersionsNotice(3), "3 responses from other content versions are hidden.");
});

test("hiddenVersionsNotice: singular for 1", () => {
  assert.equal(hiddenVersionsNotice(1), "1 response from other content versions is hidden.");
});

// ---- RF-23: optional country filter starting at "All countries" ----

test("initial filters are unfiltered: All countries and All statuses (RF-23, RF-24)", () => {
  assert.deepEqual(INITIAL_FILTERS, { country: "ALL", status: "all" });
  assert.ok(Object.isFrozen(INITIAL_FILTERS));
});

test("countryChoices: All countries first, content countries in order, Other, unknown codes A-Z", () => {
  const current = [row({ country: "ZZ" }), row({ country: "BR" }), row({ country: "NL" }), row({ country: "BR" })];
  const choices = countryChoices(current, CONTENT);
  assert.deepEqual(choices, [
    { value: "ALL", label: "All countries" },
    ...CONTENT.countries.map((c) => ({ value: c.code, label: c.name })),
    { value: "OTHER", label: "Other" },
    { value: "BR", label: "BR" },
    { value: "ZZ", label: "ZZ" },
  ]);
});

test("countryChoices lists every content country even with no rows, and no unknown codes", () => {
  const choices = countryChoices([], CONTENT);
  assert.equal(choices.length, 1 + CONTENT.countries.length + 1);
  assert.equal(choices[0].label, "All countries");
  assert.equal(choices.at(-1).value, "OTHER");
});

test("STATUS_CHOICES: All, Completed, In progress", () => {
  assert.deepEqual(STATUS_CHOICES, [
    { value: "all", label: "All" },
    { value: "completed", label: "Completed" },
    { value: "in_progress", label: "In progress" },
  ]);
});

// ---- RF-24, RF-25: common filters ----

test("applyCommonFilters: no filters (defaults) keeps every row, in order", () => {
  const rows = [row(), row({ country: "HU", status: "in_progress" }), row({ country: "OTHER" })];
  assert.deepEqual(applyCommonFilters(rows), rows);
  assert.deepEqual(applyCommonFilters(rows, INITIAL_FILTERS), rows);
  assert.deepEqual(applyCommonFilters(rows, {}), rows);
});

test("applyCommonFilters: by country, by status and both at once", () => {
  const a = row({ country: "NL", status: "completed" });
  const b = row({ country: "NL", status: "in_progress" });
  const c = row({ country: "HU", status: "completed" });
  const d = row({ country: "OTHER", status: "in_progress" });
  const rows = [a, b, c, d];
  assert.deepEqual(applyCommonFilters(rows, { country: "NL" }), [a, b]);
  assert.deepEqual(applyCommonFilters(rows, { status: "completed" }), [a, c]);
  assert.deepEqual(applyCommonFilters(rows, { status: "in_progress" }), [b, d]);
  assert.deepEqual(applyCommonFilters(rows, { country: "NL", status: "in_progress" }), [b]);
  assert.deepEqual(applyCommonFilters(rows, { country: "OTHER", status: "all" }), [d]);
  assert.deepEqual(applyCommonFilters(rows, { country: "RO" }), []);
});

test("applyCommonFilters does not mutate its input", () => {
  const rows = [row(), row({ country: "HU" })];
  const copy = structuredClone(rows);
  applyCommonFilters(rows, { country: "HU" });
  assert.deepEqual(rows, copy);
});

// ---- RF-29: summary ----

test("summary: participants, completed and in progress", () => {
  const rows = [row(), row({ status: "in_progress" }), row(), row({ status: "in_progress" }), row()];
  assert.deepEqual(summary(rows), { participants: 5, completed: 3, inProgress: 2 });
  assert.deepEqual(summary([]), { participants: 0, completed: 0, inProgress: 0 });
});

test("answeredCount: questions with a stored option, known or not", () => {
  assert.equal(answeredCount(row()), 0);
  assert.equal(answeredCount(row({ answers: { q1: ["A"], q2: ["A", "x"], q7: ["C"] } })), 3);
  const all = {};
  for (let i = 1; i <= 10; i++) all[`q${i}`] = ["B"];
  assert.equal(answeredCount(row({ answers: all })), 10);
});

// ---- RF-31 a RF-37: question blocks ----

test("questionStats: one block per question, Q1 to Q10, with text and labels from CONTENT", () => {
  const stats = questionStats([], CONTENT);
  assert.equal(stats.length, 10);
  stats.forEach((q, i) => {
    const c = CONTENT.questions[i];
    assert.equal(q.id, c.id);
    assert.equal(q.n, i + 1);
    assert.equal(q.text, c.text);
    assert.deepEqual(
      q.options.map((o) => o.letter),
      c.options.map((o) => o.letter),
    );
  });
});

test("questionStats: no answers → n answers 0, every option at 0 count and 0 % (RF-35 data)", () => {
  const q1 = questionStats([row({ status: "in_progress" })], CONTENT)[0];
  assert.equal(q1.answers, 0);
  assert.equal(q1.comments, 0);
  assert.equal(q1.unknown, null);
  for (const o of q1.options) {
    assert.equal(o.count, 0);
    assert.equal(o.percent, 0);
  }
});

test("questionStats: partial rows count only the questions they answered (RF-24, RF-31)", () => {
  const rows = [
    row({ answers: { q1: ["A"], q2: ["B"] } }),
    row({ status: "in_progress", answers: { q1: ["B"] } }),
    row({ status: "in_progress", answers: { q1: ["A"] } }),
    row({ status: "in_progress" }),
  ];
  const [q1, q2, q3] = questionStats(rows, CONTENT);
  assert.equal(q1.answers, 3);
  assert.deepEqual(
    q1.options.map((o) => [o.letter, o.count, o.percent]),
    [
      ["A", 2, 67],
      ["B", 1, 33],
    ],
  );
  assert.equal(q2.answers, 1);
  assert.deepEqual(
    q2.options.map((o) => [o.count, o.percent]),
    [
      [0, 0],
      [1, 100],
    ],
  );
  assert.equal(q3.answers, 0);
});

test("questionStats: options with 0 are kept; three thirds sum to 99, not forced to 100 (RF-32, RF-34)", () => {
  const rows = [row({ answers: { q3: ["A"] } }), row({ answers: { q3: ["B"] } }), row({ answers: { q3: ["C"] } })];
  const q3 = questionStats(rows, CONTENT)[2];
  assert.deepEqual(
    q3.options.map((o) => o.percent),
    [33, 33, 33],
  );
  const one = questionStats([row({ answers: { q3: ["B"] } })], CONTENT)[2];
  assert.deepEqual(
    one.options.map((o) => [o.letter, o.count]),
    [
      ["A", 0],
      ["B", 1],
      ["C", 0],
    ],
  );
});

test("questionStats: labels come from CONTENT and \"(open answer)\" goes on open-required options only (RF-36)", () => {
  const stats = questionStats([], CONTENT);
  CONTENT.questions.forEach((c, i) => {
    c.options.forEach((o, j) => {
      const expected = o.type === "open-required" ? `${o.label} (open answer)` : o.label;
      assert.equal(stats[i].options[j].label, expected, `${c.id}-${o.letter}`);
    });
  });
  // Today: Q2-A and Q5-A; open-optional (Q9-B, Q10-B) without the suffix.
  assert.equal(stats[1].options[0].label, "Tell us… (open answer)");
  assert.equal(stats[4].options[0].label, "Tell us… (open answer)");
  assert.equal(stats[8].options[1].label, CONTENT.questions[8].options[1].label);
});

test("questionStats: \"(open answer)\" follows the type in the content, not the question number", () => {
  const content = {
    version: "x",
    countries: [],
    questions: [
      {
        id: "q1",
        text: "T",
        options: [
          { letter: "A", label: "Plain", type: "normal" },
          { letter: "B", label: "Say", type: "open-required" },
        ],
      },
    ],
  };
  const [q] = questionStats([], content);
  assert.deepEqual(
    q.options.map((o) => o.label),
    ["Plain", "Say (open answer)"],
  );
});

test("questionStats: an unknown option counts in answers and the denominator, never in a bar", () => {
  const rows = [
    row({ answers: { q1: ["A"] } }),
    row({ answers: { q1: ["A"] } }),
    row({ answers: { q1: ["B"] } }),
    row({ answers: { q1: ["C"] } }), // Q1 has only A and B
  ];
  const q1 = questionStats(rows, CONTENT)[0];
  assert.equal(q1.answers, 4);
  assert.deepEqual(
    q1.options.map((o) => [o.letter, o.count, o.percent]),
    [
      ["A", 2, 50],
      ["B", 1, 25],
    ],
  );
  assert.deepEqual(q1.unknown, { count: 1, percent: 25, options: [{ letter: "C", count: 1, percent: 25 }] });
});

test("questionStats: unknown options are grouped by letter, A-Z", () => {
  const content = {
    version: "x",
    countries: [],
    questions: [{ id: "q1", text: "T", options: [{ letter: "B", label: "Only B", type: "normal" }] }],
  };
  const rows = [row({ answers: { q1: ["C"] } }), row({ answers: { q1: ["A"] } }), row({ answers: { q1: ["C"] } })];
  const [q] = questionStats(rows, content);
  assert.equal(q.answers, 3);
  assert.deepEqual(q.unknown, {
    count: 3,
    percent: 100,
    options: [
      { letter: "A", count: 1, percent: 33 },
      { letter: "C", count: 2, percent: 67 },
    ],
  });
});

test("questionStats: comments count rows with text in that question, any option (RF-37)", () => {
  const rows = [
    row({ answers: { q2: ["A", "The music"], q9: ["B", "Queue"] } }),
    row({ answers: { q2: ["B", "Nothing, sorry"] } }),
    row({ answers: { q2: ["B"] } }),
    row({ answers: { q2: ["B", ""] } }), // empty text is no comment
    row({ answers: { q2: ["B", "   "] } }), // blank text is no comment
  ];
  const stats = questionStats(rows, CONTENT);
  assert.equal(stats[1].comments, 2);
  assert.equal(stats[1].answers, 5);
  assert.equal(stats[8].comments, 1);
  assert.equal(stats[0].comments, 0);
});

test("questionStats does not mutate rows or content", () => {
  const rows = [row({ answers: { q1: ["C"], q2: ["A", "x"] } })];
  const rowsCopy = structuredClone(rows);
  const contentCopy = structuredClone(CONTENT);
  questionStats(rows, CONTENT);
  assert.deepEqual(rows, rowsCopy);
  assert.deepEqual(CONTENT, contentCopy);
});

// ---- T11: Q3 multiple choice, counted per participant (RF-32, RF-34, RF-71, RF-72, RF-76) ----

test("questionStats Q3: \"A\", \"AC\", \"ABC\" and one unanswered → 3 answers; A 3/100, B 1/33, C 2/67 (RF-71)", () => {
  const rows = [
    row({ answers: { q3: ["A"] } }),
    row({ answers: { q3: ["AC", "nice"] } }),
    row({ answers: { q3: ["ABC"] } }),
    row({ status: "in_progress" }),
  ];
  const q3 = questionStats(rows, CONTENT)[2];
  assert.equal(q3.answers, 3, "one per participant, not per marked option");
  assert.deepEqual(
    q3.options.map((o) => [o.letter, o.label, o.count, o.percent]),
    [
      ["A", "The theme", 3, 100],
      ["B", "The people", 1, 33],
      ["C", "A message", 2, 67],
    ],
  );
  assert.equal(q3.unknown, null);
  assert.equal(q3.comments, 1);
  // Percentages add up to more than 100 and are not forced down (RF-34, RF-72).
  assert.equal(
    q3.options.reduce((s, o) => s + o.percent, 0),
    200,
  );
});

test("questionStats Q3: repeated letters in a stored value count once (propuesta 37)", () => {
  const q3 = questionStats([row({ answers: { q3: ["AAC"] } })], CONTENT)[2];
  assert.equal(q3.answers, 1);
  assert.deepEqual(
    q3.options.map((o) => o.count),
    [1, 0, 1],
  );
});

test("questionStats Q3: old rows with a single letter count as that option", () => {
  const q3 = questionStats([row({ answers: { q3: ["B"] } }), row({ answers: { q3: ["B"] } })], CONTENT)[2];
  assert.equal(q3.answers, 2);
  assert.deepEqual(
    q3.options.map((o) => [o.count, o.percent]),
    [
      [0, 0],
      [2, 100],
      [0, 0],
    ],
  );
});

test("questionStats: MULTIPLE_NOTE only on the multiple-choice question, also with 0 answers (RF-72)", () => {
  assert.equal(MULTIPLE_NOTE, "Multiple choice – percentages can add up to more than 100%");
  const empty = questionStats([], CONTENT);
  empty.forEach((q) => {
    const multi = q.id === "q3";
    assert.equal(q.multiple, multi, q.id);
    assert.equal(q.note, multi ? MULTIPLE_NOTE : null, q.id);
  });
  assert.equal(empty[2].answers, 0);
  const some = questionStats([row({ answers: { q3: ["AB"], q1: ["A"] } })], CONTENT);
  assert.equal(some[2].note, MULTIPLE_NOTE);
  assert.equal(some[0].note, null);
});

test("questionStats Q3: unknown letters inside a value; unknown.count counts rows, not letters (RF-76)", () => {
  const one = questionStats([row({ answers: { q3: ["AD"] } }), row({ answers: { q3: ["C"] } })], CONTENT)[2];
  assert.equal(one.answers, 2);
  assert.deepEqual(
    one.options.map((o) => o.count),
    [1, 0, 1],
  );
  assert.deepEqual(one.unknown, { count: 1, percent: 50, options: [{ letter: "D", count: 1, percent: 50 }] });

  const rows = [
    row({ answers: { q3: ["AD"] } }),
    row({ answers: { q3: ["AD"] } }),
    row({ answers: { q3: ["DE"] } }), // two unknown letters, still one row
    row({ answers: { q3: ["B"] } }),
  ];
  const q3 = questionStats(rows, CONTENT)[2];
  assert.equal(q3.answers, 4);
  assert.deepEqual(
    q3.options.map((o) => [o.count, o.percent]),
    [
      [2, 50],
      [1, 25],
      [0, 0],
    ],
  );
  assert.deepEqual(q3.unknown, {
    count: 3,
    percent: 75,
    options: [
      { letter: "D", count: 3, percent: 75 },
      { letter: "E", count: 1, percent: 25 },
    ],
  });
});

test("questionStats: \"AC\" stored in a single-choice question is one whole unknown option", () => {
  const rows = [row({ answers: { q1: ["AC"] } }), row({ answers: { q1: ["A"] } })];
  const q1 = questionStats(rows, CONTENT)[0];
  assert.equal(q1.answers, 2);
  assert.equal(q1.multiple, false);
  assert.deepEqual(
    q1.options.map((o) => [o.letter, o.count, o.percent]),
    [
      ["A", 1, 50],
      ["B", 0, 0],
    ],
  );
  assert.deepEqual(q1.unknown, { count: 1, percent: 50, options: [{ letter: "AC", count: 1, percent: 50 }] });
});

// ---- RF-30: participants by country, last in Statistics (RF-70) ----

test("countryFlag: content flag, Other icon, none for unknown codes (site-relative paths)", () => {
  assert.equal(countryFlag("NL", CONTENT), "assets/flags/nl.svg");
  assert.equal(countryFlag("OTHER", CONTENT), "assets/icons/other.svg");
  assert.equal(countryFlag("BR", CONTENT), null);
});

test("byCountry: only countries with rows, count and % over the filtered set", () => {
  const rows = [row({ country: "HU" }), row({ country: "HU" }), row({ country: "NL" })];
  assert.deepEqual(byCountry(rows, CONTENT), [
    { code: "HU", name: "Hungary", flag: "assets/flags/hu.svg", count: 2, percent: 67 },
    { code: "NL", name: "Netherlands", flag: "assets/flags/nl.svg", count: 1, percent: 33 },
  ]);
  assert.deepEqual(byCountry([], CONTENT), []);
});

test("byCountry: most rows first; ties → content order, then Other, then unknown codes A-Z", () => {
  const codes = ["ZZ", "OTHER", "RO", "BR", "NL", "HU", "HU", "HU", "IT", "IT", "IT"];
  const rows = codes.map((country) => row({ country }));
  const out = byCountry(rows, CONTENT);
  assert.deepEqual(
    out.map((c) => [c.code, c.count]),
    [
      ["HU", 3],
      ["IT", 3],
      ["NL", 1],
      ["RO", 1],
      ["OTHER", 1],
      ["BR", 1],
      ["ZZ", 1],
    ],
  );
  const other = out.find((c) => c.code === "OTHER");
  assert.deepEqual(other, { code: "OTHER", name: "Other", flag: "assets/icons/other.svg", count: 1, percent: 9 });
  const unknown = out.find((c) => c.code === "BR");
  assert.deepEqual(unknown, { code: "BR", name: "BR", flag: null, count: 1, percent: 9 });
});

test("byCountry: percentages are rounded and not forced to sum 100", () => {
  const rows = ["NL", "HU", "IT"].map((country) => row({ country }));
  assert.deepEqual(
    byCountry(rows, CONTENT).map((c) => c.percent),
    [33, 33, 33],
  );
});

// ---- Whole flow: version → filters → stats (what screen and CSV share, RF-57) ----

test("pipeline: other versions hidden, filters applied to every number", () => {
  const rows = [
    row({ country: "NL", answers: { q1: ["A"] } }),
    row({ country: "NL", status: "in_progress", answers: { q1: ["B"] } }),
    row({ country: "HU", answers: { q1: ["B"] } }),
    row({ version: "old", country: "NL", answers: { q1: ["A"] } }),
  ];
  const { current, hiddenCount } = splitByVersion(rows, V);
  assert.equal(hiddenCount, 1);
  const filtered = applyCommonFilters(current, { country: "NL", status: "all" });
  assert.deepEqual(summary(filtered), { participants: 2, completed: 1, inProgress: 1 });
  const q1 = questionStats(filtered, CONTENT)[0];
  assert.deepEqual(
    q1.options.map((o) => [o.count, o.percent]),
    [
      [1, 50],
      [1, 50],
    ],
  );
  assert.deepEqual(
    byCountry(filtered, CONTENT).map((c) => [c.code, c.count, c.percent]),
    [["NL", 2, 100]],
  );
  // Same inputs, same outputs: deterministic for screen and CSV.
  assert.deepEqual(questionStats(filtered, CONTENT), questionStats(filtered, CONTENT));
});

// T8: after "Refresh" the selected unknown code may have no rows left; the filter keeps it (RF-20, RF-23).
test("countryChoices keeps a selected unknown code that is no longer in the rows, among the unknown A-Z", () => {
  const current = [row({ country: "ZZ" })];
  const choices = countryChoices(current, CONTENT, "BR");
  assert.deepEqual(choices.slice(-3), [
    { value: "OTHER", label: "Other" },
    { value: "BR", label: "BR" },
    { value: "ZZ", label: "ZZ" },
  ]);
});

test("countryChoices: a selected value already listed (ALL, content, Other, present code) adds nothing", () => {
  const current = [row({ country: "ZZ" })];
  const base = countryChoices(current, CONTENT);
  for (const selected of ["ALL", "NL", "OTHER", "ZZ", undefined]) {
    assert.deepEqual(countryChoices(current, CONTENT, selected), base);
  }
});
