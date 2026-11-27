// Where progress is kept. Most portals: localStorage (guarded: it throws in some private modes and
// sandboxed iframes). Playgama asks games to keep progress in its own storage instead: boot.ts reads
// it before the game starts, so reads stay synchronous; writes go to Playgama in the background.
import { PORTAL } from "./poki.ts";

const cache = new Map<string, string | null>();

export function kvGet(key: string): string | null {
  if (PORTAL === "playgama" && cache.has(key)) return cache.get(key) ?? null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}

export function kvSet(key: string, value: string) {
  if (PORTAL === "playgama" && window.bridge) {
    cache.set(key, value);
    (window.bridge as unknown as { storage: { set(k: string[], v: string[]): Promise<void> } }).storage.set([key], [value]).catch(() => undefined);
    return;
  }
  try { window.localStorage.setItem(key, value); } catch { /* storage unavailable: progress lives for this session */ }
}

/** Playgama only: read the saved keys once, before the game boots */
export async function kvPreload(keys: string[]) {
  const b = window.bridge as unknown as { storage: { get(k: string[]): Promise<(string | null)[]> } } | undefined;
  if (!b) return;
  try { const v = await b.storage.get(keys); keys.forEach((k, i) => { const x = v?.[i] as unknown; cache.set(k, x == null ? null : typeof x === "string" ? x : JSON.stringify(x)); }); } catch { /* start fresh */ }
}
