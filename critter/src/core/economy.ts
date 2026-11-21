// Every tuning number of the upgrade economy, shared by the game and the simulator.
export type UpgradeId = "power" | "range" | "tank";
export type Upgrades = Record<UpgradeId, number>;

export const UPGRADES: Record<UpgradeId, { max: number; cost: (l: number) => number; icon: string }> = {
  power: { max: 100, cost: (l) => Math.round(40 * Math.pow(1.32, l)), icon: "💨" },
  range: { max: 80, cost: (l) => Math.round(60 * Math.pow(1.33, l)), icon: "🌪️" },
  tank: { max: 80, cost: (l) => Math.round(90 * Math.pow(1.35, l)), icon: "💰" },
};
export const UPGRADE_ORDER: UpgradeId[] = ["power", "range", "tank"];
export const upgradeCost = (u: Upgrades, id: UpgradeId) => (u[id] >= UPGRADES[id].max ? null : UPGRADES[id].cost(u[id]));

/** pull strength: how fast a critter with resist 1 is drawn in (units per second) */
export const power = (u: Upgrades) => 170 + 22 * u.power;
/** suction cone length: fixed and generous (on a phone screen reach hardly matters) */
export const range = (_u: Upgrades) => 210;
/** half-angle of the cone (radians): the second upgrade opens the mouth wider, so it grabs more at once */
export const MOUTH_FULL = 38;
export const cone = (u: Upgrades) => 0.36 + 0.018 * Math.min(u.range, MOUTH_FULL);
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
