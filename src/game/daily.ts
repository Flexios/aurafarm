import { CHALLENGES } from "../data/challenges";
import type { Challenge } from "../types";
import { pickDaily } from "../utils/seed";

const DAILY_SALT_KEY = "aurafarm.admin.dailySalt";

/** Admin: bump salt so today's daily picks a different challenge. */
export function refreshDailyChallenge(): Challenge {
  const next = String(Date.now());
  try {
    localStorage.setItem(DAILY_SALT_KEY, next);
  } catch {
    /* ignore */
  }
  return getTodaysChallenge();
}

export function getDailySalt(): string {
  try {
    const s = localStorage.getItem(DAILY_SALT_KEY);
    return s && s.length ? s : "challenge-v1";
  } catch {
    return "challenge-v1";
  }
}

export function getTodaysChallenge(date = new Date()): Challenge {
  return pickDaily(CHALLENGES, getDailySalt(), date);
}

export function getPracticeChallenge(): Challenge {
  // Slightly different salt so practice ≠ daily when same session
  return pickDaily(CHALLENGES, `practice-${Date.now() % 7}`, new Date());
}
