// Access logic of /admin (spec 002: RF-4 to RF-12, RF-16, RF-21, RF-66 to RF-69).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_USERNAME,
  normalizeUsername,
  prepareLogin,
  classifyAuthResult,
  classifyAdminCheck,
  classifyLoadResult,
  classifySessionRestore,
  MESSAGES,
} from "../js/lib/admin-auth.js";

const EMAIL = "admin@leisure-city.invalid";

test("the shared username is 'admin'", () => {
  assert.equal(ADMIN_USERNAME, "admin");
});

test("normalizeUsername trims and lower-cases (RF-4)", () => {
  assert.equal(normalizeUsername("Admin "), "admin");
  assert.equal(normalizeUsername("ADMIN"), "admin");
  assert.equal(normalizeUsername("  aDmIn\t"), "admin");
  assert.equal(normalizeUsername(""), "");
  assert.equal(normalizeUsername(undefined), "");
});

test("prepareLogin: empty fields give 'empty' (RF-67)", () => {
  assert.deepEqual(prepareLogin({ username: "", password: "x" }, EMAIL), { error: "empty" });
  assert.deepEqual(prepareLogin({ username: "   ", password: "x" }, EMAIL), { error: "empty" });
  assert.deepEqual(prepareLogin({ username: "admin", password: "" }, EMAIL), { error: "empty" });
  assert.deepEqual(prepareLogin({ username: "", password: "" }, EMAIL), { error: "empty" });
  assert.deepEqual(prepareLogin({ username: "someone", password: "" }, EMAIL), { error: "empty" });
  assert.deepEqual(prepareLogin({}, EMAIL), { error: "empty" });
});

test("prepareLogin: a password of only spaces is not empty and is kept as is (RF-5, RF-67)", () => {
  assert.deepEqual(prepareLogin({ username: "admin", password: "   " }, EMAIL), {
    ok: true,
    email: EMAIL,
    password: "   ",
  });
});

test("prepareLogin: another username gives 'credentials' without a request (RF-6)", () => {
  assert.deepEqual(prepareLogin({ username: "root", password: "secret" }, EMAIL), { error: "credentials" });
  assert.deepEqual(prepareLogin({ username: EMAIL, password: "secret" }, EMAIL), { error: "credentials" });
  assert.deepEqual(prepareLogin({ username: "ad min", password: "secret" }, EMAIL), { error: "credentials" });
});

test("prepareLogin: 'admin' maps to the internal email, password untouched (RF-4, RF-5)", () => {
  assert.deepEqual(prepareLogin({ username: " Admin ", password: " pa ss " }, EMAIL), {
    ok: true,
    email: EMAIL,
    password: " pa ss ",
  });
  assert.deepEqual(prepareLogin({ username: "ADMIN", password: "p" }, "admin@example.com"), {
    ok: true,
    email: "admin@example.com",
    password: "p",
  });
});

test("classifyAuthResult: success", () => {
  assert.equal(classifyAuthResult({}), "ok");
  assert.equal(classifyAuthResult({ error: null }), "ok");
});

test("classifyAuthResult: wrong credentials (RF-7)", () => {
  assert.equal(classifyAuthResult({ error: { status: 400, code: "invalid_credentials" } }), "credentials");
  assert.equal(classifyAuthResult({ error: { status: 400 } }), "credentials");
  assert.equal(classifyAuthResult({ error: { status: 422, code: "validation_failed" } }), "credentials");
});

test("classifyAuthResult: rate limit (RF-8)", () => {
  assert.equal(classifyAuthResult({ error: { status: 429 } }), "rate_limited");
  assert.equal(classifyAuthResult({ error: { status: 400, code: "over_request_rate_limit" } }), "rate_limited");
});

test("classifyAuthResult: account not confirmed (RF-68)", () => {
  assert.equal(classifyAuthResult({ error: { status: 400, code: "email_not_confirmed" } }), "not_confirmed");
});

test("classifyAuthResult: network, timeout, 5xx, client not loaded (RF-9)", () => {
  assert.equal(classifyAuthResult({ timedOut: true }), "network");
  assert.equal(classifyAuthResult({ threw: true }), "network");
  assert.equal(classifyAuthResult({ error: { status: 0 } }), "network");
  assert.equal(classifyAuthResult({ error: { status: 500 } }), "network");
  assert.equal(classifyAuthResult({ error: { status: 503 } }), "network");
  assert.equal(classifyAuthResult({ error: { name: "AuthRetryableFetchError", status: 400 } }), "network");
  assert.equal(classifyAuthResult({ error: { name: "AuthRetryableFetchError" } }), "network");
  assert.equal(classifyAuthResult({ error: { message: "no status" } }), "network");
  // a timeout wins even if an error object came back too
  assert.equal(
    classifyAuthResult({ timedOut: true, error: { status: 400, code: "invalid_credentials" } }),
    "network"
  );
});

test("classifyAdminCheck: admin or not (RF-11, RF-12)", () => {
  assert.equal(classifyAdminCheck({ data: true, error: null }), "admin");
  assert.equal(classifyAdminCheck({ data: false, error: null }), "no_access");
});

test("classifyAdminCheck: invalid session (RF-16)", () => {
  assert.equal(classifyAdminCheck({ error: { status: 401 } }), "session_ended");
  assert.equal(
    classifyAdminCheck({ error: { status: 401, code: "PGRST301", message: "JWT expired" } }),
    "session_ended"
  );
  assert.equal(classifyAdminCheck({ error: { code: "PGRST301" } }), "session_ended");
  assert.equal(classifyAdminCheck({ error: { name: "AuthSessionMissingError" } }), "session_ended");
});

test("classifyAdminCheck: network, timeout, 5xx, odd answers (RF-69)", () => {
  assert.equal(classifyAdminCheck({ timedOut: true }), "network");
  assert.equal(classifyAdminCheck({ threw: true }), "network");
  assert.equal(classifyAdminCheck({ error: { status: 0 } }), "network");
  assert.equal(classifyAdminCheck({ error: { status: 502 } }), "network");
  assert.equal(classifyAdminCheck({ error: { message: "Failed to fetch" } }), "network");
  assert.equal(classifyAdminCheck({ data: null, error: null }), "network");
  assert.equal(classifyAdminCheck({ data: "true", error: null }), "network");
  assert.equal(classifyAdminCheck({ timedOut: true, data: true }), "network");
});

test("classifyLoadResult: ok, session ended, network (RF-16, RF-21)", () => {
  assert.equal(classifyLoadResult({ error: null }), "ok");
  assert.equal(classifyLoadResult({}), "ok");
  assert.equal(classifyLoadResult({ error: { status: 401 } }), "session_ended");
  assert.equal(classifyLoadResult({ error: { code: "PGRST301" } }), "session_ended");
  assert.equal(classifyLoadResult({ timedOut: true }), "network");
  assert.equal(classifyLoadResult({ threw: true }), "network");
  assert.equal(classifyLoadResult({ error: { status: 0 } }), "network");
  assert.equal(classifyLoadResult({ error: { status: 500 } }), "network");
  assert.equal(classifyLoadResult({ error: { message: "Failed to fetch" } }), "network");
});

test("classifySessionRestore: no session, remembered session (RF-3, RF-13)", () => {
  assert.equal(classifySessionRestore({ data: { session: null }, error: null }), "none");
  assert.equal(classifySessionRestore({}), "none");
  assert.equal(classifySessionRestore({ data: { session: { access_token: "t" } }, error: null }), "session");
});

test("classifySessionRestore: a refresh that can't reach the server keeps the session (RF-69)", () => {
  assert.equal(classifySessionRestore({ timedOut: true }), "network");
  assert.equal(classifySessionRestore({ threw: true }), "network");
  assert.equal(classifySessionRestore({ error: { name: "AuthRetryableFetchError", status: 0 } }), "network");
  assert.equal(classifySessionRestore({ error: { status: 503 } }), "network");
  assert.equal(classifySessionRestore({ timedOut: true, data: { session: { access_token: "t" } } }), "network");
});

test("classifySessionRestore: a refresh rejected by the server ends the session (RF-16)", () => {
  assert.equal(
    classifySessionRestore({ error: { name: "AuthApiError", status: 400, code: "refresh_token_not_found" } }),
    "session_ended"
  );
  assert.equal(classifySessionRestore({ error: { status: 401 } }), "session_ended");
  assert.equal(classifySessionRestore({ error: { name: "AuthSessionMissingError", status: 400 } }), "session_ended");
});

test("MESSAGES are the literal texts of the spec", () => {
  assert.deepEqual(MESSAGES, {
    empty: "Enter your username and password.",
    credentials: "Wrong username or password.",
    rate_limited: "Too many attempts. Please wait a few minutes and try again.",
    not_confirmed: "This account is not ready yet. Ask the account owner to confirm it in the database dashboard.",
    network: "Can't reach the server. Check your connection. If it keeps failing, the database may be paused.",
    no_access: "This account has no access to the results.",
    session_ended: "Your session has ended. Please log in again.",
    load_failed:
      "Couldn't load the responses. Check your connection. If it keeps failing, the database may be paused.",
    page_failed: "The admin page couldn't load. Check your connection and reload the page.",
  });
  assert.ok(Object.isFrozen(MESSAGES));
});
