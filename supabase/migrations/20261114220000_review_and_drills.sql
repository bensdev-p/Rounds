-- M2.2 Review.
--
-- 1. attempts.matched: the accepted answers an attempt hit, so Review can say
--    which list items were left out ("Missed uremia, salicylates") without
--    grading the answer again.
-- 2. ladder_sessions.kind: 'ladder' (the pimp ladder) or 'drill' (the mix-up
--    drill: both scripts' "Tell it apart" questions, taking turns). A drill
--    names the second script in partner_script_id. Drills never change the
--    best rung or the session count; progression reads ladders only.

alter table public.attempts
  add column matched text[] not null default '{}'
    check (cardinality(matched) <= 20);

comment on column public.attempts.matched is
  'Canonical accepted answers the attempt hit (list questions: the items named).';

create type public.session_kind as enum ('ladder', 'drill');

alter table public.ladder_sessions
  add column kind public.session_kind not null default 'ladder',
  add column partner_script_id text references public.illness_scripts (id),
  add constraint ladder_sessions_drill_has_partner check (
    (kind = 'drill') = (partner_script_id is not null)
    and partner_script_id is distinct from script_id
  );

comment on column public.ladder_sessions.partner_script_id is
  'Drills only: the other script of the pair.';

-- Same function as before, except a drill only closes the session: it never
-- touches script_progress. It then returns the student's current progress row
-- for the script (best_rung 0 if they have never finished a ladder on it).
create or replace function public.finish_ladder_session(
  p_session_id uuid,
  p_status public.ladder_status,
  p_score smallint
) returns public.script_progress
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.ladder_sessions;
  v_progress public.script_progress;
begin
  if p_status = 'in_progress' then
    raise exception 'A finished session cannot be in_progress' using errcode = '22023';
  end if;

  update public.ladder_sessions
     set status = p_status,
         score = p_score,
         ended_at = now()
   where id = p_session_id
     and status = 'in_progress'
  returning * into v_session;

  if not found then
    raise exception 'Session % not found or already finished', p_session_id
      using errcode = 'P0002';
  end if;

  if v_session.kind = 'drill' then
    select * into v_progress
      from public.script_progress
     where user_id = v_session.user_id and script_id = v_session.script_id;
    if not found then
      v_progress := row(v_session.user_id, v_session.script_id, 0, 0, null)::public.script_progress;
    end if;
    return v_progress;
  end if;

  insert into public.script_progress as p
    (user_id, script_id, best_rung, sessions_count, last_played_at)
  values
    (v_session.user_id, v_session.script_id, p_score, 1, v_session.ended_at)
  on conflict (user_id, script_id) do update
    set best_rung = greatest(p.best_rung, excluded.best_rung),
        sessions_count = p.sessions_count + 1,
        last_played_at = excluded.last_played_at
  returning * into v_progress;

  return v_progress;
end;
$$;
