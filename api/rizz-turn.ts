import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  RIZZ_SYSTEM_PROMPT,
  buildRizzUserMessage,
  parseRizzJson,
} from "../src/game/rizzPrompt";
import type { RizzPersona } from "../src/data/rizzScenarios";
import type { RizzChatMessage } from "../src/game/rizzLocal";
import { chatCompletion, llmAvailable } from "../src/server/llm";

/**
 * Rizz Trainer turn — tries free/paid providers (xAI → Groq → Gemini → Ollama).
 * Env (any one is enough): XAI_API_KEY | GROQ_API_KEY | GEMINI_API_KEY | OLLAMA_BASE_URL
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!llmAvailable()) {
    res.status(503).json({
      error: "No AI provider configured (XAI_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, or OLLAMA)",
      available: false,
    });
    return;
  }

  try {
    const body = req.body as {
      personaId?: string;
      gender?: string;
      name?: string;
      handle?: string;
      vibe?: string;
      storyCaption?: string;
      personality?: string;
      hardNos?: string[];
      softYes?: string[];
      history?: RizzChatMessage[];
      playerMessage?: string;
      interest?: number;
      turn?: number;
      isStoryReply?: boolean;
    };

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
        ? Math.max(0, Math.min(100, body.interest))
        : 40;
    const turn = typeof body.turn === "number" ? Math.max(1, Math.min(20, body.turn)) : 1;

    const persona: RizzPersona = {
      id: String(body.personaId ?? "npc"),
      gender: body.gender === "male" ? "male" : "female",
      name: String(body.name ?? "Alex").slice(0, 40),
      handle: String(body.handle ?? "alex").slice(0, 40),
      vibe: String(body.vibe ?? "chill").slice(0, 80),
      storyCaption: String(body.storyCaption ?? "").slice(0, 160),
      image: "",
      accent: "#888",
      accent2: "#111",
      emoji: "✨",
      personality: String(body.personality ?? "friendly").slice(0, 400),
      hardNos: Array.isArray(body.hardNos) ? body.hardNos.map(String).slice(0, 20) : [],
      softYes: Array.isArray(body.softYes) ? body.softYes.map(String).slice(0, 20) : [],
      replies: { warm: [], cold: [], like: [], ghost: [] },
    };

    const history = Array.isArray(body.history)
      ? body.history
          .filter((m) => m && (m.role === "user" || m.role === "npc") && typeof m.text === "string")
          .map((m) => ({ role: m.role, text: String(m.text).slice(0, 200) }))
          .slice(-12)
      : [];

    const userMsg = buildRizzUserMessage({
      persona,
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
      res.status(502).json({ error: "All AI providers failed" });
      return;
    }

    const parsed = parseRizzJson(ai.content, interest);
    if (!parsed) {
      res.status(502).json({ error: "Bad AI response", provider: ai.provider });
      return;
    }

    res.status(200).json({ available: true, provider: ai.provider, ...parsed });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
