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

function parseRpcResult(data: unknown, error: { message: string } | null): AdminResult {
  if (error) {
    const msg = error.message || "Request failed";
    if (msg.includes("function") || msg.includes("does not exist")) {
      return { ok: false, error: "Admin SQL not applied. Run supabase/admin.sql." };
    }
    if (msg.toLowerCase().includes("admin only")) {
      return { ok: false, error: "Admin only (server rejected). Are you logged in as @admin?" };
    }
    return { ok: false, error: msg };
  }
  if (data == null) return { ok: false, error: "Empty response from server." };
  const obj = (typeof data === "object" ? data : {}) as Record<string, unknown>;
  if (obj.ok === false || obj.ok === "false") {
    return { ok: false, error: String(obj.error ?? "Failed") };
  }
  if (obj.ok === true || obj.ok === "true" || obj.ok === undefined) {
    // Some RPCs return ok:true; treat missing ok + no error as success when we expect jsonb
    if (obj.ok === undefined && obj.error) {
      return { ok: false, error: String(obj.error) };
    }
    return { ok: true, message: obj.message ? String(obj.message) : undefined, ...obj } as AdminResult;
  }
  return { ok: false, error: String(obj.error ?? "Unexpected response") };
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
  const args: Record<string, unknown> = {
    p_username: username.trim().toLowerCase(),
    p_banned: banned,
  };
  // Avoid sending null (PostgREST overload issues); empty string clears on unban via SQL
  args.p_reason = banned ? reason.trim().slice(0, 200) : "";

  const { data, error } = await getSupabase().rpc("admin_set_ban", args);
  const parsed = parseRpcResult(data, error);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    message: banned
      ? `@${username.trim().toLowerCase()} is now banned.`
      : `@${username.trim().toLowerCase()} is unbanned.`,
  };
}

export async function adminDeleteUser(username: string): Promise<AdminResult> {
  const gate = requireAdminClient();
  if (gate) return gate;
  const uname = username.trim().toLowerCase();
  const { data, error } = await getSupabase().rpc("admin_delete_user", {
    p_username: uname,
  });
  console.info("admin_delete_user", { uname, data, error });
  const parsed = parseRpcResult(data, error);
  if (!parsed.ok) return parsed;
  return { ok: true, message: `Deleted @${uname}.` };
}

export interface AdminReportRow {
  id: string;
  reporterId: string;
  reportedId: string;
  duelId: string | null;
  reason: string;
  details: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  reporterUsername: string;
  reportedUsername: string;
  challengeTitle: string | null;
  player1Answer: string | null;
  player2Answer: string | null;
}

export async function adminListReports(): Promise<AdminReportRow[]> {
  if (!isCurrentUserAdmin() || !isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase().rpc("admin_list_reports");
  if (error) {
    console.warn("admin_list_reports", error.message);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      reporterId: String(row.reporter_id ?? ""),
      reportedId: String(row.reported_id ?? ""),
      duelId: row.duel_id ? String(row.duel_id) : null,
      reason: String(row.reason ?? ""),
      details: String(row.details ?? ""),
      status: String(row.status ?? "open"),
      adminNote: (row.admin_note as string | null) ?? null,
      createdAt: String(row.created_at ?? ""),
      reporterUsername: String(row.reporter_username ?? ""),
      reportedUsername: String(row.reported_username ?? ""),
      challengeTitle: (row.challenge_title as string | null) ?? null,
      player1Answer: (row.player1_answer as string | null) ?? null,
      player2Answer: (row.player2_answer as string | null) ?? null,
    };
  });
}

export async function adminResolveReport(
  id: string,
  status: "open" | "reviewed" | "dismissed" | "actioned",
  adminNote = "",
): Promise<AdminResult> {
  const gate = requireAdminClient();
  if (gate) return gate;
  const { data, error } = await getSupabase().rpc("admin_resolve_report", {
    p_id: id,
    p_status: status,
    p_admin_note: adminNote.trim().slice(0, 300),
  });
  const parsed = parseRpcResult(data, error);
  if (!parsed.ok) return parsed;
  return { ok: true, message: `Report marked ${status}.` };
}

export async function adminAdjustCurrency(
  username: string,
  sparksDelta: number,
  glowDelta: number,
): Promise<AdminResult> {
  const gate = requireAdminClient();
  if (gate) return gate;
  const uname = username.trim().toLowerCase();
  const { data, error } = await getSupabase().rpc("admin_adjust_currency", {
    p_username: uname,
    p_sparks_delta: Math.trunc(sparksDelta),
    p_glow_delta: Math.trunc(glowDelta),
  });
  const parsed = parseRpcResult(data, error);
  if (!parsed.ok) return parsed;
  const obj = (data || {}) as Record<string, unknown>;
  return {
    ok: true,
    message: `Updated @${uname}: sparks ${obj.sparks ?? "?"}, glow ${obj.glow ?? "?"}.`,
  };
}
