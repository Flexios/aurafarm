import { BATTLE_PASS, cosmeticById } from "../data/cosmetics";
import type { PlayerState } from "../types";
import { saveState } from "../state/store";
import { todayKey } from "../utils/seed";
import type { ScoreResult } from "../types";

export function applyDailyResult(state: PlayerState, result: ScoreResult, challengeId: string): PlayerState {
  const today = todayKey();
  const isFirstToday = state.lastDailyDate !== today;

  let streak = state.streak;
  if (isFirstToday) {
    if (!state.lastPlayDate) {
      streak = 1;
    } else if (state.lastPlayDate === today) {
      streak = Math.max(1, state.streak);
    } else {
      const last = new Date(state.lastPlayDate + "T12:00:00");
      const now = new Date(today + "T12:00:00");
      const diff = Math.round((now.getTime() - last.getTime()) / 86_400_000);
      streak = diff === 1 ? state.streak + 1 : 1;
    }
  }

  const ownedCores = result.coreDropped
    ? Array.from(new Set([...state.ownedCores, result.coreDropped]))
    : state.ownedCores;

  // Battle pass XP: roughly score/25 levels toward next
  const xpGain = isFirstToday ? Math.max(1, Math.floor(result.score / 28)) : 0;
  const battlePassLevel = Math.min(10, state.battlePassLevel + xpGain);

  const next: PlayerState = {
    ...state,
    totalAura: state.totalAura + result.score,
    sparks: state.sparks + result.sparksEarned,
    streak,
    lastPlayDate: today,
    lastDailyDate: isFirstToday ? today : state.lastDailyDate,
    ownedCores,
    battlePassLevel,
    bestDailyScore: Math.max(state.bestDailyScore, result.score),
    history: [
      { date: today, score: result.score, challengeId },
      ...state.history,
    ].slice(0, 30),
  };
  saveState(next);
  return next;
}

export function applyPracticeResult(state: PlayerState, result: ScoreResult): PlayerState {
  const next: PlayerState = {
    ...state,
    totalAura: state.totalAura + Math.round(result.score * 0.35),
    sparks: state.sparks + Math.max(3, Math.round(result.sparksEarned * 0.4)),
    ownedCores: result.coreDropped
      ? Array.from(new Set([...state.ownedCores, result.coreDropped]))
      : state.ownedCores,
  };
  saveState(next);
  return next;
}

/** Rizz Trainer end rewards — win pays better; partial credit on friendzone. */
export function applyRizzResult(
  state: PlayerState,
  opts: {
    won: boolean;
    friendzone?: boolean;
    interest: number;
    turns: number;
  },
): { state: PlayerState; aura: number; sparks: number } {
  let aura = 0;
  let sparks = 0;
  if (opts.won) {
    aura = 18 + Math.round(opts.interest * 0.35) + Math.max(0, 8 - opts.turns) * 2;
    sparks = 12 + Math.round(opts.interest / 10);
  } else if (opts.friendzone) {
    aura = 8 + Math.round(opts.interest * 0.12);
    sparks = 5;
  } else {
    aura = 3;
    sparks = 2;
  }
  const next: PlayerState = {
    ...state,
    totalAura: state.totalAura + aura,
    sparks: state.sparks + sparks,
  };
  saveState(next);
  return { state: next, aura, sparks };
}

export function buyCosmetic(
  state: PlayerState,
  cosmeticId: string,
  currency: "sparks" | "glow",
): { ok: true; state: PlayerState } | { ok: false; reason: string } {
  const item = cosmeticById(cosmeticId);
  if (!item) return { ok: false, reason: "Item not found." };
  if (state.ownedCosmetics.includes(cosmeticId)) {
    return { ok: false, reason: "Already owned." };
  }

  if (currency === "sparks") {
    if (item.priceSparks <= 0 && item.priceGlow > 0) {
      return { ok: false, reason: "Glow-only item." };
    }
    if (state.sparks < item.priceSparks) return { ok: false, reason: "Not enough Sparks." };
    const next: PlayerState = {
      ...state,
      sparks: state.sparks - item.priceSparks,
      ownedCosmetics: [...state.ownedCosmetics, cosmeticId],
    };
    saveState(next);
    return { ok: true, state: next };
  }

  const cost = item.priceGlow > 0 ? item.priceGlow : Math.ceil(item.priceSparks / 8);
  if (cost <= 0) return { ok: false, reason: "Free item — already unlocked." };
  if (state.glow < cost) return { ok: false, reason: "Not enough Glow." };
  const next: PlayerState = {
    ...state,
    glow: state.glow - cost,
    ownedCosmetics: [...state.ownedCosmetics, cosmeticId],
  };
  saveState(next);
  return { ok: true, state: next };
}

export function equipCosmetic(state: PlayerState, cosmeticId: string): PlayerState {
  const item = cosmeticById(cosmeticId);
  if (!item || !state.ownedCosmetics.includes(cosmeticId)) return state;
  const next: PlayerState = {
    ...state,
    equipped: { ...state.equipped, [item.slot]: cosmeticId },
  };
  saveState(next);
  return next;
}

/** Mock IAP — demo monetization path */
export function buyGlowPack(
  state: PlayerState,
  pack: "starter" | "hype" | "mogul",
): PlayerState {
  const packs = {
    starter: { glow: 40, sparks: 50 },
    hype: { glow: 120, sparks: 150 },
    mogul: { glow: 300, sparks: 400 },
  } as const;
  const p = packs[pack];
  const next: PlayerState = {
    ...state,
    glow: state.glow + p.glow,
    sparks: state.sparks + p.sparks,
  };
  saveState(next);
  return next;
}

export function unlockBattlePassPremium(state: PlayerState): PlayerState {
  if (state.battlePassPremium) return state;
  // Mock purchase — free in demo, or cost 50 glow if they have it, else just unlock
  const next: PlayerState = {
    ...state,
    battlePassPremium: true,
    glow: state.glow >= 50 ? state.glow - 50 : state.glow,
  };
  saveState(next);
  return next;
}

export function claimBattlePassTier(
  state: PlayerState,
  level: number,
  track: "free" | "premium",
): { ok: true; state: PlayerState; label: string } | { ok: false; reason: string } {
  const tier = BATTLE_PASS.find((t) => t.level === level);
  if (!tier) return { ok: false, reason: "Invalid tier." };
  if (state.battlePassLevel < level) return { ok: false, reason: "Level not reached." };

  if (track === "free") {
    if (state.claimedFreeTiers.includes(level)) return { ok: false, reason: "Already claimed." };
    const reward = tier.freeReward;
    let next = applyReward(state, reward);
    next = {
      ...next,
      claimedFreeTiers: [...next.claimedFreeTiers, level],
    };
    saveState(next);
    return { ok: true, state: next, label: reward.label };
  }

  if (!state.battlePassPremium) return { ok: false, reason: "Premium pass required." };
  if (state.claimedPremiumTiers.includes(level)) return { ok: false, reason: "Already claimed." };
  const reward = tier.premiumReward;
  let next = applyReward(state, reward);
  next = {
    ...next,
    claimedPremiumTiers: [...next.claimedPremiumTiers, level],
  };
  saveState(next);
  return { ok: true, state: next, label: reward.label };
}

function applyReward(
  state: PlayerState,
  reward: { type: string; id?: string; amount?: number },
): PlayerState {
  if (reward.type === "sparks") {
    return { ...state, sparks: state.sparks + (reward.amount ?? 0) };
  }
  if (reward.type === "glow") {
    return { ...state, glow: state.glow + (reward.amount ?? 0) };
  }
  if (reward.type === "cosmetic" && reward.id) {
    if (state.ownedCosmetics.includes(reward.id)) return state;
    return { ...state, ownedCosmetics: [...state.ownedCosmetics, reward.id] };
  }
  if (reward.type === "core" && reward.id) {
    if (state.ownedCores.includes(reward.id)) return state;
    return { ...state, ownedCores: [...state.ownedCores, reward.id] };
  }
  return state;
}

export function applyDuelWin(state: PlayerState, score: number): PlayerState {
  const next: PlayerState = {
    ...state,
    duelWins: state.duelWins + 1,
    totalAura: state.totalAura + Math.round(score * 0.5),
    sparks: state.sparks + 25 + Math.floor(score / 5),
  };
  saveState(next);
  return next;
}

export function applyDuelLoss(state: PlayerState, score: number): PlayerState {
  const next: PlayerState = {
    ...state,
    totalAura: state.totalAura + Math.round(score * 0.2),
    sparks: state.sparks + 8,
  };
  saveState(next);
  return next;
}

/**
 * Apply duel progress for a completed friend battle (once per battle id).
 * Wins count toward duelWins; losses/ties still grant light aura/sparks.
 */
export function claimFriendBattleProgress(
  state: PlayerState,
  battleId: string,
  myScore: number,
  theirScore: number,
): { state: PlayerState; claimed: boolean; outcome: "win" | "loss" | "tie" } {
  const outcome: "win" | "loss" | "tie" =
    myScore > theirScore ? "win" : myScore < theirScore ? "loss" : "tie";

  if (state.claimedFriendBattleIds.includes(battleId)) {
    return { state, claimed: false, outcome };
  }

  let next: PlayerState = {
    ...state,
    claimedFriendBattleIds: [...state.claimedFriendBattleIds, battleId].slice(
      -100,
    ),
  };

  if (outcome === "win") {
    next = {
      ...next,
      duelWins: next.duelWins + 1,
      totalAura: next.totalAura + Math.round(myScore * 0.5),
      sparks: next.sparks + 25 + Math.floor(myScore / 5),
    };
  } else if (outcome === "loss") {
    next = {
      ...next,
      duelLosses: (next.duelLosses ?? 0) + 1,
      totalAura: next.totalAura + Math.round(myScore * 0.2),
      sparks: next.sparks + 8,
    };
  } else {
    const mid = Math.round((myScore + theirScore) / 2);
    next = {
      ...next,
      duelTies: (next.duelTies ?? 0) + 1,
      totalAura: next.totalAura + Math.round(mid * 0.2),
      sparks: next.sparks + 18,
    };
  }

  saveState(next);
  return { state: next, claimed: true, outcome };
}
