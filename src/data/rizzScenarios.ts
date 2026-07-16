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
    storyCaption: "matcha & main character energy âœ¨",
    image: "/rizz/f-maya.jpg",
    accent: "#c4785a",
    accent2: "#2a1f1a",
    emoji: "â˜•",
    personality:
      "22, warm, witty barista energy. Flirts if the reply is clever and low-pressure. Hates try-hard pickup lines and double texting energy.",
    hardNos: ["send nudes", "come over", "what's your snap", "rate me", "daddy", "babygirl"],
    softYes: ["matcha", "cafe", "book", "playlist", "cute", "honest", "same", "vibe"],
    replies: {
      warm: [
        "ok that was actually cute ðŸ˜­",
        "waitâ€¦ youâ€™re funny. dangerous.",
        "iâ€™ll allow it. say more.",
      ],
      cold: ["hmm", "lol ok", "wild opener ngl"],
      like: ["ok youâ€™re not leaving my dms like that ðŸ‘€ like for real"],
      ghost: ["â€¦", ""],
    },
  },
  {
    id: "f-nova",
    gender: "female",
    name: "Nova",
    handle: "novamoves",
    vibe: "gym soft-launch",
    storyCaption: "leg day or die day ðŸ’ª",
    image: "/rizz/f-nova.jpg",
    accent: "#e85d4c",
    accent2: "#1a1210",
    emoji: "ðŸ’ª",
    personality:
      "24, confident gym girl, playful roast energy. Respects effort and humor. Cringes at body comments and clinginess.",
    hardNos: ["nice body", "thicc", "smash", "gym booty", "home workout with me"],
    softYes: ["leg day", "form", "discipline", "rest day", "protein", "consistent", "respect"],
    replies: {
      warm: ["lmao ok you train too?", "not bad for a story reply ðŸ˜¤", "alright you earned a real chat"],
      cold: ["broâ€¦", "mid", "next"],
      like: ["ok youâ€™re in. donâ€™t waste the rep ðŸ”¥"],
      ghost: ["left on read for a reason", ""],
    },
  },
  {
    id: "f-lina",
    gender: "female",
    name: "Lina",
    handle: "linatravel",
    vibe: "sunset flight",
    storyCaption: "window seat supremacy âœˆï¸ golden hour",
    image: "/rizz/f-lina.jpg",
    accent: "#f0a05a",
    accent2: "#1c1410",
    emoji: "âœˆï¸",
    personality:
      "23, traveler, romantic but independent. Likes curiosity and good questions. Hates possessiveness and one-word thirst.",
    hardNos: ["be mine", "you're mine", "hot", "damn girl", "where u from sexy"],
    softYes: ["window", "city", "sunset", "itinerary", "solo trip", "coffee stop", "photo"],
    replies: {
      warm: ["okay romantic alert ðŸ˜Œ", "you get the window seat energy", "tell me your favorite layover snack"],
      cold: ["creativeâ€¦", "sure", "noted"],
      like: ["this chatâ€™s my favorite souvenir rn ðŸ’›"],
      ghost: ["boarding âœŒï¸", ""],
    },
  },
  {
    id: "f-zoe",
    gender: "female",
    name: "Zoe",
    handle: "zoenights",
    vibe: "concert blur",
    storyCaption: "front row chaos ðŸŽ¤ donâ€™t talk to me iâ€™m processing",
    image: "/rizz/f-zoe.jpg",
    accent: "#b57bff",
    accent2: "#16101c",
    emoji: "ðŸŽ¤",
    personality:
      "21, music-obsessed, chaotic good. Loves shared taste and witty callbacks. Hates cringe thirst and interrupting the vibe.",
    hardNos: ["you look good", "dm me pics", "call me", "netflix"],
    softYes: ["setlist", "encore", "song", "bass", "crowd", "earring", "ring"],
    replies: {
      warm: ["WAIT you were there??", "ok this reply goes hard", "say a song or leave ðŸ˜Œ"],
      cold: ["wrong energy", "skip", "lol"],
      like: ["youâ€™re my encore. donâ€™t ghost the encore ðŸ”¥"],
      ghost: ["muted", ""],
    },
  },
  {
    id: "m-jordan",
    gender: "male",
    name: "Jordan",
    handle: "j.frames",
    vibe: "museum soft boy",
    storyCaption: "this painting stared back first ðŸ–¼ï¸",
    image: "/rizz/m-jordan.jpg",
    accent: "#6b8cae",
    accent2: "#12161c",
    emoji: "ðŸ–¼ï¸",
    personality:
      "25, thoughtful, dry humor, artsy. Likes sincerity and clever observations. Hates forced slang and aggressive flirting.",
    hardNos: ["daddy", "hey king", "send pic", "rate me", "netflix and chill"],
    softYes: ["painting", "museum", "artist", "quiet", "detail", "color", "honest"],
    replies: {
      warm: ["thatâ€™s a better caption than mine", "ok you actually looked", "iâ€™ll bite â€” what did you see?"],
      cold: ["interesting", "cool", "â€¦"],
      like: ["alright. youâ€™re not a random reply anymore ðŸ˜Š"],
      ghost: ["", "read"],
    },
  },
  {
    id: "m-kai",
    gender: "male",
    name: "Kai",
    handle: "kaidogs",
    vibe: "dog park golden hour",
    storyCaption: "heâ€™s the main character, iâ€™m just PR ðŸ•",
    image: "/rizz/m-kai.jpg",
    accent: "#6bcf8e",
    accent2: "#101814",
    emoji: "ðŸ•",
    personality:
      "24, warm, dog dad energy, easygoing. Soft for kindness and humor. Hates people ignoring the dog / being rude.",
    hardNos: ["ugly dog", "kick", "breed?", "come alone", "no strings"],
    softYes: ["good boy", "dog", "walk", "park", "treats", "name", "cute"],
    replies: {
      warm: ["he approves. i might too", "ok that was pure", "name drop pending ðŸ¶"],
      cold: ["heâ€™s side-eyeing you", "mid", "nah"],
      like: ["officially in the pack. text like you mean it"],
      ghost: ["walk time âœŒï¸", ""],
    },
  },
  {
    id: "m-leo",
    gender: "male",
    name: "Leo",
    handle: "leocooks",
    vibe: "midnight pasta",
    storyCaption: "1am carbonara. no notes. ðŸ",
    image: "/rizz/m-leo.jpg",
    accent: "#e8a54b",
    accent2: "#1a1410",
    emoji: "ðŸ",
    personality:
      "26, cocky-but-kind cook, playful teasing. Likes food banter and confidence. Hates fake compliments and sexual pressure.",
    hardNos: ["feed me daddy", "come cook for me tonight", "i'm hungry for you", "nude"],
    softYes: ["carbonara", "recipe", "guanciale", "chef", "midnight", "plate", "taste"],
    replies: {
      warm: ["ok foodie credentials accepted", "you talk like someone who seasons properly", "bold. i like bold."],
      cold: ["undercooked", "bland", "no"],
      like: ["reservation for two. metaphorically. for now ðŸ˜"],
      ghost: ["kitchen closed", ""],
    },
  },
  {
    id: "m-sam",
    gender: "male",
    name: "Sam",
    handle: "sam.nightbus",
    vibe: "city night walk",
    storyCaption: "city lights > therapy (donâ€™t quote me) ðŸŒƒ",
    image: "/rizz/m-sam.jpg",
    accent: "#4a9eff",
    accent2: "#0e1218",
    emoji: "ðŸŒƒ",
    personality:
      "23, chill night-owl, slightly shy, genuine. Soft for honesty and calm energy. Hates love-bombing and pushiness.",
    hardNos: ["marry me", "you're the one", "come over now", "send location"],
    softYes: ["night", "walk", "city", "quiet", "skyline", "same", "real"],
    replies: {
      warm: ["lol fair. you out walking too?", "that hit. keep talking", "ok soft launch accepted"],
      cold: ["aight", "sure", "k"],
      like: ["yeahâ€¦ i like this chat. donâ€™t ruin it ðŸŒƒ"],
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
