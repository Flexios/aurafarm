import { MESSAGES, type MessageKey } from "./messages";
import { isAppLang, LANG_META, type AppLang } from "./types";

export type { AppLang, MessageKey };
export { LANG_META, APP_LANGS, isAppLang } from "./types";

const STORAGE_KEY = "aurafarm.lang";

let current: AppLang = "en";

function readStoredLang(): AppLang | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (isAppLang(raw)) return raw;
  } catch {
    /* ignore */
  }
  return null;
}

/** Call early on boot; prefers saved local preference, else English. */
export function initLocale(preferred?: string | null): AppLang {
  if (isAppLang(preferred)) {
    current = preferred;
  } else {
    current = readStoredLang() ?? "en";
  }
  applyDocumentLang(current);
  return current;
}

export function getLang(): AppLang {
  return current;
}

export function setLang(lang: AppLang): void {
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  applyDocumentLang(lang);
}

function applyDocumentLang(lang: AppLang): void {
  if (typeof document === "undefined") return;
  const htmlLang =
    lang === "zh" ? "zh-CN" : lang === "en" ? "en" : lang;
  document.documentElement.lang = htmlLang;
  document.documentElement.dataset.lang = lang;
}

export function langLabel(lang: AppLang): string {
  return LANG_META.find((m) => m.id === lang)?.native ?? lang;
}

/**
 * Translate a UI string. Missing keys fall back to English, then the key itself.
 * Interpolate with `{name}` placeholders.
 */
export function t(
  key: MessageKey | string,
  vars?: Record<string, string | number | null | undefined>,
): string {
  const dict = MESSAGES[current] ?? MESSAGES.en;
  const en = MESSAGES.en;
  let text =
    (dict as Record<string, string>)[key] ??
    (en as Record<string, string>)[key] ??
    key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.split(`{${k}}`).join(v == null ? "" : String(v));
    }
  }
  // Support \n in taglines
  return text;
}

/** Whether a key exists in the English catalog (type-safe usage preferred). */
export function hasMessage(key: string): key is MessageKey {
  return key in MESSAGES.en;
}
