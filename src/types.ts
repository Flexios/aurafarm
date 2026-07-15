export type AestheticCore =
  | "y2k"
  | "clean-girl"
  | "dark-academia"
  | "coquette"
  | "street"
  | "cyber"
  | "soft-boy"
  | "main-character";

export type Screen = "home" | "play" | "shop" | "card" | "duel";

export type ChallengeCategory =
  | "fit-check"
  | "rizz"
  | "room-vibe"
  | "main-character"
  | "caption";

export interface Challenge {
  id: string;
  category: ChallengeCategory;
  title: string;
  prompt: string;
  hint: string;
  emoji: string;
}

export interface CoreDef {
  id: string;
  name: string;
  emoji: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  description: string;
}

export type CosmeticSlot = "frame" | "aura" | "nameplate" | "background";

export interface Cosmetic {
  id: string;
  name: string;
  slot: CosmeticSlot;
  priceSparks: number;
  priceGlow: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  preview: string;
  free?: boolean;
}

export interface BattlePassTier {
  level: number;
  freeReward: { type: "sparks" | "cosmetic" | "core"; id?: string; amount?: number; label: string };
  premiumReward: { type: "sparks" | "glow" | "cosmetic" | "core"; id?: string; amount?: number; label: string };
}

export interface RankDef {
  id: string;
  name: string;
  minAura: number;
  emoji: string;
}

export interface EquippedCosmetics {
  frame: string;
  aura: string;
  nameplate: string;
  background: string;
}

export interface PlayerState {
  version: 1;
  displayName: string;
  core: AestheticCore;
  totalAura: number;
  sparks: number;
  glow: number;
  streak: number;
  lastPlayDate: string | null;
  lastDailyDate: string | null;
  ownedCosmetics: string[];
  equipped: EquippedCosmetics;
  ownedCores: string[];
  battlePassLevel: number;
  battlePassPremium: boolean;
  claimedFreeTiers: number[];
  claimedPremiumTiers: number[];
  bestDailyScore: number;
  duelWins: number;
  onboarded: boolean;
  history: Array<{ date: string; score: number; challengeId: string }>;
}

export interface ScoreResult {
  score: number;
  verdict: string;
  tags: string[];
  source: "local" | "ai";
  sparksEarned: number;
  coreDropped: string | null;
  streakBonus: number;
}
