/**
 * Shared Aura Judge rubric + prompt helpers (local + AI).
 */

export const JUDGE_SYSTEM_PROMPT = `You are the Aura Judge for AuraFarm — a Gen Z / Gen Alpha daily vibe game.

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

Reply with ONLY valid JSON (no markdown fences):
{"score":number,"verdict":string,"tags":string[],"breakdown":{"craft":number,"fit":number,"energy":number,"originality":number}}

Each breakdown field is 0–25. Their sum should roughly match score (within ~8).`;

export function buildJudgeUserMessage(input: {
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
    `Judge the answer now.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function parseJudgeJson(content: string): {
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

export function gradeFromScore(score: number): string {
  if (score >= 92) return "S";
  if (score >= 82) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}
