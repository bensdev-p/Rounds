-- RLS and constraint tests for profiles. Run with `pnpm db:test`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'student-a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'student-b@test.local');

-- ─── Student A ──────────────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$insert into public.profiles (year, rotation, rotation_started_on, rotation_weeks)
    values ('MS3', 'IM', '2026-11-02', 8)$$,
  'A student can save their profile'
);

select is(
  (select daily_goal::int from public.profiles),
  3,
  'The daily goal defaults to 3'
);

select throws_ok(
  $$insert into public.profiles (year, rotation) values ('MS3', 'IM')$$,
  '23505', null,
  'One profile per student'
);

select lives_ok(
  $$update public.profiles set daily_goal = 5, persona = 'surgeon', answer_timeout = 'off'$$,
  'A student can update their profile'
);

select throws_ok(
  $$update public.profiles set daily_goal = 6$$,
  '23514', null,
  'The daily goal is 1 to 5'
);

select throws_ok(
  $$update public.profiles set year = 'PGY1'$$,
  '23514', null,
  'Year must be MS1 to MS4'
);

select throws_ok(
  $$update public.profiles set rotation = 'cardiology'$$,
  '23514', null,
  'Rotation must be a known rotation'
);

select throws_ok(
  $$update public.profiles set rotation_weeks = null$$,
  '23514', null,
  'The rotation start and length are set together'
);

select throws_ok(
  $$update public.profiles set answer_timeout = '5s'$$,
  '23514', null,
  'Answer timeout must be a known choice'
);

select throws_ok(
  $$insert into public.profiles (user_id, year, rotation)
    values ('22222222-2222-2222-2222-222222222222', 'MS3', 'IM')$$,
  '42501', null,
  'A student cannot create someone else''s profile'
);

-- ─── Student B ──────────────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is((select count(*)::int from public.profiles), 0, 'B cannot see A''s profile');

update public.profiles set daily_goal = 1;
reset role;
select is(
  (select daily_goal::int from public.profiles where user_id = '11111111-1111-1111-1111-111111111111'),
  5,
  'B cannot change A''s profile'
);

select * from finish();
