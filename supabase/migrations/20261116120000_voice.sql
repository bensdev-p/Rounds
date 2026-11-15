-- Voice session (M2.5).
--
-- 1. Settings → Voice → Attending voice speed (wireframe 12). Same values as
--    VOICE_SPEEDS in @rounds/shared; Deepgram Aura-2 allows 0.7–1.5.
alter table public.profiles
  add column voice_speed numeric(2, 1) not null default 1.0
  check (voice_speed in (0.8, 1.0, 1.2, 1.4));

comment on column public.profiles.voice_speed is
  'How fast the attending speaks: 0.8, 1.0, 1.2 or 1.4 (Settings → Voice).';

-- 2. Cached question audio, made the first time a question is asked in a
--    voice (the `speak` Edge Function), then reused. Only the functions touch
--    it, with the service role: there are no storage policies for this
--    bucket, so students can't list, read or write it directly. It holds the
--    attending's voice reading approved question text, nothing about a student.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-cache', 'voice-cache', false, 5242880, array['application/octet-stream'])
on conflict (id) do nothing;
