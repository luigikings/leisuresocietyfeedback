-- =====================================================================================================
-- Leisure City — migration 001: survey responses, admins, RLS and the save_response RPC.
-- Spec: specs/001-survey/spec.md (RF-37 to RF-40, RF-57 to RF-66). Plan: specs/001-survey/plan.md §6.
--
-- How to apply: paste this whole file into Supabase → SQL Editor → Run (see docs/supabase.md).
-- It is safe to run again: tables use "if not exists", policies are dropped and re-created and
-- functions are "create or replace" (existing rows are kept).
--
-- Migration order: after this file, ALWAYS apply supabase/migrations/002_q3_multiple.sql (Q3 multiple
-- choice). If this file is run again, run 002_q3_multiple.sql right after it: otherwise save_response
-- goes back to accepting only one letter in Q3 and the survey's multi-letter Q3 answers are rejected.
--
-- Security model ("the ID is the secret"):
--   * The public (anon key) has NO privilege on any table. It can only EXECUTE save_response, which
--     creates or updates the single row of the UUID v4 it receives and never returns data (RF-58..RF-60).
--   * Only authenticated users listed in public.admins can read responses (RF-66).
--   * RLS is enabled AND forced on both tables (RF-57).
-- Accepted risks (approved in the spec): whoever knows a participant ID can overwrite that row while it
-- is still in progress; anyone with the public key can create fake rows with valid UUIDs.
-- =====================================================================================================

begin;

-- -----------------------------------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------------------------------

-- One row per participant (RF-37, RF-42). No personal data: no name, email, IP, location or device id
-- (RF-38). No question texts or labels, only option letters and free texts (RF-40).
create table if not exists public.responses (
  id uuid primary key,
  content_version text not null check (char_length(content_version) between 1 and 64),
  country text not null check (country ~ '^([A-Z]{2}|OTHER)$'),
  status text not null check (status in ('in_progress', 'completed')),
  seq bigint not null check (seq > 0),
  q1_option text check (q1_option in ('A', 'B', 'C')),
  q1_text text check (char_length(q1_text) <= 280),
  q2_option text check (q2_option in ('A', 'B', 'C')),
  q2_text text check (char_length(q2_text) <= 280),
  q3_option text check (q3_option in ('A', 'B', 'C')),
  q3_text text check (char_length(q3_text) <= 280),
  q4_option text check (q4_option in ('A', 'B', 'C')),
  q4_text text check (char_length(q4_text) <= 280),
  q5_option text check (q5_option in ('A', 'B', 'C')),
  q5_text text check (char_length(q5_text) <= 280),
  q6_option text check (q6_option in ('A', 'B', 'C')),
  q6_text text check (char_length(q6_text) <= 280),
  q7_option text check (q7_option in ('A', 'B', 'C')),
  q7_text text check (char_length(q7_text) <= 280),
  q8_option text check (q8_option in ('A', 'B', 'C')),
  q8_text text check (char_length(q8_text) <= 280),
  q9_option text check (q9_option in ('A', 'B', 'C')),
  q9_text text check (char_length(q9_text) <= 280),
  q10_option text check (q10_option in ('A', 'B', 'C')),
  q10_text text check (char_length(q10_text) <= 280),
  -- Server clock only (RF-39): set by default on insert and by save_response on update.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.responses is
  'Leisure City survey: one row per participant. Written only through public.save_response; read only by admins.';

-- Closed list of admins (the 4 students). Filled by hand in the SQL Editor (docs/supabase.md, step 4).
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  label text check (label is null or char_length(label) <= 64)
);

comment on table public.admins is
  'Users allowed to read public.responses (spec 002 /admin). Not readable through the API.';

-- -----------------------------------------------------------------------------------------------------
-- Row Level Security: always on, also for the table owner (RF-57)
-- -----------------------------------------------------------------------------------------------------

alter table public.responses enable row level security;
alter table public.responses force row level security;
alter table public.admins enable row level security;
alter table public.admins force row level security;

-- -----------------------------------------------------------------------------------------------------
-- Privileges: Supabase grants ALL on new public tables to anon and authenticated by default.
-- Remove everything, then give back only what the model needs (RF-58).
-- -----------------------------------------------------------------------------------------------------

revoke all on table public.responses from public, anon, authenticated;
revoke all on table public.admins from public, anon, authenticated;

-- Admins read through the API as "authenticated"; the policy below filters to is_admin() (RF-66).
-- Non-admin authenticated users see zero rows (and public sign-up is disabled, RF-67).
grant select on table public.responses to authenticated;

-- -----------------------------------------------------------------------------------------------------
-- is_admin(): true when the caller (JWT) is in public.admins
-- -----------------------------------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

alter function public.is_admin() owner to postgres;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- -----------------------------------------------------------------------------------------------------
-- Policies
-- -----------------------------------------------------------------------------------------------------

-- Admin read (RF-66). There is NO insert, update or delete policy for anon or authenticated (RF-58).
drop policy if exists responses_admin_read on public.responses;
create policy responses_admin_read on public.responses for select to authenticated
  using (public.is_admin());

-- Owner policies: the security definer functions (and the SQL Editor) run as "postgres". Because RLS is
-- FORCED, these keep them working even if that role does not bypass RLS. They grant nothing to the API
-- roles (anon/authenticated never act as postgres) and make the manual cleanup (RNF-11) reliable.
drop policy if exists responses_owner_all on public.responses;
create policy responses_owner_all on public.responses for all to postgres
  using (true) with check (true);

drop policy if exists admins_owner_all on public.admins;
create policy admins_owner_all on public.admins for all to postgres
  using (true) with check (true);

-- -----------------------------------------------------------------------------------------------------
-- save_response: the ONLY way the public writes (RF-59). Arguments match js/lib/payload.js buildPayload:
--   p_id      UUID v4 generated in the browser (the participant's secret)
--   p_version content version (js/content.js CONTENT.version)
--   p_country ISO alpha-2 in upper case, or 'OTHER'
--   p_status  'in_progress' | 'completed'
--   p_seq     send counter, > 0, grows with every send
--   p_answers {"q1": {"option": "A"|"B"|"C", "text": string|null} | null, … "q10": …}
-- Invalid input raises errcode 22023 → PostgREST HTTP 400 → "fatal" in js/lib/sync-queue.js (no retry).
-- Returns nothing, not even about the own row (RF-60).
-- -----------------------------------------------------------------------------------------------------

create or replace function public.save_response(
  p_id text,
  p_version text,
  p_country text,
  p_status text,
  p_seq bigint,
  p_answers jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id     uuid;
  v_opt    text[] := array_fill(null::text, array[10]);
  v_txt    text[] := array_fill(null::text, array[10]);
  v_val    jsonb;
  v_option jsonb;
  v_text   jsonb;
  v_clean  text;
  v_row    public.responses%rowtype;
  v_count  integer;
  i        integer;
begin
  -- ---- Shape validation (RF-61, RF-62). Nothing is written before all of it passes. ----

  -- RF-61: UUID v4 only (same regex as isUuidV4 in js/lib/payload.js).
  if p_id is null
     or p_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'save_response: invalid id' using errcode = '22023';
  end if;
  v_id := p_id::uuid;

  if p_version is null or char_length(p_version) not between 1 and 64 or btrim(p_version) = '' then
    raise exception 'save_response: invalid version' using errcode = '22023';
  end if;

  if p_country is null or p_country !~ '^([A-Z]{2}|OTHER)$' then
    raise exception 'save_response: invalid country' using errcode = '22023';
  end if;

  if p_status is null or p_status not in ('in_progress', 'completed') then
    raise exception 'save_response: invalid status' using errcode = '22023';
  end if;

  if p_seq is null or p_seq <= 0 then
    raise exception 'save_response: invalid seq' using errcode = '22023';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'save_response: answers must be an object' using errcode = '22023';
  end if;

  -- Only questions 1 to 10 exist (a missing key counts as "not answered").
  if exists (select 1 from jsonb_object_keys(p_answers) as k(key) where k.key !~ '^q([1-9]|10)$') then
    raise exception 'save_response: unknown question' using errcode = '22023';
  end if;

  for i in 1..10 loop
    v_val := p_answers -> ('q' || i);
    if v_val is null or jsonb_typeof(v_val) = 'null' then
      continue;
    end if;

    if jsonb_typeof(v_val) <> 'object'
       or exists (select 1 from jsonb_object_keys(v_val) as k(key) where k.key not in ('option', 'text')) then
      raise exception 'save_response: invalid answer' using errcode = '22023';
    end if;

    v_option := v_val -> 'option';
    if v_option is null or jsonb_typeof(v_option) <> 'string' or (v_option #>> '{}') not in ('A', 'B', 'C') then
      raise exception 'save_response: invalid option' using errcode = '22023';
    end if;
    v_opt[i] := v_option #>> '{}';

    v_text := v_val -> 'text';
    if v_text is null or jsonb_typeof(v_text) = 'null' then
      v_txt[i] := null;
    elsif jsonb_typeof(v_text) <> 'string' then
      raise exception 'save_response: invalid text' using errcode = '22023';
    else
      -- Trimmed, length in code points like js/lib/text.js textLength; empty → null (RF-28).
      v_clean := regexp_replace(v_text #>> '{}', '^\s+|\s+$', '', 'g');
      if char_length(v_clean) > 280 then
        raise exception 'save_response: text too long' using errcode = '22023';
      end if;
      v_txt[i] := nullif(v_clean, '');
    end if;
  end loop;

  -- ---- Write: one row per ID (RF-42) ----

  select * into v_row from public.responses where id = v_id for update;

  if not found then
    insert into public.responses (
      id, content_version, country, status, seq,
      q1_option, q1_text, q2_option, q2_text, q3_option, q3_text, q4_option, q4_text, q5_option, q5_text,
      q6_option, q6_text, q7_option, q7_text, q8_option, q8_text, q9_option, q9_text, q10_option, q10_text
    ) values (
      v_id, p_version, p_country, p_status, p_seq,
      v_opt[1], v_txt[1], v_opt[2], v_txt[2], v_opt[3], v_txt[3], v_opt[4], v_txt[4], v_opt[5], v_txt[5],
      v_opt[6], v_txt[6], v_opt[7], v_txt[7], v_opt[8], v_txt[8], v_opt[9], v_txt[9], v_opt[10], v_txt[10]
    )
    on conflict (id) do nothing;

    get diagnostics v_count = row_count;
    if v_count = 1 then
      return;  -- created_at / updated_at = now() by default (RF-39)
    end if;

    -- Another tab inserted the same ID at the same time: continue as an update of that row.
    select * into v_row from public.responses where id = v_id for update;
  end if;

  -- RF-63 (and the "old counter" half of RF-65): old or repeated sends are ignored without error.
  if p_seq <= v_row.seq then return; end if;

  -- RF-65: a completed row never changes again (never back to in_progress either).
  if v_row.status = 'completed' then
    raise exception 'save_response: response already completed' using errcode = '22023';
  end if;

  -- RF-64: country and content version are fixed when the row is created.
  if v_row.country <> p_country or v_row.content_version <> p_version then
    raise exception 'save_response: country or version cannot change' using errcode = '22023';
  end if;

  update public.responses set
    status = p_status,
    seq = p_seq,
    q1_option = v_opt[1], q1_text = v_txt[1],
    q2_option = v_opt[2], q2_text = v_txt[2],
    q3_option = v_opt[3], q3_text = v_txt[3],
    q4_option = v_opt[4], q4_text = v_txt[4],
    q5_option = v_opt[5], q5_text = v_txt[5],
    q6_option = v_opt[6], q6_text = v_txt[6],
    q7_option = v_opt[7], q7_text = v_txt[7],
    q8_option = v_opt[8], q8_text = v_txt[8],
    q9_option = v_opt[9], q9_text = v_txt[9],
    q10_option = v_opt[10], q10_text = v_txt[10],
    updated_at = now()  -- server clock (RF-39)
  where id = v_id;
end;
$$;

alter function public.save_response(text, text, text, text, bigint, jsonb) owner to postgres;
revoke all on function public.save_response(text, text, text, text, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.save_response(text, text, text, text, bigint, jsonb) to anon, authenticated;

commit;

-- Ask the API (PostgREST) to see the new function and permissions right away.
notify pgrst, 'reload schema';
