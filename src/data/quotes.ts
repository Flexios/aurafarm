import { hashString, mulberry32, todayKey } from "../utils/seed";

export interface DailyQuote {
  text: string;
  vibe: string;
}

/** Short AuraFarm-flavored lines — rotated daily. */
const QUOTES: DailyQuote[] = [
  { text: "Your aura is a habit, not a mood.", vibe: "discipline" },
  { text: "Main character energy starts with showing up.", vibe: "presence" },
  { text: "Soft launch yourself every morning.", vibe: "reset" },
  { text: "Glow is earned in quiet reps.", vibe: "grind" },
  { text: "Protect the vibe like it's rent money.", vibe: "boundaries" },
  { text: "Today's fit is an opinion. Wear it loud.", vibe: "style" },
  { text: "Leave them on read if the energy is unpaid labor.", vibe: "self-respect" },
  { text: "Chaos is allowed. Cringe is optional.", vibe: "freedom" },
  { text: "Build aura the boring way: consistency.", vibe: "farm" },
  { text: "You're not behind. You're in a loading screen.", vibe: "patience" },
  { text: "Plot twists hit harder when you keep writing.", vibe: "story" },
  { text: "Be the person your playlist thinks you are.", vibe: "soundtrack" },
  { text: "Small wins still count as wins.", vibe: "progress" },
  { text: "Don't shrink to fit someone else's feed.", vibe: "space" },
  { text: "Romanticize the process, not just the highlight reel.", vibe: "process" },
  { text: "Your streak is a love letter to future you.", vibe: "streak" },
  { text: "If it costs your peace, it's too expensive.", vibe: "peace" },
  { text: "Soft heart. Sharp boundaries. Full aura.", vibe: "balance" },
  { text: "Today is a limited-edition drop. Don't sleep on it.", vibe: "now" },
  { text: "Less performing. More becoming.", vibe: "real" },
  { text: "The algorithm doesn't get to cast you.", vibe: "agency" },
  { text: "Rest is part of the glow-up.", vibe: "rest" },
  { text: "Be iconic offline first.", vibe: "irl" },
  { text: "Sparks fly where attention goes.", vibe: "focus" },
  { text: "You're allowed to restart mid-sentence.", vibe: "reset" },
  { text: "Farm first. Flex second.", vibe: "order" },
  { text: "Your quiet season is still a season.", vibe: "growth" },
  { text: "Don't dim. Edit the room.", vibe: "light" },
];

export function getDailyQuote(date = new Date()): DailyQuote {
  const rng = mulberry32(hashString(`aura-quote:${todayKey(date)}`));
  const idx = Math.floor(rng() * QUOTES.length);
  return QUOTES[idx]!;
}
