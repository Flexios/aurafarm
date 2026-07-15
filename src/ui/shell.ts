import { isAdminUsername } from "../admin/gate";
import { getSession } from "../auth/auth";
import { t } from "../i18n";
import type { PlayerState, Screen } from "../types";
import { formatNumber } from "../utils/format";
import { icon, type IconName } from "./icons";

function navDesktopBase(): Array<{ id: Screen; label: string; ico: IconName }> {
  return [
    { id: "home", label: t("nav.home"), ico: "home" },
    { id: "play", label: t("nav.play"), ico: "play" },
    { id: "shop", label: t("nav.shop"), ico: "shop" },
    { id: "card", label: t("nav.card"), ico: "card" },
    { id: "profile", label: t("nav.profile"), ico: "person" },
    { id: "duel", label: t("nav.duel"), ico: "duel" },
    { id: "settings", label: t("nav.settings"), ico: "settings" },
  ];
}

function navMobileBase(): Array<{ id: Screen; label: string; ico: IconName }> {
  return [
    { id: "play", label: t("nav.play"), ico: "play" },
    { id: "shop", label: t("nav.shop"), ico: "shop" },
    { id: "card", label: t("nav.card"), ico: "card" },
    { id: "home", label: t("nav.home"), ico: "home" },
    { id: "profile", label: t("nav.profile"), ico: "person" },
    { id: "duel", label: t("nav.duel"), ico: "duel" },
    { id: "settings", label: t("nav.settings"), ico: "settings" },
  ];
}

function navForUser(username: string | undefined): {
  desktop: Array<{ id: Screen; label: string; ico: IconName }>;
  mobile: Array<{ id: Screen; label: string; ico: IconName }>;
} {
  const desktop = navDesktopBase();
  const mobile = navMobileBase();
  const adminItem: { id: Screen; label: string; ico: IconName } = {
    id: "admin",
    label: t("nav.admin"),
    ico: "admin",
  };
  if (!isAdminUsername(username)) {
    return { desktop, mobile };
  }
  return {
    desktop: [...desktop, adminItem],
    mobile: [...mobile.slice(0, 6), adminItem, mobile[6]!],
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
  const streak = t("currency.streak");
  const sparks = t("currency.sparks");
  const glow = t("currency.glow");
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" aria-label="Desktop navigation">
        <div class="sidebar-brand">
          <div class="mark">${icon("spark")}</div>
          <div>
            <strong>AuraFarm</strong>
            <span>${t("brand.tagline")}</span>
          </div>
        </div>
        <nav class="nav nav-side">
          ${navButtons(nav.desktop, screen, "nav-item")}
        </nav>
        <div class="sidebar-foot">
          <div class="currency-pill sidebar-currency">
            <div class="pill streak-pill" data-tip="${streak}" title="${streak}" aria-label="${streak} ${formatNumber(state.streak)}">🔥 ${formatNumber(state.streak)}</div>
            <div class="pill" data-tip="${sparks}" title="${sparks}" aria-label="${sparks} ${formatNumber(state.sparks)}">${icon("spark", "icon icon-sm")} ${formatNumber(state.sparks)}</div>
            <div class="pill glow" data-tip="${glow}" title="${glow}" aria-label="${glow} ${formatNumber(state.glow)}">${icon("glow", "icon icon-sm")} ${formatNumber(state.glow)}</div>
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
              <div class="pill streak-pill" data-tip="${streak}" title="${streak}" aria-label="${streak} ${formatNumber(state.streak)}">🔥 ${formatNumber(state.streak)}</div>
              ${
                !state.settings.hideTopCurrency
                  ? `<div class="pill" data-tip="${sparks}" title="${sparks}" aria-label="${sparks} ${formatNumber(state.sparks)}">${icon("spark", "icon icon-sm")} ${formatNumber(state.sparks)}</div>
              <div class="pill glow" data-tip="${glow}" title="${glow}" aria-label="${glow} ${formatNumber(state.glow)}">${icon("glow", "icon icon-sm")} ${formatNumber(state.glow)}</div>`
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
    home: t("page.home"),
    play: t("page.play"),
    shop: t("page.shop"),
    card: t("page.card"),
    duel: t("page.duel"),
    profile: t("page.profile"),
    settings: t("page.settings"),
    admin: t("page.admin"),
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
