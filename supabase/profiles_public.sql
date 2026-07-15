-- AuraFarm: public profiles + avatars
-- Run in Supabase SQL Editor on an existing project (after schema.sql).

-- Avatar URL + optional bio
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists bio text;

-- Allow authenticated users to read public profile rows (not for anonymous).
-- Email is still on the row — never select it from the client for other users.
-- Prefer RPCs below for lookup so email is never returned.

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- Keep own insert/update policies from schema.sql

-- Public profile by username (no email)
create or replace function public.get_public_profile(p_username text)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  total_aura integer,
  streak integer,
  duel_wins integer,
  core text,
  best_daily_score integer,
  battle_pass_level integer,
  cores_count integer
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
    p.bio,
    coalesce((p.game_state->>'totalAura')::integer, 0) as total_aura,
    coalesce((p.game_state->>'streak')::integer, 0) as streak,
    coalesce((p.game_state->>'duelWins')::integer, 0) as duel_wins,
    coalesce(p.game_state->>'core', 'main-character') as core,
    coalesce((p.game_state->>'bestDailyScore')::integer, 0) as best_daily_score,
    coalesce((p.game_state->>'battlePassLevel')::integer, 0) as battle_pass_level,
    coalesce(jsonb_array_length(p.game_state->'ownedCores'), 0) as cores_count
  from public.profiles p
  where lower(p.username) = lower(trim(p_username))
  limit 1;
$$;

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to authenticated;

-- Search profiles by username / display name
create or replace function public.search_public_profiles(p_query text)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  total_aura integer,
  core text
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
    coalesce(p.game_state->>'core', 'main-character') as core
  from public.profiles p
  where
    char_length(trim(p_query)) >= 1
    and (
      p.username ilike '%' || trim(p_query) || '%'
      or coalesce(p.display_name, '') ilike '%' || trim(p_query) || '%'
    )
  order by coalesce((p.game_state->>'totalAura')::integer, 0) desc
  limit 20;
$$;

revoke all on function public.search_public_profiles(text) from public;
grant execute on function public.search_public_profiles(text) to authenticated;

-- Storage bucket for avatars (public read)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
