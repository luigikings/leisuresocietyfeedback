// Static guard of the security invariants of the database migration (RF-37 to RF-40, RF-57 to RF-66).
// The SQL cannot run here (no Postgres in node --test): scripts/check-db.mjs verifies the live database.
// These tests only catch regressions in the file itself (e.g. someone adds a grant to anon).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const RAW = readFileSync(new URL("../supabase/migrations/001_survey.sql", import.meta.url), "utf8");
// Lower-case, without "--" comments, whitespace collapsed: easier and safer to match.
const SQL = RAW.split("\n")
  .map((l) => l.replace(/--.*$/, ""))
  .join(" ")
  .replace(/\s+/g, " ")
  .toLowerCase();

const QUESTIONS = Array.from({ length: 10 }, (_, i) => `q${i + 1}`);

test("RLS is enabled and forced on both tables (RF-57)", () => {
  for (const t of ["responses", "admins"]) {
    assert.ok(SQL.includes(`alter table public.${t} enable row level security`), `${t} enable`);
    assert.ok(SQL.includes(`alter table public.${t} force row level security`), `${t} force`);
  }
  assert.equal(SQL.includes("disable row level security"), false);
  assert.equal(SQL.includes("no force row level security"), false);
});

test("anon and authenticated lose every default table privilege (RF-58)", () => {
  for (const t of ["responses", "admins"]) {
    assert.ok(SQL.includes(`revoke all on table public.${t} from public, anon, authenticated`), t);
  }
});

test("the only table grant is SELECT on responses to authenticated (filtered by is_admin, RF-66)", () => {
  const grants = [...SQL.matchAll(/grant ([a-z, ]+) on table ([a-z_.]+) to ([a-z_, ]+);/g)].map((m) => m.slice(1).join("|"));
  assert.deepEqual(grants, ["select|public.responses|authenticated"]);
  assert.equal(/grant [^;]* to [^;]*\banon\b[^;]*;/.test(SQL.replace(/grant execute on function public\.save_response\([^)]*\) to anon, authenticated;/, "")), false);
});

test("public policies: only admin read; no insert/update/delete policy for API roles (RF-58, RF-66)", () => {
  const policies = [...SQL.matchAll(/create policy (\w+) on public\.(\w+) for (\w+) to (\w+)/g)].map((m) => m.slice(1).join("|"));
  const apiPolicies = policies.filter((p) => !p.endsWith("|postgres"));
  assert.deepEqual(apiPolicies, ["responses_admin_read|responses|select|authenticated"]);
  assert.ok(SQL.includes("using (public.is_admin())"));
});

test("functions are security definer with an empty search_path", () => {
  for (const fn of ["is_admin", "save_response"]) {
    const start = SQL.indexOf(`create or replace function public.${fn}(`);
    assert.ok(start >= 0, fn);
    const header = SQL.slice(start, SQL.indexOf(" as $$", start));
    assert.ok(header.includes("security definer"), `${fn} security definer`);
    assert.ok(header.includes("set search_path = ''"), `${fn} search_path`);
  }
});

test("execute: save_response for anon/authenticated, is_admin only for authenticated", () => {
  assert.ok(SQL.includes("revoke all on function public.save_response(text, text, text, text, bigint, jsonb) from public, anon, authenticated"));
  assert.ok(SQL.includes("grant execute on function public.save_response(text, text, text, text, bigint, jsonb) to anon, authenticated"));
  assert.ok(SQL.includes("revoke all on function public.is_admin() from public, anon, authenticated"));
  assert.ok(SQL.includes("grant execute on function public.is_admin() to authenticated"));
});

test("save_response takes exactly the client payload and returns nothing (RF-60)", () => {
  assert.ok(
    SQL.includes(
      "create or replace function public.save_response( p_id text, p_version text, p_country text, p_status text, p_seq bigint, p_answers jsonb ) returns void"
    )
  );
});

test("responses has exactly the RF-37 columns: no personal data, no question texts (RF-37, RF-38, RF-40)", () => {
  const start = SQL.indexOf("create table if not exists public.responses (");
  const body = SQL.slice(start, SQL.indexOf(");", start));
  const cols = [...body.matchAll(/(?:\( ?|, )([a-z0-9_]+) (uuid|text|bigint|timestamptz)\b/g)].map((m) => m[1]);
  const expected = [
    "id", "content_version", "country", "status", "seq",
    ...QUESTIONS.flatMap((q) => [`${q}_option`, `${q}_text`]),
    "created_at", "updated_at",
  ];
  assert.deepEqual(cols, expected);
  for (const banned of ["ip", "email", "name", "user_agent", "device", "location", "label"]) {
    assert.equal(cols.includes(banned), false, banned);
  }
});

test("server clock for dates (RF-39) and validation errors are 22023 → HTTP 400 (fatal in the client)", () => {
  assert.ok(SQL.includes("created_at timestamptz not null default now()"));
  assert.ok(SQL.includes("updated_at = now()"));
  assert.ok(SQL.includes("errcode = '22023'"));
});

test("the RPC enforces seq, immutable country/version and completed rows (RF-63, RF-64, RF-65)", () => {
  assert.ok(SQL.includes("if p_seq <= v_row.seq then return;"));
  assert.ok(SQL.includes("if v_row.status = 'completed' then"));
  assert.ok(SQL.includes("v_row.country <> p_country or v_row.content_version <> p_version"));
  assert.ok(SQL.includes("for update"));
  assert.ok(SQL.includes("on conflict (id) do nothing"));
});

test("no secret material in the migration", () => {
  assert.equal(/sb_secret_|eyj[a-z0-9_-]{10,}\./.test(SQL), false);
});
