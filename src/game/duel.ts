import type { Challenge, ScoreResult } from "../types";

export interface DuelPlayer {
  name: string;
  answer: string;
  result: ScoreResult | null;
}

export type DuelPhase = "setup" | "p1" | "handoff" | "p2" | "result";

export interface DuelState {
  phase: DuelPhase;
  challenge: Challenge | null;
  p1: DuelPlayer;
  p2: DuelPlayer;
}

export function createDuelState(): DuelState {
  return {
    phase: "setup",
    challenge: null,
    p1: { name: "Player 1", answer: "", result: null },
    p2: { name: "Player 2", answer: "", result: null },
  };
}

export function duelWinner(d: DuelState): "p1" | "p2" | "tie" | null {
  if (!d.p1.result || !d.p2.result) return null;
  if (d.p1.result.score === d.p2.result.score) return "tie";
  return d.p1.result.score > d.p2.result.score ? "p1" : "p2";
}
