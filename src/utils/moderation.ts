/**
 * Lightweight name moderation (usernames, display names, bios).
 * Checks normalized substrings; not a full NLP filter.
 */

const FORBIDDEN_TERMS = [
  "faggot",
  "faggots",
  "retard",
  "retarded",
  "nigger",
  "niggers",
  "nigga",
  "niggas",
] as const;

/** Collapse leetspeak-ish substitutions for matching. */
function normalizeForModeration(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/\$/g, "s")
    .replace(/@/g, "a")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Returns an error message if text contains a forbidden term, else null.
 */
export function forbiddenLanguageError(
  text: string,
  fieldLabel = "That name",
): string | null {
  if (!text || !text.trim()) return null;
  const norm = normalizeForModeration(text);
  for (const term of FORBIDDEN_TERMS) {
    if (norm.includes(term)) {
      return `${fieldLabel} is not allowed.`;
    }
  }
  return null;
}
