import { test } from "node:test";
import assert from "node:assert/strict";
import { createSync } from "../js/app/sync.js";
import { emptyQueue } from "../js/lib/sync-queue.js";

/** Fake timers: setTimer stores callbacks, run() fires the pending one. */
function fakeTimers() {
  const timers = new Map();
  let nextId = 1;
  return {
    timers,
    setTimer(fn, ms) {
      const id = nextId++;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
    delays: () => [...timers.values()].map((t) => t.ms),
    async runAll() {
      const list = [...timers.entries()];
      timers.clear();
      for (const [, t] of list) await t.fn();
    },
  };
}

const flush = () => new Promise((r) => setImmediate(r));
const payload = (seq) => ({ p_id: "x", p_seq: seq });

function setup({ results = [], initialQueue = emptyQueue() } = {}) {
  const sent = [];
  const persisted = [];
  const notices = [];
  const warnings = [];
  const t = fakeTimers();
  const queue = [...results];
  const sync = createSync({
    initialQueue,
    save: async (p) => {
      sent.push(p.p_seq);
      return queue.length ? queue.shift() : { status: 204 };
    },
    persist: (q) => persisted.push(q),
    onNotice: (v) => notices.push(v),
    warn: (...args) => warnings.push(args),
    setTimer: t.setTimer,
    clearTimer: t.clearTimer,
  });
  return { sync, sent, persisted, notices, warnings, t };
}

test("push sends the payload and clears the queue on ok (RF-47, RF-50)", async () => {
  const { sync, sent, notices } = setup();
  sync.push(payload(1));
  await flush();
  assert.deepEqual(sent, [1]);
  assert.equal(sync.queue().pending, null);
  assert.equal(notices.at(-1), false);
});

test("push persists the queue with the new pending payload before sending (RF-44)", () => {
  const { sync, persisted } = setup();
  sync.push(payload(1));
  assert.equal(persisted[0].pending.p_seq, 1);
});

test("transient failure keeps the payload, shows the notice and retries after 1 s, then 2 s (RF-44, RF-45, RF-49)", async () => {
  const { sync, sent, notices, t } = setup({ results: [{ noConfig: true }, { status: 503 }, { status: 204 }] });
  sync.push(payload(1));
  await flush();
  assert.equal(sync.queue().pending.p_seq, 1);
  assert.equal(notices.at(-1), true);
  assert.deepEqual(t.delays(), [1000]);
  await t.runAll();
  await flush();
  assert.deepEqual(t.delays(), [2000]);
  await t.runAll();
  await flush();
  assert.deepEqual(sent, [1, 1, 1]);
  assert.equal(sync.queue().pending, null);
  assert.equal(notices.at(-1), false);
});

test("a newer payload pushed while one is in flight is sent right after (RF-46)", async () => {
  let release;
  const sent = [];
  const sync = createSync({
    initialQueue: emptyQueue(),
    save: (p) => {
      sent.push(p.p_seq);
      if (p.p_seq === 1) return new Promise((r) => (release = () => r({ status: 204 })));
      return Promise.resolve({ status: 204 });
    },
    persist: () => {},
    onNotice: () => {},
    warn: () => {},
    setTimer: () => 0,
    clearTimer: () => {},
  });
  sync.push(payload(1));
  sync.push(payload(2));
  assert.deepEqual(sent, [1], "only one send at a time");
  release();
  await flush();
  await flush();
  assert.deepEqual(sent, [1, 2]);
  assert.equal(sync.queue().pending, null);
});

test("fatal rejection drops the payload without retry and warns in the console (RF-48)", async () => {
  const { sync, sent, warnings, t } = setup({ results: [{ status: 400 }] });
  sync.push(payload(1));
  await flush();
  assert.deepEqual(sent, [1]);
  assert.equal(sync.queue().pending, null);
  assert.equal(warnings.length, 1);
  assert.deepEqual(t.delays(), []);
});

test("kick sends a pending payload restored from storage (RF-45, reopening)", async () => {
  const { sync, sent } = setup({ initialQueue: { pending: payload(7), attempt: 3, offline: true } });
  sync.kick();
  await flush();
  assert.deepEqual(sent, [7]);
  assert.equal(sync.queue().pending, null);
});

test("kick (back online) cancels the waiting timer and sends now (RF-45)", async () => {
  const { sync, sent, t } = setup({ results: [{ threw: true }, { status: 204 }] });
  sync.push(payload(1));
  await flush();
  assert.equal(t.timers.size, 1);
  sync.kick();
  await flush();
  assert.equal(t.timers.size, 0);
  assert.deepEqual(sent, [1, 1]);
});

test("kick with nothing pending does not send", async () => {
  const { sync, sent } = setup();
  sync.kick();
  await flush();
  assert.deepEqual(sent, []);
});

test("save that throws is treated as transient", async () => {
  const notices = [];
  const sync = createSync({
    initialQueue: emptyQueue(),
    save: async () => {
      throw new Error("boom");
    },
    persist: () => {},
    onNotice: (v) => notices.push(v),
    warn: () => {},
    setTimer: () => 1,
    clearTimer: () => {},
  });
  sync.push(payload(1));
  await flush();
  assert.equal(sync.queue().pending.p_seq, 1);
  assert.equal(notices.at(-1), true);
});
