import { getSession } from "../auth/auth";
import { aestheticById } from "../data/aesthetics";
import { coreById } from "../data/cores";
import { nextRank, rankForAura } from "../data/ranks";
import { getTodaysChallenge } from "../game/daily";
import { hasPlayedDaily } from "../state/store";
import type { PlayerState, Screen } from "../types";
import { escapeHtml, formatNumber } from "../utils/format";

export function renderHome(
  container: HTMLElement,
  state: PlayerState,
  onNavigate: (s: Screen) => void,
  aiOn: boolean,
  onLogout: () => void,
): void {
  const session = getSession();
  const rank = rankForAura(state.totalAura);
  const next = nextRank(state.totalAura);
  const progress = next
    ? Math.min(100, ((state.totalAura - rank.minAura) / (next.minAura - rank.minAura)) * 100)
    : 100;
  const challenge = getTodaysChallenge();
  const played = hasPlayedDaily(state);
  const aesthetic = aestheticById(state.core);
  const recentCores = state.ownedCores
    .slice(-6)
    .map((id) => coreById(id))
    .filter(Boolean);

  container.innerHTML = `
    <div class="card">
      <div class="rank-row">
        <div class="rank-emoji">${rank.emoji}</div>
        <div style="flex:1">
          <div class="muted" style="font-size:0.78rem;font-weight:600">YOUR RANK</div>
          <h2 style="margin:0">${escapeHtml(rank.name)}</h2>
          <div class="muted" style="font-size:0.82rem">${formatNumber(state.totalAura)} total aura${next ? ` · next ${escapeHtml(next.name)} at ${formatNumber(next.minAura)}` : " · max rank"}</div>
          <div class="progress" aria-hidden="true"><i style="width:${progress}%"></i></div>
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat"><b>${state.streak}🔥</b><span>Streak</span></div>
        <div class="stat"><b>${state.duelWins}</b><span>Duel W</span></div>
        <div class="stat"><b>${state.bestDailyScore || "—"}</b><span>Best day</span></div>
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <div class="challenge-emoji">${challenge.emoji}</div>
      <h3 style="margin:0 0 4px">Today's Vibe Challenge</h3>
      <strong>${escapeHtml(challenge.title)}</strong>
      <p class="muted" style="margin:8px 0 0">${escapeHtml(challenge.prompt)}</p>
      <div class="tag-row">
        <span class="tag">${escapeHtml(challenge.category)}</span>
        <span class="tag magenta">${aesthetic.emoji} ${escapeHtml(aesthetic.label)}</span>
        ${played ? `<span class="tag">done today ✓</span>` : `<span class="tag">ready</span>`}
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="go-play">${played ? "Play practice" : "Farm aura now"}</button>
      </div>
      <div class="ai-badge ${aiOn ? "on" : ""}">${aiOn ? "● AI Aura Judge online" : "○ Local Aura Judge (add XAI_API_KEY for AI)"}</div>
    </div>

    <div class="section-title">
      <h3>Your cores</h3>
      <span class="muted">${state.ownedCores.length} collected</span>
    </div>
    <div class="core-list">
      ${
        recentCores.length
          ? recentCores
              .map(
                (c) =>
                  `<span class="core-chip" title="${escapeHtml(c!.description)}">${c!.emoji} ${escapeHtml(c!.name)}</span>`,
              )
              .join("")
          : `<p class="list-empty">Play challenges to drop rare cores.</p>`
      }
    </div>

    <div class="card" style="margin-top:16px">
      <h3>Season 1 Battle Pass</h3>
      <p class="muted" style="margin:0">Level ${state.battlePassLevel}/10 ${state.battlePassPremium ? "· Premium unlocked" : "· Free track active"}</p>
      <div class="progress" style="margin-top:10px"><i style="width:${(state.battlePassLevel / 10) * 100}%"></i></div>
      <div class="btn-row">
        <button class="btn btn-secondary" id="go-shop">Open shop & pass</button>
        <button class="btn btn-secondary" id="go-card">Aura card</button>
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <h3 style="margin:0 0 4px">Account</h3>
      <div class="account-bar">
        <div class="who">
          Logged in as <strong>@${escapeHtml(session?.username ?? "—")}</strong>
          <div style="font-size:0.75rem;margin-top:2px">Progress syncs to the cloud — same account on phone &amp; PC.</div>
        </div>
        <button type="button" class="btn-logout" id="logout-btn">Log out</button>
      </div>
    </div>
  `;

  container.querySelector("#go-play")?.addEventListener("click", () => onNavigate("play"));
  container.querySelector("#go-shop")?.addEventListener("click", () => onNavigate("shop"));
  container.querySelector("#go-card")?.addEventListener("click", () => onNavigate("card"));
  container.querySelector("#logout-btn")?.addEventListener("click", () => onLogout());
}
