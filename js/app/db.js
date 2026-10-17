// Database adapter: loads the official supabase-js client from the CDN ONLY when there is something to send
// (dynamic import, so it never delays "Start", RNF-5) and calls the save_response RPC with a 10 s timeout.
// Returns a plain result for classify() in js/lib/sync-queue.js. Plan §8.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";

/** Exact version (approved dependency, no ranges): latest 2.x published at least 2 weeks before pinning (2026-09-25, pinned 2026-10-16). */
export const SUPABASE_JS_VERSION = "2.117.2";
const CDN_URL = `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${SUPABASE_JS_VERSION}/+esm`;
const TIMEOUT_MS = 10000;

let clientPromise = null;
let importAttempt = 0;

function loadClient() {
  if (!clientPromise) {
    // After a failed import the browser may cache the failure for that URL: retry with a harmless query.
    const url = importAttempt === 0 ? CDN_URL : `${CDN_URL}?retry=${importAttempt}`;
    importAttempt += 1;
    clientPromise = import(url)
      .then(({ createClient }) =>
        createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        }),
      )
      .catch((err) => {
        clientPromise = null;
        throw err;
      });
  }
  return clientPromise;
}

const hasConfig = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * One save of the full state.
 * @returns {Promise<{status?: number, timedOut?: boolean, threw?: boolean, noConfig?: boolean}>}
 */
export async function saveResponse(payload) {
  if (!hasConfig()) return { noConfig: true };
  const controller = new AbortController();
  let timedOut = false;
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      resolve({ timedOut: true });
    }, TIMEOUT_MS);
  });
  const attempt = (async () => {
    try {
      const client = await loadClient();
      if (timedOut) return { timedOut: true };
      const { status } = await client.rpc("save_response", payload).abortSignal(controller.signal);
      if (timedOut) return { timedOut: true };
      return { status: Number.isInteger(status) ? status : 0 };
    } catch {
      return timedOut ? { timedOut: true } : { threw: true };
    }
  })();
  try {
    return await Promise.race([attempt, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
