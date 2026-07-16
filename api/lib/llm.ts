/**
 * Serverless multi-provider LLM (used only from /api/*).
 * Order: xAI → OpenRouter → Groq → Gemini → Ollama
 */

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAiProvider = {
  kind: "openai";
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  headers?: Record<string, string>;
};

type GeminiProvider = {
  kind: "gemini";
  name: "gemini";
  apiKey: string;
  model: string;
};

type Provider = OpenAiProvider | GeminiProvider;

function env(key: string): string {
  return String(process.env[key] ?? "").trim();
}

export function listProviders(): Provider[] {
  const out: Provider[] = [];

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
    const site =
      env("OPENROUTER_SITE_URL") || env("APP_URL") || "https://aurafarm-chi.vercel.app";
    out.push({
      kind: "openai",
      name: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: openrouter,
      model: env("OPENROUTER_MODEL") || "openrouter/free",
      headers: {
        "HTTP-Referer": site,
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

  const ollamaBase = env("OLLAMA_BASE_URL") || env("OLLAMA_HOST");
  if (ollamaBase || env("OLLAMA_ENABLED") === "1") {
    const host = (ollamaBase || "http://127.0.0.1:11434").replace(/\/$/, "");
    const baseUrl = host.endsWith("/v1") ? host : `${host}/v1`;
    out.push({
      kind: "openai",
      name: "ollama",
      baseUrl,
      apiKey: env("OLLAMA_API_KEY") || "ollama",
      model: env("OLLAMA_MODEL") || "llama3.2",
    });
  }

  return out;
}

export function llmAvailable(): boolean {
  return listProviders().length > 0;
}

export function llmProviderNames(): string[] {
  return listProviders().map((p) => p.name);
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
      ...(p.headers ?? {}),
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
    console.warn(`[llm] ${p.name} ${resp.status}: ${detail.slice(0, 300)}`);
    return null;
  }
  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  return content?.trim() ? content.trim() : null;
}

async function callGemini(
  p: GeminiProvider,
  messages: LlmMessage[],
  temperature: number,
  maxTokens: number,
): Promise<string | null> {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const rest = messages.filter((m) => m.role !== "system");
  const contents = rest.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(p.model)}:generateContent?key=${encodeURIComponent(p.apiKey)}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents: contents.length ? contents : [{ role: "user", parts: [{ text: "…" }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    console.warn(`[llm] gemini ${resp.status}: ${detail.slice(0, 300)}`);
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

export async function chatCompletion(
  messages: LlmMessage[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<{ content: string; provider: string } | null> {
  const temperature = opts.temperature ?? 0.7;
  const maxTokens = opts.maxTokens ?? 280;
  const providers = listProviders();
  if (!providers.length) return null;

  for (const p of providers) {
    try {
      const content =
        p.kind === "openai"
          ? await callOpenAi(p, messages, temperature, maxTokens)
          : await callGemini(p, messages, temperature, maxTokens);
      if (content) return { content, provider: p.name };
    } catch (err) {
      console.warn(`[llm] ${p.name} threw`, err);
    }
  }
  return null;
}
