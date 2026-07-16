import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Zero-import status (aside from types) so this never 500s on cold start.
 * Lists which AI env vars Vercel actually has.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  const openrouter = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  const xai = Boolean(process.env.XAI_API_KEY?.trim());
  const groq = Boolean(process.env.GROQ_API_KEY?.trim());
  const gemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  const ollama = Boolean(
    process.env.OLLAMA_BASE_URL?.trim() || process.env.OLLAMA_ENABLED === "1",
  );

  const providers: string[] = [];
  if (xai) providers.push("xai");
  if (openrouter) providers.push("openrouter");
  if (groq) providers.push("groq");
  if (gemini) providers.push("gemini");
  if (ollama) providers.push("ollama");

  res.status(200).json({
    available: providers.length > 0,
    providers,
    hasOpenRouter: openrouter,
    hasXai: xai,
    hasGroq: groq,
    hasGemini: gemini,
    hasOllama: ollama,
    openRouterModel: process.env.OPENROUTER_MODEL || "openrouter/free",
    tip:
      providers.length === 0
        ? "No AI keys on this server. Add OPENROUTER_API_KEY in Vercel → Settings → Environment Variables → Production, then Redeploy."
        : "Keys detected. If chat is still local, the key may be invalid (OpenRouter 401 User not found) — create a new key and update the env var.",
  });
}
