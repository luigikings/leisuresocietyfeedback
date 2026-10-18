// Dates and download file names for /admin (spec 002: RF-19, RF-40, RF-58, propuesta 17).
// Pure module: the date and the time zone are always parameters (the app passes
// Intl.DateTimeFormat().resolvedOptions().timeZone), never read from the machine.

const FILE_KINDS = new Set(["responses", "statistics"]);

function toDate(value) {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Building an Intl.DateTimeFormat is slow (≈ 0.1 ms): the list formats 2 dates per row, so one formatter per
// kind and time zone is kept (RNF-8). Same output, the zone is still always a parameter.
const formatters = new Map();
function formatter(kind, timeZone, options) {
  const key = `${kind}|${timeZone}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-GB", { timeZone, ...options });
    formatters.set(key, fmt);
  }
  return fmt;
}

const NUMERIC = { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
const DISPLAY = { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" };

/** Local parts { year, month, day, hour, minute } as zero-padded strings, independent of any locale. */
function numericParts(date, timeZone) {
  const p = {};
  for (const { type, value } of formatter("numeric", timeZone, NUMERIC).formatToParts(date)) p[type] = value;
  return p;
}

/** On screen: "18 Oct 2026, 21:34" (en-GB, 24 h) in the given zone; "—" without a valid date (RF-40). */
export function formatDisplay(value, timeZone) {
  const date = toDate(value);
  if (!date) return "—";
  const p = {};
  for (const { type, value: v } of formatter("display", timeZone, DISPLAY).formatToParts(date)) p[type] = v;
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
}

/** "HH:MM" (24 h) for "Last updated HH:MM" (RF-19). */
export function formatHHMM(date, timeZone) {
  const p = numericParts(date, timeZone);
  return `${p.hour}:${p.minute}`;
}

/** In the CSV files: "AAAA-MM-DD HH:MM" in the given zone, "" without a valid date (propuesta 17). */
export function formatCsvDate(value, timeZone) {
  const date = toDate(value);
  if (!date) return "";
  const p = numericParts(date, timeZone);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** "AAAA-MM-DD-HHMM" of the download moment in the given zone (RF-58). */
export function fileStamp(date, timeZone) {
  const p = numericParts(date, timeZone);
  return `${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}`;
}

/** "leisure-city-responses-…csv" or "leisure-city-statistics-…csv" (RF-58). */
export function fileName(kind, date, timeZone) {
  if (!FILE_KINDS.has(kind)) throw new Error(`Unknown download kind: ${kind}`);
  return `leisure-city-${kind}-${fileStamp(date, timeZone)}.csv`;
}

/** "1 participant", "0 participants", "3 answers"…: plural except for exactly 1 (RF-25, RF-31, RF-37). */
export function countText(n, singular, plural = `${singular}s`) {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * Site-relative asset paths (as in js/lib: "assets/flags/nl.svg") seen from the /admin/ page, one level
 * down: "../assets/flags/nl.svg". null when there is no image (unknown country code).
 */
export function fromAdminPage(sitePath) {
  return typeof sitePath === "string" && sitePath !== "" ? `../${sitePath}` : null;
}
