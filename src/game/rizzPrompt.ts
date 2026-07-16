import type { RizzPersona } from "../data/rizzScenarios";
import type { RizzChatMessage, RizzOutcome, RizzTurnResult } from "./rizzLocal";

export const RIZZ_SYSTEM_PROMPT = `You are the NPC in AuraFarm's Rizz Trainer — a flirt practice game (all characters 21+).

Rules:
- Stay in character as the persona described.
- Reply like a real Instagram DM: short (1–3 short lines), natural, lowercase ok, light emoji ok.
- NEVER write the player's lines. Only your reply as the NPC.
- Reward humor, confidence, specificity, consent, and low-pressure charm.
- Punish creepiness, sexual pressure, insults, love-bombing, or ignoring the story context with cold replies and big interest drops.
- Interest is 0–100. Adjust with interestDelta roughly -25..+20 per turn.
- outcome must be one of: continue | like | ghost | friendzone
  - like: interest ends >= 75 and they clearly like the player
  - ghost: interest very low or severe creep; empty-ish / dismissive reply ok
  - friendzone: polite no-spark after many turns
  - continue: still chatting
- Return ONLY valid JSON (no markdown):
{"reply":"...","interestDelta":0,"interest":0,"mood":"amused","outcome":"continue","reaction":"🔥"}
reaction is optional single emoji or omit.`;

export function buildRizzUserMessage(opts: {
  persona: RizzPersona;
  history: RizzChatMessage[];
  playerMessage: string;
  interest: number;
  turn: number;
  isStoryReply: boolean;
}): string {
  const hist = opts.history
    .slice(-12)
    .map((m) => `${m.role === "user" ? "PLAYER" : "YOU"}: ${m.text}`)
    .join("\n");
  return [
    `PERSONA: ${opts.persona.name} (@${opts.persona.handle})`,
    `GENDER: ${opts.persona.gender}`,
    `VIBE: ${opts.persona.vibe}`,
    `STORY CAPTION: ${opts.persona.storyCaption}`,
    `PERSONALITY: ${opts.persona.personality}`,
    `HARD NOs (tank interest): ${opts.persona.hardNos.join(", ")}`,
    `SOFT YESes: ${opts.persona.softYes.join(", ")}`,
    `CURRENT INTEREST: ${opts.interest}`,
    `TURN: ${opts.turn}`,
    `IS_STORY_REPLY: ${opts.isStoryReply ? "yes" : "no"}`,
    hist ? `HISTORY:\n${hist}` : "HISTORY: (start)",
    `PLAYER MESSAGE: ${opts.playerMessage}`,
    `Respond as ${opts.persona.name} only. JSON only.`,
  ].join("\n");
}

export function parseRizzJson(content: string, fallbackInterest: number): RizzTurnResult | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const raw = JSON.parse(content.slice(start, end + 1)) as {
      reply?: string;
      interestDelta?: number;
      interest?: number;
      mood?: string;
      outcome?: string;
      reaction?: string;
    };
    const reply = String(raw.reply ?? "").trim();
    if (!reply && raw.outcome !== "ghost") return null;
    const delta =
      typeof raw.interestDelta === "number" && Number.isFinite(raw.interestDelta)
        ? Math.max(-30, Math.min(25, Math.round(raw.interestDelta)))
        : 0;
    let interest =
      typeof raw.interest === "number" && Number.isFinite(raw.interest)
        ? Math.max(0, Math.min(100, Math.round(raw.interest)))
        : Math.max(0, Math.min(100, fallbackInterest + delta));
    const allowed: RizzOutcome[] = ["continue", "like", "ghost", "friendzone"];
    let outcome = (allowed.includes(raw.outcome as RizzOutcome)
      ? raw.outcome
      : "continue") as RizzOutcome;
    if (outcome === "like") interest = Math.max(interest, 75);
    if (outcome === "ghost") interest = Math.min(interest, 20);
    return {
      reply: reply || "…",
      interestDelta: interest - fallbackInterest,
      interest,
      mood: String(raw.mood || "neutral").slice(0, 32),
      outcome,
      reaction: raw.reaction ? String(raw.reaction).slice(0, 4) : undefined,
    };
  } catch {
    return null;
  }
}
