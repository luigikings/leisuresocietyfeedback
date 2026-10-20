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

// ---------------------------------------------------------------------------------------------------------
// Migration 002: Q3 multiple choice (RF-62, RF-164, RF-165; plan §17.4). Static checks only: the live check
// is scripts/check-db.mjs after the user applies it (T42).
// ---------------------------------------------------------------------------------------------------------

const RAW2 = (() => {
  try {
    return readFileSync(new URL("../supabase/migrations/002_q3_multiple.sql", import.meta.url), "utf8");
  } catch {
    return "";
  }
})();
const SQL2 = RAW2.split("\n")
  .map((l) => l.replace(/--.*$/, ""))
  .join(" ")
  .replace(/\s+/g, " ")
  .toLowerCase();

const MULTI_IN = "('a', 'b', 'c', 'ab', 'ac', 'bc', 'abc')";

/** Text of "create or replace function public.save_response(" up to the end of its body ("$$;"). */
function saveResponseOf(sql) {
  const start = sql.indexOf("create or replace function public.save_response(");
  assert.ok(start >= 0, "save_response present");
  return sql.slice(start, sql.indexOf("$$;", sql.indexOf(" as $$", start)) + 3);
}

test("002 exists and runs in one transaction", () => {
  assert.ok(RAW2.length > 0, "supabase/migrations/002_q3_multiple.sql exists");
  assert.ok(SQL2.trimStart().startsWith("begin;"), "starts with begin");
  assert.ok(SQL2.includes(" commit;"), "commit");
  assert.ok(SQL2.indexOf(" commit;") > SQL2.lastIndexOf("$$;"), "commit after the function");
  assert.ok(SQL2.includes("notify pgrst, 'reload schema';"));
});

test("002 finds the current q3_option rule in pg_constraint by its definition, not by an assumed name (RF-165)", () => {
  const start = SQL2.indexOf("do $$");
  assert.ok(start >= 0, "do block");
  const block = SQL2.slice(start, SQL2.indexOf("end $$;", start));
  assert.ok(block.includes("from pg_constraint"));
  assert.ok(block.includes("conrelid = 'public.responses'::regclass"));
  assert.ok(block.includes("contype = 'c'"));
  assert.ok(block.includes("pg_get_constraintdef(oid) ilike '%q3_option%'"));
  assert.ok(block.includes("conname <> 'responses_q3_option_multi_check'"), "keeps the new rule out of the loop");
  assert.ok(block.includes("format('alter table public.responses drop constraint %i', c.conname)"), "drops by the real name");
  assert.ok(block.includes("raise notice 'q3 constraints dropped: %', n;"));
  assert.equal(SQL2.includes("responses_q3_option_check"), false, "no assumed constraint name");
});

test("002 shows how many q3 rules it dropped as the final result (also in the SQL Editor without notices)", () => {
  const tail = SQL2.slice(SQL2.lastIndexOf("notify pgrst"));
  assert.ok(/select 'q3 constraints dropped: ' \|\| coalesce\(current_setting\('leisure_city\.q3_dropped', true\)/.test(tail));
  assert.ok(SQL2.includes("set_config('leisure_city.q3_dropped', n::text, false)"));
});

test("002 creates responses_q3_option_multi_check with exactly the 7 values, idempotently (RF-164)", () => {
  const drop = SQL2.indexOf("alter table public.responses drop constraint if exists responses_q3_option_multi_check;");
  const add = SQL2.indexOf(
    `alter table public.responses add constraint responses_q3_option_multi_check check (q3_option in ${MULTI_IN});`
  );
  assert.ok(drop >= 0, "drop if exists");
  assert.ok(add > drop, "add after drop");
  assert.ok(SQL2.indexOf("do $$") < drop, "old rule dropped first");
  assert.equal(SQL2.split("add constraint").length - 1, 1, "only one constraint added");
});

test("002 save_response: Q3 accepts the 7 values, the other questions one letter; nothing else changes (RF-62)", () => {
  const before = "or (v_option #>> '{}') not in ('a', 'b', 'c') then";
  const after =
    `or (i = 3 and (v_option #>> '{}') not in ${MULTI_IN}) ` + "or (i <> 3 and (v_option #>> '{}') not in ('a', 'b', 'c')) then";
  const fn1 = saveResponseOf(SQL);
  assert.ok(fn1.includes(before), "001 has the single-letter rule");
  const fn2 = saveResponseOf(SQL2);
  assert.ok(fn2.includes(after), "002 has the Q3 branch");
  assert.equal(fn2, fn1.replace(before, after), "same body as 001 apart from the option rule");
});

test("002 keeps security: definer, empty search_path, owner, execute only for anon/authenticated (RF-165)", () => {
  const fn = saveResponseOf(SQL2);
  const header = fn.slice(0, fn.indexOf(" as $$"));
  assert.ok(header.includes("security definer"));
  assert.ok(header.includes("set search_path = ''"));
  const sig = "public.save_response(text, text, text, text, bigint, jsonb)";
  assert.ok(SQL2.includes(`alter function ${sig} owner to postgres;`));
  assert.ok(SQL2.includes(`revoke all on function ${sig} from public, anon, authenticated;`));
  assert.ok(SQL2.includes(`grant execute on function ${sig} to anon, authenticated;`));
  const grants = [...SQL2.matchAll(/\bgrant [^;]*;/g)].map((m) => m[0]);
  assert.deepEqual(grants, [`grant execute on function ${sig} to anon, authenticated;`]);
});

test("002 does not touch RLS, policies, other columns or data, and has no secrets (RF-165)", () => {
  for (const banned of [
    "row level security", "policy", "drop table", "drop function", "truncate", "delete from", "update public.responses set q3",
    "alter column", "add column", "drop column", "service_role", "on table",
  ]) {
    assert.equal(SQL2.includes(banned), false, banned);
  }
  assert.equal(/sb_secret_|eyj[a-z0-9_-]{10,}\./.test(SQL2), false);
});

test("001 header says to apply 002 after it, also when 001 is run again", () => {
  const header = RAW.slice(0, RAW.indexOf("begin;"));
  assert.ok(header.includes("002_q3_multiple.sql"));
  assert.ok(/run again|re-run|rerun/i.test(header.slice(header.indexOf("002_q3_multiple.sql") - 400)));
});
