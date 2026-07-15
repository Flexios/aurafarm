import { aestheticById } from "../data/aesthetics";
import { CORES } from "../data/cores";
import type { AestheticCore, Challenge, ScoreResult } from "../types";
import { clamp } from "../utils/format";
import { hashString, mulberry32 } from "../utils/seed";

const SLANG = [
  "aura",
  "rizz",
  "no cap",
  "fr",
  "vibe",
  "vibes",
  "locked in",
  "main character",
  "slay",
  "iconic",
  "lowkey",
  "highkey",
  "ate",
  "served",
  "core",
  "aesthetic",
  "unhinged",
  "delulu",
  "understood the assignment",
  "it's giving",
  "period",
  "bet",
  "goat",
  "drip",
  "fit",
  "soft launch",
  "plot twist",
  "npc",
  "w",
  "l",
];

const VERDICTS_HIGH = [
  "Main character energy secured.",
  "The aura is loud and correct.",
  "You understood the assignment.",
  "Certified vibe curator behavior.",
  "Plot armor activated.",
];

const VERDICTS_MID = [
  "Solid aura. Room to glow up.",
  "Respectable vibe. Push the drama.",
  "Cute. Now make it cinematic.",
  "Base aura locked. Season 2 pending.",
];

const VERDICTS_LOW = [
  "NPC chapter. Rewrite the scene.",
  "Aura buffering… try more personality.",
  "Quiet launch. Louder next time.",
  "The assignment is still waiting.",
];

function countHits(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  return words.reduce((n, w) => (lower.includes(w) ? n + 1 : n), 0);
}

function uniquenessScore(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const unique = new Set(words);
  return unique.size / words.length;
}

export function scoreLocal(
  answer: string,
  challenge: Challenge,
  core: AestheticCore,
  streak: number,
): Omit<ScoreResult, "sparksEarned" | "coreDropped" | "streakBonus"> {
  const trimmed = answer.trim();
  const len = trimmed.length;
  const aesthetic = aestheticById(core);

  let score = 28;

  // Length sweet spot
  if (len >= 12 && len <= 40) score += 10;
  else if (len > 40 && len <= 160) score += 22;
  else if (len > 160 && len <= 280) score += 18;
  else if (len > 280) score += 8;
  else if (len > 0) score += 4;

  // Aesthetic keyword fit
  const keyHits = countHits(trimmed, aesthetic.keywords);
  score += Math.min(18, keyHits * 6);

  // Slang / culture lexicon
  const slangHits = countHits(trimmed, SLANG);
  score += Math.min(16, slangHits * 4);

  // Category nudges
  if (challenge.category === "rizz" && /[?!]/.test(trimmed)) score += 4;
  if (challenge.category === "caption" && len <= 80 && len >= 8) score += 6;
  if (challenge.category === "main-character" && /\b(i|my|me)\b/i.test(trimmed)) score += 4;

  // Craft signals
  score += Math.round(uniquenessScore(trimmed) * 12);
  if (/[,:—–-]/.test(trimmed)) score += 3;
  if ((trimmed.match(/[.!?]/g) || []).length >= 1) score += 2;

  // Penalties
  if (len < 8) score -= 20;
  if (/^(.)\1{6,}$/.test(trimmed)) score -= 30;
  if (trimmed === trimmed.toUpperCase() && len > 12) score -= 10;
  if (/https?:\/\//i.test(trimmed)) score -= 8;
  const words = trimmed.split(/\s+/);
  if (words.length > 3 && new Set(words.map((w) => w.toLowerCase())).size === 1) score -= 25;

  // Tiny seeded variance so same answer isn't always identical vibe
  const rng = mulberry32(hashString(`${challenge.id}:${trimmed.toLowerCase()}`));
  score += Math.floor(rng() * 7) - 2;

  score = clamp(Math.round(score), 5, 98);

  // Streak presentation boost (capped) applied later for sparks; slight score flair
  const streakTouch = Math.min(4, Math.floor(streak / 2));
  score = clamp(score + streakTouch, 5, 99);

  let verdictPool = VERDICTS_MID;
  if (score >= 80) verdictPool = VERDICTS_HIGH;
  else if (score < 45) verdictPool = VERDICTS_LOW;
  const verdict = verdictPool[Math.floor(rng() * verdictPool.length)]!;

  const tags: string[] = [aesthetic.label];
  if (slangHits > 0) tags.push("slang-locked");
  if (keyHits > 0) tags.push("core-fit");
  if (score >= 85) tags.push("viral");
  else if (score >= 65) tags.push("glow-up");
  else tags.push("soft-launch");
  if (challenge.category === "rizz") tags.push("rizz");

  return {
    score,
    verdict,
    tags: tags.slice(0, 4),
    source: "local",
  };
}

export function finalizeRewards(
  base: Omit<ScoreResult, "sparksEarned" | "coreDropped" | "streakBonus">,
  streak: number,
  ownedCores: string[],
): ScoreResult {
  const streakBonus = Math.min(0.35, streak * 0.05);
  const sparksEarned = Math.max(
    8,
    Math.round(base.score * 0.45 * (1 + streakBonus) + streak * 2),
  );

  let coreDropped: string | null = null;
  const dropRoll = mulberry32(hashString(`drop:${base.score}:${Date.now()}`))();
  const dropChance =
    base.score >= 90 ? 0.55 : base.score >= 75 ? 0.28 : base.score >= 55 ? 0.12 : 0.04;

  if (dropRoll < dropChance) {
    const pool =
      base.score >= 92
        ? CORES.filter((c) => c.rarity === "legendary" || c.rarity === "epic")
        : base.score >= 80
          ? CORES.filter((c) => c.rarity === "epic" || c.rarity === "rare")
          : CORES.filter((c) => c.rarity === "rare" || c.rarity === "common");
    const unowned = pool.filter((c) => !ownedCores.includes(c.id));
    const pickFrom = unowned.length ? unowned : pool;
    coreDropped = pickFrom[Math.floor(dropRoll * pickFrom.length * 10) % pickFrom.length]!.id;
  }

  return {
    ...base,
    sparksEarned,
    coreDropped,
    streakBonus,
  };
}
