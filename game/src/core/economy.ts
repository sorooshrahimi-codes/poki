import type { UpgradeId, UpgradeLevels } from "./types.ts";

// Every tuning number of the upgrade economy lives here, so the simulator and the game agree.

export interface UpgradeDef {
  id: UpgradeId;
  icon: string;
  max: number;
  cost: (level: number) => number;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  line: { id: "line", icon: "🧵", max: 30, cost: (l) => Math.round(25 * Math.pow(1.42, l)) },
  capacity: { id: "capacity", icon: "🪝", max: 12, cost: (l) => Math.round(70 * Math.pow(1.85, l)) },
  luck: { id: "luck", icon: "🍀", max: 15, cost: (l) => Math.round(150 * Math.pow(1.6, l)) },
};
export const UPGRADE_ORDER: UpgradeId[] = ["line", "capacity", "luck"];

export const maxDepth = (u: UpgradeLevels) => 400 + 120 * u.line;
export const capacity = (u: UpgradeLevels) => 3 + u.capacity;
/** multiplies the spawn weight of every non-common rarity */
export const luckMult = (u: UpgradeLevels) => 1 + 0.12 * u.luck;

export function upgradeCost(u: UpgradeLevels, id: UpgradeId): number | null {
  const def = UPGRADES[id];
  return u[id] >= def.max ? null : def.cost(u[id]);
}

/** hook speeds grow with line length so long dives never drag */
export const descendSpeed = (depth: number) => 130 + depth * 0.04;
export const ascendSpeed = (depth: number) => 1.7 * descendSpeed(depth);
