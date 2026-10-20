import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../js/lib/survey-state.js";
import { emptyQueue } from "../js/lib/sync-queue.js";
import { isUuidV4, uuidV4FromBytes, buildPayload } from "../js/lib/payload.js";

const ID = "0b6f3c2a-1d4e-4f5a-9b8c-7d6e5f4a3b2c";

const localWith = (survey, seq = 0) => ({
  participantId: ID,
  contentVersion: "2026-10-test-1",
  seq,
  survey: { ...initialState(), ...survey },
  queue: emptyQueue(),
});

test("isUuidV4 accepts v4 (any case) and rejects the rest", () => {
  assert.equal(isUuidV4(ID), true);
  assert.equal(isUuidV4(ID.toUpperCase()), true);
  for (const bad of [
    "",
    null,
    undefined,
    42,
    "0b6f3c2a-1d4e-1f5a-9b8c-7d6e5f4a3b2c", // version 1
    "0b6f3c2a-1d4e-4f5a-7b8c-7d6e5f4a3b2c", // wrong variant
    "0b6f3c2a1d4e4f5a9b8c7d6e5f4a3b2c", // no dashes
    "0b6f3c2a-1d4e-4f5a-9b8c-7d6e5f4a3b2", // short
    "0b6f3c2a-1d4e-4f5a-9b8c-7d6e5f4a3b2cc", // long
    "zb6f3c2a-1d4e-4f5a-9b8c-7d6e5f4a3b2c", // not hex
    ` ${ID}`,
  ]) {
    assert.equal(isUuidV4(bad), false, String(bad));
  }
});

test("uuidV4FromBytes sets version and variant bits and formats 16 bytes", () => {
  const zeros = uuidV4FromBytes(new Uint8Array(16));
  assert.equal(zeros, "00000000-0000-4000-8000-000000000000");
  const ones = uuidV4FromBytes(new Uint8Array(16).fill(255));
  assert.equal(ones, "ffffffff-ffff-4fff-bfff-ffffffffffff");
  const seq = uuidV4FromBytes(Uint8Array.from({ length: 16 }, (_, i) => i * 17));
  assert.equal(isUuidV4(seq), true);
  assert.equal(seq, "00112233-4455-4677-8899-aabbccddeeff");
});

test("uuidV4FromBytes rejects anything that is not 16 bytes", () => {
  assert.throws(() => uuidV4FromBytes(new Uint8Array(15)));
  assert.throws(() => uuidV4FromBytes(null));
});

test("buildPayload: full row state with country and every question q1..q10 (RF-37, RF-43)", () => {
  const local = localWith({
    screen: "question",
    current: 3,
    country: "FR",
    answers: { q1: { option: "A", text: null }, q2: { option: "B", text: "  because  " } },
    answered: ["q1", "q2"],
    drafts: { q3: { option: "A", text: "draft is never sent" } },
  });
  const { payload } = buildPayload(local);
  assert.deepEqual(payload, {
    p_id: ID,
    p_version: "2026-10-test-1",
    p_country: "FR",
    p_status: "in_progress",
    p_seq: 1,
    p_answers: {
      q1: { option: "A", text: null },
      q2: { option: "B", text: "because" },
      q3: null, q4: null, q5: null, q6: null, q7: null, q8: null, q9: null, q10: null,
    },
  });
});

test("buildPayload: right after choosing a country, all answers null", () => {
  const { payload } = buildPayload(localWith({ screen: "question", country: "OTHER" }));
  assert.equal(payload.p_country, "OTHER");
  assert.deepEqual(Object.keys(payload.p_answers), ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10"]);
  assert.ok(Object.values(payload.p_answers).every((a) => a === null));
});

test("buildPayload: blank text becomes null", () => {
  const { payload } = buildPayload(localWith({ country: "FR", answers: { q1: { option: "A", text: "   " } } }));
  assert.deepEqual(payload.p_answers.q1, { option: "A", text: null });
});

test("buildPayload: seq grows on every call and the input is not mutated (RF-43)", () => {
  const l0 = localWith({ country: "FR" }, 5);
  const r1 = buildPayload(l0);
  assert.equal(l0.seq, 5);
  assert.equal(r1.payload.p_seq, 6);
  assert.equal(r1.local.seq, 6);
  const r2 = buildPayload(r1.local);
  assert.equal(r2.payload.p_seq, 7);
  assert.ok(r2.payload.p_seq > r1.payload.p_seq);
});

test("buildPayload: completed status is sent", () => {
  const { payload } = buildPayload(localWith({ country: "FR", status: "completed", screen: "final" }));
  assert.equal(payload.p_status, "completed");
});

test("buildPayload: without a country there is nothing to save → throws", () => {
  assert.throws(() => buildPayload(localWith({})));
});

test("buildPayload: the multiple-choice Q3 'AC' is sent as it is (RF-37, RF-164)", () => {
  const local = localWith({
    screen: "question",
    current: 4,
    country: "NL",
    answers: {
      q1: { option: "A", text: null },
      q2: { option: "B", text: null },
      q3: { option: "AC", text: "the theme and the message" },
    },
    answered: ["q1", "q2", "q3"],
  });
  const { payload } = buildPayload(local);
  assert.deepEqual(payload.p_answers.q3, { option: "AC", text: "the theme and the message" });
  const all = buildPayload(localWith({ country: "NL", answers: { q3: { option: "ABC", text: null } } }));
  assert.deepEqual(all.payload.p_answers.q3, { option: "ABC", text: null });
});
