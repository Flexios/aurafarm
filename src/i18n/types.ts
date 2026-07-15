/** Supported UI languages. English is the default. */
export type AppLang = "en" | "de" | "fr" | "zh" | "es";

export const APP_LANGS: AppLang[] = ["en", "de", "fr", "zh", "es"];

export interface LangMeta {
  id: AppLang;
  /** English name for the option list */
  name: string;
  /** Native endonym shown in the picker */
  native: string;
}

export const LANG_META: LangMeta[] = [
  { id: "en", name: "English", native: "English" },
  { id: "de", name: "German", native: "Deutsch" },
  { id: "fr", name: "French", native: "Français" },
  { id: "zh", name: "Chinese", native: "中文" },
  { id: "es", name: "Spanish", native: "Español" },
];

export function isAppLang(v: unknown): v is AppLang {
  return typeof v === "string" && (APP_LANGS as string[]).includes(v);
}
