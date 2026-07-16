export type ToastKind = "default" | "ok" | "error";

let timer: number | undefined;

/**
 * Lightweight status toast. Prefer kind "ok" / "error" for feedback clarity.
 */
export function showToast(
  message: string,
  ms = 2400,
  kind: ToastKind = "default",
): void {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-atomic", "true");
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.remove("toast-ok", "toast-error", "show");
  if (kind === "ok") el.classList.add("toast-ok");
  if (kind === "error") el.classList.add("toast-error");
  // Force reflow so re-show animates
  void el.offsetWidth;
  el.classList.add("show");
  window.clearTimeout(timer);
  timer = window.setTimeout(() => el?.classList.remove("show"), ms);
}
