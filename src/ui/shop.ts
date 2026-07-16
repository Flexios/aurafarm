import { BATTLE_PASS, COSMETICS, cosmeticById } from "../data/cosmetics";
import { coreById } from "../data/cores";
import {
  buyCosmetic,
  buyGlowPack,
  claimBattlePassTier,
  equipCosmetic,
  redeemCode,
  unlockBattlePassPremium,
} from "../game/economy";
import {
  cosmeticName,
  coreName,
  rarityLabel,
  rewardLabel,
  t,
} from "../i18n";
import type { CosmeticSlot, PlayerState } from "../types";
import { escapeHtml } from "../utils/format";
import { icon, type IconName } from "./icons";
import { showToast } from "./toast";

/** Client-side redeem throttle (ms between attempts) */
const CODE_COOLDOWN_MS = 1600;
/** After this many failed attempts, longer lockout */
const CODE_FAIL_LOCK_AFTER = 4;
const CODE_FAIL_LOCK_MS = 12_000;

function slotMeta(slot: CosmeticSlot): { label: string; ico: IconName } {
  const map: Record<CosmeticSlot, { label: string; ico: IconName }> = {
    frame: { label: t("shop.frames"), ico: "frame" },
    aura: { label: t("shop.auras"), ico: "aura" },
    nameplate: { label: t("shop.nameplates"), ico: "nameplate" },
    background: { label: t("shop.backgrounds"), ico: "background" },
  };
  return map[slot];
}

function priceHtml(item: {
  free?: boolean;
  priceSparks: number;
  priceGlow: number;
}): string {
  if (item.free) return `<span class="price-line muted">${t("shop.free")}</span>`;
  const parts: string[] = [];
  if (item.priceSparks > 0) {
    parts.push(
      `<span class="price-chip" title="${t("currency.sparks")}">${icon("spark", "icon icon-sm")} ${item.priceSparks}</span>`,
    );
  }
  if (item.priceGlow > 0) {
    parts.push(
      `<span class="price-chip glow" title="${t("currency.glow")}">${icon("glow", "icon icon-sm")} ${item.priceGlow}</span>`,
    );
  }
  return `<span class="price-line">${parts.join("")}</span>`;
}

export function renderShop(
  container: HTMLElement,
  state: PlayerState,
  onState: (s: PlayerState) => void,
): void {
  let tab: "cosmetics" | "glow" | "pass" | "codes" = "cosmetics";
  let lastRedeemAt = 0;
  let failCount = 0;
  let lockUntil = 0;

  const paint = () => {
    container.innerHTML = `
      <div class="segmented shop-tabs">
        <button type="button" data-tab="cosmetics" class="${tab === "cosmetics" ? "active" : ""}">${icon("shop", "icon icon-sm")} <span class="tab-label">${t("shop.cosmetics")}</span></button>
        <button type="button" data-tab="glow" class="${tab === "glow" ? "active" : ""}">${icon("glow", "icon icon-sm")} <span class="tab-label">${t("shop.glow")}</span></button>
        <button type="button" data-tab="pass" class="${tab === "pass" ? "active" : ""}">${icon("pass", "icon icon-sm")} <span class="tab-label">${t("shop.pass")}</span></button>
        <button type="button" data-tab="codes" class="${tab === "codes" ? "active" : ""}">${icon("star", "icon icon-sm")} <span class="tab-label">${t("shop.codes")}</span></button>
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
    else if (tab === "pass") renderPass(body);
    else renderCodes(body);
  };

  const renderCosmetics = (body: Element) => {
    const slots = ["frame", "aura", "nameplate", "background"] as const;
    body.innerHTML = slots
      .map((slot) => {
        const meta = slotMeta(slot);
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
              const name = cosmeticName(item.id, item.name);
              return `
                <div class="shop-item">
                  <div class="swatch" style="background:${item.preview}" aria-hidden="true">
                    ${icon(meta.ico, "icon icon-swatch")}
                  </div>
                  <div class="meta">
                    <strong>${escapeHtml(name)}</strong>
                    <span class="rarity ${item.rarity}">${escapeHtml(rarityLabel(item.rarity))}</span>
                    ${priceHtml(item)}
                  </div>
                  <div class="mini-actions">
                    ${
                      owned
                        ? `<button type="button" class="btn ${equipped ? "owned" : ""}" data-equip="${item.id}">${equipped ? t("shop.equipped") : t("shop.equip")}</button>`
                        : `
                          ${
                            item.priceSparks > 0 || item.free
                              ? `<button type="button" class="btn" data-buy-sparks="${item.id}" ${item.free ? "disabled" : ""} title="${t("currency.sparks")}">${
                                  item.free
                                    ? t("shop.owned")
                                    : `${icon("spark", "icon icon-sm")} ${t("shop.buy")}`
                                }</button>`
                              : ""
                          }
                          ${
                            item.priceGlow > 0
                              ? `<button type="button" class="btn" data-buy-glow="${item.id}" title="${t("currency.glow")}">${icon("glow", "icon icon-sm")} ${t("shop.buy")}</button>`
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
        showToast(t("shop.equippedToast"));
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
        const id = btn.dataset.buySparks!;
        showToast(
          t("shop.ownedToast", {
            name: cosmeticName(id, cosmeticById(id)?.name ?? "item"),
          }),
        );
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
        showToast(t("shop.premiumToast"));
        paint();
      });
    });
  };

  const renderGlow = (body: Element) => {
    body.innerHTML = `
      <div class="section-header">${t("shop.demoPacks")}</div>
      <p class="muted" style="margin:0 0 12px;padding:0 4px">${t("shop.demoPacksBlurb")}</p>
      <div class="pack-grid">
        <div class="pack">
          <div class="pack-icon" aria-hidden="true">${icon("glow")}</div>
          <div>
            <strong>${t("shop.pack.starter")}</strong>
            <span class="price-line">
              <span class="price-chip glow" title="${t("currency.glow")}">${icon("glow", "icon icon-sm")} 40</span>
              <span class="price-chip" title="${t("currency.sparks")}">${icon("spark", "icon icon-sm")} 50</span>
            </span>
          </div>
          <button class="btn btn-fill" data-pack="starter">${t("shop.get")}</button>
        </div>
        <div class="pack">
          <div class="pack-icon" aria-hidden="true">${icon("star")}</div>
          <div>
            <strong>${t("shop.pack.hype")}</strong>
            <span class="price-line">
              <span class="price-chip glow" title="${t("currency.glow")}">${icon("glow", "icon icon-sm")} 120</span>
              <span class="price-chip" title="${t("currency.sparks")}">${icon("spark", "icon icon-sm")} 150</span>
            </span>
          </div>
          <button class="btn btn-fill" data-pack="hype">${t("shop.get")}</button>
        </div>
        <div class="pack">
          <div class="pack-icon" aria-hidden="true">${icon("pass")}</div>
          <div>
            <strong>${t("shop.pack.mogul")}</strong>
            <span class="price-line">
              <span class="price-chip glow" title="${t("currency.glow")}">${icon("glow", "icon icon-sm")} 300</span>
              <span class="price-chip" title="${t("currency.sparks")}">${icon("spark", "icon icon-sm")} 400</span>
            </span>
          </div>
          <button class="btn btn-fill" data-pack="mogul">${t("shop.get")}</button>
        </div>
      </div>
    `;

    body.querySelectorAll<HTMLButtonElement>("[data-pack]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pack = btn.dataset.pack as "starter" | "hype" | "mogul";
        const next = buyGlowPack(state, pack);
        onState(next);
        state = next;
        showToast(t("shop.glowDelivered"));
        paint();
      });
    });
  };

  const renderPass = (body: Element) => {
    const track = state.battlePassPremium
      ? t("shop.passPremiumOn")
      : t("shop.passPremiumOff");
    body.innerHTML = `
      <div class="card">
        <h3 class="section-title-with-icon">${icon("pass", "icon icon-sm")} ${t("shop.passTitle")}</h3>
        <p class="muted" style="margin:0 0 10px">${t("shop.passLevelLine", {
          level: state.battlePassLevel,
          track,
        })}</p>
        ${
          state.battlePassPremium
            ? ""
            : `<button class="btn btn-fill" id="unlock-bp">${t("shop.unlockPremium")}</button>`
        }
        <div class="progress" style="margin-top:12px"><i style="width:${(state.battlePassLevel / 10) * 100}%"></i></div>
      </div>
      <div style="margin-top:12px">
        ${BATTLE_PASS.map((tier) => {
          const unlocked = state.battlePassLevel >= tier.level;
          const freeClaimed = state.claimedFreeTiers.includes(tier.level);
          const premClaimed = state.claimedPremiumTiers.includes(tier.level);
          const freeLabel = rewardLabel(tier.freeReward);
          const premLabel = rewardLabel(tier.premiumReward);
          return `
            <div class="bp-tier">
              <div class="level-badge ${unlocked ? "unlocked" : ""}">${tier.level}</div>
              <div class="bp-tracks">
                <div class="bp-track">
                  <small>${t("shop.freeTrack")}</small>
                  <button type="button" data-claim-free="${tier.level}" class="${freeClaimed ? "claimed" : ""}" ${
                    !unlocked || freeClaimed ? "disabled" : ""
                  }>${freeClaimed ? t("shop.claimed") : escapeHtml(freeLabel)}</button>
                </div>
                <div class="bp-track">
                  <small>${t("shop.premiumTrack")}</small>
                  <button type="button" data-claim-prem="${tier.level}" class="${premClaimed ? "claimed" : ""}" ${
                    !unlocked || !state.battlePassPremium || premClaimed ? "disabled" : ""
                  }>${premClaimed ? t("shop.claimed") : escapeHtml(premLabel)}</button>
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
      showToast(t("shop.passUnlocked"));
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
        const tier = BATTLE_PASS.find((x) => x.level === level);
        showToast(
          t("shop.claimToast", {
            label: tier ? rewardLabel(tier.freeReward) : res.label,
          }),
        );
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
        const tier = BATTLE_PASS.find((x) => x.level === level);
        showToast(
          t("shop.claimToast", {
            label: tier ? rewardLabel(tier.premiumReward) : res.label,
          }),
        );
        paint();
      });
    });
  };

  const renderCodes = (body: Element) => {
    body.innerHTML = `
      <div class="section-header">${t("shop.codes")}</div>
      <p class="muted" style="margin:0 0 14px;padding:0 4px">${t("shop.codesBlurb")}</p>
      <div class="card">
        <div class="field">
          <label for="promo-code">${t("shop.codeEnter")}</label>
          <input id="promo-code" type="text" maxlength="32" autocomplete="off" spellcheck="false" placeholder="${t("shop.codePlaceholder")}" style="text-transform:uppercase" />
        </div>
        <button type="button" class="btn btn-fill" id="redeem-code" style="margin-top:12px">${t("shop.codeRedeem")}</button>
      </div>
      <p class="muted" style="margin:12px 0 0;padding:0 4px;font-size:0.86rem;line-height:1.4">${t("shop.codesHint")}</p>
    `;

    const doRedeem = () => {
      const now = Date.now();
      if (now < lockUntil) {
        showToast(t("shop.codeSlowDown"));
        return;
      }
      if (now - lastRedeemAt < CODE_COOLDOWN_MS) {
        showToast(t("shop.codeSlowDown"));
        return;
      }
      lastRedeemAt = now;

      const input = body.querySelector("#promo-code") as HTMLInputElement;
      const raw = (input?.value ?? "").trim();
      if (!raw) {
        showToast(t("shop.codeInvalid"));
        return;
      }

      const res = redeemCode(state, raw);
      if (!res.ok) {
        failCount += 1;
        if (failCount >= CODE_FAIL_LOCK_AFTER) {
          lockUntil = now + CODE_FAIL_LOCK_MS;
          failCount = 0;
          showToast(t("shop.codeSlowDown"));
          return;
        }
        const reasonKey =
          res.reason === "expired"
            ? "shop.codeExpired"
            : res.reason === "already"
              ? "shop.codeAlready"
              : "shop.codeInvalid";
        showToast(t(reasonKey));
        return;
      }

      failCount = 0;
      onState(res.state);
      state = res.state;
      if (input) input.value = "";

      showToast(
        t("shop.codeSuccess", {
          label: res.label,
          sparks: res.sparks,
          glow: res.glow,
        }),
        2600,
      );

      // Highlight trainer / collectible unlocks (e.g. SIMP → Elise)
      if (res.unlockedCores.length) {
        window.setTimeout(() => {
          for (const id of res.unlockedCores) {
            const core = coreById(id);
            if (!core) continue;
            const name = coreName(core.id, core.name);
            if (id === "elise-sip") {
              showToast(t("shop.codeUnlockElise"), 3200);
            } else {
              showToast(t("shop.codeUnlock", { name }), 3000);
            }
          }
        }, 900);
      }

      paint();
    };

    body.querySelector("#redeem-code")?.addEventListener("click", doRedeem);

    body.querySelector("#promo-code")?.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") doRedeem();
    });
  };

  paint();
}
