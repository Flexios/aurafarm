-- Streak email reminder columns on profiles
-- Run after schema.sql

alter table public.profiles
  add column if not exists streak_reminder_enabled boolean not null default false;

alter table public.profiles
  add column if not exists streak_reminder_time text not null default '18:00';

alter table public.profiles
  add column if not exists timezone text not null default 'UTC';

alter table public.profiles
  add column if not exists last_streak_reminder_date text;

comment on column public.profiles.streak_reminder_enabled is 'Send daily streak keep-alive email';
comment on column public.profiles.streak_reminder_time is 'Local HH:MM for reminder';
comment on column public.profiles.timezone is 'IANA timezone for local reminder time';
comment on column public.profiles.last_streak_reminder_date is 'Local YYYY-MM-DD last reminder sent';
