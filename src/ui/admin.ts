import {
  adminAdjustCurrency,
  adminDeleteUser,
  adminListUsers,
  adminSetBan,
  type AdminUserRow,
} from "../admin/api";
import { isCurrentUserAdmin } from "../admin/gate";
import { getTodaysChallenge, refreshDailyChallenge } from "../game/daily";
import {
  adminAdjustOwnCurrency,
  adminResetDailyProgress,
  adminSetOwnCurrency,
} from "../state/store";
import type { PlayerState } from "../types";
import { escapeHtml, formatNumber } from "../utils/format";
import { showToast } from "./toast";

/**
 * Admin panel — only rendered when caller has already verified @admin.
 */
export function renderAdmin(
  container: HTMLElement,
  state: PlayerState,
  onState: (s: PlayerState) => void,
): void {
  if (!isCurrentUserAdmin()) {
    container.innerHTML = `<div class="card"><p class="danger-text" style="margin:0">Access denied.</p></div>`;
    return;
  }

  let tab: "tools" | "users" = "tools";
  let users: AdminUserRow[] = [];
  let loadingUsers = false;
  let busy = false;
  let error = "";
  let success = "";
  let dailyPreview = getTodaysChallenge();
  let deleteTarget: string | null = null;
  let deleteConfirm = "";
  let userSearch = "";

  const paint = () => {
    container.innerHTML = `
      <p class="muted" style="margin:0 0 12px;font-size:0.88rem">
        Owner tools for <strong>@admin</strong>. Server actions require <code>supabase/admin.sql</code>.
      </p>
      <div class="segmented">
        <button type="button" data-tab="tools" class="${tab === "tools" ? "active" : ""}">Tools</button>
        <button type="button" data-tab="users" class="${tab === "users" ? "active" : ""}">Users</button>
      </div>
      ${
        error
          ? `<p class="danger-text" style="margin:12px 0">${escapeHtml(error)}</p>`
          : ""
      }
      ${
        success
          ? `<p class="success-text" style="margin:12px 0">${escapeHtml(success)}</p>`
          : ""
      }
      <div id="admin-body"></div>
      ${
        deleteTarget
          ? `<div class="modal-backdrop" id="admin-delete-modal" role="dialog" aria-modal="true">
        <div class="modal-card stack">
          <h2 style="margin:0;font-size:1.15rem">Delete @${escapeHtml(deleteTarget)}?</h2>
          <p class="muted" style="margin:0">This permanently removes their account and data. Type <strong>DELETE</strong> to confirm.</p>
          <div class="field">
            <label for="admin-del-confirm">Confirm</label>
            <input id="admin-del-confirm" maxlength="20" autocomplete="off" value="${escapeHtml(deleteConfirm)}" />
          </div>
          <div class="btn-row">
            <button type="button" class="btn btn-secondary" id="admin-del-cancel">Cancel</button>
            <button type="button" class="btn btn-danger" id="admin-del-go" ${
              busy || deleteConfirm.trim().toUpperCase() !== "DELETE" ? "disabled" : ""
            }>${busy ? "Deleting…" : "Delete forever"}</button>
          </div>
        </div>
      </div>`
          : ""
      }
    `;

    container.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        tab = btn.dataset.tab as "tools" | "users";
        error = "";
        success = "";
        paint();
        if (tab === "users") void loadUsers();
      });
    });

    const body = container.querySelector("#admin-body")!;
    if (tab === "tools") paintTools(body);
    else paintUsers(body);

    container.querySelector("#admin-del-cancel")?.addEventListener("click", () => {
      deleteTarget = null;
      deleteConfirm = "";
      paint();
    });
    container.querySelector("#admin-delete-modal")?.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).id === "admin-delete-modal") {
        deleteTarget = null;
        deleteConfirm = "";
        paint();
      }
    });
    const conf = container.querySelector("#admin-del-confirm") as HTMLInputElement | null;
    conf?.addEventListener("input", () => {
      deleteConfirm = conf.value;
      const go = container.querySelector("#admin-del-go") as HTMLButtonElement | null;
      if (go) go.disabled = busy || deleteConfirm.trim().toUpperCase() !== "DELETE";
    });
    container.querySelector("#admin-del-go")?.addEventListener("click", async () => {
      if (!deleteTarget || deleteConfirm.trim().toUpperCase() !== "DELETE") return;
      const target = deleteTarget;
      busy = true;
      error = "";
      paint();
      const res = await adminDeleteUser(target);
      busy = false;
      if (!res.ok) {
        error = res.error;
        success = "";
        showToast(res.error);
        paint();
        return;
      }
      success = res.message ?? "Deleted.";
      error = "";
      showToast(success);
      deleteTarget = null;
      deleteConfirm = "";
      void loadUsers();
    });
  };

  const paintTools = (body: Element) => {
    body.innerHTML = `
      <div class="section-header">Daily challenge</div>
      <div class="card stack">
        <p class="muted" style="margin:0"><strong>${escapeHtml(dailyPreview.emoji)} ${escapeHtml(dailyPreview.title)}</strong></p>
        <p class="muted" style="margin:0">${escapeHtml(dailyPreview.prompt)}</p>
        <div class="btn-row">
          <button type="button" class="btn btn-secondary" id="admin-refresh-daily" ${busy ? "disabled" : ""}>Refresh daily challenge</button>
          <button type="button" class="btn btn-fill" id="admin-reset-daily" ${busy ? "disabled" : ""}>Reset my daily completion</button>
        </div>
        <p class="field-hint muted">Refresh picks a different prompt for this device. Reset lets you play Daily again today.</p>
      </div>

      <div class="section-header">My currency</div>
      <div class="card stack">
        <p class="muted" style="margin:0">You have <strong>${formatNumber(state.sparks)}</strong> Sparks · <strong>${formatNumber(state.glow)}</strong> Glow</p>
        <div class="admin-currency-row">
          <button type="button" class="btn btn-secondary btn-sm" data-own-delta="sparks" data-amt="100">+100 Sparks</button>
          <button type="button" class="btn btn-secondary btn-sm" data-own-delta="sparks" data-amt="-100">−100 Sparks</button>
          <button type="button" class="btn btn-secondary btn-sm" data-own-delta="glow" data-amt="25">+25 Glow</button>
          <button type="button" class="btn btn-secondary btn-sm" data-own-delta="glow" data-amt="-25">−25 Glow</button>
        </div>
        <div class="field">
          <label for="set-sparks">Set Sparks</label>
          <input id="set-sparks" type="number" min="0" value="${state.sparks}" />
        </div>
        <div class="field">
          <label for="set-glow">Set Glow</label>
          <input id="set-glow" type="number" min="0" value="${state.glow}" />
        </div>
        <button type="button" class="btn btn-fill" id="admin-set-currency" ${busy ? "disabled" : ""}>Apply amounts</button>
      </div>

      <div class="section-header">Adjust another player</div>
      <div class="card stack">
        <div class="field">
          <label for="other-user">Username</label>
          <input id="other-user" maxlength="20" placeholder="username" spellcheck="false" />
        </div>
        <div class="field">
          <label for="other-sparks">Sparks delta</label>
          <input id="other-sparks" type="number" value="0" />
        </div>
        <div class="field">
          <label for="other-glow">Glow delta</label>
          <input id="other-glow" type="number" value="0" />
        </div>
        <button type="button" class="btn btn-secondary" id="admin-other-currency" ${busy ? "disabled" : ""}>Apply to user</button>
      </div>
    `;

    body.querySelector("#admin-refresh-daily")?.addEventListener("click", () => {
      dailyPreview = refreshDailyChallenge();
      success = `Daily refreshed: ${dailyPreview.title}`;
      error = "";
      showToast(success);
      paint();
    });

    body.querySelector("#admin-reset-daily")?.addEventListener("click", () => {
      state = adminResetDailyProgress(state);
      onState(state);
      success = "Your daily completion was cleared. You can play Daily again.";
      error = "";
      showToast(success);
      paint();
    });

    body.querySelectorAll<HTMLButtonElement>("[data-own-delta]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const kind = btn.dataset.ownDelta as "sparks" | "glow";
        const amt = Number(btn.dataset.amt ?? 0);
        state =
          kind === "sparks"
            ? adminAdjustOwnCurrency(state, amt, 0)
            : adminAdjustOwnCurrency(state, 0, amt);
        onState(state);
        showToast(`Updated ${kind}`);
        paint();
      });
    });

    body.querySelector("#admin-set-currency")?.addEventListener("click", () => {
      const sparks = Number(
        (body.querySelector("#set-sparks") as HTMLInputElement).value,
      );
      const glow = Number((body.querySelector("#set-glow") as HTMLInputElement).value);
      state = adminSetOwnCurrency(state, sparks, glow);
      onState(state);
      success = "Currency set.";
      error = "";
      showToast(success);
      paint();
    });

    body.querySelector("#admin-other-currency")?.addEventListener("click", async () => {
      const username = (body.querySelector("#other-user") as HTMLInputElement).value;
      const sparksDelta = Number(
        (body.querySelector("#other-sparks") as HTMLInputElement).value,
      );
      const glowDelta = Number(
        (body.querySelector("#other-glow") as HTMLInputElement).value,
      );
      if (!username.trim()) {
        error = "Enter a username.";
        success = "";
        paint();
        return;
      }
      busy = true;
      paint();
      const res = await adminAdjustCurrency(username, sparksDelta, glowDelta);
      busy = false;
      if (!res.ok) {
        error = res.error;
        success = "";
        paint();
        return;
      }
      success = res.message ?? "Updated.";
      error = "";
      showToast(success);
      paint();
    });
  };

  const paintUsers = (body: Element) => {
    if (loadingUsers) {
      body.innerHTML = `<p class="muted">Loading users…</p>`;
      return;
    }

    const q = userSearch.trim().toLowerCase();
    const filtered = q
      ? users.filter(
          (u) =>
            u.username.toLowerCase().includes(q) ||
            u.displayName.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q),
        )
      : users;

    body.innerHTML = `
      <div class="card stack" style="margin-bottom:12px">
        <div class="field">
          <label for="admin-user-search">Search accounts</label>
          <input id="admin-user-search" maxlength="80" placeholder="Username, display name, or email…" value="${escapeHtml(userSearch)}" spellcheck="false" />
        </div>
        <p class="field-hint muted" style="margin:0">Showing ${filtered.length} of ${users.length} accounts</p>
      </div>
      <div class="section-header">Accounts</div>
      ${
        users.length === 0
          ? `<div class="card"><p class="muted" style="margin:0">No users loaded. Ensure supabase/admin.sql is applied.</p>
             <button type="button" class="btn btn-secondary" id="reload-users" style="margin-top:12px">Retry</button></div>`
          : filtered.length === 0
            ? `<div class="card"><p class="muted" style="margin:0">No accounts match “${escapeHtml(userSearch)}”.</p></div>
               <button type="button" class="btn btn-plain" id="reload-users" style="margin-top:12px">Refresh list</button>`
            : `<div class="inset-group">${filtered
              .map(
                (u) => `
            <div class="list-row admin-user-row">
              <div class="meta">
                <strong>@${escapeHtml(u.username)}${u.banned ? " · banned" : ""}</strong>
                <span>${escapeHtml(u.displayName)} · ${escapeHtml(u.email)}</span>
                <span>${formatNumber(u.sparks)} sparks · ${formatNumber(u.glow)} glow · ${formatNumber(u.totalAura)} aura</span>
                ${
                  u.banned && u.banReason
                    ? `<span class="danger-text" style="font-size:0.8rem">Reason: ${escapeHtml(u.banReason)}</span>`
                    : ""
                }
              </div>
              <div class="friend-actions">
                ${
                  u.username.toLowerCase() === "admin"
                    ? `<span class="muted" style="font-size:0.8rem">you</span>`
                    : `
                  <button type="button" class="btn btn-secondary btn-sm" data-ban="${escapeHtml(u.username)}" data-banned="${u.banned ? "1" : "0"}">
                    ${u.banned ? "Unban" : "Ban"}
                  </button>
                  <button type="button" class="btn btn-danger btn-sm" data-del="${escapeHtml(u.username)}">Delete</button>
                `
                }
              </div>
            </div>`,
              )
              .join("")}</div>
          <button type="button" class="btn btn-plain" id="reload-users" style="margin-top:12px">Refresh list</button>`
      }
    `;

    const searchInput = body.querySelector("#admin-user-search") as HTMLInputElement | null;
    searchInput?.addEventListener("input", () => {
      userSearch = searchInput.value;
      // Re-paint only users body without resetting focus caret badly
      const pos = searchInput.selectionStart ?? userSearch.length;
      paint();
      const again = container.querySelector("#admin-user-search") as HTMLInputElement | null;
      if (again) {
        again.focus();
        try {
          again.setSelectionRange(pos, pos);
        } catch {
          /* ignore */
        }
      }
    });

    body.querySelector("#reload-users")?.addEventListener("click", () => void loadUsers());

    body.querySelectorAll<HTMLButtonElement>("[data-ban]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const username = btn.dataset.ban!;
        const currentlyBanned = btn.dataset.banned === "1";
        let reason = "";
        if (!currentlyBanned) {
          reason = window.prompt("Ban reason (optional):") ?? "";
          if (reason === null) return;
        }
        busy = true;
        error = "";
        success = "";
        paint();
        const res = await adminSetBan(username, !currentlyBanned, reason);
        busy = false;
        if (!res.ok) {
          error = res.error;
          success = "";
          showToast(res.error);
          paint();
          return;
        }
        success = res.message ?? "Updated.";
        error = "";
        showToast(success);
        void loadUsers();
      });
    });

    body.querySelectorAll<HTMLButtonElement>("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        deleteTarget = btn.dataset.del!;
        deleteConfirm = "";
        paint();
      });
    });
  };

  const loadUsers = async () => {
    loadingUsers = true;
    paint();
    users = await adminListUsers();
    loadingUsers = false;
    paint();
  };

  paint();
}
