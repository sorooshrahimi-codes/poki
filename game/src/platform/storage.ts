import { readSave, type SaveData } from "../core/save.ts";
import { kvGet, kvSet } from "./kv.ts";

export const KEY = "deepluck.save.v1";

// localStorage throws in some incognito modes and sandboxed iframes: never let that crash the game
export function loadSave(): SaveData {
  try {
    return readSave(kvGet(KEY));
  } catch {
    return readSave(null);
  }
}

export function writeSave(s: SaveData) {
  try {
    kvSet(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: progress lives for this session only */
  }
}
