import {
  login,
  register,
  type AuthResult,
  type Session,
} from "../auth/auth";
import { getLang, LANG_META, setLang, t, type AppLang } from "../i18n";
import { getSupabaseConfigError, isSupabaseConfigured } from "../lib/supabase";
import { escapeHtml } from "../utils/format";

export function renderLogin(
  root: HTMLElement,
  onAuthed: (session: Session) => void,
): void {
  let mode: "login" | "register" = "login";
  let error = "";
  let busy = false;
  const configError = getSupabaseConfigError();

  const paint = () => {
    const lang = getLang();
    const tagline = t("auth.tagline").replace(/\n/g, "<br/>");
    root.innerHTML = `
      <div class="auth-screen auth-layout">
        <div class="auth-hero">
          <div class="logo">AuraFarm</div>
          <p class="muted auth-tagline">${tagline}</p>
        </div>

        ${
          configError
            ? `<div class="card"><p class="danger-text">${escapeHtml(configError)}</p>
               <p class="muted" style="margin:10px 0 0;font-size:0.86rem">Set Supabase env vars (see README).</p></div>`
            : ""
        }

        <div class="auth-panel">
          <div class="card stack">
            <div class="field">
              <label for="auth-lang">${t("auth.language")}</label>
              <select id="auth-lang">
                ${LANG_META.map(
                  (m) =>
                    `<option value="${m.id}" ${m.id === lang ? "selected" : ""}>${escapeHtml(m.native)} — ${escapeHtml(m.name)}</option>`,
                ).join("")}
              </select>
            </div>

            <div class="segmented">
              <button type="button" data-mode="login" class="${mode === "login" ? "active" : ""}">${t("auth.login")}</button>
              <button type="button" data-mode="register" class="${mode === "register" ? "active" : ""}">${t("auth.signup")}</button>
            </div>

            <form id="auth-form" class="stack" autocomplete="on">
              ${
                mode === "register"
                  ? `
                <div class="field">
                  <label for="email">${t("auth.email")}</label>
                  <input id="email" name="email" type="email" maxlength="120" autocomplete="email" placeholder="name@example.com" required />
                </div>
                <div class="field">
                  <label for="username">${t("auth.username")}</label>
                  <input id="username" name="username" maxlength="20" autocomplete="username" placeholder="vibe_curator" spellcheck="false" required />
                </div>
              `
                  : `
                <div class="field">
                  <label for="identifier">${t("auth.emailOrUsername")}</label>
                  <input id="identifier" name="identifier" maxlength="120" autocomplete="username" placeholder="name@example.com" spellcheck="false" required />
                </div>
              `
              }
              <div class="field">
                <label for="password">${t("auth.password")}</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  maxlength="72"
                  autocomplete="${mode === "register" ? "new-password" : "current-password"}"
                  placeholder="${mode === "register" ? t("auth.passwordHintNew") : t("auth.passwordHint")}"
                  required
                />
              </div>
              ${
                mode === "register"
                  ? `
                <div class="field">
                  <label for="password2">${t("auth.confirmPassword")}</label>
                  <input id="password2" name="password2" type="password" maxlength="72" autocomplete="new-password" required />
                </div>
              `
                  : ""
              }

              ${error ? `<p class="danger-text" role="alert">${escapeHtml(error)}</p>` : ""}

              <button class="btn btn-fill" type="submit" ${busy || !isSupabaseConfigured() ? "disabled" : ""}>
                ${busy ? t("auth.busy") : mode === "login" ? t("auth.submitLogin") : t("auth.submitSignup")}
              </button>
            </form>
          </div>
        </div>
      </div>
    `;

    root.querySelector("#auth-lang")?.addEventListener("change", (e) => {
      const v = (e.target as HTMLSelectElement).value as AppLang;
      setLang(v);
      paint();
    });

    root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        mode = btn.dataset.mode as "login" | "register";
        error = "";
        paint();
      });
    });

    const form = root.querySelector("#auth-form") as HTMLFormElement | null;
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy || !isSupabaseConfigured()) return;

      const password = (root.querySelector("#password") as HTMLInputElement).value;
      let email = "";
      let username = "";
      let identifier = "";

      if (mode === "register") {
        email = (root.querySelector("#email") as HTMLInputElement).value;
        username = (root.querySelector("#username") as HTMLInputElement).value;
        const password2 = (root.querySelector("#password2") as HTMLInputElement).value;
        if (password !== password2) {
          error = "Passwords do not match.";
          paint();
          return;
        }
      } else {
        identifier = (root.querySelector("#identifier") as HTMLInputElement).value;
      }

      busy = true;
      error = "";
      paint();

      if (mode === "register") {
        const em = root.querySelector("#email") as HTMLInputElement | null;
        const un = root.querySelector("#username") as HTMLInputElement | null;
        const pw = root.querySelector("#password") as HTMLInputElement | null;
        const p2 = root.querySelector("#password2") as HTMLInputElement | null;
        if (em) em.value = email;
        if (un) un.value = username;
        if (pw) pw.value = password;
        if (p2) p2.value = password;
      } else {
        const id = root.querySelector("#identifier") as HTMLInputElement | null;
        const pw = root.querySelector("#password") as HTMLInputElement | null;
        if (id) id.value = identifier;
        if (pw) pw.value = password;
      }

      let result: AuthResult;
      try {
        result =
          mode === "login"
            ? await login(identifier, password)
            : await register(email, username, password);
      } catch (err) {
        result = {
          ok: false,
          error: err instanceof Error ? err.message : t("common.error"),
        };
      }

      busy = false;
      if (!result.ok) {
        error = result.error;
        paint();
        if (mode === "register") {
          const em = root.querySelector("#email") as HTMLInputElement | null;
          const un = root.querySelector("#username") as HTMLInputElement | null;
          if (em) em.value = email;
          if (un) un.value = username;
        } else {
          const id = root.querySelector("#identifier") as HTMLInputElement | null;
          if (id) id.value = identifier;
        }
        return;
      }

      onAuthed(result.session);
    });
  };

  paint();
}
