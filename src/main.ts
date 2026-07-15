import "./style.css";
import { checkAiAvailable } from "./ai/judge";
import {
  getCachedSession,
  logout,
  restoreSession,
  type Session,
} from "./auth/auth";
import { createDefaultState, flushSave, loadState, refreshStreak, resetState } from "./state/store";
import type { PlayerState, Screen } from "./types";
import { renderCard } from "./ui/card";
import { renderDuel } from "./ui/duel";
import { renderHome } from "./ui/home";
import { renderLogin } from "./ui/login";
import { renderOnboarding } from "./ui/onboarding";
import { renderPlay } from "./ui/play";
import { mountInShell } from "./ui/shell";
import { renderShop } from "./ui/shop";

const app = document.querySelector<HTMLDivElement>("#app")!;

let session: Session | null = null;
let state: PlayerState = createDefaultState();
let screen: Screen = "home";
let aiOn = false;
let booting = true;

function showBoot(message: string): void {
  app.innerHTML = `
    <div class="onboarding" style="justify-content:center;align-items:center;text-align:center;display:flex;flex-direction:column">
      <div class="logo">AuraFarm</div>
      <p class="muted" style="margin-top:16px">${message}</p>
    </div>
  `;
}

async function initAi(): Promise<void> {
  aiOn = await checkAiAvailable();
  if (!booting && session && state.onboarded && screen === "home") render();
}

async function setState(next: PlayerState): Promise<void> {
  state = next;
  render();
}

function navigate(next: Screen): void {
  screen = next;
  render();
}

async function handleLogout(): Promise<void> {
  showBoot("Signing out…");
  await flushSave();
  await logout();
  session = null;
  state = createDefaultState();
  screen = "home";
  render();
}

async function handleAuthed(next: Session): Promise<void> {
  session = next;
  showBoot("Loading your farm…");
  state = refreshStreak(await loadState());
  screen = "home";
  render();
}

function render(): void {
  if (booting) {
    showBoot("Connecting…");
    return;
  }

  if (!session) {
    renderLogin(app, (s) => {
      void handleAuthed(s);
    });
    return;
  }

  if (!state.onboarded) {
    renderOnboarding(
      app,
      state,
      (next) => {
        state = next;
        render();
      },
      () => {
        void handleLogout();
      },
    );
    return;
  }

  mountInShell(
    app,
    state,
    screen,
    (slot) => {
      switch (screen) {
        case "home":
          renderHome(slot, state, navigate, aiOn, () => {
            void handleLogout();
          });
          break;
        case "play":
          renderPlay(slot, state, aiOn, (s) => {
            void setState(s);
          });
          break;
        case "shop":
          renderShop(slot, state, (s) => {
            void setState(s);
          });
          break;
        case "card":
          renderCard(slot, state);
          break;
        case "duel":
          renderDuel(slot, state, (s) => {
            void setState(s);
          });
          break;
      }
    },
    navigate,
  );
}

window.addEventListener("aurafarm:nav", ((e: CustomEvent<Screen>) => {
  navigate(e.detail);
}) as EventListener);

(window as unknown as { aurafarmReset: () => void }).aurafarmReset = () => {
  if (!getCachedSession()) return;
  state = resetState();
  screen = "home";
  render();
};

(window as unknown as { aurafarmLogout: () => void }).aurafarmLogout = () => {
  void handleLogout();
};

async function boot(): Promise<void> {
  showBoot("Connecting…");
  try {
    session = await restoreSession();
    if (session) {
      state = refreshStreak(await loadState());
    } else {
      state = createDefaultState();
    }
  } catch (e) {
    console.error(e);
    session = null;
    state = createDefaultState();
  }
  booting = false;
  render();
  void initAi();
}

void boot();
