-- M2.2: drill sessions and attempts.matched. Run with `pnpm db:test`. Uses its own pgtap-* rows.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'student-a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'student-b@test.local');

insert into public.illness_scripts (id, status, reviewed_by, reviewed_at, content) values
  ('pgtap-one', 'approved', 'TEST', now(), '{"name": "Zorblax syndrome"}'),
  ('pgtap-two', 'approved', 'TEST', now(), '{"name": "Quibble fever"}');

insert into public.questions (id, script_id, script_version, rung, content) values
  ('pgtap-one.differentiate.1', 'pgtap-one', 1, 'differentiate', '{"prompt": "Q?"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

-- ─── Drills ─────────────────────────────────────────────────────────────────

select throws_ok(
  $$insert into public.ladder_sessions (script_id, script_version, kind) values ('pgtap-one', 1, 'drill')$$,
  '23514', null,
  'A drill needs a partner script'
);

select throws_ok(
  $$insert into public.ladder_sessions (script_id, script_version, kind, partner_script_id)
    values ('pgtap-one', 1, 'drill', 'pgtap-one')$$,
  '23514', null,
  'A drill partner is a different script'
);

select throws_ok(
  $$insert into public.ladder_sessions (script_id, script_version, partner_script_id)
    values ('pgtap-one', 1, 'pgtap-two')$$,
  '23514', null,
  'Only drills have a partner'
);

insert into public.ladder_sessions (id, script_id, script_version) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'pgtap-one', 1);
insert into public.ladder_sessions (id, script_id, script_version, kind, partner_script_id) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'pgtap-one', 1, 'drill', 'pgtap-two'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'pgtap-two', 1, 'drill', 'pgtap-one');

select is(
  (select best_rung from public.finish_ladder_session('aaaaaaaa-0000-0000-0000-000000000003', 'completed', 4::smallint)),
  0::smallint,
  'A drill on a never-played script reports best rung 0'
);

select is(
  (select count(*)::int from public.script_progress where script_id = 'pgtap-two'),
  0,
  'A drill creates no progress row'
);

select public.finish_ladder_session('aaaaaaaa-0000-0000-0000-000000000001', 'missed', 2::smallint);

select is(
  (select best_rung || ':' || sessions_count
     from public.finish_ladder_session('aaaaaaaa-0000-0000-0000-000000000002', 'completed', 4::smallint)),
  '2:1',
  'A drill leaves best rung and session count alone'
);

select is(
  (select status::text || ':' || score from public.ladder_sessions where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  'completed:4',
  'A drill is still closed with its status and score'
);

-- ─── attempts.matched ───────────────────────────────────────────────────────

insert into public.attempts
  (session_id, question_id, answer, elapsed_ms, grade, reason, credit, passed, miss_tag, matched)
values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'pgtap-one.differentiate.1', 'zorblax', 900,
   'correct', 'Correct.', 1, true, null, '{Zorblax}');

select is(
  (select matched from public.attempts where session_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  '{Zorblax}'::text[],
  'Attempts store the answers they matched'
);

-- ─── Student B sees none of it ──────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is(
  (select count(*)::int from public.attempts a join public.ladder_sessions s on s.id = a.session_id
    where s.kind = 'drill'),
  0,
  'B cannot see A''s drills or their attempts'
);

select * from finish();
rollback;
