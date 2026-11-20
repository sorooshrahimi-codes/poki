import type { EventDef, MutationDef, Rarity, ZoneDef, ZoneId } from "../core/types.ts";

export const ZONES: Record<ZoneId, ZoneDef> = {
  lake: { id: "lake", floor: 1650, price: 0, water: ["#5cc6e0", "#2a7f9e", "#123a4f"] },
  ocean: { id: "ocean", floor: 3650, price: 1200, water: ["#3aa7e8", "#14558f", "#060f2b"] },
  ice: { id: "ice", floor: 2800, price: 6000, water: ["#6fd3ee", "#1f7aa6", "#082238"], ice: true },
};
export const ZONE_ORDER: ZoneId[] = ["lake", "ocean", "ice"];

/** spawn weight per rarity (before luck and events) */
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 70, rare: 12, epic: 5, legendary: 3.2, secret: 2.5 };
export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#cfd8dc", rare: "#4fc3f7", epic: "#c77dff", legendary: "#ffc93c", secret: "#ff4d8d",
};
export const RARITY_ORDER: Rarity[] = ["common", "rare", "epic", "legendary", "secret"];
/** fish of these rarities fight back when hooked: green-zone size and how fast the fish pulls */
export const FIGHT: Partial<Record<Rarity, { half: number; speed: number }>> = {
  epic: { half: 0.17, speed: 1 },
  legendary: { half: 0.15, speed: 1.12 },
  secret: { half: 0.13, speed: 1.35 },
};

export const MUTATIONS: MutationDef[] = [
  { id: "gold", chance: 0.035, mult: 3 },
  { id: "rainbow", chance: 0.007, mult: 6 },
  { id: "giant", chance: 0.025, mult: 2.5 },
  { id: "ghost", chance: 0.04, mult: 4, night: true },
  { id: "electric", chance: 0.1, mult: 5, event: "meteor" },
];

export const EVENTS: EventDef[] = [
  { id: "blood_moon", icon: "🌕", tint: "#ff3355", rarity: { legendary: 3, epic: 1.5 } },
  { id: "meteor", icon: "☄️", tint: "#ffd166", mutation: { electric: 1 } },
  { id: "rainbow_sky", icon: "🌈", tint: "#9be7ff", mutation: { rainbow: 5 } },
  { id: "golden_hour", icon: "✨", tint: "#ffcf5a", mutation: { gold: 4 } },
];

/** world events are computed from the UTC clock: every player sees the same one, no server needed */
export const EVENT_SLOT_MS = 20 * 60_000;
export const EVENT_LENGTH_MS = 3 * 60_000;
/** a brand-new player gets a personal event this long into their first session */
export const FIRST_EVENT_AFTER_MS = 4 * 60_000;
