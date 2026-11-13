-- Closes a ladder session and records the student's best rung on that script
-- in one transaction. The best rung only ever goes up, so concurrent sessions
-- can't lower it.
--
-- security invoker: runs as the calling student, so RLS still applies. A
-- student can only finish their own in-progress session.
--
-- Stage 1 trusts the client's score. Grading and scoring move server-side
-- with the grading Edge Function.

create function public.finish_ladder_session(
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

revoke execute on function public.finish_ladder_session(uuid, public.ladder_status, smallint)
  from public, anon;
grant execute on function public.finish_ladder_session(uuid, public.ladder_status, smallint)
  to authenticated;
