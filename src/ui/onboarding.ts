import { getSession } from "../auth/auth";
import { AESTHETICS } from "../data/aesthetics";
import type { AestheticCore, PlayerState } from "../types";
import { completeOnboarding } from "../state/store";
import { escapeHtml } from "../utils/format";

export function renderOnboarding(
  root: HTMLElement,
  state: PlayerState,
  onDone: (next: PlayerState) => void,
  onLogout: () => void,
): void {
  let selected: AestheticCore = state.core || "main-character";
  const session = getSession();
  const defaultName = state.displayName || session?.username || "";

  root.innerHTML = `
    <div class="onboarding auth-layout">
      <div class="auth-hero">
        <div class="logo">AuraFarm</div>
        <p class="muted auth-tagline">Welcome${session ? `, @${escapeHtml(session.username)}` : ""}.<br/>Set your in-game vibe identity. 13+</p>
      </div>
      <div class="auth-panel">
      <div class="card stack">
        <div class="field">
          <label for="display-name">Display name</label>
          <input id="display-name" maxlength="18" placeholder="e.g. vibe.curator" value="${escapeHtml(defaultName)}" />
        </div>
        <div>
          <label class="muted" style="font-weight:600;font-size:0.82rem">Pick your aesthetic core</label>
          <div class="core-grid" id="core-grid" style="margin-top:10px"></div>
        </div>
        <button class="btn btn-primary" id="start-btn">Enter the farm ✨</button>
        <button class="btn btn-secondary" type="button" id="logout-onboard">Use a different account</button>
        <p class="muted" style="font-size:0.78rem;margin:0">Progress syncs online to your account. Cosmetics & Glow packs are demo economy (no real charges).</p>
      </div>
      </div>
    </div>
  `;

  const grid = root.querySelector("#core-grid")!;
  const paint = () => {
    grid.innerHTML = AESTHETICS.map(
      (a) => `
      <button type="button" class="core-option ${a.id === selected ? "selected" : ""}" data-core="${a.id}">
        <span>${a.emoji}</span>
        <strong>${escapeHtml(a.label)}</strong>
        <small>${escapeHtml(a.blurb)}</small>
      </button>
    `,
    ).join("");
    grid.querySelectorAll<HTMLButtonElement>("[data-core]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selected = btn.dataset.core as AestheticCore;
        paint();
      });
    });
  };
  paint();

  root.querySelector("#start-btn")!.addEventListener("click", () => {
    const name = (root.querySelector("#display-name") as HTMLInputElement).value;
    onDone(completeOnboarding(state, name, selected));
  });

  root.querySelector("#logout-onboard")!.addEventListener("click", () => onLogout());
}
