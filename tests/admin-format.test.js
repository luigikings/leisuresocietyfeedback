// Dates and file names for /admin (spec 002: RF-19, RF-40, RF-58, propuesta 17).
// The time zone is always a parameter: these tests never depend on the machine's zone or the current date.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDisplay, formatHHMM, formatCsvDate, fileStamp, fileName } from "../js/lib/admin-format.js";

const AMS = "Europe/Amsterdam";

// ---- formatDisplay: en-GB "18 Oct 2026, 21:34" (RF-40) ----

test("formatDisplay in UTC", () => {
  assert.equal(formatDisplay("2026-10-18T21:34:56.789+00:00", "UTC"), "18 Oct 2026, 21:34");
});

test("formatDisplay in Europe/Amsterdam before and after the 25/10/2026 clock change", () => {
  assert.equal(formatDisplay("2026-10-18T19:34:00Z", AMS), "18 Oct 2026, 21:34"); // CEST, +2
  assert.equal(formatDisplay("2026-10-25T00:30:00Z", AMS), "25 Oct 2026, 02:30"); // still CEST
  assert.equal(formatDisplay("2026-10-25T01:30:00Z", AMS), "25 Oct 2026, 02:30"); // already CET
  assert.equal(formatDisplay("2026-10-28T20:34:00Z", AMS), "28 Oct 2026, 21:34"); // CET, +1
});

test("formatDisplay pads the time and uses 24 h around midnight", () => {
  assert.equal(formatDisplay("2026-10-01T00:05:00Z", "UTC"), "1 Oct 2026, 00:05");
  assert.equal(formatDisplay("2026-10-18T22:30:00Z", AMS), "19 Oct 2026, 00:30"); // day changes locally
});

test("formatDisplay accepts a Date", () => {
  assert.equal(formatDisplay(new Date("2026-10-18T21:34:00Z"), "UTC"), "18 Oct 2026, 21:34");
});

test("formatDisplay: missing or invalid date is a dash", () => {
  assert.equal(formatDisplay(null, "UTC"), "—");
  assert.equal(formatDisplay("not a date", "UTC"), "—");
});

// ---- formatHHMM: "Last updated HH:MM" (RF-19) ----

test("formatHHMM: 24 h, zero-padded", () => {
  assert.equal(formatHHMM(new Date("2026-10-18T09:05:00Z"), "UTC"), "09:05");
  assert.equal(formatHHMM(new Date("2026-10-18T23:59:59Z"), "UTC"), "23:59");
  assert.equal(formatHHMM(new Date("2026-10-18T22:00:00Z"), AMS), "00:00");
  assert.equal(formatHHMM(new Date("2026-10-25T00:30:00Z"), AMS), "02:30");
  assert.equal(formatHHMM(new Date("2026-10-25T01:30:00Z"), AMS), "02:30");
  assert.equal(formatHHMM(new Date("2026-10-25T02:30:00Z"), AMS), "03:30");
});

// ---- formatCsvDate: "AAAA-MM-DD HH:MM" (propuesta 17) ----

test("formatCsvDate in UTC and Europe/Amsterdam", () => {
  assert.equal(formatCsvDate("2026-10-18T21:34:00+00:00", "UTC"), "2026-10-18 21:34");
  assert.equal(formatCsvDate("2026-10-18T19:34:00Z", AMS), "2026-10-18 21:34");
  assert.equal(formatCsvDate("2026-10-25T00:30:00Z", AMS), "2026-10-25 02:30");
  assert.equal(formatCsvDate("2026-10-25T01:30:00Z", AMS), "2026-10-25 02:30");
  assert.equal(formatCsvDate("2026-01-02T03:04:00Z", "UTC"), "2026-01-02 03:04");
  assert.equal(formatCsvDate("2026-12-31T23:30:00Z", AMS), "2027-01-01 00:30");
});

test("formatCsvDate: missing or invalid date is empty", () => {
  assert.equal(formatCsvDate(null, "UTC"), "");
  assert.equal(formatCsvDate("nope", "UTC"), "");
});

// ---- file names (RF-58) ----

test("fileStamp: AAAA-MM-DD-HHMM in the given zone", () => {
  assert.equal(fileStamp(new Date("2026-10-18T19:34:00Z"), AMS), "2026-10-18-2134");
  assert.equal(fileStamp(new Date("2026-10-18T19:34:00Z"), "UTC"), "2026-10-18-1934");
  assert.equal(fileStamp(new Date("2026-10-25T01:30:00Z"), AMS), "2026-10-25-0230");
});

test("fileName for both downloads", () => {
  const d = new Date("2026-10-28T20:05:00Z");
  assert.equal(fileName("responses", d, AMS), "leisure-city-responses-2026-10-28-2105.csv");
  assert.equal(fileName("statistics", d, AMS), "leisure-city-statistics-2026-10-28-2105.csv");
});

test("fileName rejects an unknown kind", () => {
  assert.throws(() => fileName("other", new Date("2026-10-28T20:05:00Z"), "UTC"));
});

// T8: counters of the panel ("N participants", "N answers", "N comments") and asset paths from /admin/.
import { countText, fromAdminPage } from "../js/lib/admin-format.js";

test("countText: plural except for exactly 1", () => {
  assert.equal(countText(0, "participant"), "0 participants");
  assert.equal(countText(1, "participant"), "1 participant");
  assert.equal(countText(2, "answer"), "2 answers");
  assert.equal(countText(1000, "comment"), "1000 comments");
  assert.equal(countText(1, "answer with an unknown option", "answers with an unknown option"), "1 answer with an unknown option");
  assert.equal(countText(3, "answer with an unknown option", "answers with an unknown option"), "3 answers with an unknown option");
});

test("fromAdminPage: site-relative asset paths seen from /admin/ (one level down)", () => {
  assert.equal(fromAdminPage("assets/flags/nl.svg"), "../assets/flags/nl.svg");
  assert.equal(fromAdminPage("assets/icons/other.svg"), "../assets/icons/other.svg");
  assert.equal(fromAdminPage(null), null);
  assert.equal(fromAdminPage(undefined), null);
  assert.equal(fromAdminPage(""), null);
});

test("formatters are reused per time zone without mixing zones (T9, RNF-8)", () => {
  const iso = "2026-10-18T19:34:00Z";
  for (let i = 0; i < 3; i++) {
    assert.equal(formatDisplay(iso, "UTC"), "18 Oct 2026, 19:34");
    assert.equal(formatDisplay(iso, "Europe/Amsterdam"), "18 Oct 2026, 21:34");
    assert.equal(formatCsvDate(iso, "Asia/Tokyo"), "2026-10-19 04:34");
    assert.equal(formatCsvDate(iso, "UTC"), "2026-10-18 19:34");
  }
});
