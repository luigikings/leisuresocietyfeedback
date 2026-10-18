// Paginated load by id (keyset) for /admin (spec 002: RF-17, RF-21, propuesta 28).
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadAllRows, DEFAULT_PAGE_SIZE, STALLED_PAGE } from "../js/lib/admin-load.js";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Fake server: a mutable table ordered by id, honouring "id > lastId" and a server-side max page size. */
function fakeServer(count, { serverMax = Infinity, between } = {}) {
  const table = new Map();
  for (let i = 1; i <= count; i++) table.set(id(i * 10), { id: id(i * 10), v: 0 });
  const calls = [];
  async function fetchPage(lastId, size) {
    calls.push({ lastId, size });
    if (between) between(calls.length, table);
    const sorted = [...table.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const after = lastId === null ? sorted : sorted.filter((r) => r.id > lastId);
    return { rows: after.slice(0, Math.min(size, serverMax)).map((r) => ({ ...r })) };
  }
  return { table, calls, fetchPage };
}

test("default page size is 1000", () => {
  assert.equal(DEFAULT_PAGE_SIZE, 1000);
});

test("0 rows: one request, empty result", async () => {
  const s = fakeServer(0);
  assert.deepEqual(await loadAllRows(s.fetchPage), { rows: [] });
  assert.deepEqual(s.calls, [{ lastId: null, size: 1000 }]);
});

test("2500 rows in pages of 1000: all rows once, keyset by last id", async () => {
  const s = fakeServer(2500);
  const r = await loadAllRows(s.fetchPage);
  assert.equal(r.error, undefined);
  assert.equal(r.rows.length, 2500);
  assert.equal(new Set(r.rows.map((x) => x.id)).size, 2500);
  assert.deepEqual(
    s.calls.map((c) => c.lastId),
    [null, id(10000), id(20000), id(25000)]
  );
  assert.ok(s.calls.every((c) => c.size === 1000));
});

test("server limiting pages to 500 does not end the load early", async () => {
  const s = fakeServer(2500, { serverMax: 500 });
  const r = await loadAllRows(s.fetchPage);
  assert.equal(r.rows.length, 2500);
  assert.equal(s.calls.length, 6); // 5 full pages + the empty one that ends the load
});

test("writes between pages: no duplicates and no existing row omitted (RF-17)", async () => {
  const before = new Set();
  const s = fakeServer(2500, {
    between(call, table) {
      if (call === 1) for (const k of table.keys()) before.add(k);
      if (call === 2) {
        // new row with an id lower than the last one already read
        table.set(id(5), { id: id(5), v: 0 });
        // update of an already-read row and of a not-yet-read row
        table.get(id(10)).v = 1;
        table.get(id(24990)).v = 1;
      }
      if (call === 3) table.set(id(99999), { id: id(99999), v: 0 }); // new row after the end so far
    },
  });
  const r = await loadAllRows(s.fetchPage);
  const ids = r.rows.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, "no duplicates");
  for (const k of before) assert.ok(ids.includes(k), `missing ${k}`);
  assert.equal(r.rows.find((x) => x.id === id(24990)).v, 1, "rows not yet read come with their update");
});

test("a page returning a row twice is deduplicated", async () => {
  const pages = [{ rows: [{ id: id(1) }, { id: id(2) }] }, { rows: [{ id: id(2) }, { id: id(3) }] }, { rows: [] }];
  let i = 0;
  const r = await loadAllRows(async () => pages[i++], 2);
  assert.deepEqual(
    r.rows.map((x) => x.id),
    [id(1), id(2), id(3)]
  );
});

test("a failing page fails the whole load, no partial rows, no retry (RF-21)", async () => {
  const s = fakeServer(2500);
  let n = 0;
  const fetchPage = async (lastId, size) => (++n === 2 ? { error: "network" } : s.fetchPage(lastId, size));
  const r = await loadAllRows(fetchPage);
  assert.deepEqual(r, { error: "network" });
  assert.equal(n, 2);
});

test("the error value is passed through as given (e.g. session_ended)", async () => {
  const r = await loadAllRows(async () => ({ error: "session_ended" }));
  assert.deepEqual(r, { error: "session_ended" });
});

test("custom page size is passed to fetchPage", async () => {
  const s = fakeServer(5);
  const r = await loadAllRows(s.fetchPage, 2);
  assert.equal(r.rows.length, 5);
  assert.deepEqual(
    s.calls.map((c) => c.size),
    [2, 2, 2, 2]
  );
});

// T8: guard against a server that returns a page without moving past the last id (no endless loop).
test("STALLED_PAGE is its own error value", () => {
  assert.equal(STALLED_PAGE, "stalled");
});

test("a server that ignores lastId (same page again) stops the load with an error, no rows", async () => {
  let calls = 0;
  const fetchPage = async () => {
    calls += 1;
    if (calls > 10) throw new Error("endless loop");
    return { rows: [{ id: id(1) }, { id: id(2) }] };
  };
  const r = await loadAllRows(fetchPage, 2);
  assert.deepEqual(r, { error: STALLED_PAGE });
  assert.equal(calls, 2);
});

test("a page whose last id equals the previous last id is a stall", async () => {
  const pages = [{ rows: [{ id: id(1) }, { id: id(2) }] }, { rows: [{ id: id(3) }, { id: id(2) }] }, { rows: [] }];
  let i = 0;
  const r = await loadAllRows(async () => pages[i++] ?? { rows: [] }, 2);
  assert.deepEqual(r, { error: STALLED_PAGE });
});

test("a page with only already-seen rows is a stall", async () => {
  const pages = [{ rows: [{ id: id(1) }, { id: id(2) }] }, { rows: [{ id: id(2) }, { id: id(1) }] }];
  let i = 0;
  const r = await loadAllRows(async () => pages[i++] ?? { rows: [{ id: id(9) }] }, 2);
  assert.deepEqual(r, { error: STALLED_PAGE });
  assert.equal(i, 2);
});

test("a page without a rows array is a failed load, not a crash", async () => {
  const r = await loadAllRows(async () => ({}));
  assert.deepEqual(r, { error: STALLED_PAGE });
});
