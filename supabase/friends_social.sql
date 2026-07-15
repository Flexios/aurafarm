-- Friend notes (private), DMs, and async battles
-- Run after friends.sql

-- Private notes: only owner can read/write
create table if not exists public.friend_notes (
  owner_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (owner_id, friend_id),
  constraint friend_notes_no_self check (owner_id <> friend_id)
);

alter table public.friend_notes enable row level security;

drop policy if exists "friend_notes_own" on public.friend_notes;
create policy "friend_notes_own"
  on public.friend_notes for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Direct messages (friends only enforced in RPCs)
create table if not exists public.friend_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint friend_messages_no_self check (sender_id <> recipient_id),
  constraint friend_messages_body_len check (char_length(body) between 1 and 1000)
);

create index if not exists friend_messages_pair_idx
  on public.friend_messages (sender_id, recipient_id, created_at desc);

alter table public.friend_messages enable row level security;

drop policy if exists "friend_messages_select" on public.friend_messages;
create policy "friend_messages_select"
  on public.friend_messages for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "friend_messages_insert" on public.friend_messages;
create policy "friend_messages_insert"
  on public.friend_messages for insert
  to authenticated
  with check (auth.uid() = sender_id);

-- Battles
create table if not exists public.friend_battles (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references auth.users (id) on delete cascade,
  opponent_id uuid not null references auth.users (id) on delete cascade,
  challenge_title text not null,
  challenge_prompt text not null,
  challenger_answer text,
  opponent_answer text,
  challenger_score integer,
  opponent_score integer,
  status text not null default 'open'
    check (status in ('open', 'complete', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_battles_no_self check (challenger_id <> opponent_id)
);

create index if not exists friend_battles_players_idx
  on public.friend_battles (challenger_id, opponent_id, created_at desc);

alter table public.friend_battles enable row level security;

drop policy if exists "friend_battles_select" on public.friend_battles;
create policy "friend_battles_select"
  on public.friend_battles for select
  to authenticated
  using (auth.uid() = challenger_id or auth.uid() = opponent_id);

drop policy if exists "friend_battles_insert" on public.friend_battles;
create policy "friend_battles_insert"
  on public.friend_battles for insert
  to authenticated
  with check (auth.uid() = challenger_id);

drop policy if exists "friend_battles_update" on public.friend_battles;
create policy "friend_battles_update"
  on public.friend_battles for update
  to authenticated
  using (auth.uid() = challenger_id or auth.uid() = opponent_id);

-- Helpers: are we friends?
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a)
      )
  );
$$;

-- Notes
create or replace function public.upsert_friend_note(p_friend_id uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;
  if not public.are_friends(me, p_friend_id) then
    return jsonb_build_object('ok', false, 'error', 'You can only note friends');
  end if;
  insert into public.friend_notes (owner_id, friend_id, note, updated_at)
  values (me, p_friend_id, left(coalesce(p_note, ''), 500), now())
  on conflict (owner_id, friend_id)
  do update set note = excluded.note, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.upsert_friend_note(uuid, text) to authenticated;

create or replace function public.get_friend_note(p_friend_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select note from public.friend_notes
  where owner_id = auth.uid() and friend_id = p_friend_id
  limit 1;
$$;

grant execute on function public.get_friend_note(uuid) to authenticated;

-- DMs
create or replace function public.send_friend_dm(p_recipient_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  cleaned text := trim(p_body);
  new_id uuid;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;
  if not public.are_friends(me, p_recipient_id) then
    return jsonb_build_object('ok', false, 'error', 'You can only message friends');
  end if;
  if char_length(cleaned) < 1 then
    return jsonb_build_object('ok', false, 'error', 'Message is empty');
  end if;
  insert into public.friend_messages (sender_id, recipient_id, body)
  values (me, p_recipient_id, left(cleaned, 1000))
  returning id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

grant execute on function public.send_friend_dm(uuid, text) to authenticated;

create or replace function public.list_friend_dms(p_friend_id uuid)
returns table (
  id uuid,
  sender_id uuid,
  body text,
  created_at timestamptz,
  mine boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    m.id,
    m.sender_id,
    m.body,
    m.created_at,
    (m.sender_id = auth.uid()) as mine
  from public.friend_messages m
  where public.are_friends(auth.uid(), p_friend_id)
    and (
      (m.sender_id = auth.uid() and m.recipient_id = p_friend_id)
      or (m.sender_id = p_friend_id and m.recipient_id = auth.uid())
    )
  order by m.created_at asc
  limit 200;
$$;

grant execute on function public.list_friend_dms(uuid) to authenticated;

-- Battles
create or replace function public.create_friend_battle(
  p_opponent_id uuid,
  p_title text,
  p_prompt text,
  p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
  ans text := trim(p_answer);
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;
  if not public.are_friends(me, p_opponent_id) then
    return jsonb_build_object('ok', false, 'error', 'You can only battle friends');
  end if;
  if char_length(ans) < 3 then
    return jsonb_build_object('ok', false, 'error', 'Answer must be at least 3 characters');
  end if;
  insert into public.friend_battles (
    challenger_id, opponent_id, challenge_title, challenge_prompt, challenger_answer, status
  ) values (
    me, p_opponent_id, left(p_title, 120), left(p_prompt, 500), left(ans, 400), 'open'
  ) returning id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

grant execute on function public.create_friend_battle(uuid, text, text, text) to authenticated;

create or replace function public.submit_friend_battle_answer(p_battle_id uuid, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  b public.friend_battles%rowtype;
  ans text := trim(p_answer);
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;
  select * into b from public.friend_battles where id = p_battle_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Battle not found');
  end if;
  if b.status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'Battle is not open');
  end if;
  if b.opponent_id <> me then
    return jsonb_build_object('ok', false, 'error', 'Only the opponent can submit here');
  end if;
  if char_length(ans) < 3 then
    return jsonb_build_object('ok', false, 'error', 'Answer must be at least 3 characters');
  end if;
  update public.friend_battles
  set opponent_answer = left(ans, 400), updated_at = now()
  where id = p_battle_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.submit_friend_battle_answer(uuid, text) to authenticated;

create or replace function public.complete_friend_battle(
  p_battle_id uuid,
  p_challenger_score integer,
  p_opponent_score integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  b public.friend_battles%rowtype;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;
  select * into b from public.friend_battles where id = p_battle_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Battle not found');
  end if;
  if me <> b.challenger_id and me <> b.opponent_id then
    return jsonb_build_object('ok', false, 'error', 'Not your battle');
  end if;
  if b.challenger_answer is null or b.opponent_answer is null then
    return jsonb_build_object('ok', false, 'error', 'Both players must answer first');
  end if;
  update public.friend_battles
  set
    challenger_score = greatest(0, least(100, p_challenger_score)),
    opponent_score = greatest(0, least(100, p_opponent_score)),
    status = 'complete',
    updated_at = now()
  where id = p_battle_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.complete_friend_battle(uuid, integer, integer) to authenticated;

create or replace function public.list_friend_battles()
returns table (
  id uuid,
  challenger_id uuid,
  opponent_id uuid,
  challenge_title text,
  challenge_prompt text,
  challenger_answer text,
  opponent_answer text,
  challenger_score integer,
  opponent_score integer,
  status text,
  created_at timestamptz,
  challenger_username text,
  opponent_username text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    b.id,
    b.challenger_id,
    b.opponent_id,
    b.challenge_title,
    b.challenge_prompt,
    b.challenger_answer,
    b.opponent_answer,
    b.challenger_score,
    b.opponent_score,
    b.status,
    b.created_at,
    c.username as challenger_username,
    o.username as opponent_username
  from public.friend_battles b
  join public.profiles c on c.user_id = b.challenger_id
  join public.profiles o on o.user_id = b.opponent_id
  where b.challenger_id = auth.uid() or b.opponent_id = auth.uid()
  order by b.created_at desc
  limit 50;
$$;

grant execute on function public.list_friend_battles() to authenticated;
