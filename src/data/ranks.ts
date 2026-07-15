import type { RankDef } from "../types";

export const RANKS: RankDef[] = [
  { id: "npc", name: "NPC", minAura: 0, emoji: "😶" },
  { id: "soft-launch", name: "Soft Launch", minAura: 200, emoji: "✨" },
  { id: "plot-armor", name: "Plot Armor", minAura: 600, emoji: "🛡️" },
  { id: "main-character", name: "Main Character", minAura: 1500, emoji: "🎬" },
  { id: "aura-farmer", name: "Aura Farmer", minAura: 3500, emoji: "🌾" },
  { id: "vibe-curator", name: "Vibe Curator", minAura: 7000, emoji: "🔮" },
  { id: "aura-lord", name: "Aura Lord", minAura: 12000, emoji: "👑" },
];

export function rankForAura(totalAura: number): RankDef {
  let current = RANKS[0]!;
  for (const rank of RANKS) {
    if (totalAura >= rank.minAura) current = rank;
  }
  return current;
}

export function nextRank(totalAura: number): RankDef | null {
  for (const rank of RANKS) {
    if (totalAura < rank.minAura) return rank;
  }
  return null;
}
