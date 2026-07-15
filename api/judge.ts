import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  JUDGE_SYSTEM_PROMPT,
  buildJudgeUserMessage,
  parseJudgeJson,
} from "../src/game/judgeRubric";

/**
 * Production Aura Judge (SpaceXAI / xAI Grok).
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
      prompt?: string;
      answer?: string;
      core?: string;
      title?: string;
      hint?: string;
      category?: string;
      coreLabel?: string;
      streak?: number;
    };

    const answer = String(body.answer ?? "").trim();
    const prompt = String(body.prompt ?? "").trim();
    if (answer.length < 1) {
      res.status(400).json({ error: "Empty answer" });
      return;
    }
    if (answer.length > 400) {
      res.status(400).json({ error: "Answer too long" });
      return;
    }

    const userMsg = buildJudgeUserMessage({
      title: body.title,
      prompt,
      hint: body.hint,
      category: body.category,
      core: String(body.core ?? "main-character"),
      coreLabel: body.coreLabel,
      answer,
      streak: typeof body.streak === "number" ? body.streak : undefined,
    });

    const resp = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.45,
        max_tokens: 280,
        messages: [
          { role: "system", content: JUDGE_SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      res.status(502).json({ error: "AI judge failed", detail: text.slice(0, 240) });
      return;
    }

    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = parseJudgeJson(content);
    if (!parsed) {
      res.status(502).json({ error: "Bad AI response" });
      return;
    }

    res.status(200).json({
      available: true,
      score: parsed.score,
      verdict: parsed.verdict,
      tags: parsed.tags.length ? parsed.tags : ["ai-judged"],
      breakdown: parsed.breakdown,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
