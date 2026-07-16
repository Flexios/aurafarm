/**
 * Multi-provider LLM helper (server / Vite middleware only).
 * Order: SpaceXAI (xAI) → Groq (free tier) → Gemini (free tier) → Ollama (local free).
 * No provider is truly unlimited forever in the cloud — free tiers have rate limits.
 */

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmEnv = Record<string, string | undefined>;

type OpenAiProvider = {
  kind: "openai";
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

type GeminiProvider = {
  kind: "gemini";
  name: "gemini";
  apiKey: string;
  model: string;
};

type Provider = OpenAiProvider | GeminiProvider;

function envGet(env: LlmEnv, key: string): string {
  return String(env[key] ?? process.env[key] ?? "").trim();
}

/** Resolve configured providers (first that works wins at call time). */
export function listLlmProviders(env: LlmEnv = {}): Provider[] {
  const out: Provider[] = [];

  const xai = envGet(env, "XAI_API_KEY");
  if (xai) {
    out.push({
      kind: "openai",
      name: "xai",
      baseUrl: "https://api.x.ai/v1",
      apiKey: xai,
      model: envGet(env, "XAI_MODEL") || "grok-4.5",
    });
  }

  // Free tier: https://console.groq.com — OpenAI-compatible, no card required for free quota
  const groq = envGet(env, "GROQ_API_KEY");
  if (groq) {
    out.push({
      kind: "openai",
      name: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: groq,
      model: envGet(env, "GROQ_MODEL") || "llama-3.3-70b-versatile",
    });
  }

  // Free tier: https://aistudio.google.com/apikey
  const gemini = envGet(env, "GEMINI_API_KEY");
  if (gemini) {
    out.push({
      kind: "gemini",
      name: "gemini",
      apiKey: gemini,
      model: envGet(env, "GEMINI_MODEL") || "gemini-2.0-flash",
    });
  }

  // Local free unlimited (dev machine only — not reachable from Vercel)
  const ollamaBase = envGet(env, "OLLAMA_BASE_URL") || envGet(env, "OLLAMA_HOST");
  if (ollamaBase || envGet(env, "OLLAMA_ENABLED") === "1") {
    const host = (ollamaBase || "http://127.0.0.1:11434").replace(/\/$/, "");
    const baseUrl = host.endsWith("/v1") ? host : `${host}/v1`;
    out.push({
      kind: "openai",
      name: "ollama",
      baseUrl,
      apiKey: envGet(env, "OLLAMA_API_KEY") || "ollama",
      model: envGet(env, "OLLAMA_MODEL") || "llama3.2",
    });
  }

  return out;
}

export function llmAvailable(env: LlmEnv = {}): boolean {
  return listLlmProviders(env).length > 0;
}

export function llmProviderNames(env: LlmEnv = {}): string[] {
  return listLlmProviders(env).map((p) => p.name);
}

async function callOpenAi(
  p: OpenAiProvider,
  messages: LlmMessage[],
  temperature: number,
  maxTokens: number,
): Promise<string | null> {
  const resp = await fetch(`${p.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${p.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: p.model,
      temperature,
      max_tokens: maxTokens,
      messages,
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    console.warn(`[llm] ${p.name} failed ${resp.status}: ${detail.slice(0, 180)}`);
    return null;
  }
  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? null;
}

async function callGemini(
  p: GeminiProvider,
  messages: LlmMessage[],
  temperature: number,
  maxTokens: number,
): Promise<string | null> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const rest = messages.filter((m) => m.role !== "system");
  const contents = rest.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  // Gemini needs alternating user/model; collapse if needed by joining
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(p.model)}:generateContent?key=${encodeURIComponent(p.apiKey)}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents: contents.length
        ? contents
        : [{ role: "user", parts: [{ text: "…" }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    console.warn(`[llm] gemini failed ${resp.status}: ${detail.slice(0, 180)}`);
    return null;
  }
  const data = (await resp.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((x) => x.text ?? "").join("").trim();
  return text || null;
}

/**
 * Try each configured provider until one returns content.
 */
export async function chatCompletion(
  messages: LlmMessage[],
  opts: {
    temperature?: number;
    maxTokens?: number;
    env?: LlmEnv;
  } = {},
): Promise<{ content: string; provider: string } | null> {
  const env = opts.env ?? {};
  const temperature = opts.temperature ?? 0.7;
  const maxTokens = opts.maxTokens ?? 280;
  const providers = listLlmProviders(env);
  if (!providers.length) return null;

  for (const p of providers) {
    try {
      const content =
        p.kind === "openai"
          ? await callOpenAi(p, messages, temperature, maxTokens)
          : await callGemini(p, messages, temperature, maxTokens);
      if (content && content.trim()) {
        return { content: content.trim(), provider: p.name };
      }
    } catch (err) {
      console.warn(`[llm] ${p.name} error`, err);
    }
  }
  return null;
}
