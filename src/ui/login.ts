import {
  login,
  register,
  type AuthResult,
  type Session,
} from "../auth/auth";
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
    root.innerHTML = `
      <div class="auth-screen auth-layout">
        <div class="auth-hero">
          <div class="logo">AuraFarm</div>
          <p class="muted auth-tagline">Farm your aura. Flex your vibe.<br/>One account for phone and PC. 13+</p>
        </div>

        ${
          configError
            ? `<div class="card"><p class="danger-text">${escapeHtml(configError)}</p>
               <p class="muted" style="margin:10px 0 0;font-size:0.86rem">Set Supabase env vars (see README).</p></div>`
            : ""
        }

        <div class="auth-panel">
          <div class="card stack">
            <div class="segmented">
              <button type="button" data-mode="login" class="${mode === "login" ? "active" : ""}">Log In</button>
              <button type="button" data-mode="register" class="${mode === "register" ? "active" : ""}">Sign Up</button>
            </div>

            <form id="auth-form" class="stack" autocomplete="on">
              ${
                mode === "register"
                  ? `
                <div class="field">
                  <label for="email">Email</label>
                  <input id="email" name="email" type="email" maxlength="120" autocomplete="email" placeholder="name@example.com" required />
                </div>
                <div class="field">
                  <label for="username">Username</label>
                  <input id="username" name="username" maxlength="20" autocomplete="username" placeholder="vibe_curator" spellcheck="false" required />
                </div>
              `
                  : `
                <div class="field">
                  <label for="identifier">Email or Username</label>
                  <input id="identifier" name="identifier" maxlength="120" autocomplete="username" placeholder="name@example.com" spellcheck="false" required />
                </div>
              `
              }
              <div class="field">
                <label for="password">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  maxlength="72"
                  autocomplete="${mode === "register" ? "new-password" : "current-password"}"
                  placeholder="${mode === "register" ? "At least 6 characters" : "Required"}"
                  required
                />
              </div>
              ${
                mode === "register"
                  ? `
                <div class="field">
                  <label for="password2">Confirm Password</label>
                  <input id="password2" name="password2" type="password" maxlength="72" autocomplete="new-password" required />
                </div>
              `
                  : ""
              }

              ${error ? `<p class="danger-text" role="alert">${escapeHtml(error)}</p>` : ""}

              <button class="btn btn-fill" type="submit" ${busy || !isSupabaseConfigured() ? "disabled" : ""}>
                ${busy ? "Please wait…" : mode === "login" ? "Continue" : "Create Account"}
              </button>
            </form>

            <p class="muted" style="font-size:0.82rem;margin:0;text-align:center">
              Demo economy only — no real purchases.
            </p>
          </div>
        </div>
      </div>
    `;

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
          error: err instanceof Error ? err.message : "Something went wrong.",
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
