import type { Upgrades } from "./economy.ts";
import type { BiomeId } from "./types.ts";
import type { Egg } from "./eggs.ts";
import type { Lang } from "../i18n.ts";

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
  biome: BiomeId;
  biomes: BiomeId[];
  /** eggs waiting in the nest */
  nest: Egg[];
  /** giants beaten so far: the step on the giant ladder */
  giantWins?: number;
  /** the suction style in use */
  skin?: string;
  /** places whose colour is back (their giant boss was caught) */
  restored?: string[];
  /** the legend that comes along on the hunt */
  companion?: string | null;
  /** best 60-second rush score */
  rushBest?: number;
  /** language the player picked; unset means follow the browser */
  lang?: Lang | null;
}

export const newSave = (): SaveData => ({ v: 1, coins: 0, up: { power: 0, range: 0, tank: 0 }, index: {}, catches: 0, lastSeen: Date.now(), muted: false, tips: [], biome: "meadow", biomes: ["meadow"], nest: [] });

// v2: the giant version starts everyone fresh (old saves had bought places and maxed vacuums)
const KEY = "crittervac.save.v2";
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
