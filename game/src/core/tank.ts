import { FISH, FISH_BY_ID } from "../data/fish.ts";
import { ZONES } from "../data/world.ts";
import type { Rng } from "./rng.ts";
import type { Rarity, ZoneId } from "./types.ts";

// Keep-and-merge: kept fish live in your tank. Three of a kind merge into the next star.
// Kept fish (a) earn in the aquarium while you are away and (b) fill customer orders.
// Every repeated catch now has a use.

/** counts per star level: [★1, ★2, ★3] */
export type TankEntry = [number, number, number];
export type Tank = Record<string, TankEntry>;

export const MERGE_COUNT = 3;
/** how much a fish at each star is worth to the aquarium, relative to ★1 */
export const STAR_POWER = [1, 4, 12];
/** sell price of a fish at each star, relative to its base value */
export const STAR_VALUE = [1, 3.6, 11];

export function keep(tank: Tank, id: string) {
  const e = (tank[id] ??= [0, 0, 0]);
  e[0]++;
}

/** merge 3 of a star into 1 of the next; returns the new star (2 or 3) or 0 if not possible */
export function merge(tank: Tank, id: string, star: 1 | 2): number {
  const e = tank[id];
  if (!e || e[star - 1] < MERGE_COUNT) return 0;
  e[star - 1] -= MERGE_COUNT;
  e[star]++;
  return star + 1;
}

export const bestStar = (e: TankEntry) => (e[2] ? 3 : e[1] ? 2 : e[0] ? 1 : 0);
export const tankPower = (id: string, e: TankEntry) => FISH_BY_ID[id].value * (e[0] * STAR_POWER[0] + e[1] * STAR_POWER[1] + e[2] * STAR_POWER[2]);

// ---------------------------------------------------------------- orders
export type OrderNeed = { kind: "fish"; fish: string; count: number } | { kind: "rarity"; rarity: Rarity; zone: ZoneId; count: number };

export interface Order {
  id: number;
  /** which character asks (portrait) */
  npc: number;
  need: OrderNeed;
  coins: number;
  /** some orders also pay bait casts */
  bait?: { id: string; uses: number };
}

/** ★1 fish in the tank that satisfy an order need */
export function matching(tank: Tank, need: OrderNeed): string[] {
  const ids = need.kind === "fish" ? [need.fish] : FISH.filter((f) => f.zone === need.zone && f.rarity === need.rarity && !f.junk).map((f) => f.id);
  return ids.filter((id) => (tank[id]?.[0] ?? 0) > 0);
}

export function canFill(tank: Tank, o: Order): boolean {
  const ids = matching(tank, o.need);
  return ids.reduce((a, id) => a + tank[id][0], 0) >= o.need.count;
}

/** remove the delivered fish from the tank (★1 only; stars are your trophies) */
export function fill(tank: Tank, o: Order): boolean {
  if (!canFill(tank, o)) return false;
  let left = o.need.count;
  for (const id of matching(tank, o.need)) {
    const take = Math.min(left, tank[id][0]);
    tank[id][0] -= take;
    left -= take;
    if (left <= 0) break;
  }
  return true;
}

/**
 * A new order from the zones you have opened: mostly species you can catch now (often ones you
 * already know, so the request is clear), sometimes "any rare from the ocean", worth 2.5-3.5x the
 * fish's sell value, so keeping fish for orders beats selling them.
 */
export function newOrder(zones: ZoneId[], known: Set<string>, rng: Rng, npcCount: number): Order {
  const zone = zones[Math.floor(rng() * zones.length)];
  const pool = FISH.filter((f) => f.zone === zone && !f.junk && !f.event && f.rarity !== "secret" && f.rarity !== "legendary");
  const knownPool = pool.filter((f) => known.has(f.id));
  const useRarity = rng() < 0.25;
  let need: OrderNeed;
  let unit: number;
  if (useRarity) {
    const rarity: Rarity = rng() < 0.75 ? "rare" : "epic";
    const fits = pool.filter((f) => f.rarity === rarity);
    unit = fits.reduce((a, f) => a + f.value, 0) / Math.max(1, fits.length);
    need = { kind: "rarity", rarity, zone, count: rarity === "rare" ? 2 : 1 };
  } else {
    const src = knownPool.length && rng() < 0.8 ? knownPool : pool;
    const f = src[Math.floor(rng() * src.length)];
    const count = f.rarity === "common" ? 2 + Math.floor(rng() * 3) : f.rarity === "rare" ? 1 + Math.floor(rng() * 2) : 1;
    unit = f.value;
    need = { kind: "fish", fish: f.id, count };
  }
  const coins = Math.round(unit * need.count * (2.5 + rng()));
  const baits = ["worm", "shrimp", "golden", "firefly"];
  const bait = rng() < 0.3 ? { id: baits[Math.floor(rng() * baits.length)], uses: 3 } : undefined;
  void ZONES;
  return { id: Math.floor(rng() * 1e9), npc: Math.floor(rng() * npcCount), need, coins, bait };
}

export const ORDER_SLOTS = 3;
