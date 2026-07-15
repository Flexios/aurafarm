import { getCachedSession } from "../auth/auth";
import { getTodaysChallenge } from "../game/daily";
import {
  applyDuelLoss,
  applyDuelWin,
  claimFriendBattleProgress,
} from "../game/economy";
import {
  createDuelState,
  duelWinner,
  type DuelState,
} from "../game/duel";
import { finalizeRewards, scoreLocal } from "../game/scorer";
import {
  cancelOnlineQueue,
  completeOnlineDuel,
  findOnlineDuel,
  listMyOnlineDuels,
  reportUser,
  submitOnlineDuelAnswer,
  type OnlineDuel,
  type ReportReason,
} from "../duels/onlineApi";
import {
  createFriendBattle,
  formatFriendshipDuration,
  listFriendBattles,
  listFriends,
  submitFriendBattleAnswer,
  completeFriendBattle,
  type FriendBattle,
  type FriendRow,
} from "../friends/api";
import { CHALLENGES } from "../data/challenges";
import { t } from "../i18n";
import { loadState, saveState } from "../state/store";
import type { AestheticCore, Challenge, PlayerState } from "../types";
import { pickDaily } from "../utils/seed";
import { escapeHtml, formatNumber } from "../utils/format";
import { showToast } from "./toast";

type DuelTab = "online" | "friends" | "local";

function avatarHtml(url: string | null | undefined, name: string): string {
  const initial = (name || "?").slice(0, 1).toUpperCase();
  if (url) return `<img class="avatar avatar-sm" src="${escapeHtml(url)}" alt="" />`;
  return `<div class="avatar avatar-sm avatar-fallback" aria-hidden="true">${escapeHtml(initial)}</div>`;
}

export function renderDuel(
  container: HTMLElement,
  state: PlayerState,
  onState: (s: PlayerState) => void,
): void {
  let tab: DuelTab = "online";
  let duel: DuelState = createDuelState();
  let friends: FriendRow[] = [];
  let battles: FriendBattle[] = [];
  let friendsLoading = false;
  let busy = false;
  let error = "";
  let challengeFriend: FriendRow | null = null;
  let challengeNonce = Date.now();
  let replyBattleId: string | null = null;
  let onlineDuels: OnlineDuel[] = [];
  let onlineSearching = false;
  let onlineLoading = false;
  let onlineAnswerId: string | null = null;
  let onlineResultId: string | null = null;
  let reportDuelId: string | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  const me = getCachedSession();
  const myId = me?.userId ?? "";

  const stopPoll = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const startPoll = () => {
    stopPoll();
    pollTimer = setInterval(() => {
      if (tab === "online" && onlineSearching) void loadOnline(true);
    }, 2500);
  };

  const loadOnline = async (silent = false) => {
    if (!silent) onlineLoading = true;
    if (!silent) paint();
    const res = await listMyOnlineDuels();
    onlineDuels = res.duels;
    onlineSearching = res.searching;

    // Auto-complete open duels (neutral scoring — same core for both answers).
    // complete_online_duel awards BOTH players' cloud game_state.
    let completedAny = false;
    for (const d of onlineDuels) {
      if (
        d.status === "open" &&
        d.player1Answer &&
        d.player2Answer &&
        (d.player1Score == null || d.player2Score == null)
      ) {
        const ch = {
          id: "online-duel",
          category: "caption" as const,
          title: d.challengeTitle,
          prompt: d.challengePrompt,
          hint: "",
          emoji: "🎯",
        };
        // Neutral core so the completer's aesthetic doesn't bias both scores
        const s1 = scoreLocal(d.player1Answer, ch, "main-character", 0).score;
        const s2 = scoreLocal(d.player2Answer, ch, "main-character", 0).score;
        const done = await completeOnlineDuel(d.id, s1, s2);
        if (done.ok) completedAny = true;
      } else if (
        d.status === "complete" &&
        d.player1Score != null &&
        d.player2Score != null
      ) {
        // Ensure server claims both profiles even if completed before reward patch
        const claimKey = `online:${d.id}`;
        if (!state.claimedFriendBattleIds.includes(claimKey)) {
          await completeOnlineDuel(d.id, d.player1Score, d.player2Score);
          completedAny = true;
        }
      }
    }

    // Pull cloud rewards (both accounts get credit server-side)
    if (completedAny) {
      const fresh = await loadState();
      state = fresh;
      onState(fresh);
      showToast("Online duel results counted toward Duels");
    } else {
      // Legacy / friend-style local claim if cloud claim not present yet
      let next = state;
      let anyClaim = false;
      for (const d of onlineDuels) {
        if (d.status !== "complete") continue;
        if (d.player1Score == null || d.player2Score == null) continue;
        const claimKey = `online:${d.id}`;
        if (next.claimedFriendBattleIds.includes(claimKey)) continue;
        const iAmP1 = d.player1Id === myId;
        const myScore = iAmP1 ? d.player1Score : d.player2Score;
        const theirScore = iAmP1 ? d.player2Score : d.player1Score;
        const claim = claimFriendBattleProgress(next, claimKey, myScore, theirScore);
        if (claim.claimed) {
          next = claim.state;
          anyClaim = true;
        }
      }
      if (anyClaim) {
        state = next;
        onState(next);
        showToast("Online duel results counted toward Duels");
      }
    }

    // Refresh after completes
    const refreshed = await listMyOnlineDuels();
    onlineDuels = refreshed.duels;
    onlineSearching = refreshed.searching;
    onlineLoading = false;
    if (onlineSearching) startPoll();
    else stopPoll();
    paint();
  };

  const loadFriends = async () => {
    friendsLoading = true;
    paint();
    const [f, b] = await Promise.all([listFriends(), listFriendBattles()]);
    friends = f;
    battles = b;
    // Claim any completed friend battles toward duel progress
    let next = state;
    let any = false;
    for (const battle of battles) {
      if (battle.status !== "complete") continue;
      if (battle.challengerScore == null || battle.opponentScore == null) continue;
      if (next.claimedFriendBattleIds.includes(battle.id)) continue;
      const iAmChallenger = battle.challengerId === myId;
      const myScore = iAmChallenger
        ? battle.challengerScore
        : battle.opponentScore;
      const theirScore = iAmChallenger
        ? battle.opponentScore
        : battle.challengerScore;
      const res = claimFriendBattleProgress(next, battle.id, myScore, theirScore);
      if (res.claimed) {
        next = res.state;
        any = true;
      }
    }
    if (any) {
      state = next;
      onState(next);
      showToast("Friend battle results counted toward Duels");
    }
    friendsLoading = false;
    paint();
  };

  const paint = () => {
    // Local duel in progress takes over full view
    if (tab === "local" && duel.phase !== "setup") {
      paintLocalFlow();
      return;
    }

    container.innerHTML = `
      <div class="segmented">
        <button type="button" data-tab="online" class="${tab === "online" ? "active" : ""}">${t("duel.online")}</button>
        <button type="button" data-tab="friends" class="${tab === "friends" ? "active" : ""}">${t("duel.friends")}</button>
        <button type="button" data-tab="local" class="${tab === "local" ? "active" : ""}">${t("duel.local")}</button>
      </div>
      <p class="muted" style="margin:0 0 12px;font-size:0.88rem">
        ${t("duel.winsLine", { n: state.duelWins })}
      </p>
      ${error ? `<p class="danger-text" style="margin:0 0 12px">${escapeHtml(error)}</p>` : ""}
      <div id="duel-body"></div>
    `;

    container.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        tab = btn.dataset.tab as DuelTab;
        error = "";
        challengeFriend = null;
        replyBattleId = null;
        onlineAnswerId = null;
        onlineResultId = null;
        reportDuelId = null;
        if (tab !== "online") stopPoll();
        paint();
        if (tab === "friends") void loadFriends();
        if (tab === "online") void loadOnline();
      });
    });

    const body = container.querySelector("#duel-body")!;
    if (tab === "local") paintLocalSetup(body);
    else if (tab === "friends") paintFriends(body);
    else paintOnline(body);
  };

  const paintOnline = (body: Element) => {
    if (onlineLoading) {
      body.innerHTML = `<p class="muted">Loading online duels…</p>`;
      return;
    }

    if (onlineAnswerId) {
      paintOnlineAnswer(body);
      return;
    }

    if (reportDuelId) {
      paintOnlineReport(body);
      return;
    }

    if (onlineResultId) {
      paintOnlineResult(body);
      return;
    }

    const open = onlineDuels.filter((d) => d.status === "open");
    const done = onlineDuels.filter((d) => d.status === "complete").slice(0, 10);
    const challenge = getTodaysChallenge();

    body.innerHTML = `
      <div class="card stack">
        <p class="muted" style="margin:0">${t("duel.onlineBlurb")}</p>
        <p class="muted" style="margin:0;font-size:0.88rem">
          ${t("duel.todaysVibe", { emoji: challenge.emoji, title: challenge.title })}
        </p>
        ${
          onlineSearching
            ? `<p class="success-text" style="margin:0">${t("duel.searching")}</p>
               <button type="button" class="btn btn-secondary" id="cancel-queue" ${busy ? "disabled" : ""}>${t("duel.cancelSearch")}</button>`
            : `<button type="button" class="btn btn-fill" id="find-match" ${busy ? "disabled" : ""}>${t("duel.find")}</button>`
        }
      </div>

      <div class="section-header">${t("duel.active")}</div>
      ${
        open.length === 0
          ? `<div class="card"><p class="muted" style="margin:0">${t("duel.noOpen")}</p></div>`
          : `<div class="inset-group">${open
              .map((d) => {
                const iAmP1 = d.player1Id === myId;
                const opp = iAmP1 ? d.player2Username : d.player1Username;
                const myAns = iAmP1 ? d.player1Answer : d.player2Answer;
                let status = t("duel.yourTurn");
                if (myAns && !(iAmP1 ? d.player2Answer : d.player1Answer)) status = t("duel.waiting");
                else if (!myAns && (iAmP1 ? d.player2Answer : d.player1Answer)) status = t("duel.yourTurn");
                else if (myAns && (iAmP1 ? d.player2Answer : d.player1Answer)) status = t("duel.scoring");
                return `
              <div class="list-row">
                <div class="meta">
                  <strong>${escapeHtml(d.challengeTitle)}</strong>
                  <span>${t("duel.vs", { user: opp })} · ${escapeHtml(status)}</span>
                </div>
                ${
                  !myAns
                    ? `<button type="button" class="btn btn-fill btn-sm" data-online-ans="${escapeHtml(d.id)}">${t("duel.answer")}</button>`
                    : ""
                }
              </div>`;
              })
              .join("")}</div>`
      }

      <div class="section-header">${t("duel.recent")}</div>
      ${
        done.length === 0
          ? `<div class="card"><p class="muted" style="margin:0">${t("duel.noRecent")}</p></div>`
          : `<div class="inset-group">${done
              .map((d) => {
                const iAmP1 = d.player1Id === myId;
                const opp = iAmP1 ? d.player2Username : d.player1Username;
                const myScore = iAmP1 ? d.player1Score : d.player2Score;
                const theirScore = iAmP1 ? d.player2Score : d.player1Score;
                let result = t("duel.tie");
                if (myScore != null && theirScore != null) {
                  if (myScore > theirScore) result = t("duel.youWon");
                  else if (myScore < theirScore) result = t("duel.theyWon");
                }
                return `
              <div class="list-row">
                <div class="meta">
                  <strong>${escapeHtml(d.challengeTitle)}</strong>
                  <span>${t("duel.vs", { user: opp })} · ${escapeHtml(result)} · ${myScore ?? "—"}–${theirScore ?? "—"}</span>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" data-online-view="${escapeHtml(d.id)}">${t("duel.view")}</button>
              </div>`;
              })
              .join("")}</div>`
      }
    `;

    body.querySelector("#find-match")?.addEventListener("click", async () => {
      busy = true;
      error = "";
      paint();
      const ch = getTodaysChallenge();
      const res = await findOnlineDuel(ch.title, ch.prompt);
      busy = false;
      if (!res.ok) {
        error = res.error;
        paint();
        return;
      }
      if (res.status === "matched") {
        showToast("Matched! Answer the prompt.");
        onlineSearching = false;
        stopPoll();
        void loadOnline();
        return;
      }
      onlineSearching = true;
      showToast("In queue — waiting for someone…");
      startPoll();
      void loadOnline();
    });

    body.querySelector("#cancel-queue")?.addEventListener("click", async () => {
      busy = true;
      paint();
      await cancelOnlineQueue();
      busy = false;
      onlineSearching = false;
      stopPoll();
      showToast("Left the queue");
      void loadOnline();
    });

    body.querySelectorAll<HTMLButtonElement>("[data-online-ans]").forEach((btn) => {
      btn.addEventListener("click", () => {
        onlineAnswerId = btn.dataset.onlineAns!;
        paint();
      });
    });

    body.querySelectorAll<HTMLButtonElement>("[data-online-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        onlineResultId = btn.dataset.onlineView!;
        paint();
      });
    });
  };

  const paintOnlineResult = (body: Element) => {
    const d = onlineDuels.find((x) => x.id === onlineResultId && x.status === "complete");
    if (!d) {
      onlineResultId = null;
      paint();
      return;
    }
    const iAmP1 = d.player1Id === myId;
    const opp = iAmP1 ? d.player2Username : d.player1Username;
    const myAnswer = iAmP1 ? d.player1Answer : d.player2Answer;
    const theirAnswer = iAmP1 ? d.player2Answer : d.player1Answer;
    const myScore = iAmP1 ? d.player1Score : d.player2Score;
    const theirScore = iAmP1 ? d.player2Score : d.player1Score;
    let outcome = t("duel.tie");
    if (myScore != null && theirScore != null) {
      if (myScore > theirScore) outcome = t("duel.youWon");
      else if (myScore < theirScore) outcome = t("duel.theyWon");
    }

    body.innerHTML = `
      <button type="button" class="btn btn-plain" id="online-back">${t("duel.back")}</button>
      <div class="section-header">${t("duel.result")}</div>
      <div class="card stack">
        <p style="margin:0;font-weight:600;font-size:1.05rem">${escapeHtml(outcome)}</p>
        <p class="muted" style="margin:0"><strong>${escapeHtml(d.challengeTitle)}</strong></p>
        <p class="muted" style="margin:0">${escapeHtml(d.challengePrompt)}</p>
        <div class="battle-answers">
          <div class="battle-answer-card mine">
            <div class="battle-answer-label">${t("common.you")} · ${myScore ?? "—"} pts</div>
            <p class="battle-answer-body">${escapeHtml(myAnswer || "—")}</p>
          </div>
          <div class="battle-answer-card theirs">
            <div class="battle-answer-label">@${escapeHtml(opp)} · ${theirScore ?? "—"} pts</div>
            <p class="battle-answer-body">${escapeHtml(theirAnswer || "—")}</p>
          </div>
        </div>
        <button type="button" class="btn btn-secondary" id="online-report" ${busy ? "disabled" : ""}>
          ${t("duel.report", { user: opp })}
        </button>
      </div>
    `;

    body.querySelector("#online-back")?.addEventListener("click", () => {
      onlineResultId = null;
      paint();
    });
    body.querySelector("#online-report")?.addEventListener("click", () => {
      reportDuelId = d.id;
      onlineResultId = null;
      paint();
    });
  };

  const paintOnlineReport = (body: Element) => {
    const d = onlineDuels.find((x) => x.id === reportDuelId);
    if (!d) {
      reportDuelId = null;
      paint();
      return;
    }
    const iAmP1 = d.player1Id === myId;
    const opp = iAmP1 ? d.player2Username : d.player1Username;

    body.innerHTML = `
      <button type="button" class="btn btn-plain" id="online-back">${t("duel.back")}</button>
      <div class="section-header">${t("duel.reportTitle", { user: opp })}</div>
      <div class="card stack">
        <p class="muted" style="margin:0">${t("duel.reportBlurb")}</p>
        <div class="field">
          <label for="report-reason">${t("duel.reason")}</label>
          <select id="report-reason">
            <option value="spam">Spam</option>
            <option value="harassment">Harassment</option>
            <option value="inappropriate">Inappropriate</option>
            <option value="cheating">Cheating</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="field">
          <label for="report-details">${t("duel.details")}</label>
          <textarea id="report-details" maxlength="500" rows="3"></textarea>
        </div>
        <button type="button" class="btn btn-danger" id="report-send" ${busy ? "disabled" : ""}>${t("duel.submitReport")}</button>
      </div>
    `;

    body.querySelector("#online-back")?.addEventListener("click", () => {
      reportDuelId = null;
      onlineResultId = d.id;
      paint();
    });
    body.querySelector("#report-send")?.addEventListener("click", async () => {
      const reason = (body.querySelector("#report-reason") as HTMLSelectElement)
        .value as ReportReason;
      const details = (body.querySelector("#report-details") as HTMLTextAreaElement).value;
      busy = true;
      error = "";
      paint();
      const res = await reportUser({
        reportedUsername: opp,
        reason,
        details,
        duelId: d.id,
      });
      busy = false;
      if (!res.ok) {
        error = res.error;
        reportDuelId = d.id;
        paint();
        return;
      }
      showToast("Report submitted");
      reportDuelId = null;
      onlineResultId = d.id;
      paint();
    });
  };

  const paintOnlineAnswer = (body: Element) => {
    const d = onlineDuels.find((x) => x.id === onlineAnswerId);
    if (!d) {
      onlineAnswerId = null;
      paint();
      return;
    }
    const iAmP1 = d.player1Id === myId;
    const opp = iAmP1 ? d.player2Username : d.player1Username;

    body.innerHTML = `
      <button type="button" class="btn btn-plain" id="online-back">← Back</button>
      <div class="section-header">Online duel vs @${escapeHtml(opp)}</div>
      <div class="card stack">
        <p class="muted" style="margin:0"><strong>${escapeHtml(d.challengeTitle)}</strong></p>
        <p class="muted" style="margin:0">${escapeHtml(d.challengePrompt)}</p>
        <div class="field">
          <label for="online-answer">Your answer</label>
          <textarea id="online-answer" maxlength="400" rows="4" placeholder="Drop your line…"></textarea>
        </div>
        <button type="button" class="btn btn-fill" id="online-submit" ${busy ? "disabled" : ""}>Submit answer</button>
      </div>
    `;

    body.querySelector("#online-back")?.addEventListener("click", () => {
      onlineAnswerId = null;
      paint();
    });
    body.querySelector("#online-submit")?.addEventListener("click", async () => {
      const answer = (body.querySelector("#online-answer") as HTMLTextAreaElement).value;
      busy = true;
      error = "";
      paint();
      const res = await submitOnlineDuelAnswer(d.id, answer);
      busy = false;
      if (!res.ok) {
        error = res.error;
        onlineAnswerId = d.id;
        paint();
        return;
      }
      showToast("Answer submitted");
      onlineAnswerId = null;
      void loadOnline();
    });
  };

  const paintLocalSetup = (body: Element) => {
    body.innerHTML = `
      <div class="card stack">
        <p class="muted" style="margin:0">Pass-and-play on one device. Same prompt — higher score wins Sparks and duel progress.</p>
        <div class="field">
          <label for="p1">Player 1</label>
          <input id="p1" maxlength="16" value="${escapeHtml(state.displayName || "Player 1")}" />
        </div>
        <div class="field">
          <label for="p2">Player 2</label>
          <input id="p2" maxlength="16" value="Challenger" />
        </div>
        <button class="btn btn-fill" id="start-duel">Start local duel</button>
      </div>
    `;
    body.querySelector("#start-duel")?.addEventListener("click", () => {
      const p1 = (body.querySelector("#p1") as HTMLInputElement).value.trim() || "Player 1";
      const p2 = (body.querySelector("#p2") as HTMLInputElement).value.trim() || "Player 2";
      duel = {
        ...createDuelState(),
        phase: "p1",
        challenge: getTodaysChallenge(),
        p1: { name: p1, answer: "", result: null },
        p2: { name: p2, answer: "", result: null },
      };
      paint();
    });
  };

  const paintFriends = (body: Element) => {
    if (friendsLoading) {
      body.innerHTML = `<p class="muted">Loading friend battles…</p>`;
      return;
    }

    if (replyBattleId) {
      paintReply(body);
      return;
    }

    if (challengeFriend) {
      paintChallenge(body);
      return;
    }

    const pending = battles.filter(
      (b) =>
        b.status === "open" &&
        b.opponentId === myId &&
        !b.opponentAnswer,
    );
    const waiting = battles.filter(
      (b) =>
        b.status === "open" &&
        b.challengerId === myId &&
        !b.opponentAnswer,
    );
    const recent = battles
      .filter((b) => b.status === "complete")
      .slice(0, 8);

    body.innerHTML = `
      ${error ? `<p class="danger-text" style="margin:0 0 12px">${escapeHtml(error)}</p>` : ""}

      <div class="section-header">Your turn${pending.length ? ` · ${pending.length}` : ""}</div>
      ${
        pending.length === 0
          ? `<div class="card"><p class="muted" style="margin:0">No pending friend battles.</p></div>`
          : `<div class="inset-group">${pending
              .map(
                (b) => `
            <div class="list-row">
              <div class="meta">
                <strong>${escapeHtml(b.challengeTitle)}</strong>
                <span>from @${escapeHtml(
                  b.challengerId === myId
                    ? b.opponentUsername
                    : b.challengerUsername,
                )}</span>
              </div>
              <button type="button" class="btn btn-fill btn-sm" data-reply="${escapeHtml(b.id)}">Reply</button>
            </div>`,
              )
              .join("")}</div>`
      }

      <div class="section-header">Waiting on them</div>
      ${
        waiting.length === 0
          ? `<div class="card"><p class="muted" style="margin:0">Nothing waiting.</p></div>`
          : `<div class="inset-group">${waiting
              .map(
                (b) => `
            <div class="list-row">
              <div class="meta">
                <strong>${escapeHtml(b.challengeTitle)}</strong>
                <span>waiting on @${escapeHtml(b.opponentUsername)}</span>
              </div>
            </div>`,
              )
              .join("")}</div>`
      }

      <div class="section-header">Challenge a friend</div>
      ${
        friends.length === 0
          ? `<div class="card"><p class="muted" style="margin:0">Add friends from Profile → Lookup, then battle them here.</p>
             <button type="button" class="btn btn-secondary" id="go-profile" style="margin-top:12px">Open Profile</button></div>`
          : `<div class="inset-group">${friends
              .map(
                (f) => `
            <div class="list-row friend-row">
              ${avatarHtml(f.avatarUrl, f.displayName)}
              <div class="meta">
                <strong>${escapeHtml(f.displayName)}</strong>
                <span>@${escapeHtml(f.username)} · ${escapeHtml(formatFriendshipDuration(f.friendsSince))} · ${formatNumber(f.totalAura)} aura</span>
              </div>
              <button type="button" class="btn btn-fill btn-sm" data-challenge="${escapeHtml(f.userId)}">Battle</button>
            </div>`,
              )
              .join("")}</div>`
      }

      <div class="section-header">Recent results</div>
      ${
        recent.length === 0
          ? `<div class="card"><p class="muted" style="margin:0">No completed friend battles yet.</p></div>`
          : `<div class="inset-group">${recent
              .map((b) => {
                const iAmChallenger = b.challengerId === myId;
                const myScore = iAmChallenger
                  ? b.challengerScore
                  : b.opponentScore;
                const theirScore = iAmChallenger
                  ? b.opponentScore
                  : b.challengerScore;
                const other = iAmChallenger
                  ? b.opponentUsername
                  : b.challengerUsername;
                let result = "Tie";
                if (myScore != null && theirScore != null) {
                  if (myScore > theirScore) result = "You won";
                  else if (myScore < theirScore) result = "They won";
                }
                return `
            <div class="list-row">
              <div class="meta">
                <strong>${escapeHtml(b.challengeTitle)}</strong>
                <span>vs @${escapeHtml(other)} · ${escapeHtml(result)} · ${myScore ?? "—"}–${theirScore ?? "—"}</span>
              </div>
            </div>`;
              })
              .join("")}</div>`
      }
    `;

    body.querySelector("#go-profile")?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("aurafarm:nav", { detail: "profile" }));
    });

    body.querySelectorAll<HTMLButtonElement>("[data-reply]").forEach((btn) => {
      btn.addEventListener("click", () => {
        replyBattleId = btn.dataset.reply!;
        paint();
      });
    });

    body.querySelectorAll<HTMLButtonElement>("[data-challenge]").forEach((btn) => {
      btn.addEventListener("click", () => {
        challengeFriend = friends.find((f) => f.userId === btn.dataset.challenge) ?? null;
        challengeNonce = Date.now();
        paint();
      });
    });
  };

  const paintChallenge = (body: Element) => {
    const f = challengeFriend!;
    const challenge = pickDaily(CHALLENGES, `friend-battle-${challengeNonce}`, new Date());

    body.innerHTML = `
      <button type="button" class="btn btn-plain" id="back-friends">← Back</button>
      ${error ? `<p class="danger-text" style="margin:12px 0">${escapeHtml(error)}</p>` : ""}
      <div class="section-header">Battle @${escapeHtml(f.username)}</div>
      <div class="card stack">
        <div class="battle-task-header">
          <div>
            <p class="muted" style="margin:0"><strong>${escapeHtml(challenge.title)}</strong></p>
            <p class="muted" style="margin:6px 0 0">${escapeHtml(challenge.prompt)}</p>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="refresh-task" ${busy ? "disabled" : ""}>Refresh task</button>
        </div>
        <div class="field">
          <label for="battle-answer">Your answer</label>
          <textarea id="battle-answer" maxlength="400" rows="4" placeholder="Drop your line…"></textarea>
        </div>
        <button class="btn btn-fill" id="send-battle" ${busy ? "disabled" : ""}>Send battle</button>
      </div>
    `;

    body.querySelector("#back-friends")?.addEventListener("click", () => {
      challengeFriend = null;
      error = "";
      paint();
    });
    body.querySelector("#refresh-task")?.addEventListener("click", () => {
      challengeNonce = Date.now() + Math.floor(Math.random() * 999);
      paint();
    });
    body.querySelector("#send-battle")?.addEventListener("click", async () => {
      const answer = (body.querySelector("#battle-answer") as HTMLTextAreaElement).value;
      const ch = pickDaily(CHALLENGES, `friend-battle-${challengeNonce}`, new Date());
      busy = true;
      paint();
      const res = await createFriendBattle(f.userId, ch.title, ch.prompt, answer);
      busy = false;
      if (!res.ok) {
        error = res.error;
        paint();
        return;
      }
      showToast("Battle sent!");
      challengeFriend = null;
      error = "";
      void loadFriends();
    });
  };

  const paintReply = (body: Element) => {
    const b = battles.find((x) => x.id === replyBattleId);
    if (!b) {
      replyBattleId = null;
      paint();
      return;
    }

    body.innerHTML = `
      <button type="button" class="btn btn-plain" id="back-friends">← Back</button>
      ${error ? `<p class="danger-text" style="margin:12px 0">${escapeHtml(error)}</p>` : ""}
      <div class="section-header">Your turn</div>
      <div class="card stack">
        <p class="muted" style="margin:0"><strong>${escapeHtml(b.challengeTitle)}</strong></p>
        <p class="muted" style="margin:0">${escapeHtml(b.challengePrompt)}</p>
        <div class="field">
          <label for="ans">Your answer</label>
          <textarea id="ans" maxlength="400" rows="4" placeholder="Drop your line…"></textarea>
        </div>
        <button class="btn btn-fill" id="submit-ans" ${busy ? "disabled" : ""}>Submit & score</button>
      </div>
    `;

    body.querySelector("#back-friends")?.addEventListener("click", () => {
      replyBattleId = null;
      error = "";
      paint();
    });
    body.querySelector("#submit-ans")?.addEventListener("click", async () => {
      const answer = (body.querySelector("#ans") as HTMLTextAreaElement).value;
      busy = true;
      error = "";
      paint();
      const res = await submitFriendBattleAnswer(b.id, answer);
      if (!res.ok) {
        busy = false;
        error = res.error;
        paint();
        return;
      }
      if (b.challengerAnswer) {
        const ch: Challenge = {
          id: "friend-battle",
          category: "caption",
          title: b.challengeTitle,
          prompt: b.challengePrompt,
          hint: "",
          emoji: "🎯",
        };
        const cScore = scoreLocal(
          b.challengerAnswer,
          ch,
          state.core as AestheticCore,
          0,
        ).score;
        const oScore = scoreLocal(answer, ch, state.core as AestheticCore, 0).score;
        await completeFriendBattle(b.id, cScore, oScore);
        const claim = claimFriendBattleProgress(state, b.id, oScore, cScore);
        if (claim.claimed) {
          state = claim.state;
          onState(state);
          showToast(
            claim.outcome === "win"
              ? "You won — duel progress updated!"
              : claim.outcome === "loss"
                ? "They won this round"
                : "Tie — small rewards banked",
          );
        }
      }
      busy = false;
      replyBattleId = null;
      void loadFriends();
    });
  };

  const paintLocalFlow = () => {
    if (duel.phase === "handoff") {
      container.innerHTML = `
        <div class="card handoff">
          <div class="big">→</div>
          <h2 style="margin:0">Pass the Device</h2>
          <p class="muted">${escapeHtml(duel.p1.name)} finished. Hand the device to <strong>${escapeHtml(duel.p2.name)}</strong>.</p>
          <button class="btn btn-fill" id="p2-ready">Continue as ${escapeHtml(duel.p2.name)}</button>
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
          <div class="muted" style="font-weight:600;font-size:0.84rem">Result</div>
          <div class="hero-score" style="font-size:2rem">
            ${
              winner === "tie"
                ? "Tie"
                : winner === "p1"
                  ? escapeHtml(duel.p1.name)
                  : escapeHtml(duel.p2.name)
            }
          </div>
          <p class="verdict">${winner === "tie" ? "Even scores." : "wins the duel."}</p>
          <div class="stat-grid">
            <div class="stat"><b>${duel.p1.result.score}</b><span>${escapeHtml(duel.p1.name)}</span></div>
            <div class="stat"><b>vs</b><span>Score</span></div>
            <div class="stat"><b>${duel.p2.result.score}</b><span>${escapeHtml(duel.p2.name)}</span></div>
          </div>
          <p class="muted" style="margin:12px 0 0;font-size:0.88rem">Your duel total: ${state.duelWins}</p>
          <div class="btn-row">
            <button class="btn btn-fill" id="rematch">Rematch</button>
            <button class="btn btn-secondary" id="duel-done">Done</button>
          </div>
        </div>
      `;
      container.querySelector("#rematch")?.addEventListener("click", () => {
        duel = createDuelState();
        paint();
      });
      container.querySelector("#duel-done")?.addEventListener("click", () => {
        duel = createDuelState();
        tab = "friends";
        paint();
        void loadFriends();
      });
      return;
    }

    const isP1 = duel.phase === "p1";
    const player = isP1 ? duel.p1 : duel.p2;
    const challenge = duel.challenge!;

    container.innerHTML = `
      <div class="desktop-grid play-grid">
      <div class="card home-panel">
        <div class="muted" style="font-weight:600;font-size:0.84rem">${isP1 ? "Player 1" : "Player 2"} · ${escapeHtml(player.name)}</div>
        <div class="challenge-emoji">${challenge.emoji}</div>
        <h2 style="margin:0 0 6px;font-size:1.2rem">${escapeHtml(challenge.title)}</h2>
        <p class="muted" style="margin:0">${escapeHtml(challenge.prompt)}</p>
      </div>
      <div class="card home-panel">
        <div class="field">
          <label for="duel-answer">Answer</label>
          <textarea id="duel-answer" maxlength="400" placeholder="Your response…"></textarea>
        </div>
        <button class="btn btn-fill" id="lock-in" style="margin-top:auto">Lock In</button>
      </div>
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
  void loadOnline();

  // Cleanup poll if the shell re-renders away from this screen
  const observer = new MutationObserver(() => {
    if (!container.isConnected) {
      stopPoll();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
