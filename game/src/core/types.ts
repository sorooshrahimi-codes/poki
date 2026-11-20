// Shared types. Everything under src/core and src/data is pure (no DOM): the game, the
// economy simulator (tools/sim.ts) and the AI content studio all use the same rules.

export type Lang = "en" | "es" | "pt" | "hi" | "ja";
export type Rarity = "common" | "rare" | "epic" | "legendary" | "secret";
export type MutationId = "gold" | "rainbow" | "giant" | "ghost" | "electric";
export type ZoneId = "lake" | "ocean" | "ice";
export type EventId = "blood_moon" | "meteor" | "rainbow_sky" | "golden_hour";
export type Shape = "fish" | "eel" | "puffer" | "jelly" | "boot" | "can" | "duck" | "crab";

export interface FishLook {
  shape: Shape;
  body: string;
  belly: string;
  fin: string;
  /** body height / body length */
  aspect: number;
  pattern?: "stripes" | "spots";
}

export interface FishDef {
  id: string;
  name: string;
  /** names in other languages; missing ones fall back to `name` */
  names?: Partial<Record<Lang, string>>;
  zone: ZoneId;
  rarity: Rarity;
  /** depth band in world units (10 units = 1 m) */
  depth: [number, number];
  /** swim speed, units per second */
  speed: number;
  /** body length, units */
  size: number;
  /** coins before mutation */
  value: number;
  look: FishLook;
  junk?: boolean;
  /** only spawns while this event runs */
  event?: EventId;
}

export interface ZoneDef {
  id: ZoneId;
  /** deepest point of the zone: the hook stops here */
  floor: number;
  /** coins to unlock (0 = open) */
  price: number;
  /** water colours from surface to floor */
  water: [string, string, string];
  /** ice zone technique: floating ice slabs block the hook, and the way out is a hole in the ice */
  ice?: boolean;
}

export interface EventDef {
  id: EventId;
  icon: string;
  tint: string;
  /** multiplies the spawn weight of a rarity */
  rarity?: Partial<Record<Rarity, number>>;
  /** multiplies a mutation chance */
  mutation?: Partial<Record<MutationId, number>>;
}

export interface MutationDef {
  id: MutationId;
  /** base chance per spawned fish */
  chance: number;
  mult: number;
  /** only rolls while this event runs (or at night for ghost) */
  event?: EventId;
  night?: boolean;
}

export interface UpgradeLevels {
  line: number;
  capacity: number;
  luck: number;
}
export type UpgradeId = keyof UpgradeLevels;

export interface Catch {
  fish: string;
  mut: MutationId | null;
  value: number;
}
