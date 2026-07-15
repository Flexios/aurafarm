-- Own account stats (registry date, matches, ban status)
-- Run after online_duels.sql, friends_social.sql, admin.sql

create or replace function public.get_own_account_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  me uuid := auth.uid();
  created timestamptz;
  banned boolean := false;
  ban_reason text;
  wins integer := 0;
  losses integer := 0;
  ties integer := 0;
  profile_wins integer := 0;
  profile_losses integer := 0;
  profile_ties integer := 0;
  total_aura integer := 0;
  streak integer := 0;
  username text;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;

  select u.created_at into created
  from auth.users u
  where u.id = me;

  select
    coalesce(p.banned, false),
    p.ban_reason,
    coalesce((p.game_state->>'duelWins')::integer, 0),
    coalesce((p.game_state->>'duelLosses')::integer, 0),
    coalesce((p.game_state->>'duelTies')::integer, 0),
    coalesce((p.game_state->>'totalAura')::integer, 0),
    coalesce((p.game_state->>'streak')::integer, 0),
    p.username
  into banned, ban_reason, profile_wins, profile_losses, profile_ties, total_aura, streak, username
  from public.profiles p
  where p.user_id = me;

  if username is null then
    return jsonb_build_object('ok', false, 'error', 'Profile not found');
  end if;

  -- Match record from online + friend battles
  select
    coalesce(sum(case when outcome = 'win' then 1 else 0 end), 0)::integer,
    coalesce(sum(case when outcome = 'loss' then 1 else 0 end), 0)::integer,
    coalesce(sum(case when outcome = 'tie' then 1 else 0 end), 0)::integer
  into wins, losses, ties
  from (
    select
      case
        when d.player1_id = me and d.player1_score > d.player2_score then 'win'
        when d.player2_id = me and d.player2_score > d.player1_score then 'win'
        when d.player1_id = me and d.player1_score < d.player2_score then 'loss'
        when d.player2_id = me and d.player2_score < d.player1_score then 'loss'
        else 'tie'
      end as outcome
    from public.online_duels d
    where d.status = 'complete'
      and d.player1_score is not null
      and d.player2_score is not null
      and (d.player1_id = me or d.player2_id = me)

    union all

    select
      case
        when b.challenger_id = me and b.challenger_score > b.opponent_score then 'win'
        when b.opponent_id = me and b.opponent_score > b.challenger_score then 'win'
        when b.challenger_id = me and b.challenger_score < b.opponent_score then 'loss'
        when b.opponent_id = me and b.opponent_score < b.challenger_score then 'loss'
        else 'tie'
      end as outcome
    from public.friend_battles b
    where b.status = 'complete'
      and b.challenger_score is not null
      and b.opponent_score is not null
      and (b.challenger_id = me or b.opponent_id = me)
  ) m;

  return jsonb_build_object(
    'ok', true,
    'username', username,
    'created_at', created,
    'banned', banned,
    'ban_reason', ban_reason,
    'match_wins', wins,
    'match_losses', losses,
    'match_ties', ties,
    'matches', wins + losses + ties,
    'duel_wins', profile_wins,
    'duel_losses', profile_losses,
    'duel_ties', profile_ties,
    'total_aura', total_aura,
    'streak', streak,
    'win_rate', case
      when (wins + losses + ties) = 0 then null
      else round((wins::numeric / (wins + losses + ties)::numeric) * 100)
    end
  );
end;
$$;

revoke all on function public.get_own_account_stats() from public;
grant execute on function public.get_own_account_stats() to authenticated;
