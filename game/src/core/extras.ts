import type { Rng } from "./rng.ts";

// Two light "come back" features for the dock: a lucky wheel and crew fishing trips.
// Pure rules here (tested by the simulator); the UI lives in main.ts.

// ---------------------------------------------------------------- lucky wheel
export type WheelPrize = "coins_s" | "coins_m" | "coins_l" | "jackpot" | "bait" | "map" | "trial" | "coins_s2";
/** the wheel's 8 slices, clockwise from the top */
export const WHEEL: { id: WheelPrize; icon: string; weight: number; color: string }[] = [
  { id: "coins_s", icon: "🪙", weight: 26, color: "#ffd04a" },
  { id: "bait", icon: "🪱", weight: 16, color: "#7be495" },
  { id: "coins_m", icon: "💰", weight: 16, color: "#ff9a3a" },
  { id: "map", icon: "🗺️", weight: 10, color: "#5bc8ff" },
  { id: "coins_s2", icon: "🪙", weight: 18, color: "#ffd04a" },
  { id: "trial", icon: "🎩", weight: 8, color: "#c77dff" },
  { id: "coins_l", icon: "💎", weight: 5, color: "#ff5a8a" },
  { id: "jackpot", icon: "👑", weight: 1, color: "#ffe066" },
];
export const WHEEL_FREE_MS = 4 * 3600_000;
export const WHEEL_AD_SPINS = 3;

export function spinWheel(rng: Rng): number {
  const total = WHEEL.reduce((a, s) => a + s.weight, 0);
  let r = rng() * total;
  for (let i = 0; i < WHEEL.length; i++) { r -= WHEEL[i].weight; if (r <= 0) return i; }
  return 0;
}
/** coin prizes scale with what this player earns in a dive, so the wheel stays exciting all game */
export function wheelCoins(p: WheelPrize, avgDive: number) {
  const base = Math.max(40, avgDive);
  return Math.round(base * (p === "coins_s" || p === "coins_s2" ? 1 : p === "coins_m" ? 2.5 : p === "coins_l" ? 6 : p === "jackpot" ? 15 : 0));
}

// ---------------------------------------------------------------- crew trips
export interface CrewMate { id: string; npc: string; zoneBias: number }
export const CREW: CrewMate[] = [
  { id: "chef", npc: "npc_chef", zoneBias: 0 },
  { id: "scientist", npc: "npc_scientist", zoneBias: 1 },
  { id: "granny", npc: "npc_granny", zoneBias: 2 },
];
/** trip lengths in minutes and what each pays (in average dives) */
export const TRIPS = [
  { min: 5, dives: 2, fish: 1 },
  { min: 20, dives: 6, fish: 2 },
  { min: 60, dives: 14, fish: 4 },
];
export interface Trip { endsAt: number; trip: number; rushed?: boolean }
export const tripCoins = (trip: number, avgDive: number) => Math.round(Math.max(40, avgDive) * TRIPS[trip].dives);
