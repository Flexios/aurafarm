import type { Challenge } from "../types";

/**
 * Challenge catalog.
 * - Default pool is SFW / all-ages vibe content.
 * - Entries with `nsfw: true` only appear when Settings → 18+ Challenges is on.
 *   NSFW here means mature dating / party / situationship energy — not hardcore porn.
 */
export const CHALLENGES: Challenge[] = [
  // ─── Original SFW ───────────────────────────────────────────
  {
    id: "fit-mirror",
    category: "fit-check",
    title: "Fit Check",
    prompt:
      "Describe today's fit like you're the main character walking into a cafe that plays only your playlist.",
    hint: "Colors, energy, one iconic accessory.",
    emoji: "👗",
  },
  {
    id: "fit-first-day",
    category: "fit-check",
    title: "First Day Energy",
    prompt:
      "You just transferred schools. Caption the fit that makes the hallway go silent.",
    hint: "Confidence over brand names.",
    emoji: "👟",
  },
  {
    id: "rizz-bus",
    category: "rizz",
    title: "Bus Stop Rizz",
    prompt:
      "Someone cute asks what you're listening to. Drop the line that actually works.",
    hint: "Charm > cringe. No 2016 pickup lines.",
    emoji: "🚌",
  },
  {
    id: "rizz-groupchat",
    category: "rizz",
    title: "Group Chat Savior",
    prompt:
      "The group chat is dying. Send the message that revives it with pure aura.",
    hint: "Unhinged but lovable.",
    emoji: "💬",
  },
  {
    id: "rizz-apology",
    category: "rizz",
    title: "Soft Launch Apology",
    prompt:
      "You left them on read for 6 hours. Write the recovery text with maximum aura.",
    hint: "Honest + funny beats desperate.",
    emoji: "📱",
  },
  {
    id: "room-core",
    category: "room-vibe",
    title: "Room Core",
    prompt:
      "Describe your room's aesthetic in 2-3 sentences like a lifestyle magazine that only covers teens.",
    hint: "Lighting, mess level, signature object.",
    emoji: "🛋️",
  },
  {
    id: "room-night",
    category: "room-vibe",
    title: "2AM Desk Setup",
    prompt:
      "It's 2AM. Paint the vibe of your desk / bed corner like a cinematic shot.",
    hint: "Screen glow, snacks, open tabs energy.",
    emoji: "🌙",
  },
  {
    id: "mc-monday",
    category: "main-character",
    title: "Monday Monologue",
    prompt:
      "Write your internal monologue walking into Monday like the soundtrack just dropped.",
    hint: "Dramatic is allowed. Pretentious is encouraged.",
    emoji: "🎬",
  },
  {
    id: "mc-villain",
    category: "main-character",
    title: "Soft Villain Arc",
    prompt:
      "Someone stole your fries. Write your villain monologue (still PG-13).",
    hint: "Petty royalty energy.",
    emoji: "😈",
  },
  {
    id: "cap-story",
    category: "caption",
    title: "Story Caption",
    prompt:
      "You posted a blurry sunset photo. Write the caption that still hits 10k vibes.",
    hint: "Short, poetic, or unhinged — pick a lane.",
    emoji: "📸",
  },
  {
    id: "cap-bio",
    category: "caption",
    title: "Bio Rewrite",
    prompt:
      "Rewrite your social bio in one line that screams your aesthetic core.",
    hint: "No 'link in bio' energy unless it's funny.",
    emoji: "✏️",
  },
  {
    id: "cap-playlist",
    category: "caption",
    title: "Playlist Title",
    prompt:
      "Name a playlist that describes your entire personality this week.",
    hint: "Weirdly specific = higher aura.",
    emoji: "🎧",
  },
  {
    id: "fit-thrift",
    category: "fit-check",
    title: "Thrift Legend",
    prompt:
      "You thrifted one chaotic piece. Explain how you styled it into a whole personality.",
    hint: "Story + style combo.",
    emoji: "🧥",
  },
  {
    id: "rizz-compliment",
    category: "rizz",
    title: "Elite Compliment",
    prompt:
      "Compliment a stranger's vibe without being weird. Max aura edition.",
    hint: "Specific > generic.",
    emoji: "⭐",
  },
  {
    id: "mc-plot",
    category: "main-character",
    title: "Plot Twist Day",
    prompt:
      "Your day just got a plot twist. Narrate the next scene in your life movie.",
    hint: "Cliffhangers welcome.",
    emoji: "🎞️",
  },
  {
    id: "room-guest",
    category: "room-vibe",
    title: "Unexpected Guest",
    prompt:
      "Your crush is outside your door in 60 seconds. What do you 'casually' fix first — and why does it slap?",
    hint: "Comedy gold preferred.",
    emoji: "🚪",
  },

  // ─── New SFW ────────────────────────────────────────────────
  {
    id: "fit-date-night",
    category: "fit-check",
    title: "Date Night Armor",
    prompt:
      "You're meeting someone for the first time IRL. Describe the outfit that says 'I'm fun but not trying too hard.'",
    hint: "One intentional detail beats a full rebrand.",
    emoji: "✨",
  },
  {
    id: "fit-rain",
    category: "fit-check",
    title: "Rain Check Fit",
    prompt:
      "It starts pouring mid-walk. Rewrite your fit as a main-character weather montage.",
    hint: "Hair, jacket, attitude under pressure.",
    emoji: "🌧️",
  },
  {
    id: "rizz-voice-note",
    category: "rizz",
    title: "Voice Note Chaos",
    prompt:
      "You sent a 47-second voice note by accident. Transcribe the first 15 seconds like it's still somehow cool.",
    hint: "Rambling with confidence is a skill.",
    emoji: "🎙️",
  },
  {
    id: "rizz-pet",
    category: "rizz",
    title: "Pet Parent Rizz",
    prompt:
      "You're at the park. Someone's dog runs up to you. Open with a line that impresses both human and dog.",
    hint: "Dog first, flirting second.",
    emoji: "🐕",
  },
  {
    id: "room-morning",
    category: "room-vibe",
    title: "Golden Hour Desk",
    prompt:
      "Morning light hits your room. Describe the mess like it's intentional set design.",
    hint: "Dust motes count as production value.",
    emoji: "☀️",
  },
  {
    id: "room-party",
    category: "room-vibe",
    title: "Pre-Game Staging",
    prompt:
      "Friends arrive in 20 minutes. Narrate your frantic glow-up of the living room.",
    hint: "Hide, dim, spray, pray.",
    emoji: "🎉",
  },
  {
    id: "mc-commute",
    category: "main-character",
    title: "Commute Cinematic",
    prompt:
      "Your bus/train/car ride is a movie scene. Write the voiceover for the 8-minute journey.",
    hint: "Headphones in = third-person mode.",
    emoji: "🚇",
  },
  {
    id: "mc-receipts",
    category: "main-character",
    title: "Receipt Era",
    prompt:
      "You're done being nice. Write the calm, devastating paragraph that closes the chapter.",
    hint: "Soft voice, sharp edges.",
    emoji: "🧾",
  },
  {
    id: "cap-gym",
    category: "caption",
    title: "Gym Story Flex",
    prompt:
      "You posted a mid gym mirror pic. Caption it so it doesn't sound like every other gym story.",
    hint: "Self-aware > try-hard.",
    emoji: "💪",
  },
  {
    id: "cap-food",
    category: "caption",
    title: "Foodie Propaganda",
    prompt:
      "Caption a blurry photo of the best meal you've had this month like it's a love letter.",
    hint: "Sensory details win.",
    emoji: "🍜",
  },
  {
    id: "rizz-coworker",
    category: "rizz",
    title: "Professional Rizz",
    prompt:
      "You match with someone on an app and realize you almost work in the same building. Write the opener that navigates the awkward.",
    hint: "Playful, not HR-case.",
    emoji: "🏢",
  },
  {
    id: "mc-solo",
    category: "main-character",
    title: "Solo Table Energy",
    prompt:
      "You're eating alone at a nice place on purpose. Write the internal monologue that makes it iconic, not lonely.",
    hint: "Chosen solitude is elite.",
    emoji: "🥂",
  },

  // ─── 18+ / NSFW pool (opt-in only) ──────────────────────────
  {
    id: "nsfw-thirst-trap",
    category: "after-dark",
    title: "Thirst Trap Caption",
    prompt:
      "You posted a deliberately hot mirror pic. Write the caption that is thirsty without being try-hard cringe.",
    hint: "Suggest, don't announce.",
    emoji: "🔥",
    nsfw: true,
  },
  {
    id: "nsfw-situationship",
    category: "after-dark",
    title: "Situationship Audit",
    prompt:
      "It's 1:17 AM. They text 'you up?' again. Write the reply that sets a boundary and still keeps the tension.",
    hint: "Self-respect is sexy.",
    emoji: "🫠",
    nsfw: true,
  },
  {
    id: "nsfw-walk-of-fame",
    category: "after-dark",
    title: "Morning After Monologue",
    prompt:
      "You're doing the quiet exit from their place. Internal monologue only — comedy allowed, dignity optional.",
    hint: "Shoes, keys, aura.",
    emoji: "👟",
    nsfw: true,
  },
  {
    id: "nsfw-bar-close",
    category: "after-dark",
    title: "Last Call Close",
    prompt:
      "Bar's closing. You've been flirting for an hour. Drop the line that invites them home without sounding like a threat.",
    hint: "Clear intent, soft delivery.",
    emoji: "🍸",
    nsfw: true,
  },
  {
    id: "nsfw-dirty-joke",
    category: "after-dark",
    title: "Double Entendre",
    prompt:
      "Write a flirty one-liner that works as both innocent and filthy depending on who reads it.",
    hint: "Plausible deniability is an art.",
    emoji: "😏",
    nsfw: true,
  },
  {
    id: "nsfw-ex-text",
    category: "after-dark",
    title: "Ex at 2AM",
    prompt:
      "Your ex texts a long paragraph. Write the three-word reply that ends the conversation with maximum aura.",
    hint: "Short can be lethal.",
    emoji: "📵",
    nsfw: true,
  },
  {
    id: "nsfw-hotel",
    category: "after-dark",
    title: "Hotel Key Energy",
    prompt:
      "You're on a weekend trip with someone new. Describe the first ten minutes in the room like a spicy slow-burn scene (keep it tasteful, not porn).",
    hint: "Tension > checklist.",
    emoji: "🔑",
    nsfw: true,
  },
  {
    id: "nsfw-jealousy",
    category: "after-dark",
    title: "Soft Jealousy",
    prompt:
      "You see your situationship laughing with someone else. Write the internal monologue — petty, hot, self-aware.",
    hint: "Feel it, don't crash out publicly.",
    emoji: "👀",
    nsfw: true,
  },
  {
    id: "nsfw-voice-note-late",
    category: "after-dark",
    title: "Late Night Voice Note",
    prompt:
      "You're a little buzzed and they asked for a voice note. Script what you say — flirty, slightly dangerous, still charming.",
    hint: "Lower voice = higher stakes.",
    emoji: "🌙",
    nsfw: true,
  },
  {
    id: "nsfw-rules",
    category: "after-dark",
    title: "House Rules",
    prompt:
      "They're coming over. Text the playful 'house rules' message that sets the vibe for the night.",
    hint: "Consent + humor = peak aura.",
    emoji: "📜",
    nsfw: true,
  },
];

/** Challenges available for the current content filter. */
export function getChallengePool(includeNsfw: boolean): Challenge[] {
  if (includeNsfw) return CHALLENGES;
  return CHALLENGES.filter((c) => !c.nsfw);
}
