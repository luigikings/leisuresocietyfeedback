// Guard: the browser must only ever hold the public (anon/publishable) key (RF-68).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../js/config.js";

const JS_DIR = fileURLToPath(new URL("../js/", import.meta.url));
const FORBIDDEN = ["service", "role"].join("_"); // built at runtime so this file never matches itself

/** Returns a reason why `key` must not be shipped to the browser, or null when it is acceptable. */
function keyProblem(key) {
  if (typeof key !== "string") return "key is not a string";
  if (key === "") return null; // local mode
  if (key.startsWith("sb_secret_")) return "secret key (sb_secret_)";
  if (key.includes(FORBIDDEN)) return `key mentions ${FORBIDDEN}`;
  const parts = key.split(".");
  if (parts.length === 3) {
    let claims;
    try {
      claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    } catch {
      return "JWT payload cannot be decoded";
    }
    if (claims?.role !== "anon") return `JWT role is ${claims?.role}`;
  }
  return null;
}

const jwt = (claims) =>
  ["eyJhbGciOiJIUzI1NiJ9", Buffer.from(JSON.stringify(claims)).toString("base64url"), "sig"].join(".");

function jsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jsFiles(join(dir, e.name)) : e.name.endsWith(".js") ? [join(dir, e.name)] : []
  );
}

test("config exports strings (empty = local mode)", () => {
  assert.equal(typeof SUPABASE_URL, "string");
  assert.equal(typeof SUPABASE_ANON_KEY, "string");
  assert.equal(SUPABASE_URL === "", SUPABASE_ANON_KEY === "", "URL and key are filled in together");
  if (SUPABASE_URL) assert.match(SUPABASE_URL, /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/);
});

test("configured key is the public one, never a secret/service key", () => {
  assert.equal(keyProblem(SUPABASE_ANON_KEY), null);
});

test(`no file under js/ mentions the service key role`, () => {
  const files = jsFiles(JS_DIR);
  assert.ok(files.length > 0);
  for (const f of files) {
    assert.equal(readFileSync(f, "utf8").includes(FORBIDDEN), false, f);
  }
});

test("the guard itself detects bad keys", () => {
  assert.equal(keyProblem(""), null);
  assert.equal(keyProblem("sb_publishable_abc123"), null);
  assert.equal(keyProblem(jwt({ role: "anon", iss: "supabase" })), null);
  assert.notEqual(keyProblem("sb_secret_abc123"), null);
  assert.notEqual(keyProblem(jwt({ role: FORBIDDEN })), null);
  assert.notEqual(keyProblem(jwt({ role: "authenticated" })), null);
  assert.notEqual(keyProblem(jwt({})), null);
  assert.notEqual(keyProblem("a.!!!.c"), null);
  assert.notEqual(keyProblem(undefined), null);
});
