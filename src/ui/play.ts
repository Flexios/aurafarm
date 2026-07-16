import { challengeArtHtml, challengeTitleRow } from "../data/challenges";
import { coreById } from "../data/cores";
import { judgeWithAi } from "../ai/judge";
import { getPracticeChallenge, getTodaysChallenge } from "../game/daily";
import {
  applyDailyResult,
  applyPracticeResult,
} from "../game/economy";
import { gradeFromScore } from "../game/judgeRubric";
import { blendAiWithLocal, finalizeRewards, scoreLocal } from "../game/scorer";
import { coreName, localizeChallenge, t } from "../i18n";
import { hasPlayedDaily } from "../state/store";
import type { Challenge, PlayerState, ScoreResult } from "../types";
import { escapeHtml } from "../utils/format";
import { playUiSound } from "../utils/sound";
import { showToast } from "./toast";

const ANSWER_MAX = 400;

export function renderPlay(
  container: HTMLElement,
  state: PlayerState,
  aiOn: boolean,
  onState: (s: PlayerState) => void,
): void {
  const nsfw = Boolean(state.settings.nsfwChallenges);
  const loadChallengeRaw = (mode: "daily" | "practice"): Challenge =>
    mode === "daily" ? getTodaysChallenge(nsfw) : getPracticeChallenge(nsfw);

  const dailyDone = hasPlayedDaily(state);
  let mode: "daily" | "practice" = dailyDone ? "practice" : "daily";
  /** English source of truth for scoring / cloud */
  let challengeRaw: Challenge = loadChallengeRaw(mode);
  let result: ScoreResult | null = null;
  let busy = false;
  let preferAi = aiOn && state.settings.preferAiJudge;
  /** Provider name from last successful AI judge (for result badge) */
  let lastAiProvider: string | undefined;
  /** Survives re-paint while judging so the answer isn't wiped */
  let draft = "";

  const paint = () => {
    if (result) {
      const core = result.coreDropped ? coreById(result.coreDropped) : null;
      const grade = result.grade || gradeFromScore(result.score);
      const b = result.breakdown;
      const sourceLabel =
        result.source === "ai"
          ? lastAiProvider
            ? t("play.aiJudgeProvider", { provider: lastAiProvider })
            : t("play.aiJudge")
          : t("play.localJudge");
      container.innerHTML = `
        <div class="card result-panel">
          <div class="muted" style="font-weight:600;font-size:0.84rem">${t("play.judgeTitle", { grade })}</div>
          <div class="hero-score">+${result.score}</div>
          <div class="verdict">${escapeHtml(result.verdict)}</div>
          <div class="tag-row" style="justify-content:center">
            ${result.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
            <span class="tag magenta">${escapeHtml(sourceLabel)}</span>
          </div>
          ${
            b
              ? `<div class="judge-breakdown">
            ${breakdownRow(t("play.axis.craft"), b.craft)}
            ${breakdownRow(t("play.axis.fit"), b.fit)}
            ${breakdownRow(t("play.axis.energy"), b.energy)}
            ${breakdownRow(t("play.axis.originality"), b.originality)}
          </div>`
              : ""
          }
          <div class="stat-grid">
            <div class="stat"><b>+${result.sparksEarned}</b><span>${t("currency.sparks")}</span></div>
            <div class="stat"><b>${Math.round(result.streakBonus * 100)}%</b><span>${t("currency.streak")}</span></div>
            <div class="stat"><b>${core ? core.emoji : "—"}</b><span>${core ? t("play.core") : t("play.noDrop")}</span></div>
          </div>
          ${
            core
              ? `<p class="muted" style="margin-top:12px">${t("play.unlocked", {
                  name: coreName(core.id, core.name),
                  desc: core.description,
                })}</p>`
              : ""
          }
          <div class="btn-row">
            <button class="btn btn-fill" id="again">${t("play.again")}</button>
            <button class="btn btn-secondary" id="back-home">${t("play.home")}</button>
          </div>
        </div>
      `;
      container.querySelector("#again")?.addEventListener("click", () => {
        result = null;
        draft = "";
        mode = hasPlayedDaily(state) ? "practice" : "daily";
        challengeRaw = loadChallengeRaw(mode);
        paint();
      });
      container.querySelector("#back-home")?.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("aurafarm:nav", { detail: "home" }));
      });
      return;
    }

    const challenge = localizeChallenge(challengeRaw);
    const chars = draft.length;

    container.innerHTML = `
      <div class="segmented play-tabs">
        <button type="button" data-mode="daily" class="${mode === "daily" ? "active" : ""}">${t("play.daily")} ${dailyDone ? "✓" : ""}</button>
        <button type="button" data-mode="practice" class="${mode === "practice" ? "active" : ""}">${t("play.practice")}</button>
      </div>
      <div class="desktop-grid play-grid">
      <div class="card home-panel">
        ${challengeArtHtml(challenge)}
        <div style="font-size:1.2rem;margin:0 0 8px">
          ${challengeTitleRow(
            challenge.emoji,
            escapeHtml(challenge.title),
            challenge.nsfw
              ? ` <span class="tag challenge-18-tag" style="background:rgba(255,80,120,0.2)">18+</span>`
              : "",
          )}
        </div>
        <p class="muted" style="margin:0">${escapeHtml(challenge.prompt)}</p>
        <p class="muted" style="margin:10px 0 0;font-size:0.86rem">${t("play.hint", { hint: challenge.hint })}</p>
        ${
          mode === "daily" && dailyDone
            ? `<p class="muted" style="margin-top:10px">${t("play.dailyDone")}</p>`
            : ""
        }
      </div>
      <div class="card home-panel">
        <div class="field">
          <label for="answer">${t("play.yourAnswer")}</label>
          <textarea id="answer" maxlength="${ANSWER_MAX}" placeholder="${t("play.placeholder")}" ${busy ? "readonly" : ""}>${escapeHtml(draft)}</textarea>
          <div class="char-count muted" id="char-count">${chars}/${ANSWER_MAX}</div>
        </div>
        <label class="muted" style="display:flex;align-items:center;gap:8px;margin:12px 0;font-size:0.9rem">
          <input type="checkbox" id="use-ai" ${preferAi && aiOn ? "checked" : ""} ${aiOn || busy ? "" : "disabled"} ${busy ? "disabled" : ""} />
          ${t("play.preferAi")}${aiOn ? "" : ` · ${t("play.aiOffline")}`}
        </label>
        <div class="ai-badge ${aiOn ? "on" : ""}" style="margin-top:0;margin-bottom:8px">${aiOn ? t("home.aiOn") : t("home.aiOff")}</div>
        <button class="btn btn-fill ${busy ? "is-loading" : ""}" id="submit" style="margin-top:auto" ${mode === "daily" && dailyDone ? "disabled" : ""} ${busy ? "disabled" : ""}>${busy ? t("play.judging") : t("play.submit")}</button>
      </div>
      </div>
    `;

    container.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (busy) return;
        const ta = container.querySelector("#answer") as HTMLTextAreaElement | null;
        if (ta) draft = ta.value;
        mode = btn.dataset.mode as "daily" | "practice";
        challengeRaw = loadChallengeRaw(mode);
        paint();
      });
    });

    const answerEl = container.querySelector("#answer") as HTMLTextAreaElement | null;
    const countEl = container.querySelector("#char-count");
    answerEl?.addEventListener("input", () => {
      draft = answerEl.value.slice(0, ANSWER_MAX);
      if (countEl) countEl.textContent = `${draft.length}/${ANSWER_MAX}`;
    });

    const aiBox = container.querySelector("#use-ai") as HTMLInputElement | null;
    aiBox?.addEventListener("change", () => {
      preferAi = aiBox.checked;
    });

    // Restore caret at end after paint
    if (answerEl && draft && !busy) {
      answerEl.focus();
      answerEl.selectionStart = answerEl.selectionEnd = answerEl.value.length;
    }

    container.querySelector("#submit")?.addEventListener("click", async () => {
      if (busy) return;
      if (mode === "daily" && hasPlayedDaily(state)) {
        showToast(t("play.dailyAlready"), 2400, "error");
        return;
      }
      const answer = (container.querySelector("#answer") as HTMLTextAreaElement).value;
      draft = answer;
      if (answer.trim().length < 3) {
        showToast(t("play.tooShort"), 2400, "error");
        return;
      }

      busy = true;
      paint();
      playUiSound("tap", state.settings.soundEnabled);
      const useAi = preferAi && aiOn;
      // Always score against English source challenge for consistent judging
      const local = scoreLocal(answer, challengeRaw, state.core, state.streak);
      let base = local;

      if (useAi) {
        showToast(t("play.aiReading"));
        const ai = await judgeWithAi(
          challengeRaw,
          answer,
          state.core,
          state.streak,
        );
        if (ai) {
          lastAiProvider = ai.provider || "AI";
          const blended = blendAiWithLocal(ai.score, local.score);
          base = {
            score: blended,
            verdict: ai.verdict,
            tags: ai.tags.length ? ai.tags : local.tags,
            source: "ai",
            breakdown: ai.breakdown ?? local.breakdown,
            grade: gradeFromScore(blended),
          };
          showToast(t("play.aiOk", { provider: lastAiProvider }), 1800, "ok");
        } else {
          lastAiProvider = undefined;
          showToast(t("play.aiFallback"), 2800, "error");
        }
      } else {
        lastAiProvider = undefined;
      }

      const full = finalizeRewards(base, state.streak, state.ownedCores);
      result = full;
      draft = "";
      const next =
        mode === "daily"
          ? applyDailyResult(state, full, challengeRaw.id)
          : applyPracticeResult(state, full);
      onState(next);
      busy = false;
      playUiSound("success", state.settings.soundEnabled);
      showToast(
        t("play.rewardToast", {
          score: full.score,
          sparks: full.sparksEarned,
        }),
        2600,
        "ok",
      );
      paint();
    });
  };

  paint();
}

function breakdownRow(label: string, value: number): string {
  const pct = Math.max(0, Math.min(100, Math.round((value / 25) * 100)));
  return `
    <div class="judge-axis">
      <div class="judge-axis-meta">
        <span>${escapeHtml(label)}</span>
        <span>${value}/25</span>
      </div>
      <div class="judge-axis-bar"><i style="width:${pct}%"></i></div>
    </div>
  `;
}
