// Every tuning number of the upgrade economy, shared by the game and the simulator.
export type UpgradeId = "power" | "range" | "tank";
export type Upgrades = Record<UpgradeId, number>;

/** prices climb fast early (every upgrade feels big), then gently after level 26 so late game never stalls */
const soft = (base: number, g: number, l: number) => Math.round(base * Math.pow(g, Math.min(l, 26)) * Math.pow(1.09, Math.max(0, l - 26)));
export const UPGRADES: Record<UpgradeId, { max: number; cost: (l: number) => number; icon: string }> = {
  power: { max: 999, cost: (l) => soft(40, 1.32, l), icon: "💨" },
  range: { max: 999, cost: (l) => soft(60, 1.33, l), icon: "📏" },
  tank: { max: 999, cost: (l) => soft(90, 1.35, l), icon: "💰" },
};
export const UPGRADE_ORDER: UpgradeId[] = ["power", "range", "tank"];
export const upgradeCost = (u: Upgrades, id: UpgradeId) => (u[id] >= UPGRADES[id].max ? null : UPGRADES[id].cost(u[id]));

/** pull strength: how fast a critter with resist 1 is drawn in (units per second) */
export const power = (u: Upgrades) => 170 + 22 * u.power;
/** one button, three stages: first the reach grows (until the cone spans the screen), then the mouth opens wider,
 *  and once it is fully open every further level adds coin value */
export const REACH_FULL = 16;
export const range = (u: Upgrades) => 125 + 11 * Math.min(u.range, REACH_FULL);
/** half-angle of the cone (radians): the second upgrade opens the mouth wider, so it grabs more at once */
export const MOUTH_FULL = REACH_FULL + 34;
export const cone = (u: Upgrades) => 0.42 + 0.018 * Math.max(0, Math.min(u.range, MOUTH_FULL) - REACH_FULL);
/** no jar any more: catches pay at once (kept so old callers still work) */
export const tankSize = (_u: Upgrades) => 1e9;
/** the third upgrade: every catch is worth more */
/** ...and once the mouth is fully open, its further levels add coin value too */
export const valueMult = (u: Upgrades) => 1 + 0.15 * u.tank + 0.12 * Math.max(0, u.range - MOUTH_FULL);
/** coins for each critter caught, on top of park income */
export const catchCoins = (income: number, mult: number) => Math.max(1, Math.round(income * 2 * mult));
/** offline park income stops after this long */
export const OFFLINE_CAP_MS = 2 * 3600_000;

/** the vacuum's level: every upgrade counts, it is what the giants are measured against */
export const vacLevel = (up: Upgrades) => up.power + up.range + up.tank;

/** the vacuum evolves: a new machine at these levels (0 = the starter toy) */
export const TIER_AT = [0, 8, 25, 60];
export const tierOf = (level: number) => TIER_AT.filter((x) => level >= x).length - 1;
