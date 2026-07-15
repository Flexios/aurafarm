import { getSession } from "../auth/auth";
import type { PlayerState, Screen } from "../types";
import { formatNumber } from "../utils/format";

const NAV: Array<{ id: Screen; label: string; ico: string }> = [
  { id: "home", label: "Home", ico: "🏠" },
  { id: "play", label: "Play", ico: "⚡" },
  { id: "shop", label: "Shop", ico: "🛍️" },
  { id: "card", label: "Card", ico: "🃏" },
  { id: "duel", label: "Duel", ico: "⚔️" },
];

function navButtons(screen: Screen, extraClass = ""): string {
  return NAV.map(
    (n) => `
    <button type="button" data-nav="${n.id}" class="${extraClass} ${n.id === screen ? "active" : ""}">
      <span class="ico">${n.ico}</span>
      <span class="nav-label">${n.label}</span>
    </button>
  `,
  ).join("");
}

export function renderShell(
  root: HTMLElement,
  state: PlayerState,
  screen: Screen,
  bodyHtml: string,
  onNavigate: (s: Screen) => void,
): void {
  const session = getSession();
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" aria-label="Desktop navigation">
        <div class="sidebar-brand">
          <strong>AuraFarm</strong>
          <span>Farm your aura</span>
        </div>
        <nav class="nav nav-side">
          ${navButtons(screen, "nav-item")}
        </nav>
        <div class="sidebar-foot">
          <div class="currency-pill sidebar-currency">
            <div class="pill" title="Sparks">✦ ${formatNumber(state.sparks)}</div>
            <div class="pill glow" title="Glow">◆ ${formatNumber(state.glow)}</div>
          </div>
          <div class="sidebar-user">
            <div class="name">${escape(state.displayName)}</div>
            <div class="handle">@${escape(session?.username ?? "—")}</div>
          </div>
        </div>
      </aside>

      <div class="main-column">
        <div class="screen" id="screen-root">
          <div class="topbar">
            <div class="brand">
              <strong class="brand-mobile-only">AuraFarm</strong>
              <span class="page-title" data-page="${screen}">${pageTitle(screen)}</span>
              <span class="user-line">${escape(state.displayName)}${session ? ` · @${escape(session.username)}` : ""}</span>
            </div>
            <div class="currency-pill topbar-currency">
              <div class="pill" title="Sparks">✦ ${formatNumber(state.sparks)}</div>
              <div class="pill glow" title="Glow">◆ ${formatNumber(state.glow)}</div>
            </div>
          </div>
          ${bodyHtml}
        </div>
      </div>

      <nav class="nav nav-bottom" aria-label="Mobile navigation">
        ${navButtons(screen)}
      </nav>
    </div>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => onNavigate(btn.dataset.nav as Screen));
  });
}

function pageTitle(screen: Screen): string {
  const map: Record<Screen, string> = {
    home: "Dashboard",
    play: "Vibe Challenge",
    shop: "Shop & Pass",
    card: "Aura Card",
    duel: "Aura Duel",
  };
  return map[screen];
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

export function mountInShell(
  root: HTMLElement,
  state: PlayerState,
  screen: Screen,
  renderBody: (container: HTMLElement) => void,
  onNavigate: (s: Screen) => void,
): void {
  renderShell(root, state, screen, `<div id="body-slot"></div>`, onNavigate);
  const slot = root.querySelector("#body-slot") as HTMLElement;
  renderBody(slot);
}
