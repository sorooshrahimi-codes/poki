import type { SaveData } from "../core/save.ts";
import { FISH_BY_ID } from "./fish.ts";

// The harbor grows with the player: every milestone adds something you can SEE next to your boat.
// The order is the order a typical player reaches them; each has a clear, countable goal.

export type HarborId = "pier" | "trophy" | "stand" | "bunting" | "lighthouse" | "visitors" | "tank" | "statue" | "festival";

export interface HarborStage {
  id: HarborId;
  icon: string;
  /** progress toward it: [now, goal] */
  progress: (s: SaveData) => [number, number];
}

const species = (s: SaveData) => Object.keys(s.album).length;
const hasRarity = (s: SaveData, r: string) => Object.keys(s.album).some((id) => FISH_BY_ID[id]?.rarity === r && !FISH_BY_ID[id]?.junk);
const tankCount = (s: SaveData) => Object.values(s.tank ?? {}).reduce((a, e) => a + e[0] + e[1] + e[2], 0);

export const HARBOR: HarborStage[] = [
  { id: "pier", icon: "🪵", progress: (s) => [Math.min(s.prog.level, 2), 2] },
  { id: "trophy", icon: "🏅", progress: (s) => [hasRarity(s, "rare") ? 1 : 0, 1] },
  { id: "stand", icon: "🐟", progress: (s) => [Math.min(s.stats.catches, 40), 40] },
  { id: "bunting", icon: "🎏", progress: (s) => [Math.min(species(s), 12), 12] },
  { id: "lighthouse", icon: "🗼", progress: (s) => [s.zones.includes("ocean") ? 1 : 0, 1] },
  { id: "visitors", icon: "👏", progress: (s) => [Math.min(s.prog.level, 6), 6] },
  { id: "tank", icon: "🐠", progress: (s) => [Math.min(tankCount(s), 5), 5] },
  { id: "statue", icon: "🏆", progress: (s) => [hasRarity(s, "legendary") ? 1 : 0, 1] },
  { id: "festival", icon: "🎆", progress: (s) => [Math.min(species(s), 30), 30] },
];

export const harborDone = (st: HarborStage, s: SaveData) => { const [a, b] = st.progress(s); return a >= b; };
/** built stages (the save remembers them so a stage never disappears) */
export function harborBuilt(s: SaveData): HarborId[] {
  return HARBOR.filter((st) => s.harbor?.includes(st.id) || harborDone(st, s)).map((st) => st.id);
}
/** the next thing to build: the first not yet done, in order */
export const harborNext = (s: SaveData) => HARBOR.find((st) => !(s.harbor?.includes(st.id) || harborDone(st, s))) ?? null;

/** your three most valuable species, for the trophy board */
export const bestCatches = (s: SaveData) =>
  Object.entries(s.album).filter(([id]) => FISH_BY_ID[id] && !FISH_BY_ID[id].junk).sort((a, b) => (b[1].best ?? 0) - (a[1].best ?? 0)).slice(0, 3).map(([id]) => id);
/** the legendary for the statue: your most valuable legendary or secret */
export const statueFish = (s: SaveData) =>
  Object.keys(s.album).filter((id) => FISH_BY_ID[id]?.rarity === "legendary" || FISH_BY_ID[id]?.rarity === "secret").sort((a, b) => FISH_BY_ID[b].value - FISH_BY_ID[a].value)[0] ?? null;
/** a few fish from your tank to swim in the harbor aquarium */
export const tankFish = (s: SaveData) => Object.entries(s.tank ?? {}).filter(([id, e]) => FISH_BY_ID[id] && e[0] + e[1] + e[2] > 0).map(([id]) => id).slice(0, 4);
