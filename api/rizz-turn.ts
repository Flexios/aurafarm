import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  RIZZ_SYSTEM_PROMPT,
  buildRizzUserMessage,
  parseRizzJson,
} from "../src/game/rizzPrompt";
import type { RizzPersona } from "../src/data/rizzScenarios";
import type { RizzChatMessage } from "../src/game/rizzLocal";

/**
 * Rizz Trainer turn (SpaceXAI / xAI Grok).
 * Set XAI_API_KEY in Vercel project env (server-only).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "XAI_API_KEY not configured", available: false });
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

    const resp = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.75,
        max_tokens: 220,
        messages: [
          { role: "system", content: RIZZ_SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      res.status(502).json({ error: "AI rizz failed", detail: text.slice(0, 240) });
      return;
    }

    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = parseRizzJson(content, interest);
    if (!parsed) {
      res.status(502).json({ error: "Bad AI response" });
      return;
    }

    res.status(200).json({ available: true, ...parsed });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
