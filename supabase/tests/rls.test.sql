-- Row Level Security tests. Run with `pnpm db:test` (supabase test db).
-- Uses its own pgtap-* rows so it doesn't depend on seed.sql.
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

-- ─── Structure ──────────────────────────────────────────────────────────────

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'RLS is enabled on every public table'
);

-- ─── Fixtures (as the migration owner) ──────────────────────────────────────

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'student-a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'student-b@test.local');

insert into public.illness_scripts (id, status, reviewed_by, reviewed_at, content) values
  ('pgtap-approved', 'approved', 'TEST', now(), '{"name": "Zorblax syndrome"}'),
  ('pgtap-draft', 'draft', null, null, '{"name": "Quellan fever"}');

insert into public.questions (id, script_id, script_version, rung, content) values
  ('pgtap-approved.recall.1', 'pgtap-approved', 1, 'recall', '{"kind": "single"}'),
  ('pgtap-approved.recall.old', 'pgtap-approved', 2, 'recall', '{"kind": "single"}'),
  ('pgtap-draft.recall.1', 'pgtap-draft', 1, 'recall', '{"kind": "single"}');

select throws_ok(
  $$insert into public.illness_scripts (id, status, content) values ('unreviewed', 'approved', '{}')$$,
  '23514', null,
  'Approved scripts must record a reviewer'
);

-- ─── Student A ──────────────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select results_eq(
  $$select id from public.illness_scripts where id like 'pgtap-%'$$,
  $$values ('pgtap-approved'::text)$$,
  'Students see approved scripts only'
);

select results_eq(
  $$select id from public.questions where id like 'pgtap-%'$$,
  $$values ('pgtap-approved.recall.1'::text)$$,
  'Students see questions for the current version of approved scripts only'
);

select throws_ok(
  $$insert into public.illness_scripts (id, content) values ('sneaky', '{}')$$,
  '42501', null,
  'Students cannot create scripts'
);

update public.illness_scripts set status = 'retired' where id = 'pgtap-approved';
select is(
  (select status::text from public.illness_scripts where id = 'pgtap-approved'),
  'approved',
  'Students cannot update scripts'
);

insert into public.ladder_sessions (script_id, script_version) values ('pgtap-approved', 1);
select is(
  (select user_id from public.ladder_sessions),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'Sessions default to the signed-in user'
);
select set_config('test.session_a', (select id::text from public.ladder_sessions), true);

select lives_ok(
  $$insert into public.attempts (session_id, question_id, answer, elapsed_ms, grade, reason, credit, passed)
    values (current_setting('test.session_a')::uuid, 'pgtap-approved.recall.1',
            'BP 120/80, K 6.5', 1200, 'correct', 'Correct.', 1, true)$$,
  'Students can record attempts in their own session'
);

select throws_ok(
  $$insert into public.attempts (session_id, question_id, answer, elapsed_ms, grade, reason, credit, passed)
    values (current_setting('test.session_a')::uuid, 'pgtap-approved.recall.1',
            'MRN 12345678', 1200, 'correct', 'Correct.', 1, true)$$,
  '23514', null,
  'Answers that look like record numbers are rejected'
);

select throws_ok(
  $$insert into public.attempts (session_id, question_id, answer, elapsed_ms, grade, reason, credit, passed, miss_tag)
    values (current_setting('test.session_a')::uuid, 'pgtap-approved.recall.1',
            'x', 1, 'incorrect', 'x', 0, false, 'confused_with:Not A Slug')$$,
  '23514', null,
  'Malformed miss tags are rejected'
);

insert into public.script_progress (script_id, best_rung, sessions_count) values ('pgtap-approved', 2, 1);

-- ─── Student B ──────────────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is((select count(*)::int from public.ladder_sessions), 0, 'B cannot see A''s sessions');
select is((select count(*)::int from public.attempts), 0, 'B cannot see A''s attempts');
select is((select count(*)::int from public.script_progress), 0, 'B cannot see A''s progress');

select throws_ok(
  $$insert into public.ladder_sessions (user_id, script_id, script_version)
    values ('11111111-1111-1111-1111-111111111111', 'pgtap-approved', 1)$$,
  '42501', null,
  'B cannot create a session as A'
);

select throws_ok(
  $$insert into public.attempts (session_id, question_id, answer, elapsed_ms, grade, reason, credit, passed)
    values (current_setting('test.session_a')::uuid, 'pgtap-approved.recall.1',
            'x', 1, 'correct', 'x', 1, true)$$,
  '42501', null,
  'B cannot add attempts to A''s session'
);

delete from public.ladder_sessions;
reset role;
select is(
  (select count(*)::int from public.ladder_sessions where script_id = 'pgtap-approved'),
  1,
  'B cannot delete A''s sessions'
);

-- ─── Signed out ─────────────────────────────────────────────────────────────

set local role anon;
select is((select count(*)::int from public.illness_scripts), 0, 'Signed-out users see no scripts');

select * from finish();
rollback;
