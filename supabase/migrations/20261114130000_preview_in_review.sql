-- Stage 1 preview (decided 2026-11-13): scripts that are `in_review` can be
-- shown in the app, labelled "Not yet reviewed", while a medical review is
-- pending. Off unless the `show_in_review` setting is on; only the local
-- development seed turns it on. Drafts are never visible. Approved scripts
-- are unaffected.

create table public.app_settings (
  key   text primary key check (key in ('show_in_review')),
  value boolean not null
);

comment on table public.app_settings is
  'Deployment switches. show_in_review: students also see in_review scripts (local preview only).';

alter table public.app_settings enable row level security;

-- Readable so the app could show it; no write policies, so students can't change it.
create policy "Read settings" on public.app_settings for select to authenticated using (true);

create function public.show_in_review() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value from public.app_settings where key = 'show_in_review'), false);
$$;

revoke execute on function public.show_in_review() from public, anon;
grant execute on function public.show_in_review() to authenticated;

drop policy "Read approved scripts" on public.illness_scripts;
create policy "Read approved scripts, and in-review ones when previewing"
  on public.illness_scripts for select to authenticated
  using (status = 'approved' or (status = 'in_review' and public.show_in_review()));

drop policy "Read questions for the current version of approved scripts" on public.questions;
create policy "Read questions for the current version of visible scripts"
  on public.questions for select to authenticated
  using (
    exists (
      select 1 from public.illness_scripts s
      where s.id = script_id
        and s.version = script_version
        and (s.status = 'approved' or (s.status = 'in_review' and public.show_in_review()))
    )
  );
