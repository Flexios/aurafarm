import { getSession } from "../auth/auth";
import { aestheticById } from "../data/aesthetics";
import { coresFromIds } from "../data/cores";
import { nextRank, rankForAura } from "../data/ranks";
import { getTodaysChallenge } from "../game/daily";
import { localizeCategory, localizeChallenge, t } from "../i18n";
import { hasPlayedDaily } from "../state/store";
import type { PlayerState, Screen } from "../types";
import { escapeHtml, formatNumber } from "../utils/format";
import { coreChipHtml } from "./collectibles";
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
  const challenge = localizeChallenge(getTodaysChallenge());
  const played = hasPlayedDaily(state);
  const aesthetic = aestheticById(state.core);
  const collectionCores = coresFromIds(state.ownedCores);
  const track = state.battlePassPremium ? t("home.premium") : t("home.freeTrack");

  container.innerHTML = `
    <div class="desktop-grid home-grid">
      <div class="home-cell">
        <div class="section-header">${t("home.today")}</div>
        <div class="card challenge-card home-panel">
          <div class="challenge-emoji">${challenge.emoji}</div>
          <h3 style="margin:0 0 4px">${t("home.vibeChallenge")}</h3>
          <strong style="font-size:1.05rem">${escapeHtml(challenge.title)}</strong>
          <p class="muted" style="margin:8px 0 0">${escapeHtml(challenge.prompt)}</p>
          <div class="tag-row">
            <span class="tag">${escapeHtml(localizeCategory(challenge.category))}</span>
            <span class="tag magenta">${aesthetic.emoji} ${escapeHtml(aesthetic.label)}</span>
            ${played ? `<span class="tag magenta">${t("home.doneToday")}</span>` : `<span class="tag">${t("home.ready")}</span>`}
          </div>
          <div class="btn-row" style="margin-top:auto">
            <button class="btn btn-fill" id="go-play">${played ? t("home.practice") : t("home.start")}</button>
          </div>
          <div class="ai-badge ${aiOn ? "on" : ""}">${aiOn ? t("home.aiOn") : t("home.aiOff")}</div>
        </div>
      </div>

      <div class="home-cell">
        <div class="section-header">${t("home.progress")}</div>
        <div class="card home-panel">
          <div class="rank-row">
            <div class="rank-emoji">${rank.emoji}</div>
            <div style="flex:1">
              <div class="muted" style="font-size:0.82rem;font-weight:500">${t("home.rank")}</div>
              <h2 style="margin:0;font-size:1.35rem">${escapeHtml(rank.name)}</h2>
              <div class="muted" style="font-size:0.86rem;margin-top:2px">
                ${formatNumber(state.totalAura)} ${t("common.aura")}${next ? ` · ${t("home.nextRank", { name: next.name })}` : ` · ${t("home.maxRank")}`}
              </div>
              <div class="progress" aria-hidden="true"><i style="width:${progress}%"></i></div>
            </div>
          </div>
          <div class="stat-grid" style="margin-top:auto">
            <div class="stat"><b>🔥 ${state.streak}</b><span>${t("home.streak")}</span></div>
            <div class="stat"><b>${state.duelWins}</b><span>${t("home.duels")}</span></div>
            <div class="stat"><b>${state.bestDailyScore || "—"}</b><span>${t("home.best")}</span></div>
          </div>
        </div>
      </div>

      <div class="home-cores home-cell-full">
        <div class="section-title">
          <h3>${t("home.collection")}</h3>
          <span class="muted">${state.ownedCores.length}</span>
        </div>
        <div class="card home-panel" style="padding:14px 16px">
          <div class="core-list">
            ${
              collectionCores.length
                ? collectionCores.map((c) => coreChipHtml(c)).join("")
                : `<p class="list-empty">${t("home.collectionEmpty")}</p>`
            }
          </div>
        </div>
      </div>

      <div class="home-cell">
        <div class="section-header">${t("home.season")}</div>
        <div class="card home-panel">
          <h3 style="margin:0">${t("home.battlePass")}</h3>
          <p class="muted" style="margin:6px 0 0">${t("home.passLevel", { level: state.battlePassLevel, track })}</p>
          <div class="progress"><i style="width:${(state.battlePassLevel / 10) * 100}%"></i></div>
          <div class="btn-row" style="margin-top:auto">
            <button class="btn btn-secondary" id="go-shop">${t("home.shop")}</button>
          </div>
        </div>
      </div>

      <div class="home-cell">
        <div class="section-header">${t("home.profileCard")}</div>
        <div class="card home-panel">
          <h3 style="margin:0">${t("home.auraCard")}</h3>
          <p class="muted" style="margin:6px 0 0">${t("home.cardBlurb")}</p>
          <div class="btn-row" style="margin-top:auto">
            <button class="btn btn-fill" id="go-card">${t("home.openCard")}</button>
          </div>
        </div>
      </div>

      <div class="home-account home-cell-full">
        <div class="section-header">${t("home.account")}</div>
        <div class="card home-panel">
          <div class="account-bar" style="margin:0">
            <div class="who">
              ${icon("person")}
              <div style="display:inline-block;vertical-align:middle;margin-left:8px">
                <strong>@${escapeHtml(session?.username ?? "—")}</strong>
                <div style="font-size:0.82rem;margin-top:2px">${t("home.synced")}</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap">
              <button type="button" class="btn btn-secondary" id="go-profile" style="width:auto;min-height:36px;padding:0 12px;font-size:0.86rem">${t("home.profile")}</button>
              <button type="button" class="btn btn-secondary" id="go-settings" style="width:auto;min-height:36px;padding:0 12px;font-size:0.86rem">${t("home.settings")}</button>
              <button type="button" class="btn-logout" id="logout-btn">${icon("logout")} ${t("home.logout")}</button>
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
