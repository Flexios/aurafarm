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
  {
    id: "owner-seal",
    name: "Owner Seal",
    emoji: "🏛️",
    rarity: "legendary",
    description: "Founder of AuraFarm. Unique to @admin — not farmable.",
    exclusive: true,
  },
  {
    id: "elise-sip",
    name: "Elise's Sip",
    emoji: "🥛",
    rarity: "legendary",
    description: "Chocolate milkshake energy. Unlocks exclusive trainer Elise. Code only.",
    exclusive: true,
  },
];

/** Username (lowercase) → exclusive core ids granted automatically */
export const EXCLUSIVE_CORE_GRANTS: Record<string, string[]> = {
  admin: ["owner-seal"],
};

export function coreById(id: string): CoreDef | undefined {
  return CORES.find((c) => c.id === id);
}

/** Cores that can drop from challenges (excludes exclusive owner items). */
export function droppableCores(): CoreDef[] {
  return CORES.filter((c) => !c.exclusive);
}

/** Resolve owned core ids to defs (unknown ids skipped). */
export function coresFromIds(ids: string[] | null | undefined): CoreDef[] {
  if (!ids?.length) return [];
  return ids.map((id) => coreById(id)).filter((c): c is CoreDef => Boolean(c));
}

/**
 * Ensure exclusive collectibles for reserved accounts (e.g. Owner Seal for @admin).
 */
export function applyExclusiveCores(
  ownedCores: string[],
  username: string | null | undefined,
): string[] {
  if (!username) return ownedCores;
  const grants = EXCLUSIVE_CORE_GRANTS[username.trim().toLowerCase()];
  if (!grants?.length) return ownedCores;
  const next = new Set(ownedCores);
  let changed = false;
  for (const id of grants) {
    if (!next.has(id)) {
      next.add(id);
      changed = true;
    }
  }
  return changed ? Array.from(next) : ownedCores;
}
