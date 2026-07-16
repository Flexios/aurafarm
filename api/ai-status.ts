import type { VercelRequest, VercelResponse } from "@vercel/node";
import { llmAvailable, llmProviderNames } from "./_lib/llm";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const providers = llmProviderNames();
    res.status(200).json({
      available: llmAvailable(),
      providers,
      hasOpenRouter: Boolean(process.env.OPENROUTER_API_KEY),
      hasXai: Boolean(process.env.XAI_API_KEY),
      hasGroq: Boolean(process.env.GROQ_API_KEY),
      hasGemini: Boolean(process.env.GEMINI_API_KEY),
      openRouterModel: process.env.OPENROUTER_MODEL || "openrouter/free",
    });
  } catch (err) {
    res.status(500).json({
      available: false,
      error: err instanceof Error ? err.message : "status failed",
    });
  }
}
