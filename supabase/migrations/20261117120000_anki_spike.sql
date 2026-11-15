-- M3.1 SPIKE ONLY (branch m3.1-anki-spike, never merged).
-- Pairing codes, device tokens, uploaded card stats and pending actions for
-- the Anki add-on spike. Ids and numbers only: no card text (domain rule 6).
-- Only the anki-spike Edge Function (service role) writes these tables.

create table public.anki_spike_pairings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null,
  code_expires_at timestamptz not null,
  token_hash text unique,
  claimed_at timestamptz,
  claim_attempts int not null default 0,
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.anki_spike_pairings enable row level security;
create policy "own pairings readable" on public.anki_spike_pairings
  for select using (auth.uid() = user_id);

create table public.anki_spike_card_stats (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id bigint not null,
  note_id bigint not null,
  note_guid text not null,
  suspended boolean not null,
  queue int not null,
  due_days int,
  interval_days int not null,
  reps int not null,
  lapses int not null,
  last_review_at timestamptz,
  uploaded_at timestamptz not null default now(),
  primary key (user_id, card_id)
);
alter table public.anki_spike_card_stats enable row level security;
create policy "own stats readable" on public.anki_spike_card_stats
  for select using (auth.uid() = user_id);

create table public.anki_spike_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('unsuspend', 'tag_missed')),
  card_ids bigint[] not null,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  applied_count int
);
alter table public.anki_spike_actions enable row level security;
create policy "own actions readable" on public.anki_spike_actions
  for select using (auth.uid() = user_id);
