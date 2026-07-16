import { aestheticById } from "../data/aesthetics";
import type { AestheticCore, Challenge, ScoreBreakdown } from "../types";

export interface AiJudgeResult {
  score: number;
  verdict: string;
  tags: string[];
  breakdown?: ScoreBreakdown;
  /** Backend provider that scored (e.g. openrouter, groq) */
  provider?: string;
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

async function fetchJudgeOnce(
  challenge: Challenge,
  answer: string,
  core: AestheticCore,
  streak: number,
): Promise<AiJudgeResult | null> {
  const aesthetic = aestheticById(core);
  const res = await fetch("/api/judge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: challenge.prompt,
      answer,
      core,
      title: challenge.title,
      hint: challenge.hint,
      category: challenge.category,
      coreLabel: aesthetic.label,
      streak,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as AiJudgeResult & {
    available?: boolean;
    provider?: string;
  };
  if (typeof data.score !== "number") return null;
  return {
    score: data.score,
    verdict: data.verdict || "AI aura locked in.",
    tags: data.tags?.length ? data.tags : ["ai-judged"],
    breakdown: data.breakdown,
    provider: data.provider || undefined,
  };
}

/** Call cloud judge; one automatic retry on soft failure. */
export async function judgeWithAi(
  challenge: Challenge,
  answer: string,
  core: AestheticCore,
  streak = 0,
): Promise<AiJudgeResult | null> {
  try {
    const first = await fetchJudgeOnce(challenge, answer, core, streak);
    if (first) return first;
  } catch {
    /* retry below */
  }

  try {
    await new Promise((r) => setTimeout(r, 450));
    return await fetchJudgeOnce(challenge, answer, core, streak);
  } catch {
    return null;
  }
}
