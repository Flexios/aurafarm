/**
 * Aura Field — slow ink-wash aurora (not particle-network SaaS fluff).
 * Soft pointer lag, sparse motes, respects reduced motion.
 */

type Mote = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  phase: number;
};

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;
let motes: Mote[] = [];
let w = 0;
let h = 0;
let dpr = 1;
let t = 0;
let px = 0.5;
let py = 0.42;
let tpx = 0.5;
let tpy = 0.42;
let running = false;
let bound = false;

const ACCENT: Record<string, [number, number, number]> = {
  purple: [168, 85, 247],
  blue: [56, 132, 255],
  pink: [236, 72, 153],
  green: [16, 185, 129],
};

function accentRgb(): [number, number, number] {
  const a = document.documentElement.dataset.accent || "purple";
  return ACCENT[a] ?? ACCENT.purple!;
}

function reduceMotion(): boolean {
  return (
    document.documentElement.dataset.reduceMotion === "1" ||
    (typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches)
  );
}

function resize(): void {
  if (!canvas) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  w = window.innerWidth;
  h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  const target = Math.min(28, Math.max(14, Math.floor((w * h) / 55000)));
  while (motes.length < target) {
    motes.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.1,
      r: 40 + Math.random() * 90,
      a: 0.03 + Math.random() * 0.05,
      phase: Math.random() * Math.PI * 2,
    });
  }
  if (motes.length > target) motes.length = target;
}

function frame(): void {
  if (!ctx || !canvas) return;
  const c = ctx;
  t += 0.0045;

  // Smooth pointer lag (feels less twitchy)
  px += (tpx - px) * 0.045;
  py += (tpy - py) * 0.045;

  c.clearRect(0, 0, w, h);

  const [ar, ag, ab] = accentRgb();

  // Layered ink bands — slow drift, not confetti
  for (let i = 0; i < 4; i++) {
    const ox = w * (0.2 + i * 0.2) + Math.sin(t * 0.7 + i) * w * 0.06;
    const oy = h * (0.25 + (i % 3) * 0.2) + Math.cos(t * 0.55 + i * 1.3) * h * 0.05;
    const rx = w * (0.35 + i * 0.05);
    const ry = h * (0.22 + i * 0.04);
    const g = c.createRadialGradient(ox, oy, 0, ox, oy, Math.max(rx, ry));
    const a0 = 0.07 - i * 0.01;
    g.addColorStop(0, `rgba(${ar},${ag},${ab},${a0})`);
    g.addColorStop(0.55, `rgba(${ar},${ag},${ab},${a0 * 0.35})`);
    g.addColorStop(1, "transparent");
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(ox, oy, rx, ry, t * 0.15 + i, 0, Math.PI * 2);
    c.fill();
  }

  // Pointer follow wash
  const pg = c.createRadialGradient(px * w, py * h, 0, px * w, py * h, Math.max(w, h) * 0.4);
  pg.addColorStop(0, `rgba(${ar},${ag},${ab},0.09)`);
  pg.addColorStop(0.5, `rgba(${ar},${ag},${ab},0.03)`);
  pg.addColorStop(1, "transparent");
  c.fillStyle = pg;
  c.fillRect(0, 0, w, h);

  // Sparse soft motes
  for (const m of motes) {
    m.phase += 0.008;
    m.x += m.vx + Math.sin(m.phase) * 0.08;
    m.y += m.vy + Math.cos(m.phase * 0.8) * 0.06;
    if (m.x < -m.r) m.x = w + m.r;
    if (m.x > w + m.r) m.x = -m.r;
    if (m.y < -m.r) m.y = h + m.r;
    if (m.y > h + m.r) m.y = -m.r;

    const g = c.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
    const aa = m.a * (0.85 + Math.sin(m.phase) * 0.15);
    g.addColorStop(0, `rgba(255,255,255,${aa * 0.35})`);
    g.addColorStop(0.25, `rgba(${ar},${ag},${ab},${aa})`);
    g.addColorStop(1, "transparent");
    c.fillStyle = g;
    c.beginPath();
    c.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    c.fill();
  }

  // Fine film grain (static noise strip — cheap, non-AI look)
  c.globalAlpha = 0.035;
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    c.fillStyle = Math.random() > 0.5 ? "#fff" : "#000";
    c.fillRect(x, y, 1.2, 1.2);
  }
  c.globalAlpha = 1;

  raf = requestAnimationFrame(frame);
}

function onPointer(e: PointerEvent): void {
  tpx = e.clientX / Math.max(1, w);
  tpy = e.clientY / Math.max(1, h);
}

function bind(): void {
  if (bound) return;
  bound = true;
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onPointer, { passive: true });
}

function unbind(): void {
  if (!bound) return;
  bound = false;
  window.removeEventListener("resize", resize);
  window.removeEventListener("pointermove", onPointer);
}

export function destroyAuraField(): void {
  running = false;
  cancelAnimationFrame(raf);
  unbind();
  canvas?.remove();
  canvas = null;
  ctx = null;
  motes = [];
  document.body.classList.remove("has-aura-field");
}

export function ensureAuraField(): void {
  if (reduceMotion()) {
    destroyAuraField();
    document.body.classList.add("aura-static");
    return;
  }
  document.body.classList.remove("aura-static");
  document.body.classList.add("has-aura-field");

  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.className = "aura-field";
    canvas.setAttribute("aria-hidden", "true");
    document.body.prepend(canvas);
    ctx = canvas.getContext("2d", { alpha: true });
    bind();
    resize();
  }

  if (!running) {
    running = true;
    raf = requestAnimationFrame(frame);
  }
}

export function refreshAuraAccent(): void {
  /* accent sampled live each frame */
}
