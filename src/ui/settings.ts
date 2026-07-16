import {
  changeEmail,
  changePassword,
  changeUsername,
  deleteAccount,
  getCachedSession,
  validateEmail,
  validatePassword,
  validateUsername,
} from "../auth/auth";
import { LANG_META, t, type AppLang } from "../i18n";
import {
  DISPLAY_NAME_COOLDOWN_MS,
  USERNAME_COOLDOWN_MS,
  formatCooldown,
  msUntil,
  normalizeLocalTime,
  saveState,
  updateDisplayName,
  updateSettings,
} from "../state/store";
import type { AccentTheme, PlayerState, RizzGender, UserSettings } from "../types";
import { escapeHtml } from "../utils/format";
import { showToast } from "./toast";

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

type SettingsTab = "account" | "general";

export function renderSettings(
  container: HTMLElement,
  state: PlayerState,
  onState: (s: PlayerState) => void,
  onSessionRefresh: () => void,
  onLogout: () => void,
  onAccountDeleted: () => void,
): void {
  let tab: SettingsTab = "account";
  let busy = false;
  let error = "";
  let success = "";
  let showDeleteModal = false;
  let deleteConfirmText = "";

  const paint = () => {
    const session = getCachedSession();
    container.innerHTML = `
      <div class="segmented">
        <button type="button" data-tab="account" class="${tab === "account" ? "active" : ""}">${t("settings.account")}</button>
        <button type="button" data-tab="general" class="${tab === "general" ? "active" : ""}">${t("settings.general")}</button>
      </div>
      <div id="settings-body"></div>
    `;

    container.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        tab = btn.dataset.tab as SettingsTab;
        error = "";
        success = "";
        paint();
      });
    });

    const body = container.querySelector("#settings-body")!;
    if (tab === "account") renderAccount(body, session);
    else renderGeneral(body);
  };

  const banner = () => {
    if (error) return `<p class="danger-text" role="alert" style="margin:0 0 12px">${escapeHtml(error)}</p>`;
    if (success) return `<p class="success-text" role="status" style="margin:0 0 12px">${escapeHtml(success)}</p>`;
    return "";
  };

  const renderAccount = (
    body: Element,
    session: ReturnType<typeof getCachedSession>,
  ) => {
    const userWait = msUntil(state.lastUsernameChangeAt, USERNAME_COOLDOWN_MS);
    const nameWait = msUntil(state.lastDisplayNameChangeAt, DISPLAY_NAME_COOLDOWN_MS);

    body.innerHTML = `
      ${banner()}

      <div class="section-header">${t("settings.profile")}</div>
      <div class="card stack">
        <div class="settings-meta muted">
          ${t("settings.signedInAs", { user: session?.username ?? "—" })}<br/>
          ${escapeHtml(session?.email ?? "—")}
        </div>

        <div class="field">
          <label for="set-display">${t("settings.displayName")}</label>
          <input id="set-display" maxlength="18" value="${escapeHtml(state.displayName)}" />
          <p class="field-hint muted">${t("settings.displayCooldown", { wait: formatCooldown(nameWait) })}</p>
        </div>
        <button class="btn btn-secondary" id="save-display" ${busy || nameWait > 0 ? "disabled" : ""}>${t("settings.updateDisplay")}</button>

        <div class="field">
          <label for="set-username">${t("settings.username")}</label>
          <input id="set-username" maxlength="20" value="${escapeHtml(session?.username ?? "")}" spellcheck="false" />
          <p class="field-hint muted">${t("settings.usernameCooldown", { wait: formatCooldown(userWait) })}</p>
        </div>
        <button class="btn btn-secondary" id="save-username" ${busy || userWait > 0 ? "disabled" : ""}>${t("settings.updateUsername")}</button>
      </div>

      <div class="section-header">${t("settings.security")}</div>
      <div class="card stack">
        <div class="field">
          <label for="set-email">${t("settings.email")}</label>
          <input id="set-email" type="email" maxlength="120" value="${escapeHtml(session?.email ?? "")}" autocomplete="email" />
        </div>
        <button class="btn btn-secondary" id="save-email" ${busy ? "disabled" : ""}>${t("settings.updateEmail")}</button>

        <div class="field">
          <label for="set-pass">${t("settings.password")}</label>
          <input id="set-pass" type="password" maxlength="72" autocomplete="new-password" placeholder="${t("auth.passwordHintNew")}" />
        </div>
        <div class="field">
          <label for="set-pass2">${t("settings.password2")}</label>
          <input id="set-pass2" type="password" maxlength="72" autocomplete="new-password" />
        </div>
        <button class="btn btn-fill" id="save-pass" ${busy ? "disabled" : ""}>${t("settings.updatePassword")}</button>
      </div>

      <div class="section-header">${t("settings.account")}</div>
      <div class="card">
        <button class="btn btn-logout" id="settings-logout" style="width:100%">${t("settings.logout")}</button>
      </div>

      <div class="section-header">${t("settings.danger")}</div>
      <div class="card stack">
        <p class="muted" style="margin:0;font-size:0.9rem">
          Permanently delete your account, profile, saves, friends data, and messages. This cannot be undone.
        </p>
        <button class="btn btn-danger" id="open-delete" ${busy ? "disabled" : ""} style="width:100%">${t("settings.delete")}</button>
      </div>

      ${
        showDeleteModal
          ? `<div class="modal-backdrop" id="delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
        <div class="modal-card stack">
          <h2 id="delete-title" style="margin:0;font-size:1.2rem">Delete account?</h2>
          <p class="muted" style="margin:0">
            This will <strong>permanently</strong> remove <strong>@${escapeHtml(session?.username ?? "you")}</strong>
            and all associated data (progress, friends, DMs, battles, avatar).
          </p>
          <p class="danger-text" style="margin:0">There is no recovery after this.</p>
          <div class="field">
            <label for="delete-confirm">Type <strong>DELETE</strong> to confirm</label>
            <input id="delete-confirm" maxlength="20" autocomplete="off" spellcheck="false" placeholder="DELETE" value="${escapeHtml(deleteConfirmText)}" />
          </div>
          <div class="btn-row" style="margin-top:4px">
            <button type="button" class="btn btn-secondary" id="cancel-delete" ${busy ? "disabled" : ""}>Cancel</button>
            <button type="button" class="btn btn-danger" id="confirm-delete" ${busy || deleteConfirmText.trim().toUpperCase() !== "DELETE" ? "disabled" : ""}>
              ${busy ? "Deleting…" : "Yes, delete forever"}
            </button>
          </div>
        </div>
      </div>`
          : ""
      }
    `;

    body.querySelector("#open-delete")?.addEventListener("click", () => {
      showDeleteModal = true;
      deleteConfirmText = "";
      error = "";
      success = "";
      paint();
    });

    body.querySelector("#cancel-delete")?.addEventListener("click", () => {
      showDeleteModal = false;
      deleteConfirmText = "";
      paint();
    });

    body.querySelector("#delete-modal")?.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).id === "delete-modal") {
        showDeleteModal = false;
        deleteConfirmText = "";
        paint();
      }
    });

    const confirmInput = body.querySelector("#delete-confirm") as HTMLInputElement | null;
    confirmInput?.addEventListener("input", () => {
      deleteConfirmText = confirmInput.value;
      const btn = body.querySelector("#confirm-delete") as HTMLButtonElement | null;
      if (btn) {
        btn.disabled = busy || deleteConfirmText.trim().toUpperCase() !== "DELETE";
      }
    });

    body.querySelector("#confirm-delete")?.addEventListener("click", async () => {
      if (busy || deleteConfirmText.trim().toUpperCase() !== "DELETE") return;
      busy = true;
      error = "";
      success = "";
      paint();
      const res = await deleteAccount();
      busy = false;
      if (!res.ok) {
        error = res.error;
        showDeleteModal = true;
        paint();
        return;
      }
      showToast("Account deleted");
      onAccountDeleted();
    });

    body.querySelector("#save-display")?.addEventListener("click", () => {
      const name = (body.querySelector("#set-display") as HTMLInputElement).value;
      const res = updateDisplayName(state, name);
      if (!res.ok) {
        error = res.error;
        success = "";
        paint();
        return;
      }
      state = res.state;
      onState(state);
      error = "";
      success = "Display name updated.";
      showToast("Display name updated");
      paint();
    });

    body.querySelector("#save-username")?.addEventListener("click", async () => {
      if (busy) return;
      const username = (body.querySelector("#set-username") as HTMLInputElement).value;
      const v = validateUsername(username);
      if (v) {
        error = v;
        success = "";
        paint();
        return;
      }
      const wait = msUntil(state.lastUsernameChangeAt, USERNAME_COOLDOWN_MS);
      if (wait > 0) {
        error = `You can change your username again in ${formatCooldown(wait)}.`;
        success = "";
        paint();
        return;
      }

      busy = true;
      error = "";
      success = "";
      paint();
      const res = await changeUsername(username);
      busy = false;
      if (!res.ok) {
        error = res.error;
        paint();
        return;
      }
      state = {
        ...state,
        lastUsernameChangeAt: new Date().toISOString(),
      };
      saveState(state);
      onState(state);
      onSessionRefresh();
      success = res.message ?? "Username updated.";
      showToast(success);
      paint();
    });

    body.querySelector("#save-email")?.addEventListener("click", async () => {
      if (busy) return;
      const email = (body.querySelector("#set-email") as HTMLInputElement).value;
      const v = validateEmail(email);
      if (v) {
        error = v;
        success = "";
        paint();
        return;
      }
      busy = true;
      error = "";
      success = "";
      paint();
      const res = await changeEmail(email);
      busy = false;
      if (!res.ok) {
        error = res.error;
        paint();
        return;
      }
      onSessionRefresh();
      success = res.message ?? "Email updated.";
      showToast("Email update requested");
      paint();
    });

    body.querySelector("#save-pass")?.addEventListener("click", async () => {
      if (busy) return;
      const p1 = (body.querySelector("#set-pass") as HTMLInputElement).value;
      const p2 = (body.querySelector("#set-pass2") as HTMLInputElement).value;
      if (p1 !== p2) {
        error = "Passwords do not match.";
        success = "";
        paint();
        return;
      }
      const v = validatePassword(p1);
      if (v) {
        error = v;
        success = "";
        paint();
        return;
      }
      busy = true;
      error = "";
      success = "";
      paint();
      const res = await changePassword(p1);
      busy = false;
      if (!res.ok) {
        error = res.error;
        paint();
        return;
      }
      success = res.message ?? "Password updated.";
      showToast("Password updated");
      paint();
    });

    body.querySelector("#settings-logout")?.addEventListener("click", () => onLogout());
  };

  const renderGeneral = (body: Element) => {
    const s = state.settings;
    const tz = s.timezone || detectTimezone();
    const localTime = normalizeLocalTime(s.streakEmailTime || "18:00");
    const currentLang = (s.language || "en") as AppLang;

    body.innerHTML = `
      ${banner()}
      <div class="section-header">${t("settings.language")}</div>
      <div class="card stack">
        <p class="muted" style="margin:0;font-size:0.9rem">${t("settings.languageBlurb")}</p>
        <div class="field">
          <label for="set-lang">${t("settings.language")}</label>
          <select id="set-lang">
            ${LANG_META.map(
              (m) =>
                `<option value="${m.id}" ${m.id === currentLang ? "selected" : ""}>${escapeHtml(m.native)} — ${escapeHtml(m.name)}</option>`,
            ).join("")}
          </select>
        </div>
      </div>

      <div class="section-header">${t("settings.appearance")}</div>
      <div class="card stack">
        <div class="field">
          <label>${t("settings.accent")}</label>
          <div class="accent-row">
            ${(["purple", "blue", "pink", "green"] as AccentTheme[])
              .map(
                (a) => `
              <button type="button" class="accent-swatch ${a} ${s.accent === a ? "selected" : ""}" data-accent="${a}" title="${a}"></button>
            `,
              )
              .join("")}
          </div>
        </div>
        ${toggleRow("largeText", t("settings.largeText"), s.largeText)}
        ${toggleRow("compactMode", t("settings.compact"), s.compactMode)}
      </div>

      <div class="section-header">${t("settings.experience")}</div>
      <div class="card stack">
        ${toggleRow("preferAiJudge", t("settings.preferAi"), s.preferAiJudge)}
        ${toggleRow("reduceMotion", t("settings.reduceMotion"), s.reduceMotion)}
        ${toggleRow("soundEnabled", t("settings.sounds"), s.soundEnabled)}
        ${toggleRow("hideTopCurrency", t("settings.hideCurrency"), s.hideTopCurrency)}
      </div>

      <div class="section-header">${t("settings.content")}</div>
      <div class="card stack">
        ${toggleRow("nsfwChallenges", t("settings.nsfw"), Boolean(s.nsfwChallenges))}
        <p class="field-hint muted" style="margin:0">${t("settings.nsfwHint")}</p>
      </div>

      <div class="section-header">${t("settings.rizz")}</div>
      <div class="card stack">
        <p class="muted settings-meta" style="margin:0">${t("settings.rizzHint")}</p>
        <div class="rizz-settings-genders">
          <button type="button" class="btn ${s.rizzTargetGender === "female" ? "btn-fill" : "btn-secondary"}" data-rizz-gender="female">${t("rizz.trainHer")}</button>
          <button type="button" class="btn ${s.rizzTargetGender === "male" ? "btn-fill" : "btn-secondary"}" data-rizz-gender="male">${t("rizz.trainHim")}</button>
        </div>
        ${
          s.rizzTargetGender
            ? `<p class="field-hint muted" style="margin:0">${t("settings.rizzCurrent", {
                target: s.rizzTargetGender === "female" ? t("rizz.her") : t("rizz.him"),
              })}</p>`
            : `<p class="field-hint muted" style="margin:0">${t("settings.rizzNone")}</p>`
        }
      </div>

      <div class="section-header">${t("settings.streakSection")}</div>
      <div class="card stack">
        ${toggleRow("streakEmailEnabled", t("settings.streakEmail"), s.streakEmailEnabled)}
        <div class="field">
          <label for="streak-time">${t("settings.streakTime")}</label>
          <input id="streak-time" type="time" value="${escapeHtml(localTime)}" ${s.streakEmailEnabled ? "" : "disabled"} />
          <p class="field-hint muted">${t("settings.streakHint", { tz })}</p>
        </div>
        <button class="btn btn-secondary" id="save-streak-time" ${busy || !s.streakEmailEnabled ? "disabled" : ""}>${t("settings.saveStreak")}</button>
      </div>

      <p class="muted" style="font-size:0.82rem;padding:0 4px;margin:12px 0 0">
        ${t("settings.syncNote")}
      </p>
    `;

    body.querySelector("#set-lang")?.addEventListener("change", (e) => {
      const language = (e.target as HTMLSelectElement).value as AppLang;
      state = updateSettings(state, { language });
      onState(state);
      success = t("settings.langUpdated");
      error = "";
      showToast(success);
      paint();
    });

    body.querySelectorAll<HTMLButtonElement>("[data-accent]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const accent = btn.dataset.accent as AccentTheme;
        state = updateSettings(state, { accent });
        onState(state);
        success = t("settings.accentUpdated");
        error = "";
        paint();
      });
    });

    body.querySelectorAll<HTMLInputElement>("[data-toggle]").forEach((input) => {
      input.addEventListener("change", () => {
        const key = input.dataset.toggle as keyof UserSettings;
        let value = input.checked;
        if (key === "nsfwChallenges" && value) {
          const ok = window.confirm(t("settings.nsfwConfirm"));
          if (!ok) {
            input.checked = false;
            return;
          }
        }
        const patch: Partial<UserSettings> = {
          [key]: value,
          timezone: detectTimezone(),
        } as Partial<UserSettings>;
        state = updateSettings(state, patch);
        onState(state);
        showToast(
          key === "nsfwChallenges"
            ? value
              ? t("settings.nsfwOn")
              : t("settings.nsfwOff")
            : t("settings.saved"),
        );
        if (key === "streakEmailEnabled" || key === "nsfwChallenges") {
          paint();
        }
      });
    });

    body.querySelector("#save-streak-time")?.addEventListener("click", () => {
      const raw = (body.querySelector("#streak-time") as HTMLInputElement).value;
      const time = normalizeLocalTime(raw);
      state = updateSettings(state, {
        streakEmailTime: time,
        timezone: detectTimezone(),
        streakEmailEnabled: true,
      });
      onState(state);
      success = `${t("settings.saveStreak")}: ${time}`;
      error = "";
      showToast(success);
      paint();
    });

    body.querySelectorAll<HTMLButtonElement>("[data-rizz-gender]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const g = btn.dataset.rizzGender as RizzGender;
        const next = s.rizzTargetGender === g ? null : g;
        state = updateSettings(state, { rizzTargetGender: next });
        onState(state);
        showToast(
          next
            ? t("settings.rizzSaved", {
                target: next === "female" ? t("rizz.her") : t("rizz.him"),
              })
            : t("settings.rizzCleared"),
        );
        paint();
      });
    });
  };

  paint();
}

function toggleRow(key: string, label: string, on: boolean): string {
  return `
    <label class="toggle-row">
      <span>${escapeHtml(label)}</span>
      <input type="checkbox" data-toggle="${key}" ${on ? "checked" : ""} />
    </label>
  `;
}
