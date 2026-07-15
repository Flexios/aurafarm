-- Server-side rewards for both players when an online duel completes.
-- Run after online_duels.sql. Fixes "only one account got duel credit".

create or replace function public.apply_duel_claim_to_profile(
  p_user_id uuid,
  p_claim_key text,
  p_my_score integer,
  p_their_score integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  gs jsonb;
  claimed jsonb;
  already boolean;
  wins integer;
  losses integer;
  ties integer;
  sparks integer;
  aura integer;
  my_score integer := greatest(0, least(100, coalesce(p_my_score, 0)));
  their_score integer := greatest(0, least(100, coalesce(p_their_score, 0)));
begin
  if p_user_id is null or coalesce(trim(p_claim_key), '') = '' then
    return;
  end if;

  select coalesce(p.game_state, '{}'::jsonb)
  into gs
  from public.profiles p
  where p.user_id = p_user_id
  for update;

  if not found then
    return;
  end if;

  claimed := coalesce(gs->'claimedFriendBattleIds', '[]'::jsonb);
  if jsonb_typeof(claimed) <> 'array' then
    claimed := '[]'::jsonb;
  end if;

  select exists (
    select 1
    from jsonb_array_elements_text(claimed) as t(val)
    where t.val = p_claim_key
  ) into already;

  if already then
    return;
  end if;

  claimed := claimed || to_jsonb(p_claim_key);

  wins := greatest(0, coalesce((gs->>'duelWins')::integer, 0));
  losses := greatest(0, coalesce((gs->>'duelLosses')::integer, 0));
  ties := greatest(0, coalesce((gs->>'duelTies')::integer, 0));
  sparks := greatest(0, coalesce((gs->>'sparks')::integer, 0));
  aura := greatest(0, coalesce((gs->>'totalAura')::integer, 0));

  if my_score > their_score then
    wins := wins + 1;
    sparks := sparks + 25 + (my_score / 5);
    aura := aura + round(my_score * 0.5)::integer;
  elsif my_score < their_score then
    losses := losses + 1;
    sparks := sparks + 8;
    aura := aura + round(my_score * 0.2)::integer;
  else
    ties := ties + 1;
    sparks := sparks + 18;
    aura := aura + round(((my_score + their_score) / 2.0) * 0.2)::integer;
  end if;

  gs := gs
    || jsonb_build_object(
      'claimedFriendBattleIds', claimed,
      'duelWins', wins,
      'duelLosses', losses,
      'duelTies', ties,
      'sparks', sparks,
      'totalAura', aura
    );

  update public.profiles
  set game_state = gs, updated_at = now()
  where user_id = p_user_id;
end;
$$;

revoke all on function public.apply_duel_claim_to_profile(uuid, text, integer, integer) from public;

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
  s1 integer := greatest(0, least(100, coalesce(p_player1_score, 0)));
  s2 integer := greatest(0, least(100, coalesce(p_player2_score, 0)));
  rows_updated integer;
  claim_key text;
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

  -- Already complete: still ensure both profiles have claims (idempotent)
  if d.status = 'complete' and d.player1_score is not null and d.player2_score is not null then
    claim_key := 'online:' || d.id::text;
    perform public.apply_duel_claim_to_profile(d.player1_id, claim_key, d.player1_score, d.player2_score);
    perform public.apply_duel_claim_to_profile(d.player2_id, claim_key, d.player2_score, d.player1_score);
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  update public.online_duels
  set
    player1_score = s1,
    player2_score = s2,
    status = 'complete',
    updated_at = now()
  where id = p_duel_id
    and status = 'open';

  get diagnostics rows_updated = row_count;

  if rows_updated > 0 then
    claim_key := 'online:' || p_duel_id::text;
    perform public.apply_duel_claim_to_profile(d.player1_id, claim_key, s1, s2);
    perform public.apply_duel_claim_to_profile(d.player2_id, claim_key, s2, s1);
  elsif d.status = 'complete' then
    -- race: other client completed first
    select * into d from public.online_duels where id = p_duel_id;
    if d.player1_score is not null and d.player2_score is not null then
      claim_key := 'online:' || d.id::text;
      perform public.apply_duel_claim_to_profile(d.player1_id, claim_key, d.player1_score, d.player2_score);
      perform public.apply_duel_claim_to_profile(d.player2_id, claim_key, d.player2_score, d.player1_score);
    end if;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.complete_online_duel(uuid, integer, integer) to authenticated;

-- One-shot: backfill claims for already-completed online duels that never awarded both players
do $$
declare
  r record;
  claim_key text;
begin
  for r in
    select *
    from public.online_duels
    where status = 'complete'
      and player1_score is not null
      and player2_score is not null
  loop
    claim_key := 'online:' || r.id::text;
    perform public.apply_duel_claim_to_profile(r.player1_id, claim_key, r.player1_score, r.player2_score);
    perform public.apply_duel_claim_to_profile(r.player2_id, claim_key, r.player2_score, r.player1_score);
  end loop;
end;
$$;
