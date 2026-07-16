import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Fully self-contained rizz AI turn (OpenRouter-first).
 * No shared imports that crash Vercel function bundling.
 */

const RIZZ_SYSTEM_PROMPT = `You are the NPC in AuraFarm's Rizz Trainer — a flirt practice game (all characters 21+).

Rules:
- Stay in character as the persona described.
- Reply like a real Instagram DM: short (1–3 short lines), natural, lowercase ok, light emoji ok.
- NEVER write the player's lines. Only your reply as the NPC.
- If the player asks a factual question (math, where, yes/no), answer it in-character first, then keep the vibe.
- Reward humor, confidence, specificity, consent, and low-pressure charm.
- Punish creepiness, sexual pressure, insults, or love-bombing with cold replies and big interest drops.
- Interest is 0–100. Adjust with interestDelta roughly -25..+20 per turn.
- outcome must be one of: continue | like | ghost | friendzone
- Return ONLY valid JSON (no markdown):
{"reply":"...","interestDelta":0,"interest":0,"mood":"amused","outcome":"continue","reaction":"🔥"}`;

type HistMsg = { role: "user" | "npc"; text: string };

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

function providers(): OpenAiProvider[] {
  const out: OpenAiProvider[] = [];
  const xai = env("XAI_API_KEY");
  if (xai) {
    out.push({
      name: "xai",
      baseUrl: "https://api.x.ai/v1",
      apiKey: xai,
      model: env("XAI_MODEL") || "grok-4.5",
    });
  }
  const openrouter = env("OPENROUTER_API_KEY");
  if (openrouter) {
    out.push({
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
      name: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: groq,
      model: env("GROQ_MODEL") || "llama-3.3-70b-versatile",
    });
  }
  return out;
}

async function callProvider(
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
      temperature: 0.75,
      max_tokens: 220,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    console.warn(`[rizz-turn] ${p.name} ${resp.status}: ${detail.slice(0, 400)}`);
    return null;
  }
  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() || null;
}

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
    `HARD NOs: ${opts.hardNos.join(", ")}`,
    `SOFT YESes: ${opts.softYes.join(", ")}`,
    `CURRENT INTEREST: ${opts.interest}`,
    `TURN: ${opts.turn}`,
    `IS_STORY_REPLY: ${opts.isStoryReply ? "yes" : "no"}`,
    hist ? `HISTORY:\n${hist}` : "HISTORY: (start)",
    `PLAYER MESSAGE: ${opts.playerMessage}`,
    `Respond as ${opts.name} only. JSON only.`,
  ].join("\n");
}

function parseRizzJson(content: string, fallbackInterest: number) {
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
    const list = providers();
    if (!list.length) {
      res.status(503).json({
        error: "No AI provider configured",
        available: false,
        hasOpenRouter: Boolean(env("OPENROUTER_API_KEY")),
        hint: "Add OPENROUTER_API_KEY in Vercel Production env and Redeploy.",
      });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const playerMessage = String(body.playerMessage ?? "").trim();
    if (!playerMessage) {
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
      hardNos: Array.isArray(body.hardNos) ? body.hardNos.map(String).slice(0, 20) : [],
      softYes: Array.isArray(body.softYes) ? body.softYes.map(String).slice(0, 20) : [],
      history,
      playerMessage,
      interest,
      turn,
      isStoryReply: Boolean(body.isStoryReply),
    });

    let content: string | null = null;
    let provider = "";
    const errors: string[] = [];
    for (const p of list) {
      try {
        content = await callProvider(p, RIZZ_SYSTEM_PROMPT, userMsg);
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
        hint: "If OpenRouter returns 401 User not found, the key is invalid — create a new key.",
      });
      return;
    }

    const parsed = parseRizzJson(content, interest);
    if (!parsed) {
      res.status(502).json({
        error: "Bad AI response",
        provider,
        sample: content.slice(0, 240),
      });
      return;
    }

    res.status(200).json({ available: true, provider, ...parsed });
  } catch (err) {
    console.error("[rizz-turn]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
