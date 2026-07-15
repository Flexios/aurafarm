import { aestheticById } from "../data/aesthetics";
import { cosmeticById } from "../data/cosmetics";
import { rankForAura } from "../data/ranks";
import { t } from "../i18n";
import type { PlayerState } from "../types";
import { showToast } from "./toast";

const W = 720;
const H = 1080;

function gradientForBg(id: string, ctx: CanvasRenderingContext2D): CanvasGradient | string {
  const g = ctx.createLinearGradient(0, 0, W, H);
  switch (id) {
    case "bg-sunset":
      g.addColorStop(0, "#7c2d12");
      g.addColorStop(0.5, "#9d174d");
      g.addColorStop(1, "#1e1b4b");
      return g;
    case "bg-mint":
      g.addColorStop(0, "#064e3b");
      g.addColorStop(1, "#0f172a");
      return g;
    case "bg-aurora":
      g.addColorStop(0, "#1e1b4b");
      g.addColorStop(0.45, "#831843");
      g.addColorStop(1, "#083344");
      return g;
    default:
      g.addColorStop(0, "#12081f");
      g.addColorStop(1, "#05030a");
      return g;
  }
}

function frameColor(id: string): string {
  return cosmeticById(id)?.preview ?? "#6b7280";
}

function auraColor(id: string): string {
  return cosmeticById(id)?.preview ?? "#a78bfa";
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("avatar load failed"));
    img.src = url;
  });
}

function drawCoverCircle(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  radius: number,
): void {
  const size = radius * 2;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(size / iw, size / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = cx - dw / 2;
  const dy = cy - dh / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

export async function drawAuraCard(
  canvas: HTMLCanvasElement,
  state: PlayerState,
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = W;
  canvas.height = H;

  const aesthetic = aestheticById(state.core);
  const rank = rankForAura(state.totalAura);
  const bgId = state.equipped.background;
  const frameId = state.equipped.frame;
  const auraId = state.equipped.aura;
  const plateId = state.equipped.nameplate;

  // Background
  ctx.fillStyle = gradientForBg(bgId, ctx) as string;
  ctx.fillRect(0, 0, W, H);

  // Soft orbs
  const aCol = auraColor(auraId);
  for (const [x, y, r, alpha] of [
    [180, 220, 160, 0.25],
    [540, 320, 200, 0.18],
    [360, 780, 220, 0.2],
  ] as const) {
    const grd = ctx.createRadialGradient(x, y, 10, x, y, r);
    grd.addColorStop(0, hexAlpha(aCol, alpha));
    grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Outer frame
  const fCol = frameColor(frameId);
  ctx.lineWidth = 10;
  ctx.strokeStyle = fCol;
  roundRect(ctx, 36, 36, W - 72, H - 72, 48);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  roundRect(ctx, 56, 56, W - 112, H - 112, 40);
  ctx.stroke();

  // Brand
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "700 28px Outfit, system-ui, sans-serif";
  ctx.fillText("AURAFARM", 90, 120);

  // Avatar circle
  const cx = W / 2;
  const cy = 340;
  const glow = ctx.createRadialGradient(cx, cy, 40, cx, cy, 150);
  glow.addColorStop(0, hexAlpha(aCol, 0.55));
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, 150, 0, Math.PI * 2);
  ctx.fill();

  let drewPhoto = false;
  if (state.avatarUrl) {
    try {
      const img = await loadImage(state.avatarUrl);
      // Base fill under photo (letterbox)
      ctx.beginPath();
      ctx.arc(cx, cy, 100, 0, Math.PI * 2);
      const av = ctx.createLinearGradient(cx - 100, cy - 100, cx + 100, cy + 100);
      av.addColorStop(0, aesthetic.colors[0]);
      av.addColorStop(1, aesthetic.colors[1]);
      ctx.fillStyle = av;
      ctx.fill();
      drawCoverCircle(ctx, img, cx, cy, 100);
      drewPhoto = true;
    } catch {
      drewPhoto = false;
    }
  }

  if (!drewPhoto) {
    ctx.beginPath();
    ctx.arc(cx, cy, 100, 0, Math.PI * 2);
    const av = ctx.createLinearGradient(cx - 100, cy - 100, cx + 100, cy + 100);
    av.addColorStop(0, aesthetic.colors[0]);
    av.addColorStop(1, aesthetic.colors[1]);
    ctx.fillStyle = av;
    ctx.fill();
    ctx.font = "80px serif";
    ctx.textAlign = "center";
    ctx.fillText(aesthetic.emoji, cx, cy + 28);
  }

  ctx.beginPath();
  ctx.arc(cx, cy, 100, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = fCol;
  ctx.stroke();

  // Nameplate
  const plate = cosmeticById(plateId)?.preview ?? "#374151";
  ctx.textAlign = "center";
  roundRectFill(ctx, 140, 480, W - 280, 88, 24, plate);
  ctx.fillStyle = "#fff";
  ctx.font = "800 40px Syne, Outfit, system-ui, sans-serif";
  ctx.fillText(state.displayName.slice(0, 18), cx, 536);

  // Stats
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "800 64px Syne, Outfit, system-ui, sans-serif";
  ctx.fillText(`${rank.emoji} ${rank.name}`, cx, 640);

  ctx.font = "600 30px Outfit, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText(`${aesthetic.label} Core · ${state.totalAura.toLocaleString()} Aura`, cx, 690);

  ctx.font = "600 26px Outfit, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillText(
    `🔥 ${state.streak} day streak   ·   ${state.duelWins} duel wins`,
    cx,
    740,
  );

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "700 28px Outfit, system-ui, sans-serif";
  ctx.fillText(`${state.ownedCores.length} cores collected`, cx, 820);

  // Footer
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "600 22px Outfit, system-ui, sans-serif";
  ctx.fillText("Farm your aura. Flex your vibe.", cx, 980);
  ctx.fillText("#AuraFarm", cx, 1015);

  ctx.textAlign = "left";
}

function hexAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return `rgba(168,139,250,${a})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function roundRectFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
): void {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function renderCard(
  container: HTMLElement,
  state: PlayerState,
): void {
  container.innerHTML = `
    <div class="desktop-grid card-layout">
      <div class="card card-preview-wrap home-panel">
        <canvas id="aura-card-canvas" width="720" height="1080" aria-label="Aura card preview"></canvas>
      </div>
      <div class="card card-actions home-panel">
        <h2 style="margin:0">${t("card.title")}</h2>
        <p class="muted" style="margin:8px 0 0">${t("card.blurb")}</p>
        <div class="btn-row card-actions-btns">
          <button class="btn btn-fill" id="download-card">${t("card.download")}</button>
          <button class="btn btn-secondary" id="redraw">${t("card.refresh")}</button>
        </div>
      </div>
    </div>
  `;

  const canvas = container.querySelector("#aura-card-canvas") as HTMLCanvasElement;
  void drawAuraCard(canvas, state);

  container.querySelector("#redraw")?.addEventListener("click", () => {
    void drawAuraCard(canvas, state);
  });
  container.querySelector("#download-card")?.addEventListener("click", async () => {
    await drawAuraCard(canvas, state);
    try {
      const link = document.createElement("a");
      link.download = `aurafarm-${state.displayName || "card"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      showToast("Saved to downloads");
    } catch {
      showToast("Could not export card (photo blocked by browser CORS). Try again later.");
    }
  });
}
