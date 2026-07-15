import { getCachedSession } from "../auth/auth";
import { aestheticById } from "../data/aesthetics";
import { rankForAura } from "../data/ranks";
import { pickChallenge } from "../game/daily";
import { claimFriendBattleProgress } from "../game/economy";
import { scoreLocal } from "../game/scorer";
import {
  completeFriendBattle,
  createFriendBattle,
  formatFriendshipDuration,
  getFriendNote,
  listFriendBattles,
  listFriendDms,
  saveFriendNote,
  sendFriendDm,
  submitFriendBattleAnswer,
  type DmMessage,
  type FriendBattle,
  type FriendRow,
} from "../friends/api";
import { fetchPublicProfile, type PublicProfile } from "../profile/api";
import type { AestheticCore, Challenge, PlayerState } from "../types";
import { localizeChallenge, localizeChallengeTitle } from "../i18n";
import { escapeHtml, formatNumber } from "../utils/format";
import { collectiblesHtml } from "./collectibles";
import { showToast } from "./toast";

function avatarHtml(url: string | null | undefined, name: string): string {
  const initial = (name || "?").slice(0, 1).toUpperCase();
  if (url) return `<img class="avatar" src="${escapeHtml(url)}" alt="" />`;
  return `<div class="avatar avatar-fallback" aria-hidden="true">${escapeHtml(initial)}</div>`;
}

/** Pick a battle prompt; change nonce to “refresh” a new task. */
function getBattleChallenge(nonce: number, includeNsfw: boolean): Challenge {
  return pickChallenge(`friend-battle-${nonce}`, includeNsfw);
}

function friendBattleRecord(
  battles: FriendBattle[],
  myId: string,
  friendId: string,
): { wins: number; losses: number; ties: number; played: number } {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  for (const b of battles) {
    if (b.status !== "complete") continue;
    if (b.challengerId !== friendId && b.opponentId !== friendId) continue;
    if (b.challengerScore == null || b.opponentScore == null) continue;
    const iAmChallenger = b.challengerId === myId;
    const myScore = iAmChallenger ? b.challengerScore : b.opponentScore;
    const theirScore = iAmChallenger ? b.opponentScore : b.challengerScore;
    if (myScore > theirScore) wins++;
    else if (myScore < theirScore) losses++;
    else ties++;
  }
  return { wins, losses, ties, played: wins + losses + ties };
}

type PanelMode = "menu" | "dm" | "battle-new" | "battle-reply" | "battle-result";

/**
 * Friend detail: rich public stats, duration, inline private note, DM, battles, W/L.
 */
export async function renderFriendPanel(
  container: HTMLElement,
  friend: FriendRow,
  state: PlayerState,
  onBack: () => void,
  onState?: (s: PlayerState) => void,
): Promise<void> {
  const me = getCachedSession();
  const myId = me?.userId ?? "";
  let mode: PanelMode = "menu";
  let note = "";
  let publicProf: PublicProfile | null = null;
  let messages: DmMessage[] = [];
  let battles: FriendBattle[] = [];
  let busy = false;
  let error = "";
  let success = "";
  /** When set, battle-reply shows only this open battle. */
  let replyBattleId: string | null = null;
  /** When set, battle-result shows this completed battle. */
  let resultBattleId: string | null = null;
  /** Salt for rolling a new challenge task. */
  let challengeNonce = Date.now();
  let player = state;

  const load = async () => {
    const [n, msgs, allBattles, prof] = await Promise.all([
      getFriendNote(friend.userId),
      listFriendDms(friend.userId),
      listFriendBattles(),
      fetchPublicProfile(friend.username),
    ]);
    note = n;
    messages = msgs;
    battles = allBattles.filter(
      (b) => b.challengerId === friend.userId || b.opponentId === friend.userId,
    );
    publicProf = prof;
  };

  /** Credit duel progress for any completed battles not yet claimed. */
  const claimPendingRewards = () => {
    for (const b of battles) {
      if (b.status !== "complete") continue;
      if (b.challengerScore == null || b.opponentScore == null) continue;
      if (player.claimedFriendBattleIds.includes(b.id)) continue;
      const iAmChallenger = b.challengerId === myId;
      const myScore = iAmChallenger ? b.challengerScore : b.opponentScore;
      const theirScore = iAmChallenger ? b.opponentScore : b.challengerScore;
      const res = claimFriendBattleProgress(player, b.id, myScore, theirScore);
      if (res.claimed) {
        player = res.state;
        onState?.(player);
        if (res.outcome === "win") {
          showToast("Friend battle win counted toward Duels!");
        }
      }
    }
  };

  await load();
  claimPendingRewards();

  const paint = () => {
    const banner =
      error
        ? `<p class="danger-text" style="margin:0 0 12px">${escapeHtml(error)}</p>`
        : success
          ? `<p class="success-text" style="margin:0 0 12px">${escapeHtml(success)}</p>`
          : "";

    if (mode === "dm") {
      paintDm(banner);
      return;
    }
    if (mode === "battle-new") {
      paintBattleNew(banner);
      return;
    }
    if (mode === "battle-reply") {
      paintBattleReply(banner);
      return;
    }
    if (mode === "battle-result") {
      paintBattleResult(banner);
      return;
    }

    paintMenu(banner);
  };

  const paintMenu = (banner: string) => {
    const wl = friendBattleRecord(battles, myId, friend.userId);
    const wlLabel =
      wl.played === 0
        ? "No battles yet"
        : `${wl.wins}W · ${wl.losses}L${wl.ties ? ` · ${wl.ties}T` : ""}`;
    const wlRatio =
      wl.played === 0
        ? ""
        : ` · ${(wl.wins / wl.played * 100).toFixed(0)}% win rate`;

    const aura = publicProf?.totalAura ?? friend.totalAura;
    const coreId = (publicProf?.core || friend.core || "main-character") as AestheticCore;
    const aesthetic = aestheticById(coreId);
    const rank = rankForAura(aura);
    const streak = publicProf?.streak ?? 0;
    const duelWins = publicProf?.duelWins ?? 0;
    const best = publicProf?.bestDailyScore ?? 0;
    const bp = publicProf?.battlePassLevel ?? 0;
    const cores = publicProf?.coresCount ?? 0;
    const bio = publicProf?.bio ?? null;
    const avatar = publicProf?.avatarUrl ?? friend.avatarUrl;
    const displayName = publicProf?.displayName || friend.displayName;

    container.innerHTML = `
      <button type="button" class="btn btn-plain" id="friend-back" style="align-self:flex-start">← Friends</button>
      ${banner}
      <div class="card profile-hero" style="margin-top:8px">
        <div class="profile-hero-row">
          ${avatarHtml(avatar, displayName)}
          <div class="profile-hero-meta">
            <h2 style="margin:0;font-size:1.25rem">${escapeHtml(displayName)}</h2>
            <p class="muted" style="margin:4px 0 0">@${escapeHtml(friend.username)}</p>
            <div class="tag-row" style="margin-top:8px">
              <span class="tag">${rank.emoji} ${escapeHtml(rank.name)}</span>
              <span class="tag magenta">${aesthetic.emoji} ${escapeHtml(aesthetic.label)}</span>
            </div>
            <p class="muted" style="margin:8px 0 0;font-size:0.88rem;font-weight:600;color:var(--accent)">
              ${escapeHtml(formatFriendshipDuration(friend.friendsSince))}
            </p>
            <p class="muted" style="margin:6px 0 0;font-size:0.84rem;font-weight:600">
              vs you: ${escapeHtml(wlLabel)}${escapeHtml(wlRatio)}
            </p>
          </div>
        </div>
        <div class="friend-bio">
          ${
            bio
              ? `<p class="friend-bio-text">${escapeHtml(bio)}</p>`
              : `<p class="muted" style="margin:0;font-size:0.9rem">No bio yet.</p>`
          }
        </div>
        <div class="stat-grid" style="margin-top:14px">
          <div class="stat"><b>${formatNumber(aura)}</b><span>Aura</span></div>
          <div class="stat"><b>🔥 ${streak}</b><span>Streak</span></div>
          <div class="stat"><b>${duelWins}</b><span>Duels</span></div>
        </div>
        <div class="stat-grid" style="margin-top:8px">
          <div class="stat"><b>${best || "—"}</b><span>Best daily</span></div>
          <div class="stat"><b>${bp}/10</b><span>Pass</span></div>
          <div class="stat"><b>${cores}</b><span>Cores</span></div>
        </div>
        <div class="friend-quick-actions">
          <button type="button" class="btn btn-fill btn-sm" id="open-dm">Message</button>
          <button type="button" class="btn btn-secondary btn-sm" id="open-battle">New battle</button>
        </div>
      </div>

      <div class="section-header">Collectibles · ${publicProf?.ownedCores?.length ?? cores}</div>
      ${collectiblesHtml(publicProf?.ownedCores, "No collectibles yet.")}

      <div class="section-header">Private note</div>
      <div class="card stack">
        <p class="muted" style="margin:0;font-size:0.84rem">Only you can see this note about @${escapeHtml(friend.username)}.</p>
        <div class="field">
          <label for="note-input">Note</label>
          <textarea id="note-input" maxlength="500" rows="3" placeholder="Reminders, context…">${escapeHtml(note)}</textarea>
        </div>
        <button class="btn btn-secondary btn-sm" id="note-save" ${busy ? "disabled" : ""} style="align-self:flex-start">Save note</button>
      </div>

      ${
        battles.length
          ? `<div class="section-header">Battles</div>
             <div class="inset-group">
               ${battles
                 .slice(0, 12)
                 .map((b) => battleRow(b, myId))
                 .join("")}
             </div>`
          : `<div class="section-header">Battles</div>
             <div class="card"><p class="muted" style="margin:0">No battles yet. Start one!</p></div>`
      }
    `;

    container.querySelector("#friend-back")?.addEventListener("click", onBack);
    container.querySelector("#open-dm")?.addEventListener("click", () => {
      mode = "dm";
      error = "";
      success = "";
      paint();
    });
    container.querySelector("#open-battle")?.addEventListener("click", () => {
      mode = "battle-new";
      challengeNonce = Date.now();
      error = "";
      success = "";
      paint();
    });

    container.querySelector("#note-save")?.addEventListener("click", async () => {
      const text = (container.querySelector("#note-input") as HTMLTextAreaElement).value;
      busy = true;
      error = "";
      success = "";
      paint();
      const res = await saveFriendNote(friend.userId, text);
      busy = false;
      if (!res.ok) {
        error = res.error;
        paint();
        return;
      }
      note = text.trim().slice(0, 500);
      showToast("Note saved");
      success = "Note saved (only you can see it).";
      paint();
    });

    container.querySelectorAll<HTMLButtonElement>("[data-answer-battle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        replyBattleId = btn.dataset.answerBattle!;
        mode = "battle-reply";
        error = "";
        success = "";
        paint();
      });
    });

    container.querySelectorAll<HTMLButtonElement>("[data-view-battle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        resultBattleId = btn.dataset.viewBattle!;
        mode = "battle-result";
        error = "";
        success = "";
        paint();
      });
    });
  };

  const battleRow = (b: FriendBattle, uid: string): string => {
    const iAmChallenger = b.challengerId === uid;
    const needAnswer =
      b.status === "open" && !iAmChallenger && !b.opponentAnswer;
    const waitingThem =
      b.status === "open" && iAmChallenger && !b.opponentAnswer;
    const done = b.status === "complete";
    let result = "";
    if (done && b.challengerScore != null && b.opponentScore != null) {
      const myScore = iAmChallenger ? b.challengerScore : b.opponentScore;
      const theirScore = iAmChallenger ? b.opponentScore : b.challengerScore;
      result =
        myScore > theirScore
          ? "You won"
          : myScore < theirScore
            ? "They won"
            : "Tie";
    }
    let statusLine = b.status;
    if (needAnswer) statusLine = "your turn";
    else if (waitingThem) statusLine = "waiting on them";
    else if (done && result) statusLine = result;

    return `
      <div class="list-row">
        <div class="meta">
          <strong>${escapeHtml(localizeChallengeTitle(b.challengeTitle))}</strong>
          <span>${escapeHtml(statusLine)}</span>
        </div>
        ${
          needAnswer
            ? `<button type="button" class="btn btn-fill btn-sm" data-answer-battle="${escapeHtml(b.id)}">Reply</button>`
            : done
              ? `<button type="button" class="btn btn-secondary btn-sm" data-view-battle="${escapeHtml(b.id)}">Results</button>`
              : ""
        }
      </div>
    `;
  };

  const paintDm = (banner: string) => {
    container.innerHTML = `
      <button type="button" class="btn btn-plain" id="friend-back">← Back</button>
      ${banner}
      <div class="section-header">Chat with @${escapeHtml(friend.username)}</div>
      <div class="card dm-thread" id="dm-thread">
        ${
          messages.length === 0
            ? `<p class="muted" style="margin:0;text-align:center">No messages yet. Say hi.</p>`
            : messages
                .map(
                  (m) => `
            <div class="dm-bubble ${m.mine ? "mine" : "theirs"}">
              <div class="dm-body">${escapeHtml(m.body)}</div>
              <div class="dm-time muted">${escapeHtml(formatTime(m.createdAt))}</div>
            </div>`,
                )
                .join("")
        }
      </div>
      <div class="card stack" style="margin-top:12px">
        <div class="field">
          <label for="dm-input">Message</label>
          <textarea id="dm-input" maxlength="1000" placeholder="Write a message…" rows="3"></textarea>
        </div>
        <button class="btn btn-fill" id="dm-send" ${busy ? "disabled" : ""}>Send</button>
      </div>
    `;
    container.querySelector("#friend-back")?.addEventListener("click", () => {
      mode = "menu";
      paint();
    });
    const thread = container.querySelector("#dm-thread");
    if (thread) thread.scrollTop = thread.scrollHeight;

    container.querySelector("#dm-send")?.addEventListener("click", async () => {
      const body = (container.querySelector("#dm-input") as HTMLTextAreaElement).value;
      busy = true;
      error = "";
      success = "";
      paintDm(banner);
      const res = await sendFriendDm(friend.userId, body);
      busy = false;
      if (!res.ok) {
        error = res.error;
        paintDm(
          `<p class="danger-text" style="margin:0 0 12px">${escapeHtml(error)}</p>`,
        );
        return;
      }
      messages = await listFriendDms(friend.userId);
      showToast("Sent");
      paint();
    });
  };

  const paintBattleNew = (banner: string) => {
    const challenge = getBattleChallenge(
      challengeNonce,
      Boolean(player.settings.nsfwChallenges),
    );

    container.innerHTML = `
      <button type="button" class="btn btn-plain" id="friend-back">← Back</button>
      ${banner}
      <div class="section-header">New battle vs @${escapeHtml(friend.username)}</div>
      <div class="card stack">
        <div class="battle-task-header">
          <div>
            <p class="muted" style="margin:0"><strong>${escapeHtml(localizeChallenge(challenge).title)}</strong></p>
            <p class="muted" style="margin:6px 0 0">${escapeHtml(localizeChallenge(challenge).prompt)}</p>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="refresh-task" ${busy ? "disabled" : ""} title="Roll a different task">
            Refresh task
          </button>
        </div>
        <div class="field">
          <label for="battle-answer">Your answer</label>
          <textarea id="battle-answer" maxlength="400" rows="4" placeholder="Drop your line…"></textarea>
        </div>
        <button class="btn btn-fill" id="battle-send" ${busy ? "disabled" : ""}>Send battle</button>
      </div>
    `;

    container.querySelector("#friend-back")?.addEventListener("click", () => {
      mode = "menu";
      paint();
    });

    container.querySelector("#refresh-task")?.addEventListener("click", () => {
      challengeNonce = Date.now() + Math.floor(Math.random() * 1000);
      error = "";
      paint();
    });

    container.querySelector("#battle-send")?.addEventListener("click", async () => {
      const answer = (container.querySelector("#battle-answer") as HTMLTextAreaElement).value;
      const ch = getBattleChallenge(
        challengeNonce,
        Boolean(player.settings.nsfwChallenges),
      );
      busy = true;
      paintBattleNew(banner);
      const res = await createFriendBattle(
        friend.userId,
        ch.title,
        ch.prompt,
        answer,
      );
      busy = false;
      if (!res.ok) {
        error = res.error;
        paintBattleNew(`<p class="danger-text" style="margin:0 0 12px">${escapeHtml(error)}</p>`);
        return;
      }
      showToast(res.message ?? "Battle sent");
      battles = (await listFriendBattles()).filter(
        (b) => b.challengerId === friend.userId || b.opponentId === friend.userId,
      );
      mode = "menu";
      paint();
    });
  };

  const paintBattleReply = (banner: string) => {
    const pending = battles.filter(
      (b) =>
        b.status === "open" &&
        b.opponentId === myId &&
        !b.opponentAnswer &&
        (replyBattleId ? b.id === replyBattleId : true),
    );

    if (pending.length === 0) {
      container.innerHTML = `
        <button type="button" class="btn btn-plain" id="friend-back">← Back</button>
        ${banner}
        <div class="card"><p class="muted" style="margin:0">No open battles to reply to.</p></div>
      `;
      container.querySelector("#friend-back")?.addEventListener("click", () => {
        mode = "menu";
        replyBattleId = null;
        paint();
      });
      return;
    }

    container.innerHTML = `
      <button type="button" class="btn btn-plain" id="friend-back">← Back</button>
      ${banner}
      <div class="section-header">Your turn</div>
      ${pending
        .map(
          (b) => `
        <div class="card stack" data-battle-id="${escapeHtml(b.id)}" style="margin-bottom:12px">
          <p class="muted" style="margin:0"><strong>${escapeHtml(localizeChallengeTitle(b.challengeTitle))}</strong></p>
          <p class="muted" style="margin:0">${escapeHtml(b.challengePrompt)}</p>
          <div class="field">
            <label for="ans-${escapeHtml(b.id)}">Your answer</label>
            <textarea id="ans-${escapeHtml(b.id)}" maxlength="400" rows="4" placeholder="Drop your line…"></textarea>
          </div>
          <button class="btn btn-fill" data-submit-battle="${escapeHtml(b.id)}" ${busy ? "disabled" : ""}>Submit answer</button>
        </div>`,
        )
        .join("")}
    `;

    container.querySelector("#friend-back")?.addEventListener("click", () => {
      mode = "menu";
      replyBattleId = null;
      paint();
    });

    container.querySelectorAll<HTMLButtonElement>("[data-submit-battle]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.submitBattle!;
        const ta = container.querySelector(`#ans-${id}`) as HTMLTextAreaElement;
        const answer = ta?.value ?? "";
        busy = true;
        error = "";
        paintBattleReply(banner);
        const res = await submitFriendBattleAnswer(id, answer);
        if (!res.ok) {
          busy = false;
          error = res.error;
          paintBattleReply(`<p class="danger-text" style="margin:0 0 12px">${escapeHtml(error)}</p>`);
          return;
        }
        const battle = battles.find((b) => b.id === id);
        if (battle && battle.challengerAnswer) {
          const ch = {
            id: "friend-battle",
            category: "caption" as const,
            title: battle.challengeTitle,
            prompt: battle.challengePrompt,
            hint: "",
            emoji: "🎯",
          };
          const cScore = scoreLocal(
            battle.challengerAnswer,
            ch,
            player.core as AestheticCore,
            0,
          ).score;
          const oScore = scoreLocal(answer, ch, player.core as AestheticCore, 0).score;
          await completeFriendBattle(id, cScore, oScore);
        }
        busy = false;
        battles = (await listFriendBattles()).filter(
          (b) => b.challengerId === friend.userId || b.opponentId === friend.userId,
        );
        claimPendingRewards();
        showToast("Battle complete");
        replyBattleId = null;
        resultBattleId = id;
        mode = "battle-result";
        paint();
      });
    });
  };

  const paintBattleResult = (banner: string) => {
    claimPendingRewards();
    const b = battles.find((x) => x.id === resultBattleId);
    if (!b || b.status !== "complete") {
      container.innerHTML = `
        <button type="button" class="btn btn-plain" id="friend-back">← Back</button>
        ${banner}
        <div class="card"><p class="muted" style="margin:0">Results not available.</p></div>
      `;
      container.querySelector("#friend-back")?.addEventListener("click", () => {
        mode = "menu";
        resultBattleId = null;
        paint();
      });
      return;
    }

    const iAmChallenger = b.challengerId === myId;
    const myAnswer = iAmChallenger ? b.challengerAnswer : b.opponentAnswer;
    const theirAnswer = iAmChallenger ? b.opponentAnswer : b.challengerAnswer;
    const myScore = iAmChallenger ? b.challengerScore : b.opponentScore;
    const theirScore = iAmChallenger ? b.opponentScore : b.challengerScore;
    let outcome = "Tie";
    if (myScore != null && theirScore != null) {
      if (myScore > theirScore) outcome = "You won";
      else if (myScore < theirScore) outcome = "They won";
    }

    container.innerHTML = `
      <button type="button" class="btn btn-plain" id="friend-back">← Back</button>
      ${banner}
      <div class="section-header">Battle results</div>
      <div class="card stack">
        <p style="margin:0;font-weight:600;font-size:1.05rem">${escapeHtml(outcome)}</p>
        <p class="muted" style="margin:0"><strong>${escapeHtml(localizeChallengeTitle(b.challengeTitle))}</strong></p>
        <p class="muted" style="margin:0">${escapeHtml(b.challengePrompt)}</p>

        <div class="battle-answers">
          <div class="battle-answer-card mine">
            <div class="battle-answer-label">You · ${myScore ?? "—"} pts</div>
            <p class="battle-answer-body">${escapeHtml(myAnswer || "—")}</p>
          </div>
          <div class="battle-answer-card theirs">
            <div class="battle-answer-label">@${escapeHtml(friend.username)} · ${theirScore ?? "—"} pts</div>
            <p class="battle-answer-body">${escapeHtml(theirAnswer || "—")}</p>
          </div>
        </div>
      </div>
    `;

    container.querySelector("#friend-back")?.addEventListener("click", () => {
      mode = "menu";
      resultBattleId = null;
      paint();
    });
  };

  paint();
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
