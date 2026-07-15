import { aestheticById } from "../data/aesthetics";
import { droppableCores } from "../data/cores";
import type { AestheticCore, Challenge, ScoreBreakdown, ScoreResult } from "../types";
import { clamp } from "../utils/format";
import { hashString, mulberry32 } from "../utils/seed";
import { gradeFromScore } from "./judgeRubric";

/** Gen Z / Alpha vibe lexicon — points only when paired with real content. */
const ENERGY_WORDS = [
  "aura",
  "rizz",
  "no cap",
  "fr fr",
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
  "aesthetic",
  "unhinged",
  "delulu",
  "understood the assignment",
  "it's giving",
  "periodt",
  "period",
  "bet",
  "goat",
  "drip",
  "soft launch",
  "plot twist",
  "npc",
  "glow up",
  "cook",
  "let him cook",
  "ate and left",
  "no thoughts",
  "brainrot",
  "sigma",
  "clocked",
  "read",
  "tea",
];

const VERDICTS: Record<"S" | "A" | "B" | "C" | "D" | "F", string[]> = {
  S: [
    "You rewrote the room's entire plot.",
    "Main character energy, uncut, unfiltered.",
    "This is going on the highlight reel.",
    "Legendary aura. The algorithm would fold.",
  ],
  A: [
    "You understood the assignment cleanly.",
    "The aura is loud and correct.",
    "Certified vibe curator behavior.",
    "Strong glow — almost dangerous.",
  ],
  B: [
    "Solid aura. One more detail and it pops.",
    "Respectable vibe. Push the drama.",
    "Cute base. Make the second line hit harder.",
    "You're cooking — turn the heat up.",
  ],
  C: [
    "Soft launch energy. Add a sharper edge.",
    "Fine for now. Specifics would save this.",
    "Aura buffering… inject more personality.",
    "Safe play. The room wants chaos or craft.",
  ],
  D: [
    "NPC chapter. Rewrite the scene.",
    "Quiet launch. Louder, clearer next time.",
    "The assignment is still waiting.",
    "Thin aura — give the moment a spine.",
  ],
  F: [
    "That was a blank stare, not a vibe.",
    "Spam isn't aura. Try a real line.",
    "The void answered for you. Try again.",
    "Zero plot. Re-enter the chat.",
  ],
};

const CATEGORY_BOOSTS: Record<
  string,
  { pattern: RegExp; label: string; pts: number }[]
> = {
  rizz: [
    { pattern: /[?!]/, label: "punch", pts: 3 },
    { pattern: /\b(you|u|ur)\b/i, label: "direct", pts: 4 },
    { pattern: /\b(coffee|playlist|song|name|walk|eye)\b/i, label: "specific", pts: 4 },
  ],
  caption: [
    { pattern: /^.{8,90}$/s, label: "tight", pts: 5 },
    { pattern: /[,:—–-]|…/, label: "rhythm", pts: 3 },
    { pattern: /\b(photo|sun|blur|frame|filter|night|city)\b/i, label: "visual", pts: 3 },
  ],
  "fit-check": [
    { pattern: /\b(fit|fit check|drip|kicks|hoodie|baggy|jacket|denim|tee)\b/i, label: "fit-words", pts: 5 },
    { pattern: /\b(black|white|chrome|gold|pink|green|silver)\b/i, label: "palette", pts: 3 },
  ],
  "room-vibe": [
    { pattern: /\b(light|lamp|window|bed|desk|poster|plant|rain|city)\b/i, label: "space", pts: 5 },
    { pattern: /\b(soft|loud|quiet|messy|clean|cozy|dark)\b/i, label: "mood", pts: 3 },
  ],
  "main-character": [
    { pattern: /\b(i|my|me|i'm|im)\b/i, label: "first-person", pts: 4 },
    { pattern: /\b(walk|enter|scene|camera|plot|story|chapter)\b/i, label: "cinematic", pts: 4 },
  ],
};

function countHits(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  return words.reduce((n, w) => (lower.includes(w) ? n + 1 : n), 0);
}

function uniquenessScore(text: string): number {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 0;
  return new Set(words).size / words.length;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function hasRealSentence(text: string): boolean {
  return /[a-zA-Z]{3,}/.test(text) && wordCount(text) >= 3;
}

function pickVerdict(grade: keyof typeof VERDICTS, rng: () => number): string {
  const pool = VERDICTS[grade];
  return pool[Math.floor(rng() * pool.length)]!;
}

/**
 * Multi-axis local Aura Judge.
 * Returns score 0–100 plus breakdown (each axis 0–25).
 */
export function scoreLocal(
  answer: string,
  challenge: Challenge,
  core: AestheticCore,
  streak: number,
): Omit<ScoreResult, "sparksEarned" | "coreDropped" | "streakBonus"> {
  const trimmed = answer.trim();
  const len = trimmed.length;
  const words = wordCount(trimmed);
  const aesthetic = aestheticById(core);
  const rng = mulberry32(hashString(`${challenge.id}:${trimmed.toLowerCase()}`));

  // ——— CRAFT (0–25): structure, length, readability ———
  let craft = 6;
  if (len >= 10 && len <= 48) craft += 8;
  else if (len > 48 && len <= 140) craft += 12;
  else if (len > 140 && len <= 240) craft += 10;
  else if (len > 240 && len <= 360) craft += 6;
  else if (len > 360) craft += 3;
  else if (len > 0) craft += 2;

  if (hasRealSentence(trimmed)) craft += 4;
  if (/[,:—–…-]/.test(trimmed)) craft += 2;
  if ((trimmed.match(/[.!?]/g) || []).length >= 1) craft += 2;
  if (words >= 5 && words <= 40) craft += 3;
  if (words > 55) craft -= 3;

  // ——— FIT (0–25): aesthetic core + challenge category ———
  let fit = 5;
  const keyHits = countHits(trimmed, aesthetic.keywords);
  fit += Math.min(12, keyHits * 4);

  // Soft prompt token overlap (non-stopwords from prompt/title)
  const promptTokens = `${challenge.title} ${challenge.prompt} ${challenge.hint}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 3 && !STOP.has(t));
  const answerLower = trimmed.toLowerCase();
  const promptHits = promptTokens.filter((t) => answerLower.includes(t)).length;
  fit += Math.min(6, promptHits * 2);

  const catBoosts = CATEGORY_BOOSTS[challenge.category] ?? [];
  for (const b of catBoosts) {
    if (b.pattern.test(trimmed)) fit += b.pts;
  }
  fit = clamp(fit, 0, 25);

  // ——— ENERGY (0–25): confidence / slang with substance ———
  let energy = 4;
  const slangHits = countHits(trimmed, ENERGY_WORDS);
  // Diminishing returns so stuffing fails
  if (slangHits === 1) energy += 5;
  else if (slangHits === 2) energy += 8;
  else if (slangHits >= 3) energy += 10;

  if (/\b(i|i'm|im|my|me)\b/i.test(trimmed) && words >= 4) energy += 3;
  if (/[!]{1,2}/.test(trimmed) && !/[!]{4,}/.test(trimmed)) energy += 2;
  if (words >= 6 && uniquenessScore(trimmed) > 0.7) energy += 3;
  // Empty hype dump: lots of slang, almost no unique words
  if (slangHits >= 3 && words <= 6) energy -= 8;
  energy = clamp(energy, 0, 25);

  // ——— ORIGINALITY (0–25) ———
  let originality = Math.round(uniquenessScore(trimmed) * 14);
  if (words >= 8) originality += 4;
  if (/\d|#[a-z]|@\w/i.test(trimmed)) originality += 2; // specifics / tags used intentionally
  // Concrete imagery words
  if (/\b(light|shadow|mirror|street|window|night|coffee|song|city|rain|gold|chrome)\b/i.test(trimmed)) {
    originality += 4;
  }
  originality = clamp(originality, 0, 25);

  // ——— Penalties (applied across axes / total) ———
  let penalty = 0;
  if (len < 6) penalty += 28;
  else if (len < 12) penalty += 12;
  if (/^(.)\1{5,}$/.test(trimmed)) penalty += 35;
  if (trimmed === trimmed.toUpperCase() && len > 14) penalty += 12;
  if (/https?:\/\//i.test(trimmed)) penalty += 10;
  if (words > 4 && uniquenessScore(trimmed) < 0.25) penalty += 20;
  if (/^[^a-zA-Z]*$/.test(trimmed)) penalty += 40;
  // Keyword-only spam: almost only slang
  if (slangHits >= 4 && words <= slangHits + 2) penalty += 15;

  const rawSum = craft + fit + energy + originality - penalty;
  // Slight streak flair (presentation, not free wins)
  const streakTouch = Math.min(3, Math.floor(streak / 3));
  const variance = Math.floor(rng() * 5) - 2;
  let score = clamp(Math.round(rawSum + streakTouch + variance), 3, 99);

  // Normalize breakdown so axes still sum near score
  const breakdown: ScoreBreakdown = {
    craft: clamp(craft, 0, 25),
    fit: clamp(fit, 0, 25),
    energy: clamp(energy, 0, 25),
    originality: clamp(originality, 0, 25),
  };

  const grade = gradeFromScore(score) as keyof typeof VERDICTS;
  const verdict = pickVerdict(grade, rng);

  const tags: string[] = [aesthetic.label];
  if (keyHits > 0) tags.push("core-fit");
  if (slangHits > 0 && penalty < 20) tags.push("energy");
  if (score >= 90) tags.push("iconic");
  else if (score >= 80) tags.push("viral");
  else if (score >= 65) tags.push("glow-up");
  else if (score >= 50) tags.push("soft-launch");
  else tags.push("npc-era");
  if (challenge.category === "rizz") tags.push("rizz");
  if (challenge.category === "caption") tags.push("caption");
  tags.push(`grade-${grade}`);

  return {
    score,
    verdict,
    tags: tags.slice(0, 5),
    source: "local",
    breakdown,
    grade: gradeFromScore(score),
  };
}

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "your",
  "you",
  "are",
  "was",
  "were",
  "from",
  "have",
  "has",
  "into",
  "about",
  "just",
  "like",
  "what",
  "when",
  "where",
  "which",
  "while",
  "their",
  "them",
  "then",
  "than",
  "been",
  "being",
  "will",
  "would",
  "could",
  "should",
  "write",
  "make",
  "describe",
  "drop",
  "line",
]);

export function finalizeRewards(
  base: Omit<ScoreResult, "sparksEarned" | "coreDropped" | "streakBonus">,
  streak: number,
  ownedCores: string[],
): ScoreResult {
  const streakBonus = Math.min(0.4, streak * 0.05);
  const sparksEarned = Math.max(
    6,
    Math.round(base.score * 0.48 * (1 + streakBonus) + streak * 2),
  );

  let coreDropped: string | null = null;
  const dropRoll = mulberry32(hashString(`drop:${base.score}:${base.verdict}`))();
  const dropChance =
    base.score >= 92
      ? 0.58
      : base.score >= 80
        ? 0.32
        : base.score >= 65
          ? 0.16
          : base.score >= 50
            ? 0.07
            : 0.02;

  if (dropRoll < dropChance) {
    const farmable = droppableCores();
    const pool =
      base.score >= 93
        ? farmable.filter((c) => c.rarity === "legendary" || c.rarity === "epic")
        : base.score >= 82
          ? farmable.filter((c) => c.rarity === "epic" || c.rarity === "rare")
          : farmable.filter((c) => c.rarity === "rare" || c.rarity === "common");
    const unowned = pool.filter((c) => !ownedCores.includes(c.id));
    const pickFrom = unowned.length ? unowned : pool;
    if (pickFrom.length) {
      coreDropped =
        pickFrom[Math.floor(dropRoll * pickFrom.length * 17) % pickFrom.length]!.id;
    }
  }

  return {
    ...base,
    grade: base.grade ?? gradeFromScore(base.score),
    sparksEarned,
    coreDropped,
    streakBonus,
  };
}

/**
 * Soft-blend AI score with local floor so great answers aren't hard-failed by model variance.
 */
export function blendAiWithLocal(
  aiScore: number,
  localScore: number,
): number {
  // Prefer AI, but if local is much higher and solid, pull upward slightly
  if (localScore >= 70 && aiScore < localScore - 18) {
    return Math.round(aiScore * 0.65 + localScore * 0.35);
  }
  if (localScore <= 40 && aiScore > localScore + 30) {
    // AI loved spam? pull down a bit
    return Math.round(aiScore * 0.75 + localScore * 0.25);
  }
  return clamp(Math.round(aiScore), 0, 100);
}
