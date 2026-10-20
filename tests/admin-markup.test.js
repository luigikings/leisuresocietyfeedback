// Static checks of admin/index.html, css/admin.css and the /admin adapters, read as text (spec 002, plan §6).
// T7: page, CSP, fail-safe login form and session (RF-1 to RF-3, RF-14, RF-15, RF-65, RF-66, RNF-15, RNF-16).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MESSAGES } from "../js/lib/admin-auth.js";
import { SUPABASE_URL } from "../js/config.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

const HTML = read("admin/index.html");
const HTML_NO_COMMENTS = HTML.replace(/<!--[\s\S]*?-->/g, "");
const CSS = read("css/admin.css").replace(/\/\*[\s\S]*?\*\//g, "");
const CLIENT_JS = read("js/app/admin/client.js");
const AUTH_JS = read("js/app/admin/auth.js");
const MAIN_JS = read("js/app/admin/main.js");

/** Attributes of the first tag matching `re` as a map (attribute without value = ""). */
function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([a-zA-Z-:]+)(?:\s*=\s*"([^"]*)")?/g)) out[m[1].toLowerCase()] = m[2] ?? "";
  return out;
}
const tags = (name) => [...HTML_NO_COMMENTS.matchAll(new RegExp(`<${name}\\b([^>]*)>`, "gi"))].map((m) => attrs(m[1]));

function csp() {
  const meta = tags("meta").find((a) => (a["http-equiv"] ?? "").toLowerCase() === "content-security-policy");
  assert.ok(meta, "CSP meta present");
  const map = {};
  for (const part of meta.content.split(";").map((p) => p.trim()).filter(Boolean)) {
    const [name, ...values] = part.split(/\s+/);
    map[name] = values;
  }
  return map;
}

test("admin page asks robots not to index or follow it (RF-2)", () => {
  const robots = tags("meta").find((a) => a.name === "robots");
  assert.ok(robots);
  assert.deepEqual(robots.content.split(",").map((s) => s.trim()).sort(), ["nofollow", "noindex"]);
});

test("admin page declares the content policy of RNF-15", () => {
  const p = csp();
  assert.deepEqual(p["default-src"], ["'self'"]);
  assert.deepEqual(p["script-src"], ["'self'", "https://cdn.jsdelivr.net"]);
  assert.deepEqual(p["connect-src"], [SUPABASE_URL.replace(/\/$/, "")]);
  assert.deepEqual(p["connect-src"], ["https://xbsrdugimqpgxmlwbpxo.supabase.co"]);
  assert.deepEqual(p["style-src"], ["'self'"]);
  assert.deepEqual(p["object-src"], ["'none'"]);
  assert.deepEqual(p["base-uri"], ["'none'"]);
  assert.deepEqual(p["form-action"], ["'none'"]);
  for (const values of Object.values(p)) {
    assert.ok(!values.includes("'unsafe-inline'") && !values.includes("'unsafe-eval'") && !values.includes("*"));
  }
  // The CSP meta comes before anything it has to govern
  const at = HTML.search(/http-equiv="Content-Security-Policy"/i);
  assert.ok(at < HTML.search(/<link rel="stylesheet"/) && at < HTML.search(/<script/));
});

test("no inline script, style or event handler (they would break the CSP)", () => {
  for (const s of tags("script")) assert.ok(s.src, "every <script> has a src");
  assert.equal(/<script\b[^>]*>\s*\S/i.test(HTML_NO_COMMENTS.replace(/<script\b[^>]*src=[^>]*>\s*<\/script>/gi, "")), false);
  assert.equal(/<style\b/i.test(HTML_NO_COMMENTS), false);
  assert.equal(/\sstyle\s*=/i.test(HTML_NO_COMMENTS), false);
  assert.equal(/\son[a-z]+\s*=/i.test(HTML_NO_COMMENTS), false);
  assert.equal(/javascript:/i.test(HTML_NO_COMMENTS), false);
});

test("admin page uses relative paths only (local and under /leisuresocietyfeedback/, RF-1)", () => {
  const css = tags("link").find((a) => a.rel === "stylesheet");
  assert.equal(css.href, "../css/admin.css");
  const scripts = tags("script");
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].type, "module");
  assert.equal(scripts[0].src, "../js/app/admin/main.js");
  for (const a of [...tags("link"), ...tags("script"), ...tags("img"), ...tags("a")]) {
    for (const url of [a.href, a.src].filter((u) => u !== undefined)) {
      assert.ok(!url.startsWith("/") && !/^https?:/i.test(url), `relative URL: ${url}`);
    }
  }
});

test("login form: fields for password managers, never sent natively (RF-3, RF-65)", () => {
  const form = tags("form");
  assert.equal(form.length, 1);
  assert.equal(form[0].id, "login");
  assert.equal("action" in form[0], false, "no action");
  assert.equal("method" in form[0], false, "no method");
  assert.ok("novalidate" in form[0]);

  // the login form's own inputs (T9 adds "Search comments" in the panel, also without name)
  const loginForm = HTML_NO_COMMENTS.match(/<form\b[\s\S]*?<\/form>/)[0];
  const inputs = [...loginForm.matchAll(/<input\b([^>]*)>/gi)].map((m) => attrs(m[1]));
  assert.equal(inputs.length, 2);
  for (const i of inputs) assert.equal("name" in i, false, `input #${i.id} has no name`);
  const user = inputs.find((i) => i.id === "username");
  const pass = inputs.find((i) => i.id === "password");
  assert.equal(user.autocomplete, "username");
  assert.equal(pass.autocomplete, "current-password");
  assert.equal(pass.type, "password");
  for (const id of ["username", "password"]) {
    assert.ok(tags("label").some((l) => l.for === id), `label for #${id}`);
  }
  assert.match(HTML, /<label[^>]*for="username"[^>]*>Username<\/label>/);
  assert.match(HTML, /<label[^>]*for="password"[^>]*>Password<\/label>/);
});

test("'Log in' starts disabled until the page code is ready (RF-66)", () => {
  const buttons = tags("button").filter((b) => b.type === "submit");
  assert.equal(buttons.length, 1);
  assert.ok("disabled" in buttons[0]);
  assert.match(HTML, /<button[^>]*type="submit"[^>]*>Log in<\/button>/);
  assert.match(MAIN_JS, /setBusy\(false\);\s*resume\(\{ onStart: true \}\);\s*$/, "enabled as the last start step");
});

test("the 'couldn't load' message is in the page, shown by CSS after 8 s and in <noscript> (RF-66)", () => {
  const boot = HTML_NO_COMMENTS.match(/<p\b[^>]*id="boot-fail"[^>]*>([^<]*)<\/p>/);
  assert.ok(boot, "#boot-fail present");
  assert.equal(boot[1].trim(), MESSAGES.page_failed);
  assert.match(HTML_NO_COMMENTS, new RegExp(`<noscript>[\\s\\S]*${MESSAGES.page_failed.replace(/[.']/g, "\\$&")}[\\s\\S]*</noscript>`));
  const rule = CSS.match(/\.boot-fail\s*\{([^}]*)\}/);
  assert.ok(rule);
  assert.match(rule[1], /visibility:\s*hidden/);
  assert.match(rule[1], /animation:[^;]*\b8s\b[^;]*forwards/);
  assert.match(CSS, /@keyframes\s+boot-fail-show\s*\{[^}]*to\s*\{\s*visibility:\s*visible;?\s*\}/);
  assert.match(MAIN_JS, /boot-fail/, "main.js removes it on start");
});

test("panel header has 'Log out' and the panel starts hidden (RF-3, RF-14)", () => {
  assert.match(HTML_NO_COMMENTS, /<section\b[^>]*id="panel"[^>]*\bhidden\b/);
  assert.match(HTML_NO_COMMENTS, /<header\b[\s\S]*<button[^>]*id="logout"[^>]*>Log out<\/button>[\s\S]*<\/header>/);
  assert.match(HTML_NO_COMMENTS, /<button[^>]*id="retry"[^>]*>Try again<\/button>/);
  assert.match(CSS, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/);
});

test("messages are announced when they appear (RNF-7)", () => {
  assert.match(HTML_NO_COMMENTS, /id="login-message"[^>]*role="alert"|role="alert"[^>]*id="login-message"/);
  assert.match(HTML_NO_COMMENTS, /id="panel-message"[^>]*role="alert"|role="alert"[^>]*id="panel-message"/);
});

test("admin.css: own fonts with font-display optional, focus visible, no infinite animation (RNF-5, RNF-7)", () => {
  const faces = CSS.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  assert.equal(faces.length, 4);
  for (const f of faces) {
    assert.match(f, /font-display:\s*optional/);
    assert.match(f, /url\("\.\.\/assets\/fonts\/[a-z0-9-]+\.woff2"\)/);
  }
  assert.match(CSS, /:focus-visible\s*\{[^}]*outline/);
  assert.equal(/infinite/.test(CSS), false);
});

test("client: same supabase-js version and CDN as the survey, 15 s per request, own storage key (RNF-16)", () => {
  assert.match(CLIENT_JS, /import \{ SUPABASE_JS_VERSION \} from "\.\.\/db\.js"/);
  assert.match(CLIENT_JS, /https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@\$\{SUPABASE_JS_VERSION\}\/\+esm/);
  assert.match(CLIENT_JS, /AbortSignal\.timeout\(TIMEOUT_MS\)/);
  assert.match(CLIENT_JS, /const TIMEOUT_MS = 15000;/);
  assert.match(CLIENT_JS, /storageKey: STORAGE_KEY/);
  assert.match(CLIENT_JS, /export const STORAGE_KEY = "leisure-city-admin-auth";/);
  assert.match(CLIENT_JS, /persistSession: true/);
  assert.match(CLIENT_JS, /detectSessionInUrl: false/);
});

test("'Log out' only signs out this browser, never every session of the account (RF-15)", () => {
  assert.match(AUTH_JS, /signOut\(\{ scope: "local" \}\)/);
  assert.equal(/signOut\(\s*\)/.test(AUTH_JS + MAIN_JS + CLIENT_JS), false);
  assert.match(AUTH_JS, /rpc\("is_admin"\)/);
});

test("the survey never links to the admin page (RF-1)", () => {
  const survey = [read("index.html"), ...fs.readdirSync(path.join(ROOT, "js/app")).filter((f) => f.endsWith(".js")).map((f) => read(`js/app/${f}`))];
  for (const text of survey) assert.equal(/admin/i.test(text), false);
});

// --- T8: load, "Refresh", filters, tabs and statistics (RF-17 to RF-38, RF-54, RF-56, RF-70, RNF-4) ---------
const read_ = (file) => (fs.existsSync(path.join(ROOT, file)) ? read(file) : "");
const DATA_JS = read_("js/app/admin/data.js");
const STATS_JS = read_("js/app/admin/stats-view.js");
const DOWNLOAD_JS = read_("js/app/admin/download.js");

test("header: 'Last updated' and 'Refresh' next to 'Log out' (RF-19, RF-20)", () => {
  assert.match(HTML_NO_COMMENTS, /<header\b[\s\S]*id="last-updated"[\s\S]*<button[^>]*id="refresh"[^>]*>Refresh<\/button>[\s\S]*<\/header>/);
  assert.match(MAIN_JS, /Last updated /);
});

test("'Loading responses…' is announced while loading (RF-18)", () => {
  assert.match(HTML_NO_COMMENTS, /<p\b[^>]*id="loading"[^>]*role="status"[^>]*>Loading responses…<\/p>/);
});

test("filters 'Country' and 'Status' with labels, and 'N participants' (RF-23 to RF-25)", () => {
  assert.match(HTML_NO_COMMENTS, /<label[^>]*for="filter-country"[^>]*>Country<\/label>\s*<select[^>]*id="filter-country"/);
  assert.match(HTML_NO_COMMENTS, /<label[^>]*for="filter-status"[^>]*>Status<\/label>\s*<select[^>]*id="filter-status"/);
  assert.match(HTML_NO_COMMENTS, /id="participants-count"/);
  assert.match(HTML_NO_COMMENTS, /id="hidden-versions"/);
  // the notice of other versions goes above the filters (RF-22)
  assert.ok(HTML_NO_COMMENTS.indexOf('id="hidden-versions"') < HTML_NO_COMMENTS.indexOf('id="filter-country"'));
});

test("tabs 'Statistics' (selected first) and 'Responses' as ARIA tabs (RF-26, RNF-7)", () => {
  assert.match(HTML_NO_COMMENTS, /role="tablist"/);
  const tabs = tags("button").filter((b) => b.role === "tab");
  assert.deepEqual(tabs.map((t) => t.id), ["tab-statistics", "tab-responses"]);
  assert.equal(tabs[0]["aria-selected"], "true");
  assert.equal(tabs[1]["aria-selected"], "false");
  assert.equal(tabs[0]["aria-controls"], "panel-statistics");
  assert.equal(tabs[1]["aria-controls"], "panel-responses");
  assert.match(HTML_NO_COMMENTS, /<button[^>]*id="tab-statistics"[^>]*>Statistics<\/button>/);
  assert.match(HTML_NO_COMMENTS, /<button[^>]*id="tab-responses"[^>]*>Responses<\/button>/);
  assert.match(HTML_NO_COMMENTS, /<section\b[^>]*id="panel-statistics"[^>]*role="tabpanel"/);
  assert.match(HTML_NO_COMMENTS, /<section\b[^>]*id="panel-responses"[^>]*role="tabpanel"[^>]*hidden/);
});

test("'Download statistics' sits in the Statistics tab (RF-54)", () => {
  const panel = HTML_NO_COMMENTS.match(/<section\b[^>]*id="panel-statistics"[\s\S]*?<\/section>/)[0];
  assert.match(panel, /<button[^>]*id="download-statistics"[^>]*>Download statistics<\/button>/);
});

test("data.js: keyset pages by id, only the needed columns (never seq), errors classified (RF-17, RF-21)", () => {
  assert.match(DATA_JS, /from\("responses"\)/);
  assert.match(DATA_JS, /\.order\("id", \{ ascending: true \}\)/);
  assert.match(DATA_JS, /\.gt\("id", lastId\)/);
  assert.match(DATA_JS, /\.limit\(size\)/);
  assert.match(DATA_JS, /classifyLoadResult/);
  // supabase-js 2.117 retries failed GETs by itself (up to 3 times with backoff): RF-21 forbids it
  assert.match(DATA_JS, /\.retry\(false\)/);
  assert.match(DATA_JS, /loadAllRows/);
  assert.equal(/\bseq\b/.test(DATA_JS.replace(/\/\/.*$/gm, "")), false);
  assert.equal(/\.(insert|update|upsert|delete)\(/.test(DATA_JS), false, "read only (RF-51)");
});

test("stats-view.js paints user and content text as text, never as HTML (RF-47)", () => {
  assert.ok(STATS_JS.length > 0);
  assert.equal(/innerHTML|outerHTML|insertAdjacentHTML/.test(STATS_JS), false);
  assert.match(STATS_JS, /fromAdminPage/, "flags seen from /admin/ need ../");
  assert.match(STATS_JS, /Participants by country/);
  assert.match(STATS_JS, /No answers yet/);
  assert.match(STATS_JS, /See comments/);
});

test("download.js builds the file in the browser, no request (RF-62)", () => {
  assert.match(DOWNLOAD_JS, /new Blob\(/);
  assert.match(DOWNLOAD_JS, /text\/csv;charset=utf-8/);
  assert.match(DOWNLOAD_JS, /revokeObjectURL/);
  assert.equal(/fetch\(/.test(DOWNLOAD_JS), false);
});

test("admin.css: statistics blocks at most 760 px wide; bars are styled (RNF-4)", () => {
  assert.match(CSS, /max-width:\s*760px/);
  assert.match(CSS, /\.bar__fill\s*\{/);
});

// --- T9: "Responses" list and "Download responses" (RF-39 to RF-48, RF-54, RF-55, RF-61 to RF-64, RNF-4) --
const LIST_JS = read_("js/app/admin/list-view.js");
const RESPONSES_PANEL = (HTML_NO_COMMENTS.match(/<section\b[^>]*id="panel-responses"[\s\S]*?<\/section>/) ?? [""])[0];

test("'Responses' tab: Download responses, Search comments, Comments, order and 'Showing' (RF-43 to RF-45, RF-54)", () => {
  assert.match(RESPONSES_PANEL, /<button[^>]*id="download-responses"[^>]*>Download responses<\/button>/);
  assert.match(RESPONSES_PANEL, /<label[^>]*for="list-search"[^>]*>Search comments<\/label>\s*<input[^>]*id="list-search"/);
  assert.match(RESPONSES_PANEL, /<input[^>]*id="list-search"[^>]*type="search"|<input[^>]*type="search"[^>]*id="list-search"/);
  assert.match(RESPONSES_PANEL, /<label[^>]*for="list-comments"[^>]*>Comments<\/label>\s*<select[^>]*id="list-comments"/);
  assert.match(RESPONSES_PANEL, /<label[^>]*for="list-order"[^>]*>Order<\/label>\s*<select[^>]*id="list-order"/);
  assert.match(RESPONSES_PANEL, /id="list-count"/);
  assert.match(RESPONSES_PANEL, /<button[^>]*id="clear-filters"[^>]*hidden[^>]*>Clear filters<\/button>/);
  assert.match(RESPONSES_PANEL, /id="responses"/);
  // the inputs of the panel have no name either (nothing to submit)
  for (const i of tags("input")) assert.equal("name" in i, false);
});

test("list-view.js: table from 768 px, <details> cards below, text only, no id (RF-42, RF-47, RF-48, RF-63)", () => {
  assert.ok(LIST_JS.length > 0);
  assert.match(LIST_JS, /matchMedia\("\(min-width: 768px\)"\)/);
  assert.match(LIST_JS, /createElement\("details"\)|h\("details"/);
  assert.match(LIST_JS, /createElement\("table"\)|h\("table"/);
  for (const col of ["Started", "Updated", "Country", "Status", "Answered"]) assert.match(LIST_JS, new RegExp(`"${col}"`));
  assert.equal(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(LIST_JS), false);
  assert.equal(/\.id\b/.test(LIST_JS.replace(/\/\/.*$/gm, "").replace(/\b(row|entry\.row)\.id\b/g, "")), false, "the row id is only a key");
  assert.equal(/textContent\s*=|h\(/.test(LIST_JS), true);
});

test("main.js: open cards remembered in a Set, 'Download responses' from visibleEntries (RF-55, RF-61, RF-64)", () => {
  assert.match(MAIN_JS, /new Set\(\)/);
  assert.match(MAIN_JS, /responsesCsv\(/);
  assert.match(MAIN_JS, /visibleEntries\(/);
  assert.match(MAIN_JS, /fileName\("responses"/);
  assert.match(MAIN_JS, /downloadResponses\.disabled\s*=/);
});

test("admin.css: table scrolls inside its box with a sticky first column; comments keep line breaks (RF-42, RF-47, RNF-4)", () => {
  assert.match(CSS, /\.table-wrap\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(CSS, /position:\s*sticky[^}]*left:\s*0|left:\s*0[^}]*position:\s*sticky/);
  assert.match(CSS, /\.comment\s*\{[^}]*white-space:\s*pre-wrap/);
  assert.match(CSS, /\.comment\s*\{[^}]*overflow-wrap:\s*anywhere/);
});

// --- T13: Q3 multiple choice in the views (RF-72, RF-73, RF-75, RNF-5) ------------------------------------
test("stats-view.js: the multiple-choice note next to 'N answers', also with 'No answers yet' (RF-72)", () => {
  assert.match(STATS_JS, /q\.note/);
  assert.match(STATS_JS, /"stat-block__note"/);
  // painted before the 'No answers yet' branch, so it is shown whatever the data
  assert.ok(STATS_JS.indexOf("stat-block__note") < STATS_JS.indexOf("q.answers === 0"));
  // the unknown-option notice keeps counting q.unknown.count (rows, RF-76)
  assert.match(STATS_JS, /q\.unknown\.count/);
});

test("list-view.js: one line per marked option from `lines`, comment below, '—' when empty (RF-40, RF-73)", () => {
  assert.match(LIST_JS, /a\.lines/);
  assert.equal(/a\.answer\b/.test(LIST_JS), false, "the lines, not the joined answer, are painted");
  assert.match(LIST_JS, /"—"/);
});

test("admin.css: the note is normal text in --muted, at least 14 px (RF-72, RNF-5)", () => {
  const rule = CSS.match(/\.stat-block__note\s*\{[^}]*\}/);
  assert.ok(rule, ".stat-block__note is styled");
  assert.match(rule[0], /color:\s*var\(--muted\)/);
  const size = rule[0].match(/font-size:\s*([\d.]+)(rem|px)/);
  if (size) assert.ok((size[2] === "rem" ? Number(size[1]) * 16 : Number(size[1])) >= 14);
});
