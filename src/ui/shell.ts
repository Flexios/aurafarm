import { isAdminUsername } from "../admin/gate";
import { getSession } from "../auth/auth";
import { t } from "../i18n";
import type { PlayerState, Screen } from "../types";
import { formatNumber } from "../utils/format";
import { ensureAuraField, refreshAuraAccent } from "./auraField";
import { icon, type IconName } from "./icons";

type NavItem = { id: Screen; label: string; ico: IconName };

/** Survives shell re-renders within a session */
let moreMenuOpen = false;

const MORE_SCREENS: Screen[] = ["shop", "card", "settings", "admin"];

function isMoreScreen(screen: Screen): boolean {
  return MORE_SCREENS.includes(screen);
}

function desktopNav(isAdmin: boolean): NavItem[] {
  const items: NavItem[] = [
    { id: "home", label: t("nav.home"), ico: "home" },
    { id: "play", label: t("nav.play"), ico: "play" },
    { id: "duel", label: t("nav.duel"), ico: "duel" },
    { id: "shop", label: t("nav.shop"), ico: "shop" },
    { id: "card", label: t("nav.card"), ico: "card" },
    { id: "profile", label: t("nav.profile"), ico: "person" },
    { id: "settings", label: t("nav.settings"), ico: "settings" },
  ];
  if (isAdmin) items.push({ id: "admin", label: t("nav.admin"), ico: "admin" });
  return items;
}

/** Primary mobile dock — only 5 slots */
function mobilePrimary(): NavItem[] {
  return [
    { id: "play", label: t("nav.play"), ico: "play" },
    { id: "duel", label: t("nav.duel"), ico: "duel" },
    { id: "home", label: t("nav.home"), ico: "home" },
    { id: "profile", label: t("nav.profile"), ico: "person" },
  ];
}

function mobileMoreItems(isAdmin: boolean): NavItem[] {
  const items: NavItem[] = [
    { id: "shop", label: t("nav.shop"), ico: "shop" },
    { id: "card", label: t("nav.card"), ico: "card" },
    { id: "settings", label: t("nav.settings"), ico: "settings" },
  ];
  if (isAdmin) items.push({ id: "admin", label: t("nav.admin"), ico: "admin" });
  return items;
}

function navBtn(
  n: NavItem,
  screen: Screen,
  extraClass = "",
): string {
  const active = n.id === screen;
  const home = n.id === "home";
  return `
    <button type="button" data-nav="${n.id}" class="${extraClass}${active ? " active" : ""}${home ? " nav-home" : ""}" aria-current="${active ? "page" : "false"}">
      <span class="nav-ico-wrap">${icon(n.ico)}</span>
      <span class="nav-label">${n.label}</span>
    </button>`;
}

export function renderShell(
  root: HTMLElement,
  state: PlayerState,
  screen: Screen,
  bodyHtml: string,
  onNavigate: (s: Screen) => void,
): void {
  ensureAuraField();
  refreshAuraAccent();

  const session = getSession();
  const isAdmin = isAdminUsername(session?.username);
  const desk = desktopNav(isAdmin);
  const primary = mobilePrimary();
  const moreItems = mobileMoreItems(isAdmin);
  const moreActive = isMoreScreen(screen);
  // Close more sheet when leaving more-screens via primary tab (optional UX)
  if (!moreActive && moreMenuOpen && !["shop", "card", "settings", "admin"].includes(screen)) {
    // keep open only if user opened it; close when navigating to primary
  }

  const streak = t("currency.streak");
  const sparks = t("currency.sparks");
  const glow = t("currency.glow");

  root.innerHTML = `
    <div class="app-shell" data-screen="${screen}">
      <aside class="sidebar" aria-label="Desktop navigation">
        <div class="sidebar-brand">
          <div class="mark mark-slash" aria-hidden="true"></div>
          <div class="sidebar-brand-text">
            <strong>AuraFarm</strong>
            <span>${t("brand.tagline")}</span>
          </div>
        </div>
        <nav class="nav nav-side">
          ${desk.map((n) => navBtn(n, screen, "nav-item")).join("")}
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
        <div class="screen glass-stage" id="screen-root">
          <header class="topbar">
            <div class="brand">
              <span class="brand-mobile-only">AURA<span class="brand-accent">FARM</span></span>
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
          </header>
          <div class="screen-body stagger-in">
            ${bodyHtml}
          </div>
        </div>
      </div>

      <nav class="nav nav-bottom" aria-label="Mobile navigation">
        <div class="nav-dock-shell nav-dock-slim">
          ${primary
            .slice(0, 2)
            .map((n) => navBtn(n, screen, "nav-tab"))
            .join("")}
          ${navBtn(primary[2]!, screen, "nav-tab")}
          ${navBtn(primary[3]!, screen, "nav-tab")}
          <button type="button" class="nav-tab nav-more-btn${moreActive || moreMenuOpen ? " active" : ""}" data-more-toggle aria-expanded="${moreMenuOpen ? "true" : "false"}" aria-haspopup="true">
            <span class="nav-ico-wrap">${icon("more")}</span>
            <span class="nav-label">${t("nav.more")}</span>
          </button>
        </div>
      </nav>

      ${
        moreMenuOpen
          ? `<div class="more-scrim" data-more-close></div>
      <div class="more-sheet" role="dialog" aria-label="${t("nav.more")}">
        <div class="more-sheet-handle" aria-hidden="true"></div>
        <p class="more-sheet-title">${t("nav.more")}</p>
        <div class="more-sheet-grid">
          ${moreItems
            .map(
              (n) => `
            <button type="button" class="more-tile${screen === n.id ? " active" : ""}" data-nav="${n.id}">
              <span class="more-tile-ico">${icon(n.ico)}</span>
              <span>${n.label}</span>
            </button>`,
            )
            .join("")}
        </div>
      </div>`
          : ""
      }
    </div>
  `;

  const go = (s: Screen) => {
    moreMenuOpen = false;
    onNavigate(s);
  };

  root.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.nav as Screen;
      go(id);
    });
  });

  root.querySelector("[data-more-toggle]")?.addEventListener("click", () => {
    moreMenuOpen = !moreMenuOpen;
    // Re-render shell with same body by triggering parent navigate to same screen
    // Parent always re-mounts shell on render — call onNavigate(screen) to refresh
    onNavigate(screen);
  });

  root.querySelector("[data-more-close]")?.addEventListener("click", () => {
    moreMenuOpen = false;
    onNavigate(screen);
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
