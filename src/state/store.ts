import { getCachedSession } from "../auth/auth";
import { FREE_DEFAULTS } from "../data/cosmetics";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";
import type {
  AestheticCore,
  EquippedCosmetics,
  PlayerState,
  UserSettings,
} from "../types";
import { todayKey } from "../utils/seed";

const defaultEquipped: EquippedCosmetics = {
  frame: "frame-basic",
  aura: "aura-soft",
  nameplate: "name-plain",
  background: "bg-void",
};

export const DEFAULT_SETTINGS: UserSettings = {
  preferAiJudge: true,
  reduceMotion: false,
  compactMode: false,
  largeText: false,
  soundEnabled: true,
  accent: "purple",
  hideTopCurrency: false,
};

export const USERNAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
export const DISPLAY_NAME_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

function cacheKey(userId: string): string {
  return `aurafarm.cloudcache.v1:${userId}`;
}

export function createDefaultState(): PlayerState {
  return {
    version: 1,
    displayName: "",
    core: "main-character",
    totalAura: 0,
    sparks: 80,
    glow: 0,
    streak: 0,
    lastPlayDate: null,
    lastDailyDate: null,
    ownedCosmetics: [...FREE_DEFAULTS],
    equipped: { ...defaultEquipped },
    ownedCores: ["spark-seed"],
    battlePassLevel: 0,
    battlePassPremium: false,
    claimedFreeTiers: [],
    claimedPremiumTiers: [],
    bestDailyScore: 0,
    duelWins: 0,
    onboarded: false,
    history: [],
    lastUsernameChangeAt: null,
    lastDisplayNameChangeAt: null,
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function normalizeState(parsed: Partial<PlayerState> | null | undefined): PlayerState {
  const base = createDefaultState();
  if (!parsed || typeof parsed !== "object") return base;
  return {
    ...base,
    ...parsed,
    version: 1,
    ownedCosmetics: Array.from(
      new Set([...(parsed.ownedCosmetics ?? []), ...FREE_DEFAULTS]),
    ),
    equipped: { ...defaultEquipped, ...(parsed.equipped ?? {}) },
    ownedCores: parsed.ownedCores?.length ? parsed.ownedCores : base.ownedCores,
    claimedFreeTiers: parsed.claimedFreeTiers ?? [],
    claimedPremiumTiers: parsed.claimedPremiumTiers ?? [],
    history: parsed.history ?? [],
    lastUsernameChangeAt: parsed.lastUsernameChangeAt ?? null,
    lastDisplayNameChangeAt: parsed.lastDisplayNameChangeAt ?? null,
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
  };
}

/** Apply UI prefs to document root. */
export function applySettingsToDom(settings: UserSettings): void {
  const root = document.documentElement;
  root.dataset.accent = settings.accent;
  root.dataset.compact = settings.compactMode ? "1" : "0";
  root.dataset.largeText = settings.largeText ? "1" : "0";
  root.dataset.reduceMotion = settings.reduceMotion ? "1" : "0";
  root.dataset.hideTopCurrency = settings.hideTopCurrency ? "1" : "0";
}

export function msUntil(lastAt: string | null, cooldownMs: number): number {
  if (!lastAt) return 0;
  const elapsed = Date.now() - new Date(lastAt).getTime();
  return Math.max(0, cooldownMs - elapsed);
}

export function formatCooldown(ms: number): string {
  if (ms <= 0) return "available now";
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.ceil(ms / (60 * 1000));
  if (hours > 0) return `${hours}h ${mins % 60}m left`;
  return `${mins}m left`;
}

export function updateSettings(
  state: PlayerState,
  patch: Partial<UserSettings>,
): PlayerState {
  const next: PlayerState = {
    ...state,
    settings: { ...state.settings, ...patch },
  };
  applySettingsToDom(next.settings);
  saveState(next);
  return next;
}

export function updateDisplayName(
  state: PlayerState,
  name: string,
): { ok: true; state: PlayerState } | { ok: false; error: string } {
  const trimmed = name.trim().slice(0, 18);
  if (trimmed.length < 1) return { ok: false, error: "Display name cannot be empty." };
  if (trimmed === state.displayName) return { ok: false, error: "That's already your display name." };

  const wait = msUntil(state.lastDisplayNameChangeAt, DISPLAY_NAME_COOLDOWN_MS);
  if (wait > 0) {
    return { ok: false, error: `You can change your display name again in ${formatCooldown(wait)}.` };
  }

  const next: PlayerState = {
    ...state,
    displayName: trimmed,
    lastDisplayNameChangeAt: new Date().toISOString(),
  };
  saveState(next);
  return { ok: true, state: next };
}

function readLocalCache(userId: string): PlayerState | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    return normalizeState(JSON.parse(raw) as Partial<PlayerState>);
  } catch {
    return null;
  }
}

function writeLocalCache(userId: string, state: PlayerState): void {
  localStorage.setItem(cacheKey(userId), JSON.stringify(state));
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingState: PlayerState | null = null;
let cloudSyncError: string | null = null;

export function getCloudSyncError(): string | null {
  return cloudSyncError;
}

/** Load player state from Supabase (with local cache fallback). */
export async function loadState(): Promise<PlayerState> {
  const session = getCachedSession();
  if (!session) return createDefaultState();

  const cached = readLocalCache(session.userId);

  if (!isSupabaseConfigured()) {
    return cached ?? createDefaultState();
  }

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("profiles")
      .select("game_state, display_name, username, updated_at")
      .eq("user_id", session.userId)
      .maybeSingle();

    if (error) {
      console.warn("loadState cloud error", error.message);
      cloudSyncError = error.message;
      return cached ?? createDefaultState();
    }

    if (!data) {
      const fresh = cached ?? createDefaultState();
      writeLocalCache(session.userId, fresh);
      await pushStateToCloud(session.userId, fresh, session.username);
      return fresh;
    }

    const remote = normalizeState(data.game_state as Partial<PlayerState>);
    // Prefer non-empty cloud state; if cloud is empty default, keep cache if more advanced
    const remoteEmpty = !remote.onboarded && remote.totalAura === 0 && remote.sparks === 80;
    if (remoteEmpty && cached && (cached.onboarded || cached.totalAura > 0)) {
      await pushStateToCloud(session.userId, cached, session.username);
      cloudSyncError = null;
      return cached;
    }

    if (!remote.displayName && data.display_name) {
      remote.displayName = data.display_name;
    }
    writeLocalCache(session.userId, remote);
    cloudSyncError = null;
    return remote;
  } catch (e) {
    cloudSyncError = e instanceof Error ? e.message : "Cloud load failed";
    return cached ?? createDefaultState();
  }
}

async function pushStateToCloud(
  userId: string,
  state: PlayerState,
  username: string,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabase();
  const { error } = await sb.from("profiles").upsert(
    {
      user_id: userId,
      username,
      email: getCachedSession()?.email ?? "",
      display_name: state.displayName || username,
      game_state: state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    cloudSyncError = error.message;
    console.warn("cloud save failed", error.message);
  } else {
    cloudSyncError = null;
  }
}

/** Immediate local cache + debounced cloud upsert. */
export function saveState(state: PlayerState): void {
  const session = getCachedSession();
  if (!session) return;

  writeLocalCache(session.userId, state);
  pendingState = state;

  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const toSave = pendingState;
    pendingState = null;
    saveTimer = null;
    if (!toSave) return;
    void pushStateToCloud(session.userId, toSave, session.username);
  }, 400);
}

/** Flush pending cloud save (call before logout). */
export async function flushSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const session = getCachedSession();
  const toSave = pendingState;
  pendingState = null;
  if (session && toSave) {
    await pushStateToCloud(session.userId, toSave, session.username);
  }
}

export function resetState(): PlayerState {
  const s = createDefaultState();
  saveState(s);
  return s;
}

export function completeOnboarding(
  state: PlayerState,
  name: string,
  core: AestheticCore,
): PlayerState {
  const next: PlayerState = {
    ...state,
    displayName: name.trim().slice(0, 18) || "Aura Rookie",
    core,
    onboarded: true,
  };
  saveState(next);
  return next;
}

export function refreshStreak(state: PlayerState): PlayerState {
  const today = todayKey();
  if (!state.lastPlayDate) {
    return state;
  }
  if (state.lastPlayDate === today) {
    return state;
  }

  const last = new Date(state.lastPlayDate + "T12:00:00");
  const now = new Date(today + "T12:00:00");
  const diffDays = Math.round((now.getTime() - last.getTime()) / 86_400_000);

  const next: PlayerState = {
    ...state,
    streak: diffDays === 1 ? state.streak : 0,
  };
  saveState(next);
  return next;
}

export function hasPlayedDaily(state: PlayerState): boolean {
  return state.lastDailyDate === todayKey();
}
