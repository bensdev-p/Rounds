-- Anki pairing, card stats and actions (M3.3). Run with `pnpm db:test`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'student-a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'student-b@test.local');

-- Two test scripts: one approved, one in review.
insert into public.illness_scripts (id, status, reviewed_by, reviewed_at, content) values
  ('anki-test-approved', 'approved', 'Test reviewer', now(), jsonb_build_object(
    'anki_refs', jsonb_build_array(
      jsonb_build_object('kind', 'note', 'id', '1001'),
      jsonb_build_object('kind', 'note', 'id', '1002'),
      jsonb_build_object('kind', 'note', 'id', '2001', 'rung', 'management'),
      jsonb_build_object('kind', 'note', 'id', '2002', 'rung', 'management')
    ))),
  ('anki-test-in-review', 'in_review', null, null, jsonb_build_object(
    'anki_refs', jsonb_build_array(jsonb_build_object('kind', 'note', 'id', '3001'))));

insert into public.app_settings (key, value) values ('show_in_review', false)
  on conflict (key) do update set value = false;

-- ─── As the Edge Functions (service role) ───────────────────────────────────

select is(
  (select array_agg(note_id order by note_id) from public.anki_linked_notes()
   where script_id like 'anki-test-%'),
  array[1001, 1002, 2001, 2002]::bigint[],
  'Linked notes come from approved scripts only when the preview is off'
);

update public.app_settings set value = true where key = 'show_in_review';

select is(
  (select count(*)::int from public.anki_linked_notes() where script_id = 'anki-test-in-review'),
  1,
  'In-review scripts are linked when the preview is on'
);

insert into public.anki_pairings (user_id, code_hash, code_expires_at, token_hash, claimed_at) values
  ('11111111-1111-1111-1111-111111111111', null, null, repeat('a', 64), now()),
  ('22222222-2222-2222-2222-222222222222', repeat('c', 64), now() + interval '10 minutes', null, null);

select throws_ok(
  $$insert into public.anki_pairings (user_id, token_hash, claimed_at)
    values ('11111111-1111-1111-1111-111111111111', repeat('b', 64), now())$$,
  '23505', null,
  'One Anki connection per account'
);

select throws_ok(
  $$insert into public.anki_pairings (user_id, code_hash, code_expires_at)
    values ('22222222-2222-2222-2222-222222222222', 'ABCD-1234', now())$$,
  '23514', null,
  'Codes are stored hashed, never as typed'
);

select lives_ok(
  $$select public.anki_record_sync(
      '11111111-1111-1111-1111-111111111111',
      '[{"card_id": 9001, "note_id": 1001, "suspended": true, "queue": -1, "due_days": null,
         "interval_days": 0, "reps": 0, "lapses": 0, "last_review_ms": null},
        {"card_id": 9002, "note_id": 2001, "suspended": false, "queue": 2, "due_days": 4,
         "interval_days": 12, "reps": 7, "lapses": 1, "last_review_ms": 1763200000000}]'::jsonb,
      '[]'::jsonb)$$,
  'A sync records card stats'
);

select is(
  (select count(*)::int from public.anki_card_stats where user_id = '11111111-1111-1111-1111-111111111111'),
  2,
  'Both cards are stored'
);

select isnt(
  (select last_sync_at from public.anki_pairings where user_id = '11111111-1111-1111-1111-111111111111'),
  null,
  'The sync time is noted'
);

select lives_ok(
  $$select public.anki_record_sync(
      '11111111-1111-1111-1111-111111111111',
      '[{"card_id": 9001, "note_id": 1001, "suspended": false, "queue": 0, "due_days": null,
         "interval_days": 0, "reps": 0, "lapses": 0, "last_review_ms": null}]'::jsonb,
      '[]'::jsonb)$$,
  'A second sync runs'
);

select is(
  (select count(*)::int from public.anki_card_stats where user_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'Each sync replaces the last upload'
);

-- ─── Student A ──────────────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select is(
  (select count(*)::int from public.anki_pairings),
  1,
  'A sees only their own pairing'
);

select isnt(
  (select claimed_at from public.anki_pairings),
  null,
  'A can see that Anki is connected'
);

select throws_ok(
  $$select token_hash from public.anki_pairings$$,
  '42501', null,
  'The device token hash is not readable'
);

select throws_ok(
  $$select code_hash from public.anki_pairings$$,
  '42501', null,
  'The code hash is not readable'
);

select throws_ok(
  $$insert into public.anki_pairings (user_id, token_hash, claimed_at)
    values ('11111111-1111-1111-1111-111111111111', repeat('d', 64), now())$$,
  '42501', null,
  'A student cannot create a pairing directly'
);

select throws_ok(
  $$insert into public.anki_card_stats (user_id, card_id, note_id, suspended, queue, interval_days, reps, lapses)
    values ('11111111-1111-1111-1111-111111111111', 1, 1, false, 0, 0, 0, 0)$$,
  '42501', null,
  'A student cannot write card stats directly'
);

select throws_ok(
  $$select public.anki_record_sync('11111111-1111-1111-1111-111111111111', '[]', '[]')$$,
  '42501', null,
  'Only the sync function records a sync'
);

select throws_ok(
  $$insert into public.anki_actions (kind, script_id, note_ids) values ('unsuspend', 'anki-test-approved', '{42}')$$,
  '42501', null,
  'A student cannot queue arbitrary note ids'
);

select public.queue_anki_action('anki-test-approved', 'management', 'unsuspend');
select public.queue_anki_action('anki-test-approved', 'pearl', 'tag_missed');

select is(
  (select note_ids from public.anki_actions where kind = 'unsuspend'),
  array[2001, 2002]::bigint[],
  'A miss on a linked rung queues that rung''s notes'
);

select is(
  (select array[rung, array_to_string(note_ids, ',')] from public.anki_actions where kind = 'tag_missed'),
  array[null, '1001,1002'],
  'A rung with no notes falls back to the core notes'
);

select is(
  public.queue_anki_action('no-such-script', 'recall', 'unsuspend'),
  null,
  'A script with no linked notes queues nothing'
);

select throws_ok(
  $$select public.queue_anki_action('anki-test-approved', 'recall', 'delete_cards')$$,
  '22023', null,
  'Only known actions can be queued'
);

-- ─── Student B ──────────────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is(
  (select count(*)::int from public.anki_card_stats) + (select count(*)::int from public.anki_actions),
  0,
  'B cannot see A''s card stats or actions'
);

delete from public.anki_pairings where user_id = '11111111-1111-1111-1111-111111111111';

-- ─── Disconnect ─────────────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select is(
  (select count(*)::int from public.anki_pairings),
  1,
  'B cannot disconnect A'
);

delete from public.anki_pairings;

select is(
  (select count(*)::int from public.anki_pairings),
  0,
  'A can disconnect'
);

reset role;

select is(
  (select count(*)::int from public.anki_card_stats where user_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'Disconnecting forgets the uploaded stats'
);

select is(
  (select count(*)::int from public.anki_actions where user_id = '11111111-1111-1111-1111-111111111111'),
  2,
  'Disconnecting keeps the action history'
);

select * from finish();
rollback;
