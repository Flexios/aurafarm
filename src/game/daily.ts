import { getChallengePool } from "../data/challenges";
import type { Challenge } from "../types";
import { pickDaily } from "../utils/seed";

const DAILY_SALT_KEY = "aurafarm.admin.dailySalt";

/** Admin: bump salt so today's daily picks a different challenge. */
export function refreshDailyChallenge(includeNsfw = false): Challenge {
  const next = String(Date.now());
  try {
    localStorage.setItem(DAILY_SALT_KEY, next);
  } catch {
    /* ignore */
  }
  return getTodaysChallenge(includeNsfw);
}

export function getDailySalt(): string {
  try {
    const s = localStorage.getItem(DAILY_SALT_KEY);
    return s && s.length ? s : "challenge-v1";
  } catch {
    return "challenge-v1";
  }
}

export function getTodaysChallenge(
  includeNsfw = false,
  date = new Date(),
): Challenge {
  const pool = getChallengePool(includeNsfw);
  return pickDaily(pool, getDailySalt(), date);
}

export function getPracticeChallenge(includeNsfw = false): Challenge {
  const pool = getChallengePool(includeNsfw);
  return pickDaily(pool, `practice-${Date.now() % 7}`, new Date());
}

/** Pick any challenge from the filtered pool (friend battles, etc.). */
export function pickChallenge(
  salt: string,
  includeNsfw = false,
  date = new Date(),
): Challenge {
  return pickDaily(getChallengePool(includeNsfw), salt, date);
}
