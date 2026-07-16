import type { VercelRequest, VercelResponse } from "@vercel/node";
import { llmAvailable, llmProviderNames } from "../src/server/llm";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const providers = llmProviderNames();
  res.status(200).json({
    available: llmAvailable(),
    providers,
  });
}
