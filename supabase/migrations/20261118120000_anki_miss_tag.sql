-- Anki in the app (M3.4): misses tag their script's cards #Rounds::missed.
--
-- Same function as before (20261114220000_review_and_drills.sql), plus one
-- step: when a ladder (not a drill) ends on a miss and the student has Anki
-- connected, queue a 'tag_missed' action for the missed rung's linked notes
-- (else the script's core notes) through queue_anki_action. The add-on applies
-- it on its next sync. Done here, not in the app, so the tag never depends on
-- the result screen staying open (domain rule 4: miss tagging is automatic).
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
  -- The ladder's rungs, bottom to top; a miss at score N is on rung N + 1.
  v_rungs constant text[] :=
    array['recall', 'second_order', 'differentiate', 'workup', 'management', 'pearl'];
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

  if p_status = 'missed' and p_score < 6 and exists (
    select 1 from public.anki_pairings
     where user_id = v_session.user_id and claimed_at is not null
  ) then
    -- Returns null (queues nothing) when the script has no linked notes.
    perform public.queue_anki_action(v_session.script_id, v_rungs[p_score + 1], 'tag_missed');
  end if;

  return v_progress;
end;
$$;
