import type { RizzPersona } from "../data/rizzScenarios";
import type { RizzChatMessage } from "./rizzLocal";

export interface CoachAdvice {
  /** One-line status for the coach header */
  status: string;
  /** Short coaching bullets */
  tips: string[];
  /** Suggested lines the player can insert */
  lines: string[];
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(...parts: (string | number)[]): number {
  const s = parts.join("|");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shufflePick<T>(arr: T[], n: number, rng: () => number, exclude: Set<string> = new Set()): T[] {
  const pool = arr
    .map((x) => String(x).trim())
    .filter((x) => x.length >= 4 && !exclude.has(x.toLowerCase()));
  const unique = Array.from(new Set(pool));
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [unique[i], unique[j]] = [unique[j]!, unique[i]!];
  }
  return unique.slice(0, n) as unknown as T[];
}

function lastOf(history: RizzChatMessage[], role: "user" | "npc"): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.role === role) return history[i]!.text;
  }
  return null;
}

function snippet(text: string, max = 40): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function tokens(msg: string): string[] {
  return msg
    .toLowerCase()
    .replace(/[^a-z0-9\s'’]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4);
}

/** Persona-specific line banks (story openers + mid-chat hooks). */
function personaLineBank(p: RizzPersona): {
  story: string[];
  cold: string[];
  mid: string[];
  warm: string[];
  hot: string[];
  hardExtra: string[];
} {
  const banks: Record<
    string,
    { story: string[]; cold: string[]; mid: string[]; warm: string[]; hot: string[]; hardExtra: string[] }
  > = {
    "f-maya": {
      story: [
        "matcha looks illegal in the best way — how is it today?",
        "that soft-launch lighting is doing numbers. book or people-watching?",
        "main character tax paid. what's on the playlist right now?",
        "cafe corner energy is elite. saving seats or hunting wifi?",
        "ok the matcha is the caption. what's the plot twist?",
      ],
      cold: [
        "reset — genuine question: what's actually good on the menu today?",
        "fair. i'll try less try-hard: favorite cozy drink order?",
        "that landed mid. what book would fix this vibe?",
      ],
      mid: [
        "playlist recommendation trade? i go first if you do",
        "is the matcha carrying or is the people-watching carrying?",
        "you seem like you caption better than you text. prove me wrong",
      ],
      warm: [
        "ok you're funny. dangerous for a soft-launch chat",
        "this is the part where i pretend i'm not invested",
        "if this cafe had a soft-launch for dms, we're it",
      ],
      hot: [
        "i'm not leaving this chat on a cliffhanger. keep talking",
        "matcha-approved and then some. what's after the cafe?",
      ],
      hardExtra: [],
    },
    "f-nova": {
      story: [
        "leg day survivors club — what are you finishing on?",
        "form over ego. you look locked in 💪",
        "rest day is a myth. what's the PR you're chasing?",
        "leg day or die day is a lifestyle. sets left?",
        "ok discipline looks good on you. program or chaos?",
      ],
      cold: [
        "reset: real talk — favorite lift this week?",
        "mid opener. what actually got you into training?",
        "i'll drop the fluff. form tip or roast — pick one",
      ],
      mid: [
        "protein opinion: rice cakes or real food after?",
        "you clap back or you clap PRs more?",
        "if leg day had a soundtrack, what's track one?",
      ],
      warm: [
        "ok you train with personality. rare",
        "not bad. don't waste the set — what's next?",
        "competitive energy accepted. friendly rivalry?",
      ],
      hot: [
        "you're in. don't ghost the program 🔥",
        "this chat's my rest-day dopamine. keep going",
      ],
      hardExtra: [],
    },
    "f-lina": {
      story: [
        "window seat supremacy acknowledged. where are we landing?",
        "golden hour from 30k feet hits different. first trip or ritual?",
        "favorite layover snack. go. no wrong answers (almost)",
        "romanticize the flight with me — destination or the view?",
        "that caption is a whole itinerary. one city you won't skip?",
      ],
      cold: [
        "genuine: what's the city that always fixes your head?",
        "too tourist of me earlier. what's your actual travel rule?",
        "window seat question, no thirst: morning light or sunset landings?",
      ],
      mid: [
        "if this chat was a layover, is it worth missing a connection?",
        "packing list: curiosity, matcha, zero clinginess — what am i missing?",
        "solo travel tip you'd actually give a stranger?",
      ],
      warm: [
        "okay romantic alert — in a cool way",
        "you get the window seat energy. i notice",
        "this chat's my favorite souvenir rn",
      ],
      hot: [
        "don't let this land on read. where to next?",
        "i'm collecting good conversations. this one's a keeper",
      ],
      hardExtra: [],
    },
    "f-zoe": {
      story: [
        "ears still ringing? name the encore or leave 😌",
        "front row chaos is a lifestyle. what song ruined you?",
        "processing mode accepted. setlist of the night — top 3?",
        "bass still in my chest. what do YOU blast after a show?",
        "don't talk to me i'm processing — unless you have a song",
      ],
      cold: [
        "wrong energy earlier. real one: last song that hit different?",
        "reset: name a track or we both look mid",
        "concert brain only. what's your recovery song?",
      ],
      mid: [
        "pit or balcony person? be honest",
        "if this chat was a setlist, are we still in the openers?",
        "you process with music or with chaos?",
      ],
      warm: [
        "ok this reply goes hard",
        "WAIT that was actually elite",
        "you're not a random reply anymore",
      ],
      hot: [
        "you're my encore. don't ghost the encore 🔥",
        "keep the energy. i hate when good chats die after the show",
      ],
      hardExtra: [],
    },
    "f-raven": {
      story: [
        "1am honesty hour — what are you actually thinking about?",
        "lights low looks dangerous. say something worth staying up for",
        "patience optional noted. confidence required though 🖤",
        "silk-and-low-light energy. are you bored or selective?",
        "late-night brain is honest. match it or leave soft",
      ],
      cold: [
        "that was mid for 1am. try tension, not a demand",
        "slow down — flirt, don't audition for a porno script",
        "reset: one bold line with actual charm. go",
      ],
      mid: [
        "you're warmer. keep the tease, drop the pressure",
        "mm. not boring. what are you staying up for really?",
        "say that again slower — with better intent",
      ],
      warm: [
        "ok… that was a little dangerous 😏",
        "keep talking like that and i might actually stay up",
        "you're trouble. i like the direction",
      ],
      hot: [
        "don't disappear now that it's interesting",
        "this is the part where most people get weird. don't",
        "stay in the heat. carefully",
      ],
      hardExtra: [],
    },
    "f-elise": {
      story: [
        "coffee or chocolate milkshake — which won tonight?",
        "clean girl soft launch is elite. how was the sip?",
        "you look peaceful. that rare kind of confidence hits different",
        "soft lighting on purpose? the aesthetic is intentional",
        "quiet optimist energy. what's the calm drink of choice?",
      ],
      cold: [
        "too easy earlier. something specific about your night?",
        "i notice effort. that wasn't it — try thoughtful",
        "no loud flattery. what actually made you smile today?",
      ],
      mid: [
        "patience is attractive. so is a real question — ask me one",
        "clean vibe chat: favorite small ritual after a long day?",
        "you're trying. keep going carefully — no chaos",
      ],
      warm: [
        "ok that was… actually thoughtful 😌",
        "soft launch approved. don't get loud now",
        "rare. most people rush this",
      ],
      hot: [
        "you made it past my walls carefully. don't waste it",
        "i'm still selective. keep being specific",
      ],
      hardExtra: [
        "hard mode tip: name the drink, the lighting, or the calm — not her looks",
        "generic hot = cold. specific kindness = movement",
        "two good lines beat five mediocre ones",
      ],
    },
    "m-knox": {
      story: [
        "dangerous hobby noted. what exactly are you thinking?",
        "still up? say it without the filter 🔥",
        "down bad hours. keep up or go soft",
        "late-night honesty — what got you scrolling?",
        "you text like trouble. prove it's the good kind",
      ],
      cold: [
        "weak. try again with actual heat, not spam",
        "that was soft. spit game, not a script",
        "reset: one confident line. no desperation",
      ],
      mid: [
        "yeah better. say more without oversharing",
        "you're warmer. don't get needy mid-tease",
        "keep the bold. drop the try-hard",
      ],
      warm: [
        "yeah i was hoping you'd text first 😏",
        "say that again slower",
        "dangerous. keep going",
      ],
      hot: [
        "you're in my head now. don't ghost 🔥",
        "stay up. this is the interesting part",
      ],
      hardExtra: [],
    },
    "m-jordan": {
      story: [
        "what did you see first in the painting?",
        "museum quiet wing energy. color or composition?",
        "that caption was better than half the wall text",
        "the blue painting won — what did it win for you?",
        "slow looking is underrated. what held you longest?",
      ],
      cold: [
        "say something real or keep scrolling",
        "forced slang misses here. detail or dry humor?",
        "reset: one honest reaction to the art",
      ],
      mid: [
        "ok you actually looked. rare",
        "what detail would you steal for a caption?",
        "quiet confidence is better than loud flirting here",
      ],
      warm: [
        "that's a better caption than mine",
        "alright. you're not a random reply anymore",
        "slow burn accepted",
      ],
      hot: [
        "keep the quiet. it works",
        "i like this pace. don't rush it",
      ],
      hardExtra: [],
    },
    "m-kai": {
      story: [
        "Toast is clearly the main character. what's his job title?",
        "PR for a golden is elite. does he approve openers?",
        "dog park golden hour is undefeated. treat budget high?",
        "he's the main character, you're PR — introduce me properly",
        "good boy energy detected. name and snack preference?",
      ],
      cold: [
        "Toast is side-eyeing that opener. try kindness",
        "reset: genuine — what's Toast's chaos skill?",
        "dog dad question only: walk length or treat quality?",
      ],
      mid: [
        "he approves half. i might too — favorite park ritual?",
        "Toast wants your name. i'm still interviewing",
        "pure energy only. what's his favorite game?",
      ],
      warm: [
        "ok that was pure",
        "officially warmer. pack energy rising",
        "Toast says hi. i second it 🐶",
      ],
      hot: [
        "officially in the pack. text like you mean it",
        "keep the soft. it works here",
      ],
      hardExtra: [],
    },
    "m-leo": {
      story: [
        "no cream in the carbonara or we fight. guanciale check?",
        "1am plating is a love language. season level?",
        "chef energy at midnight is criminal. recipe notes or vibes only?",
        "carbonara doesn't need opinions. only respect — you cooking or eating?",
        "pecorino or panic? walk me through the plate",
      ],
      cold: [
        "undercooked opener. try food banter",
        "bland. what's your actual kitchen confidence?",
        "reset: real question — worst pasta crime you've seen?",
      ],
      mid: [
        "foodie credentials pending. favorite midnight plate?",
        "you season properly? prove it with a take",
        "bold is good. cocky without knowledge is not",
      ],
      warm: [
        "you season properly. rare",
        "bold. i like bold",
        "reservation for two. metaphorically. for now 😏",
      ],
      hot: [
        "kitchen's still open if the chat stays good",
        "don't let a good plate go cold — keep talking",
      ],
      hardExtra: [],
    },
    "m-sam": {
      story: [
        "city lights doing unpaid therapy again?",
        "night bus route or sidewalk spiral?",
        "don't quote you noted. soft launch accepted 🌃",
        "quiet hours hit different. walking to think or to escape?",
        "skyline > noise. what's your reset route?",
      ],
      cold: [
        "that was loud for night-walk energy. soft restart?",
        "genuine: what do the lights fix for you?",
        "no love-bombing. one real sentence about your night",
      ],
      mid: [
        "lol fair. you out walking too?",
        "soft energy only after midnight — what's the soundtrack?",
        "this chat is quieter than the bus. i like that",
      ],
      warm: [
        "that hit. keep talking",
        "ok soft launch accepted",
        "yeah… i like this chat. don't ruin it 🌃",
      ],
      hot: [
        "don't rush this. the quiet is working",
        "stay on the route with me a bit longer",
      ],
      hardExtra: [],
    },
  };

  return (
    banks[p.id] ?? {
      story: p.starters,
      cold: ["reset with a real question about their scene"],
      mid: ["reference something specific they care about"],
      warm: ["keep it low-pressure and curious"],
      hot: ["close with confidence, not neediness"],
      hardExtra: [],
    }
  );
}

function bandFor(interest: number): "cold" | "mid" | "warm" | "hot" {
  if (interest <= 34) return "cold";
  if (interest < 55) return "mid";
  if (interest < 72) return "warm";
  return "hot";
}

/**
 * Adaptive coach tips + varied suggested lines.
 * `excludeLines` / `salt` keep refreshes from repeating the same three.
 */
export function buildCoachAdvice(opts: {
  persona: RizzPersona;
  interest: number;
  turn: number;
  isStoryPhase: boolean;
  history: RizzChatMessage[];
  /** Lines already offered this run (lowercase) */
  excludeLines?: string[];
  /** Increment on "refresh" to reshuffle */
  salt?: number;
}): CoachAdvice {
  const { persona: p, interest, turn, isStoryPhase, history } = opts;
  const salt = opts.salt ?? 0;
  const exclude = new Set((opts.excludeLines ?? []).map((x) => x.toLowerCase()));
  const seed = hashSeed(p.id, turn, interest, salt, history.length, history.map((m) => m.text).join("§").slice(-120));
  const rng = mulberry32(seed);

  const bank = personaLineBank(p);
  const soft = p.softYes;
  const softHit = soft;
  const npc = lastOf(history, "npc");
  const user = lastOf(history, "user");
  const band = bandFor(interest);
  const tips: string[] = [];
  const pool: string[] = [];

  // ——— Status ———
  let status = `${p.name}'s vibe: stay specific to ${p.vibe}.`;
  if (p.hardMode) status = `Hard mode · ${p.name}: slow trust, zero generic.`;
  else if (p.nsfw) status = `18+ · ${p.name}: heat + charm, no pressure.`;
  else if (band === "hot") status = `They're locked in — don't get needy.`;
  else if (band === "cold") status = `Cold zone — curiosity over thirst.`;
  else if (band === "warm") status = `Warming up — light flirt + a real question.`;
  else status = `Mid chat — echo their world (${soft.slice(0, 2).join(", ") || "details"}).`;

  // ——— Tips (persona + state) ———
  if (isStoryPhase || history.length === 0) {
    tips.push(p.openTip);
    tips.push(`Their world words: ${soft.slice(0, 5).map((s) => `“${s}”`).join(", ")}.`);
    if (p.hardMode) tips.push(...shufflePick(bank.hardExtra.concat([
      "One precise detail > three compliments.",
      "Sound calm. Loud energy loses hard mode.",
    ]), 1, rng));
    if (p.nsfw) tips.push("Tease tension; never demand pics or immediacy.");
    tips.push(`Avoid: ${p.hardNos.slice(0, 3).map((s) => `“${s}”`).join(", ")}.`);
    pool.push(...bank.story, ...p.starters);
    // dynamic templates from softYes / caption
    for (const s of shufflePick(softHit, 3, rng)) {
      pool.push(`ok but “${s}” is doing numbers — intentional?`);
      pool.push(`${s} energy on that story hits different`);
    }
    const capBits = tokens(p.storyCaption).slice(0, 4);
    for (const w of capBits) {
      pool.push(`“${w}” in the caption — expand on that`);
    }
  } else {
    if (band === "cold") {
      tips.push("Interest is low. Pivot with a real question about their scene.");
      tips.push("Don't double down on a weak line — short reset, then specificity.");
      pool.push(...bank.cold);
    } else if (band === "mid") {
      tips.push("You're mid. Reference something they already said.");
      tips.push(`Lean into: ${soft.slice(0, 4).map((s) => `“${s}”`).join(", ")}.`);
      pool.push(...bank.mid);
    } else if (band === "warm") {
      tips.push("They're warming. Flirt once, then ask a follow-up.");
      if (p.hardMode) tips.push("Hard mode: still earn 2–3 strong turns before the like.");
      pool.push(...bank.warm);
    } else {
      tips.push("High interest — confident close, no love-bomb.");
      pool.push(...bank.hot);
    }

    if (npc) {
      const snip = snippet(npc, 42);
      pool.push(`wait you said “${snip}” — unpack that`);
      pool.push(`going back to “${snippet(npc, 28)}” because that was the interesting part`);
      const nk = tokens(npc).slice(0, 3);
      for (const w of nk) {
        pool.push(`the “${w}” bit — say more`);
      }
    }
    if (user) {
      if (user.length < 14) tips.unshift("Last line was thin. Full sentence next.");
      const uk = tokens(user).slice(0, 2);
      for (const w of uk) {
        pool.push(`building on ${w} — what's the unfiltered version?`);
      }
    }
    for (const s of shufflePick(soft, 3, rng)) {
      pool.push(`curious about the ${s} — how intentional was that?`);
      pool.push(`${s} talk lands with you. keep that thread`);
    }
    if (turn >= 5 && interest < 62) {
      tips.push("Turns getting low — ask something only they can answer.");
    }
    if (p.hardMode && turn >= 2) {
      tips.push(...shufflePick(bank.hardExtra.concat([
        `${p.name} needs patience. Specific > smooth.`,
      ]), 1, rng));
    }
  }

  // Always mix in persona warm/cold samples as style guides (not forced)
  pool.push(...p.replies.warm.map((r) => `in their voice you'd hear: ${r} — match the energy, don't copy`));
  // filter those meta lines from player-sendable - actually those are bad for insert
  // remove meta - only keep actual player lines
  const sendable = pool.filter((l) => !l.startsWith("in their voice"));

  let lines = shufflePick(sendable, 5, rng, exclude);
  // If exclude ate the pool, reshuffle without exclude
  if (lines.length < 3) {
    lines = shufflePick(sendable, 5, mulberry32(seed ^ 0x9e3779b9), new Set());
  }
  // Prefer 3–4
  lines = lines.slice(0, 4);

  const uniqTips = Array.from(new Set(tips.map((t) => t.trim()).filter(Boolean))).slice(0, 4);

  return {
    status,
    tips: uniqTips.length ? uniqTips : [p.openTip],
    lines: lines.length ? lines : shufflePick(p.starters, 3, rng),
  };
}

/**
 * Should the trainer grant bonus turns?
 * When 1–2 turns remain and the chat is actually getting good.
 */
export function bonusTurnsToGrant(opts: {
  interest: number;
  peakInterest: number;
  turn: number;
  maxTurns: number;
  alreadyGranted: number;
  lastDelta: number;
  hardMode?: boolean;
  nsfw?: boolean;
}): number {
  const { interest, peakInterest, turn, maxTurns, alreadyGranted, lastDelta, hardMode, nsfw } = opts;
  if (alreadyGranted >= 3) return 0;
  const left = maxTurns - turn;
  if (left > 2) return 0;
  // Need solid / rising chemistry
  if (interest < 50) return 0;
  if (interest < peakInterest - 8) return 0; // fading hard
  const rising = lastDelta > 0 || interest >= peakInterest - 2;
  if (!rising && interest < 60) return 0;

  // Personality: wild/nsfw more likely to stretch; hard mode stingier
  let chance = 0.55;
  if (hardMode) chance = 0.35;
  if (nsfw) chance += 0.15;
  if (interest >= 70) chance += 0.2;
  if (lastDelta >= 8) chance += 0.15;
  if (left === 1) chance += 0.1;

  const rng = mulberry32(hashSeed(turn, interest, peakInterest, alreadyGranted, maxTurns));
  if (rng() > Math.min(0.92, chance)) return 0;

  if (interest >= 72 && lastDelta > 0 && alreadyGranted < 2) return hardMode ? 1 : 2;
  return 1;
}
