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
import { showToast } from "./toast";

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

  const paint = () => {
    if (result) {
      const core = result.coreDropped ? coreById(result.coreDropped) : null;
      const grade = result.grade || gradeFromScore(result.score);
      const b = result.breakdown;
      container.innerHTML = `
        <div class="card result-panel">
          <div class="muted" style="font-weight:600;font-size:0.84rem">${t("play.judgeTitle", { grade })}</div>
          <div class="hero-score">+${result.score}</div>
          <div class="verdict">${escapeHtml(result.verdict)}</div>
          <div class="tag-row" style="justify-content:center">
            ${result.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
            <span class="tag magenta">${result.source === "ai" ? t("play.aiJudge") : t("play.localJudge")}</span>
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
        mode = hasPlayedDaily(state) ? "practice" : "daily";
        challengeRaw = loadChallengeRaw(mode);
        paint();
      });
      container.querySelector("#back-home")?.addEventListener("click", () => {
        // soft navigate via custom event
        window.dispatchEvent(new CustomEvent("aurafarm:nav", { detail: "home" }));
      });
      return;
    }

    const challenge = localizeChallenge(challengeRaw);

    container.innerHTML = `
      <div class="segmented play-tabs">
        <button type="button" data-mode="daily" class="${mode === "daily" ? "active" : ""}">${t("play.daily")} ${dailyDone ? "✓" : ""}</button>
        <button type="button" data-mode="practice" class="${mode === "practice" ? "active" : ""}">${t("play.practice")}</button>
      </div>
      <div class="desktop-grid play-grid">
      <div class="card home-panel">
        <div class="challenge-emoji">${challenge.emoji}</div>
        <h2 style="margin:0 0 6px;font-size:1.25rem">${escapeHtml(challenge.title)}${challenge.nsfw ? ` <span class="tag" style="font-size:0.7rem;vertical-align:middle">18+</span>` : ""}</h2>
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
          <textarea id="answer" maxlength="400" placeholder="${t("play.placeholder")}"></textarea>
        </div>
        <label class="muted" style="display:flex;align-items:center;gap:8px;margin:12px 0;font-size:0.9rem">
          <input type="checkbox" id="use-ai" ${preferAi && aiOn ? "checked" : ""} ${aiOn ? "" : "disabled"} />
          ${t("play.preferAi")}${aiOn ? "" : " · —"}
        </label>
        <button class="btn btn-fill" id="submit" style="margin-top:auto" ${mode === "daily" && dailyDone ? "disabled" : ""}>${busy ? t("play.judging") : t("play.submit")}</button>
      </div>
      </div>
    `;

    container.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        mode = btn.dataset.mode as "daily" | "practice";
        challengeRaw = loadChallengeRaw(mode);
        paint();
      });
    });

    const aiBox = container.querySelector("#use-ai") as HTMLInputElement | null;
    aiBox?.addEventListener("change", () => {
      preferAi = aiBox.checked;
    });

    container.querySelector("#submit")?.addEventListener("click", async () => {
      if (busy) return;
      if (mode === "daily" && hasPlayedDaily(state)) {
        showToast("Daily already done — try Practice.");
        return;
      }
      const answer = (container.querySelector("#answer") as HTMLTextAreaElement).value;
      if (answer.trim().length < 3) {
        showToast("Give me at least a little aura (3+ chars).");
        return;
      }

      busy = true;
      paint();
      const useAi = preferAi && aiOn;
      // Always score against English source challenge for consistent judging
      const local = scoreLocal(answer, challengeRaw, state.core, state.streak);
      let base = local;

      if (useAi) {
        showToast("Aura Judge is reading the room…");
        const ai = await judgeWithAi(
          challengeRaw,
          answer,
          state.core,
          state.streak,
        );
        if (ai) {
          const blended = blendAiWithLocal(ai.score, local.score);
          base = {
            score: blended,
            verdict: ai.verdict,
            tags: ai.tags.length ? ai.tags : local.tags,
            source: "ai",
            breakdown: ai.breakdown ?? local.breakdown,
            grade: gradeFromScore(blended),
          };
        } else {
          showToast("AI unavailable — local judge stepped in.");
        }
      }

      const full = finalizeRewards(base, state.streak, state.ownedCores);
      result = full;
      const next =
        mode === "daily"
          ? applyDailyResult(state, full, challengeRaw.id)
          : applyPracticeResult(state, full);
      onState(next);
      busy = false;
      showToast(`+${full.score} aura · +${full.sparksEarned} sparks`);
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
