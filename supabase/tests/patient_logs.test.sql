-- RLS and constraint tests for patient_logs. Run with `pnpm db:test`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'student-a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'student-b@test.local');

insert into public.illness_scripts (id, status, reviewed_by, reviewed_at, content) values
  ('pgtap-approved', 'approved', 'TEST', now(), '{"name": "Zorblax syndrome"}'),
  ('pgtap-draft', 'draft', null, null, '{"name": "Draft fever"}');

-- ─── Student A ──────────────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$insert into public.patient_logs (label, script_id, rotation)
    values ('Zorblax syndrome', 'pgtap-approved', 'IM')$$,
  'A student can log a patient with a matching script'
);

select lives_ok(
  $$insert into public.patient_logs (label, rotation) values ('Quellan fever', 'IM')$$,
  'A log with no matching script is still saved'
);

select throws_ok(
  $$insert into public.patient_logs (label, script_id, rotation)
    values ('Draft fever', 'pgtap-draft', 'IM')$$,
  '42501', null,
  'A log cannot point at a script the student cannot see'
);

select throws_ok(
  $$insert into public.patient_logs (label, script_id, rotation)
    values ('Made up', 'no-such-script', 'IM')$$,
  '42501', null,
  'A log cannot point at a script that does not exist'
);

select throws_ok(
  $$insert into public.patient_logs (user_id, label, rotation)
    values ('22222222-2222-2222-2222-222222222222', 'Quellan fever', 'IM')$$,
  '42501', null,
  'A student cannot log as someone else'
);

select throws_ok(
  $$insert into public.patient_logs (label, rotation) values ('   ', 'IM')$$,
  '23514', null,
  'Labels cannot be blank'
);

select throws_ok(
  $$insert into public.patient_logs (label, rotation) values (repeat('x', 81), 'IM')$$,
  '23514', null,
  'Labels are at most 80 characters'
);

select throws_ok(
  $$insert into public.patient_logs (label, rotation) values ('DKA 123456', 'IM')$$,
  '23514', null,
  'Labels cannot hold record-number-like digit runs'
);

select throws_ok(
  $$insert into public.patient_logs (label, rotation) values ('DKA', 'cardiology')$$,
  '23514', null,
  'Rotation must be a known rotation'
);

-- ─── Student B ──────────────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is((select count(*)::int from public.patient_logs), 0, 'B cannot see A''s logs');

delete from public.patient_logs;
reset role;
select is(
  (select count(*)::int from public.patient_logs where user_id = '11111111-1111-1111-1111-111111111111'),
  2,
  'B cannot delete A''s logs'
);

select * from finish();
