-- Anki bridge: pairing and sync (M3.3).
--
-- The student's Anki add-on pairs with a one-time code shown in Settings → Anki
-- (wireframe 12 note 1) and gets a device token. With that token it uploads
-- review statistics for the cards of linked AnKing notes and applies the
-- actions Rounds queues (unsuspend, tag #Rounds::missed).
--
-- Ids and numbers only: no card text is ever stored here (domain rule 6).
-- Only the anki-pair and anki-sync Edge Functions (service role) write the
-- pairing and the statistics. Codes and tokens are stored as SHA-256 hashes.

-- ─── Pairings ───────────────────────────────────────────────────────────────

create table public.anki_pairings (
  id              uuid primary key default gen_random_uuid(),
  -- One Anki connection per account: pairing again replaces the old one.
  user_id         uuid not null unique references auth.users (id) on delete cascade,
  -- The pending one-time code, cleared once it's claimed.
  code_hash       text check (code_hash ~ '^[0-9a-f]{64}$'),
  code_expires_at timestamptz,
  -- The add-on's device token; null until a code is claimed.
  token_hash      text unique check (token_hash ~ '^[0-9a-f]{64}$'),
  claimed_at      timestamptz,
  last_sync_at    timestamptz,
  created_at      timestamptz not null default now(),
  check ((code_hash is null) = (code_expires_at is null)),
  check ((token_hash is null) = (claimed_at is null))
);

comment on table public.anki_pairings is
  'A student''s Anki connection: a pending one-time code and/or the device token (both hashed).';

create index anki_pairings_code_hash on public.anki_pairings (code_hash) where code_hash is not null;

alter table public.anki_pairings enable row level security;

-- Students see whether they're connected, never the hashes.
revoke all on public.anki_pairings from anon, authenticated;
grant select (id, user_id, code_expires_at, claimed_at, last_sync_at, created_at)
  on public.anki_pairings to authenticated;
grant delete on public.anki_pairings to authenticated;

create policy "Read own Anki pairing"
  on public.anki_pairings for select to authenticated
  using (user_id = auth.uid());

-- Disconnect from the app.
create policy "Delete own Anki pairing"
  on public.anki_pairings for delete to authenticated
  using (user_id = auth.uid());

-- ─── Wrong-code limit ───────────────────────────────────────────────────────

-- Failed claims per caller (hashed IP), so codes can't be guessed in bulk.
create table public.anki_claim_failures (
  id      bigint generated always as identity primary key,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  at      timestamptz not null default now()
);

create index anki_claim_failures_ip_at on public.anki_claim_failures (ip_hash, at);

alter table public.anki_claim_failures enable row level security;
revoke all on public.anki_claim_failures from anon, authenticated;

-- ─── Card statistics ────────────────────────────────────────────────────────

-- The latest upload per card of a linked note. Replaced on every sync.
create table public.anki_card_stats (
  user_id        uuid not null references auth.users (id) on delete cascade,
  card_id        bigint not null check (card_id > 0),
  note_id        bigint not null check (note_id > 0),
  suspended      boolean not null,
  queue          smallint not null check (queue between -3 and 4),
  -- Days until due for review cards; null for new and learning cards.
  due_days       integer,
  interval_days  integer not null check (interval_days >= 0),
  reps           integer not null check (reps >= 0),
  lapses         integer not null check (lapses >= 0),
  last_review_at timestamptz,
  uploaded_at    timestamptz not null default now(),
  primary key (user_id, card_id)
);

comment on table public.anki_card_stats is
  'Review statistics for cards of linked AnKing notes, from the add-on. Ids and numbers only.';

create index anki_card_stats_note on public.anki_card_stats (user_id, note_id);

alter table public.anki_card_stats enable row level security;
revoke all on public.anki_card_stats from anon, authenticated;
grant select on public.anki_card_stats to authenticated;

create policy "Read own Anki card stats"
  on public.anki_card_stats for select to authenticated
  using (user_id = auth.uid());

-- Disconnecting forgets the uploaded statistics.
create function public.anki_pairing_deleted() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.anki_card_stats where user_id = old.user_id;
  return old;
end;
$$;

create trigger anki_pairings_forget_stats
  after delete on public.anki_pairings
  for each row execute function public.anki_pairing_deleted();

-- ─── Actions ────────────────────────────────────────────────────────────────

create table public.anki_actions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind          text not null check (kind in ('unsuspend', 'tag_missed')),
  script_id     text not null references public.illness_scripts (id) on delete cascade,
  -- The missed rung whose notes this names; null means the script's core notes.
  rung          text check (
    rung in ('recall', 'second_order', 'differentiate', 'workup', 'management', 'pearl')
  ),
  note_ids      bigint[] not null check (cardinality(note_ids) between 1 and 10),
  created_at    timestamptz not null default now(),
  applied_at    timestamptz,
  -- How many cards (unsuspend) or notes (tag) the add-on changed.
  applied_count integer check (applied_count >= 0),
  check ((applied_at is null) = (applied_count is null))
);

comment on table public.anki_actions is
  'Changes for the student''s Anki, applied by the add-on on its next sync. Note ids only.';

create index anki_actions_user_pending on public.anki_actions (user_id, created_at)
  where applied_at is null;

alter table public.anki_actions enable row level security;
revoke all on public.anki_actions from anon, authenticated;
grant select on public.anki_actions to authenticated;

create policy "Read own Anki actions"
  on public.anki_actions for select to authenticated
  using (user_id = auth.uid());

-- ─── Linked notes ───────────────────────────────────────────────────────────

-- Every AnKing note linked to a script the student may see (domain rule 2:
-- approved, or in_review where the preview is on). Used by anki-sync, which
-- runs with the service role, and by queue_anki_action.
create function public.anki_linked_notes()
returns table (script_id text, note_id bigint, rung text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, (ref ->> 'id')::bigint, ref ->> 'rung'
  from public.illness_scripts s,
       jsonb_array_elements(coalesce(s.content -> 'anki_refs', '[]'::jsonb)) as ref
  where ref ->> 'kind' = 'note'
    and (
      s.status = 'approved'
      or (
        s.status = 'in_review'
        and coalesce((select value from public.app_settings where key = 'show_in_review'), false)
      )
    );
$$;

revoke execute on function public.anki_linked_notes() from public, anon, authenticated;
grant execute on function public.anki_linked_notes() to service_role;

-- Queue an action for a miss: the missed rung's linked notes, or the script's
-- core notes when that rung has none. The note ids come from the script, so a
-- client can't name arbitrary notes. Returns null when the script has no
-- linked notes. Used by the result screen (M3.4) and `pnpm anki:queue`.
create function public.queue_anki_action(p_script_id text, p_rung text, p_kind text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_notes bigint[];
  v_rung  text := p_rung;
  v_id    uuid;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_kind not in ('unsuspend', 'tag_missed') then
    raise exception 'Unknown Anki action %', p_kind using errcode = '22023';
  end if;

  select array_agg(l.note_id order by l.note_id) into v_notes
  from public.anki_linked_notes() l
  where l.script_id = p_script_id and l.rung = p_rung;

  if v_notes is null then
    v_rung := null;
    select array_agg(l.note_id order by l.note_id) into v_notes
    from public.anki_linked_notes() l
    where l.script_id = p_script_id and l.rung is null;
  end if;

  if v_notes is null then
    return null;
  end if;

  insert into public.anki_actions (user_id, kind, script_id, rung, note_ids)
  values (v_user, p_kind, p_script_id, v_rung, v_notes)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.queue_anki_action(text, text, text) from public, anon;
grant execute on function public.queue_anki_action(text, text, text) to authenticated;

-- ─── Recording a sync ───────────────────────────────────────────────────────

-- One sync from the add-on, in one transaction: replace the student's card
-- statistics, mark the actions it applied, and note the time. anki-sync has
-- already validated p_cards (strict shape) and p_applied.
create function public.anki_record_sync(p_user uuid, p_cards jsonb, p_applied jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.anki_card_stats where user_id = p_user;

  insert into public.anki_card_stats (
    user_id, card_id, note_id, suspended, queue, due_days, interval_days, reps, lapses,
    last_review_at
  )
  select p_user, c.card_id, c.note_id, c.suspended, c.queue, c.due_days, c.interval_days,
         c.reps, c.lapses,
         case when c.last_review_ms is null then null
              else to_timestamp(c.last_review_ms / 1000.0) end
  from jsonb_to_recordset(p_cards) as c (
    card_id bigint, note_id bigint, suspended boolean, queue smallint, due_days integer,
    interval_days integer, reps integer, lapses integer, last_review_ms bigint
  )
  on conflict (user_id, card_id) do nothing;

  update public.anki_actions a
  set applied_at = now(), applied_count = x.count
  from jsonb_to_recordset(p_applied) as x (id uuid, count integer)
  where a.id = x.id and a.user_id = p_user and a.applied_at is null;

  update public.anki_pairings set last_sync_at = now() where user_id = p_user;
end;
$$;

revoke execute on function public.anki_record_sync(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.anki_record_sync(uuid, jsonb, jsonb) to service_role;
