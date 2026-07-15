import type { CoreDef } from "../types";

export const CORES: CoreDef[] = [
  {
    id: "spark-seed",
    name: "Spark Seed",
    emoji: "🌱",
    rarity: "common",
    description: "Everyone starts somewhere. Still glowing.",
  },
  {
    id: "mirror-glint",
    name: "Mirror Glint",
    emoji: "🪞",
    rarity: "common",
    description: "Caught your reflection mid-main-character.",
  },
  {
    id: "caption-comet",
    name: "Caption Comet",
    emoji: "☄️",
    rarity: "rare",
    description: "A one-liner that left a trail.",
  },
  {
    id: "rizz-relic",
    name: "Rizz Relic",
    emoji: "📿",
    rarity: "rare",
    description: "Ancient charm, modern delivery.",
  },
  {
    id: "night-neon",
    name: "Night Neon",
    emoji: "🌃",
    rarity: "epic",
    description: "City lights bottled at 1:11 AM.",
  },
  {
    id: "plot-pearl",
    name: "Plot Pearl",
    emoji: "🫧",
    rarity: "epic",
    description: "Your storyline just unlocked DLC.",
  },
  {
    id: "aura-crown",
    name: "Aura Crown",
    emoji: "👑",
    rarity: "legendary",
    description: "Not given. Farmed.",
  },
  {
    id: "void-velvet",
    name: "Void Velvet",
    emoji: "🖤",
    rarity: "legendary",
    description: "Soft silence that somehow screams status.",
  },
];

export function coreById(id: string): CoreDef | undefined {
  return CORES.find((c) => c.id === id);
}
