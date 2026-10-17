// Sync adapter: timers, one send at a time and retries on top of the pure queue in js/lib/sync-queue.js.
// No DOM and no globals: save, persist, notice, console and timers are injected (main.js wires them).
// RF-44 to RF-50. Plan §9.
import { classify, enqueue, onResult, showOfflineNotice } from "../lib/sync-queue.js";

/**
 * @param {object} deps
 * @param {object} deps.initialQueue queue restored from the device ({pending, attempt, offline})
 * @param {(payload) => Promise<{status?, timedOut?, threw?, noConfig?}>} deps.save one RPC call
 * @param {(q) => void} deps.persist stores the queue on the device after every change
 * @param {(visible: boolean) => void} deps.onNotice shows/hides "Saved offline – will sync"
 * @param {(...args) => void} [deps.warn] console warning for definitive rejections (RF-48)
 * @param {Function} [deps.setTimer] / [deps.clearTimer] timer functions
 */
export function createSync({
  initialQueue,
  save,
  persist,
  onNotice,
  warn = (...args) => console.warn(...args),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
}) {
  let q = initialQueue;
  let inFlight = false;
  let timer = null;

  function cancelTimer() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  async function send() {
    timer = null;
    if (inFlight || !q.pending) return;
    inFlight = true;
    const sent = q.pending;
    let result;
    try {
      result = await save(sent);
    } catch {
      result = { threw: true };
    }
    const kind = classify(result);
    const out = onResult(q, sent, kind);
    q = out.q;
    persist(q);
    onNotice(showOfflineNotice(q));
    if (out.action === "warn") warn("Save rejected by the database; it will not be retried.", result);
    inFlight = false;
    if (kind === "transient") {
      cancelTimer();
      timer = setTimer(send, out.delay);
    } else if (q.pending) {
      kick();
    }
  }

  /** Sends now if something is pending and nothing is in flight (on start, on "online", after a push). */
  function kick() {
    if (inFlight || !q.pending) return;
    cancelTimer();
    send();
  }

  /** A new full state replaces any pending one (RF-46) and is sent as soon as possible. */
  function push(payload) {
    q = enqueue(q, payload);
    persist(q);
    kick();
  }

  return { push, kick, queue: () => q };
}
