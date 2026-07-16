import type { RizzPersona } from "../data/rizzScenarios";
import type { RizzChatMessage, RizzTurnResult } from "../game/rizzLocal";
import { rizzLocalTurn } from "../game/rizzLocal";

export async function rizzTurnWithAi(
  persona: RizzPersona,
  history: RizzChatMessage[],
  playerMessage: string,
  interest: number,
  turn: number,
  isStoryReply: boolean,
): Promise<RizzTurnResult | null> {
  try {
    const res = await fetch("/api/rizz-turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personaId: persona.id,
        gender: persona.gender,
        name: persona.name,
        handle: persona.handle,
        vibe: persona.vibe,
        storyCaption: persona.storyCaption,
        personality: persona.personality,
        voice: persona.voice,
        hardNos: persona.hardNos,
        softYes: persona.softYes,
        history: history.slice(-12),
        playerMessage,
        interest,
        turn,
        isStoryReply,
      }),
    });
    if (!res.ok) {
      let detail = "";
      try {
        const err = (await res.json()) as { error?: string; detail?: string };
        detail = err.error || err.detail || res.statusText;
      } catch {
        detail = res.statusText;
      }
      console.warn("[rizz] AI HTTP", res.status, detail);
      return null;
    }
    const data = (await res.json()) as RizzTurnResult & {
      available?: boolean;
      provider?: string;
    };
    if (typeof data.interest !== "number" || !data.reply) return null;
    return {
      reply: data.reply,
      interestDelta: data.interestDelta ?? 0,
      interest: data.interest,
      mood: data.mood || "neutral",
      outcome: data.outcome || "continue",
      reaction: data.reaction,
      provider: data.provider,
    };
  } catch (e) {
    console.warn("[rizz] AI fetch failed", e);
    return null;
  }
}

/** AI if available, else local. */
export async function rizzTurn(
  persona: RizzPersona,
  history: RizzChatMessage[],
  playerMessage: string,
  interest: number,
  turn: number,
  isStoryReply: boolean,
  preferAi: boolean,
): Promise<RizzTurnResult & { source: "ai" | "local"; provider?: string }> {
  if (preferAi) {
    const ai = await rizzTurnWithAi(
      persona,
      history,
      playerMessage,
      interest,
      turn,
      isStoryReply,
    );
    if (ai) return { ...ai, source: "ai", provider: ai.provider };
  }
  return {
    ...rizzLocalTurn(persona, playerMessage, interest, turn, isStoryReply, history),
    source: "local",
  };
}
