import type { Upgrades } from "./economy.ts";

export interface SaveData {
  v: 1;
  coins: number;
  up: Upgrades;
  /** the index: copies brought to the park per species, and which mutations you have seen */
  index: Record<string, { count: number; muts: string[] }>;
  catches: number;
  /** when the park last paid out (for offline income) */
  lastSeen: number;
  muted: boolean;
  tips: string[];
}

export const newSave = (): SaveData => ({ v: 1, coins: 0, up: { power: 0, range: 0, tank: 0 }, index: {}, catches: 0, lastSeen: Date.now(), muted: false, tips: [] });

const KEY = "crittervac.save.v1";
export function loadSave(): SaveData {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return newSave();
    const d = JSON.parse(raw) as Partial<SaveData>;
    const b = newSave();
    return { ...b, ...d, up: { ...b.up, ...d.up }, index: d.index ?? {} };
  } catch {
    return newSave();
  }
}
export function writeSave(s: SaveData) {
  try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}
