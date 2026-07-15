import { coreById } from "../data/cores";
import { judgeWithAi } from "../ai/judge";
import { getPracticeChallenge, getTodaysChallenge } from "../game/daily";
import {
  applyDailyResult,
  applyPracticeResult,
} from "../game/economy";
import { finalizeRewards, scoreLocal } from "../game/scorer";
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
  const dailyDone = hasPlayedDaily(state);
  let mode: "daily" | "practice" = dailyDone ? "practice" : "daily";
  let challenge: Challenge = mode === "daily" ? getTodaysChallenge() : getPracticeChallenge();
  let result: ScoreResult | null = null;
  let busy = false;
  let preferAi = aiOn;

  const paint = () => {
    if (result) {
      const core = result.coreDropped ? coreById(result.coreDropped) : null;
      container.innerHTML = `
        <div class="card result-panel">
          <div class="muted" style="font-weight:700;letter-spacing:0.08em">AURA SCORE</div>
          <div class="hero-score">+${result.score}</div>
          <div class="verdict">${escapeHtml(result.verdict)}</div>
          <div class="tag-row" style="justify-content:center">
            ${result.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
            <span class="tag magenta">${result.source === "ai" ? "AI Judge" : "Local Judge"}</span>
          </div>
          <div class="stat-grid">
            <div class="stat"><b>+${result.sparksEarned}</b><span>Sparks</span></div>
            <div class="stat"><b>${Math.round(result.streakBonus * 100)}%</b><span>Streak</span></div>
            <div class="stat"><b>${core ? core.emoji : "—"}</b><span>${core ? "Core drop" : "No drop"}</span></div>
          </div>
          ${
            core
              ? `<p class="muted" style="margin-top:12px">Unlocked <strong>${escapeHtml(core.name)}</strong> — ${escapeHtml(core.description)}</p>`
              : ""
          }
          <div class="btn-row">
            <button class="btn btn-primary" id="again">Play again</button>
            <button class="btn btn-secondary" id="back-home">Home vibes</button>
          </div>
        </div>
      `;
      container.querySelector("#again")?.addEventListener("click", () => {
        result = null;
        mode = hasPlayedDaily(state) ? "practice" : "daily";
        challenge = mode === "daily" ? getTodaysChallenge() : getPracticeChallenge();
        paint();
      });
      container.querySelector("#back-home")?.addEventListener("click", () => {
        // soft navigate via custom event
        window.dispatchEvent(new CustomEvent("aurafarm:nav", { detail: "home" }));
      });
      return;
    }

    container.innerHTML = `
      <div class="tabs-inline play-tabs">
        <button type="button" data-mode="daily" class="${mode === "daily" ? "active" : ""}">Daily ${dailyDone ? "✓" : ""}</button>
        <button type="button" data-mode="practice" class="${mode === "practice" ? "active" : ""}">Practice</button>
      </div>
      <div class="desktop-grid play-grid">
      <div class="card">
        <div class="challenge-emoji">${challenge.emoji}</div>
        <h2 style="margin:0 0 6px">${escapeHtml(challenge.title)}</h2>
        <p class="muted" style="margin:0">${escapeHtml(challenge.prompt)}</p>
        <p class="muted" style="margin:10px 0 0;font-size:0.82rem">Hint: ${escapeHtml(challenge.hint)}</p>
        ${
          mode === "daily" && dailyDone
            ? `<p class="muted" style="margin-top:10px">Daily already farmed — switch to Practice for more Sparks (reduced rewards).</p>`
            : ""
        }
      </div>
      <div class="card">
        <div class="field">
          <label for="answer">Your answer</label>
          <textarea id="answer" maxlength="400" placeholder="Drop the line. Make it cinematic..."></textarea>
        </div>
        <label class="muted" style="display:flex;align-items:center;gap:8px;margin:10px 0;font-size:0.85rem">
          <input type="checkbox" id="use-ai" ${preferAi && aiOn ? "checked" : ""} ${aiOn ? "" : "disabled"} />
          Use AI Aura Judge ${aiOn ? "" : "(offline — set XAI_API_KEY)"}
        </label>
        <button class="btn btn-primary" id="submit" ${mode === "daily" && dailyDone ? "disabled" : ""}>${busy ? "Judging..." : "Submit for aura"}</button>
      </div>
      </div>
    `;

    container.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        mode = btn.dataset.mode as "daily" | "practice";
        if (mode === "daily") {
          challenge = getTodaysChallenge();
        } else {
          challenge = getPracticeChallenge();
        }
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
      // re-query after paint
      const useAi = preferAi && aiOn;
      let base = scoreLocal(answer, challenge, state.core, state.streak);

      if (useAi) {
        showToast("AI Judge is reading the room...");
        const ai = await judgeWithAi(challenge, answer, state.core);
        if (ai) {
          base = {
            score: ai.score,
            verdict: ai.verdict,
            tags: ai.tags,
            source: "ai",
          };
        } else {
          showToast("AI unavailable — local judge stepped in.");
        }
      }

      const full = finalizeRewards(base, state.streak, state.ownedCores);
      result = full;
      const next =
        mode === "daily"
          ? applyDailyResult(state, full, challenge.id)
          : applyPracticeResult(state, full);
      onState(next);
      busy = false;
      showToast(`+${full.score} aura · +${full.sparksEarned} sparks`);
      paint();
    });
  };

  paint();
}
