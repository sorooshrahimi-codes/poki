import { newDirector, type DirectorState } from "./director.ts";
import type { Order, Tank } from "./tank.ts";
import type { Lang, MutationId, UpgradeLevels, ZoneId } from "./types.ts";

export interface AlbumEntry {
  count: number;
  muts: MutationId[];
  best: number;
  /** heaviest one caught */
  bestKg?: number;
}

export interface SaveData {
  v: 1;
  coins: number;
  upgrades: UpgradeLevels;
  zones: ZoneId[];
  zone: ZoneId;
  /** chosen fishing spot on the world map */
  spot?: string;
  album: Record<string, AlbumEntry>;
  seenEvent: boolean;
  muted: boolean;
  lang: Lang | null;
  dives: number;
  playMs: number;
  director: DirectorState;
  mapPieces: number;
  bait: { id: string; uses: number } | null;
  gear: { lantern: number; sonar: number };
  owned: string[];
  wear: { pet: string | null; hat: string | null; outfit?: string | null; boat?: string | null };
  /** a rewarded-ad trial: cosmetic id and dives left */
  trial: { id: string; dives: number } | null;
  aquariumAt: number;
  /** starter missions: index of the current one */
  mission: number;
  stats: { catches: number; fightsWon: number; maxDepth?: number };
  seenGlimpse: boolean;
  tank: Tank;
  orders: Order[];
  prog: { level: number; xp: number };
  league: { week: number; tier: string; points: number; lastResult: { week: number; rank: number; tier: string; moved: number; coins: number } | null };
  derby: { lastAt: number; wins: number; trophies: number };
  daily: { day: number; tries: number; best: number; streak: number; lastDay: number };
  voyage: number;
  /** rolling averages per dive, used to size derby rivals fairly */
  avg: { value: number; count: number; kg: number };
  /** dock buttons the player has already been introduced to */
  seenBtns: string[];
  /** Captain Bo's tips already shown */
  tips: string[];
}

export const newSave = (): SaveData => ({
  v: 1, coins: 0, upgrades: { line: 0, capacity: 0, luck: 0 }, zones: ["lake"], zone: "lake",
  album: {}, seenEvent: false, muted: false, lang: null, dives: 0, playMs: 0,
  director: newDirector(), mapPieces: 0, bait: null, gear: { lantern: 0, sonar: 0 },
  owned: [], wear: { pet: null, hat: null }, trial: null, aquariumAt: 0,
  mission: 0, stats: { catches: 0, fightsWon: 0 }, seenGlimpse: false,
  tank: {}, orders: [],
  prog: { level: 1, xp: 0 },
  league: { week: -1, tier: "bronze", points: 0, lastResult: null },
  derby: { lastAt: 0, wins: 0, trophies: 0 },
  daily: { day: -1, tries: 0, best: 0, streak: 0, lastDay: -1 },
  voyage: 0,
  avg: { value: 30, count: 3, kg: 1 },
  seenBtns: [],
  tips: [],
});

/** parse anything (old, partial or broken) into a valid save */
export function readSave(raw: string | null): SaveData {
  const base = newSave();
  if (!raw) return base;
  try {
    const d = JSON.parse(raw);
    if (!d || d.v !== 1) return base;
    return { ...base, ...d, upgrades: { ...base.upgrades, ...d.upgrades }, album: d.album ?? {}, director: { ...base.director, ...d.director }, gear: { ...base.gear, ...d.gear }, wear: { ...base.wear, ...d.wear }, stats: { ...base.stats, ...d.stats }, prog: { ...base.prog, ...d.prog }, league: { ...base.league, ...d.league }, derby: { ...base.derby, ...d.derby }, daily: { ...base.daily, ...d.daily }, avg: { ...base.avg, ...d.avg } };
  } catch {
    return base;
  }
}
