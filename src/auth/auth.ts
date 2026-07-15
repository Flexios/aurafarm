import { getSupabase, getSupabaseConfigError, isSupabaseConfigured } from "../lib/supabase";
import { forbiddenLanguageError } from "../utils/moderation";

export interface Session {
  userId: string;
  username: string;
  email: string;
}

export type AuthResult = { ok: true; session: Session } | { ok: false; error: string };

/** Cached session for sync callers (store save debounce). */
let cachedSession: Session | null = null;

export function getCachedSession(): Session | null {
  return cachedSession;
}

export function setCachedSession(session: Session | null): void {
  cachedSession = session;
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function validateUsername(username: string): string | null {
  const u = normalizeUsername(username);
  if (u.length < 3) return "Username must be at least 3 characters.";
  if (u.length > 20) return "Username must be 20 characters or less.";
  if (!/^[a-z0-9_]+$/.test(u)) return "Use letters, numbers, and underscores only.";
  const bad = forbiddenLanguageError(u, "That username");
  if (bad) return bad;
  return null;
}

export function validateDisplayName(name: string): string | null {
  const t = name.trim();
  if (t.length < 1) return "Display name cannot be empty.";
  if (t.length > 18) return "Display name must be 18 characters or less.";
  const bad = forbiddenLanguageError(t, "That display name");
  if (bad) return bad;
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 6) return "Password must be at least 6 characters.";
  if (password.length > 72) return "Password is too long.";
  return null;
}

export function validateEmail(email: string): string | null {
  const e = email.trim().toLowerCase();
  if (!e.includes("@") || e.length < 5) return "Enter a valid email.";
  if (e.length > 120) return "Email is too long.";
  return null;
}

async function sessionFromUser(userId: string, email: string): Promise<Session> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("profiles")
    .select("username, email")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("profile fetch", error.message);
  }

  const username =
    (data?.username as string | undefined) ||
    email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "_") ||
    "player";

  const session: Session = {
    userId,
    username,
    email: (data?.email as string | undefined) || email,
  };
  cachedSession = session;
  return session;
}

export async function restoreSession(): Promise<Session | null> {
  if (!isSupabaseConfigured()) {
    cachedSession = null;
    return null;
  }
  const sb = getSupabase();
  const { data, error } = await sb.auth.getSession();
  if (error || !data.session?.user) {
    cachedSession = null;
    return null;
  }
  const user = data.session.user;
  // Kick banned users even with a valid JWT
  const ban = await readBanForUser(user.id);
  if (ban.banned) {
    try {
      await sb.auth.signOut();
    } catch {
      /* ignore */
    }
    cachedSession = null;
    return null;
  }
  return sessionFromUser(user.id, user.email ?? "");
}

/** Sync peek — prefer restoreSession() on boot. */
export function getSession(): Session | null {
  return cachedSession;
}

export async function register(
  email: string,
  username: string,
  password: string,
): Promise<AuthResult> {
  const cfg = getSupabaseConfigError();
  if (cfg) return { ok: false, error: cfg };

  const emailErr = validateEmail(email);
  if (emailErr) return { ok: false, error: emailErr };
  const userErr = validateUsername(username);
  if (userErr) return { ok: false, error: userErr };
  const passErr = validatePassword(password);
  if (passErr) return { ok: false, error: passErr };

  const sb = getSupabase();
  const normalizedUser = normalizeUsername(username);
  const normalizedEmail = email.trim().toLowerCase();

  // Pre-check username uniqueness (best-effort; unique index is source of truth)
  const { data: existing } = await sb.rpc("email_for_username", {
    p_username: normalizedUser,
  });
  if (existing) {
    return { ok: false, error: "That username is already taken." };
  }

  const { data, error } = await sb.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: { username: normalizedUser },
    },
  });

  if (error) {
    return { ok: false, error: friendlyAuthError(error.message) };
  }
  if (!data.user) {
    return { ok: false, error: "Sign up failed. Try again." };
  }

  // If email confirmation is required, session may be null
  if (!data.session) {
    return {
      ok: false,
      error:
        "Account created — check your email to confirm, then log in. (Or disable email confirm in Supabase for instant play.)",
    };
  }

  // Ensure profile exists (trigger should create it; upsert as safety net)
  await sb.from("profiles").upsert(
    {
      user_id: data.user.id,
      username: normalizedUser,
      email: normalizedEmail,
      display_name: normalizedUser,
      game_state: {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  const session = await sessionFromUser(data.user.id, normalizedEmail);
  return { ok: true, session };
}

export async function login(identifier: string, password: string): Promise<AuthResult> {
  const cfg = getSupabaseConfigError();
  if (cfg) return { ok: false, error: cfg };

  if (!identifier.trim() || !password) {
    return { ok: false, error: "Enter email/username and password." };
  }

  const sb = getSupabase();
  let email = identifier.trim().toLowerCase();

  if (!email.includes("@")) {
    const { data, error } = await sb.rpc("email_for_username", {
      p_username: normalizeUsername(identifier),
    });
    if (error) {
      return { ok: false, error: "Could not look up username. Is the database schema applied?" };
    }
    if (!data || typeof data !== "string") {
      return { ok: false, error: "Invalid username or password." };
    }
    email = data;
  }

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { ok: false, error: "Invalid email/username or password." };
  }

  const ban = await readBanForUser(data.user.id);
  if (ban.banned) {
    await sb.auth.signOut();
    cachedSession = null;
    return {
      ok: false,
      error: `This account is banned.${ban.reason ? ` ${ban.reason}` : ""}`,
    };
  }

  const session = await sessionFromUser(data.user.id, data.user.email ?? email);
  return { ok: true, session };
}

async function readBanForUser(
  userId: string,
): Promise<{ banned: boolean; reason: string | null }> {
  if (!isSupabaseConfigured()) return { banned: false, reason: null };
  const sb = getSupabase();
  // Prefer RPC (security definer) so ban always readable
  try {
    const { data, error } = await sb.rpc("get_own_ban_status");
    if (!error && data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      // Only trust RPC if it matches this user session
      return {
        banned: Boolean(obj.banned),
        reason: obj.reason ? String(obj.reason) : null,
      };
    }
  } catch {
    /* fall through */
  }
  const { data: prof, error } = await sb
    .from("profiles")
    .select("banned, ban_reason")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !prof) return { banned: false, reason: null };
  return {
    banned: Boolean((prof as { banned?: boolean }).banned),
    reason: ((prof as { ban_reason?: string | null }).ban_reason as string | null) ?? null,
  };
}

/** Used on boot/session restore to kick banned accounts. */
export async function ensureNotBanned(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (!isSupabaseConfigured() || !cachedSession) return { ok: true };
  const ban = await readBanForUser(cachedSession.userId);
  if (!ban.banned) return { ok: true };
  await logout();
  return {
    ok: false,
    error: `This account is banned.${ban.reason ? ` ${ban.reason}` : ""}`,
  };
}

export type SimpleResult = { ok: true; message?: string } | { ok: false; error: string };

export async function logout(): Promise<void> {
  cachedSession = null;
  if (!isSupabaseConfigured()) return;
  try {
    await getSupabase().auth.signOut();
  } catch {
    /* ignore */
  }
}

/**
 * Permanently delete the signed-in user and related data (via RPC).
 * Requires supabase/delete_account.sql applied on the project.
 */
export async function deleteAccount(): Promise<SimpleResult> {
  const cfg = getSupabaseConfigError();
  if (cfg) return { ok: false, error: cfg };
  const session = getCachedSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const sb = getSupabase();
  const { data, error } = await sb.rpc("delete_own_account");
  if (error) {
    return {
      ok: false,
      error: error.message.includes("function") || error.message.includes("does not exist")
        ? "Delete account is not set up yet. Run supabase/delete_account.sql in Supabase."
        : error.message,
    };
  }
  const obj = data as Record<string, unknown> | null;
  if (obj && obj.ok === false) {
    return { ok: false, error: String(obj.error ?? "Could not delete account.") };
  }

  // Clear local cache for this user
  try {
    const key = `aurafarm.cloudcache.v1:${session.userId}`;
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }

  cachedSession = null;
  try {
    await sb.auth.signOut();
  } catch {
    /* user may already be gone */
  }

  return { ok: true, message: "Account deleted." };
}

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "An account with that email already exists. Log in instead.";
  }
  if (m.includes("password")) return "Password is too weak. Use at least 6 characters.";
  if (m.includes("rate")) return "Too many attempts. Wait a moment and try again.";
  if (m.includes("same")) return message;
  return message;
}

export async function changePassword(newPassword: string): Promise<SimpleResult> {
  const cfg = getSupabaseConfigError();
  if (cfg) return { ok: false, error: cfg };
  const passErr = validatePassword(newPassword);
  if (passErr) return { ok: false, error: passErr };

  const sb = getSupabase();
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: friendlyAuthError(error.message) };
  return { ok: true, message: "Password updated." };
}

export async function changeEmail(newEmail: string): Promise<SimpleResult> {
  const cfg = getSupabaseConfigError();
  if (cfg) return { ok: false, error: cfg };
  const emailErr = validateEmail(newEmail);
  if (emailErr) return { ok: false, error: emailErr };

  const normalized = newEmail.trim().toLowerCase();
  const session = getCachedSession();
  if (session && session.email === normalized) {
    return { ok: false, error: "That's already your email." };
  }

  const sb = getSupabase();
  const { data, error } = await sb.auth.updateUser({ email: normalized });
  if (error) return { ok: false, error: friendlyAuthError(error.message) };

  const userId = data.user?.id ?? session?.userId;
  if (userId) {
    await sb
      .from("profiles")
      .update({ email: normalized, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (cachedSession) {
      cachedSession = { ...cachedSession, email: normalized };
    }
  }

  // With autoconfirm off for email change, user may need to confirm
  return {
    ok: true,
    message:
      "Email update requested. If confirmation is required, check your inbox for both addresses.",
  };
}

export async function changeUsername(newUsername: string): Promise<SimpleResult> {
  const cfg = getSupabaseConfigError();
  if (cfg) return { ok: false, error: cfg };
  const userErr = validateUsername(newUsername);
  if (userErr) return { ok: false, error: userErr };

  const session = getCachedSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const normalized = normalizeUsername(newUsername);
  if (normalized === session.username) {
    return { ok: false, error: "That's already your username." };
  }

  const sb = getSupabase();

  // Availability check
  const { data: existingEmail, error: lookupErr } = await sb.rpc("email_for_username", {
    p_username: normalized,
  });
  if (lookupErr) {
    return { ok: false, error: "Could not check username availability." };
  }
  if (existingEmail && typeof existingEmail === "string") {
    return { ok: false, error: "That username is already taken." };
  }

  const { error } = await sb
    .from("profiles")
    .update({
      username: normalized,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", session.userId);

  if (error) {
    if (error.message.toLowerCase().includes("unique") || error.code === "23505") {
      return { ok: false, error: "That username is already taken." };
    }
    return { ok: false, error: error.message };
  }

  cachedSession = { ...session, username: normalized };
  return { ok: true, message: "Username updated." };
}
