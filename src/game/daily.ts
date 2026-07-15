import { CHALLENGES } from "../data/challenges";
import type { Challenge } from "../types";
import { pickDaily } from "../utils/seed";

export function getTodaysChallenge(date = new Date()): Challenge {
  return pickDaily(CHALLENGES, "challenge-v1", date);
}

export function getPracticeChallenge(): Challenge {
  // Slightly different salt so practice ≠ daily when same session
  return pickDaily(CHALLENGES, `practice-${Date.now() % 7}`, new Date());
}
