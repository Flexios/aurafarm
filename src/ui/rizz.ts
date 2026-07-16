import { rizzTurn } from "../ai/rizz";
import {
  clearRizzGenderSession,
  loadRizzGenderSession,
  personaById,
  personasByGender,
  pickDailyPersona,
  pickRandomPersona,
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
import { updateSettings } from "../state/store";
import type { PlayerState, RizzGender } from "../types";
import { escapeHtml } from "../utils/format";
import { showToast } from "./toast";

type Phase = "gate" | "pick" | "story" | "chat" | "result";

interface SessionResult {
  outcome: RizzOutcome;
  /** Interest at end of chat */
  interest: number;
  /** Highest interest reached during the chat */
  peakInterest: number;
  turns: number;
  aura: number;
  sparks: number;
  personaName: string;
  source?: "ai" | "local";
}

/** Survives shell re-renders when rewards update parent state */
let live: {
  gender: RizzGender | null;
  phase: Phase;
  personaId: string | null;
  messages: RizzChatMessage[];
  interest: number;
  peakInterest: number;
  turn: number;
  busy: boolean;
  result: SessionResult | null;
  storyReplySent: boolean;
  lastSource: "ai" | "local" | null;
} = {
  gender: null,
  phase: "gate",
  personaId: null,
  messages: [],
  interest: 42,
  peakInterest: 42,
  turn: 0,
  busy: false,
  result: null,
  storyReplySent: false,
  lastSource: null,
};

/** Home / external: open straight into a persona story */
export function queueRizzStory(personaId: string, gender: RizzGender): void {
  live.gender = gender;
  live.personaId = personaId;
  live.messages = [];
  live.interest = 42;
  live.peakInterest = 42;
  live.turn = 0;
  live.busy = false;
  live.result = null;
  live.storyReplySent = false;
  live.lastSource = null;
  live.phase = "story";
}

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
      <div class="rizz-story-caption rizz-story-caption-onimg">${escapeHtml(p.storyCaption)}</div>
    </div>`;
}

function resetRun(): void {
  live.personaId = null;
  live.messages = [];
  live.interest = 42;
  live.peakInterest = 42;
  live.turn = 0;
  live.busy = false;
  live.result = null;
  live.storyReplySent = false;
  live.lastSource = null;
}

export function renderRizz(
  container: HTMLElement,
  state: PlayerState,
  aiOn: boolean,
  onState: (s: PlayerState) => void,
): void {
  // Prefer cloud-persisted gender; migrate legacy session key once
  let settingsGender = state.settings.rizzTargetGender ?? null;
  if (!settingsGender) {
    const legacy = loadRizzGenderSession();
    if (legacy) {
      settingsGender = legacy;
      clearRizzGenderSession();
      state = updateSettings(state, { rizzTargetGender: legacy });
      queueMicrotask(() => onState(state));
    }
  }
  // Keep live gender in sync (don't clobber mid-story if settings already set)
  if (settingsGender) live.gender = settingsGender;
  if (settingsGender && live.phase === "gate") {
    live.phase = "pick";
  } else if (!settingsGender && !live.personaId) {
    live.phase = "gate";
    live.gender = null;
  }

  const preferAi = aiOn && state.settings.preferAiJudge;

  const persistGender = (g: RizzGender | null) => {
    live.gender = g;
    const next = updateSettings(state, { rizzTargetGender: g });
    onState(next);
  };

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
          const g = btn.dataset.gender as RizzGender;
          live.phase = "pick";
          persistGender(g);
        });
      });
      return;
    }

    if (phase === "pick" && gender) {
      const nsfwOn = Boolean(state.settings.nsfwChallenges);
      const list = personasByGender(gender, state.ownedCores, nsfwOn);
      const daily = pickDailyPersona(gender, new Date(), state.ownedCores, nsfwOn);
      container.innerHTML = `
        <div class="rizz-pick">
          <div class="rizz-pick-head">
            <p class="muted" style="margin:0">${t("rizz.trainingAs", {
              target: gender === "female" ? t("rizz.her") : t("rizz.him"),
            })}</p>
            <button type="button" class="btn-plain" id="rizz-change-gender">${t("rizz.changeTarget")}</button>
          </div>
          <div class="card rizz-daily-card">
            <div class="section-header" style="margin:0 0 8px">${t("rizz.daily")}${daily.nsfw ? ` <span class="tag challenge-18-tag" style="background:rgba(255,80,120,0.2)">18+</span>` : ""}</div>
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
                  <strong>${escapeHtml(p.name)}${p.nsfw ? ` <span class="tag challenge-18-tag" style="background:rgba(255,80,120,0.2);font-size:0.7rem">18+</span>` : ""}</strong>
                  <div class="muted" style="font-size:0.82rem">${escapeHtml(p.vibe)}</div>
                </div>
                <span class="muted">→</span>
              </button>`,
              )
              .join("")}
          </div>
          <button type="button" class="btn btn-secondary" id="rizz-random" style="margin-top:12px">${t("rizz.random")}</button>
          <p class="muted" style="font-size:0.8rem;margin-top:10px">${aiOn ? t("rizz.aiOn") : t("rizz.aiOff")}${
            nsfwOn ? ` · ${t("rizz.nsfwOn")}` : ` · ${t("rizz.nsfwOff")}`
          }</p>
        </div>`;
      container.querySelector("#rizz-change-gender")?.addEventListener("click", () => {
        resetRun();
        live.phase = "gate";
        persistGender(null);
      });
      const startWith = (p: RizzPersona) => {
        if (p.nsfw && !nsfwOn) {
          showToast(t("rizz.nsfwLocked"));
          return;
        }
        resetRun();
        live.personaId = p.id;
        live.phase = "story";
        paint();
      };
      container.querySelector("#rizz-start-daily")?.addEventListener("click", () => startWith(daily));
      container.querySelector("#rizz-random")?.addEventListener("click", () =>
        startWith(pickRandomPersona(gender, state.ownedCores, nsfwOn)),
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
      if (p.nsfw && !state.settings.nsfwChallenges) {
        showToast(t("rizz.nsfwLocked"));
        live.phase = "pick";
        live.personaId = null;
        paint();
        return;
      }
      container.innerHTML = `
        <div class="rizz-story">
          <div class="rizz-story-chrome">
            <div class="rizz-story-progress"><i></i></div>
            <div class="rizz-story-top">
              <div class="rizz-avatar rizz-avatar-sm has-photo" style="${avatarStyle(p)}" aria-hidden="true">${p.emoji}</div>
              <div style="flex:1;min-width:0">
                <strong>${escapeHtml(p.name)}${p.nsfw ? ` <span class="tag challenge-18-tag" style="background:rgba(255,80,120,0.2);font-size:0.7rem">18+</span>` : ""}</strong>
                <div class="muted" style="font-size:0.75rem">@${escapeHtml(p.handle)} · ${t("rizz.justNow")}</div>
              </div>
              <button type="button" class="btn-plain rizz-close" id="rizz-abort" aria-label="${t("common.close")}">✕</button>
            </div>
            <div class="rizz-story-stage">
              ${storyArtHtml(p)}
              <div class="rizz-story-side">
                <div class="rizz-story-side-card">
                  <div class="section-header" style="margin:0 0 8px">${t("rizz.storyReply")}</div>
                  <p class="rizz-story-caption-block">${escapeHtml(p.storyCaption)}</p>
                  <p class="muted rizz-story-vibe">${escapeHtml(p.vibe)}</p>
                  <p class="muted rizz-story-tip">${t("rizz.storyTip")}</p>
                </div>
                <form class="rizz-story-composer" id="rizz-story-form">
                  <input type="text" id="rizz-story-input" maxlength="200" autocomplete="off"
                    placeholder="${t("rizz.replyPlaceholder")}" ${live.busy ? "disabled" : ""} />
                  <button type="submit" class="btn btn-fill rizz-send" ${live.busy ? "disabled" : ""}>${live.busy ? "…" : t("rizz.send")}</button>
                </form>
              </div>
            </div>
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

    if ((phase === "chat" || phase === "result") && persona) {
      const p = persona;
      if (p.nsfw && !state.settings.nsfwChallenges) {
        showToast(t("rizz.nsfwLocked"));
        live.phase = "pick";
        live.personaId = null;
        paint();
        return;
      }
      const ended = phase === "result" && live.result;
      const result = live.result;
      const turnsLeft = Math.max(0, RIZZ_MAX_TURNS - live.turn);
      const win = result?.outcome === "like";
      const friend = result?.outcome === "friendzone";
      const endTitle = !result
        ? ""
        : win
          ? t("rizz.result.like")
          : friend
            ? t("rizz.result.friendzone")
            : t("rizz.result.ghost");
      const endEmoji = win ? "❤️" : friend ? "🤝" : "👻";

      container.innerHTML = `
        <div class="rizz-chat${ended ? " rizz-chat-ended" : ""}">
          <div class="rizz-chat-layout">
            <aside class="rizz-chat-photo" aria-hidden="true">
              <div class="rizz-story-art rizz-chat-art" style="--rizz-a:${escapeHtml(p.accent)};--rizz-b:${escapeHtml(p.accent2)}">
                <img class="rizz-story-img" src="${escapeHtml(p.image)}" alt="" />
              </div>
              <p class="muted rizz-chat-photo-cap">${escapeHtml(p.storyCaption)}</p>
            </aside>
            <div class="rizz-chat-main">
              <div class="rizz-chat-top">
                <button type="button" class="btn-plain" id="rizz-back-pick">←</button>
                <div class="rizz-avatar rizz-avatar-sm has-photo" style="${avatarStyle(p)}" aria-hidden="true">${p.emoji}</div>
                <div style="flex:1;min-width:0">
                  <strong>${escapeHtml(p.name)}</strong>
                  <div class="muted" style="font-size:0.75rem">@${escapeHtml(p.handle)}${ended ? ` · ${t("rizz.chatEnded")}` : ""}${
                    !ended && live.lastSource
                      ? ` · ${live.lastSource === "ai" ? t("rizz.sourceAi") : t("rizz.sourceLocal")}`
                      : ""
                  }</div>
                </div>
                <div class="rizz-interest" title="${t("rizz.interest")}">
                  <div class="rizz-interest-ring">
                    <span>${Math.round(ended && result ? result.interest : live.interest)}</span>
                  </div>
                  <div class="rizz-interest-label">${interestLabel(ended && result ? result.interest : live.interest)}</div>
                </div>
              </div>
              <div class="rizz-interest-bar" aria-hidden="true"><i style="width:${ended && result ? result.interest : live.interest}%"></i></div>
              ${
                ended && result
                  ? `<div class="rizz-end-banner rizz-end-${escapeHtml(result.outcome)}" role="status">
                <span class="rizz-end-emoji">${endEmoji}</span>
                <div class="rizz-end-copy">
                  <strong>${endTitle}</strong>
                  <span class="muted">${t("rizz.result.interest", { n: result.peakInterest })} · ${t("rizz.result.final", { n: result.interest })} · +${result.aura} ${t("common.aura")} · +${result.sparks} ${t("currency.sparks")}</span>
                </div>
              </div>`
                  : ""
              }
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
              ${
                ended
                  ? `<div class="rizz-end-actions btn-row">
                <button type="button" class="btn btn-fill" id="rizz-again">${t("rizz.again")}</button>
                <button type="button" class="btn btn-secondary" id="rizz-home">${t("play.home")}</button>
              </div>`
                  : `<p class="muted rizz-turns">${t("rizz.turnsLeft", { n: turnsLeft })}</p>
              <form class="rizz-chat-composer" id="rizz-chat-form">
                <input type="text" id="rizz-chat-input" maxlength="200" autocomplete="off"
                  placeholder="${t("rizz.chatPlaceholder")}" ${live.busy ? "disabled" : ""} />
                <button type="submit" class="btn btn-fill rizz-send" ${live.busy ? "disabled" : ""}>${t("rizz.send")}</button>
              </form>`
              }
            </div>
          </div>
        </div>`;
      const bubbles = container.querySelector("#rizz-bubbles");
      if (bubbles) bubbles.scrollTop = bubbles.scrollHeight;
      container.querySelector("#rizz-back-pick")?.addEventListener("click", () => {
        if (live.busy) return;
        live.phase = "pick";
        resetRun();
        paint();
      });
      if (ended) {
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
      } else {
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
      }
      return;
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
      peakInterest: live.peakInterest,
      turns: live.turn,
      aura: applied.aura,
      sparks: applied.sparks,
      personaName: persona.name,
      source: live.lastSource ?? undefined,
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
    live.peakInterest = Math.max(live.peakInterest, res.interest);
    live.lastSource = res.source;
    if (res.source === "local" && preferAi) {
      // Prefer AI was on but /api/rizz-turn failed (missing key, bad key, or not redeployed)
      if (live.turn === 1) {
        showToast(t("rizz.aiFallback"));
      }
    } else if (res.source === "ai" && live.turn === 1) {
      showToast(t("rizz.aiActive", { provider: res.provider || "AI" }));
    }
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
