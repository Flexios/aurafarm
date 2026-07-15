/** Minimal SF Symbols–style stroke icons (24 viewBox). */

const stroke = `fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"`;

export function icon(name: IconName, className = "icon"): string {
  const path = ICONS[name];
  return `<svg class="${className}" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" ${stroke}>${path}</svg>`;
}

export type IconName =
  | "home"
  | "play"
  | "shop"
  | "card"
  | "duel"
  | "spark"
  | "glow"
  | "person"
  | "check"
  | "chevron"
  | "download"
  | "refresh"
  | "logout"
  | "star"
  | "settings"
  | "frame"
  | "aura"
  | "nameplate"
  | "background"
  | "streak"
  | "pass";

const ICONS: Record<IconName, string> = {
  home: `<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"/>`,
  play: `<circle cx="12" cy="12" r="9"/><path d="M10 9.5v5l4.5-2.5L10 9.5z"/>`,
  shop: `<path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8a3 3 0 0 1 6 0"/>`,
  card: `<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16"/><path d="M8 14h4"/>`,
  duel: `<path d="M7 17 17 7"/><path d="M14 7h3v3"/><path d="M7 17l-2 2"/><path d="M17 7l2-2"/><path d="M9 19H6v-3"/>`,
  spark: `<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="2.5"/>`,
  glow: `<path d="M12 4c-3 4-5 6.5-5 9a5 5 0 0 0 10 0c0-2.5-2-5-5-9z"/>`,
  person: `<circle cx="12" cy="8" r="3.5"/><path d="M5.5 19.5c1.5-3 4-4.5 6.5-4.5s5 1.5 6.5 4.5"/>`,
  check: `<path d="M5 12.5 10 17.5 19 7"/>`,
  chevron: `<path d="M9 6l6 6-6 6"/>`,
  download: `<path d="M12 4v10"/><path d="M8 10l4 4 4-4"/><path d="M5 19h14"/>`,
  refresh: `<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 5v5h-5"/>`,
  logout: `<path d="M10 12h9"/><path d="M15 8l4 4-4 4"/><path d="M13 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h6"/>`,
  star: `<path d="M12 3.5 14.5 9l6 .5-4.5 4 1.5 5.5L12 16.5 6.5 19l1.5-5.5L3.5 9.5 9.5 9 12 3.5z"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`,
  frame: `<rect x="4" y="4" width="16" height="16" rx="3"/><rect x="7.5" y="7.5" width="9" height="9" rx="1.5"/>`,
  aura: `<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" stroke-dasharray="3 3"/>`,
  nameplate: `<rect x="3" y="8" width="18" height="8" rx="2"/><path d="M7 12h10"/>`,
  background: `<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 14l4.5-3.5L12 14l4-3 5 4"/>`,
  streak: `<path d="M12 3c1.5 3 2 5 2 7a4 4 0 1 1-8 0c0-2 .5-4 2-7 1 2 2 3 4 0z"/><path d="M10 17c0 2 1 3 2 3s2-1 2-3"/>`,
  pass: `<path d="M4 7h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7z"/><path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7"/><path d="M9 12h6"/>`,
};
