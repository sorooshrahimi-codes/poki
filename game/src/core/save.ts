import { newDirector, type DirectorState } from "./director.ts";
import type { Lang, MutationId, UpgradeLevels, ZoneId } from "./types.ts";

export interface AlbumEntry {
  count: number;
  muts: MutationId[];
  best: number;
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
}

export const newSave = (): SaveData => ({
  v: 1, coins: 0, upgrades: { line: 0, capacity: 0, luck: 0 }, zones: ["lake"], zone: "lake",
  album: {}, seenEvent: false, muted: false, lang: null, dives: 0, playMs: 0,
  director: newDirector(), mapPieces: 0,
});

/** parse anything (old, partial or broken) into a valid save */
export function readSave(raw: string | null): SaveData {
  const base = newSave();
  if (!raw) return base;
  try {
    const d = JSON.parse(raw);
    if (!d || d.v !== 1) return base;
    return { ...base, ...d, upgrades: { ...base.upgrades, ...d.upgrades }, album: d.album ?? {}, director: { ...base.director, ...d.director } };
  } catch {
    return base;
  }
}
