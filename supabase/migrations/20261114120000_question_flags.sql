-- "This is wrong" flags (docs/PRODUCT.md: each question has a flag that feeds
-- a review queue). A student flags a question, or a whole script, with a
-- reason and an optional short note. Students see and add only their own
-- flags; the review queue is read locally with `pnpm content:flags`.

create type public.flag_reason as enum ('marked_wrong', 'unclear', 'script_error', 'other');

create table public.question_flags (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  script_id      text not null references public.illness_scripts (id) on delete cascade,
  -- Null when the whole script is flagged (from the script page).
  question_id    text references public.questions (id) on delete cascade,
  script_version integer not null check (script_version > 0),
  reason         public.flag_reason not null,
  -- Free text: the app blocks anything that looks like patient details (domain rule 5).
  note           text check (note is null or length(note) between 1 and 280),
  created_at     timestamptz not null default now()
);

comment on table public.question_flags is
  'Student reports that a question or script is wrong. Feeds the content review queue.';

create index question_flags_script_idx on public.question_flags (script_id, created_at desc);

alter table public.question_flags enable row level security;

create policy "Read own flags"
  on public.question_flags for select to authenticated
  using (user_id = auth.uid());

-- Only content the student can see (approved, via RLS on the subqueries), and
-- a question must belong to the flagged script. No update or delete policies.
create policy "Flag visible content"
  on public.question_flags for insert to authenticated
  with check (
    user_id = auth.uid()
    and script_id in (select id from public.illness_scripts)
    and (
      question_id is null
      or question_id in (
        select q.id from public.questions q where q.script_id = question_flags.script_id
      )
    )
  );
