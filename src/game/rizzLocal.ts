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
const GHOST_AT = 12;

/** Harsh language that should tank interest — never reward this */
const INSULTS = [
  "stupid",
  "idiot",
  "dumb",
  "ugly",
  "bitch",
  "whore",
  "slut",
  "cunt",
  "hoe",
  "hoes",
  "asshole",
  "dickhead",
  "fuck you",
  "fuck u",
  "f u ",
  "shithead",
  "retard",
  "retarded",
  "hate you",
  "kill yourself",
  "kys",
  "fat ass",
  "you suck",
  "loser",
  "trash",
  "pathetic",
  "disgusting",
  "worthless",
  "dumbass",
  "moron",
  "pig",
  "skank",
  "thot",
];

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
  "suck my",
  "sit on",
  "dick pic",
  "anyone's dick",
  "your dick",
  "my dick",
  "pussy",
  "tits",
  "boobs",
];

const STOP = new Set(
  "the and you your yours are for with this that have just like what when where who why how was were from they them its im ive dont cant about really kinda gonna wanna hey hi hello lol lmao haha omg bro pls please too very much got get but not all any can could would should will out our also some into than then there here been being did does doing done had has her him his she he me my we us so if or as at in on to of a an is it be do up no yes ok okay u ur r ya tho though rn tbh ngl idk imo".split(
    " ",
  ),
);

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

function isInsult(msg: string): boolean {
  const lower = msg.toLowerCase();
  if (includesAny(lower, INSULTS)) return true;
  // slur-ish compounds
  if (/\b(dumb|ugly|stupid|fat)\s+(ass|bitch|hoe|whore|slut)\b/i.test(msg)) return true;
  if (/\byou\s+(are|'re)\s+(ugly|stupid|dumb|pathetic|trash)\b/i.test(msg)) return true;
  return false;
}

function isCreep(msg: string, persona: RizzPersona): boolean {
  const lower = msg.toLowerCase();
  return includesAny(lower, CREEP) || includesAny(lower, persona.hardNos);
}

type Intent =
  | "insult"
  | "creep"
  | "lovebomb"
  | "low_effort"
  | "ask_where"
  | "ask_what"
  | "ask_how"
  | "ask_name"
  | "ask_yesno"
  | "compliment"
  | "topic_hit"
  | "story_react"
  | "flirt"
  | "generic";

function detectIntent(
  msg: string,
  persona: RizzPersona,
  isStoryReply: boolean,
): Intent {
  const lower = msg.toLowerCase().trim();
  if (isInsult(msg)) return "insult";
  if (isCreep(msg, persona)) return "creep";
  if (/^(i )?like you\b|love you|be mine|marry me|you're the one/i.test(lower) )
    return "lovebomb";
  if (
    /^(lol|ok|k|sure|idk|lmao|haha|yes|no|nah|sup|hey|hi)\s*$/i.test(lower) ||
    (lower.length < 6 && tokens(msg).length === 0)
  )
    return "low_effort";

  if (
    /\b(where|wher|were)\b/.test(lower) &&
    /\b(fly|flying|go(ing)?|headed|trip|travel|to)\b/.test(lower)
  )
    return "ask_where";
  if (/\b(what('?s| is)? your name|what do you call|dog'?s name|name)\b/i.test(lower))
    return "ask_name";
  if (/\b(how|how's|hows)\b/.test(lower) && lower.includes("?")) return "ask_how";
  if (
    /\b(do you|are you|is it|was it|did you|can you|would you)\b/.test(lower) ||
    (lower.includes("?") && /^(enjoying|like|love|want)\b/i.test(lower))
  )
    return "ask_yesno";
  if (lower.includes("?") || /^(where|what|when|who|why|how)\b/i.test(lower))
    return "ask_what";

  if (
    /\b(pretty|beautiful|gorgeous|stunning|cute fit|good photo|great shot|love this|fire story|looks good)\b/i.test(
      lower,
    )
  )
    return "compliment";

  if (includesAny(lower, persona.softYes) || tokens(persona.storyCaption).some((w) => lower.includes(w)))
    return isStoryReply ? "story_react" : "topic_hit";

  if (/\b(haha|lol|lmao|😏|😉|🔥|wink|tease|flirt)\b/i.test(lower)) return "flirt";
  if (isStoryReply) return "story_react";
  return "generic";
}

/** Persona-specific facts for adaptive answers */
function personaFacts(p: RizzPersona): {
  where: string[];
  doing: string[];
  drink?: string[];
  pet?: string[];
  music?: string[];
  food?: string[];
  vibeReply: string[];
} {
  switch (p.id) {
    case "f-lina":
      return {
        where: [
          "lisbon for a long weekend — window seat was non-negotiable ✈️",
          "chasing golden hour somewhere near the coast. don't snitch to my boss",
          "layover city energy. halfway to somewhere warmer",
        ],
        doing: [
          "staring at clouds and pretending i'm in a movie",
          "trying not to spill matcha at 30,000 feet",
        ],
        drink: [
          "airport matcha is a crime but i'm committing it ☕",
          "it's mid matcha. the view is carrying",
        ],
        vibeReply: [
          "travel brain is loud today",
          "soft launch: romanticize the flight",
        ],
      };
    case "f-maya":
      return {
        where: ["my usual cafe corner. wifi password is a personality test"],
        doing: ["nursing this matcha and people-watching"],
        drink: [
          "matcha. main character tax included ✨",
          "it's decent today. not life-changing. still cute though",
        ],
        vibeReply: ["cafe soft-launch mode: on"],
      };
    case "f-nova":
      return {
        where: ["gym. leg day. dignity optional"],
        doing: ["finishing sets and ignoring my playlist skips"],
        vibeReply: ["if you don't train, don't talk 😤"],
      };
    case "f-zoe":
      return {
        where: ["front row. ears ringing. no regrets"],
        doing: ["processing the encore like a religion"],
        music: [
          "encore went unhinged. name a song or leave 😌",
          "bass still in my chest. what do YOU blast after a show?",
        ],
        vibeReply: ["concert brain only. text accordingly"],
      };
    case "m-jordan":
      return {
        where: ["museum quiet wing. the blue painting won"],
        doing: ["staring at art longer than socially normal"],
        vibeReply: ["say something real or keep scrolling"],
      };
    case "m-kai":
      return {
        where: ["dog park. toast is the CEO"],
        doing: ["PR for a golden retriever basically"],
        pet: [
          "his name is toast. breakfast legend 🐶",
          "toast says hi. he's pickier than me about openers",
        ],
        vibeReply: ["dog dad hours"],
      };
    case "m-leo":
      return {
        where: ["my kitchen. 1am. carbonara or death"],
        doing: ["plating like it's a love language"],
        food: [
          "guanciale, egg, pecorino, attitude. no cream — we don't do crimes",
          "carbonara doesn't need your opinions. only respect 🍝",
        ],
        vibeReply: ["feed the chat or starve"],
      };
    case "m-sam":
      return {
        where: ["night bus route. city lights doing therapy"],
        doing: ["walking until my head gets quiet"],
        vibeReply: ["soft energy only after midnight"],
      };
    default:
      return {
        where: ["around. mystery stays free"],
        doing: ["existing with intention"],
        vibeReply: ["say something that lands"],
      };
  }
}

function answerWhere(p: RizzPersona): string {
  return pick(personaFacts(p).where);
}

function answerHow(p: RizzPersona, msg: string): string {
  const lower = msg.toLowerCase();
  const f = personaFacts(p);
  if (/\b(matcha|drink|coffee|latte)\b/.test(lower) && f.drink) return pick(f.drink);
  if (/\b(dog|pet|toast|puppy)\b/.test(lower) && f.pet) return pick(f.pet);
  if (/\b(song|music|concert|encore)\b/.test(lower) && f.music) return pick(f.music);
  if (/\b(pasta|food|carbonara|cook)\b/.test(lower) && f.food) return pick(f.food);
  if (/\b(flight|flying|trip)\b/.test(lower)) return pick(f.doing.concat(f.where));
  return pick([
    ...f.doing,
    "better now that the chat got interesting",
    "honestly? solid 7. your message might push it to 8",
  ]);
}

function answerYesNo(p: RizzPersona, msg: string): string {
  const lower = msg.toLowerCase();
  const f = personaFacts(p);
  if (/\b(matcha|enjoying)\b/.test(lower)) {
    if (f.drink) return pick(f.drink);
    return pick([
      "enjoying the view more than the drink tbh",
      "it's fine. the company in my DMs will decide the rating 😌",
    ]);
  }
  if (/\b(single|taken|dating)\b/.test(lower)) {
    return pick([
      "bold question for a story reply",
      "depends if this chat stays cute",
      "status: unimpressed until proven otherwise",
    ]);
  }
  if (/\b(train|gym|lift)\b/.test(lower) && p.id === "f-nova") {
    return pick(["obviously. you?", "leg day doesn't lie. do you?"]);
  }
  return pick([
    "maybe. impress me and i'll upgrade that to yes",
    "not answering free. earn it with a better follow-up",
    pick(f.vibeReply),
  ]);
}

function replyForIntent(
  intent: Intent,
  persona: RizzPersona,
  msg: string,
  turn: number,
  isStoryReply: boolean,
  history: RizzChatMessage[],
): { reply: string; delta: number; mood: string; reaction?: string; forceGhost?: boolean } {
  const f = personaFacts(persona);
  const soft = persona.softYes.find((s) => msg.toLowerCase().includes(s.toLowerCase()));
  const prevUser = [...history].reverse().find((m) => m.role === "user" && m.text !== msg);

  switch (intent) {
    case "insult":
      return {
        reply: pick([
          "yeah, no. that's a block, not a vibe",
          "insults don't get you closer. they get you left on read",
          "wild strategy. terrible results. bye",
          "disgusting opener. conversation over",
          "i don't entertain mean. disappear",
        ]),
        delta: -35,
        mood: "insulted",
        forceGhost: true,
      };
    case "creep":
      return {
        reply: pick([
          "hard pass. keep that energy offline",
          "creepy. interest just nosedived",
          "absolutely not. don't message me again",
          pick(persona.replies.ghost.filter(Boolean).concat(["…"])),
        ]),
        delta: -28,
        mood: "creeped",
        forceGhost: turn >= 1,
      };
    case "lovebomb":
      return {
        reply: pick([
          "slow down 😭 we just started talking",
          "save the 'i like you' for when you've earned a real conversation",
          "too fast. try curiosity instead of a proposal",
          "we don't even know each other's snacks yet",
        ]),
        delta: -12,
        mood: "cold",
      };
    case "low_effort":
      return {
        reply: pick([
          "…that's it?",
          "give me a real sentence and i'll give you a real reply",
          "low effort gets low interest. try again",
          "keyboard smash detected. human mode please",
        ]),
        delta: -8,
        mood: "cold",
      };
    case "ask_where":
      return {
        reply: answerWhere(persona),
        delta: 10,
        mood: "warm",
        reaction: "✈️",
      };
    case "ask_name":
      return {
        reply: f.pet
          ? pick(f.pet)
          : pick([
              `i'm ${persona.name}. you already knew that though 😌`,
              `${persona.name}. now make the next question better than 'what's your name'`,
            ]),
        delta: 8,
        mood: "amused",
      };
    case "ask_how":
      return {
        reply: answerHow(persona, msg),
        delta: 9,
        mood: "warm",
      };
    case "ask_yesno":
      return {
        reply: answerYesNo(persona, msg),
        delta: 8,
        mood: "amused",
        reaction: "😌",
      };
    case "ask_what":
      return {
        reply: pick([
          answerHow(persona, msg),
          ...f.doing,
          soft
            ? `you mean the ${soft}? yeah — that's the whole plot`
            : "good question. short version: romanticizing the moment. long version: ask a follow-up",
        ]),
        delta: 7,
        mood: "amused",
      };
    case "compliment":
      return {
        reply: pick([
          "ok that was actually sweet. dangerous",
          "noted. flattery works when it's specific — you almost got there",
          isStoryReply
            ? "story compliment accepted. now say something clever"
            : "careful, i collect good lines",
          pick(persona.replies.warm),
        ]),
        delta: 11,
        mood: "warm",
        reaction: "✨",
      };
    case "story_react":
      if (soft) {
        return {
          reply: pick([
            `you clocked the ${soft}. rare. keep going`,
            `${soft} mention on a story reply? ok you're paying attention`,
            `someone actually looked. ${soft} was the detail that got you in`,
          ]),
          delta: 12,
          mood: "warm",
          reaction: "🔥",
        };
      }
      return {
        reply: pick([
          `"${snippet(msg, 34)}" — not bad for a story reply`,
          "ok you're in. make the next line about the photo not the void",
          pick(f.vibeReply),
          pick(persona.replies.warm),
        ]),
        delta: 6,
        mood: "amused",
      };
    case "topic_hit":
      return {
        reply: pick([
          soft
            ? `${soft} talk? now we're speaking the same language`
            : "ok you found a thread. pull it",
          soft
            ? `you keep circling ${soft}. i notice — and i like that you notice`
            : pick(persona.replies.warm),
          prevUser
            ? `earlier you said something half-interesting. this ${soft || "line"} is better`
            : pick(f.vibeReply),
        ]),
        delta: 11,
        mood: "warm",
        reaction: "😊",
      };
    case "flirt":
      return {
        reply: pick([
          "careful. that almost worked",
          "flirt detected. interest bar says… maybe",
          "you're getting warmer. don't get cocky",
          pick(persona.replies.warm),
        ]),
        delta: 9,
        mood: "warm",
        reaction: "😉",
      };
    default: {
      const kw = tokens(msg).find((w) => w.length >= 4);
      if (kw) {
        return {
          reply: pick([
            `"${kw}" — unpack that for me`,
            `wait, go back to the ${kw} part`,
            `interesting you chose ${kw}. continue, don't stall`,
          ]),
          delta: 4,
          mood: "neutral",
        };
      }
      return {
        reply: pick([
          "i'm listening. make it land",
          pick(persona.replies.warm.concat(persona.replies.cold)),
          "give me a hook. detail, joke, or a real question",
        ]),
        delta: 2,
        mood: "neutral",
      };
    }
  }
}

/**
 * Offline adaptive reply engine for Rizz Trainer.
 * Insults/creep tank hard; questions get real persona answers; topics echo.
 */
export function rizzLocalTurn(
  persona: RizzPersona,
  playerMessage: string,
  interest: number,
  turn: number,
  isStoryReply: boolean,
  history: RizzChatMessage[] = [],
): RizzTurnResult {
  const msg = playerMessage.trim();
  const intent = detectIntent(msg, persona, isStoryReply);
  const built = replyForIntent(intent, persona, msg, turn, isStoryReply, history);

  let delta = built.delta;
  // Length quality (never rescues insults)
  if (intent !== "insult" && intent !== "creep") {
    if (msg.length >= 20 && msg.length <= 160) delta += 3;
    else if (msg.length >= 10) delta += 1;
    if (msg.split(/\s+/).length >= 8) delta += 2;
    // tiny noise
    delta += Math.floor(Math.random() * 3) - 1;
  }

  let next = clamp(interest + delta);
  let outcome: RizzOutcome = "continue";
  let mood = built.mood;
  let reply = built.reply;
  let reaction = built.reaction;

  if (built.forceGhost || intent === "insult" || next <= GHOST_AT) {
    outcome = "ghost";
    next = Math.min(next, intent === "insult" ? 5 : GHOST_AT);
    mood = intent === "insult" ? "insulted" : "ghost";
    if (intent === "insult") {
      // keep insult reply
    } else if (!reply) {
      reply = pick(persona.replies.ghost.filter(Boolean).concat(["…", "left on read"]));
    }
  } else if (next >= LIKE_AT || (turn >= 5 && next >= 70 && intent !== "low_effort")) {
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
