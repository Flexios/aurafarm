import { getSession } from "../auth/auth";
import { aestheticById } from "../data/aesthetics";
import { coreById } from "../data/cores";
import { nextRank, rankForAura } from "../data/ranks";
import { getTodaysChallenge } from "../game/daily";
import { hasPlayedDaily } from "../state/store";
import type { PlayerState, Screen } from "../types";
import { escapeHtml, formatNumber } from "../utils/format";
import { icon } from "./icons";

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
    .slice(-8)
    .map((id) => coreById(id))
    .filter(Boolean);

  container.innerHTML = `
    <div class="desktop-grid home-grid">
      <div>
        <div class="section-header">Today</div>
        <div class="card challenge-card">
          <div class="challenge-emoji">${challenge.emoji}</div>
          <h3 style="margin:0 0 4px">Vibe Challenge</h3>
          <strong style="font-size:1.05rem">${escapeHtml(challenge.title)}</strong>
          <p class="muted" style="margin:8px 0 0">${escapeHtml(challenge.prompt)}</p>
          <div class="tag-row">
            <span class="tag">${escapeHtml(challenge.category)}</span>
            <span class="tag magenta">${aesthetic.emoji} ${escapeHtml(aesthetic.label)}</span>
            ${played ? `<span class="tag magenta">Done today</span>` : `<span class="tag">Ready</span>`}
          </div>
          <div class="btn-row">
            <button class="btn btn-fill" id="go-play">${played ? "Practice" : "Start"}</button>
          </div>
          <div class="ai-badge ${aiOn ? "on" : ""}">${aiOn ? "● AI Judge available" : "○ Local Judge"}</div>
        </div>
      </div>

      <div>
        <div class="section-header">Progress</div>
        <div class="card">
          <div class="rank-row">
            <div class="rank-emoji">${rank.emoji}</div>
            <div style="flex:1">
              <div class="muted" style="font-size:0.82rem;font-weight:500">Rank</div>
              <h2 style="margin:0;font-size:1.35rem">${escapeHtml(rank.name)}</h2>
              <div class="muted" style="font-size:0.86rem;margin-top:2px">
                ${formatNumber(state.totalAura)} aura${next ? ` · next ${escapeHtml(next.name)}` : " · max rank"}
              </div>
              <div class="progress" aria-hidden="true"><i style="width:${progress}%"></i></div>
            </div>
          </div>
          <div class="stat-grid">
            <div class="stat"><b>${state.streak}</b><span>Streak</span></div>
            <div class="stat"><b>${state.duelWins}</b><span>Duels</span></div>
            <div class="stat"><b>${state.bestDailyScore || "—"}</b><span>Best</span></div>
          </div>
        </div>
      </div>

      <div class="home-cores">
        <div class="section-title">
          <h3>Collection</h3>
          <span class="muted">${state.ownedCores.length}</span>
        </div>
        <div class="card" style="padding:14px 16px">
          <div class="core-list">
            ${
              recentCores.length
                ? recentCores
                    .map(
                      (c) =>
                        `<span class="core-chip" title="${escapeHtml(c!.description)}">${c!.emoji} ${escapeHtml(c!.name)}</span>`,
                    )
                    .join("")
                : `<p class="list-empty">Play challenges to unlock cores.</p>`
            }
          </div>
        </div>
      </div>

      <div>
        <div class="section-header">Season</div>
        <div class="card">
          <h3 style="margin:0">Battle Pass · Season 1</h3>
          <p class="muted" style="margin:6px 0 0">Level ${state.battlePassLevel}/10 · ${state.battlePassPremium ? "Premium" : "Free track"}</p>
          <div class="progress"><i style="width:${(state.battlePassLevel / 10) * 100}%"></i></div>
          <div class="btn-row">
            <button class="btn btn-secondary" id="go-shop">Shop</button>
            <button class="btn btn-secondary" id="go-card">Aura Card</button>
          </div>
        </div>
      </div>

      <div class="home-account">
        <div class="section-header">Account</div>
        <div class="card">
          <div class="account-bar" style="margin:0">
            <div class="who">
              ${icon("person")}
              <div style="display:inline-block;vertical-align:middle;margin-left:8px">
                <strong>@${escapeHtml(session?.username ?? "—")}</strong>
                <div style="font-size:0.82rem;margin-top:2px">Synced across devices</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0">
              <button type="button" class="btn btn-secondary" id="go-profile" style="width:auto;min-height:36px;padding:0 12px;font-size:0.86rem">Profile</button>
              <button type="button" class="btn btn-secondary" id="go-settings" style="width:auto;min-height:36px;padding:0 12px;font-size:0.86rem">Settings</button>
              <button type="button" class="btn-logout" id="logout-btn">${icon("logout")} Log Out</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector("#go-play")?.addEventListener("click", () => onNavigate("play"));
  container.querySelector("#go-shop")?.addEventListener("click", () => onNavigate("shop"));
  container.querySelector("#go-card")?.addEventListener("click", () => onNavigate("card"));
  container.querySelector("#go-profile")?.addEventListener("click", () => onNavigate("profile"));
  container.querySelector("#go-settings")?.addEventListener("click", () => onNavigate("settings"));
  container.querySelector("#logout-btn")?.addEventListener("click", () => onLogout());
}
