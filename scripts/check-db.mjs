#!/usr/bin/env node
// Checks the LIVE Supabase project against the data and permission rules of spec 001
// (RF-57 to RF-67) and of the Q3 multiple-choice change (RF-62, RF-164: needs migration 002 applied).
// Manual: needs network and js/config.js filled in. Not part of `node --test`.
//
//   node scripts/check-db.mjs
//
// It uses ONLY the public key from js/config.js, exactly like a visitor's browser.
// Rows it creates use content_version "dbcheck…": delete them before the event (docs/supabase.md, step 6).
// Exit code: 0 when every check passes, 1 otherwise.
import { randomUUID } from "node:crypto";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../js/config.js";

const VERSION = "dbcheck";
const TIMEOUT_MS = 10000;
const QUESTION_IDS = Array.from({ length: 10 }, (_, i) => `q${i + 1}`);

const results = [];

function report(ok, name, detail = "") {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

function stop(message) {
  console.error(`check-db: ${message}`);
  process.exit(1);
}

/** Refuses anything that is not the public key (RF-68). */
function publicKeyProblem(key) {
  if (key.startsWith("sb_secret_")) return "this is a secret key: use the anon/publishable key";
  const parts = key.split(".");
  if (parts.length === 3) {
    try {
      const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      if (claims?.role !== "anon") return `JWT role is "${claims?.role}", expected "anon"`;
    } catch {
      return "the key looks like a JWT but cannot be decoded";
    }
  }
  return null;
}

const base = SUPABASE_URL.replace(/\/+$/, "");

function headers(extra = {}) {
  const h = { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json", ...extra };
  // Legacy anon keys are JWTs and also go as Bearer; new publishable keys (sb_publishable_…) only as apikey.
  if (!SUPABASE_ANON_KEY.startsWith("sb_")) h.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  return h;
}

async function call(method, path, body, extraHeaders) {
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: headers(extraHeaders),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { status: res.status, text: await res.text() };
  } catch (err) {
    return { status: 0, text: String(err?.message ?? err) };
  }
}

const is2xx = (s) => s >= 200 && s < 300;
const short = (r) => `HTTP ${r.status}${r.text ? ` ${r.text.slice(0, 120).replace(/\s+/g, " ")}` : ""}`;

/** Full client-shaped payload (same shape as js/lib/payload.js buildPayload). */
function payload(id, seq, { version = VERSION, country = "FR", status = "in_progress", answers = {} } = {}) {
  const p_answers = {};
  for (const q of QUESTION_IDS) p_answers[q] = answers[q] ?? null;
  return { p_id: id, p_version: version, p_country: country, p_status: status, p_seq: seq, p_answers };
}

const rpc = (body) => call("POST", "/rest/v1/rpc/save_response", body);

async function expectSaved(name, body) {
  const r = await rpc(body);
  // RF-60: the RPC returns nothing (204, or 200 with an empty/null body).
  const empty = r.text.trim() === "" || r.text.trim() === "null";
  report(is2xx(r.status) && empty, name, short(r));
}

async function expectRejected(name, body) {
  const r = await rpc(body);
  report(r.status === 400, name, short(r));
}

/** Direct table access must fail for the public (RF-58). A 404 means the table does not exist. */
async function expectDenied(name, method, path, body) {
  const r = await call(method, path, body, { Prefer: "return=minimal" });
  const missing = r.status === 404 || /PGRST205|42P01/.test(r.text);
  report(r.status >= 400 && r.status < 500 && !missing, name, missing ? `table not found — was the SQL applied? ${short(r)}` : short(r));
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    stop("js/config.js is empty (local mode). Fill SUPABASE_URL and SUPABASE_ANON_KEY first (docs/supabase.md, step 5).");
  }
  const problem = publicKeyProblem(SUPABASE_ANON_KEY);
  if (problem) stop(problem);

  console.log(`Checking ${base} with the public key…\n`);

  // ---- Reachability (a paused free project answers 5xx or times out) ----
  const ping = await call("GET", "/auth/v1/settings");
  if (ping.status === 0 || ping.status >= 500) {
    stop(`project not reachable (${short(ping)}). If it is paused, restore it in the Supabase dashboard.`);
  }

  // ---- RF-67: public sign-up disabled ----
  let settings = null;
  try {
    settings = JSON.parse(ping.text);
  } catch {
    /* reported below */
  }
  report(settings?.disable_signup === true, "RF-67 public sign-up is disabled", `disable_signup=${settings?.disable_signup}`);

  // ---- RF-57/RF-58: no direct access to the tables ----
  const someId = randomUUID();
  const row = { id: someId, content_version: VERSION, country: "FR", status: "in_progress", seq: 1 };
  await expectDenied("RF-58 SELECT on responses is denied", "GET", "/rest/v1/responses?select=id&limit=1");
  await expectDenied("RF-58 INSERT on responses is denied", "POST", "/rest/v1/responses", row);
  await expectDenied("RF-58 UPDATE on responses is denied", "PATCH", `/rest/v1/responses?id=eq.${someId}`, { seq: 99 });
  await expectDenied("RF-58 DELETE on responses is denied", "DELETE", `/rest/v1/responses?id=eq.${someId}`);
  await expectDenied("RF-66 admins list exists and is not readable", "GET", "/rest/v1/admins?select=user_id&limit=1");
  const isAdmin = await call("POST", "/rest/v1/rpc/is_admin", {});
  report(isAdmin.status >= 400 && isAdmin.status < 500, "RF-66 is_admin() is not callable by the public", short(isAdmin));

  // ---- RF-59/RF-60/RF-63/RF-64/RF-65: one row through the RPC ----
  const a = randomUUID();
  await expectSaved("RF-59 first save creates the row and returns nothing", payload(a, 1));
  await expectSaved("RF-59 next save updates the row", payload(a, 2, { answers: { q1: { option: "A", text: null } } }));
  await expectSaved("RF-63 older seq is ignored without error", payload(a, 1));
  await expectRejected("RF-64 country change is rejected", payload(a, 3, { country: "DE" }));
  await expectRejected("RF-64 version change is rejected", payload(a, 3, { version: `${VERSION}-other` }));
  await expectSaved(
    "RF-59 completing the row is accepted",
    payload(a, 3, { status: "completed", answers: { q1: { option: "A", text: null }, q2: { option: "B", text: "because" } } })
  );
  // If the old send were not ignored it would hit the "completed" rule and return 400.
  await expectSaved("RF-63/RF-65 older seq on a completed row is ignored", payload(a, 2));
  await expectRejected("RF-65 completed row cannot go back to in_progress", payload(a, 4));
  await expectRejected(
    "RF-65 completed row cannot change",
    payload(a, 5, { status: "completed", answers: { q1: { option: "B", text: null } } })
  );

  // Finishing offline: the first save that reaches the server may already be "completed".
  await expectSaved("RF-59 a new row may arrive already completed", payload(randomUUID(), 7, { status: "completed" }));

  // Two tabs at once with the same ID: both accepted, the primary key keeps a single row.
  const b = randomUUID();
  const [r1, r2] = await Promise.all([rpc(payload(b, 1)), rpc(payload(b, 2))]);
  report(is2xx(r1.status) && is2xx(r2.status), "RF-42 concurrent first saves of one ID are both accepted", `${short(r1)} / ${short(r2)}`);

  // ---- Text length in code points after trimming (same rule as js/lib/text.js) ----
  const emoji280 = "\u{1F600}".repeat(280);
  await expectSaved("RF-62 280 emojis (code points) are accepted", payload(randomUUID(), 1, { answers: { q1: { option: "A", text: emoji280 } } }));
  await expectSaved("RF-62 280 chars plus surrounding spaces are accepted", payload(randomUUID(), 1, { answers: { q1: { option: "A", text: `  ${"a".repeat(280)}  ` } } }));

  // ---- RF-61/RF-62: invalid input is rejected with HTTP 400 ----
  await expectRejected("RF-61 id that is not a UUID", payload("not-a-uuid", 1));
  await expectRejected("RF-61 UUID that is not v4", payload("0b6f3c2a-1d4e-1f5a-9b8c-7d6e5f4a3b2c", 1));
  const id = () => randomUUID();
  await expectRejected("RF-62 empty country", payload(id(), 1, { country: "" }));
  await expectRejected("RF-62 lower-case country", payload(id(), 1, { country: "fr" }));
  await expectRejected("RF-62 three-letter country", payload(id(), 1, { country: "FRA" }));
  await expectRejected("RF-62 empty version", payload(id(), 1, { version: "" }));
  await expectRejected("RF-62 unknown status", payload(id(), 1, { status: "done" }));
  await expectRejected("RF-62 seq 0", payload(id(), 0));
  await expectRejected("RF-62 seq negative", payload(id(), -1));
  await expectRejected("RF-62 answers not an object", { ...payload(id(), 1), p_answers: [] });
  await expectRejected("RF-62 question 11", { ...payload(id(), 1), p_answers: { q11: { option: "A", text: null } } });
  await expectRejected("RF-62 question 0", { ...payload(id(), 1), p_answers: { q0: null } });
  await expectRejected("RF-62 option D", payload(id(), 1, { answers: { q1: { option: "D", text: null } } }));
  await expectRejected("RF-62 lower-case option", payload(id(), 1, { answers: { q1: { option: "a", text: null } } }));
  await expectRejected("RF-62 answer without option", payload(id(), 1, { answers: { q1: { text: "hi" } } }));
  await expectRejected("RF-62 text not a string", payload(id(), 1, { answers: { q1: { option: "A", text: 42 } } }));
  await expectRejected("RF-62 unexpected field in an answer", payload(id(), 1, { answers: { q1: { option: "A", text: null, extra: 1 } } }));
  await expectRejected("RF-62 text of 281 characters", payload(id(), 1, { answers: { q1: { option: "A", text: "a".repeat(281) } } }));

  // ---- RF-62/RF-164: Q3 is multiple choice (migration 002_q3_multiple.sql) ----
  // Before migration 002 is applied, the multi-letter cases below ("AC", "BC", "ABC", "AB" completed) FAIL.
  const q3 = (option, opts = {}) => payload(id(), 1, { ...opts, answers: { q3: { option, text: null } } });
  for (const option of ["A", "AC", "BC", "ABC"]) {
    await expectSaved(`RF-164 Q3 "${option}" is accepted`, q3(option));
  }
  await expectSaved('RF-164 Q3 "AB" in a completed row is accepted', q3("AB", { status: "completed" }));
  for (const option of ["", "CA", "AA", "AD", "ABCD", "ac"]) {
    await expectRejected(`RF-62 Q3 "${option}" is rejected`, q3(option));
  }
  await expectRejected('RF-62 "AB" in another question (q1) is rejected', payload(id(), 1, { answers: { q1: { option: "AB", text: null } } }));

  const failed = results.filter((ok) => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  console.log(`Test rows were created with content_version starting with "${VERSION}". Delete them before the event (docs/supabase.md, step 6).`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
