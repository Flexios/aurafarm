-- AuraFarm friend system
-- Run after schema.sql and profiles_public.sql

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_no_self check (requester_id <> addressee_id),
  constraint friendships_unique_pair unique (requester_id, addressee_id)
);

create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);
create index if not exists friendships_status_idx on public.friendships (status);

alter table public.friendships enable row level security;

drop policy if exists "friendships_select_involved" on public.friendships;
create policy "friendships_select_involved"
  on public.friendships for select
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "friendships_insert_requester" on public.friendships;
create policy "friendships_insert_requester"
  on public.friendships for insert
  to authenticated
  with check (auth.uid() = requester_id);

drop policy if exists "friendships_update_involved" on public.friendships;
create policy "friendships_update_involved"
  on public.friendships for update
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id)
  with check (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "friendships_delete_involved" on public.friendships;
create policy "friendships_delete_involved"
  on public.friendships for delete
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Send friend request by username
create or replace function public.send_friend_request(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  target uuid;
  existing public.friendships%rowtype;
  rev public.friendships%rowtype;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;

  select user_id into target
  from public.profiles
  where lower(username) = lower(trim(p_username))
  limit 1;

  if target is null then
    return jsonb_build_object('ok', false, 'error', 'User not found');
  end if;

  if target = me then
    return jsonb_build_object('ok', false, 'error', 'You cannot friend yourself');
  end if;

  select * into existing
  from public.friendships
  where requester_id = me and addressee_id = target;

  if found then
    if existing.status = 'accepted' then
      return jsonb_build_object('ok', false, 'error', 'Already friends');
    end if;
    if existing.status = 'pending' then
      return jsonb_build_object('ok', false, 'error', 'Request already pending');
    end if;
    -- re-send after decline
    update public.friendships
    set status = 'pending', updated_at = now()
    where id = existing.id;
    return jsonb_build_object('ok', true, 'status', 'pending', 'id', existing.id);
  end if;

  select * into rev
  from public.friendships
  where requester_id = target and addressee_id = me;

  if found then
    if rev.status = 'accepted' then
      return jsonb_build_object('ok', false, 'error', 'Already friends');
    end if;
    if rev.status = 'pending' then
      -- auto-accept reciprocal request
      update public.friendships
      set status = 'accepted', updated_at = now()
      where id = rev.id;
      return jsonb_build_object('ok', true, 'status', 'accepted', 'id', rev.id);
    end if;
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (me, target, 'pending')
  returning id into existing.id;

  return jsonb_build_object('ok', true, 'status', 'pending', 'id', existing.id);
end;
$$;

revoke all on function public.send_friend_request(text) from public;
grant execute on function public.send_friend_request(text) to authenticated;

-- Respond to request
create or replace function public.respond_friend_request(p_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  f public.friendships%rowtype;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;

  select * into f from public.friendships where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Request not found');
  end if;

  if f.addressee_id <> me then
    return jsonb_build_object('ok', false, 'error', 'Not your request to answer');
  end if;

  if f.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'Request is not pending');
  end if;

  if p_accept then
    update public.friendships
    set status = 'accepted', updated_at = now()
    where id = p_id;
    return jsonb_build_object('ok', true, 'status', 'accepted');
  else
    update public.friendships
    set status = 'declined', updated_at = now()
    where id = p_id;
    return jsonb_build_object('ok', true, 'status', 'declined');
  end if;
end;
$$;

revoke all on function public.respond_friend_request(uuid, boolean) from public;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

-- Cancel outgoing pending request
create or replace function public.cancel_friend_request(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  f public.friendships%rowtype;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;

  select * into f from public.friendships where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Request not found');
  end if;

  if f.requester_id <> me or f.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'Cannot cancel this request');
  end if;

  delete from public.friendships where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.cancel_friend_request(uuid) from public;
grant execute on function public.cancel_friend_request(uuid) to authenticated;

-- Remove friend (either side)
create or replace function public.remove_friend(p_user_id uuid)
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

  delete from public.friendships
  where status = 'accepted'
    and (
      (requester_id = me and addressee_id = p_user_id)
      or (requester_id = p_user_id and addressee_id = me)
    );

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Friendship not found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.remove_friend(uuid) from public;
grant execute on function public.remove_friend(uuid) to authenticated;

-- List accepted friends with public fields
create or replace function public.list_friends()
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  total_aura integer,
  core text,
  friends_since timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.user_id,
    p.username,
    coalesce(nullif(trim(p.display_name), ''), p.username) as display_name,
    p.avatar_url,
    coalesce((p.game_state->>'totalAura')::integer, 0) as total_aura,
    coalesce(p.game_state->>'core', 'main-character') as core,
    f.updated_at as friends_since
  from public.friendships f
  join public.profiles p on p.user_id = case
    when f.requester_id = auth.uid() then f.addressee_id
    else f.requester_id
  end
  where f.status = 'accepted'
    and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
  order by lower(p.username);
$$;

revoke all on function public.list_friends() from public;
grant execute on function public.list_friends() to authenticated;

-- Incoming pending requests
create or replace function public.list_incoming_friend_requests()
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  total_aura integer,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    f.id,
    p.user_id,
    p.username,
    coalesce(nullif(trim(p.display_name), ''), p.username) as display_name,
    p.avatar_url,
    coalesce((p.game_state->>'totalAura')::integer, 0) as total_aura,
    f.created_at
  from public.friendships f
  join public.profiles p on p.user_id = f.requester_id
  where f.addressee_id = auth.uid()
    and f.status = 'pending'
  order by f.created_at desc;
$$;

revoke all on function public.list_incoming_friend_requests() from public;
grant execute on function public.list_incoming_friend_requests() to authenticated;

-- Outgoing pending
create or replace function public.list_outgoing_friend_requests()
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  total_aura integer,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    f.id,
    p.user_id,
    p.username,
    coalesce(nullif(trim(p.display_name), ''), p.username) as display_name,
    p.avatar_url,
    coalesce((p.game_state->>'totalAura')::integer, 0) as total_aura,
    f.created_at
  from public.friendships f
  join public.profiles p on p.user_id = f.addressee_id
  where f.requester_id = auth.uid()
    and f.status = 'pending'
  order by f.created_at desc;
$$;

revoke all on function public.list_outgoing_friend_requests() from public;
grant execute on function public.list_outgoing_friend_requests() to authenticated;

-- Status with another user by username
create or replace function public.friendship_status(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  me uuid := auth.uid();
  target uuid;
  f public.friendships%rowtype;
begin
  if me is null then
    return jsonb_build_object('status', 'none');
  end if;

  select user_id into target from public.profiles
  where lower(username) = lower(trim(p_username)) limit 1;

  if target is null then
    return jsonb_build_object('status', 'none');
  end if;

  if target = me then
    return jsonb_build_object('status', 'self');
  end if;

  select * into f from public.friendships
  where (requester_id = me and addressee_id = target)
     or (requester_id = target and addressee_id = me)
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('status', 'none');
  end if;

  if f.status = 'accepted' then
    return jsonb_build_object('status', 'friends', 'id', f.id, 'user_id', target);
  end if;

  if f.status = 'pending' and f.requester_id = me then
    return jsonb_build_object('status', 'outgoing', 'id', f.id, 'user_id', target);
  end if;

  if f.status = 'pending' and f.addressee_id = me then
    return jsonb_build_object('status', 'incoming', 'id', f.id, 'user_id', target);
  end if;

  return jsonb_build_object('status', 'none');
end;
$$;

revoke all on function public.friendship_status(text) from public;
grant execute on function public.friendship_status(text) to authenticated;
