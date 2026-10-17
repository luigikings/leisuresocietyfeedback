import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyQueue, classify, enqueue, onResult, backoff, showOfflineNotice } from "../js/lib/sync-queue.js";

const p = (seq) => ({ p_id: "id", p_seq: seq });

test("classify: 2xx → ok", () => {
  for (const status of [200, 201, 204, 299]) assert.equal(classify({ status }), "ok", String(status));
});

test("classify: transient failures (network, timeout, CDN, 0, 408, 429, 5xx, no config)", () => {
  const cases = [
    { status: 0 },
    { status: 408 },
    { status: 429 },
    { status: 500 },
    { status: 502 },
    { status: 503 },
    { status: 599 },
    { timedOut: true },
    { threw: true },
    { threw: true, status: 400 },
    { timedOut: true, status: 200 },
    { noConfig: true },
    {},
    { status: 302 },
  ];
  for (const r of cases) assert.equal(classify(r), "transient", JSON.stringify(r));
});

test("classify: other 4xx → fatal (definitive rejection)", () => {
  for (const status of [400, 401, 403, 404, 409, 422]) assert.equal(classify({ status }), "fatal", String(status));
});

test("backoff: 1, 2, 4, 8, 16, 30, 30 s (RF-45)", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 20].map(backoff), [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  assert.equal(backoff(0), 1000);
});

test("emptyQueue", () => {
  assert.deepEqual(emptyQueue(), { pending: null, attempt: 0, offline: false });
});

test("enqueue replaces the pending state and keeps attempt/offline (RF-46)", () => {
  const q1 = enqueue(emptyQueue(), p(1));
  assert.deepEqual(q1, { pending: p(1), attempt: 0, offline: false });
  const failed = { pending: p(1), attempt: 3, offline: true };
  const q2 = enqueue(failed, p(2));
  assert.deepEqual(q2, { pending: p(2), attempt: 3, offline: true });
  assert.deepEqual(failed.pending, p(1), "input not mutated");
});

test("onResult ok: removes the sent state, resets attempt, hides notice (RF-47, RF-50)", () => {
  const r = onResult({ pending: p(4), attempt: 2, offline: true }, p(4), "ok");
  assert.deepEqual(r.q, emptyQueue());
  assert.equal(r.action, "none");
  assert.equal(r.delay, null);
  assert.equal(showOfflineNotice(r.q), false);
});

test("onResult ok with a newer pending state keeps the newer one", () => {
  const r = onResult({ pending: p(5), attempt: 1, offline: true }, p(4), "ok");
  assert.deepEqual(r.q, { pending: p(5), attempt: 0, offline: false });
  assert.equal(r.action, "none");
});

test("onResult transient: keeps pending, grows attempt and delay, shows notice (RF-44, RF-45, RF-49)", () => {
  let q = enqueue(emptyQueue(), p(1));
  const delays = [];
  for (let i = 0; i < 7; i += 1) {
    const r = onResult(q, p(1), "transient");
    assert.equal(r.action, "retry");
    delays.push(r.delay);
    q = r.q;
  }
  assert.deepEqual(delays, [1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  assert.deepEqual(q.pending, p(1));
  assert.equal(q.attempt, 7);
  assert.equal(showOfflineNotice(q), true);
});

test("onResult transient while a newer state arrived keeps the newer one", () => {
  const r = onResult({ pending: p(2), attempt: 0, offline: false }, p(1), "transient");
  assert.deepEqual(r.q.pending, p(2));
  assert.equal(r.q.offline, true);
});

test("onResult fatal: drops that state, warns, no retry (RF-48)", () => {
  const r = onResult({ pending: p(3), attempt: 2, offline: true }, p(3), "fatal");
  assert.deepEqual(r.q, emptyQueue());
  assert.equal(r.action, "warn");
  assert.equal(r.delay, null);
  assert.equal(showOfflineNotice(r.q), false);
});

test("onResult fatal with a newer pending state keeps it and goes on", () => {
  const r = onResult({ pending: p(4), attempt: 2, offline: true }, p(3), "fatal");
  assert.deepEqual(r.q, { pending: p(4), attempt: 0, offline: true });
  assert.equal(r.action, "warn");
  // the next state is then sent normally and accepted
  const ok = onResult(r.q, p(4), "ok");
  assert.deepEqual(ok.q, emptyQueue());
});

test("showOfflineNotice: only with a pending state after a transient failure (RF-49, RF-50)", () => {
  assert.equal(showOfflineNotice(emptyQueue()), false);
  assert.equal(showOfflineNotice(enqueue(emptyQueue(), p(1))), false, "not before any failure");
  assert.equal(showOfflineNotice({ pending: null, attempt: 1, offline: true }), false);
  assert.equal(showOfflineNotice({ pending: p(1), attempt: 1, offline: true }), true);
});

test("onResult never mutates its input", () => {
  const q = { pending: p(1), attempt: 0, offline: false };
  const copy = structuredClone(q);
  onResult(q, p(1), "transient");
  onResult(q, p(1), "ok");
  onResult(q, p(1), "fatal");
  assert.deepEqual(q, copy);
});
