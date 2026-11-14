-- Voice speed and the voice cache bucket (M2.5). Run with `pnpm db:test`.
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'student-a@test.local');

-- As the speak function (service role): one cached clip.
insert into storage.objects (bucket_id, name)
values ('voice-cache', 'deepgram/aura-2-harmonia-en/1.0/test.recall.1-abc.pcm');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

insert into public.profiles (year, rotation) values ('MS3', 'IM');

select is(
  (select voice_speed from public.profiles),
  1.0::numeric,
  'Voice speed defaults to 1.0'
);

select lives_ok(
  $$update public.profiles set voice_speed = 1.4$$,
  'A student can change their voice speed'
);

select throws_ok(
  $$update public.profiles set voice_speed = 1.1$$,
  '23514', null,
  'Voice speed must be one of the choices'
);

select throws_ok(
  $$update public.profiles set voice_speed = 2.0$$,
  '23514', null,
  'Voice speed stays within what the voice allows'
);

select is(
  (select count(*)::int from storage.objects where bucket_id = 'voice-cache'),
  0,
  'Students cannot list or read the voice cache'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('voice-cache', 'mine.pcm')$$,
  '42501', null,
  'Students cannot write to the voice cache'
);

reset role;
select is(
  (select public from storage.buckets where id = 'voice-cache'),
  false,
  'The voice cache bucket is private'
);

select * from finish();
rollback;
