-- The daily pimp and the tester list (M4.3). Run with `pnpm db:test`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (id, email, email_confirmed_at, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', 'Tester@Test.local', now(), false),
  ('22222222-2222-2222-2222-222222222222', 'student@test.local', now(), false),
  ('33333333-3333-3333-3333-333333333333', 'tester@test.local', null, true);

insert into public.testers (email) values ('tester@test.local');

insert into public.illness_scripts (id, status, reviewed_by, reviewed_at, content) values
  ('pgtap-daily-approved', 'approved', 'TEST', now(),
   '{"name": "Approved", "confused_with": [{"script_id": "pgtap-daily-review"}]}'),
  ('pgtap-daily-review', 'in_review', null, null,
   '{"name": "In review", "confused_with": [{"script_id": "pgtap-daily-approved"}]}'),
  ('pgtap-daily-draft', 'draft', null, null, '{"name": "Draft"}');

insert into public.questions (id, script_id, script_version, rung, content) values
  ('pgtap-daily-approved.recall.1', 'pgtap-daily-approved', 1, 'recall', '{"kind": "single"}'),
  ('pgtap-daily-review.recall.1', 'pgtap-daily-review', 1, 'recall', '{"kind": "single"}'),
  ('pgtap-daily-draft.recall.1', 'pgtap-daily-draft', 1, 'recall', '{"kind": "single"}');

-- Turn the app's preview on, as on rounds-dev: the daily pimp must ignore it.
delete from public.app_settings;
insert into public.app_settings (key, value) values ('show_in_review', true);

create temp view daily_ids as
  select id from public.daily_pool() as id where id like 'pgtap-daily-%';
grant select on daily_ids to anon, authenticated;

-- Signed out
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select results_eq($$select id from daily_ids$$, $$values ('pgtap-daily-approved'::text)$$,
  'Signed out: approved scripts only, even with the preview on');
select is(public.is_tester(), false, 'Signed out: not a tester');
select is(public.daily_content('pgtap-daily-review'), null, 'Signed out: no in-review content');
select throws_ok($$select * from public.testers$$, '42501', null, 'Signed out: cannot read the tester list');

-- Anonymous user, even one whose email field matches the list
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated", "is_anonymous": true}', true);

select is(public.is_tester(), false, 'Anonymous user: never a tester');
select results_eq($$select id from daily_ids$$, $$values ('pgtap-daily-approved'::text)$$,
  'Anonymous user: approved scripts only, even with the preview on');

-- Signed in, not on the list
select set_config('request.jwt.claims',
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is(public.is_tester(), false, 'Not on the list: not a tester');
select results_eq($$select id from daily_ids$$, $$values ('pgtap-daily-approved'::text)$$,
  'Not on the list: approved scripts only');
select is(
  public.daily_content('pgtap-daily-approved') -> 'related', '[]'::jsonb,
  'Not on the list: in-review scripts are not named as related'
);
select throws_ok($$select * from public.testers$$, '42501', null, 'Students cannot read the tester list');
select throws_ok($$insert into public.testers (email) values ('student@test.local')$$, '42501', null,
  'Students cannot add themselves to the tester list');

-- Tester (email matched case-insensitively)
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select is(public.is_tester(), true, 'Tester: is a tester');
select results_eq($$select id from daily_ids$$,
  $$values ('pgtap-daily-approved'::text), ('pgtap-daily-review'::text)$$,
  'Tester: approved and in-review scripts, never drafts');
select is(
  jsonb_path_query_array(public.daily_content('pgtap-daily-review'), '$.questions[*].id'),
  '["pgtap-daily-review.recall.1"]'::jsonb,
  'Tester: in-review content with its questions'
);
select is(public.daily_content('pgtap-daily-draft'), null, 'Tester: drafts are never served');

select * from finish();
rollback;
