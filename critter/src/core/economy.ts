// Every tuning number of the upgrade economy, shared by the game and the simulator.
export type UpgradeId = "power" | "range" | "tank";
export type Upgrades = Record<UpgradeId, number>;

export const UPGRADES: Record<UpgradeId, { max: number; cost: (l: number) => number; icon: string }> = {
  power: { max: 25, cost: (l) => Math.round(40 * Math.pow(1.5, l)), icon: "💨" },
  range: { max: 20, cost: (l) => Math.round(60 * Math.pow(1.55, l)), icon: "📏" },
  tank: { max: 20, cost: (l) => Math.round(90 * Math.pow(1.62, l)), icon: "🫙" },
};
export const UPGRADE_ORDER: UpgradeId[] = ["power", "range", "tank"];
export const upgradeCost = (u: Upgrades, id: UpgradeId) => (u[id] >= UPGRADES[id].max ? null : UPGRADES[id].cost(u[id]));

/** pull strength: how fast a critter with resist 1 is drawn in (units per second) */
export const power = (u: Upgrades) => 170 + 22 * u.power;
/** suction cone length */
export const range = (u: Upgrades) => 125 + 11 * u.range;
/** half-angle of the cone (radians) */
export const CONE = 0.42;
export const tankSize = (u: Upgrades) => 8 + u.tank;
/** coins for each critter caught, on top of park income */
export const catchCoins = (income: number, mult: number) => Math.max(1, Math.round(income * 2 * mult));
/** offline park income stops after this long */
export const OFFLINE_CAP_MS = 2 * 3600_000;
