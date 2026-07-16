import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Self-contained Aura Judge (OpenRouter / xAI / Groq).
 * No imports from src/ or api/lib — those crash Vercel function bundling.
 */

const JUDGE_SYSTEM_PROMPT = `You are the Aura Judge for AuraFarm — a Gen Z / Gen Alpha daily vibe game.

Score the player's answer from 0–100 using this rubric (be fair, not random):

1) CRAFT (writing quality): clarity, punch, rhythm, intentional structure. Short can score high if sharp.
2) FIT (challenge + aesthetic core): does it answer the prompt and match their aesthetic core?
3) ENERGY (confidence / shareability): would this slap in a story, caption, or group chat?
4) ORIGINALITY: specific detail over generic filler. Penalize spam, one-word spam, all-caps spam, pure spam slang with no idea.

Calibration:
- 90–100: rare, iconic, main-character
- 75–89: strong glow-up, clearly intentional
- 55–74: solid / fine, room to cook
- 35–54: weak, NPC energy
- 0–34: spam, empty, or totally off-prompt

Rules:
- Keep content PG-13 (no explicit sexual content, no real-world hate/harassment).
- Do NOT reward empty keyword stuffing of "aura/rizz/slay" alone.
- Reward specificity, wit, and vibe consistency with their core.
- Verdict: one hype line, max 14 words, second person ("you…") or punchy caption tone.
- Tags: 2–4 short vibe labels (lowercase or Title Case ok), no hashtags.

CRITICAL OUTPUT:
- Your ENTIRE response must be ONE JSON object.
- First character = {  Last character = }
- No markdown, no reasoning, no preamble.

{"score":number,"verdict":string,"tags":string[],"breakdown":{"craft":number,"fit":number,"energy":number,"originality":number}}

Each breakdown field is 0–25. Their sum should roughly match score (within ~8).`;

type OpenAiProvider = {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  headers?: Record<string, string>;
};

function env(key: string): string {
  return String(process.env[key] ?? "").trim();
}

type GeminiProvider = {
  kind: "gemini";
  name: "gemini";
  apiKey: string;
  model: string;
};

type OpenAiP = OpenAiProvider & { kind: "openai" };
type AnyProvider = OpenAiP | GeminiProvider;

function providers(): AnyProvider[] {
  const out: AnyProvider[] = [];
  const xai = env("XAI_API_KEY");
  if (xai) {
    out.push({
      kind: "openai",
      name: "xai",
      baseUrl: "https://api.x.ai/v1",
      apiKey: xai,
      model: env("XAI_MODEL") || "grok-4.5",
    });
  }
  const openrouter = env("OPENROUTER_API_KEY");
  if (openrouter) {
    out.push({
      kind: "openai",
      name: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: openrouter,
      model: env("OPENROUTER_MODEL") || "openrouter/free",
      headers: {
        "HTTP-Referer":
          env("OPENROUTER_SITE_URL") || env("APP_URL") || "https://aurafarm-chi.vercel.app",
        "X-Title": "AuraFarm",
      },
    });
  }
  const groq = env("GROQ_API_KEY");
  if (groq) {
    out.push({
      kind: "openai",
      name: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: groq,
      model: env("GROQ_MODEL") || "llama-3.3-70b-versatile",
    });
  }
  const gemini = env("GEMINI_API_KEY");
  if (gemini) {
    out.push({
      kind: "gemini",
      name: "gemini",
      apiKey: gemini,
      model: env("GEMINI_MODEL") || "gemini-2.0-flash",
    });
  }
  return out;
}

async function callOpenAi(
  p: OpenAiProvider,
  system: string,
  user: string,
): Promise<string | null> {
  const resp = await fetch(`${p.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${p.apiKey}`,
      "Content-Type": "application/json",
      ...(p.headers ?? {}),
    },
    body: JSON.stringify({
      model: p.model,
      temperature: 0.45,
      max_tokens: 280,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    console.warn(`[judge] ${p.name} ${resp.status}: ${detail.slice(0, 400)}`);
    return null;
  }
  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function callGemini(
  p: GeminiProvider,
  system: string,
  user: string,
): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(p.model)}:generateContent?key=${encodeURIComponent(p.apiKey)}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.45, maxOutputTokens: 280 },
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    console.warn(`[judge] gemini ${resp.status}: ${detail.slice(0, 400)}`);
    return null;
  }
  const data = (await resp.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((x) => x.text ?? "")
    .join("")
    .trim();
  return text || null;
}

async function callProvider(
  p: AnyProvider,
  system: string,
  user: string,
): Promise<string | null> {
  if (p.kind === "gemini") return callGemini(p, system, user);
  return callOpenAi(p, system, user);
}

function buildJudgeUserMessage(input: {
  title?: string;
  prompt: string;
  hint?: string;
  category?: string;
  core: string;
  coreLabel?: string;
  answer: string;
  streak?: number;
}): string {
  return [
    `Challenge title: ${input.title || "Daily challenge"}`,
    `Category: ${input.category || "general"}`,
    `Prompt: ${input.prompt}`,
    input.hint ? `Hint: ${input.hint}` : null,
    `Aesthetic core id: ${input.core}`,
    input.coreLabel ? `Aesthetic core name: ${input.coreLabel}` : null,
    typeof input.streak === "number" ? `Player streak: ${input.streak} days` : null,
    `Player answer:"""`,
    input.answer,
    `"""`,
    `Judge the answer now. JSON only.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function parseJudgeJson(content: string): {
  score: number;
  verdict: string;
  tags: string[];
  breakdown?: {
    craft: number;
    fit: number;
    energy: number;
    originality: number;
  };
} | null {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
    const verdict = String(parsed.verdict || "Aura locked in.").slice(0, 120);
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.map((t) => String(t).slice(0, 24)).filter(Boolean).slice(0, 4)
      : [];

    let breakdown:
      | { craft: number; fit: number; energy: number; originality: number }
      | undefined;
    const b = parsed.breakdown as Record<string, unknown> | undefined;
    if (b && typeof b === "object") {
      const clamp25 = (n: unknown) =>
        Math.max(0, Math.min(25, Math.round(Number(n) || 0)));
      breakdown = {
        craft: clamp25(b.craft),
        fit: clamp25(b.fit),
        energy: clamp25(b.energy),
        originality: clamp25(b.originality),
      };
    }

    return { score, verdict, tags, breakdown };
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
    const list = providers();
    if (!list.length) {
      res.status(503).json({
        error: "No AI provider configured",
        available: false,
        hasOpenRouter: Boolean(env("OPENROUTER_API_KEY")),
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

    let content: string | null = null;
    let provider = "";
    const errors: string[] = [];
    for (const p of list) {
      try {
        content = await callProvider(p, JUDGE_SYSTEM_PROMPT, userMsg);
        if (content) {
          provider = p.name;
          break;
        }
        errors.push(`${p.name}: empty`);
      } catch (e) {
        errors.push(`${p.name}: ${e instanceof Error ? e.message : "error"}`);
      }
    }

    if (!content) {
      res.status(502).json({
        error: "All AI providers failed",
        providers: list.map((p) => p.name),
        errors,
      });
      return;
    }

    const parsed = parseJudgeJson(content);
    if (!parsed) {
      res.status(502).json({
        error: "Bad AI response",
        provider,
        sample: content.slice(0, 240),
      });
      return;
    }

    res.status(200).json({
      available: true,
      provider,
      score: parsed.score,
      verdict: parsed.verdict,
      tags: parsed.tags.length ? parsed.tags : ["ai-judged"],
      breakdown: parsed.breakdown,
    });
  } catch (err) {
    console.error("[judge]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
