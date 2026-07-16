/**
 * Promo / redeem codes for the Shop.
 * Claimed codes are stored per-account on PlayerState.claimedCodes.
 */

export interface RedeemCodeDef {
  /** Canonical code (uppercase) */
  code: string;
  /** Display label */
  label: string;
  sparks: number;
  glow: number;
  /** Max redemptions per account */
  maxPerAccount: number;
  /** ISO date string, or null = never expires */
  expiresAt: string | null;
  /** Optional blurb */
  blurb?: string;
}

export const REDEEM_CODES: RedeemCodeDef[] = [
  {
    code: "BETA",
    label: "Beta Tester",
    sparks: 100,
    glow: 10,
    maxPerAccount: 1,
    expiresAt: null,
    blurb: "Thanks for playing early. One claim per account.",
  },
];

export function findCode(raw: string): RedeemCodeDef | undefined {
  const code = raw.trim().toUpperCase();
  if (!code) return undefined;
  return REDEEM_CODES.find((c) => c.code === code);
}

export function isCodeExpired(def: RedeemCodeDef, now = new Date()): boolean {
  if (!def.expiresAt) return false;
  const t = Date.parse(def.expiresAt);
  if (!Number.isFinite(t)) return false;
  return now.getTime() > t;
}
