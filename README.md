# AuraFarm

**Farm your aura. Flex your vibe.**

Daily aesthetic RPG for **Gen Z** & **Gen Alpha** — cloud accounts, online saves, play on **phone or PC** in the browser.

## Live setup (website)

### 1. Supabase (free) — online auth + saves

1. Create a project at [supabase.com](https://supabase.com)
2. **SQL Editor** → run in order:
   - [`supabase/schema.sql`](./supabase/schema.sql)
   - [`supabase/profiles_public.sql`](./supabase/profiles_public.sql) (public profiles + avatars)
   - [`supabase/friends.sql`](./supabase/friends.sql) (friend requests + lists)
   - [`supabase/friends_social.sql`](./supabase/friends_social.sql) (DMs, battles, private notes)
   - [`supabase/streak_reminders.sql`](./supabase/streak_reminders.sql) (email streak reminder prefs)
   - [`supabase/delete_account.sql`](./supabase/delete_account.sql) (Settings → Delete Account)
   - [`supabase/admin.sql`](./supabase/admin.sql) (Admin panel for @admin only)
3. **Authentication → Providers → Email**
   - Enable Email
   - For instant play MVP: **turn off “Confirm email”**
4. **Project Settings → API** — copy:
   - Project URL → `VITE_SUPABASE_URL`
   - `anon` `public` key → `VITE_SUPABASE_ANON_KEY`

### 2. Local dev

```bash
cd aurafarm
cp .env.example .env
# edit .env with your Supabase values
npm install
npm run dev
```

Open the printed URL (default `http://127.0.0.1:5173`).

### 3. Deploy as a website (Vercel)

1. Push this repo to GitHub (e.g. `Flexios/aurafarm`)
2. Import the repo on [vercel.com](https://vercel.com)
3. Set environment variables:

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | from Supabase |
| `VITE_SUPABASE_ANON_KEY` | from Supabase |
| `XAI_API_KEY` | optional, for AI Aura Judge |
| `SUPABASE_SERVICE_ROLE_KEY` | optional, for streak reminder cron |
| `CRON_SECRET` | optional, protect `/api/streak-reminders` |
| `RESEND_API_KEY` | optional, send streak emails via [Resend](https://resend.com) |
| `EMAIL_FROM` | optional, e.g. `AuraFarm <onboarding@resend.dev>` |
| `APP_URL` | optional, link in reminder emails |

**Streak emails:** prefs live in Settings → General. Vercel Hobby runs `/api/streak-reminders` once daily (17:00 UTC). For reminders closer to each user’s chosen local time, point a free external cron (e.g. [cron-job.org](https://cron-job.org)) at `GET /api/streak-reminders` hourly with header `Authorization: Bearer <CRON_SECRET>`.

4. Deploy → you get an `https://….vercel.app` link  
5. On phone: open the same link → **Log in** with the same account → progress matches

**Supabase Auth URLs (optional):** add your Vercel domain under Authentication → URL configuration.

### 4. Optional AI Judge

- Local: `XAI_API_KEY` in `.env` (Vite proxy `/api/judge`)
- Production: `XAI_API_KEY` in Vercel (serverless `api/judge.ts`)
- Without a key, the **local scorer** always works

## How to play

1. **Sign up** — email + username + password  
2. **Onboarding** — display name + aesthetic core  
3. **Play** daily vibe challenges, shop cosmetics, export Aura Card, duel friends  
4. Progress **syncs to Supabase** so any device works  

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server + AI proxy |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build |

## Architecture

```
Browser (phone/PC)
  → Static SPA (Vercel)
  → Supabase Auth + profiles.game_state (jsonb)
  → Optional /api/judge (xAI)
```

- Passwords: handled by Supabase (never stored by the app)
- Row Level Security: each user only reads/writes their own profile
- Local `localStorage` cache for snappy offline-ish UX; cloud is source of truth

## Console helpers

```js
aurafarmLogout()
aurafarmReset()  // wipe cloud+cache progress for current user (via save)
```

## License

MIT
