-- AuraFarm cloud schema
-- Run this in Supabase → SQL Editor after creating a project.
-- Auth: Email provider enabled. For smooth MVP, turn OFF "Confirm email"
-- in Authentication → Providers → Email.

-- Profiles + game saves (one row per user)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  email text not null,
  display_name text,
  game_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint profiles_username_len check (char_length(username) between 3 and 20),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]+$')
);

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username));

create index if not exists profiles_email_idx on public.profiles (lower(email));

alter table public.profiles enable row level security;

-- Users can only read/write their own profile
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Resolve username → email for login (anon-safe). Enables login with @handle.
create or replace function public.email_for_username(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select email
  from public.profiles
  where lower(username) = lower(trim(p_username))
  limit 1;
$$;

revoke all on function public.email_for_username(text) from public;
grant execute on function public.email_for_username(text) to anon, authenticated;

-- Auto-create profile row on signup (username from raw_user_meta_data)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text;
begin
  uname := lower(trim(coalesce(new.raw_user_meta_data->>'username', '')));
  if uname is null or uname = '' then
    uname := lower(split_part(new.email, '@', 1));
    uname := regexp_replace(uname, '[^a-z0-9_]', '_', 'g');
    if char_length(uname) < 3 then
      uname := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
    end if;
  end if;

  insert into public.profiles (user_id, username, email, display_name, game_state)
  values (
    new.id,
    uname,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', uname),
    '{}'::jsonb
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
