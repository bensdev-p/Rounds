-- The in-review preview switch. Run with `pnpm db:test`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'student-a@test.local');

insert into public.illness_scripts (id, status, reviewed_by, reviewed_at, content) values
  ('pgtap-approved', 'approved', 'TEST', now(), '{"name": "Approved"}'),
  ('pgtap-review', 'in_review', null, null, '{"name": "In review"}'),
  ('pgtap-draft', 'draft', null, null, '{"name": "Draft"}');

insert into public.questions (id, script_id, script_version, rung, content) values
  ('pgtap-review.recall.1', 'pgtap-review', 1, 'recall', '{"kind": "single"}'),
  ('pgtap-draft.recall.1', 'pgtap-draft', 1, 'recall', '{"kind": "single"}');

-- Start from "off", whatever the local seed set.
delete from public.app_settings;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select results_eq(
  $$select id from public.illness_scripts where id like 'pgtap-%' order by id$$,
  $$values ('pgtap-approved'::text)$$,
  'With the switch off, students see approved scripts only'
);

select throws_ok(
  $$insert into public.app_settings (key, value) values ('show_in_review', true)$$,
  '42501', null,
  'Students cannot turn the preview on'
);

reset role;
insert into public.app_settings (key, value) values ('show_in_review', true);
set local role authenticated;

select results_eq(
  $$select id from public.illness_scripts where id like 'pgtap-%' order by id$$,
  $$values ('pgtap-approved'::text), ('pgtap-review'::text)$$,
  'With the switch on, in-review scripts are visible too'
);

select results_eq(
  $$select id from public.questions where id like 'pgtap-%'$$,
  $$values ('pgtap-review.recall.1'::text)$$,
  'In-review questions are visible; draft questions never are'
);

select lives_ok(
  $$insert into public.question_flags (script_id, question_id, script_version, reason)
    values ('pgtap-review', 'pgtap-review.recall.1', 1, 'unclear')$$,
  'In-review questions can be flagged'
);

select is(
  (select count(*)::int from public.illness_scripts where id = 'pgtap-draft'),
  0,
  'Drafts stay hidden with the switch on'
);

set local role anon;
select is((select count(*)::int from public.illness_scripts), 0, 'Signed-out users still see nothing');

select * from finish();
rollback;
