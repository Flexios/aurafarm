import { getTodaysChallenge } from "../game/daily";
import { applyDuelLoss, applyDuelWin } from "../game/economy";
import {
  createDuelState,
  duelWinner,
  type DuelState,
} from "../game/duel";
import { finalizeRewards, scoreLocal } from "../game/scorer";
import { saveState } from "../state/store";
import type { PlayerState } from "../types";
import { escapeHtml } from "../utils/format";
import { showToast } from "./toast";

export function renderDuel(
  container: HTMLElement,
  state: PlayerState,
  onState: (s: PlayerState) => void,
): void {
  let duel: DuelState = createDuelState();

  const paint = () => {
    if (duel.phase === "setup") {
      container.innerHTML = `
        <div class="card">
          <h2 style="margin:0 0 8px">Aura Duel</h2>
          <p class="muted" style="margin:0">Pass-and-play. Same prompt. Higher aura wins Sparks. Perfect for siblings, friends, or chaotic group hangs.</p>
          <div class="field" style="margin-top:14px">
            <label for="p1">Player 1 name</label>
            <input id="p1" maxlength="16" value="${escapeHtml(state.displayName || "Player 1")}" />
          </div>
          <div class="field" style="margin-top:10px">
            <label for="p2">Player 2 name</label>
            <input id="p2" maxlength="16" value="Challenger" />
          </div>
          <button class="btn btn-primary" id="start-duel" style="margin-top:14px">Start duel</button>
        </div>
      `;
      container.querySelector("#start-duel")?.addEventListener("click", () => {
        const p1 = (container.querySelector("#p1") as HTMLInputElement).value.trim() || "Player 1";
        const p2 = (container.querySelector("#p2") as HTMLInputElement).value.trim() || "Player 2";
        duel = {
          ...createDuelState(),
          phase: "p1",
          challenge: getTodaysChallenge(),
          p1: { name: p1, answer: "", result: null },
          p2: { name: p2, answer: "", result: null },
        };
        paint();
      });
      return;
    }

    if (duel.phase === "handoff") {
      container.innerHTML = `
        <div class="card handoff">
          <div class="big">👀</div>
          <h2>Pass the phone</h2>
          <p class="muted">${escapeHtml(duel.p1.name)} is done. Hide the screen and hand it to <strong>${escapeHtml(duel.p2.name)}</strong>.</p>
          <button class="btn btn-primary" id="p2-ready">${escapeHtml(duel.p2.name)} is ready</button>
        </div>
      `;
      container.querySelector("#p2-ready")?.addEventListener("click", () => {
        duel = { ...duel, phase: "p2" };
        paint();
      });
      return;
    }

    if (duel.phase === "result" && duel.p1.result && duel.p2.result) {
      const winner = duelWinner(duel);
      container.innerHTML = `
        <div class="card result-panel">
          <div class="muted" style="font-weight:700">DUEL RESULT</div>
          <div class="hero-score" style="font-size:2.2rem">
            ${
              winner === "tie"
                ? "TIE"
                : winner === "p1"
                  ? escapeHtml(duel.p1.name)
                  : escapeHtml(duel.p2.name)
            }
          </div>
          <p class="verdict">${winner === "tie" ? "Split aura. Both ate." : "takes the aura crown."}</p>
          <div class="stat-grid">
            <div class="stat"><b>${duel.p1.result.score}</b><span>${escapeHtml(duel.p1.name)}</span></div>
            <div class="stat"><b>VS</b><span>aura</span></div>
            <div class="stat"><b>${duel.p2.result.score}</b><span>${escapeHtml(duel.p2.name)}</span></div>
          </div>
          <div class="card" style="margin-top:12px;text-align:left">
            <p class="muted" style="margin:0 0 6px"><strong>${escapeHtml(duel.p1.name)}</strong> — ${escapeHtml(duel.p1.result.verdict)}</p>
            <p class="muted" style="margin:0"><strong>${escapeHtml(duel.p2.name)}</strong> — ${escapeHtml(duel.p2.result.verdict)}</p>
          </div>
          <div class="btn-row">
            <button class="btn btn-primary" id="rematch">Rematch</button>
            <button class="btn btn-secondary" id="duel-home">Done</button>
          </div>
        </div>
      `;
      container.querySelector("#rematch")?.addEventListener("click", () => {
        duel = createDuelState();
        paint();
      });
      container.querySelector("#duel-home")?.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("aurafarm:nav", { detail: "home" }));
      });
      return;
    }

    // p1 or p2 answer
    const isP1 = duel.phase === "p1";
    const player = isP1 ? duel.p1 : duel.p2;
    const challenge = duel.challenge!;

    container.innerHTML = `
      <div class="card">
        <div class="muted" style="font-weight:700">${isP1 ? "PLAYER 1" : "PLAYER 2"} · ${escapeHtml(player.name)}</div>
        <div class="challenge-emoji">${challenge.emoji}</div>
        <h2 style="margin:0 0 6px">${escapeHtml(challenge.title)}</h2>
        <p class="muted" style="margin:0">${escapeHtml(challenge.prompt)}</p>
      </div>
      <div class="card" style="margin-top:12px">
        <div class="field">
          <label for="duel-answer">Your line</label>
          <textarea id="duel-answer" maxlength="400" placeholder="Make it hit..."></textarea>
        </div>
        <button class="btn btn-primary" id="lock-in">Lock in answer</button>
      </div>
    `;

    container.querySelector("#lock-in")?.addEventListener("click", () => {
      const answer = (container.querySelector("#duel-answer") as HTMLTextAreaElement).value;
      if (answer.trim().length < 3) {
        showToast("Need a real answer (3+ chars).");
        return;
      }
      const base = scoreLocal(answer, challenge, state.core, state.streak);
      const full = finalizeRewards(base, state.streak, state.ownedCores);

      if (isP1) {
        duel = {
          ...duel,
          p1: { ...duel.p1, answer, result: full },
          phase: "handoff",
        };
        paint();
        return;
      }

      duel = {
        ...duel,
        p2: { ...duel.p2, answer, result: full },
        phase: "result",
      };

      // Host profile (device owner) gets rewards from the duel outcome.
      const w = duelWinner(duel);
      let next = state;
      if (w === "p1") next = applyDuelWin(state, duel.p1.result!.score);
      else if (w === "p2") next = applyDuelLoss(state, duel.p1.result!.score);
      else {
        next = applyDuelLoss(
          state,
          Math.round((duel.p1.result!.score + duel.p2.result!.score) / 2),
        );
        next = { ...next, sparks: next.sparks + 10 };
        saveState(next);
      }
      onState(next);
      state = next;
      showToast(w === "p1" ? `${duel.p1.name} wins!` : w === "p2" ? `${duel.p2.name} wins!` : "Tie!");
      paint();
    });
  };

  paint();
}
