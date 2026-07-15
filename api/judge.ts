import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Production AI Aura Judge (SpaceXAI / xAI).
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
    const body = req.body as { prompt?: string; answer?: string; core?: string };
    const prompt = String(body.prompt ?? "");
    const answer = String(body.answer ?? "");
    const core = String(body.core ?? "main-character");

    const system = `You are the Aura Judge for AuraFarm, a Gen Z vibe game. Score the player's answer 0-100 for aura/vibe quality. Consider: originality, confidence, aesthetic fit to their core (${core}), humor, and shareability. Keep content PG-13. Reply ONLY with compact JSON: {"score":number,"verdict":string,"tags":string[]} where verdict is a short hype line (max 12 words) and tags are 2-4 vibe words.`;

    const resp = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.7,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Challenge: ${prompt}\nAesthetic core: ${core}\nAnswer: ${answer}`,
          },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      res.status(502).json({ error: "AI judge failed", detail: text.slice(0, 200) });
      return;
    }

    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      res.status(502).json({ error: "Bad AI response" });
      return;
    }

    const parsed = JSON.parse(match[0]) as {
      score: number;
      verdict: string;
      tags: string[];
    };

    res.status(200).json({
      available: true,
      score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
      verdict: String(parsed.verdict || "Aura secured."),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 4) : [],
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
