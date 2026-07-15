-- Online random matchmaking duels
-- Run after schema.sql

-- Who is looking for a random opponent
create table if not exists public.matchmaking_queue (
  user_id uuid primary key references auth.users (id) on delete cascade,
  challenge_title text not null,
  challenge_prompt text not null,
  joined_at timestamptz not null default now()
);

create index if not exists matchmaking_queue_joined_idx
  on public.matchmaking_queue (joined_at);

alter table public.matchmaking_queue enable row level security;

drop policy if exists "matchmaking_queue_own" on public.matchmaking_queue;
create policy "matchmaking_queue_own"
  on public.matchmaking_queue for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Matched random duels (async answers, like friend battles)
create table if not exists public.online_duels (
  id uuid primary key default gen_random_uuid(),
  player1_id uuid not null references auth.users (id) on delete cascade,
  player2_id uuid not null references auth.users (id) on delete cascade,
  challenge_title text not null,
  challenge_prompt text not null,
  player1_answer text,
  player2_answer text,
  player1_score integer,
  player2_score integer,
  status text not null default 'open'
    check (status in ('open', 'complete', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint online_duels_no_self check (player1_id <> player2_id)
);

create index if not exists online_duels_players_idx
  on public.online_duels (player1_id, player2_id, created_at desc);

create index if not exists online_duels_status_idx
  on public.online_duels (status, created_at desc);

alter table public.online_duels enable row level security;

drop policy if exists "online_duels_select" on public.online_duels;
create policy "online_duels_select"
  on public.online_duels for select
  to authenticated
  using (auth.uid() = player1_id or auth.uid() = player2_id);

drop policy if exists "online_duels_update" on public.online_duels;
create policy "online_duels_update"
  on public.online_duels for update
  to authenticated
  using (auth.uid() = player1_id or auth.uid() = player2_id);

-- Leave queue
create or replace function public.cancel_online_queue()
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
  delete from public.matchmaking_queue where user_id = me;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.cancel_online_queue() to authenticated;

-- Find or wait for a random opponent
create or replace function public.find_online_duel(
  p_title text,
  p_prompt text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  opponent uuid;
  existing public.online_duels%rowtype;
  new_id uuid;
  title text := left(coalesce(nullif(trim(p_title), ''), 'Online Duel'), 120);
  prompt text := left(coalesce(nullif(trim(p_prompt), ''), 'Drop your best vibe line.'), 500);
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;

  -- Already in an open duel?
  select * into existing
  from public.online_duels d
  where d.status = 'open'
    and (d.player1_id = me or d.player2_id = me)
  order by d.created_at desc
  limit 1;

  if found then
    delete from public.matchmaking_queue where user_id = me;
    return jsonb_build_object(
      'ok', true,
      'status', 'matched',
      'duel_id', existing.id,
      'player1_id', existing.player1_id,
      'player2_id', existing.player2_id
    );
  end if;

  -- Drop stale queue entries (> 8 minutes)
  delete from public.matchmaking_queue
  where joined_at < now() - interval '8 minutes';

  -- Try to match someone else waiting (FIFO)
  select q.user_id into opponent
  from public.matchmaking_queue q
  where q.user_id <> me
    and not exists (
      select 1 from public.profiles p
      where p.user_id = q.user_id and coalesce(p.banned, false) = true
    )
  order by q.joined_at asc
  limit 1
  for update skip locked;

  if opponent is not null then
    insert into public.online_duels (
      player1_id, player2_id, challenge_title, challenge_prompt, status
    ) values (
      opponent, me, title, prompt, 'open'
    )
    returning id into new_id;

    delete from public.matchmaking_queue where user_id in (me, opponent);

    return jsonb_build_object(
      'ok', true,
      'status', 'matched',
      'duel_id', new_id,
      'player1_id', opponent,
      'player2_id', me
    );
  end if;

  -- Join / refresh queue
  insert into public.matchmaking_queue (user_id, challenge_title, challenge_prompt, joined_at)
  values (me, title, prompt, now())
  on conflict (user_id) do update
    set challenge_title = excluded.challenge_title,
        challenge_prompt = excluded.challenge_prompt,
        joined_at = now();

  return jsonb_build_object('ok', true, 'status', 'searching');
end;
$$;

grant execute on function public.find_online_duel(text, text) to authenticated;

-- Poll my active online duel
create or replace function public.get_my_online_duel()
returns table (
  id uuid,
  player1_id uuid,
  player2_id uuid,
  challenge_title text,
  challenge_prompt text,
  player1_answer text,
  player2_answer text,
  player1_score integer,
  player2_score integer,
  status text,
  created_at timestamptz,
  player1_username text,
  player2_username text,
  searching boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  in_queue boolean;
begin
  if me is null then
    return;
  end if;

  select exists (
    select 1 from public.matchmaking_queue q where q.user_id = me
  ) into in_queue;

  return query
  select
    d.id,
    d.player1_id,
    d.player2_id,
    d.challenge_title,
    d.challenge_prompt,
    d.player1_answer,
    d.player2_answer,
    d.player1_score,
    d.player2_score,
    d.status,
    d.created_at,
    p1.username as player1_username,
    p2.username as player2_username,
    in_queue as searching
  from public.online_duels d
  join public.profiles p1 on p1.user_id = d.player1_id
  join public.profiles p2 on p2.user_id = d.player2_id
  where (d.player1_id = me or d.player2_id = me)
    and (d.status = 'open' or d.created_at > now() - interval '2 days')
  order by d.created_at desc
  limit 20;
end;
$$;

grant execute on function public.get_my_online_duel() to authenticated;

create or replace function public.submit_online_duel_answer(
  p_duel_id uuid,
  p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  d public.online_duels%rowtype;
  ans text := trim(p_answer);
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;
  if char_length(ans) < 3 then
    return jsonb_build_object('ok', false, 'error', 'Answer must be at least 3 characters');
  end if;

  select * into d from public.online_duels where id = p_duel_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Duel not found');
  end if;
  if d.status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'Duel is not open');
  end if;

  if d.player1_id = me then
    if d.player1_answer is not null then
      return jsonb_build_object('ok', false, 'error', 'You already answered');
    end if;
    update public.online_duels
    set player1_answer = left(ans, 400), updated_at = now()
    where id = p_duel_id;
  elsif d.player2_id = me then
    if d.player2_answer is not null then
      return jsonb_build_object('ok', false, 'error', 'You already answered');
    end if;
    update public.online_duels
    set player2_answer = left(ans, 400), updated_at = now()
    where id = p_duel_id;
  else
    return jsonb_build_object('ok', false, 'error', 'Not your duel');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.submit_online_duel_answer(uuid, text) to authenticated;

create or replace function public.complete_online_duel(
  p_duel_id uuid,
  p_player1_score integer,
  p_player2_score integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  d public.online_duels%rowtype;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;

  select * into d from public.online_duels where id = p_duel_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Duel not found');
  end if;
  if me <> d.player1_id and me <> d.player2_id then
    return jsonb_build_object('ok', false, 'error', 'Not your duel');
  end if;
  if d.player1_answer is null or d.player2_answer is null then
    return jsonb_build_object('ok', false, 'error', 'Both players must answer first');
  end if;

  update public.online_duels
  set
    player1_score = greatest(0, least(100, p_player1_score)),
    player2_score = greatest(0, least(100, p_player2_score)),
    status = 'complete',
    updated_at = now()
  where id = p_duel_id
    and status = 'open';

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.complete_online_duel(uuid, integer, integer) to authenticated;

create or replace function public.queue_status()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'ok', true,
    'searching', exists (
      select 1 from public.matchmaking_queue q where q.user_id = auth.uid()
    ),
    'waiting', (
      select count(*)::integer from public.matchmaking_queue
      where joined_at > now() - interval '8 minutes'
    )
  );
$$;

grant execute on function public.queue_status() to authenticated;
