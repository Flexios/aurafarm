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
  updated_at timestamptz
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
    p.updated_at
  from public.profiles p
  order by lower(p.username)
  limit 200;
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
begin
  if not public.is_app_admin() then
    return jsonb_build_object('ok', false, 'error', 'Admin only');
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
    banned = p_banned,
    ban_reason = case when p_banned then left(coalesce(p_reason, ''), 200) else null end,
    updated_at = now()
  where user_id = target;

  return jsonb_build_object('ok', true);
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
  if not public.is_app_admin() then
    return jsonb_build_object('ok', false, 'error', 'Admin only');
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

  delete from public.profiles where user_id = target;
  delete from auth.users where id = target;

  return jsonb_build_object('ok', true);
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
