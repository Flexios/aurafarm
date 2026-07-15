-- Admin tools for @admin only
-- Run after schema.sql / profiles exist

alter table public.profiles
  add column if not exists banned boolean not null default false;

alter table public.profiles
  add column if not exists ban_reason text;

create or replace function public.is_app_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and lower(p.username) = 'admin'
      and coalesce(p.banned, false) = false
  );
$$;

revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated;

-- Own ban status (used at login / restore; no admin required)
create or replace function public.get_own_ban_status()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'banned', coalesce(p.banned, false),
        'reason', p.ban_reason
      )
      from public.profiles p
      where p.user_id = auth.uid()
      limit 1
    ),
    jsonb_build_object('banned', false, 'reason', null)
  );
$$;

revoke all on function public.get_own_ban_status() from public;
grant execute on function public.get_own_ban_status() to authenticated;

drop function if exists public.admin_list_users();

create or replace function public.admin_list_users()
returns table (
  user_id uuid,
  username text,
  display_name text,
  email text,
  banned boolean,
  ban_reason text,
  sparks integer,
  glow integer,
  total_aura integer,
  updated_at timestamptz,
  created_at timestamptz,
  duel_wins integer,
  duel_losses integer,
  duel_ties integer,
  match_wins integer,
  match_losses integer,
  match_ties integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Admin only';
  end if;

  return query
  select
    p.user_id,
    p.username,
    coalesce(nullif(trim(p.display_name), ''), p.username) as display_name,
    p.email,
    coalesce(p.banned, false) as banned,
    p.ban_reason,
    coalesce((p.game_state->>'sparks')::integer, 0) as sparks,
    coalesce((p.game_state->>'glow')::integer, 0) as glow,
    coalesce((p.game_state->>'totalAura')::integer, 0) as total_aura,
    p.updated_at,
    u.created_at,
    coalesce((p.game_state->>'duelWins')::integer, 0) as duel_wins,
    coalesce((p.game_state->>'duelLosses')::integer, 0) as duel_losses,
    coalesce((p.game_state->>'duelTies')::integer, 0) as duel_ties,
    -- Recorded match outcomes from online + friend battles (source of truth for winrate)
    (
      coalesce((
        select count(*)::integer
        from public.online_duels d
        where d.status = 'complete'
          and d.player1_score is not null
          and d.player2_score is not null
          and (
            (d.player1_id = p.user_id and d.player1_score > d.player2_score)
            or (d.player2_id = p.user_id and d.player2_score > d.player1_score)
          )
      ), 0)
      +
      coalesce((
        select count(*)::integer
        from public.friend_battles b
        where b.status = 'complete'
          and b.challenger_score is not null
          and b.opponent_score is not null
          and (
            (b.challenger_id = p.user_id and b.challenger_score > b.opponent_score)
            or (b.opponent_id = p.user_id and b.opponent_score > b.challenger_score)
          )
      ), 0)
    )::integer as match_wins,
    (
      coalesce((
        select count(*)::integer
        from public.online_duels d
        where d.status = 'complete'
          and d.player1_score is not null
          and d.player2_score is not null
          and (
            (d.player1_id = p.user_id and d.player1_score < d.player2_score)
            or (d.player2_id = p.user_id and d.player2_score < d.player1_score)
          )
      ), 0)
      +
      coalesce((
        select count(*)::integer
        from public.friend_battles b
        where b.status = 'complete'
          and b.challenger_score is not null
          and b.opponent_score is not null
          and (
            (b.challenger_id = p.user_id and b.challenger_score < b.opponent_score)
            or (b.opponent_id = p.user_id and b.opponent_score < b.challenger_score)
          )
      ), 0)
    )::integer as match_losses,
    (
      coalesce((
        select count(*)::integer
        from public.online_duels d
        where d.status = 'complete'
          and d.player1_score is not null
          and d.player2_score is not null
          and (d.player1_id = p.user_id or d.player2_id = p.user_id)
          and d.player1_score = d.player2_score
      ), 0)
      +
      coalesce((
        select count(*)::integer
        from public.friend_battles b
        where b.status = 'complete'
          and b.challenger_score is not null
          and b.opponent_score is not null
          and (b.challenger_id = p.user_id or b.opponent_id = p.user_id)
          and b.challenger_score = b.opponent_score
      ), 0)
    )::integer as match_ties
  from public.profiles p
  left join auth.users u on u.id = p.user_id
  order by lower(p.username)
  limit 500;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

create or replace function public.admin_set_ban(
  p_username text,
  p_banned boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
  uname text := lower(trim(p_username));
  rows_updated integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;
  if not public.is_app_admin() then
    return jsonb_build_object('ok', false, 'error', 'Admin only');
  end if;
  if uname = '' then
    return jsonb_build_object('ok', false, 'error', 'Username required');
  end if;
  if uname = 'admin' then
    return jsonb_build_object('ok', false, 'error', 'Cannot ban the admin account');
  end if;

  select p.user_id into target
  from public.profiles p
  where lower(p.username) = uname
  limit 1;

  if target is null then
    return jsonb_build_object('ok', false, 'error', 'User not found');
  end if;

  update public.profiles
  set
    banned = coalesce(p_banned, false),
    ban_reason = case
      when coalesce(p_banned, false) then nullif(left(trim(coalesce(p_reason, '')), 200), '')
      else null
    end,
    updated_at = now()
  where user_id = target;

  get diagnostics rows_updated = row_count;
  if rows_updated < 1 then
    return jsonb_build_object('ok', false, 'error', 'Update failed');
  end if;

  return jsonb_build_object('ok', true, 'username', uname, 'banned', coalesce(p_banned, false));
end;
$$;

revoke all on function public.admin_set_ban(text, boolean, text) from public;
grant execute on function public.admin_set_ban(text, boolean, text) to authenticated;

create or replace function public.admin_delete_user(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
  uname text := lower(trim(p_username));
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;
  if not public.is_app_admin() then
    return jsonb_build_object('ok', false, 'error', 'Admin only');
  end if;
  if uname = '' then
    return jsonb_build_object('ok', false, 'error', 'Username required');
  end if;
  if uname = 'admin' then
    return jsonb_build_object('ok', false, 'error', 'Cannot delete the admin account');
  end if;

  select p.user_id into target
  from public.profiles p
  where lower(p.username) = uname
  limit 1;

  if target is null then
    return jsonb_build_object('ok', false, 'error', 'User not found');
  end if;

  -- Profile + cascades for app tables that reference profiles/auth
  delete from public.profiles where user_id = target;

  -- Remove auth identity (must run as security definer owner with rights on auth)
  begin
    delete from auth.users where id = target;
  exception when others then
    -- Profile already gone; surface auth failure clearly
    return jsonb_build_object(
      'ok', false,
      'error', 'Profile removed but auth user delete failed: ' || SQLERRM
    );
  end;

  if exists (select 1 from auth.users where id = target) then
    return jsonb_build_object('ok', false, 'error', 'Auth user still exists after delete');
  end if;

  return jsonb_build_object('ok', true, 'username', uname);
end;
$$;

revoke all on function public.admin_delete_user(text) from public;
grant execute on function public.admin_delete_user(text) to authenticated;

create or replace function public.admin_adjust_currency(
  p_username text,
  p_sparks_delta integer,
  p_glow_delta integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
  gs jsonb;
  sparks integer;
  glow integer;
  uname text := lower(trim(p_username));
begin
  if not public.is_app_admin() then
    return jsonb_build_object('ok', false, 'error', 'Admin only');
  end if;

  select p.user_id, coalesce(p.game_state, '{}'::jsonb)
  into target, gs
  from public.profiles p
  where lower(p.username) = uname
  limit 1;

  if target is null then
    return jsonb_build_object('ok', false, 'error', 'User not found');
  end if;

  sparks := greatest(0, coalesce((gs->>'sparks')::integer, 0) + coalesce(p_sparks_delta, 0));
  glow := greatest(0, coalesce((gs->>'glow')::integer, 0) + coalesce(p_glow_delta, 0));

  gs := jsonb_set(gs, '{sparks}', to_jsonb(sparks), true);
  gs := jsonb_set(gs, '{glow}', to_jsonb(glow), true);

  update public.profiles
  set game_state = gs, updated_at = now()
  where user_id = target;

  return jsonb_build_object('ok', true, 'sparks', sparks, 'glow', glow);
end;
$$;

revoke all on function public.admin_adjust_currency(text, integer, integer) from public;
grant execute on function public.admin_adjust_currency(text, integer, integer) to authenticated;
