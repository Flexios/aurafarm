import { coresFromIds } from "../data/cores";
import type { CoreDef } from "../types";
import { escapeHtml } from "../utils/format";

/** HTML for a list of collectible cores (chips). */
export function collectiblesHtml(
  ownedIds: string[] | null | undefined,
  emptyText = "No collectibles yet.",
): string {
  const cores = coresFromIds(ownedIds);
  if (!cores.length) {
    return `<div class="card"><p class="muted" style="margin:0">${escapeHtml(emptyText)}</p></div>`;
  }
  return `<div class="card" style="padding:14px 16px"><div class="core-list">${cores
    .map((c) => coreChipHtml(c))
    .join("")}</div></div>`;
}

export function coreChipHtml(c: CoreDef): string {
  const exclusive = c.exclusive ? " core-chip-exclusive" : "";
  const title = c.exclusive
    ? `${c.name} — ${c.description} (exclusive)`
    : `${c.name} — ${c.description}`;
  return `<span class="core-chip${exclusive} rarity-${c.rarity}" title="${escapeHtml(title)}">${c.emoji} ${escapeHtml(c.name)}</span>`;
}
