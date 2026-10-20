-- =====================================================================================================
-- Leisure City — migration 002: Q3 becomes multiple choice.
-- Spec: specs/001-survey/spec.md (RF-37, RF-62, RF-164, RF-165). Plan: specs/001-survey/plan.md §17.4.
--
-- Order: apply AFTER 001_survey.sql. If 001 is ever run again, run this file again right after it
-- (001 re-creates save_response with the single-letter rule for Q3).
-- How to apply: paste this whole file into Supabase → SQL Editor → Run (docs/supabase.md, §2.1).
--
-- What it does (and nothing else):
--   1) drops the current CHECK rule of q3_option, found in pg_constraint by its definition (its real
--      name is not assumed);
--   2) adds responses_q3_option_multi_check: q3_option is one of A, B, C, AB, AC, BC, ABC (or null);
--   3) re-creates save_response with the same body as 001, except the option rule: Q3 accepts those 7
--      values, every other question exactly one letter A, B or C.
-- Existing rows (one letter in Q3) already satisfy the new rule: no data is converted or changed (RF-165).
-- RLS, policies, table privileges, the other columns and security definer stay exactly as in 001.
--
-- Safe to run again: the second run drops 0 old rules and leaves the same new rule and function.
-- The last statement returns one row: "q3 constraints dropped: N" (1 the first time, 0 when repeated)
-- and the q3_option rules left on the table (only responses_q3_option_multi_check).
-- =====================================================================================================

begin;

-- -----------------------------------------------------------------------------------------------------
-- 1) Drop the current q3_option rule by its definition (whatever its name is).
-- -----------------------------------------------------------------------------------------------------

do $$
declare
  c record;
  n integer := 0;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.responses'::regclass
      and contype = 'c'
      and conname <> 'responses_q3_option_multi_check'
      and pg_get_constraintdef(oid) ilike '%q3_option%'
  loop
    execute format('alter table public.responses drop constraint %I', c.conname);
    n := n + 1;
  end loop;
  raise notice 'q3 constraints dropped: %', n;
  -- Kept for the final select: the SQL Editor shows the last result, not always the notices.
  perform set_config('leisure_city.q3_dropped', n::text, false);
end $$;

-- -----------------------------------------------------------------------------------------------------
-- 2) New rule with its own name (RF-164). Existing one-letter rows already satisfy it (RF-165).
-- -----------------------------------------------------------------------------------------------------

alter table public.responses drop constraint if exists responses_q3_option_multi_check;
alter table public.responses add constraint responses_q3_option_multi_check
  check (q3_option in ('A', 'B', 'C', 'AB', 'AC', 'BC', 'ABC'));

-- -----------------------------------------------------------------------------------------------------
-- 3) save_response: same body, owner and privileges as in 001; only the option rule changes (RF-62).
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
    -- RF-62/RF-164: Q3 (multiple choice) takes 1 to 3 distinct letters in A, B, C order; the others one letter.
    if v_option is null or jsonb_typeof(v_option) <> 'string'
       or (i = 3 and (v_option #>> '{}') not in ('A', 'B', 'C', 'AB', 'AC', 'BC', 'ABC'))
       or (i <> 3 and (v_option #>> '{}') not in ('A', 'B', 'C')) then
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

-- Ask the API (PostgREST) to see the new function right away.
notify pgrst, 'reload schema';

-- Result shown by the SQL Editor: how many old rules were dropped and which q3_option rules remain.
select
  'q3 constraints dropped: ' || coalesce(current_setting('leisure_city.q3_dropped', true), 'unknown') as result,
  (select string_agg(conname || ' = ' || pg_get_constraintdef(oid), ' | ' order by conname)
     from pg_constraint
    where conrelid = 'public.responses'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%q3_option%') as q3_option_rules;
