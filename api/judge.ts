import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  JUDGE_SYSTEM_PROMPT,
  buildJudgeUserMessage,
  parseJudgeJson,
} from "../src/game/judgeRubric";
import { chatCompletion, llmAvailable, llmProviderNames } from "./lib/llm";

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
      });
      return;
    }

    const body = (req.body ?? {}) as {
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

    const ai = await chatCompletion(
      [
        { role: "system", content: JUDGE_SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      { temperature: 0.45, maxTokens: 280 },
    );

    if (!ai) {
      res.status(502).json({ error: "All AI providers failed", providers: llmProviderNames() });
      return;
    }

    const parsed = parseJudgeJson(ai.content);
    if (!parsed) {
      res.status(502).json({ error: "Bad AI response", provider: ai.provider });
      return;
    }

    res.status(200).json({
      available: true,
      provider: ai.provider,
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
