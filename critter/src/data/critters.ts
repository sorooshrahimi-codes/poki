import type { BiomeId, MutationId, Rarity } from "../core/types.ts";

// The critter index. `resist` is how hard it fights the vacuum (1 = flies straight in);
// `income` is what one earns per second on its park pedestal.
export interface CritterDef {
  id: string;
  name: string;
  biome: BiomeId;
  rarity: Rarity;
  /** sprite name in public/art */
  art: string;
  size: number;
  /** hop height and how often it hops */
  hop: number;
  resist: number;
  income: number;
  /** fallback colour if the sprite is missing */
  color: string;
}

const c = (id: string, name: string, rarity: Rarity, size: number, hop: number, resist: number, income: number, color: string): CritterDef =>
  ({ id, name, biome: "meadow", rarity, art: id, size, hop, resist, income, color });

export const CRITTERS: CritterDef[] = [
  c("puffbun", "Puffbun", "common", 56, 26, 1, 1, "#ffd6e6"),
  c("sprig", "Sprig", "common", 48, 18, 1, 1, "#8fe07a"),
  c("mushi", "Mushi", "common", 53, 10, 1, 1.5, "#ff6b6b"),
  c("bumbo", "Bumbo", "common", 48, 34, 1, 1.5, "#ffd23f"),
  c("pebblo", "Pebblo", "common", 53, 6, 1.4, 2, "#9aa5b1"),
  c("dewdrop", "Dewdrop", "rare", 50, 22, 1.6, 5, "#7fd3ff"),
  c("snailo", "Snailo", "rare", 53, 4, 2, 6, "#c9a7ff"),
  c("hootle", "Hootle", "rare", 59, 14, 2, 7, "#b07a4a"),
  c("clovy", "Clovy", "epic", 56, 20, 3.2, 20, "#3ccf6a"),
  c("honeyblob", "Honeyblob", "epic", 62, 12, 3.6, 24, "#ffb13a"),
  c("sunpup", "Sunpup", "legendary", 70, 24, 5.5, 80, "#ff9a3a"),
  c("prismane", "Prismane", "legendary", 73, 20, 6.5, 120, "#e6b3ff"),
];
export const CRITTER_BY_ID: Record<string, CritterDef> = Object.fromEntries(CRITTERS.map((d) => [d.id, d]));

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 70, rare: 18, epic: 6, legendary: 1.5, secret: 0 };
export const RARITY_COLOR: Record<Rarity, string> = { common: "#cfd8dc", rare: "#4fc3f7", epic: "#c77dff", legendary: "#ffc93c", secret: "#ff4d8d" };
export const MUTATIONS: { id: MutationId; chance: number; mult: number; resist: number }[] = [
  { id: "gold", chance: 0.06, mult: 3, resist: 1.6 },
  { id: "rainbow", chance: 0.012, mult: 6, resist: 2.2 },
  { id: "giant", chance: 0.04, mult: 2, resist: 1.8 },
];
/** a pedestal earns more with every copy you bring: 1, 3, 9 copies = ★1, ★2, ★3 */
export const starOf = (count: number) => (count >= 9 ? 3 : count >= 3 ? 2 : count >= 1 ? 1 : 0);
export const STAR_MULT = [0, 1, 3, 8];
