import type { Rarity, ZoneId } from "../core/types.ts";

// The story in one line: Captain Bo's logbook has five pages, one Legend of the sea on each.
// Every place has its Legend waiting deep below. Catching fish there fills your line toward it
// (the gauge on the left); when it is full, the next cast goes for the Legend: a three-round fight.
// Beating it opens the next page of the logbook, the next place on the road. Then the Legends come
// back stronger (★2, ★3...), so there is always a next goal.

export const ROAD: ZoneId[] = ["lake", "ocean", "ice", "reef", "volcano"];
export const LEGEND: Record<ZoneId, string> = {
  lake: "old_whiskers", ocean: "grand_marlin", ice: "narwhal_king", reef: "coral_dragon", volcano: "phoenix_fish",
};
/** catch points the line needs to reach each Legend the first time */
const NEED: Record<ZoneId, number> = { lake: 22, ocean: 46, ice: 64, reef: 78, volcano: 92 };
export const legendNeed = (z: ZoneId, tier: number) => Math.round(NEED[z] * (1 + 0.4 * tier));
const POINTS: Record<Rarity, number> = { common: 1, rare: 3, epic: 6, legendary: 10, secret: 12 };
/** how much one catch fills the line toward the Legend (junk does nothing) */
export const chargeFor = (rarity: Rarity, mutated: boolean, junk: boolean) => (junk ? 0 : POINTS[rarity] * (mutated ? 2 : 1));
/** an upgrade also pushes the line a little deeper */
export const CHARGE_PER_UPGRADE = 1;
/** coins for landing a Legend */
export const legendCoins = (value: number, tier: number) => Math.round(value * 2 * (1 + tier));
/** the next place on the road after this one (null after the volcano) */
export const nextPlace = (z: ZoneId): ZoneId | null => ROAD[ROAD.indexOf(z) + 1] ?? null;
