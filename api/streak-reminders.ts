import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

/**
 * Hourly (or external) cron: email users who opted into streak reminders
 * when local time matches and they have not played today's daily.
 *
 * Env:
 *  CRON_SECRET — Authorization: Bearer <secret>
 *  SUPABASE_URL or VITE_SUPABASE_URL
 *  SUPABASE_SERVICE_ROLE_KEY
 *  RESEND_API_KEY
 *  EMAIL_FROM — e.g. AuraFarm <onboarding@resend.dev>
 *  APP_URL — e.g. https://aurafarm-chi.vercel.app
 */

type ProfileRow = {
  user_id: string;
  email: string;
  username: string;
  display_name: string | null;
  game_state: Record<string, unknown> | null;
  streak_reminder_time: string;
  timezone: string;
  last_streak_reminder_date: string | null;
};

function localParts(timeZone: string, date = new Date()): {
  hour: number;
  minute: number;
  dateKey: string;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    hour: Number(parts.hour ?? 0),
    minute: Number(parts.minute ?? 0),
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

function parseTime(hhmm: string): { hour: number; minute: number } {
  const m = String(hhmm || "18:00").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return { hour: 18, minute: 0 };
  return {
    hour: Math.min(23, Math.max(0, Number(m[1]))),
    minute: Math.min(59, Math.max(0, Number(m[2]))),
  };
}

/** Match if local clock is in the same hour as the preferred time (hourly cron). */
function timeMatches(preferred: string, localHour: number): boolean {
  return localHour === parseTime(preferred).hour;
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY not set" };
  const from =
    process.env.EMAIL_FROM || "AuraFarm <onboarding@resend.dev>";

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    return { ok: false, error: t.slice(0, 300) };
  }
  return { ok: true };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || "";
  const cronHeader = req.headers["x-vercel-cron"];
  const okAuth =
    (secret && auth === `Bearer ${secret}`) ||
    (typeof cronHeader !== "undefined" && cronHeader !== "") ||
    (secret && (req.query.secret === secret || req.body?.secret === secret));

  if (!okAuth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const url =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceKey) {
    res.status(503).json({
      error: "Supabase service role not configured",
      need: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    });
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    res.status(503).json({
      error: "Email not configured",
      need: ["RESEND_API_KEY", "EMAIL_FROM (optional)"],
    });
    return;
  }

  const sb = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await sb
    .from("profiles")
    .select(
      "user_id, email, username, display_name, game_state, streak_reminder_time, timezone, last_streak_reminder_date",
    )
    .eq("streak_reminder_enabled", true)
    .limit(500);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const appUrl = process.env.APP_URL || "https://aurafarm-chi.vercel.app";
  const rows = (data ?? []) as ProfileRow[];
  let sent = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const row of rows) {
    const tz = row.timezone || "UTC";
    const local = localParts(tz);
    if (!timeMatches(row.streak_reminder_time || "18:00", local.hour)) {
      skipped++;
      continue;
    }
    if (row.last_streak_reminder_date === local.dateKey) {
      skipped++;
      continue;
    }

    const gs = row.game_state || {};
    const lastDaily = (gs.lastDailyDate as string | null) ?? null;
    if (lastDaily === local.dateKey) {
      skipped++;
      continue;
    }

    const streak = Number(gs.streak ?? 0) || 0;
    const name =
      (row.display_name && String(row.display_name).trim()) ||
      row.username ||
      "friend";
    const subject =
      streak > 0
        ? `🔥 Keep your ${streak}-day AuraFarm streak`
        : `🔥 Start today’s AuraFarm streak`;
    const text = `Hey ${name},

Don't let the 🔥 die. Play today's vibe challenge on AuraFarm to keep your streak${streak ? ` (${streak} days)` : ""}.

${appUrl}

— AuraFarm`;
    const html = `
      <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
        <p>Hey <strong>${escapeHtml(name)}</strong>,</p>
        <p>Don't let the <span aria-hidden="true">🔥</span> die. Play today's vibe challenge to keep your streak${
          streak ? ` (<strong>${streak} days</strong>)` : ""
        }.</p>
        <p><a href="${appUrl}" style="display:inline-block;padding:12px 18px;background:#bf5af2;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Open AuraFarm</a></p>
        <p style="color:#666;font-size:13px">You can turn off streak emails in Settings → General.</p>
      </div>
    `;

    const mail = await sendEmail({
      to: row.email,
      subject,
      html,
      text,
    });

    if (!mail.ok) {
      failures.push(`${row.username}: ${mail.error}`);
      continue;
    }

    await sb
      .from("profiles")
      .update({ last_streak_reminder_date: local.dateKey })
      .eq("user_id", row.user_id);

    sent++;
  }

  res.status(200).json({
    ok: true,
    checked: rows.length,
    sent,
    skipped,
    failures: failures.slice(0, 10),
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
