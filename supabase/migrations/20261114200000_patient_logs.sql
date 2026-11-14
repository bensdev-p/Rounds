-- Patient log (M2.1, wireframe 08). A student records a patient they saw by
-- diagnosis label only, with the rotation and when it was logged. Nothing
-- else: no column here may hold patient details (CLAUDE.md domain rule 5).
--
-- A log points at a script when one matches, so Home can offer a session on
-- it. A log with no matching script is still saved (script_id null).

create table public.patient_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The diagnosis label. The app blocks anything that looks like patient
  -- details on every keystroke; this check is a backstop for long digit runs
  -- (record numbers) and keeps labels short.
  label      text not null check (
    length(btrim(label)) between 1 and 80
    and label !~ '\d{6,}'
  ),
  -- Kept when a script is retired or removed: the log is the student's record.
  script_id  text references public.illness_scripts (id) on delete set null,
  -- Same values as ROTATIONS in @rounds/shared.
  rotation   text not null check (
    rotation in ('IM', 'surgery', 'peds', 'obgyn', 'psych', 'neuro', 'FM', 'EM')
  ),
  logged_at  timestamptz not null default now()
);

comment on table public.patient_logs is
  'Patients a student saw, by diagnosis label, rotation and time only. Never patient details.';

create index patient_logs_user_logged_idx on public.patient_logs (user_id, logged_at desc);

alter table public.patient_logs enable row level security;

create policy "Read own logs"
  on public.patient_logs for select to authenticated
  using (user_id = auth.uid());

-- A matching script must be one the student can see (RLS on the subquery).
create policy "Create own logs"
  on public.patient_logs for insert to authenticated
  with check (
    user_id = auth.uid()
    and (script_id is null or script_id in (select id from public.illness_scripts))
  );

create policy "Delete own logs"
  on public.patient_logs for delete to authenticated
  using (user_id = auth.uid());
