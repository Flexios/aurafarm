import { BATTLE_PASS, COSMETICS, cosmeticById } from "../data/cosmetics";
import {
  buyCosmetic,
  buyGlowPack,
  claimBattlePassTier,
  equipCosmetic,
  unlockBattlePassPremium,
} from "../game/economy";
import type { CosmeticSlot, PlayerState } from "../types";
import { escapeHtml } from "../utils/format";
import { icon, type IconName } from "./icons";
import { showToast } from "./toast";

const SLOT_META: Record<CosmeticSlot, { label: string; ico: IconName }> = {
  frame: { label: "Frames", ico: "frame" },
  aura: { label: "Auras", ico: "aura" },
  nameplate: { label: "Nameplates", ico: "nameplate" },
  background: { label: "Backgrounds", ico: "background" },
};

function priceHtml(item: {
  free?: boolean;
  priceSparks: number;
  priceGlow: number;
}): string {
  if (item.free) return `<span class="price-line muted">Free starter</span>`;
  const parts: string[] = [];
  if (item.priceSparks > 0) {
    parts.push(
      `<span class="price-chip" title="Sparks">${icon("spark", "icon icon-sm")} ${item.priceSparks}</span>`,
    );
  }
  if (item.priceGlow > 0) {
    parts.push(
      `<span class="price-chip glow" title="Glow">${icon("glow", "icon icon-sm")} ${item.priceGlow}</span>`,
    );
  }
  return `<span class="price-line">${parts.join("")}</span>`;
}

export function renderShop(
  container: HTMLElement,
  state: PlayerState,
  onState: (s: PlayerState) => void,
): void {
  let tab: "cosmetics" | "glow" | "pass" = "cosmetics";

  const paint = () => {
    container.innerHTML = `
      <div class="segmented">
        <button type="button" data-tab="cosmetics" class="${tab === "cosmetics" ? "active" : ""}">${icon("shop", "icon icon-sm")} Cosmetics</button>
        <button type="button" data-tab="glow" class="${tab === "glow" ? "active" : ""}">${icon("glow", "icon icon-sm")} Glow</button>
        <button type="button" data-tab="pass" class="${tab === "pass" ? "active" : ""}">${icon("pass", "icon icon-sm")} Pass</button>
      </div>
      <div id="shop-body"></div>
    `;

    container.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        tab = btn.dataset.tab as typeof tab;
        paint();
      });
    });

    const body = container.querySelector("#shop-body")!;
    if (tab === "cosmetics") renderCosmetics(body);
    else if (tab === "glow") renderGlow(body);
    else renderPass(body);
  };

  const renderCosmetics = (body: Element) => {
    const slots = ["frame", "aura", "nameplate", "background"] as const;
    body.innerHTML = slots
      .map((slot) => {
        const meta = SLOT_META[slot];
        const items = COSMETICS.filter((c) => c.slot === slot);
        return `
          <div class="section-title">
            <h3 class="section-title-with-icon">${icon(meta.ico, "icon icon-sm")} ${meta.label}</h3>
          </div>
          <div class="shop-grid">
          ${items
            .map((item) => {
              const owned = state.ownedCosmetics.includes(item.id);
              const equipped = state.equipped[slot] === item.id;
              return `
                <div class="shop-item">
                  <div class="swatch" style="background:${item.preview}" aria-hidden="true">
                    ${icon(meta.ico, "icon icon-swatch")}
                  </div>
                  <div class="meta">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span class="rarity ${item.rarity}">${item.rarity}</span>
                    ${priceHtml(item)}
                  </div>
                  <div class="mini-actions">
                    ${
                      owned
                        ? `<button type="button" class="btn ${equipped ? "owned" : ""}" data-equip="${item.id}">${equipped ? "Equipped" : "Equip"}</button>`
                        : `
                          ${
                            item.priceSparks > 0 || item.free
                              ? `<button type="button" class="btn" data-buy-sparks="${item.id}" ${item.free ? "disabled" : ""} title="Buy with Sparks">${
                                  item.free
                                    ? "Owned"
                                    : `${icon("spark", "icon icon-sm")} Buy`
                                }</button>`
                              : ""
                          }
                          ${
                            item.priceGlow > 0
                              ? `<button type="button" class="btn" data-buy-glow="${item.id}" title="Buy with Glow">${icon("glow", "icon icon-sm")} Buy</button>`
                              : ""
                          }
                        `
                    }
                  </div>
                </div>
              `;
            })
            .join("")}
          </div>
        `;
      })
      .join("");

    body.querySelectorAll<HTMLButtonElement>("[data-equip]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = equipCosmetic(state, btn.dataset.equip!);
        onState(next);
        state = next;
        showToast("Equipped. Check your Card.");
        paint();
      });
    });

    body.querySelectorAll<HTMLButtonElement>("[data-buy-sparks]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const res = buyCosmetic(state, btn.dataset.buySparks!, "sparks");
        if (!res.ok) {
          showToast(res.reason);
          return;
        }
        onState(res.state);
        state = res.state;
        showToast(`Owned ${cosmeticById(btn.dataset.buySparks!)?.name ?? "item"}`);
        paint();
      });
    });

    body.querySelectorAll<HTMLButtonElement>("[data-buy-glow]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const res = buyCosmetic(state, btn.dataset.buyGlow!, "glow");
        if (!res.ok) {
          showToast(res.reason);
          return;
        }
        onState(res.state);
        state = res.state;
        showToast("Premium drip secured.");
        paint();
      });
    });
  };

  const renderGlow = (body: Element) => {
    body.innerHTML = `
      <div class="section-header">Demo Packs</div>
      <p class="muted" style="margin:0 0 12px;padding:0 4px">No real charges. Premium currency for cosmetics and pass.</p>
      <div class="pack-grid">
        <div class="pack">
          <div class="pack-icon" aria-hidden="true">${icon("glow")}</div>
          <div>
            <strong>Starter</strong>
            <span class="price-line">
              <span class="price-chip glow" title="Glow">${icon("glow", "icon icon-sm")} 40</span>
              <span class="price-chip" title="Sparks">${icon("spark", "icon icon-sm")} 50</span>
            </span>
          </div>
          <button class="btn btn-fill" data-pack="starter">Get</button>
        </div>
        <div class="pack">
          <div class="pack-icon" aria-hidden="true">${icon("star")}</div>
          <div>
            <strong>Hype</strong>
            <span class="price-line">
              <span class="price-chip glow" title="Glow">${icon("glow", "icon icon-sm")} 120</span>
              <span class="price-chip" title="Sparks">${icon("spark", "icon icon-sm")} 150</span>
            </span>
          </div>
          <button class="btn btn-fill" data-pack="hype">Get</button>
        </div>
        <div class="pack">
          <div class="pack-icon" aria-hidden="true">${icon("pass")}</div>
          <div>
            <strong>Mogul</strong>
            <span class="price-line">
              <span class="price-chip glow" title="Glow">${icon("glow", "icon icon-sm")} 300</span>
              <span class="price-chip" title="Sparks">${icon("spark", "icon icon-sm")} 400</span>
            </span>
          </div>
          <button class="btn btn-fill" data-pack="mogul">Get</button>
        </div>
      </div>
    `;

    body.querySelectorAll<HTMLButtonElement>("[data-pack]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pack = btn.dataset.pack as "starter" | "hype" | "mogul";
        const next = buyGlowPack(state, pack);
        onState(next);
        state = next;
        showToast("Glow delivered (demo purchase).");
        paint();
      });
    });
  };

  const renderPass = (body: Element) => {
    body.innerHTML = `
      <div class="card">
        <h3 class="section-title-with-icon">${icon("pass", "icon icon-sm")} Season 1 — Soft Launch</h3>
        <p class="muted" style="margin:0 0 10px">Level ${state.battlePassLevel}/10. Play dailies to level up. ${
          state.battlePassPremium
            ? "Premium track unlocked."
            : "Free track active — unlock Premium for full drip."
        }</p>
        ${
          state.battlePassPremium
            ? ""
            : `<button class="btn btn-fill" id="unlock-bp">Unlock Premium (demo)</button>`
        }
        <div class="progress" style="margin-top:12px"><i style="width:${(state.battlePassLevel / 10) * 100}%"></i></div>
      </div>
      <div style="margin-top:12px">
        ${BATTLE_PASS.map((tier) => {
          const unlocked = state.battlePassLevel >= tier.level;
          const freeClaimed = state.claimedFreeTiers.includes(tier.level);
          const premClaimed = state.claimedPremiumTiers.includes(tier.level);
          return `
            <div class="bp-tier">
              <div class="level-badge ${unlocked ? "unlocked" : ""}">${tier.level}</div>
              <div class="bp-tracks">
                <div class="bp-track">
                  <small>FREE</small>
                  <button type="button" data-claim-free="${tier.level}" class="${freeClaimed ? "claimed" : ""}" ${
                    !unlocked || freeClaimed ? "disabled" : ""
                  }>${freeClaimed ? "Claimed ✓" : escapeHtml(tier.freeReward.label)}</button>
                </div>
                <div class="bp-track">
                  <small>PREMIUM</small>
                  <button type="button" data-claim-prem="${tier.level}" class="${premClaimed ? "claimed" : ""}" ${
                    !unlocked || !state.battlePassPremium || premClaimed ? "disabled" : ""
                  }>${premClaimed ? "Claimed ✓" : escapeHtml(tier.premiumReward.label)}</button>
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    body.querySelector("#unlock-bp")?.addEventListener("click", () => {
      const next = unlockBattlePassPremium(state);
      onState(next);
      state = next;
      showToast("Premium Battle Pass unlocked (demo).");
      paint();
    });

    body.querySelectorAll<HTMLButtonElement>("[data-claim-free]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const level = Number(btn.dataset.claimFree);
        const res = claimBattlePassTier(state, level, "free");
        if (!res.ok) {
          showToast(res.reason);
          return;
        }
        onState(res.state);
        state = res.state;
        showToast(`Claimed ${res.label}`);
        paint();
      });
    });

    body.querySelectorAll<HTMLButtonElement>("[data-claim-prem]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const level = Number(btn.dataset.claimPrem);
        const res = claimBattlePassTier(state, level, "premium");
        if (!res.ok) {
          showToast(res.reason);
          return;
        }
        onState(res.state);
        state = res.state;
        showToast(`Claimed ${res.label}`);
        paint();
      });
    });
  };

  paint();
}
