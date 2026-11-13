-- Rounds Stage 1: illness scripts, questions, ladder sessions, attempts, progress.
--
-- Shared content (illness_scripts, questions) is read-only to users and only
-- approved content is visible. Writes go through migrations, seeds or the
-- service role. User tables are own-rows-only.
--
-- No table here may hold patient data (CLAUDE.md domain rule 5).

-- ─── Types ──────────────────────────────────────────────────────────────────

create type public.script_status as enum ('draft', 'in_review', 'approved', 'retired');
create type public.ladder_rung as enum (
  'recall', 'second_order', 'differentiate', 'workup', 'management', 'pearl'
);
create type public.ladder_status as enum ('in_progress', 'missed', 'completed');
create type public.grade as enum ('correct', 'partial', 'incorrect');
create type public.persona as enum ('teacher', 'internist', 'surgeon');

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─── Content ────────────────────────────────────────────────────────────────

-- Review metadata are columns so Postgres can enforce them. The clinical
-- content is jsonb, validated by IllnessScriptContentSchema in @rounds/shared.
create table public.illness_scripts (
  id          text primary key
              check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(id) <= 80),
  version     integer not null default 1 check (version > 0),
  status      public.script_status not null default 'draft',
  reviewed_by text check (reviewed_by is null or length(reviewed_by) between 1 and 64),
  reviewed_at timestamptz,
  content     jsonb not null check (jsonb_typeof(content) = 'object'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint illness_scripts_approved_requires_review check (
    status <> 'approved' or (reviewed_by is not null and reviewed_at is not null)
  )
);

create trigger illness_scripts_set_updated_at
  before update on public.illness_scripts
  for each row execute function public.set_updated_at();

-- content holds kind, prompt, source_fields, accepted_answers, required_count.
create table public.questions (
  id             text primary key
                 check (id ~ '^[a-z0-9][a-z0-9._-]*$' and length(id) <= 120),
  script_id      text not null references public.illness_scripts (id) on delete cascade,
  script_version integer not null check (script_version > 0),
  rung           public.ladder_rung not null,
  content        jsonb not null check (jsonb_typeof(content) = 'object'),
  created_at     timestamptz not null default now()
);

create index questions_script_rung_idx on public.questions (script_id, rung);

-- ─── User data ──────────────────────────────────────────────────────────────

create table public.ladder_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  script_id      text not null references public.illness_scripts (id),
  script_version integer not null check (script_version > 0),
  persona        public.persona not null default 'teacher',
  status         public.ladder_status not null default 'in_progress',
  score          smallint not null default 0 check (score between 0 and 6),
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  constraint ladder_sessions_ended_when_done check ((status = 'in_progress') = (ended_at is null))
);

create index ladder_sessions_user_started_idx on public.ladder_sessions (user_id, started_at desc);

create table public.attempts (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.ladder_sessions (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question_id text not null references public.questions (id),
  answer      text not null check (length(answer) <= 500),
  elapsed_ms  integer not null check (elapsed_ms >= 0),
  grade       public.grade not null,
  reason      text not null check (length(reason) <= 200),
  credit      real not null check (credit between 0 and 1),
  passed      boolean not null,
  miss_tag    text check (
    miss_tag is null
    or miss_tag in ('unknown', 'slow', 'partial_list')
    or miss_tag ~ '^confused_with:[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  created_at  timestamptz not null default now(),
  constraint attempts_miss_tag_iff_missed check ((miss_tag is null) = passed),
  -- Backstop for the client-side PHI guard (detectPhi in @rounds/shared):
  -- record-number-length digit runs, SSNs, emails, phone numbers.
  constraint attempts_answer_no_obvious_phi check (
    answer !~ '\d{7,}'
    and answer !~ '\d{3}-\d{2}-\d{4}'
    and answer !~* '[[:alnum:]._%+-]+@[[:alnum:]-]+\.[[:alnum:].-]+'
    and answer !~ '\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}'
  )
);

create index attempts_session_idx on public.attempts (session_id);
create index attempts_user_created_idx on public.attempts (user_id, created_at desc);

create table public.script_progress (
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  script_id      text not null references public.illness_scripts (id) on delete cascade,
  best_rung      smallint not null default 0 check (best_rung between 0 and 6),
  sessions_count integer not null default 0 check (sessions_count >= 0),
  last_played_at timestamptz,
  primary key (user_id, script_id)
);

-- ─── Row Level Security ─────────────────────────────────────────────────────

alter table public.illness_scripts enable row level security;
alter table public.questions       enable row level security;
alter table public.ladder_sessions enable row level security;
alter table public.attempts        enable row level security;
alter table public.script_progress enable row level security;

-- Content: signed-in users (including anonymous sign-ins) read approved content only.
-- No insert/update/delete policies, so users cannot write content.
create policy "Read approved scripts"
  on public.illness_scripts for select to authenticated
  using (status = 'approved');

create policy "Read questions for the current version of approved scripts"
  on public.questions for select to authenticated
  using (
    exists (
      select 1 from public.illness_scripts s
      where s.id = script_id and s.status = 'approved' and s.version = script_version
    )
  );

-- Ladder sessions: own rows only.
create policy "Read own sessions" on public.ladder_sessions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Create own sessions" on public.ladder_sessions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Update own sessions" on public.ladder_sessions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Delete own sessions" on public.ladder_sessions
  for delete to authenticated using (user_id = (select auth.uid()));

-- Attempts: own rows only, attached to one of the user's own sessions. Immutable.
create policy "Read own attempts" on public.attempts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Create own attempts" on public.attempts
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.ladder_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );
create policy "Delete own attempts" on public.attempts
  for delete to authenticated using (user_id = (select auth.uid()));

-- Progress: own rows only.
create policy "Read own progress" on public.script_progress
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Create own progress" on public.script_progress
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Update own progress" on public.script_progress
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Delete own progress" on public.script_progress
  for delete to authenticated using (user_id = (select auth.uid()));
