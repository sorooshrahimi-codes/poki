import { readSave, type SaveData } from "../core/save.ts";

const KEY = "deepluck.save.v1";

// localStorage throws in some incognito modes and sandboxed iframes: never let that crash the game
export function loadSave(): SaveData {
  try {
    return readSave(window.localStorage.getItem(KEY));
  } catch {
    return readSave(null);
  }
}

export function writeSave(s: SaveData) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: progress lives for this session only */
  }
}
