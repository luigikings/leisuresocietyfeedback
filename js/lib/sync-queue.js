// Local sync queue: failure classification, retry waits and offline notice. Pure module:
// no DOM, no network, no timers (the adapter js/app/sync.js owns them). RF-44 to RF-50.
// The queue keeps ONLY the latest full state still to be sent (RF-46).

const FIRST_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

/** Queue shape: { pending: payload|null, attempt: number of transient failures in a row, offline: boolean } */
export function emptyQueue() {
  return { pending: null, attempt: 0, offline: false };
}

/**
 * Kind of result of one send.
 * @param {{status?: number, timedOut?: boolean, threw?: boolean, noConfig?: boolean}} r
 * @returns {"ok"|"transient"|"fatal"}
 *  - transient: timeout, exception (network or CDN import failure), no configuration (local mode),
 *    status 0, 408, 429, >= 500, or anything unknown;
 *  - fatal: any other 4xx (definitive rejection, e.g. HTTP 400 from validation);
 *  - ok: 2xx (accepted, or ignored as old by the database: RF-47).
 */
export function classify(r = {}) {
  if (r.timedOut || r.threw || r.noConfig) return "transient";
  const s = r.status;
  if (!Number.isInteger(s)) return "transient";
  if (s >= 200 && s < 300) return "ok";
  if (s === 0 || s === 408 || s === 429 || s >= 500) return "transient";
  if (s >= 400 && s < 500) return "fatal";
  return "transient";
}

/** Wait before retry number `attempt` (1-based): 1, 2, 4, 8, 16, 30, 30 s… (RF-45). */
export function backoff(attempt) {
  const n = Math.max(1, Math.floor(attempt) || 1);
  return Math.min(FIRST_DELAY_MS * 2 ** (n - 1), MAX_DELAY_MS);
}

/** A new full state replaces any pending one; failure count and notice are kept (RF-46). */
export function enqueue(q, payload) {
  return { ...q, pending: payload };
}

const sameSend = (pending, sent) => pending != null && sent != null && pending.p_seq === sent.p_seq;

/**
 * Applies the result of sending `sent`.
 * @returns {{q: object, action: "none"|"retry"|"warn", delay: number|null}}
 *  - ok: drops the sent state (a newer pending one is kept), attempt = 0, notice hidden (RF-47, RF-50);
 *  - transient: keeps the pending state, attempt + 1, retry after backoff(attempt) (RF-44, RF-45, RF-49);
 *  - fatal: drops the sent state without retry and asks for a console warning (RF-48);
 *    the notice stays only if a newer state is still pending.
 */
export function onResult(q, sent, kind) {
  if (kind === "ok") {
    const pending = sameSend(q.pending, sent) ? null : q.pending;
    return { q: { ...q, pending, attempt: 0, offline: false }, action: "none", delay: null };
  }
  if (kind === "fatal") {
    const pending = sameSend(q.pending, sent) ? null : q.pending;
    return { q: { ...q, pending, attempt: 0, offline: pending !== null && q.offline }, action: "warn", delay: null };
  }
  const attempt = q.attempt + 1;
  return { q: { ...q, attempt, offline: true }, action: "retry", delay: backoff(attempt) };
}

/** "Saved offline – will sync" is visible only while a state is pending after a transient failure (RF-49, RF-50). */
export function showOfflineNotice(q) {
  return Boolean(q.offline) && q.pending != null;
}
