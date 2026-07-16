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

function pick<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return [...arr];
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]!);
  }
  return out;
}

function lastNpcReply(history: RizzChatMessage[]): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.role === "npc") return history[i]!.text;
  }
  return null;
}

function lastUserMsg(history: RizzChatMessage[]): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.role === "user") return history[i]!.text;
  }
  return null;
}

/** Build adaptive coach tips + suggested lines for the current rizz run. */
export function buildCoachAdvice(opts: {
  persona: RizzPersona;
  interest: number;
  turn: number;
  isStoryPhase: boolean;
  history: RizzChatMessage[];
}): CoachAdvice {
  const { persona: p, interest, turn, isStoryPhase, history } = opts;
  const soft = p.softYes.slice(0, 4);
  const softList = soft.map((s) => `“${s}”`).join(", ");
  const avoid = p.hardNos.slice(0, 3).map((s) => `“${s}”`).join(", ");
  const tips: string[] = [];
  const lines: string[] = [];
  const npc = lastNpcReply(history);
  const user = lastUserMsg(history);

  let status = "Warm them up — specific > generic.";
  if (p.hardMode) status = "Hard mode: slow burn. Specific effort only.";
  else if (p.nsfw) status = "Match the heat, keep consent & charm.";
  else if (interest >= 68) status = "They're into you — don't get cocky or needy.";
  else if (interest <= 32) status = "Cold zone — reset with curiosity, not thirst.";

  if (isStoryPhase || history.length === 0) {
    tips.push(p.openTip);
    tips.push(`Hit their world: ${softList || "story details"}.`);
    if (p.hardMode) {
      tips.push("One thoughtful detail beats three generic compliments.");
    }
    if (avoid) tips.push(`Avoid: ${avoid}.`);
    lines.push(...p.starters.slice(0, 3));
    // Extra adaptive lines from softYes
    if (soft[0]) {
      lines.push(`ok but the ${soft[0]} detail is doing numbers — intentional?`);
    }
    if (soft[1] && p.storyCaption) {
      lines.push(`${soft[1]} + that caption? dangerous combo`);
    }
  } else {
    if (interest <= 32) {
      tips.push("Interest is low. Ask a real question about their scene.");
      tips.push("Short apology + pivot beats doubling down on a bad line.");
      lines.push(`my bad — genuine question: what's the move after this?`);
      if (soft[0]) lines.push(`reset: tell me about the ${soft[0]} for real`);
    } else if (interest < 55) {
      tips.push("You're mid. Reference something they already said.");
      tips.push(`Lean on: ${softList}.`);
      if (npc) {
        const snip = npc.replace(/\s+/g, " ").slice(0, 36);
        lines.push(`wait you said “${snip}${npc.length > 36 ? "…" : ""}” — unpack that`);
      }
      if (soft[0]) lines.push(`curious about the ${soft[0]} — how intentional was that?`);
      lines.push(`ok that landed half. give me the real version`);
    } else if (interest < 75) {
      tips.push("They're warming up. Light flirt + follow-up question.");
      if (p.hardMode) tips.push("Still hard mode — don't rush the like. Earn 2–3 more good turns.");
      else tips.push("Keep it low-pressure. One witty line, then listen.");
      if (soft[0]) lines.push(`${soft[0]} talk is cute. what's next on the agenda?`);
      lines.push(`you're more interesting than the story. dangerous.`);
      lines.push(`ok i'll stop pretending this is casual — what's your weekend look like?`);
    } else {
      tips.push("High interest — close with confidence, not neediness.");
      tips.push("Don't love-bomb. One clean confident line.");
      lines.push(`this chat's my favorite plot twist today`);
      lines.push(`i'm not rushing this. keep talking to me`);
      if (soft[0]) lines.push(`${soft[0]} energy + you? yeah i'm staying`);
    }

    if (user && user.length < 12) {
      tips.unshift("Last line was thin. Give a full sentence next.");
    }
    if (turn >= 5 && interest < 60 && !p.hardMode) {
      tips.push("Turns running out — ask something only they can answer.");
    }
    if (p.hardMode && turn >= 3 && interest < 50) {
      tips.push("Elise-level pickiness: name a detail from their vibe, not their looks.");
    }
  }

  // Dedupe lines, cap
  const uniqLines = Array.from(new Set(lines.map((l) => l.trim()).filter(Boolean))).slice(0, 4);
  const uniqTips = Array.from(new Set(tips.map((t) => t.trim()).filter(Boolean))).slice(0, 4);

  return {
    status,
    tips: uniqTips.length ? uniqTips : ["Be specific, funny, and low-pressure."],
    lines: uniqLines.length ? uniqLines : pick(p.starters, 2),
  };
}
