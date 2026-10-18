// Access logic of the /admin panel (spec 002). Pure: no DOM, network or clock.
// The UI passes the raw form values and the results of the Supabase calls; this module decides what they mean.

/** The only accepted username: the shared account (RF-4). */
export const ADMIN_USERNAME = "admin";

/** Case-insensitive, ignoring spaces at both ends (RF-4). */
export function normalizeUsername(s) {
  return typeof s === "string" ? s.trim().toLowerCase() : "";
}

/**
 * Validates the login form before any request.
 * - { error: "empty" }: trimmed username or (untrimmed) password empty (RF-67).
 * - { error: "credentials" }: another username; no request is made and the wrong-password text is shown (RF-6).
 * - { ok: true, email, password }: the internal email and the password exactly as typed (RF-5).
 */
export function prepareLogin({ username, password } = {}, email) {
  const user = normalizeUsername(username);
  const pass = typeof password === "string" ? password : "";
  if (user === "" || pass === "") return { error: "empty" };
  if (user !== ADMIN_USERNAME) return { error: "credentials" };
  return { ok: true, email, password: pass };
}

const isNetworkStatus = (status) => typeof status !== "number" || status === 0 || status >= 500;

/** No usable answer: timeout, thrown error (client not loaded, fetch failed) or a network/5xx error. */
function isNetworkFailure({ error, timedOut, threw }) {
  if (timedOut || threw) return true;
  if (!error) return false;
  return error.name === "AuthRetryableFetchError" || isNetworkStatus(error.status);
}

/** The JWT is missing, expired or invalid and could not be refreshed (RF-16). */
function isSessionEnded(error) {
  if (!error) return false;
  return (
    error.status === 401 ||
    error.code === "PGRST301" ||
    error.code === "PGRST302" ||
    error.name === "AuthSessionMissingError"
  );
}

/**
 * Result of signInWithPassword → "ok" | "credentials" | "rate_limited" | "not_confirmed" | "network".
 * Input: { error, timedOut, threw } (RF-7, RF-8, RF-9, RF-68).
 */
export function classifyAuthResult(result = {}) {
  const { error, timedOut, threw } = result;
  if (timedOut || threw) return "network";
  if (!error) return "ok";
  if (error.status === 429 || error.code === "over_request_rate_limit") return "rate_limited";
  if (error.code === "email_not_confirmed") return "not_confirmed";
  if (isNetworkFailure(result)) return "network";
  return "credentials"; // invalid_credentials or any other 4xx
}

/**
 * Result of the is_admin RPC → "admin" | "no_access" | "network" | "session_ended" (RF-11, RF-12, RF-16, RF-69).
 * Anything that is not a clear true/false answer is treated as "network": no data, the session is kept.
 */
export function classifyAdminCheck(result = {}) {
  const { data, error, timedOut, threw } = result;
  if (timedOut || threw) return "network";
  if (error) return isSessionEnded(error) ? "session_ended" : "network";
  if (data === true) return "admin";
  if (data === false) return "no_access";
  return "network";
}

/** Result of one page of the load → "ok" | "network" | "session_ended" (RF-16, RF-21). */
export function classifyLoadResult(result = {}) {
  const { error, timedOut, threw } = result;
  if (timedOut || threw) return "network";
  if (!error) return "ok";
  return isSessionEnded(error) ? "session_ended" : "network";
}

/**
 * Result of reading the remembered session when the page opens (getSession, which may refresh it)
 * → "none" | "session" | "network" | "session_ended" (RF-3, RF-13, RF-16, RF-69).
 * A refresh that can't reach the server keeps the session (try again later); one the server rejects ends it.
 */
export function classifySessionRestore(result = {}) {
  const { data, error, timedOut, threw } = result;
  if (isNetworkFailure({ error, timedOut, threw })) return "network";
  if (error) return "session_ended";
  return data?.session ? "session" : "none";
}

/** Literal texts of the spec, by key. */
export const MESSAGES = Object.freeze({
  empty: "Enter your username and password.", // RF-67
  credentials: "Wrong username or password.", // RF-6, RF-7
  rate_limited: "Too many attempts. Please wait a few minutes and try again.", // RF-8
  not_confirmed: "This account is not ready yet. Ask the account owner to confirm it in the database dashboard.", // RF-68
  network: "Can't reach the server. Check your connection. If it keeps failing, the database may be paused.", // RF-9
  no_access: "This account has no access to the results.", // RF-12
  session_ended: "Your session has ended. Please log in again.", // RF-16
  load_failed:
    "Couldn't load the responses. Check your connection. If it keeps failing, the database may be paused.", // RF-21, RF-69
  page_failed: "The admin page couldn't load. Check your connection and reload the page.", // RF-66
});
