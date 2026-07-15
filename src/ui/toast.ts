let timer: number | undefined;

export function showToast(message: string, ms = 2400): void {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("show");
  window.clearTimeout(timer);
  timer = window.setTimeout(() => el?.classList.remove("show"), ms);
}
