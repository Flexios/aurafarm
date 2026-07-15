import { isAdminUsername } from "../admin/gate";
import { getSession } from "../auth/auth";
import type { PlayerState, Screen } from "../types";
import { formatNumber } from "../utils/format";
import { icon, type IconName } from "./icons";

const NAV_DESKTOP_BASE: Array<{ id: Screen; label: string; ico: IconName }> = [
  { id: "home", label: "Home", ico: "home" },
  { id: "play", label: "Play", ico: "play" },
  { id: "shop", label: "Shop", ico: "shop" },
  { id: "card", label: "Card", ico: "card" },
  { id: "profile", label: "Profile", ico: "person" },
  { id: "duel", label: "Duel", ico: "duel" },
  { id: "settings", label: "Settings", ico: "settings" },
];

/** Mobile bottom nav — Home sits in the center (4th of 7). */
const NAV_MOBILE_BASE: Array<{ id: Screen; label: string; ico: IconName }> = [
  { id: "play", label: "Play", ico: "play" },
  { id: "shop", label: "Shop", ico: "shop" },
  { id: "card", label: "Card", ico: "card" },
  { id: "home", label: "Home", ico: "home" },
  { id: "profile", label: "Profile", ico: "person" },
  { id: "duel", label: "Duel", ico: "duel" },
  { id: "settings", label: "Settings", ico: "settings" },
];

function navForUser(username: string | undefined): {
  desktop: Array<{ id: Screen; label: string; ico: IconName }>;
  mobile: Array<{ id: Screen; label: string; ico: IconName }>;
} {
  const adminItem: { id: Screen; label: string; ico: IconName } = {
    id: "admin",
    label: "Admin",
    ico: "admin",
  };
  if (!isAdminUsername(username)) {
    return { desktop: NAV_DESKTOP_BASE, mobile: NAV_MOBILE_BASE };
  }
  return {
    desktop: [...NAV_DESKTOP_BASE, adminItem],
    // Keep Home centered: insert Admin before Settings
    mobile: [
      ...NAV_MOBILE_BASE.slice(0, 6),
      adminItem,
      NAV_MOBILE_BASE[6]!,
    ],
  };
}

function navButtons(
  items: Array<{ id: Screen; label: string; ico: IconName }>,
  screen: Screen,
  extraClass = "",
): string {
  return items
    .map(
      (n) => `
    <button type="button" data-nav="${n.id}" class="${extraClass} ${n.id === screen ? "active" : ""}${n.id === "home" ? " nav-home" : ""}">
      ${icon(n.ico)}
      <span class="nav-label">${n.label}</span>
    </button>
  `,
    )
    .join("");
}

export function renderShell(
  root: HTMLElement,
  state: PlayerState,
  screen: Screen,
  bodyHtml: string,
  onNavigate: (s: Screen) => void,
): void {
  const session = getSession();
  const nav = navForUser(session?.username);
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" aria-label="Desktop navigation">
        <div class="sidebar-brand">
          <div class="mark">${icon("spark")}</div>
          <div>
            <strong>AuraFarm</strong>
            <span>Daily vibe RPG</span>
          </div>
        </div>
        <nav class="nav nav-side">
          ${navButtons(nav.desktop, screen, "nav-item")}
        </nav>
        <div class="sidebar-foot">
          <div class="currency-pill sidebar-currency">
            <div class="pill streak-pill" data-tip="Streak" title="Streak" aria-label="Streak ${formatNumber(state.streak)}">🔥 ${formatNumber(state.streak)}</div>
            <div class="pill" data-tip="Sparks" title="Sparks" aria-label="Sparks ${formatNumber(state.sparks)}">${icon("spark", "icon icon-sm")} ${formatNumber(state.sparks)}</div>
            <div class="pill glow" data-tip="Glow" title="Glow" aria-label="Glow ${formatNumber(state.glow)}">${icon("glow", "icon icon-sm")} ${formatNumber(state.glow)}</div>
          </div>
          <button type="button" class="sidebar-user" data-nav="profile">
            ${
              state.avatarUrl
                ? `<img class="avatar avatar-sm" src="${escape(state.avatarUrl)}" alt="" />`
                : `<div class="avatar avatar-sm avatar-fallback">${escape((state.displayName || "?").slice(0, 1).toUpperCase())}</div>`
            }
            <div>
              <div class="name">${escape(state.displayName)}</div>
              <div class="handle">@${escape(session?.username ?? "—")}</div>
            </div>
          </button>
        </div>
      </aside>

      <div class="main-column">
        <div class="screen" id="screen-root">
          <div class="topbar">
            <div class="brand">
              <span class="brand-mobile-only">AuraFarm</span>
              <span class="page-title large-title" data-page="${screen}">${pageTitle(screen)}</span>
              <span class="user-line">${escape(state.displayName)}${session ? ` · @${escape(session.username)}` : ""}</span>
            </div>
            <div class="currency-pill topbar-currency">
              <div class="pill streak-pill" data-tip="Streak" title="Streak" aria-label="Streak ${formatNumber(state.streak)}">🔥 ${formatNumber(state.streak)}</div>
              ${
                !state.settings.hideTopCurrency
                  ? `<div class="pill" data-tip="Sparks" title="Sparks" aria-label="Sparks ${formatNumber(state.sparks)}">${icon("spark", "icon icon-sm")} ${formatNumber(state.sparks)}</div>
              <div class="pill glow" data-tip="Glow" title="Glow" aria-label="Glow ${formatNumber(state.glow)}">${icon("glow", "icon icon-sm")} ${formatNumber(state.glow)}</div>`
                  : ""
              }
            </div>
          </div>
          ${bodyHtml}
        </div>
      </div>

      <nav class="nav nav-bottom ${isAdminUsername(session?.username) ? "nav-bottom-admin" : ""}" aria-label="Mobile navigation">
        ${navButtons(nav.mobile, screen)}
      </nav>
    </div>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => onNavigate(btn.dataset.nav as Screen));
  });
}

function pageTitle(screen: Screen): string {
  const map: Record<Screen, string> = {
    home: "Home",
    play: "Challenge",
    shop: "Shop",
    card: "Aura Card",
    duel: "Duel",
    profile: "Profile",
    settings: "Settings",
    admin: "Admin",
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
