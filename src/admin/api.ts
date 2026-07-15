import { getCachedSession } from "../auth/auth";
import { getSupabase, getSupabaseConfigError, isSupabaseConfigured } from "../lib/supabase";
import { isCurrentUserAdmin } from "./gate";

export type AdminResult = { ok: true; message?: string } | { ok: false; error: string };

export interface AdminUserRow {
  userId: string;
  username: string;
  displayName: string;
  email: string;
  banned: boolean;
  banReason: string | null;
  sparks: number;
  glow: number;
  totalAura: number;
  updatedAt: string;
}

function requireAdminClient(): AdminResult | null {
  if (!isCurrentUserAdmin()) return { ok: false, error: "Admin only." };
  const cfg = getSupabaseConfigError();
  if (cfg) return { ok: false, error: cfg };
  if (!getCachedSession()) return { ok: false, error: "Not signed in." };
  return null;
}

export async function adminListUsers(): Promise<AdminUserRow[]> {
  if (!isCurrentUserAdmin() || !isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase().rpc("admin_list_users");
  if (error) {
    console.warn("admin_list_users", error.message);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      userId: String(row.user_id ?? ""),
      username: String(row.username ?? ""),
      displayName: String(row.display_name ?? row.username ?? ""),
      email: String(row.email ?? ""),
      banned: Boolean(row.banned),
      banReason: (row.ban_reason as string | null) ?? null,
      sparks: Number(row.sparks ?? 0),
      glow: Number(row.glow ?? 0),
      totalAura: Number(row.total_aura ?? 0),
      updatedAt: String(row.updated_at ?? ""),
    };
  });
}

export async function adminSetBan(
  username: string,
  banned: boolean,
  reason = "",
): Promise<AdminResult> {
  const gate = requireAdminClient();
  if (gate) return gate;
  const { data, error } = await getSupabase().rpc("admin_set_ban", {
    p_username: username.trim(),
    p_banned: banned,
    p_reason: reason.trim().slice(0, 200) || null,
  });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("function")
        ? "Admin SQL not applied. Run supabase/admin.sql."
        : error.message,
    };
  }
  const obj = data as Record<string, unknown>;
  if (!obj?.ok) return { ok: false, error: String(obj?.error ?? "Failed") };
  return {
    ok: true,
    message: banned ? `@${username} banned.` : `@${username} unbanned.`,
  };
}

export async function adminDeleteUser(username: string): Promise<AdminResult> {
  const gate = requireAdminClient();
  if (gate) return gate;
  const { data, error } = await getSupabase().rpc("admin_delete_user", {
    p_username: username.trim(),
  });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("function")
        ? "Admin SQL not applied. Run supabase/admin.sql."
        : error.message,
    };
  }
  const obj = data as Record<string, unknown>;
  if (!obj?.ok) return { ok: false, error: String(obj?.error ?? "Failed") };
  return { ok: true, message: `Deleted @${username}.` };
}

export async function adminAdjustCurrency(
  username: string,
  sparksDelta: number,
  glowDelta: number,
): Promise<AdminResult> {
  const gate = requireAdminClient();
  if (gate) return gate;
  const { data, error } = await getSupabase().rpc("admin_adjust_currency", {
    p_username: username.trim(),
    p_sparks_delta: Math.trunc(sparksDelta),
    p_glow_delta: Math.trunc(glowDelta),
  });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("function")
        ? "Admin SQL not applied. Run supabase/admin.sql."
        : error.message,
    };
  }
  const obj = data as Record<string, unknown>;
  if (!obj?.ok) return { ok: false, error: String(obj?.error ?? "Failed") };
  return {
    ok: true,
    message: `Updated @${username}: sparks ${obj.sparks}, glow ${obj.glow}.`,
  };
}

/** Check if a user id is banned (used after login). */
export async function fetchBanStatus(userId: string): Promise<{
  banned: boolean;
  reason: string | null;
}> {
  if (!isSupabaseConfigured()) return { banned: false, reason: null };
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("banned, ban_reason")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return { banned: false, reason: null };
  return {
    banned: Boolean((data as { banned?: boolean }).banned),
    reason: ((data as { ban_reason?: string | null }).ban_reason as string | null) ?? null,
  };
}
