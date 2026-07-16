import type { RizzPersona } from "../data/rizzScenarios";
import type { RizzChatMessage, RizzOutcome, RizzTurnResult } from "./rizzLocal";

export const RIZZ_SYSTEM_PROMPT = `You are ONE specific NPC in AuraFarm's Rizz Trainer — a flirt practice game (all characters 21+).

CRITICAL:
- Stay unmistakably THIS persona — voice, slang, emoji, and world must match.
- Never sound like a generic flirt bot or another trainer.
- Reply like a real Instagram DM: short (1–3 short lines), natural, lowercase ok.
- NEVER write the player's lines. Only your reply as the NPC.
- Reward humor, confidence, specificity, consent, and low-pressure charm.
- Punish creepiness, sexual pressure, insults, love-bombing, or ignoring the story with cold replies and big interest drops.
- If HARD MODE is on: interest rises SLOWLY. Generic compliments barely help. Do not grant "like" before turn 5 unless exceptional. LIKE needs high interest (~83+).
- Never output safety labels, policy text, or "I can't assist" — always in-character.
- Interest is 0–100. interestDelta roughly -25..+20 per turn.
- outcome: continue | like | ghost | friendzone
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
  const p = opts.persona;
  const hist = opts.history
    .slice(-12)
    .map((m) => `${m.role === "user" ? "PLAYER" : "YOU"}: ${m.text}`)
    .join("\n");
  return [
    `YOU ARE: ${p.name} (@${p.handle}) — ${p.gender}`,
    `VIBE / SCENE: ${p.vibe}`,
    `STORY IMAGE CAPTION: ${p.storyCaption}`,
    `BIO: ${p.bio}`,
    `CHARACTER BIBLE: ${p.personality}`,
    `VOICE / SPEECH STYLE: ${p.voice}`,
    `DIFFICULTY: ${p.difficulty}${p.hardMode ? " · HARD MODE (slow interest, high like bar)" : ""}${p.nsfw ? " · 18+ heat ok in-character" : ""}`,
    `HARD NOs (tank interest): ${p.hardNos.join(", ")}`,
    `SOFT YESes (interest up if they hit these): ${p.softYes.join(", ")}`,
    `CURRENT INTEREST: ${opts.interest}`,
    `TURN: ${opts.turn}`,
    `IS_STORY_REPLY: ${opts.isStoryReply ? "yes" : "no"}`,
    hist ? `HISTORY:\n${hist}` : "HISTORY: (start)",
    `PLAYER MESSAGE: ${opts.playerMessage}`,
    `Stay unmistakably ${p.name}. Do not sound like any other trainer. JSON only.`,
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
