-- RLS tests for question_flags. Run with `pnpm db:test`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'student-a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'student-b@test.local');

insert into public.illness_scripts (id, status, reviewed_by, reviewed_at, content) values
  ('pgtap-approved', 'approved', 'TEST', now(), '{"name": "Zorblax syndrome"}'),
  ('pgtap-other', 'approved', 'TEST', now(), '{"name": "Quellan fever"}'),
  ('pgtap-draft', 'draft', null, null, '{"name": "Draft fever"}');

insert into public.questions (id, script_id, script_version, rung, content) values
  ('pgtap-approved.recall.1', 'pgtap-approved', 1, 'recall', '{"kind": "single"}'),
  ('pgtap-other.recall.1', 'pgtap-other', 1, 'recall', '{"kind": "single"}'),
  ('pgtap-draft.recall.1', 'pgtap-draft', 1, 'recall', '{"kind": "single"}');

-- ─── Student A ──────────────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$insert into public.question_flags (script_id, question_id, script_version, reason, note)
    values ('pgtap-approved', 'pgtap-approved.recall.1', 1, 'marked_wrong', 'My answer was right')$$,
  'A student can flag a question'
);

select lives_ok(
  $$insert into public.question_flags (script_id, script_version, reason)
    values ('pgtap-approved', 1, 'script_error')$$,
  'A student can flag a whole script'
);

select throws_ok(
  $$insert into public.question_flags (script_id, question_id, script_version, reason)
    values ('pgtap-draft', 'pgtap-draft.recall.1', 1, 'unclear')$$,
  '42501', null,
  'Draft content cannot be flagged'
);

select throws_ok(
  $$insert into public.question_flags (script_id, question_id, script_version, reason)
    values ('pgtap-approved', 'pgtap-other.recall.1', 1, 'unclear')$$,
  '42501', null,
  'A flagged question must belong to the flagged script'
);

select throws_ok(
  $$insert into public.question_flags (user_id, script_id, script_version, reason)
    values ('22222222-2222-2222-2222-222222222222', 'pgtap-approved', 1, 'other')$$,
  '42501', null,
  'A student cannot flag as someone else'
);

select throws_ok(
  $$insert into public.question_flags (script_id, script_version, reason, note)
    values ('pgtap-approved', 1, 'other', repeat('x', 281))$$,
  '23514', null,
  'Notes are at most 280 characters'
);

-- ─── Student B ──────────────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is((select count(*)::int from public.question_flags), 0, 'B cannot see A''s flags');

delete from public.question_flags;
reset role;
select is(
  (select count(*)::int from public.question_flags where script_id = 'pgtap-approved'),
  2,
  'Students cannot delete flags'
);

select * from finish();
rollback;
