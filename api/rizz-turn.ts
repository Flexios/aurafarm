import type { VercelRequest, VercelResponse } from "@vercel/node";
import { chatCompletion, llmAvailable, llmProviderNames } from "./lib/llm";

/**
 * Self-contained rizz turn handler (no imports from src/ — those break Vercel bundling).
 */

const RIZZ_SYSTEM_PROMPT = `You are the NPC in AuraFarm's Rizz Trainer — a flirt practice game (all characters 21+).

Rules:
- Stay in character as the persona described.
- Reply like a real Instagram DM: short (1–3 short lines), natural, lowercase ok, light emoji ok.
- NEVER write the player's lines. Only your reply as the NPC.
- Reward humor, confidence, specificity, consent, and low-pressure charm.
- Punish creepiness, sexual pressure, insults, love-bombing, or ignoring the story context with cold replies and big interest drops.
- Interest is 0–100. Adjust with interestDelta roughly -25..+20 per turn.
- If the player asks a factual question (math, yes/no, where are you going), answer it in-character first, then keep the vibe.
- outcome must be one of: continue | like | ghost | friendzone
  - like: interest ends >= 75 and they clearly like the player
  - ghost: interest very low or severe creep
  - friendzone: polite no-spark after many turns
  - continue: still chatting
- Return ONLY valid JSON (no markdown):
{"reply":"...","interestDelta":0,"interest":0,"mood":"amused","outcome":"continue","reaction":"🔥"}
reaction is optional single emoji or omit.`;

type HistMsg = { role: "user" | "npc"; text: string };

function buildUserMessage(opts: {
  name: string;
  handle: string;
  gender: string;
  vibe: string;
  storyCaption: string;
  personality: string;
  hardNos: string[];
  softYes: string[];
  history: HistMsg[];
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
    `PERSONA: ${opts.name} (@${opts.handle})`,
    `GENDER: ${opts.gender}`,
    `VIBE: ${opts.vibe}`,
    `STORY CAPTION: ${opts.storyCaption}`,
    `PERSONALITY: ${opts.personality}`,
    `HARD NOs (tank interest): ${opts.hardNos.join(", ")}`,
    `SOFT YESes: ${opts.softYes.join(", ")}`,
    `CURRENT INTEREST: ${opts.interest}`,
    `TURN: ${opts.turn}`,
    `IS_STORY_REPLY: ${opts.isStoryReply ? "yes" : "no"}`,
    hist ? `HISTORY:\n${hist}` : "HISTORY: (start)",
    `PLAYER MESSAGE: ${opts.playerMessage}`,
    `Respond as ${opts.name} only. JSON only.`,
  ].join("\n");
}

function parseRizzJson(
  content: string,
  fallbackInterest: number,
): {
  reply: string;
  interestDelta: number;
  interest: number;
  mood: string;
  outcome: string;
  reaction?: string;
} | null {
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
    const allowed = ["continue", "like", "ghost", "friendzone"];
    let outcome = allowed.includes(String(raw.outcome)) ? String(raw.outcome) : "continue";
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    if (!llmAvailable()) {
      res.status(503).json({
        error: "No AI provider configured",
        available: false,
        providers: llmProviderNames(),
        hint: "Set OPENROUTER_API_KEY on Vercel (Production) and Redeploy.",
      });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const playerMessage = String(body.playerMessage ?? "").trim();
    if (playerMessage.length < 1) {
      res.status(400).json({ error: "Empty message" });
      return;
    }
    if (playerMessage.length > 200) {
      res.status(400).json({ error: "Message too long" });
      return;
    }

    const interest =
      typeof body.interest === "number" && Number.isFinite(body.interest)
        ? Math.max(0, Math.min(100, body.interest as number))
        : 40;
    const turn =
      typeof body.turn === "number" ? Math.max(1, Math.min(20, body.turn as number)) : 1;

    const hardNos = Array.isArray(body.hardNos) ? body.hardNos.map(String).slice(0, 20) : [];
    const softYes = Array.isArray(body.softYes) ? body.softYes.map(String).slice(0, 20) : [];
    const historyRaw = Array.isArray(body.history) ? body.history : [];
    const history: HistMsg[] = historyRaw
      .filter(
        (m): m is { role: string; text: string } =>
          !!m &&
          typeof m === "object" &&
          ((m as { role?: string }).role === "user" ||
            (m as { role?: string }).role === "npc") &&
          typeof (m as { text?: string }).text === "string",
      )
      .map((m) => ({
        role: m.role as "user" | "npc",
        text: String(m.text).slice(0, 200),
      }))
      .slice(-12);

    const userMsg = buildUserMessage({
      name: String(body.name ?? "Alex").slice(0, 40),
      handle: String(body.handle ?? "alex").slice(0, 40),
      gender: body.gender === "male" ? "male" : "female",
      vibe: String(body.vibe ?? "chill").slice(0, 80),
      storyCaption: String(body.storyCaption ?? "").slice(0, 160),
      personality: String(body.personality ?? "friendly").slice(0, 400),
      hardNos,
      softYes,
      history,
      playerMessage,
      interest,
      turn,
      isStoryReply: Boolean(body.isStoryReply),
    });

    const ai = await chatCompletion(
      [
        { role: "system", content: RIZZ_SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      { temperature: 0.75, maxTokens: 220 },
    );

    if (!ai) {
      res.status(502).json({
        error: "All AI providers failed",
        providers: llmProviderNames(),
        hint: "OpenRouter may reject the key (401). Create a new key and update OPENROUTER_API_KEY.",
      });
      return;
    }

    const parsed = parseRizzJson(ai.content, interest);
    if (!parsed) {
      res.status(502).json({
        error: "Bad AI response",
        provider: ai.provider,
        sample: ai.content.slice(0, 200),
      });
      return;
    }

    res.status(200).json({ available: true, provider: ai.provider, ...parsed });
  } catch (err) {
    console.error("[rizz-turn]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
      stack: err instanceof Error ? err.stack?.slice(0, 400) : undefined,
    });
  }
}
