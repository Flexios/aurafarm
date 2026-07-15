export type AestheticCore =
  | "y2k"
  | "clean-girl"
  | "dark-academia"
  | "coquette"
  | "street"
  | "cyber"
  | "soft-boy"
  | "main-character";

export type Screen = "home" | "play" | "shop" | "card" | "duel" | "profile" | "settings";

export type AccentTheme = "purple" | "blue" | "pink" | "green";

export interface UserSettings {
  /** Prefer AI judge when available */
  preferAiJudge: boolean;
  /** Softer animations */
  reduceMotion: boolean;
  /** Tighter spacing */
  compactMode: boolean;
  /** Larger UI type */
  largeText: boolean;
  /** Toast / feedback sounds (reserved; UI toggle) */
  soundEnabled: boolean;
  /** Accent color */
  accent: AccentTheme;
  /** Hide currency in top bar (still in sidebar) */
  hideTopCurrency: boolean;
  /** Email reminder if daily streak not played */
  streakEmailEnabled: boolean;
  /** Local time HH:MM (24h) for streak email */
  streakEmailTime: string;
  /** IANA timezone, e.g. Europe/Berlin (auto-detected) */
  timezone: string;
}

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
  /** Not obtainable from drops; granted only to specific accounts */
  exclusive?: boolean;
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
  /** ISO timestamp — username change cooldown (7 days) */
  lastUsernameChangeAt: string | null;
  /** ISO timestamp — display name change cooldown (3 days) */
  lastDisplayNameChangeAt: string | null;
  settings: UserSettings;
  /** Cached public avatar URL (also on profiles.avatar_url) */
  avatarUrl: string | null;
  /** Friend battle IDs already counted toward duel progress */
  claimedFriendBattleIds: string[];
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
