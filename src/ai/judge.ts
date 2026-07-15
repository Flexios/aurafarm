import type { AestheticCore, Challenge } from "../types";

export interface AiJudgeResult {
  score: number;
  verdict: string;
  tags: string[];
}

export async function checkAiAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/ai-status");
    if (!res.ok) return false;
    const data = (await res.json()) as { available?: boolean };
    return Boolean(data.available);
  } catch {
    return false;
  }
}

export async function judgeWithAi(
  challenge: Challenge,
  answer: string,
  core: AestheticCore,
): Promise<AiJudgeResult | null> {
  try {
    const res = await fetch("/api/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: challenge.prompt,
        answer,
        core,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as AiJudgeResult & { available?: boolean };
    if (typeof data.score !== "number") return null;
    return {
      score: data.score,
      verdict: data.verdict || "AI aura locked in.",
      tags: data.tags?.length ? data.tags : ["ai-judged"],
    };
  } catch {
    return null;
  }
}
