import type { AestheticCore } from "../types";

export interface AestheticMeta {
  id: AestheticCore;
  label: string;
  emoji: string;
  blurb: string;
  keywords: string[];
  colors: [string, string];
}

export const AESTHETICS: AestheticMeta[] = [
  {
    id: "y2k",
    label: "Y2K",
    emoji: "💿",
    blurb: "Chrome, butterflies, early internet princess.",
    keywords: ["chrome", "butterfly", "pink", "shiny", "2000s", "sparkle", "flip phone", "low rise"],
    colors: ["#ff2bd6", "#2bfff0"],
  },
  {
    id: "clean-girl",
    label: "Clean Girl",
    emoji: "🤍",
    blurb: "Slick bun, glazed skin, quiet luxury energy.",
    keywords: ["slick", "minimal", "gold", "neutral", "glazed", "quiet luxury", "bun", "clean"],
    colors: ["#f5f5f4", "#d6d3d1"],
  },
  {
    id: "dark-academia",
    label: "Dark Academia",
    emoji: "📚",
    blurb: "Old books, rainy windows, secret societies.",
    keywords: ["books", "tweed", "rain", "library", "latin", "candle", "coffee", "poem"],
    colors: ["#78350f", "#1c1917"],
  },
  {
    id: "coquette",
    label: "Coquette",
    emoji: "🎀",
    blurb: "Bows, blush, soft menace with lace.",
    keywords: ["bow", "lace", "blush", "pearl", "pink", "ribbon", "soft", "doll"],
    colors: ["#fb7185", "#fda4af"],
  },
  {
    id: "street",
    label: "Street",
    emoji: "🧢",
    blurb: "Baggy fits, kicks, city concrete poetry.",
    keywords: ["baggy", "kicks", "hoodie", "drip", "city", "block", "fit", "graffiti"],
    colors: ["#22c55e", "#0f172a"],
  },
  {
    id: "cyber",
    label: "Cyber",
    emoji: "🧬",
    blurb: "Neon grid, glitch soul, future-now.",
    keywords: ["neon", "glitch", "cyber", "matrix", "pixel", "laser", "digital", "code"],
    colors: ["#22d3ee", "#a855f7"],
  },
  {
    id: "soft-boy",
    label: "Soft Boy",
    emoji: "🎧",
    blurb: "Cardigans, playlists, emotional range unlocked.",
    keywords: ["cardigan", "playlist", "soft", "indie", "beanie", "gentle", "tea", "vinyl"],
    colors: ["#93c5fd", "#bfdbfe"],
  },
  {
    id: "main-character",
    label: "Main Character",
    emoji: "🎬",
    blurb: "Plot armor on. Camera always rolling.",
    keywords: ["plot", "cinematic", "destiny", "camera", "arc", "legendary", "spotlight", "iconic"],
    colors: ["#fbbf24", "#f472b6"],
  },
];

export function aestheticById(id: AestheticCore): AestheticMeta {
  return AESTHETICS.find((a) => a.id === id) ?? AESTHETICS[0]!;
}
