import { getCachedSession } from "../auth/auth";
import { getTodaysChallenge } from "../game/daily";
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
import type { AestheticCore, PlayerState } from "../types";
import { escapeHtml, formatNumber } from "../utils/format";
import { showToast } from "./toast";

function avatarHtml(url: string | null | undefined, name: string): string {
  const initial = (name || "?").slice(0, 1).toUpperCase();
  if (url) return `<img class="avatar" src="${escapeHtml(url)}" alt="" />`;
  return `<div class="avatar avatar-fallback" aria-hidden="true">${escapeHtml(initial)}</div>`;
}

type PanelMode = "menu" | "dm" | "battle" | "note";

/**
 * Friend detail: duration, private note, DM, battle.
 */
export async function renderFriendPanel(
  container: HTMLElement,
  friend: FriendRow,
  state: PlayerState,
  onBack: () => void,
): Promise<void> {
  const me = getCachedSession();
  let mode: PanelMode = "menu";
  let note = "";
  let messages: DmMessage[] = [];
  let battles: FriendBattle[] = [];
  let busy = false;
  let error = "";
  let success = "";

  const load = async () => {
    note = await getFriendNote(friend.userId);
    messages = await listFriendDms(friend.userId);
    battles = (await listFriendBattles()).filter(
      (b) => b.challengerId === friend.userId || b.opponentId === friend.userId,
    );
  };

  await load();

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
    if (mode === "battle") {
      paintBattle(banner);
      return;
    }
    if (mode === "note") {
      paintNote(banner);
      return;
    }

    container.innerHTML = `
      <button type="button" class="btn btn-plain" id="friend-back" style="align-self:flex-start">← Friends</button>
      ${banner}
      <div class="card profile-hero" style="margin-top:8px">
        <div class="profile-hero-row">
          ${avatarHtml(friend.avatarUrl, friend.displayName)}
          <div class="profile-hero-meta">
            <h2 style="margin:0;font-size:1.25rem">${escapeHtml(friend.displayName)}</h2>
            <p class="muted" style="margin:4px 0 0">@${escapeHtml(friend.username)}</p>
            <p class="muted" style="margin:8px 0 0;font-size:0.88rem;font-weight:600;color:var(--accent)">
              ${escapeHtml(formatFriendshipDuration(friend.friendsSince))}
            </p>
            <p class="muted" style="margin:4px 0 0;font-size:0.84rem">
              ${formatNumber(friend.totalAura)} aura
            </p>
          </div>
        </div>
        <div class="friend-quick-actions">
          <button type="button" class="btn btn-fill btn-sm" id="open-dm">Message</button>
          <button type="button" class="btn btn-secondary btn-sm" id="open-battle">Battle</button>
          <button type="button" class="btn btn-secondary btn-sm" id="open-note">Private note</button>
        </div>
      </div>

      ${
        battles.length
          ? `<div class="section-header">Battles</div>
             <div class="inset-group">
               ${battles
                 .slice(0, 8)
                 .map((b) => battleRow(b, me?.userId ?? ""))
                 .join("")}
             </div>`
          : `<div class="section-header">Battles</div>
             <div class="card"><p class="muted" style="margin:0">No battles yet. Challenge them!</p></div>`
      }
    `;

    container.querySelector("#friend-back")?.addEventListener("click", onBack);
    container.querySelector("#open-dm")?.addEventListener("click", () => {
      mode = "dm";
      paint();
    });
    container.querySelector("#open-battle")?.addEventListener("click", () => {
      mode = "battle";
      paint();
    });
    container.querySelector("#open-note")?.addEventListener("click", () => {
      mode = "note";
      paint();
    });

    container.querySelectorAll<HTMLButtonElement>("[data-answer-battle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        mode = "battle";
        paint();
        // scroll / focus handled in battle paint via selected id
        const id = btn.dataset.answerBattle!;
        setTimeout(() => {
          const el = container.querySelector(`[data-battle-id="${id}"]`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 50);
      });
    });
  };

  const battleRow = (b: FriendBattle, myId: string): string => {
    const iAmChallenger = b.challengerId === myId;
    const needAnswer =
      b.status === "open" && !iAmChallenger && !b.opponentAnswer;
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
    return `
      <div class="list-row">
        <div class="meta">
          <strong>${escapeHtml(b.challengeTitle)}</strong>
          <span>${escapeHtml(b.status)}${result ? ` · ${result}` : ""}${
            needAnswer ? " · your turn" : ""
          }</span>
        </div>
        ${
          needAnswer
            ? `<button type="button" class="btn btn-fill btn-sm" data-answer-battle="${escapeHtml(b.id)}">Answer</button>`
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

  const paintNote = (banner: string) => {
    container.innerHTML = `
      <button type="button" class="btn btn-plain" id="friend-back">← Back</button>
      ${banner}
      <div class="section-header">Private note</div>
      <div class="card stack">
        <p class="muted" style="margin:0">Only you can see this note about @${escapeHtml(friend.username)}.</p>
        <div class="field">
          <label for="note-input">Note</label>
          <textarea id="note-input" maxlength="500" rows="5" placeholder="Reminders, context…">${escapeHtml(note)}</textarea>
        </div>
        <button class="btn btn-fill" id="note-save" ${busy ? "disabled" : ""}>Save note</button>
      </div>
    `;
    container.querySelector("#friend-back")?.addEventListener("click", () => {
      mode = "menu";
      paint();
    });
    container.querySelector("#note-save")?.addEventListener("click", async () => {
      const text = (container.querySelector("#note-input") as HTMLTextAreaElement).value;
      busy = true;
      paintNote(banner);
      const res = await saveFriendNote(friend.userId, text);
      busy = false;
      if (!res.ok) {
        error = res.error;
        paintNote(`<p class="danger-text" style="margin:0 0 12px">${escapeHtml(error)}</p>`);
        return;
      }
      note = text.trim().slice(0, 500);
      showToast("Note saved");
      mode = "menu";
      paint();
    });
  };

  const paintBattle = (banner: string) => {
    const challenge = getTodaysChallenge();
    const pendingForMe = battles.filter(
      (b) =>
        b.status === "open" &&
        b.opponentId === me?.userId &&
        !b.opponentAnswer,
    );

    container.innerHTML = `
      <button type="button" class="btn btn-plain" id="friend-back">← Back</button>
      ${banner}
      <div class="section-header">Challenge @${escapeHtml(friend.username)}</div>
      <div class="card stack">
        <p class="muted" style="margin:0"><strong>${escapeHtml(challenge.title)}</strong></p>
        <p class="muted" style="margin:0">${escapeHtml(challenge.prompt)}</p>
        <div class="field">
          <label for="battle-answer">Your answer</label>
          <textarea id="battle-answer" maxlength="400" rows="4" placeholder="Drop your line…"></textarea>
        </div>
        <button class="btn btn-fill" id="battle-send" ${busy ? "disabled" : ""}>Send battle</button>
      </div>

      ${
        pendingForMe.length
          ? `<div class="section-header">Your turn</div>
             ${pendingForMe
               .map(
                 (b) => `
               <div class="card stack" data-battle-id="${escapeHtml(b.id)}" style="margin-top:12px">
                 <p class="muted" style="margin:0"><strong>${escapeHtml(b.challengeTitle)}</strong></p>
                 <p class="muted" style="margin:0">${escapeHtml(b.challengePrompt)}</p>
                 <div class="field">
                   <label for="ans-${escapeHtml(b.id)}">Your answer</label>
                   <textarea id="ans-${escapeHtml(b.id)}" maxlength="400" rows="3"></textarea>
                 </div>
                 <button class="btn btn-fill" data-submit-battle="${escapeHtml(b.id)}" ${busy ? "disabled" : ""}>Submit answer</button>
               </div>`,
               )
               .join("")}`
          : ""
      }
    `;

    container.querySelector("#friend-back")?.addEventListener("click", () => {
      mode = "menu";
      paint();
    });

    container.querySelector("#battle-send")?.addEventListener("click", async () => {
      const answer = (container.querySelector("#battle-answer") as HTMLTextAreaElement).value;
      busy = true;
      paintBattle(banner);
      const res = await createFriendBattle(
        friend.userId,
        challenge.title,
        challenge.prompt,
        answer,
      );
      busy = false;
      if (!res.ok) {
        error = res.error;
        paintBattle(`<p class="danger-text" style="margin:0 0 12px">${escapeHtml(error)}</p>`);
        return;
      }
      showToast(res.message ?? "Battle sent");
      battles = (await listFriendBattles()).filter(
        (b) => b.challengerId === friend.userId || b.opponentId === friend.userId,
      );
      mode = "menu";
      paint();
    });

    container.querySelectorAll<HTMLButtonElement>("[data-submit-battle]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.submitBattle!;
        const ta = container.querySelector(`#ans-${id}`) as HTMLTextAreaElement;
        const answer = ta?.value ?? "";
        busy = true;
        paintBattle(banner);
        const res = await submitFriendBattleAnswer(id, answer);
        if (!res.ok) {
          busy = false;
          error = res.error;
          paintBattle(`<p class="danger-text" style="margin:0 0 12px">${escapeHtml(error)}</p>`);
          return;
        }
        // Score both sides client-side and complete
        const battle = battles.find((b) => b.id === id);
        if (battle && battle.challengerAnswer) {
          const ch = {
            id: "friend-battle",
            category: "caption" as const,
            title: battle.challengeTitle,
            prompt: battle.challengePrompt,
            hint: "",
            emoji: "⚔️",
          };
          const cScore = scoreLocal(
            battle.challengerAnswer,
            ch,
            state.core as AestheticCore,
            0,
          ).score;
          const oScore = scoreLocal(answer, ch, state.core as AestheticCore, 0).score;
          await completeFriendBattle(id, cScore, oScore);
        }
        busy = false;
        showToast("Battle complete");
        battles = (await listFriendBattles()).filter(
          (b) => b.challengerId === friend.userId || b.opponentId === friend.userId,
        );
        mode = "menu";
        paint();
      });
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
