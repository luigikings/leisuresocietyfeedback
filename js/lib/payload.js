// Payload of each save: the FULL row state plus a growing counter. Pure module: no DOM, no network,
// no randomness (random bytes are injected). RF-37, RF-41, RF-43.
import { normalizeForStore } from "./text.js";
import { SITE_IDS } from "./sites.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Question ids sent in every payload: q1 … q10 (one per leisure site). */
const QUESTION_IDS = SITE_IDS.map((_, i) => `q${i + 1}`);

export function isUuidV4(s) {
  return typeof s === "string" && UUID_V4.test(s);
}

/**
 * Formats 16 random bytes as a UUID v4 (122 random bits; version and variant bits forced).
 * The adapter passes crypto.getRandomValues(new Uint8Array(16)) (RF-41).
 */
export function uuidV4FromBytes(bytes) {
  if (!bytes || bytes.length !== 16) throw new Error("uuidV4FromBytes needs exactly 16 bytes");
  const b = Array.from(bytes, (x) => x & 0xff);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function answerFor(answers, id) {
  const a = answers?.[id];
  if (!a || !a.option) return null;
  return { option: a.option, text: normalizeForStore(a.text) };
}

/**
 * Builds the RPC arguments with the full row state (country included) and seq = local.seq + 1.
 * Drafts are never sent: only answers confirmed with Next.
 * @returns {{payload: object, local: object}} the local copy carries the new seq; the input is not mutated.
 */
export function buildPayload(local) {
  const survey = local.survey;
  if (!survey || typeof survey.country !== "string" || !survey.country) {
    throw new Error("buildPayload: no country chosen yet");
  }
  const seq = local.seq + 1;
  const p_answers = {};
  for (const id of QUESTION_IDS) p_answers[id] = answerFor(survey.answers, id);
  const payload = {
    p_id: local.participantId,
    p_version: local.contentVersion,
    p_country: survey.country,
    p_status: survey.status,
    p_seq: seq,
    p_answers,
  };
  return { payload, local: { ...local, seq } };
}
