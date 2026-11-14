-- Student profile (M2.3, wireframe 01 onboarding and wireframe 12 settings).
-- One row per student, written by onboarding. No row yet means the student
-- hasn't been through onboarding. Everything here is about the student, never
-- about a patient (domain rule 5).

create table public.profiles (
  user_id             uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  year                text not null check (year in ('MS1', 'MS2', 'MS3', 'MS4')),
  -- Same values as ROTATIONS in @rounds/shared.
  rotation            text not null check (
    rotation in ('IM', 'surgery', 'peds', 'obgyn', 'psych', 'neuro', 'FM', 'EM')
  ),
  -- The Monday of the rotation's first week, and its length, for Home's
  -- "Week 3 of 8". Both null when the student skipped them.
  rotation_started_on date,
  rotation_weeks      smallint check (rotation_weeks between 1 and 52),
  -- Sessions per day that finish rounds (DESIGN.md → Progression).
  daily_goal          smallint not null default 3 check (daily_goal between 1 and 5),
  -- Same values as PERSONAS in @rounds/shared.
  persona             text not null default 'teacher' check (persona in ('teacher', 'internist', 'surgeon')),
  -- Wireframe 12 note 2: overrides the persona's time limit.
  answer_timeout      text not null default 'persona' check (
    answer_timeout in ('persona', '10s', '30s', '60s', 'off')
  ),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check ((rotation_started_on is null) = (rotation_weeks is null))
);

comment on table public.profiles is
  'A student''s own setup: year, rotation and its weeks, daily goal, persona, answer timeout.';

create function public.touch_profile() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_profile();

alter table public.profiles enable row level security;

create policy "Read own profile"
  on public.profiles for select to authenticated
  using (user_id = auth.uid());

create policy "Create own profile"
  on public.profiles for insert to authenticated
  with check (user_id = auth.uid());

create policy "Update own profile"
  on public.profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
