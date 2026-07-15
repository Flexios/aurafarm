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
      <div class="screen" id="screen-root">
        <div class="topbar">
          <div class="brand">
            <strong>AuraFarm</strong>
            <span>${escape(state.displayName)}${session ? ` · @${escape(session.username)}` : ""}</span>
          </div>
          <div class="currency-pill">
            <div class="pill" title="Sparks">✦ ${formatNumber(state.sparks)}</div>
            <div class="pill glow" title="Glow">◆ ${formatNumber(state.glow)}</div>
          </div>
        </div>
        ${bodyHtml}
      </div>
      <nav class="nav" aria-label="Main">
        ${NAV.map(
          (n) => `
          <button type="button" data-nav="${n.id}" class="${n.id === screen ? "active" : ""}">
            <span class="ico">${n.ico}</span>
            ${n.label}
          </button>
        `,
        ).join("")}
      </nav>
    </div>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => onNavigate(btn.dataset.nav as Screen));
  });
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
