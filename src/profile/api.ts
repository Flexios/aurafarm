import { getCachedSession } from "../auth/auth";
import { getSupabase, getSupabaseConfigError, isSupabaseConfigured } from "../lib/supabase";

export interface PublicProfile {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  totalAura: number;
  streak: number;
  duelWins: number;
  core: string;
  bestDailyScore: number;
  battlePassLevel: number;
  coresCount: number;
}

export interface ProfileSearchHit {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  totalAura: number;
  core: string;
}

function mapProfile(row: Record<string, unknown>): PublicProfile {
  return {
    userId: String(row.user_id ?? ""),
    username: String(row.username ?? ""),
    displayName: String(row.display_name ?? row.username ?? ""),
    avatarUrl: (row.avatar_url as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
    totalAura: Number(row.total_aura ?? 0),
    streak: Number(row.streak ?? 0),
    duelWins: Number(row.duel_wins ?? 0),
    core: String(row.core ?? "main-character"),
    bestDailyScore: Number(row.best_daily_score ?? 0),
    battlePassLevel: Number(row.battle_pass_level ?? 0),
    coresCount: Number(row.cores_count ?? 0),
  };
}

export async function fetchPublicProfile(username: string): Promise<PublicProfile | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  const { data, error } = await sb.rpc("get_public_profile", {
    p_username: username.trim(),
  });
  if (error) {
    console.warn("get_public_profile", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return mapProfile(row as Record<string, unknown>);
}

export async function searchProfiles(query: string): Promise<ProfileSearchHit[]> {
  if (!isSupabaseConfigured() || query.trim().length < 1) return [];
  const sb = getSupabase();
  const { data, error } = await sb.rpc("search_public_profiles", {
    p_query: query.trim(),
  });
  if (error) {
    console.warn("search_public_profiles", error.message);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      userId: String(r.user_id ?? ""),
      username: String(r.username ?? ""),
      displayName: String(r.display_name ?? r.username ?? ""),
      avatarUrl: (r.avatar_url as string | null) ?? null,
      totalAura: Number(r.total_aura ?? 0),
      core: String(r.core ?? "main-character"),
    };
  });
}

export async function updateBio(bio: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const cfg = getSupabaseConfigError();
  if (cfg) return { ok: false, error: cfg };
  const session = getCachedSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const trimmed = bio.trim().slice(0, 160);
  const sb = getSupabase();
  const { error } = await sb
    .from("profiles")
    .update({ bio: trimmed || null, updated_at: new Date().toISOString() })
    .eq("user_id", session.userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setAvatarUrl(
  url: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = getCachedSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const sb = getSupabase();
  const { error } = await sb
    .from("profiles")
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
    .eq("user_id", session.userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Compress image to JPEG blob (max edge 512). */
export async function fileToAvatarBlob(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const max = 512;
  let { width, height } = bitmap;
  if (width > max || height > max) {
    const scale = max / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Could not process image"));
        else resolve(blob);
      },
      "image/jpeg",
      0.88,
    );
  });
}

export async function uploadAvatar(
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const cfg = getSupabaseConfigError();
  if (cfg) return { ok: false, error: cfg };
  const session = getCachedSession();
  if (!session) return { ok: false, error: "Not signed in." };

  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Please choose an image file." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, error: "Image must be under 8MB." };
  }

  try {
    const blob = await fileToAvatarBlob(file);
    const path = `${session.userId}/avatar.jpg`;
    const sb = getSupabase();

    const { error: upErr } = await sb.storage.from("avatars").upload(path, blob, {
      upsert: true,
      contentType: "image/jpeg",
      cacheControl: "3600",
    });
    if (upErr) {
      return {
        ok: false,
        error:
          upErr.message.includes("Bucket not found") || upErr.message.includes("not found")
            ? "Avatar storage not set up. Run supabase/profiles_public.sql in Supabase."
            : upErr.message,
      };
    }

    const { data } = sb.storage.from("avatars").getPublicUrl(path);
    const url = `${data.publicUrl}?t=${Date.now()}`;

    const saved = await setAvatarUrl(url);
    if (!saved.ok) return saved;

    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Upload failed." };
  }
}

export async function removeAvatar(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = getCachedSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const sb = getSupabase();
  await sb.storage.from("avatars").remove([`${session.userId}/avatar.jpg`]);
  return setAvatarUrl(null);
}

export async function loadOwnAvatarUrl(): Promise<string | null> {
  const session = getCachedSession();
  if (!session || !isSupabaseConfigured()) return null;
  const sb = getSupabase();
  const { data } = await sb
    .from("profiles")
    .select("avatar_url, bio")
    .eq("user_id", session.userId)
    .maybeSingle();
  return (data?.avatar_url as string | null) ?? null;
}

export async function loadOwnBio(): Promise<string> {
  const session = getCachedSession();
  if (!session || !isSupabaseConfigured()) return "";
  const sb = getSupabase();
  const { data } = await sb
    .from("profiles")
    .select("bio")
    .eq("user_id", session.userId)
    .maybeSingle();
  return (data?.bio as string | null) ?? "";
}
