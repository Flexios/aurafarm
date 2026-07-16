import type { RizzGender } from "../types";
import { hashString, mulberry32, todayKey } from "../utils/seed";

export type { RizzGender };

export interface RizzPersona {
  id: string;
  gender: RizzGender;
  name: string;
  handle: string;
  /** Short vibe tag for UI */
  vibe: string;
  /** Caption shown on the story */
  storyCaption: string;
  /** Optional public path; CSS gradient fallback if missing */
  image: string;
  /** Accent for gradient art */
  accent: string;
  /** Accent secondary for gradient */
  accent2: string;
  /** Emoji badge on avatar */
  emoji: string;
  /** Flavor for AI system prompt */
  personality: string;
  hardNos: string[];
  softYes: string[];
  /** Offline reply templates by rough mood */
  replies: {
    warm: string[];
    cold: string[];
    like: string[];
    ghost: string[];
  };
}

export const RIZZ_PERSONAS: RizzPersona[] = [
  {
    id: "f-maya",
    gender: "female",
    name: "Maya",
    handle: "maya.soft",
    vibe: "cafe soft-launch",
    storyCaption: "matcha & main character energy ✨",
    image: "/rizz/f-maya.svg",
    accent: "#c4785a",
    accent2: "#2a1f1a",
    emoji: "☕",
    personality:
      "22, warm, witty barista energy. Flirts if the reply is clever and low-pressure. Hates try-hard pickup lines and double texting energy.",
    hardNos: ["send nudes", "come over", "what's your snap", "rate me", "daddy", "babygirl"],
    softYes: ["matcha", "cafe", "book", "playlist", "cute", "honest", "same", "vibe"],
    replies: {
      warm: [
        "ok that was actually cute 😭",
        "wait… you’re funny. dangerous.",
        "i’ll allow it. say more.",
      ],
      cold: ["hmm", "lol ok", "wild opener ngl"],
      like: ["ok you’re not leaving my dms like that 👀 like for real"],
      ghost: ["…", ""],
    },
  },
  {
    id: "f-nova",
    gender: "female",
    name: "Nova",
    handle: "novamoves",
    vibe: "gym soft-launch",
    storyCaption: "leg day or die day 💪",
    image: "/rizz/f-nova.svg",
    accent: "#e85d4c",
    accent2: "#1a1210",
    emoji: "💪",
    personality:
      "24, confident gym girl, playful roast energy. Respects effort and humor. Cringes at body comments and clinginess.",
    hardNos: ["nice body", "thicc", "smash", "gym booty", "home workout with me"],
    softYes: ["leg day", "form", "discipline", "rest day", "protein", "consistent", "respect"],
    replies: {
      warm: ["lmao ok you train too?", "not bad for a story reply 😤", "alright you earned a real chat"],
      cold: ["bro…", "mid", "next"],
      like: ["ok you’re in. don’t waste the rep 🔥"],
      ghost: ["left on read for a reason", ""],
    },
  },
  {
    id: "f-lina",
    gender: "female",
    name: "Lina",
    handle: "linatravel",
    vibe: "sunset flight",
    storyCaption: "window seat supremacy ✈️ golden hour",
    image: "/rizz/f-lina.svg",
    accent: "#f0a05a",
    accent2: "#1c1410",
    emoji: "✈️",
    personality:
      "23, traveler, romantic but independent. Likes curiosity and good questions. Hates possessiveness and one-word thirst.",
    hardNos: ["be mine", "you're mine", "hot", "damn girl", "where u from sexy"],
    softYes: ["window", "city", "sunset", "itinerary", "solo trip", "coffee stop", "photo"],
    replies: {
      warm: ["okay romantic alert 😌", "you get the window seat energy", "tell me your favorite layover snack"],
      cold: ["creative…", "sure", "noted"],
      like: ["this chat’s my favorite souvenir rn 💛"],
      ghost: ["boarding ✌️", ""],
    },
  },
  {
    id: "f-zoe",
    gender: "female",
    name: "Zoe",
    handle: "zoenights",
    vibe: "concert blur",
    storyCaption: "front row chaos 🎤 don’t talk to me i’m processing",
    image: "/rizz/f-zoe.svg",
    accent: "#b57bff",
    accent2: "#16101c",
    emoji: "🎤",
    personality:
      "21, music-obsessed, chaotic good. Loves shared taste and witty callbacks. Hates cringe thirst and interrupting the vibe.",
    hardNos: ["you look good", "dm me pics", "call me", "netflix"],
    softYes: ["setlist", "encore", "song", "bass", "crowd", "earring", "ring"],
    replies: {
      warm: ["WAIT you were there??", "ok this reply goes hard", "say a song or leave 😌"],
      cold: ["wrong energy", "skip", "lol"],
      like: ["you’re my encore. don’t ghost the encore 🔥"],
      ghost: ["muted", ""],
    },
  },
  {
    id: "m-jordan",
    gender: "male",
    name: "Jordan",
    handle: "j.frames",
    vibe: "museum soft boy",
    storyCaption: "this painting stared back first 🖼️",
    image: "/rizz/m-jordan.svg",
    accent: "#6b8cae",
    accent2: "#12161c",
    emoji: "🖼️",
    personality:
      "25, thoughtful, dry humor, artsy. Likes sincerity and clever observations. Hates forced slang and aggressive flirting.",
    hardNos: ["daddy", "hey king", "send pic", "rate me", "netflix and chill"],
    softYes: ["painting", "museum", "artist", "quiet", "detail", "color", "honest"],
    replies: {
      warm: ["that’s a better caption than mine", "ok you actually looked", "i’ll bite — what did you see?"],
      cold: ["interesting", "cool", "…"],
      like: ["alright. you’re not a random reply anymore 😊"],
      ghost: ["", "read"],
    },
  },
  {
    id: "m-kai",
    gender: "male",
    name: "Kai",
    handle: "kaidogs",
    vibe: "dog park golden hour",
    storyCaption: "he’s the main character, i’m just PR 🐕",
    image: "/rizz/m-kai.svg",
    accent: "#6bcf8e",
    accent2: "#101814",
    emoji: "🐕",
    personality:
      "24, warm, dog dad energy, easygoing. Soft for kindness and humor. Hates people ignoring the dog / being rude.",
    hardNos: ["ugly dog", "kick", "breed?", "come alone", "no strings"],
    softYes: ["good boy", "dog", "walk", "park", "treats", "name", "cute"],
    replies: {
      warm: ["he approves. i might too", "ok that was pure", "name drop pending 🐶"],
      cold: ["he’s side-eyeing you", "mid", "nah"],
      like: ["officially in the pack. text like you mean it"],
      ghost: ["walk time ✌️", ""],
    },
  },
  {
    id: "m-leo",
    gender: "male",
    name: "Leo",
    handle: "leocooks",
    vibe: "midnight pasta",
    storyCaption: "1am carbonara. no notes. 🍝",
    image: "/rizz/m-leo.svg",
    accent: "#e8a54b",
    accent2: "#1a1410",
    emoji: "🍝",
    personality:
      "26, cocky-but-kind cook, playful teasing. Likes food banter and confidence. Hates fake compliments and sexual pressure.",
    hardNos: ["feed me daddy", "come cook for me tonight", "i'm hungry for you", "nude"],
    softYes: ["carbonara", "recipe", "guanciale", "chef", "midnight", "plate", "taste"],
    replies: {
      warm: ["ok foodie credentials accepted", "you talk like someone who seasons properly", "bold. i like bold."],
      cold: ["undercooked", "bland", "no"],
      like: ["reservation for two. metaphorically. for now 😏"],
      ghost: ["kitchen closed", ""],
    },
  },
  {
    id: "m-sam",
    gender: "male",
    name: "Sam",
    handle: "sam.nightbus",
    vibe: "city night walk",
    storyCaption: "city lights > therapy (don’t quote me) 🌃",
    image: "/rizz/m-sam.svg",
    accent: "#4a9eff",
    accent2: "#0e1218",
    emoji: "🌃",
    personality:
      "23, chill night-owl, slightly shy, genuine. Soft for honesty and calm energy. Hates love-bombing and pushiness.",
    hardNos: ["marry me", "you're the one", "come over now", "send location"],
    softYes: ["night", "walk", "city", "quiet", "skyline", "same", "real"],
    replies: {
      warm: ["lol fair. you out walking too?", "that hit. keep talking", "ok soft launch accepted"],
      cold: ["aight", "sure", "k"],
      like: ["yeah… i like this chat. don’t ruin it 🌃"],
      ghost: ["bus home", ""],
    },
  },
];

export function personasByGender(gender: RizzGender): RizzPersona[] {
  return RIZZ_PERSONAS.filter((p) => p.gender === gender);
}

export function personaById(id: string): RizzPersona | undefined {
  return RIZZ_PERSONAS.find((p) => p.id === id);
}

/** Stable daily pick for a gender. */
export function pickDailyPersona(gender: RizzGender, date = new Date()): RizzPersona {
  const list = personasByGender(gender);
  const rng = mulberry32(hashString(`rizz-daily:${gender}:${todayKey(date)}`));
  return list[Math.floor(rng() * list.length)]!;
}

export function pickRandomPersona(gender: RizzGender): RizzPersona {
  const list = personasByGender(gender);
  return list[Math.floor(Math.random() * list.length)]!;
}

const GENDER_KEY = "aurafarm.rizzTargetGender";

export function loadRizzGender(): RizzGender | null {
  try {
    const v = sessionStorage.getItem(GENDER_KEY);
    if (v === "male" || v === "female") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveRizzGender(g: RizzGender | null): void {
  try {
    if (!g) sessionStorage.removeItem(GENDER_KEY);
    else sessionStorage.setItem(GENDER_KEY, g);
  } catch {
    /* ignore */
  }
}
