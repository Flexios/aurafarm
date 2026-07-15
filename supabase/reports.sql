-- User reports (online duels / general)
-- Run after online_duels.sql and admin.sql

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reported_id uuid not null references auth.users (id) on delete cascade,
  duel_id uuid references public.online_duels (id) on delete set null,
  reason text not null,
  details text not null default '',
  status text not null default 'open'
    check (status in ('open', 'reviewed', 'dismissed', 'actioned')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_reports_no_self check (reporter_id <> reported_id),
  constraint user_reports_reason_len check (char_length(reason) between 1 and 40),
  constraint user_reports_details_len check (char_length(details) <= 500)
);

create index if not exists user_reports_status_idx
  on public.user_reports (status, created_at desc);

create index if not exists user_reports_reported_idx
  on public.user_reports (reported_id, created_at desc);

-- One open report per reporter/target/duel (null duel = general)
create unique index if not exists user_reports_unique_open
  on public.user_reports (reporter_id, reported_id, coalesce(duel_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'open';

alter table public.user_reports enable row level security;

drop policy if exists "user_reports_select_own" on public.user_reports;
create policy "user_reports_select_own"
  on public.user_reports for select
  to authenticated
  using (auth.uid() = reporter_id);

drop policy if exists "user_reports_insert_own" on public.user_reports;
create policy "user_reports_insert_own"
  on public.user_reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

-- Submit a report (optionally tied to an online duel)
create or replace function public.report_user(
  p_reported_username text,
  p_reason text,
  p_details text default '',
  p_duel_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  target uuid;
  uname text := lower(trim(p_reported_username));
  reason text := lower(trim(coalesce(p_reason, '')));
  details text := left(trim(coalesce(p_details, '')), 500);
  d public.online_duels%rowtype;
  new_id uuid;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;
  if uname = '' then
    return jsonb_build_object('ok', false, 'error', 'Username required');
  end if;
  if reason not in ('spam', 'harassment', 'inappropriate', 'cheating', 'other') then
    return jsonb_build_object('ok', false, 'error', 'Invalid reason');
  end if;

  select p.user_id into target
  from public.profiles p
  where lower(p.username) = uname
  limit 1;

  if target is null then
    return jsonb_build_object('ok', false, 'error', 'User not found');
  end if;
  if target = me then
    return jsonb_build_object('ok', false, 'error', 'You cannot report yourself');
  end if;

  if p_duel_id is not null then
    select * into d from public.online_duels where id = p_duel_id;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'Duel not found');
    end if;
    if me <> d.player1_id and me <> d.player2_id then
      return jsonb_build_object('ok', false, 'error', 'Not your duel');
    end if;
    if target <> d.player1_id and target <> d.player2_id then
      return jsonb_build_object('ok', false, 'error', 'User was not in this duel');
    end if;
  end if;

  begin
    insert into public.user_reports (
      reporter_id, reported_id, duel_id, reason, details, status
    ) values (
      me, target, p_duel_id, reason, details, 'open'
    )
    returning id into new_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'You already reported this');
  end;

  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

grant execute on function public.report_user(text, text, text, uuid) to authenticated;

-- Admin: list reports
create or replace function public.admin_list_reports()
returns table (
  id uuid,
  reporter_id uuid,
  reported_id uuid,
  duel_id uuid,
  reason text,
  details text,
  status text,
  admin_note text,
  created_at timestamptz,
  reporter_username text,
  reported_username text,
  challenge_title text,
  player1_answer text,
  player2_answer text
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
    r.id,
    r.reporter_id,
    r.reported_id,
    r.duel_id,
    r.reason,
    r.details,
    r.status,
    r.admin_note,
    r.created_at,
    rp.username as reporter_username,
    rd.username as reported_username,
    d.challenge_title,
    d.player1_answer,
    d.player2_answer
  from public.user_reports r
  join public.profiles rp on rp.user_id = r.reporter_id
  join public.profiles rd on rd.user_id = r.reported_id
  left join public.online_duels d on d.id = r.duel_id
  order by
    case when r.status = 'open' then 0 else 1 end,
    r.created_at desc
  limit 200;
end;
$$;

grant execute on function public.admin_list_reports() to authenticated;

create or replace function public.admin_resolve_report(
  p_id uuid,
  p_status text,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  st text := lower(trim(coalesce(p_status, '')));
begin
  if not public.is_app_admin() then
    return jsonb_build_object('ok', false, 'error', 'Admin only');
  end if;
  if st not in ('open', 'reviewed', 'dismissed', 'actioned') then
    return jsonb_build_object('ok', false, 'error', 'Invalid status');
  end if;

  update public.user_reports
  set
    status = st,
    admin_note = nullif(left(trim(coalesce(p_admin_note, '')), 300), ''),
    updated_at = now()
  where id = p_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Report not found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_resolve_report(uuid, text, text) to authenticated;
