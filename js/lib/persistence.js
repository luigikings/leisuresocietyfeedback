// Local progress saved on the device: serialize/restore, content version and new participant.
// Pure module: no DOM, no storage, no randomness (the raw string and newId are injected). RF-41, RF-51, RF-52.
import { initialState } from "./survey-state.js";
import { emptyQueue } from "./sync-queue.js";
import { isUuidV4 } from "./payload.js";

/**
 * Local shape:
 * { participantId: uuid v4, contentVersion: string, seq: last counter used (integer >= 0),
 *   survey: <survey-state>, queue: { pending: payload|null, attempt, offline } }
 */
export function serialize(local) {
  return JSON.stringify(local);
}

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function restoreQueue(raw) {
  if (raw === undefined) return emptyQueue();
  if (!isObject(raw)) return null;
  const pending = raw.pending ?? null;
  if (pending !== null && !isObject(pending)) return null;
  const attempt = Number.isInteger(raw.attempt) && raw.attempt >= 0 ? raw.attempt : 0;
  return { pending, attempt, offline: raw.offline === true };
}

/** Parses the stored string; returns null when it is missing, corrupt or has an invalid shape. */
export function deserialize(raw) {
  if (typeof raw !== "string" || raw === "") return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(data)) return null;
  const { participantId, contentVersion, seq, survey } = data;
  if (!isUuidV4(participantId)) return null;
  if (typeof contentVersion !== "string" || contentVersion === "") return null;
  if (!Number.isInteger(seq) || seq < 0) return null;
  if (!isObject(survey)) return null;
  const queue = restoreQueue(data.queue);
  if (!queue) return null;
  return { participantId, contentVersion, seq, survey, queue };
}

/**
 * Local to use when the survey opens.
 * - nothing stored, corrupt, or another content version → new participant: newId(), seq 0,
 *   initial survey state and empty queue (RF-41, RF-52);
 * - otherwise → the restored local (the UI then calls resumeState on its survey, RF-51).
 */
export function loadOrCreate(raw, contentVersion, newId) {
  const saved = deserialize(raw);
  if (saved && saved.contentVersion === contentVersion) return saved;
  return {
    participantId: newId(),
    contentVersion,
    seq: 0,
    survey: initialState(),
    queue: emptyQueue(),
  };
}
