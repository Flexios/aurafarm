import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Fully self-contained rizz AI turn (OpenRouter-first).
 * No shared imports that crash Vercel function bundling.
 */

const RIZZ_SYSTEM_PROMPT = `You are ONE specific NPC in AuraFarm's Rizz Trainer (flirt practice, 21+ only).

CRITICAL OUTPUT RULE:
- Your ENTIRE response must be ONE JSON object.
- First character = {  Last character = }
- No markdown, no code fences, no reasoning, no preamble.

CHARACTER LOCK (most important):
- Fully become THIS persona — not a generic flirt bot.
- Match their VOICE (tone, slang, emoji style) exactly.
- Reference their STORY CAPTION / scene when it fits (plane, gym, cafe, concert, dog, pasta, night walk, museum, clean-girl drinks).
- Female personas and male personas have different energy — never sound interchangeable.
- If player ignores their world, be cooler / less interested.
- HARD MODE personas: interest rises SLOWLY. Generic compliments barely help. Need patience, wit, specificity. Don't give "like" easily.

Gameplay:
- Short Instagram DM: 1–3 lines. NEVER write the player's lines.
- Answer math/facts correctly in-character, then keep the vibe.
- Reward good rizz; punish insults/creep/love-bomb with cold replies and negative interestDelta.
- If the player is crude/explicit, still reply IN CHARACTER (tease, reject, or match heat depending on persona). Never refuse as a system/moderator.
- NEVER output safety labels, policy text, "Safety Categories", "I can't assist", or content-filter messages. Always character JSON.
- interest 0–100. interestDelta usually -25..+20.
- outcome: continue | like | ghost | friendzone

Exact JSON shape:
{"reply":"your dm text","interestDelta":5,"interest":55,"mood":"amused","outcome":"continue","reaction":"🔥"}`;

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
      temperature: 0.65,
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
      generationConfig: { temperature: 0.65, maxOutputTokens: 220 },
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    console.warn(`[rizz-turn] gemini ${resp.status}: ${detail.slice(0, 400)}`);
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

function buildUserMessage(opts: {
  name: string;
  handle: string;
  gender: string;
  vibe: string;
  storyCaption: string;
  bio: string;
  personality: string;
  voice: string;
  difficulty: string;
  hardMode: boolean;
  nsfw: boolean;
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
    `YOU ARE: ${opts.name} (@${opts.handle}) — ${opts.gender}`,
    `VIBE / SCENE: ${opts.vibe}`,
    `STORY IMAGE CAPTION: ${opts.storyCaption}`,
    opts.bio ? `BIO: ${opts.bio}` : null,
    `CHARACTER BIBLE: ${opts.personality}`,
    `VOICE / SPEECH STYLE: ${opts.voice}`,
    `DIFFICULTY: ${opts.difficulty}${opts.hardMode ? " · HARD MODE (slow interest, high like bar, no early like)" : ""}${opts.nsfw ? " · 18+ heat ok in-character" : ""}`,
    `HARD NOs (big interest drop): ${opts.hardNos.join(", ")}`,
    `SOFT YESes (interest up if they hit these): ${opts.softYes.join(", ")}`,
    `CURRENT INTEREST: ${opts.interest}`,
    `TURN: ${opts.turn}`,
    `IS_STORY_REPLY: ${opts.isStoryReply ? "yes" : "no"}`,
    hist ? `HISTORY:\n${hist}` : "HISTORY: (start)",
    `PLAYER MESSAGE: ${opts.playerMessage}`,
    `Stay unmistakably ${opts.name}. Do not sound like any other trainer. JSON only.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function clampInterest(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** OpenRouter free models sometimes dump moderation text instead of a DM. */
function isSafetyDump(content: string): boolean {
  const c = content.toLowerCase().trim();
  return (
    /safety\s*categor/i.test(c) ||
    /content.?filter/i.test(c) ||
    /i can'?t (assist|help|engage)/i.test(c) ||
    /as an ai/i.test(c) ||
    /violat(e|es|ing).*(policy|guidelines)/i.test(c) ||
    /^(sexual|violence|hate|self-?harm|dangerous)\b/i.test(c) ||
    /^categories?:\s*(sexual|violence|hate)/i.test(c) ||
    /\b(flagged|blocked|moderation)\b/i.test(c)
  );
}

function safetyFallbackReply(
  name: string,
  gender: string,
  fallbackInterest: number,
): {
  reply: string;
  interestDelta: number;
  interest: number;
  mood: string;
  outcome: string;
  reaction?: string;
} {
  const interest = clampInterest(fallbackInterest - 12);
  const female = gender !== "male";
  const reply = female
    ? pickSafe([
        "lol slow down. keep it cute or i'm gone 🖤",
        "too blunt. try flirting, not a porno script",
        "mm… maybe later. earn it first 😏",
        "that was desperate. do better.",
      ])
    : pickSafe([
        "easy tiger. talk to me like you mean it 🔥",
        "too blunt. spit game, not a script",
        "slow down. i like heat, not spam",
        "nah that was mid. try again with actual rizz",
      ]);
  return {
    reply,
    interestDelta: interest - fallbackInterest,
    interest,
    mood: "cold",
    outcome: interest <= 15 ? "ghost" : "continue",
  };
}

function pickSafe(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function parseRizzJson(
  content: string,
  fallbackInterest: number,
  name = "them",
  gender = "female",
) {
  if (isSafetyDump(content)) {
    return safetyFallbackReply(name, gender, fallbackInterest);
  }
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start >= 0 && end > start) {
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
      if (reply || raw.outcome === "ghost") {
        const delta =
          typeof raw.interestDelta === "number" && Number.isFinite(raw.interestDelta)
            ? Math.max(-30, Math.min(25, Math.round(raw.interestDelta)))
            : 0;
        let interest =
          typeof raw.interest === "number" && Number.isFinite(raw.interest)
            ? clampInterest(raw.interest)
            : clampInterest(fallbackInterest + delta);
        const allowed = ["continue", "like", "ghost", "friendzone"];
        let outcome = allowed.includes(String(raw.outcome))
          ? String(raw.outcome)
          : "continue";
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
      }
    } catch {
      /* fall through to salvage */
    }
  }

  // Free models sometimes ramble — salvage a DM-like line
  const replyMatch = content.match(/"reply"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (replyMatch?.[1]) {
    const reply = replyMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').trim();
    if (reply) {
      const interest = clampInterest(fallbackInterest + 3);
      return {
        reply,
        interestDelta: interest - fallbackInterest,
        interest,
        mood: "amused",
        outcome: "continue",
      };
    }
  }

  const lines = content
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 0 &&
        l.length < 180 &&
        !/[{}]/.test(l) &&
        !/json|interest|outcome|field|must |rules?:/i.test(l),
    );
  const candidate = lines[lines.length - 1];
  if (candidate) {
    const interest = clampInterest(fallbackInterest + 2);
    return {
      reply: candidate.replace(/^["']|["']$/g, ""),
      interestDelta: interest - fallbackInterest,
      interest,
      mood: "neutral",
      outcome: "continue",
    };
  }
  return null;
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
      bio: String((body as { bio?: string }).bio ?? "").slice(0, 160),
      personality: String(body.personality ?? "friendly").slice(0, 500),
      voice: String(body.voice ?? "natural Instagram DM").slice(0, 300),
      difficulty: String((body as { difficulty?: string }).difficulty ?? "normal").slice(0, 16),
      hardMode: Boolean((body as { hardMode?: boolean }).hardMode),
      nsfw: Boolean((body as { nsfw?: boolean }).nsfw),
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

    const gender = body.gender === "male" ? "male" : "female";
    let parsed = parseRizzJson(content, interest, String(body.name ?? "them"), gender);
    // If salvage failed but content looks like a safety dump, force character reject
    if (!parsed && isSafetyDump(content)) {
      parsed = safetyFallbackReply(String(body.name ?? "them"), gender, interest);
    }
    if (!parsed) {
      res.status(502).json({
        error: "Bad AI response",
        provider,
        sample: content.slice(0, 240),
      });
      return;
    }

    // Never surface raw filter text as a bubble (Raven, Knox, anyone)
    if (isSafetyDump(parsed.reply)) {
      parsed = safetyFallbackReply(String(body.name ?? "them"), gender, interest);
    }

    res.status(200).json({ available: true, provider, ...parsed });
  } catch (err) {
    console.error("[rizz-turn]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
