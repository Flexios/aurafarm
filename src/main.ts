import "./style.css";
import { isAdminUsername, isCurrentUserAdmin } from "./admin/gate";
import { checkAiAvailable } from "./ai/judge";
import {
  getCachedSession,
  logout,
  restoreSession,
  type Session,
} from "./auth/auth";
import { getLang, initLocale, t } from "./i18n";
import {
  applySettingsToDom,
  createDefaultState,
  flushSave,
  loadState,
  refreshStreak,
  resetState,
  updateSettings,
} from "./state/store";
import type { PlayerState, Screen } from "./types";
import { renderAdmin } from "./ui/admin";
import { ensureAuraField } from "./ui/auraField";
import { renderCard } from "./ui/card";
import { renderDuel } from "./ui/duel";
import { renderHome } from "./ui/home";
import { renderLogin } from "./ui/login";
import { renderOnboarding } from "./ui/onboarding";
import { renderPlay } from "./ui/play";
import { renderProfile } from "./ui/profile";
import { renderSettings } from "./ui/settings";
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

function bootMessage(key: "boot.connecting" | "boot.loading" | "boot.signingOut" | "boot.deleted"): string {
  return t(key);
}

async function initAi(): Promise<void> {
  aiOn = await checkAiAvailable();
  if (!booting && session && state.onboarded && screen === "home") render();
}

async function setState(next: PlayerState): Promise<void> {
  state = next;
  applySettingsToDom(state.settings);
  render();
}

function refreshSessionFromCache(): void {
  session = getCachedSession();
  render();
}

function navigate(next: Screen): void {
  if (next === "admin" && !isCurrentUserAdmin()) {
    screen = "home";
  } else {
    screen = next;
  }
  render();
}

async function handleLogout(): Promise<void> {
  showBoot(bootMessage("boot.signingOut"));
  await flushSave();
  await logout();
  session = null;
  state = createDefaultState();
  // Keep language preference after logout
  state = updateSettings(state, { language: getLang() });
  screen = "home";
  render();
}

/** After permanent account deletion — do not flush cloud save. */
async function handleAccountDeleted(): Promise<void> {
  showBoot(bootMessage("boot.deleted"));
  session = null;
  state = createDefaultState();
  state = updateSettings(state, { language: getLang() });
  screen = "home";
  render();
}

async function handleAuthed(next: Session): Promise<void> {
  session = next;
  showBoot(bootMessage("boot.loading"));
  state = refreshStreak(await loadState());
  // Prefer account language; if still default en and local has another, keep local
  if (!state.settings.language || state.settings.language === "en") {
    const local = getLang();
    if (local !== "en") {
      state = updateSettings(state, { language: local });
    }
  }
  applySettingsToDom(state.settings);
  screen = "home";
  render();
}

function render(): void {
  ensureAuraField();

  if (booting) {
    showBoot(bootMessage("boot.connecting"));
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
        case "profile":
          renderProfile(slot, state, (s) => {
            void setState(s);
          });
          break;
        case "settings":
          renderSettings(
            slot,
            state,
            (s) => {
              void setState(s);
            },
            refreshSessionFromCache,
            () => {
              void handleLogout();
            },
            () => {
              void handleAccountDeleted();
            },
          );
          break;
        case "admin":
          if (session && isAdminUsername(session.username)) {
            renderAdmin(slot, state, (s) => {
              void setState(s);
            });
          } else {
            screen = "home";
            renderHome(slot, state, navigate, aiOn, () => {
              void handleLogout();
            });
          }
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
  initLocale();
  showBoot(bootMessage("boot.connecting"));
  try {
    session = await restoreSession();
    if (session) {
      state = refreshStreak(await loadState());
      applySettingsToDom(state.settings);
    } else {
      state = createDefaultState();
      state = updateSettings(state, { language: getLang() });
      applySettingsToDom(state.settings);
    }
  } catch (e) {
    console.error(e);
    session = null;
    state = createDefaultState();
    state = updateSettings(state, { language: getLang() });
  }
  booting = false;
  render();
  void initAi();
}

void boot();
