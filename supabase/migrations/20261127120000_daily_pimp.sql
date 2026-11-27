-- M4.3 phase 2: the daily pimp on pimpme.app, and the tester list (pulled
-- forward from M4.4, developer's decision).
--
-- The daily pimp uses approved scripts only. Until one is approved, testers
-- (signed in with an email on the list) also get in-review scripts. This does
-- NOT use `show_in_review`: on rounds-dev that switch is on for every
-- authenticated user, anonymous ones included, and the site is public.
-- The app's existing policies are unchanged (M4.4 owns those).

-- ─── Tester list ────────────────────────────────────────────────────────────

create table public.testers (
  email    text primary key check (email = lower(email) and email like '%@%' and length(email) <= 254),
  added_at timestamptz not null default now()
);

comment on table public.testers is
  'Emails allowed into testing (daily pimp, later the web app). No client access; add rows with SQL (docs/HOSTING.md).';

-- RLS on and no policies: clients can neither read nor write the list.
alter table public.testers enable row level security;
revoke all on public.testers from anon, authenticated;

-- True for a signed-in, non-anonymous user whose confirmed email is on the list.
create function public.is_tester() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.testers t on t.email = lower(u.email)
    where u.id = auth.uid()
      and not u.is_anonymous
      and u.email_confirmed_at is not null
  );
$$;

revoke execute on function public.is_tester() from public;
grant execute on function public.is_tester() to anon, authenticated;

-- ─── Daily pimp ─────────────────────────────────────────────────────────────

-- The scripts the daily pimp may use for the caller, sorted by id: those with
-- questions for their current version. The day's pick is made from this list
-- by pickDailyScript in @rounds/shared.
create function public.daily_pool() returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.illness_scripts s
  where (s.status = 'approved' or (s.status = 'in_review' and public.is_tester()))
    and exists (
      select 1 from public.questions q
      where q.script_id = s.id and q.script_version = s.version
    )
  order by s.id;
$$;

revoke execute on function public.daily_pool() from public;
grant execute on function public.daily_pool() to anon, authenticated;

-- One script from the caller's pool, with its current questions and the names
-- of the related scripts that are also in the pool. Null if not in the pool.
create function public.daily_content(p_script_id text) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with pool as (select public.daily_pool() as id)
  select jsonb_build_object(
    'script', to_jsonb(s),
    'questions', coalesce(
      (select jsonb_agg(to_jsonb(q) order by q.id)
       from public.questions q
       where q.script_id = s.id and q.script_version = s.version),
      '[]'::jsonb
    ),
    'related', coalesce(
      (select jsonb_agg(to_jsonb(r) order by r.id)
       from public.illness_scripts r
       where r.id in (select id from pool)
         and r.id in (select c ->> 'script_id' from jsonb_array_elements(s.content -> 'confused_with') c)),
      '[]'::jsonb
    )
  )
  from public.illness_scripts s
  where s.id = p_script_id
    and s.id in (select id from pool);
$$;

revoke execute on function public.daily_content(text) from public;
grant execute on function public.daily_content(text) to anon, authenticated;
