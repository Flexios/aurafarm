import { getSupabase, getSupabaseConfigError, isSupabaseConfigured } from "../lib/supabase";

export type FriendshipStatus =
  | "none"
  | "self"
  | "friends"
  | "incoming"
  | "outgoing";

export interface FriendRow {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  totalAura: number;
  core: string;
  friendsSince: string | null;
}

export interface FriendRequestRow {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  totalAura: number;
  createdAt: string;
}

export interface FriendshipStatusInfo {
  status: FriendshipStatus;
  id?: string;
  userId?: string;
}

function mapFriend(row: Record<string, unknown>): FriendRow {
  return {
    userId: String(row.user_id ?? ""),
    username: String(row.username ?? ""),
    displayName: String(row.display_name ?? row.username ?? ""),
    avatarUrl: (row.avatar_url as string | null) ?? null,
    totalAura: Number(row.total_aura ?? 0),
    core: String(row.core ?? "main-character"),
    friendsSince: (row.friends_since as string | null) ?? null,
  };
}

function mapRequest(row: Record<string, unknown>): FriendRequestRow {
  return {
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? ""),
    username: String(row.username ?? ""),
    displayName: String(row.display_name ?? row.username ?? ""),
    avatarUrl: (row.avatar_url as string | null) ?? null,
    totalAura: Number(row.total_aura ?? 0),
    createdAt: String(row.created_at ?? ""),
  };
}

export async function listFriends(): Promise<FriendRow[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase().rpc("list_friends");
  if (error) {
    console.warn("list_friends", error.message);
    return [];
  }
  return Array.isArray(data)
    ? data.map((r) => mapFriend(r as Record<string, unknown>))
    : [];
}

export async function listIncomingRequests(): Promise<FriendRequestRow[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase().rpc("list_incoming_friend_requests");
  if (error) {
    console.warn("list_incoming", error.message);
    return [];
  }
  return Array.isArray(data)
    ? data.map((r) => mapRequest(r as Record<string, unknown>))
    : [];
}

export async function listOutgoingRequests(): Promise<FriendRequestRow[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase().rpc("list_outgoing_friend_requests");
  if (error) {
    console.warn("list_outgoing", error.message);
    return [];
  }
  return Array.isArray(data)
    ? data.map((r) => mapRequest(r as Record<string, unknown>))
    : [];
}

export async function getFriendshipStatus(
  username: string,
): Promise<FriendshipStatusInfo> {
  if (!isSupabaseConfigured()) return { status: "none" };
  const { data, error } = await getSupabase().rpc("friendship_status", {
    p_username: username.trim(),
  });
  if (error || !data) {
    console.warn("friendship_status", error?.message);
    return { status: "none" };
  }
  const obj = data as Record<string, unknown>;
  return {
    status: (obj.status as FriendshipStatus) || "none",
    id: obj.id ? String(obj.id) : undefined,
    userId: obj.user_id ? String(obj.user_id) : undefined,
  };
}

export type FriendActionResult =
  | { ok: true; status?: string; message?: string }
  | { ok: false; error: string };

export async function sendFriendRequest(username: string): Promise<FriendActionResult> {
  const cfg = getSupabaseConfigError();
  if (cfg) return { ok: false, error: cfg };
  const { data, error } = await getSupabase().rpc("send_friend_request", {
    p_username: username.trim(),
  });
  if (error) {
    return {
      ok: false,
      error:
        error.message.includes("function") || error.message.includes("does not exist")
          ? "Friend system not set up. Run supabase/friends.sql in Supabase."
          : error.message,
    };
  }
  const obj = data as Record<string, unknown>;
  if (!obj?.ok) return { ok: false, error: String(obj?.error ?? "Failed") };
  return {
    ok: true,
    status: String(obj.status ?? "pending"),
    message:
      obj.status === "accepted"
        ? "You are now friends!"
        : "Friend request sent.",
  };
}

export async function acceptFriendRequest(id: string): Promise<FriendActionResult> {
  const { data, error } = await getSupabase().rpc("respond_friend_request", {
    p_id: id,
    p_accept: true,
  });
  if (error) return { ok: false, error: error.message };
  const obj = data as Record<string, unknown>;
  if (!obj?.ok) return { ok: false, error: String(obj?.error ?? "Failed") };
  return { ok: true, message: "Friend request accepted." };
}

export async function declineFriendRequest(id: string): Promise<FriendActionResult> {
  const { data, error } = await getSupabase().rpc("respond_friend_request", {
    p_id: id,
    p_accept: false,
  });
  if (error) return { ok: false, error: error.message };
  const obj = data as Record<string, unknown>;
  if (!obj?.ok) return { ok: false, error: String(obj?.error ?? "Failed") };
  return { ok: true, message: "Request declined." };
}

export async function cancelFriendRequest(id: string): Promise<FriendActionResult> {
  const { data, error } = await getSupabase().rpc("cancel_friend_request", {
    p_id: id,
  });
  if (error) return { ok: false, error: error.message };
  const obj = data as Record<string, unknown>;
  if (!obj?.ok) return { ok: false, error: String(obj?.error ?? "Failed") };
  return { ok: true, message: "Request cancelled." };
}

export async function removeFriend(userId: string): Promise<FriendActionResult> {
  const { data, error } = await getSupabase().rpc("remove_friend", {
    p_user_id: userId,
  });
  if (error) return { ok: false, error: error.message };
  const obj = data as Record<string, unknown>;
  if (!obj?.ok) return { ok: false, error: String(obj?.error ?? "Failed") };
  return { ok: true, message: "Friend removed." };
}

/** Human-readable friendship length. */
export function formatFriendshipDuration(since: string | null): string {
  if (!since) return "Friends";
  const start = new Date(since).getTime();
  if (Number.isNaN(start)) return "Friends";
  const ms = Math.max(0, Date.now() - start);
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);
  if (mins < 60) return mins <= 1 ? "Friends for just now" : `Friends for ${mins} minutes`;
  if (hours < 24) return hours === 1 ? "Friends for 1 hour" : `Friends for ${hours} hours`;
  if (days === 1) return "Friends for 1 day";
  if (days < 30) return `Friends for ${days} days`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "Friends for 1 month" : `Friends for ${months} months`;
  const years = Math.floor(days / 365);
  return years === 1 ? "Friends for 1 year" : `Friends for ${years} years`;
}

// ——— Private notes ———
export async function getFriendNote(friendId: string): Promise<string> {
  if (!isSupabaseConfigured()) return "";
  const { data, error } = await getSupabase().rpc("get_friend_note", {
    p_friend_id: friendId,
  });
  if (error) {
    console.warn("get_friend_note", error.message);
    return "";
  }
  return typeof data === "string" ? data : "";
}

export async function saveFriendNote(
  friendId: string,
  note: string,
): Promise<FriendActionResult> {
  const { data, error } = await getSupabase().rpc("upsert_friend_note", {
    p_friend_id: friendId,
    p_note: note,
  });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("function")
        ? "Notes not set up. Run supabase/friends_social.sql."
        : error.message,
    };
  }
  const obj = data as Record<string, unknown>;
  if (!obj?.ok) return { ok: false, error: String(obj?.error ?? "Failed") };
  return { ok: true, message: "Note saved (only you can see it)." };
}

// ——— DMs ———
export interface DmMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

export async function listFriendDms(friendId: string): Promise<DmMessage[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase().rpc("list_friend_dms", {
    p_friend_id: friendId,
  });
  if (error) {
    console.warn("list_friend_dms", error.message);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      senderId: String(row.sender_id ?? ""),
      body: String(row.body ?? ""),
      createdAt: String(row.created_at ?? ""),
      mine: Boolean(row.mine),
    };
  });
}

export async function sendFriendDm(
  friendId: string,
  body: string,
): Promise<FriendActionResult> {
  const { data, error } = await getSupabase().rpc("send_friend_dm", {
    p_recipient_id: friendId,
    p_body: body,
  });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("function")
        ? "DMs not set up. Run supabase/friends_social.sql."
        : error.message,
    };
  }
  const obj = data as Record<string, unknown>;
  if (!obj?.ok) return { ok: false, error: String(obj?.error ?? "Failed") };
  return { ok: true };
}

// ——— Battles ———
export interface FriendBattle {
  id: string;
  challengerId: string;
  opponentId: string;
  challengeTitle: string;
  challengePrompt: string;
  challengerAnswer: string | null;
  opponentAnswer: string | null;
  challengerScore: number | null;
  opponentScore: number | null;
  status: string;
  createdAt: string;
  challengerUsername: string;
  opponentUsername: string;
}

export async function listFriendBattles(): Promise<FriendBattle[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase().rpc("list_friend_battles");
  if (error) {
    console.warn("list_friend_battles", error.message);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      challengerId: String(row.challenger_id ?? ""),
      opponentId: String(row.opponent_id ?? ""),
      challengeTitle: String(row.challenge_title ?? ""),
      challengePrompt: String(row.challenge_prompt ?? ""),
      challengerAnswer: (row.challenger_answer as string | null) ?? null,
      opponentAnswer: (row.opponent_answer as string | null) ?? null,
      challengerScore:
        row.challenger_score == null ? null : Number(row.challenger_score),
      opponentScore: row.opponent_score == null ? null : Number(row.opponent_score),
      status: String(row.status ?? "open"),
      createdAt: String(row.created_at ?? ""),
      challengerUsername: String(row.challenger_username ?? ""),
      opponentUsername: String(row.opponent_username ?? ""),
    };
  });
}

export async function createFriendBattle(
  opponentId: string,
  title: string,
  prompt: string,
  answer: string,
): Promise<FriendActionResult & { id?: string }> {
  const { data, error } = await getSupabase().rpc("create_friend_battle", {
    p_opponent_id: opponentId,
    p_title: title,
    p_prompt: prompt,
    p_answer: answer,
  });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("function")
        ? "Battles not set up. Run supabase/friends_social.sql."
        : error.message,
    };
  }
  const obj = data as Record<string, unknown>;
  if (!obj?.ok) return { ok: false, error: String(obj?.error ?? "Failed") };
  return { ok: true, id: obj.id ? String(obj.id) : undefined, message: "Battle sent!" };
}

export async function submitFriendBattleAnswer(
  battleId: string,
  answer: string,
): Promise<FriendActionResult> {
  const { data, error } = await getSupabase().rpc("submit_friend_battle_answer", {
    p_battle_id: battleId,
    p_answer: answer,
  });
  if (error) return { ok: false, error: error.message };
  const obj = data as Record<string, unknown>;
  if (!obj?.ok) return { ok: false, error: String(obj?.error ?? "Failed") };
  return { ok: true, message: "Answer submitted." };
}

export async function completeFriendBattle(
  battleId: string,
  challengerScore: number,
  opponentScore: number,
): Promise<FriendActionResult> {
  const { data, error } = await getSupabase().rpc("complete_friend_battle", {
    p_battle_id: battleId,
    p_challenger_score: challengerScore,
    p_opponent_score: opponentScore,
  });
  if (error) return { ok: false, error: error.message };
  const obj = data as Record<string, unknown>;
  if (!obj?.ok) return { ok: false, error: String(obj?.error ?? "Failed") };
  return { ok: true, message: "Battle complete." };
}
