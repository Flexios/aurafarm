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

const STOP = new Set([
  "the",
  "and",
  "you",
  "your",
  "yours",
  "are",
  "for",
  "with",
  "this",
  "that",
  "have",
  "just",
  "like",
  "what",
  "when",
  "where",
  "who",
  "why",
  "how",
  "was",
  "were",
  "from",
  "they",
  "them",
  "its",
  "it's",
  "im",
  "i'm",
  "ive",
  "i've",
  "dont",
  "don't",
  "cant",
  "can't",
  "about",
  "really",
  "kinda",
  "gonna",
  "wanna",
  "hey",
  "hi",
  "hello",
  "lol",
  "lmao",
  "haha",
  "omg",
  "bro",
  "pls",
  "please",
  "too",
  "very",
  "much",
  "got",
  "get",
  "got",
  "but",
  "not",
  "all",
  "any",
  "can",
  "could",
  "would",
  "should",
  "will",
  "out",
  "our",
  "also",
  "some",
  "into",
  "than",
  "then",
  "there",
  "here",
  "been",
  "being",
  "did",
  "does",
  "doing",
  "done",
  "had",
  "has",
  "her",
  "him",
  "his",
  "she",
  "he",
  "me",
  "my",
  "we",
  "us",
  "so",
  "if",
  "or",
  "as",
  "at",
  "in",
  "on",
  "to",
  "of",
  "a",
  "an",
  "is",
  "it",
  "be",
  "do",
  "up",
  "no",
  "yes",
  "ok",
  "okay",
  "u",
  "ur",
  "r",
  "ya",
  "tho",
  "though",
  "rn",
  "tbh",
  "ngl",
  "idk",
  "imo",
]);

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

function tokens(msg: string): string[] {
  return msg
    .toLowerCase()
    .replace(/[^a-z0-9\s'’]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

function snippet(msg: string, max = 42): string {
  const t = msg.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function firstQuestionTopic(msg: string): string | null {
  const m = msg.match(
    /(?:where|what|when|who|why|how|which|do you|are you|did you|is it|was it)\s+([^?!.]{2,60})/i,
  );
  if (!m?.[1]) return null;
  return m[1].trim().replace(/\s+/g, " ").slice(0, 48);
}

/** Persona-flavored answers when player asks a question */
function answerQuestion(persona: RizzPersona, topic: string | null, raw: string): string {
  const t = (topic || raw).toLowerCase();
  const id = persona.id;

  // Destination / flying
  if (/fly|flying|flight|go(ing)?|headed|destination|city|trip|travel/.test(t)) {
    if (id === "f-lina") {
      return pick([
        "lisbon for a long weekend. window seat was non-negotiable ✈️",
        "somewhere with good coffee and worse wifi. don't tell my boss",
        "golden hour layover energy. where would YOU go?",
      ]);
    }
    return pick([
      "not telling yet — spoilers 😌 where should i go?",
      "half the fun is the mystery. guess.",
    ]);
  }

  if (/name|called|dog|pet|he|she|puppy/.test(t) && id === "m-kai") {
    return pick([
      "his name is toast. yes, like breakfast. he approved your message",
      "toast. he has better rizz than me honestly",
    ]);
  }

  if (/song|setlist|encore|music|band|concert|ring|bass/.test(t) && id === "f-zoe") {
    return pick([
      "encore was unhinged. what song would you yell from the pit?",
      "if you name a good track i might actually answer 😌",
    ]);
  }

  if (/recipe|pasta|carbonara|cook|ingredient|guanciale/.test(t) && id === "m-leo") {
    return pick([
      "guanciale. egg. pecorino. attitude. no cream — we don't do crimes here",
      "trade: you bring a playlist, i bring the carbonara science",
    ]);
  }

  if (/paint|museum|art|artist|color|see/.test(t) && id === "m-jordan") {
    return pick([
      "the blue one on the left. it felt louder than the room",
      "i stood there too long. what did you notice first?",
    ]);
  }

  if (/matcha|cafe|drink|coffee|book|read/.test(t) && id === "f-maya") {
    return pick([
      "matcha was mid, vibe was not. you reading that right?",
      "cafe mode: on. what are YOU drinking rn?",
    ]);
  }

  if (/gym|leg|train|lift|workout|protein|rest/.test(t) && id === "f-nova") {
    return pick([
      "leg day. dignity optional. you train or just talk?",
      "form first, ego second. you even lift?",
    ]);
  }

  if (/night|walk|city|skyline|therapy|bus/.test(t) && id === "m-sam") {
    return pick([
      "just walking. city lights do more than people sometimes",
      "night bus route. quiet seat. you out too?",
    ]);
  }

  // Generic question responses that still echo the topic
  if (topic) {
    return pick([
      `about "${snippet(topic, 28)}" — ask me nicer and maybe 😌`,
      `hmm "${snippet(topic, 28)}"… ok i'll bite. why you asking?`,
      `good question. short answer: yes, with caveats. you?`,
    ]);
  }
  return pick([
    "curious much? i kind of like that",
    "ask again but make it interesting",
    "depends who's asking 😌",
  ]);
}

function buildContextualReply(
  persona: RizzPersona,
  msg: string,
  _interest: number,
  turn: number,
  isStoryReply: boolean,
  delta: number,
  mood: string,
): string {
  const lower = msg.toLowerCase();
  const toks = tokens(msg);
  const softHit = persona.softYes.find((s) => lower.includes(s.toLowerCase()));
  const hasQ = /\?/.test(msg) || /^(where|what|when|who|why|how|do you|are you)\b/i.test(msg);
  const topic = firstQuestionTopic(msg);
  const snip = snippet(msg, 36);

  if (mood === "creeped") {
    return pick([
      "yeah no. left on read for a reason",
      "wild message. not in a fun way",
      "…blocked energy",
    ]);
  }

  // Questions first — must actually answer
  if (hasQ && mood !== "cold") {
    return answerQuestion(persona, topic, msg);
  }

  // Early "i like you" / love-bomb
  if (/^(i )?like you\b|love you|be mine|marry me/i.test(lower) && turn < 4) {
    return pick([
      "slow down 😭 we just started talking",
      "bold. save that energy for message 5",
      "we don't even know each other's layover snacks yet",
    ]);
  }

  // Gibberish / too short nonsense
  if (toks.length === 0 && msg.length < 8) {
    return pick(["…what", "try that again in human", "keyboard smash detected"]);
  }

  // Story openers that reference content
  if (isStoryReply) {
    if (softHit) {
      return pick([
        `you clocked the ${softHit}. rare. keep going`,
        `${softHit}? ok you're actually looking at the story 😌`,
        `someone noticed the ${softHit}. dangerous.`,
      ]);
    }
    if (hasQ) return answerQuestion(persona, topic, msg);
    if (toks.length >= 2) {
      return pick([
        `"${snip}" is a real opener. i'll allow it`,
        `ok "${snip}" got a little smile out of me`,
        `story reply of the day goes to… that. say more`,
      ]);
    }
    return pick([
      "short opener. make the next one count",
      "i saw that. expand?",
      "ok you're in the chat. don't waste it",
    ]);
  }

  // Soft-yes keyword callback mid-chat
  if (softHit && delta >= 0) {
    return pick([
      `${softHit} talk? now we're speaking the same language`,
      `you keep saying ${softHit} like you mean it. i notice`,
      `ok ${softHit} energy is working on me a little`,
    ]);
  }

  // Echo a content word from their message
  const keyword = toks.find((w) => w.length >= 4) || toks[0];
  if (keyword && delta >= 4) {
    return pick([
      `"${keyword}" — explain yourself`,
      `wait go back to the ${keyword} part`,
      `interesting that you went with ${keyword}. continue`,
      `ok but ${keyword}? unpack that`,
    ]);
  }

  if (delta >= 8) {
    return pick([
      `not gonna lie… "${snip}" kind of worked`,
      "you're getting better at this. annoying",
      "alright that one landed. what's next?",
      pick(persona.replies.warm),
    ]);
  }

  if (delta < 0) {
    return pick([
      "mid",
      "try again with more personality",
      pick(persona.replies.cold),
      "i'm still here but barely",
    ]);
  }

  // Neutral continue — still reference them when possible
  if (keyword) {
    return pick([
      `hmm. the ${keyword} thing though…`,
      `i heard you. about ${keyword} — more?`,
      pick(persona.replies.warm.concat(persona.replies.cold)),
    ]);
  }

  return pick(persona.replies.warm.concat(persona.replies.cold));
}

/**
 * Offline interest + contextual reply engine for Rizz Trainer.
 * Actually reacts to what the player typed (questions, keywords, story topics).
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
    if (msg.length >= 12 && msg.length <= 160) delta += 6;
    else if (msg.length > 160) delta += 2;
    else if (msg.length >= 6) delta += 2;
    else delta += 0;

    if (/\?/.test(msg)) delta += 5; // questions engage
    if (/[\u{1F300}-\u{1FAFF}]/u.test(msg)) delta += 2;
    if (includesAny(lower, persona.softYes)) delta += 12;
    if (isStoryReply) delta += 4;

    // Reference story caption words
    const capWords = tokens(persona.storyCaption);
    if (capWords.some((w) => lower.includes(w))) delta += 6;

    if (/^(hey|hi|hello|wyd|sup)\b/i.test(msg) && msg.length < 12) delta -= 6;
    if (/you('re| are) (so )?(hot|sexy|beautiful)/i.test(msg)) delta -= 8;
    if (/^(i )?like you\b|marry me|be mine|i love you/i.test(msg) && turn < 4) delta -= 10;

    // Low-effort noise
    if (/^(lol|ok|k|sure|idk|lmao|haha|yes|no|nah)\s*$/i.test(msg)) delta -= 4;
    if (/^[a-z]{1,5}$/i.test(msg) && !STOP.has(lower)) delta -= 3; // "ejdw"

    if (msg.split(/\s+/).length >= 6) delta += 3;
    if (msg.split(/\s+/).length >= 10) delta += 2;

    mood = delta >= 10 ? "warm" : delta >= 3 ? "amused" : delta < 0 ? "cold" : "neutral";
  }

  delta += Math.floor(Math.random() * 3) - 1;

  let next = clamp(interest + delta);
  let outcome: RizzOutcome = "continue";
  let reaction: string | undefined;

  let reply = buildContextualReply(persona, msg, interest, turn, isStoryReply, delta, mood);

  if (mood === "creeped" || next <= GHOST_AT) {
    outcome = "ghost";
    next = Math.min(next, GHOST_AT);
    reply = pick(
      persona.replies.ghost.filter(Boolean).concat(["yeah i'm out", "left on read", "…"]),
    );
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
    reaction = pick(["😊", "🔥", "✨", "😌"]);
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
