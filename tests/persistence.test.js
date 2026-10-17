import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../js/lib/survey-state.js";
import { emptyQueue } from "../js/lib/sync-queue.js";
import { serialize, deserialize, loadOrCreate } from "../js/lib/persistence.js";

const ID_1 = "0b6f3c2a-1d4e-4f5a-9b8c-7d6e5f4a3b2c";
const ID_2 = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const V = "2026-10-test-1";

const sampleLocal = () => ({
  participantId: ID_1,
  contentVersion: V,
  seq: 3,
  survey: {
    ...initialState(),
    screen: "question",
    current: 3,
    country: "FR",
    answers: { q1: { option: "A", text: null }, q2: { option: "A", text: "why" } },
    drafts: { q1: { option: "A", text: "" }, q2: { option: "A", text: "why" } },
    answered: ["q1", "q2"],
  },
  queue: { pending: { p_id: ID_1, p_seq: 3 }, attempt: 2, offline: true },
});

test("serialize/deserialize round trip keeps everything", () => {
  const local = sampleLocal();
  assert.deepEqual(deserialize(serialize(local)), local);
});

test("deserialize: corrupt or non-object JSON → null", () => {
  for (const raw of [null, undefined, "", "{", "not json", "null", "42", '"text"', "[]", "true"]) {
    assert.equal(deserialize(raw), null, `raw=${raw}`);
  }
});

test("deserialize: invalid shape → null", () => {
  const base = sampleLocal();
  const broken = [
    { ...base, participantId: "abc" },
    { ...base, participantId: undefined },
    { ...base, contentVersion: "" },
    { ...base, contentVersion: 7 },
    { ...base, seq: -1 },
    { ...base, seq: 1.5 },
    { ...base, seq: "3" },
    { ...base, survey: null },
    { ...base, survey: "x" },
    { ...base, queue: "x" },
    { ...base, queue: { ...base.queue, pending: "x" } },
  ];
  for (const local of broken) {
    assert.equal(deserialize(JSON.stringify(local)), null, JSON.stringify(local));
  }
});

test("deserialize: missing or partial queue → empty queue values", () => {
  const { queue, ...noQueue } = sampleLocal();
  assert.deepEqual(deserialize(JSON.stringify(noQueue)).queue, emptyQueue());
  const partial = { ...noQueue, queue: { pending: null } };
  assert.deepEqual(deserialize(JSON.stringify(partial)).queue, emptyQueue());
});

test("loadOrCreate: nothing stored → new local with injected id, seq 0, initial state (RF-41)", () => {
  let calls = 0;
  const newId = () => { calls += 1; return ID_2; };
  const local = loadOrCreate(null, V, newId);
  assert.equal(calls, 1);
  assert.deepEqual(local, {
    participantId: ID_2,
    contentVersion: V,
    seq: 0,
    survey: initialState(),
    queue: emptyQueue(),
  });
});

test("loadOrCreate: corrupt JSON → new local", () => {
  const local = loadOrCreate("{oops", V, () => ID_2);
  assert.equal(local.participantId, ID_2);
  assert.equal(local.seq, 0);
  assert.deepEqual(local.survey, initialState());
});

test("loadOrCreate: different content version → new id, clean state, empty queue (RF-52)", () => {
  const old = { ...sampleLocal(), survey: { ...sampleLocal().survey, status: "completed", screen: "final" } };
  const local = loadOrCreate(serialize(old), "2026-10-real-1", () => ID_2);
  assert.equal(local.participantId, ID_2);
  assert.equal(local.contentVersion, "2026-10-real-1");
  assert.equal(local.seq, 0);
  assert.deepEqual(local.survey, initialState());
  assert.deepEqual(local.queue, emptyQueue());
});

test("loadOrCreate: same version → restored local, newId not called (RF-51)", () => {
  const saved = sampleLocal();
  const local = loadOrCreate(serialize(saved), V, () => { throw new Error("must not be called"); });
  assert.deepEqual(local, saved);
});
