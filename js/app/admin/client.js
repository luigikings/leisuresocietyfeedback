// Supabase client of the /admin panel (plan §4.2): same pinned supabase-js and CDN as the survey, a session kept
// in this site's localStorage only (RNF-16), and one 15 s timeout per request for Auth, RPC and each page
// (proposal 16): every fetch the client makes is aborted after 15 s.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../../config.js";
import { SUPABASE_JS_VERSION } from "../db.js";

export const STORAGE_KEY = "leisure-city-admin-auth";
const TIMEOUT_MS = 15000;
const CDN_URL = `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${SUPABASE_JS_VERSION}/+esm`;

/** fetch with its own 15 s limit, combined with any signal the client already passes. */
export function timedFetch(input, init = {}) {
  const signals = [init.signal, AbortSignal.timeout(TIMEOUT_MS)].filter(Boolean);
  return fetch(input, { ...init, signal: signals.length > 1 ? AbortSignal.any(signals) : signals[0] });
}

let clientPromise = null;
let importAttempt = 0;

/** Rejects if the CDN doesn't answer in 15 s or fails; the next call tries again (RF-9). */
export function getClient() {
  if (!clientPromise) {
    // After a failed import the browser may cache the failure for that URL: retry with a harmless query.
    const url = importAttempt === 0 ? CDN_URL : `${CDN_URL}?retry=${importAttempt}`;
    importAttempt += 1;
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("client load timed out")), TIMEOUT_MS);
    });
    clientPromise = Promise.race([import(url), timeout])
      .then(({ createClient }) =>
        createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
            storageKey: STORAGE_KEY,
          },
          global: { fetch: timedFetch },
        }),
      )
      .catch((err) => {
        clientPromise = null;
        throw err;
      })
      .finally(() => clearTimeout(timer));
  }
  return clientPromise;
}

/** Last resort for "Log out" (RNF-16): the session keys of this client, removed from this browser. */
export function forgetStoredSession() {
  for (const key of [STORAGE_KEY, `${STORAGE_KEY}-code-verifier`, `${STORAGE_KEY}-user`]) {
    try {
      localStorage.removeItem(key);
    } catch {
      // storage blocked: there is nothing stored either
    }
  }
}

/** Whether this browser holds a remembered session, without the client (CDN down at start, RF-69). */
export function hasStoredSession() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
