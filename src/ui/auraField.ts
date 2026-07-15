/**
 * Interactive Aura Field — full-viewport animated nebula behind the app.
 * Pointer-reactive particles; respects reduced-motion.
 */

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
  a: number;
  pulse: number;
  pulseSpd: number;
};

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;
let particles: Particle[] = [];
let w = 0;
let h = 0;
let dpr = 1;
let pointerX = 0.5;
let pointerY = 0.5;
let pointerDown = false;
let running = false;
let bound = false;

const ACCENT_HUE: Record<string, number> = {
  purple: 285,
  blue: 215,
  pink: 325,
  green: 155,
};

function accentHue(): number {
  const a = document.documentElement.dataset.accent || "purple";
  return ACCENT_HUE[a] ?? 285;
}

function reduceMotion(): boolean {
  return (
    document.documentElement.dataset.reduceMotion === "1" ||
    (typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches)
  );
}

function spawn(n: number): void {
  const hue = accentHue();
  for (let i = 0; i < n; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: 1.2 + Math.random() * 3.2,
      hue: hue + (Math.random() - 0.5) * 40,
      a: 0.15 + Math.random() * 0.45,
      pulse: Math.random() * Math.PI * 2,
      pulseSpd: 0.008 + Math.random() * 0.02,
    });
  }
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
  const target = Math.min(90, Math.floor((w * h) / 18000));
  if (particles.length < target) spawn(target - particles.length);
  else if (particles.length > target + 20) particles.length = target;
}

function frame(): void {
  if (!ctx || !canvas) return;
  const c = ctx;
  c.clearRect(0, 0, w, h);

  // Soft nebula washes
  const g1 = c.createRadialGradient(
    pointerX * w,
    pointerY * h,
    0,
    pointerX * w,
    pointerY * h,
    Math.max(w, h) * 0.55,
  );
  const hue = accentHue();
  g1.addColorStop(0, `hsla(${hue}, 90%, 55%, 0.14)`);
  g1.addColorStop(0.45, `hsla(${hue + 30}, 80%, 40%, 0.06)`);
  g1.addColorStop(1, "transparent");
  c.fillStyle = g1;
  c.fillRect(0, 0, w, h);

  const g2 = c.createRadialGradient(w * 0.15, h * 0.2, 0, w * 0.15, h * 0.2, w * 0.5);
  g2.addColorStop(0, `hsla(${hue - 40}, 85%, 50%, 0.1)`);
  g2.addColorStop(1, "transparent");
  c.fillStyle = g2;
  c.fillRect(0, 0, w, h);

  const g3 = c.createRadialGradient(w * 0.85, h * 0.75, 0, w * 0.85, h * 0.75, w * 0.45);
  g3.addColorStop(0, `hsla(${hue + 55}, 90%, 55%, 0.08)`);
  g3.addColorStop(1, "transparent");
  c.fillStyle = g3;
  c.fillRect(0, 0, w, h);

  const px = pointerX * w;
  const py = pointerY * h;
  const pull = pointerDown ? 0.085 : 0.028;

  for (const p of particles) {
    const dx = px - p.x;
    const dy = py - p.y;
    const dist = Math.hypot(dx, dy) + 0.001;
    p.vx += (dx / dist) * pull * (40 / dist);
    p.vy += (dy / dist) * pull * (40 / dist);
    p.vx *= 0.97;
    p.vy *= 0.97;
    p.x += p.vx;
    p.y += p.vy;
    p.pulse += p.pulseSpd;

    if (p.x < -20) p.x = w + 20;
    if (p.x > w + 20) p.x = -20;
    if (p.y < -20) p.y = h + 20;
    if (p.y > h + 20) p.y = -20;

    const glow = p.r * (1.4 + Math.sin(p.pulse) * 0.35);
    const alpha = p.a * (0.75 + Math.sin(p.pulse * 1.3) * 0.25);
    const grd = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, glow * 4);
    grd.addColorStop(0, `hsla(${p.hue}, 95%, 70%, ${alpha})`);
    grd.addColorStop(0.4, `hsla(${p.hue}, 90%, 55%, ${alpha * 0.35})`);
    grd.addColorStop(1, "transparent");
    c.fillStyle = grd;
    c.beginPath();
    c.arc(p.x, p.y, glow * 4, 0, Math.PI * 2);
    c.fill();
  }

  // Link nearby particles lightly
  c.lineWidth = 0.6;
  for (let i = 0; i < particles.length; i++) {
    const a = particles[i]!;
    for (let j = i + 1; j < particles.length; j++) {
      const b = particles[j]!;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 110) {
        c.strokeStyle = `hsla(${(a.hue + b.hue) / 2}, 80%, 65%, ${0.08 * (1 - d / 110)})`;
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.stroke();
      }
    }
  }

  raf = requestAnimationFrame(frame);
}

function onPointer(e: PointerEvent): void {
  pointerX = e.clientX / Math.max(1, w);
  pointerY = e.clientY / Math.max(1, h);
}

function onDown(e: PointerEvent): void {
  pointerDown = true;
  onPointer(e);
  // Burst of sparks at click
  const hue = accentHue();
  for (let i = 0; i < 8; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 1 + Math.random() * 2.5;
    particles.push({
      x: e.clientX,
      y: e.clientY,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      r: 1.5 + Math.random() * 2.5,
      hue: hue + (Math.random() - 0.5) * 50,
      a: 0.5 + Math.random() * 0.4,
      pulse: Math.random() * Math.PI * 2,
      pulseSpd: 0.03 + Math.random() * 0.04,
    });
  }
  if (particles.length > 140) particles.splice(0, particles.length - 140);
}

function onUp(): void {
  pointerDown = false;
}

function bind(): void {
  if (bound) return;
  bound = true;
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });
  window.addEventListener("pointerleave", onUp, { passive: true });
}

function unbind(): void {
  if (!bound) return;
  bound = false;
  window.removeEventListener("resize", resize);
  window.removeEventListener("pointermove", onPointer);
  window.removeEventListener("pointerdown", onDown);
  window.removeEventListener("pointerup", onUp);
  window.removeEventListener("pointerleave", onUp);
}

export function destroyAuraField(): void {
  running = false;
  cancelAnimationFrame(raf);
  unbind();
  canvas?.remove();
  canvas = null;
  ctx = null;
  particles = [];
  document.body.classList.remove("has-aura-field");
}

/** Mount or refresh the interactive background (safe to call often). */
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
    ctx = canvas.getContext("2d");
    bind();
    resize();
    spawn(Math.min(80, Math.floor((w * h) / 18000)));
  }

  if (!running) {
    running = true;
    raf = requestAnimationFrame(frame);
  }
}

/** Re-tint particles when accent theme changes. */
export function refreshAuraAccent(): void {
  const hue = accentHue();
  for (const p of particles) {
    p.hue = hue + (Math.random() - 0.5) * 40;
  }
}
