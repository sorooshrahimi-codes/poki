import { newDirector, type DirectorState } from "./director.ts";
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
  wear: { pet: string | null; hat: string | null };
  /** a rewarded-ad trial: cosmetic id and dives left */
  trial: { id: string; dives: number } | null;
  aquariumAt: number;
  /** starter missions: index of the current one */
  mission: number;
  stats: { catches: number; fightsWon: number };
  seenGlimpse: boolean;
}

export const newSave = (): SaveData => ({
  v: 1, coins: 0, upgrades: { line: 0, capacity: 0, luck: 0 }, zones: ["lake"], zone: "lake",
  album: {}, seenEvent: false, muted: false, lang: null, dives: 0, playMs: 0,
  director: newDirector(), mapPieces: 0, bait: null, gear: { lantern: 0, sonar: 0 },
  owned: [], wear: { pet: null, hat: null }, trial: null, aquariumAt: 0,
  mission: 0, stats: { catches: 0, fightsWon: 0 }, seenGlimpse: false,
});

/** parse anything (old, partial or broken) into a valid save */
export function readSave(raw: string | null): SaveData {
  const base = newSave();
  if (!raw) return base;
  try {
    const d = JSON.parse(raw);
    if (!d || d.v !== 1) return base;
    return { ...base, ...d, upgrades: { ...base.upgrades, ...d.upgrades }, album: d.album ?? {}, director: { ...base.director, ...d.director }, gear: { ...base.gear, ...d.gear }, wear: { ...base.wear, ...d.wear }, stats: { ...base.stats, ...d.stats } };
  } catch {
    return base;
  }
}
