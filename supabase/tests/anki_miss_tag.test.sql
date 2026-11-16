-- M3.4: a miss queues #Rounds::missed for the student's Anki. Run with `pnpm db:test`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'student-a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'student-b@test.local');

insert into public.illness_scripts (id, status, reviewed_by, reviewed_at, content) values
  ('pgtap-linked', 'approved', 'TEST', now(), jsonb_build_object(
    'name', 'Zorblax syndrome',
    'anki_refs', jsonb_build_array(
      jsonb_build_object('kind', 'note', 'id', '1001'),
      jsonb_build_object('kind', 'note', 'id', '2001', 'rung', 'management')
    ))),
  ('pgtap-unlinked', 'approved', 'TEST', now(), '{"name": "Quibble fever", "anki_refs": []}');

-- Student A has Anki connected; student B doesn't.
insert into public.anki_pairings (user_id, token_hash, claimed_at) values
  ('11111111-1111-1111-1111-111111111111', repeat('a', 64), now());

insert into public.ladder_sessions (id, user_id, script_id, script_version, kind, partner_script_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'pgtap-linked', 1, 'ladder', null),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'pgtap-linked', 1, 'ladder', null),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'pgtap-linked', 1, 'ladder', null),
  ('aaaaaaaa-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'pgtap-unlinked', 1, 'ladder', null),
  ('aaaaaaaa-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'pgtap-linked', 1, 'drill', 'pgtap-unlinked'),
  ('aaaaaaaa-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'pgtap-linked', 1, 'ladder', null);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

-- Missed on management (score 4): that rung's notes.
select public.finish_ladder_session('aaaaaaaa-0000-0000-0000-000000000001', 'missed', 4::smallint);
select results_eq(
  $$select kind, rung, note_ids from public.anki_actions where script_id = 'pgtap-linked'$$,
  $$values ('tag_missed'::text, 'management'::text, array[2001]::bigint[])$$,
  'A miss on management tags that rung''s notes'
);

-- Missed on recall (score 0): no recall notes, so the core notes.
select public.finish_ladder_session('aaaaaaaa-0000-0000-0000-000000000002', 'missed', 0::smallint);
select results_eq(
  $$select rung, note_ids from public.anki_actions
     where script_id = 'pgtap-linked' and rung is null$$,
  $$values (null::text, array[1001]::bigint[])$$,
  'A miss on a rung without notes tags the core notes'
);

select public.finish_ladder_session('aaaaaaaa-0000-0000-0000-000000000003', 'completed', 6::smallint);
select is(
  (select count(*)::int from public.anki_actions), 2, 'A clean run tags nothing'
);

select lives_ok(
  $$select public.finish_ladder_session('aaaaaaaa-0000-0000-0000-000000000004', 'missed', 1::smallint)$$,
  'A miss on a script without linked notes still finishes'
);
select is(
  (select count(*)::int from public.anki_actions), 2, 'A script without linked notes tags nothing'
);

select public.finish_ladder_session('aaaaaaaa-0000-0000-0000-000000000005', 'missed', 2::smallint);
select is(
  (select count(*)::int from public.anki_actions), 2, 'A drill miss tags nothing'
);

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select public.finish_ladder_session('aaaaaaaa-0000-0000-0000-000000000006', 'missed', 4::smallint);
reset role;
select is(
  (select count(*)::int from public.anki_actions
    where user_id = '22222222-2222-2222-2222-222222222222'),
  0,
  'Without Anki connected, a miss tags nothing'
);

select * from finish();
rollback;
