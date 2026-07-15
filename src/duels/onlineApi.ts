import { getSupabase, isSupabaseConfigured } from "../lib/supabase";

export type OnlineDuelStatus = "open" | "complete" | "cancelled";

export interface OnlineDuel {
  id: string;
  player1Id: string;
  player2Id: string;
  challengeTitle: string;
  challengePrompt: string;
  player1Answer: string | null;
  player2Answer: string | null;
  player1Score: number | null;
  player2Score: number | null;
  status: OnlineDuelStatus;
  createdAt: string;
  player1Username: string;
  player2Username: string;
}

export type FindResult =
  | { ok: true; status: "searching" }
  | {
      ok: true;
      status: "matched";
      duelId: string;
      player1Id: string;
      player2Id: string;
    }
  | { ok: false; error: string };

export type SimpleOk = { ok: true } | { ok: false; error: string };

function mapDuel(row: Record<string, unknown>): OnlineDuel {
  return {
    id: String(row.id ?? ""),
    player1Id: String(row.player1_id ?? ""),
    player2Id: String(row.player2_id ?? ""),
    challengeTitle: String(row.challenge_title ?? ""),
    challengePrompt: String(row.challenge_prompt ?? ""),
    player1Answer: (row.player1_answer as string | null) ?? null,
    player2Answer: (row.player2_answer as string | null) ?? null,
    player1Score: row.player1_score == null ? null : Number(row.player1_score),
    player2Score: row.player2_score == null ? null : Number(row.player2_score),
    status: (String(row.status ?? "open") as OnlineDuelStatus) || "open",
    createdAt: String(row.created_at ?? ""),
    player1Username: String(row.player1_username ?? ""),
    player2Username: String(row.player2_username ?? ""),
  };
}

export async function findOnlineDuel(
  title: string,
  prompt: string,
): Promise<FindResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Cloud not configured." };
  const { data, error } = await getSupabase().rpc("find_online_duel", {
    p_title: title,
    p_prompt: prompt,
  });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("function")
        ? "Online duels not set up. Run supabase/online_duels.sql."
        : error.message,
    };
  }
  const obj = data as Record<string, unknown>;
  if (!obj?.ok) return { ok: false, error: String(obj?.error ?? "Failed") };
  if (obj.status === "matched") {
    return {
      ok: true,
      status: "matched",
      duelId: String(obj.duel_id ?? ""),
      player1Id: String(obj.player1_id ?? ""),
      player2Id: String(obj.player2_id ?? ""),
    };
  }
  return { ok: true, status: "searching" };
}

export async function cancelOnlineQueue(): Promise<SimpleOk> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Cloud not configured." };
  const { data, error } = await getSupabase().rpc("cancel_online_queue");
  if (error) return { ok: false, error: error.message };
  const obj = data as Record<string, unknown>;
  if (obj && obj.ok === false) return { ok: false, error: String(obj.error ?? "Failed") };
  return { ok: true };
}

export async function listMyOnlineDuels(): Promise<{
  duels: OnlineDuel[];
  searching: boolean;
}> {
  if (!isSupabaseConfigured()) return { duels: [], searching: false };
  const { data, error } = await getSupabase().rpc("get_my_online_duel");
  if (error) {
    console.warn("get_my_online_duel", error.message);
    return { duels: [], searching: false };
  }
  if (!Array.isArray(data) || data.length === 0) {
    // Still check queue via queue_status if empty
    const qs = await queueStatus();
    return { duels: [], searching: qs.searching };
  }
  const rows = data as Record<string, unknown>[];
  const searching = Boolean(rows[0]?.searching);
  return {
    duels: rows.map(mapDuel),
    searching,
  };
}

export async function queueStatus(): Promise<{ searching: boolean; waiting: number }> {
  if (!isSupabaseConfigured()) return { searching: false, waiting: 0 };
  const { data, error } = await getSupabase().rpc("queue_status");
  if (error || !data) return { searching: false, waiting: 0 };
  const obj = data as Record<string, unknown>;
  return {
    searching: Boolean(obj.searching),
    waiting: Number(obj.waiting ?? 0),
  };
}

export async function submitOnlineDuelAnswer(
  duelId: string,
  answer: string,
): Promise<SimpleOk> {
  const { data, error } = await getSupabase().rpc("submit_online_duel_answer", {
    p_duel_id: duelId,
    p_answer: answer,
  });
  if (error) return { ok: false, error: error.message };
  const obj = data as Record<string, unknown>;
  if (!obj?.ok) return { ok: false, error: String(obj?.error ?? "Failed") };
  return { ok: true };
}

export async function completeOnlineDuel(
  duelId: string,
  player1Score: number,
  player2Score: number,
): Promise<SimpleOk> {
  const { data, error } = await getSupabase().rpc("complete_online_duel", {
    p_duel_id: duelId,
    p_player1_score: player1Score,
    p_player2_score: player2Score,
  });
  if (error) return { ok: false, error: error.message };
  const obj = data as Record<string, unknown>;
  if (!obj?.ok) return { ok: false, error: String(obj?.error ?? "Failed") };
  return { ok: true };
}

export type ReportReason =
  | "spam"
  | "harassment"
  | "inappropriate"
  | "cheating"
  | "other";

export async function reportUser(opts: {
  reportedUsername: string;
  reason: ReportReason;
  details?: string;
  duelId?: string | null;
}): Promise<SimpleOk> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Cloud not configured." };
  const { data, error } = await getSupabase().rpc("report_user", {
    p_reported_username: opts.reportedUsername.trim(),
    p_reason: opts.reason,
    p_details: (opts.details ?? "").trim().slice(0, 500),
    p_duel_id: opts.duelId || null,
  });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("function")
        ? "Reports not set up. Run supabase/reports.sql."
        : error.message,
    };
  }
  const obj = data as Record<string, unknown>;
  if (!obj?.ok) return { ok: false, error: String(obj?.error ?? "Failed") };
  return { ok: true };
}
