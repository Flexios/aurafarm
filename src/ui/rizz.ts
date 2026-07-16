import { rizzTurn } from "../ai/rizz";
import {
  loadRizzGender,
  personaById,
  personasByGender,
  pickDailyPersona,
  pickRandomPersona,
  saveRizzGender,
  type RizzPersona,
} from "../data/rizzScenarios";
import { applyRizzResult } from "../game/economy";
import {
  RIZZ_LIKE_AT,
  RIZZ_MAX_TURNS,
  type RizzChatMessage,
  type RizzOutcome,
} from "../game/rizzLocal";
import { t } from "../i18n";
import type { PlayerState, RizzGender } from "../types";
import { escapeHtml } from "../utils/format";
import { showToast } from "./toast";

type Phase = "gate" | "pick" | "story" | "chat" | "result";

interface SessionResult {
  outcome: RizzOutcome;
  interest: number;
  turns: number;
  aura: number;
  sparks: number;
  personaName: string;
}

/** Survives shell re-renders when rewards update parent state */
let live: {
  gender: RizzGender | null;
  phase: Phase;
  personaId: string | null;
  messages: RizzChatMessage[];
  interest: number;
  turn: number;
  busy: boolean;
  result: SessionResult | null;
  storyReplySent: boolean;
} = {
  gender: loadRizzGender(),
  phase: loadRizzGender() ? "pick" : "gate",
  personaId: null,
  messages: [],
  interest: 42,
  turn: 0,
  busy: false,
  result: null,
  storyReplySent: false,
};

function interestLabel(n: number): string {
  if (n >= RIZZ_LIKE_AT) return t("rizz.meter.locked");
  if (n >= 55) return t("rizz.meter.vibing");
  if (n >= 35) return t("rizz.meter.warm");
  return t("rizz.meter.cold");
}

function avatarStyle(p: RizzPersona): string {
  return `--rizz-a:${escapeHtml(p.accent)};--rizz-photo:url('${escapeHtml(p.image)}')`;
}

function storyArtHtml(p: RizzPersona): string {
  return `
    <div class="rizz-story-art" data-id="${escapeHtml(p.id)}" style="--rizz-a:${escapeHtml(p.accent)};--rizz-b:${escapeHtml(p.accent2)}">
      <img class="rizz-story-img" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.style.display='none'" />
      <div class="rizz-story-fallback" aria-hidden="true">
        <span class="rizz-story-emoji">${p.emoji}</span>
      </div>
      <div class="rizz-story-caption">${escapeHtml(p.storyCaption)}</div>
    </div>`;
}

function resetRun(): void {
  live.personaId = null;
  live.messages = [];
  live.interest = 42;
  live.turn = 0;
  live.busy = false;
  live.result = null;
  live.storyReplySent = false;
}

export function renderRizz(
  container: HTMLElement,
  state: PlayerState,
  aiOn: boolean,
  onState: (s: PlayerState) => void,
): void {
  // Re-sync gender from session storage if gate was never opened this tab
  if (!live.gender) {
    const g = loadRizzGender();
    if (g) {
      live.gender = g;
      if (live.phase === "gate") live.phase = "pick";
    }
  }

  const preferAi = aiOn && state.settings.preferAiJudge;

  const paint = () => {
    const phase = live.phase;
    const gender = live.gender;
    const persona = live.personaId ? personaById(live.personaId) ?? null : null;

    if (phase === "gate") {
      container.innerHTML = `
        <div class="rizz-gate">
          <p class="muted rizz-blurb">${t("rizz.blurb")}</p>
          <div class="section-header">${t("rizz.chooseTarget")}</div>
          <button type="button" class="card rizz-gender-card" data-gender="female">
            <div class="rizz-gender-emoji">👩</div>
            <div>
              <strong>${t("rizz.trainHer")}</strong>
              <p class="muted" style="margin:4px 0 0">${t("rizz.trainHerHint")}</p>
            </div>
          </button>
          <button type="button" class="card rizz-gender-card" data-gender="male">
            <div class="rizz-gender-emoji">👨</div>
            <div>
              <strong>${t("rizz.trainHim")}</strong>
              <p class="muted" style="margin:4px 0 0">${t("rizz.trainHimHint")}</p>
            </div>
          </button>
          <p class="muted" style="font-size:0.8rem;margin-top:12px">${t("rizz.practiceNote")}</p>
        </div>`;
      container.querySelectorAll<HTMLButtonElement>("[data-gender]").forEach((btn) => {
        btn.addEventListener("click", () => {
          live.gender = btn.dataset.gender as RizzGender;
          saveRizzGender(live.gender);
          live.phase = "pick";
          paint();
        });
      });
      return;
    }

    if (phase === "pick" && gender) {
      const list = personasByGender(gender);
      const daily = pickDailyPersona(gender);
      container.innerHTML = `
        <div class="rizz-pick">
          <div class="rizz-pick-head">
            <p class="muted" style="margin:0">${t("rizz.trainingAs", {
              target: gender === "female" ? t("rizz.her") : t("rizz.him"),
            })}</p>
            <button type="button" class="btn-plain" id="rizz-change-gender">${t("rizz.changeTarget")}</button>
          </div>
          <div class="card rizz-daily-card">
            <div class="section-header" style="margin:0 0 8px">${t("rizz.daily")}</div>
            <div class="rizz-persona-row">
              <div class="rizz-avatar has-photo" style="${avatarStyle(daily)}" aria-hidden="true">${daily.emoji}</div>
              <div style="flex:1;min-width:0">
                <strong>${escapeHtml(daily.name)}</strong>
                <div class="muted" style="font-size:0.84rem">@${escapeHtml(daily.handle)} · ${escapeHtml(daily.vibe)}</div>
              </div>
            </div>
            <button type="button" class="btn btn-fill" id="rizz-start-daily" style="margin-top:14px">${t("rizz.replyToStory")}</button>
          </div>
          <div class="section-header">${t("rizz.morePersonas")}</div>
          <div class="rizz-persona-list">
            ${list
              .map(
                (p) => `
              <button type="button" class="card rizz-persona-card" data-persona="${escapeHtml(p.id)}">
                <div class="rizz-avatar has-photo" style="${avatarStyle(p)}" aria-hidden="true">${p.emoji}</div>
                <div style="flex:1;min-width:0;text-align:left">
                  <strong>${escapeHtml(p.name)}</strong>
                  <div class="muted" style="font-size:0.82rem">${escapeHtml(p.vibe)}</div>
                </div>
                <span class="muted">→</span>
              </button>`,
              )
              .join("")}
          </div>
          <button type="button" class="btn btn-secondary" id="rizz-random" style="margin-top:12px">${t("rizz.random")}</button>
          <p class="muted" style="font-size:0.8rem;margin-top:10px">${aiOn ? t("rizz.aiOn") : t("rizz.aiOff")}</p>
        </div>`;
      container.querySelector("#rizz-change-gender")?.addEventListener("click", () => {
        live.gender = null;
        saveRizzGender(null);
        live.phase = "gate";
        resetRun();
        paint();
      });
      const startWith = (p: RizzPersona) => {
        resetRun();
        live.personaId = p.id;
        live.phase = "story";
        paint();
      };
      container.querySelector("#rizz-start-daily")?.addEventListener("click", () => startWith(daily));
      container.querySelector("#rizz-random")?.addEventListener("click", () =>
        startWith(pickRandomPersona(gender)),
      );
      container.querySelectorAll<HTMLButtonElement>("[data-persona]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const p = list.find((x) => x.id === btn.dataset.persona);
          if (p) startWith(p);
        });
      });
      return;
    }

    if (phase === "story" && persona) {
      const p = persona;
      container.innerHTML = `
        <div class="rizz-story">
          <div class="rizz-story-chrome">
            <div class="rizz-story-progress"><i></i></div>
            <div class="rizz-story-top">
              <div class="rizz-avatar rizz-avatar-sm has-photo" style="${avatarStyle(p)}" aria-hidden="true">${p.emoji}</div>
              <div style="flex:1;min-width:0">
                <strong>${escapeHtml(p.name)}</strong>
                <div class="muted" style="font-size:0.75rem">${t("rizz.justNow")}</div>
              </div>
              <button type="button" class="btn-plain rizz-close" id="rizz-abort" aria-label="${t("common.close")}">✕</button>
            </div>
            ${storyArtHtml(p)}
            <form class="rizz-story-composer" id="rizz-story-form">
              <input type="text" id="rizz-story-input" maxlength="200" autocomplete="off"
                placeholder="${t("rizz.replyPlaceholder")}" ${live.busy ? "disabled" : ""} />
              <button type="submit" class="btn btn-fill rizz-send" ${live.busy ? "disabled" : ""}>${live.busy ? "…" : t("rizz.send")}</button>
            </form>
          </div>
        </div>`;
      container.querySelector("#rizz-abort")?.addEventListener("click", () => {
        live.phase = "pick";
        resetRun();
        paint();
      });
      container.querySelector("#rizz-story-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        void sendMessage(
          (container.querySelector("#rizz-story-input") as HTMLInputElement)?.value ?? "",
          true,
        );
      });
      (container.querySelector("#rizz-story-input") as HTMLInputElement | null)?.focus();
      return;
    }

    if (phase === "chat" && persona) {
      const p = persona;
      const turnsLeft = Math.max(0, RIZZ_MAX_TURNS - live.turn);
      container.innerHTML = `
        <div class="rizz-chat">
          <div class="rizz-chat-top">
            <button type="button" class="btn-plain" id="rizz-back-pick">←</button>
            <div class="rizz-avatar rizz-avatar-sm has-photo" style="${avatarStyle(p)}" aria-hidden="true">${p.emoji}</div>
            <div style="flex:1;min-width:0">
              <strong>${escapeHtml(p.name)}</strong>
              <div class="muted" style="font-size:0.75rem">@${escapeHtml(p.handle)}</div>
            </div>
            <div class="rizz-interest" title="${t("rizz.interest")}">
              <div class="rizz-interest-ring">
                <span>${Math.round(live.interest)}</span>
              </div>
              <div class="rizz-interest-label">${interestLabel(live.interest)}</div>
            </div>
          </div>
          <div class="rizz-interest-bar" aria-hidden="true"><i style="width:${live.interest}%"></i></div>
          <div class="rizz-bubbles" id="rizz-bubbles">
            ${live.messages
              .map((m, i) => {
                const isStory = i === 0 && m.role === "user" && live.storyReplySent;
                if (m.role === "user") {
                  return `<div class="rizz-bubble rizz-bubble-me${isStory ? " rizz-bubble-story" : ""}">
                    ${isStory ? `<span class="rizz-story-tag">${t("rizz.storyReply")}</span>` : ""}
                    <p>${escapeHtml(m.text)}</p>
                  </div>`;
                }
                return `<div class="rizz-bubble rizz-bubble-them"><p>${escapeHtml(m.text)}</p></div>`;
              })
              .join("")}
            ${live.busy ? `<div class="rizz-bubble rizz-bubble-them rizz-typing"><span></span><span></span><span></span></div>` : ""}
          </div>
          <p class="muted rizz-turns">${t("rizz.turnsLeft", { n: turnsLeft })}</p>
          <form class="rizz-chat-composer" id="rizz-chat-form">
            <input type="text" id="rizz-chat-input" maxlength="200" autocomplete="off"
              placeholder="${t("rizz.chatPlaceholder")}" ${live.busy ? "disabled" : ""} />
            <button type="submit" class="btn btn-fill rizz-send" ${live.busy ? "disabled" : ""}>${t("rizz.send")}</button>
          </form>
        </div>`;
      const bubbles = container.querySelector("#rizz-bubbles");
      if (bubbles) bubbles.scrollTop = bubbles.scrollHeight;
      container.querySelector("#rizz-back-pick")?.addEventListener("click", () => {
        if (live.busy) return;
        live.phase = "pick";
        resetRun();
        paint();
      });
      container.querySelector("#rizz-chat-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        void sendMessage(
          (container.querySelector("#rizz-chat-input") as HTMLInputElement)?.value ?? "",
          false,
        );
      });
      if (!live.busy) {
        (container.querySelector("#rizz-chat-input") as HTMLInputElement | null)?.focus();
      }
      return;
    }

    if (phase === "result" && live.result) {
      const result = live.result;
      const win = result.outcome === "like";
      const friend = result.outcome === "friendzone";
      const title = win
        ? t("rizz.result.like")
        : friend
          ? t("rizz.result.friendzone")
          : t("rizz.result.ghost");
      container.innerHTML = `
        <div class="card result-panel rizz-result">
          <div class="muted" style="font-weight:600;font-size:0.84rem">${escapeHtml(result.personaName)}</div>
          <div class="hero-score" style="font-size:${win ? "2.4rem" : "1.8rem"}">${win ? "❤️" : friend ? "🤝" : "👻"}</div>
          <h2 style="margin:0;text-align:center">${title}</h2>
          <p class="verdict" style="text-align:center">${t("rizz.result.interest", { n: result.interest })}</p>
          <div class="stat-grid">
            <div class="stat"><b>+${result.aura}</b><span>${t("common.aura")}</span></div>
            <div class="stat"><b>+${result.sparks}</b><span>${t("currency.sparks")}</span></div>
            <div class="stat"><b>${result.turns}</b><span>${t("rizz.turns")}</span></div>
          </div>
          <div class="btn-row">
            <button type="button" class="btn btn-fill" id="rizz-again">${t("rizz.again")}</button>
            <button type="button" class="btn btn-secondary" id="rizz-home">${t("play.home")}</button>
          </div>
        </div>`;
      container.querySelector("#rizz-again")?.addEventListener("click", () => {
        resetRun();
        live.phase = "pick";
        paint();
      });
      container.querySelector("#rizz-home")?.addEventListener("click", () => {
        resetRun();
        live.phase = live.gender ? "pick" : "gate";
        window.dispatchEvent(new CustomEvent("aurafarm:nav", { detail: "home" }));
      });
    }
  };

  async function finish(outcome: RizzOutcome) {
    const persona = live.personaId ? personaById(live.personaId) : null;
    if (!persona) return;
    const won = outcome === "like";
    const friendzone = outcome === "friendzone";
    const applied = applyRizzResult(state, {
      won,
      friendzone,
      interest: live.interest,
      turns: live.turn,
    });
    live.result = {
      outcome,
      interest: live.interest,
      turns: live.turn,
      aura: applied.aura,
      sparks: applied.sparks,
      personaName: persona.name,
    };
    live.phase = "result";
    if (won) showToast(t("rizz.toast.like"));
    else if (friendzone) showToast(t("rizz.toast.friendzone"));
    else showToast(t("rizz.toast.ghost"));
    // Parent re-render restores result via live session
    onState(applied.state);
  }

  async function sendMessage(raw: string, isStory: boolean) {
    const persona = live.personaId ? personaById(live.personaId) : null;
    if (!persona || live.busy) return;
    const text = raw.trim();
    if (text.length < 2) {
      showToast(t("rizz.tooShort"));
      return;
    }
    if (text.length > 200) {
      showToast(t("rizz.tooLong"));
      return;
    }

    live.busy = true;
    live.messages = [...live.messages, { role: "user", text }];
    live.turn += 1;
    if (isStory) {
      live.storyReplySent = true;
      live.phase = "chat";
    }
    paint();

    const res = await rizzTurn(
      persona,
      live.messages,
      text,
      live.interest,
      live.turn,
      isStory,
      preferAi,
    );

    live.interest = res.interest;
    if (res.reply) {
      live.messages = [...live.messages, { role: "npc", text: res.reply }];
    }
    live.busy = false;

    if (res.outcome !== "continue") {
      paint();
      setTimeout(() => {
        void finish(res.outcome);
      }, 450);
      return;
    }

    if (live.turn >= RIZZ_MAX_TURNS) {
      paint();
      setTimeout(() => {
        void finish(live.interest >= 55 ? "friendzone" : "ghost");
      }, 400);
      return;
    }

    paint();
  }

  paint();
}
