-- finish_ladder_session tests. Run with `pnpm db:test`. Uses its own pgtap-* rows.
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'student-a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'student-b@test.local');

insert into public.illness_scripts (id, status, reviewed_by, reviewed_at, content) values
  ('pgtap-approved', 'approved', 'TEST', now(), '{"name": "Zorblax syndrome"}');

-- ─── Student A ──────────────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

insert into public.ladder_sessions (id, script_id, script_version) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'pgtap-approved', 1),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'pgtap-approved', 1),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'pgtap-approved', 1);

select is(
  (select best_rung from public.finish_ladder_session('aaaaaaaa-0000-0000-0000-000000000001', 'missed', 3::smallint)),
  3::smallint,
  'First finish records the score as best rung'
);

select is(
  (select status::text || ':' || score from public.ladder_sessions where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'missed:3',
  'Finishing sets status and score'
);

select isnt(
  (select ended_at from public.ladder_sessions where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  null,
  'Finishing sets ended_at'
);

select is(
  (select best_rung from public.finish_ladder_session('aaaaaaaa-0000-0000-0000-000000000002', 'missed', 1::smallint)),
  3::smallint,
  'A lower score does not lower the best rung'
);

select is(
  (select best_rung || ':' || sessions_count
     from public.finish_ladder_session('aaaaaaaa-0000-0000-0000-000000000003', 'completed', 6::smallint)),
  '6:3',
  'A higher score raises the best rung and sessions are counted'
);

select throws_ok(
  $$select public.finish_ladder_session('aaaaaaaa-0000-0000-0000-000000000001', 'completed', 6::smallint)$$,
  'P0002', null,
  'A finished session cannot be finished again'
);

insert into public.ladder_sessions (id, script_id, script_version) values
  ('aaaaaaaa-0000-0000-0000-000000000004', 'pgtap-approved', 1);

select throws_ok(
  $$select public.finish_ladder_session('aaaaaaaa-0000-0000-0000-000000000004', 'in_progress', 1::smallint)$$,
  '22023', null,
  'Cannot finish into in_progress'
);

select throws_ok(
  $$select public.finish_ladder_session('aaaaaaaa-0000-0000-0000-000000000004', 'missed', 9::smallint)$$,
  '23514', null,
  'Scores above 6 are rejected'
);

-- ─── Student B ──────────────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select throws_ok(
  $$select public.finish_ladder_session('aaaaaaaa-0000-0000-0000-000000000004', 'missed', 0::smallint)$$,
  'P0002', null,
  'B cannot finish A''s session'
);

-- ─── Signed out ─────────────────────────────────────────────────────────────

set local role anon;
select throws_ok(
  $$select public.finish_ladder_session('aaaaaaaa-0000-0000-0000-000000000004', 'missed', 0::smallint)$$,
  '42501', null,
  'Signed-out users cannot call it'
);

select * from finish();
rollback;
