-- Allow users to permanently delete their own account + cascaded data
-- Run after schema.sql

create or replace function public.delete_own_account()
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

  -- Profile + related public data cascade from auth.users FKs where set;
  -- remove profile row explicitly first for safety.
  delete from public.profiles where user_id = me;

  -- Removes auth user; tables with ON DELETE CASCADE follow.
  delete from auth.users where id = me;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
