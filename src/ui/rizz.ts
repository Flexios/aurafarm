import { rizzTurn } from "../ai/rizz";
import {
  clearRizzGenderSession,
  loadRizzGenderSession,
  personaById,
  personaMoodImage,
  personaRevealLevel,
  pickDailyPersona,
  pickRandomPersona,
  startingInterest,
  trainersForPicker,
  type RizzDifficulty,
  type RizzPersona,
} from "../data/rizzScenarios";
import { applyRizzResult } from "../game/economy";
import { bonusTurnsToGrant, buildCoachAdvice } from "../game/rizzCoach";
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
import { playUiSound } from "../utils/sound";
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
  /** Base 8 + trainer-granted extras */
  maxTurns: number;
  bonusGranted: number;
  lastDelta: number;
  busy: boolean;
  result: SessionResult | null;
  storyReplySent: boolean;
  lastSource: "ai" | "local" | null;
  /** Coach panel expanded (when enabled in settings) */
  coachOpen: boolean;
  coachSalt: number;
  coachOffered: string[];
  coachOfferKey: string;
} = {
  gender: null,
  phase: "gate",
  personaId: null,
  messages: [],
  interest: 42,
  peakInterest: 42,
  turn: 0,
  maxTurns: RIZZ_MAX_TURNS,
  bonusGranted: 0,
  lastDelta: 0,
  busy: false,
  result: null,
  storyReplySent: false,
  lastSource: null,
  coachOpen: true,
  coachSalt: 0,
  coachOffered: [],
  coachOfferKey: "",
};

function resetCoachMemory(): void {
  live.coachSalt = 0;
  live.coachOffered = [];
  live.coachOfferKey = "";
}

/** Home / external: open straight into a persona story */
export function queueRizzStory(personaId: string, gender: RizzGender): void {
  const p = personaById(personaId);
  const start = p ? startingInterest(p) : 40;
  live.gender = gender;
  live.personaId = personaId;
  live.messages = [];
  live.interest = start;
  live.peakInterest = start;
  live.turn = 0;
  live.maxTurns = RIZZ_MAX_TURNS;
  live.bonusGranted = 0;
  live.lastDelta = 0;
  live.busy = false;
  live.result = null;
  live.storyReplySent = false;
  live.lastSource = null;
  resetCoachMemory();
  live.phase = "story";
}

function interestLabel(n: number): string {
  if (n >= RIZZ_LIKE_AT) return t("rizz.meter.locked");
  if (n >= 55) return t("rizz.meter.vibing");
  if (n >= 35) return t("rizz.meter.warm");
  return t("rizz.meter.cold");
}

function difficultyLabel(d: RizzDifficulty): string {
  switch (d) {
    case "chill":
      return t("rizz.diff.chill");
    case "hard":
      return t("rizz.diff.hard");
    case "wild":
      return t("rizz.diff.wild");
    default:
      return t("rizz.diff.normal");
  }
}

function trainerBadgesHtml(p: RizzPersona, locked: boolean): string {
  const bits: string[] = [];
  if (locked) bits.push(`<span class="rizz-badge rizz-badge-locked">${t("rizz.locked")}</span>`);
  if (p.exclusive && !locked)
    bits.push(`<span class="rizz-badge rizz-badge-exclusive">${t("rizz.exclusive")}</span>`);
  if (p.nsfw) bits.push(`<span class="rizz-badge rizz-badge-18">18+</span>`);
  // One difficulty badge only — hardMode + difficulty "hard" used to double-tag Elise
  if (p.hardMode || p.difficulty === "hard") {
    bits.push(`<span class="rizz-badge rizz-badge-hard">${t("rizz.hardMode")}</span>`);
  } else {
    bits.push(
      `<span class="rizz-badge rizz-badge-diff rizz-diff-${escapeHtml(p.difficulty)}">${escapeHtml(difficultyLabel(p.difficulty))}</span>`,
    );
  }
  return bits.join("");
}

function avatarStyle(p: RizzPersona, photo?: string): string {
  const src = photo ?? p.image;
  return `--rizz-a:${escapeHtml(p.accent)};--rizz-photo:url('${escapeHtml(src)}')`;
}

function storyArtHtml(
  p: RizzPersona,
  photo?: string,
  moodClass = "",
): string {
  const src = photo ?? p.image;
  return `
    <div class="rizz-story-art${moodClass ? ` ${moodClass}` : ""}" data-id="${escapeHtml(p.id)}" style="--rizz-a:${escapeHtml(p.accent)};--rizz-b:${escapeHtml(p.accent2)}">
      <img class="rizz-story-img" src="${escapeHtml(src)}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.onerror=null;this.src='${escapeHtml(p.image)}'" />
      <div class="rizz-story-fallback" aria-hidden="true">
        <span class="rizz-story-emoji">${p.emoji}</span>
      </div>
      <div class="rizz-story-caption rizz-story-caption-onimg">${escapeHtml(p.storyCaption)}</div>
    </div>`;
}

function moodClassFor(
  interest: number,
  outcome?: "continue" | "like" | "ghost" | "friendzone" | null,
  persona?: RizzPersona | null,
): string {
  if (persona) {
    const lvl = personaRevealLevel(persona, interest, outcome);
    if (lvl === "hot") return "rizz-mood-win rizz-mood-hot";
    if (lvl === "win") return "rizz-mood-win";
    if (lvl === "fail") return "rizz-mood-fail";
    return "";
  }
  if (outcome === "like" || interest >= 68) return "rizz-mood-win";
  if (outcome === "ghost" || outcome === "friendzone" || interest <= 32)
    return "rizz-mood-fail";
  return "";
}

function coachPanelHtml(
  p: RizzPersona,
  opts: {
    interest: number;
    turn: number;
    isStoryPhase: boolean;
    history: RizzChatMessage[];
    enabled: boolean;
    open: boolean;
  },
): string {
  if (!opts.enabled) {
    return `
      <div class="rizz-coach rizz-coach-off">
        <button type="button" class="rizz-coach-toggle" id="rizz-coach-enable">${t("rizz.coach.enable")}</button>
      </div>`;
  }
  if (!opts.open) {
    return `
      <div class="rizz-coach rizz-coach-collapsed">
        <button type="button" class="rizz-coach-toggle" id="rizz-coach-open" aria-expanded="false">
          <span class="rizz-coach-dot" aria-hidden="true"></span>
          ${t("rizz.coach.title")}
        </button>
      </div>`;
  }
  const advice = buildCoachAdvice({
    persona: p,
    interest: opts.interest,
    turn: opts.turn,
    isStoryPhase: opts.isStoryPhase,
    history: opts.history,
    excludeLines: live.coachOffered,
    salt: live.coachSalt,
  });
  // Remember offered set once per (turn, salt) so refresh rotates without exhaust-on-repaint
  const offerKey = `${p.id}|${opts.turn}|${live.coachSalt}|${opts.isStoryPhase ? "s" : "c"}`;
  if (offerKey !== live.coachOfferKey) {
    live.coachOfferKey = offerKey;
    for (const line of advice.lines) {
      const key = line.toLowerCase();
      if (!live.coachOffered.includes(key)) live.coachOffered.push(key);
    }
    if (live.coachOffered.length > 48) {
      live.coachOffered = live.coachOffered.slice(-28);
    }
  }
  return `
    <div class="rizz-coach rizz-coach-open" role="complementary" aria-label="${t("rizz.coach.title")}">
      <div class="rizz-coach-head">
        <div class="rizz-coach-brand">
          <span class="rizz-coach-dot" aria-hidden="true"></span>
          <strong>${t("rizz.coach.title")}</strong>
        </div>
        <div class="rizz-coach-head-actions">
          <button type="button" class="btn-plain rizz-coach-mini" id="rizz-coach-refresh">${t("rizz.coach.refresh")}</button>
          <button type="button" class="btn-plain rizz-coach-mini" id="rizz-coach-collapse" aria-expanded="true">${t("rizz.coach.hide")}</button>
          <button type="button" class="btn-plain rizz-coach-mini" id="rizz-coach-disable">${t("rizz.coach.off")}</button>
        </div>
      </div>
      <p class="rizz-coach-status">${escapeHtml(advice.status)}</p>
      <ul class="rizz-coach-tips">
        ${advice.tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("")}
      </ul>
      <div class="rizz-coach-lines">
        <span class="muted rizz-coach-lines-label">${t("rizz.coach.try")}</span>
        ${advice.lines
          .map(
            (line, i) =>
              `<button type="button" class="rizz-coach-line" data-coach-line="${i}">${escapeHtml(line)}</button>`,
          )
          .join("")}
      </div>
    </div>`;
}

function wireCoachPanel(
  container: HTMLElement,
  state: PlayerState,
  onState: (s: PlayerState) => void,
  paint: () => void,
  inputSelector: string,
): void {
  container.querySelector("#rizz-coach-enable")?.addEventListener("click", () => {
    live.coachOpen = true;
    resetCoachMemory();
    onState(updateSettings(state, { rizzCoachEnabled: true }));
  });
  container.querySelector("#rizz-coach-open")?.addEventListener("click", () => {
    live.coachOpen = true;
    paint();
  });
  container.querySelector("#rizz-coach-refresh")?.addEventListener("click", () => {
    live.coachSalt += 1;
    playUiSound("soft", state.settings.soundEnabled);
    paint();
  });
  container.querySelector("#rizz-coach-collapse")?.addEventListener("click", () => {
    live.coachOpen = false;
    paint();
  });
  container.querySelector("#rizz-coach-disable")?.addEventListener("click", () => {
    live.coachOpen = false;
    onState(updateSettings(state, { rizzCoachEnabled: false }));
  });
  container.querySelectorAll<HTMLButtonElement>("[data-coach-line]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = container.querySelector(inputSelector) as HTMLInputElement | null;
      if (!input || live.busy) return;
      input.value = btn.textContent?.trim() ?? "";
      input.focus();
      playUiSound("tap", state.settings.soundEnabled);
    });
  });
}

function resetRun(): void {
  live.personaId = null;
  live.messages = [];
  live.interest = 40;
  live.peakInterest = 40;
  live.turn = 0;
  live.maxTurns = RIZZ_MAX_TURNS;
  live.bonusGranted = 0;
  live.lastDelta = 0;
  live.busy = false;
  live.result = null;
  live.storyReplySent = false;
  live.lastSource = null;
  resetCoachMemory();
}

function beginWithPersona(p: RizzPersona): void {
  const start = startingInterest(p);
  live.personaId = p.id;
  live.messages = [];
  live.interest = start;
  live.peakInterest = start;
  live.turn = 0;
  live.maxTurns = RIZZ_MAX_TURNS;
  live.bonusGranted = 0;
  live.lastDelta = 0;
  live.busy = false;
  live.result = null;
  live.storyReplySent = false;
  live.lastSource = null;
  resetCoachMemory();
  live.phase = "story";
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
      const roster = trainersForPicker(gender, state.ownedCores, nsfwOn);
      const unlocked = roster.filter((x) => !x.locked).map((x) => x.persona);
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
            <div class="section-header" style="margin:0 0 8px">${t("rizz.daily")}</div>
            <div class="rizz-persona-row">
              <div class="rizz-avatar has-photo" style="${avatarStyle(daily)}" aria-hidden="true">${daily.emoji}</div>
              <div style="flex:1;min-width:0">
                <strong>${escapeHtml(daily.name)}</strong>
                <div class="muted" style="font-size:0.84rem">@${escapeHtml(daily.handle)} · ${escapeHtml(daily.vibe)}</div>
                <div class="rizz-badge-row">${trainerBadgesHtml(daily, false)}</div>
                <p class="muted rizz-bio">${escapeHtml(daily.bio)}</p>
              </div>
            </div>
            <button type="button" class="btn btn-fill" id="rizz-start-daily" style="margin-top:14px">${t("rizz.replyToStory")}</button>
          </div>
          <div class="section-header">${t("rizz.morePersonas")}</div>
          <div class="rizz-persona-list">
            ${roster
              .map(({ persona: p, locked }) => {
                return `
              <button type="button" class="card rizz-persona-card${locked ? " rizz-persona-locked" : ""}" data-persona="${escapeHtml(p.id)}" data-locked="${locked ? "1" : "0"}">
                <div class="rizz-avatar has-photo" style="${avatarStyle(p)}" aria-hidden="true">${p.emoji}</div>
                <div style="flex:1;min-width:0;text-align:left">
                  <strong>${escapeHtml(p.name)}</strong>
                  <div class="muted" style="font-size:0.82rem">${escapeHtml(p.vibe)}</div>
                  <div class="rizz-badge-row">${trainerBadgesHtml(p, locked)}</div>
                  <p class="muted rizz-bio">${escapeHtml(locked ? t("rizz.lockedHint") : p.bio)}</p>
                </div>
                <span class="muted">${locked ? "🔒" : "→"}</span>
              </button>`;
              })
              .join("")}
          </div>
          <button type="button" class="btn btn-secondary" id="rizz-random" style="margin-top:12px" ${unlocked.length ? "" : "disabled"}>${t("rizz.random")}</button>
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
          showToast(t("rizz.nsfwLocked"), 2800, "error");
          return;
        }
        if (!unlocked.some((u) => u.id === p.id)) {
          showToast(
            p.unlockCoreId === "elise-sip" ? t("rizz.unlockElise") : t("rizz.lockedHint"),
            3200,
            "error",
          );
          return;
        }
        beginWithPersona(p);
        playUiSound("soft", state.settings.soundEnabled);
        paint();
      };
      container.querySelector("#rizz-start-daily")?.addEventListener("click", () => startWith(daily));
      container.querySelector("#rizz-random")?.addEventListener("click", () =>
        startWith(pickRandomPersona(gender, state.ownedCores, nsfwOn)),
      );
      container.querySelectorAll<HTMLButtonElement>("[data-persona]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const entry = roster.find((x) => x.persona.id === btn.dataset.persona);
          if (entry) startWith(entry.persona);
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
                <strong>${escapeHtml(p.name)}</strong>
                <div class="muted" style="font-size:0.75rem">@${escapeHtml(p.handle)} · ${t("rizz.justNow")}</div>
                <div class="rizz-badge-row">${trainerBadgesHtml(p, false)}</div>
              </div>
              <button type="button" class="btn-plain rizz-close" id="rizz-abort" aria-label="${t("common.close")}">✕</button>
            </div>
            <div class="rizz-story-stage">
              ${storyArtHtml(p)}
              <div class="rizz-story-side">
                <div class="rizz-story-side-card">
                  <div class="section-header" style="margin:0 0 8px">${t("rizz.storyReply")}</div>
                  <p class="rizz-story-caption-block">${escapeHtml(p.storyCaption)}</p>
                  <p class="muted rizz-story-vibe">${escapeHtml(p.vibe)} · ${escapeHtml(p.bio)}</p>
                  <p class="muted rizz-story-tip rizz-story-tip-desktop">${escapeHtml(p.openTip)}</p>
                </div>
                <!-- Assist panel: coach + tips always visible on mobile (side-card is desktop-only) -->
                <div class="rizz-story-assist">
                  <p class="muted rizz-story-tip rizz-story-tip-mobile">${escapeHtml(p.openTip)}</p>
                  ${
                    state.settings.rizzCoachEnabled && live.coachOpen
                      ? ""
                      : `<div class="rizz-starters" id="rizz-starters">
                    <span class="muted rizz-starters-label">${t("rizz.tryLine")}</span>
                    ${p.starters
                      .map(
                        (s, i) =>
                          `<button type="button" class="rizz-starter-chip" data-starter="${i}">${escapeHtml(s)}</button>`,
                      )
                      .join("")}
                  </div>`
                  }
                  ${coachPanelHtml(p, {
                    interest: live.interest,
                    turn: live.turn,
                    isStoryPhase: true,
                    history: live.messages,
                    enabled: Boolean(state.settings.rizzCoachEnabled),
                    open: live.coachOpen,
                  })}
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
      const input = container.querySelector("#rizz-story-input") as HTMLInputElement | null;
      container.querySelectorAll<HTMLButtonElement>("[data-starter]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.dataset.starter);
          const line = p.starters[idx];
          if (!input || !line || live.busy) return;
          input.value = line;
          input.focus();
          playUiSound("tap", state.settings.soundEnabled);
        });
      });
      wireCoachPanel(container, state, onState, paint, "#rizz-story-input");
      container.querySelector("#rizz-story-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        void sendMessage(input?.value ?? "", true);
      });
      input?.focus();
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
      const turnsLeft = Math.max(0, live.maxTurns - live.turn);
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
      const moodInterest = ended && result ? result.interest : live.interest;
      const moodOutcome = ended && result ? result.outcome : null;
      const moodPhoto = personaMoodImage(p, moodInterest, moodOutcome);
      const moodCls = moodClassFor(moodInterest, moodOutcome, p);
      const reveal = personaRevealLevel(p, moodInterest, moodOutcome);
      const moodTag =
        reveal === "hot"
          ? `<span class="rizz-mood-tag rizz-mood-tag-hot">${t("rizz.mood.reveal")}</span>`
          : reveal === "win"
            ? `<span class="rizz-mood-tag rizz-mood-tag-win">${t("rizz.mood.vibing")}</span>`
            : reveal === "fail"
              ? `<span class="rizz-mood-tag rizz-mood-tag-fail">${t("rizz.mood.cold")}</span>`
              : "";

      container.innerHTML = `
        <div class="rizz-chat${ended ? " rizz-chat-ended" : ""}${moodCls ? ` ${moodCls}` : ""}" style="--rizz-chat-bg:url('${escapeHtml(moodPhoto)}')">
          <div class="rizz-chat-layout">
            <aside class="rizz-chat-photo">
              <div class="rizz-story-art rizz-chat-art${moodCls ? ` ${moodCls}` : ""}" style="--rizz-a:${escapeHtml(p.accent)};--rizz-b:${escapeHtml(p.accent2)}">
                <img class="rizz-story-img" src="${escapeHtml(moodPhoto)}" alt="${escapeHtml(p.name)}" onerror="this.onerror=null;this.src='${escapeHtml(p.image)}'" />
                ${moodTag}
              </div>
              <p class="muted rizz-chat-photo-cap">${escapeHtml(p.storyCaption)}</p>
            </aside>
            <div class="rizz-chat-main">
              <div class="rizz-chat-top">
                <button type="button" class="btn-plain" id="rizz-back-pick">←</button>
                <div class="rizz-avatar rizz-avatar-sm has-photo" style="${avatarStyle(p, moodPhoto)}" aria-hidden="true">${p.emoji}</div>
                <div style="flex:1;min-width:0">
                  <strong>${escapeHtml(p.name)}</strong>
                  <div class="muted" style="font-size:0.75rem">@${escapeHtml(p.handle)}${ended ? ` · ${t("rizz.chatEnded")}` : ""}${
                    !ended && live.lastSource
                      ? ` · ${live.lastSource === "ai" ? t("rizz.sourceAi") : t("rizz.sourceLocal")}`
                      : ""
                  }</div>
                  <div class="rizz-badge-row rizz-badge-row-compact">${trainerBadgesHtml(p, false)}</div>
                </div>
                <div class="rizz-interest" title="${t("rizz.interest")}">
                  <div class="rizz-interest-ring">
                    <span>${Math.round(ended && result ? result.interest : live.interest)}</span>
                  </div>
                  <div class="rizz-interest-label">${interestLabel(ended && result ? result.interest : live.interest)}</div>
                  ${
                    !ended
                      ? `<div class="muted rizz-peak-mini">${t("rizz.peakShort", { n: Math.round(live.peakInterest) })}</div>`
                      : ""
                  }
                </div>
              </div>
              <div class="rizz-interest-bar${p.hardMode ? " rizz-interest-hard" : ""}" aria-hidden="true"><i style="width:${ended && result ? result.interest : live.interest}%"></i></div>
              ${
                !ended && p.hardMode
                  ? `<p class="muted rizz-hard-note">${t("rizz.hardNote")}</p>`
                  : ""
              }
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
              ${
                !ended
                  ? coachPanelHtml(p, {
                      interest: live.interest,
                      turn: live.turn,
                      isStoryPhase: false,
                      history: live.messages,
                      enabled: Boolean(state.settings.rizzCoachEnabled),
                      open: live.coachOpen,
                    })
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
                  : `<p class="muted rizz-turns">${t("rizz.turnsLeft", { n: turnsLeft })}${
                        live.bonusGranted > 0
                          ? ` · ${t("rizz.bonusTurns", { n: live.bonusGranted })}`
                          : ""
                      }</p>
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
        wireCoachPanel(container, state, onState, paint, "#rizz-chat-input");
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
    if (won) {
      playUiSound("success", state.settings.soundEnabled);
      showToast(t("rizz.toast.like"), 2600, "ok");
    } else if (friendzone) {
      playUiSound("soft", state.settings.soundEnabled);
      showToast(t("rizz.toast.friendzone"), 2400);
    } else {
      playUiSound("error", state.settings.soundEnabled);
      showToast(t("rizz.toast.ghost"), 2400, "error");
    }
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
    // New turn → allow coach to reshuffle fresh options
    live.coachSalt += 1;
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
      live.maxTurns,
    );

    const prevInterest = live.interest;
    live.interest = res.interest;
    live.lastDelta = res.interest - prevInterest;
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

    // Trainer may stretch the chat if chemistry is rising near the end
    const bonus = bonusTurnsToGrant({
      interest: live.interest,
      peakInterest: live.peakInterest,
      turn: live.turn,
      maxTurns: live.maxTurns,
      alreadyGranted: live.bonusGranted,
      lastDelta: live.lastDelta,
      hardMode: persona.hardMode,
      nsfw: persona.nsfw,
    });
    if (bonus > 0) {
      live.maxTurns += bonus;
      live.bonusGranted += bonus;
      const extraLine = pickBonusLine(persona, bonus);
      live.messages = [...live.messages, { role: "npc", text: extraLine }];
      showToast(t("rizz.bonusToast", { n: bonus }), 2800, "ok");
      playUiSound("soft", state.settings.soundEnabled);
    }

    if (live.turn >= live.maxTurns) {
      paint();
      setTimeout(() => {
        void finish(live.interest >= 55 ? "friendzone" : "ghost");
      }, 400);
      return;
    }

    paint();
  }

  function pickBonusLine(persona: RizzPersona, n: number): string {
    const name = persona.name;
    const lines = [
      `wait — don't hop yet. this was just getting good. +${n} more`,
      `ok one more beat. i wasn't done with this chat`,
      `hold up. extra time. use it well`,
      n > 1
        ? `…alright, ${n} more. only because this got interesting`
        : `fine. one more turn. impress me again`,
      `${name} voice: "don't ghost mid-vibe." (+${n})`,
    ];
    return lines[Math.floor(Math.random() * lines.length)]!;
  }

  paint();
}
