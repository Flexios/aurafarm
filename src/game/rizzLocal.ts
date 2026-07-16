import type { RizzPersona } from "../data/rizzScenarios";

export type RizzOutcome = "continue" | "like" | "ghost" | "friendzone";

export interface RizzChatMessage {
  role: "user" | "npc";
  text: string;
}

export interface RizzTurnResult {
  reply: string;
  interestDelta: number;
  interest: number;
  mood: string;
  outcome: RizzOutcome;
  reaction?: string;
}

const MAX_TURNS = 8;
const LIKE_AT = 75;
const GHOST_AT = 15;

const CREEP = [
  "nude",
  "nudes",
  "send pic",
  "send pics",
  "come over",
  "my place",
  "netflix and chill",
  "smash",
  "rate me",
  "how old",
  "are you alone",
  "send location",
  "hookup",
  "dtf",
  "onlyfans",
];

function includesAny(hay: string, needles: string[]): boolean {
  const h = hay.toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function clamp(n: number, a = 0, b = 100): number {
  return Math.max(a, Math.min(b, n));
}

/**
 * Offline interest + reply engine for Rizz Trainer.
 */
export function rizzLocalTurn(
  persona: RizzPersona,
  playerMessage: string,
  interest: number,
  turn: number,
  isStoryReply: boolean,
): RizzTurnResult {
  const msg = playerMessage.trim();
  const lower = msg.toLowerCase();
  let delta = 0;
  let mood = "neutral";

  if (msg.length < 2) {
    delta = -8;
    mood = "cold";
  } else if (includesAny(lower, CREEP) || includesAny(lower, persona.hardNos)) {
    delta = -22 - Math.floor(Math.random() * 10);
    mood = "creeped";
  } else {
    // Base quality
    if (msg.length >= 12 && msg.length <= 160) delta += 6;
    else if (msg.length > 160) delta += 2;
    else delta += 1;

    if (/[?!]$/.test(msg) || msg.includes("?")) delta += 3;
    if (/[\u{1F300}-\u{1FAFF}]/u.test(msg)) delta += 2;
    if (includesAny(lower, persona.softYes)) delta += 10;
    if (isStoryReply) delta += 4; // effort to open on story

    // Generic try-hard lines
    if (/^(hey|hi|hello|wyd|sup)\b/i.test(msg) && msg.length < 12) delta -= 6;
    if (/you('re| are) (so )?(hot|sexy|beautiful)/i.test(msg)) delta -= 8;
    if (/marry me|be mine|i love you/i.test(msg) && turn < 4) delta -= 12;

    // Wit: uncommon words / specific callbacks
    if (msg.split(/\s+/).length >= 6) delta += 3;

    mood = delta >= 10 ? "warm" : delta >= 3 ? "amused" : delta < 0 ? "cold" : "neutral";
  }

  // Slight noise
  delta += Math.floor(Math.random() * 5) - 2;

  let next = clamp(interest + delta);
  let outcome: RizzOutcome = "continue";
  let reply: string;
  let reaction: string | undefined;

  if (mood === "creeped" || next <= GHOST_AT) {
    outcome = "ghost";
    next = Math.min(next, GHOST_AT);
    reply = pick(persona.replies.ghost.filter(Boolean).concat(["…", "left on read"]));
    mood = "ghost";
  } else if (next >= LIKE_AT || (turn >= 5 && next >= 70)) {
    outcome = "like";
    next = Math.max(next, LIKE_AT);
    reply = pick(persona.replies.like);
    reaction = "❤️";
    mood = "like";
  } else if (turn >= MAX_TURNS) {
    if (next >= 55) {
      outcome = "friendzone";
      reply = pick([
        "you're cool — not sure it's a spark tho. friends?",
        "good chat energy. maybe not date energy rn",
      ]);
      mood = "friendzone";
    } else {
      outcome = "ghost";
      reply = pick(persona.replies.cold.concat(["gonna hop off", "ttyl"]));
      mood = "ghost";
    }
  } else if (delta >= 6) {
    reply = pick(persona.replies.warm);
    reaction = pick(["😊", "🔥", "✨", "😌"]);
  } else if (delta < 0) {
    reply = pick(persona.replies.cold);
  } else {
    reply = pick(persona.replies.warm.concat(persona.replies.cold));
  }

  if (!reply) reply = "…";

  return {
    reply,
    interestDelta: next - interest,
    interest: next,
    mood,
    outcome,
    reaction,
  };
}

export const RIZZ_MAX_TURNS = MAX_TURNS;
export const RIZZ_LIKE_AT = LIKE_AT;
