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
  /** how it behaves in the field: each asks for a different move from the player */
  behave: Behave;
}
/** hop: wanders · fly: floats up high, aim up · burrow: pops in and out of the ground · shy: dashes away from the cone ·
 *  split: becomes two when first hit · shell: hides in a shell when hit, wait for it to peek */
export type Behave = "hop" | "fly" | "burrow" | "shy" | "split" | "shell";

let curBiome: BiomeId = "meadow";
const c = (id: string, name: string, rarity: Rarity, size: number, hop: number, resist: number, income: number, color: string, behave: Behave = "hop"): CritterDef =>
  ({ id, name, biome: curBiome, rarity, art: id, size, hop, resist, income, color, behave });
const biome = (b: BiomeId) => { curBiome = b; return [] as CritterDef[]; };

export const CRITTERS: CritterDef[] = [
  ...biome("meadow"),
  c("puffbun", "Puffbun", "common", 56, 26, 1, 1, "#ffd6e6", "shy"),
  c("sprig", "Sprig", "common", 48, 18, 1, 1, "#8fe07a"),
  c("mushi", "Mushi", "common", 53, 10, 1, 1.5, "#ff6b6b", "burrow"),
  c("bumbo", "Bumbo", "common", 48, 34, 1, 1.5, "#ffd23f", "fly"),
  c("pebblo", "Pebblo", "common", 53, 6, 1.4, 2, "#9aa5b1"),
  c("dewdrop", "Dewdrop", "rare", 50, 22, 1.6, 5, "#7fd3ff", "split"),
  c("snailo", "Snailo", "rare", 53, 4, 2, 6, "#c9a7ff", "shell"),
  c("hootle", "Hootle", "rare", 59, 14, 2, 7, "#b07a4a", "fly"),
  c("clovy", "Clovy", "epic", 56, 20, 3.2, 20, "#3ccf6a"),
  c("honeyblob", "Honeyblob", "epic", 62, 12, 3.6, 24, "#ffb13a"),
  c("sunpup", "Sunpup", "legendary", 70, 24, 5.5, 80, "#ff9a3a", "shy"),
  c("prismane", "Prismane", "legendary", 73, 20, 6.5, 120, "#e6b3ff", "fly"),
  ...biome("forest"),
  c("spora", "Spora", "common", 56, 16, 1, 6, "#b48cff", "split"),
  c("acornel", "Acornel", "common", 50, 20, 1, 6, "#b06a3a", "burrow"),
  c("mossling", "Mossling", "common", 54, 12, 1.2, 8, "#7bc94a"),
  c("glowbug", "Glowbug", "common", 50, 36, 1.2, 8, "#ffe066", "fly"),
  c("toadstoo", "Toadstoo", "common", 58, 30, 1.4, 10, "#ff5a5a"),
  c("fernfox", "Fernfox", "rare", 56, 26, 1.8, 30, "#ff8a3a", "shy"),
  c("barkbear", "Barkbear", "rare", 62, 8, 2.2, 36, "#8a5a32"),
  c("pinecub", "Pinecub", "rare", 54, 14, 2, 34, "#c98a52", "shell"),
  c("lumoth", "Lumoth", "epic", 56, 30, 3.4, 110, "#8fd3ff", "fly"),
  c("crystalcap", "Crystalcap", "epic", 60, 10, 3.8, 130, "#c9b8ff", "burrow"),
  c("elderoak", "Elderoak", "legendary", 70, 10, 6, 420, "#5f9b4a"),
  c("moonfawn", "Moonfawn", "legendary", 70, 28, 7, 600, "#fff4d6", "shy"),
];
export const BIOMES: { id: BiomeId; name: string; icon: string; bg: string; price: number }[] = [
  { id: "meadow", name: "Sunny Meadow", icon: "🌼", bg: "bg_meadow", price: 0 },
  { id: "forest", name: "Mushroom Forest", icon: "🍄", bg: "bg_forest", price: 9000 },
];
export const critterOf = (b: BiomeId) => CRITTERS.filter((d) => d.biome === b);
export const CRITTER_BY_ID: Record<string, CritterDef> = Object.fromEntries(CRITTERS.map((d) => [d.id, d]));

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 70, rare: 18, epic: 6, legendary: 1.5, secret: 0 };
export const RARITY_COLOR: Record<Rarity, string> = { common: "#cfd8dc", rare: "#4fc3f7", epic: "#c77dff", legendary: "#ffc93c", secret: "#ff4d8d" };
export const MUTATIONS: { id: MutationId; chance: number; mult: number; resist: number }[] = [
  { id: "gold", chance: 0.06, mult: 3, resist: 1.6 },
  { id: "rainbow", chance: 0.012, mult: 6, resist: 2.2 },
  { id: "giant", chance: 0.04, mult: 2, resist: 1.8 },
];
/** a pedestal earns more with every copy you bring: 1, 3, 9 copies = ★1, ★2, ★3 */
export const starOf = (count: number) => (count >= 20 ? 3 : count >= 5 ? 2 : count >= 1 ? 1 : 0);
export const STAR_MULT = [0, 1, 2, 4];
/** coins for catching one (park income does the rest) */
export const catchCoinsOf = (d: CritterDef, mult: number) => Math.max(1, Math.round(d.income * 2 * mult));
