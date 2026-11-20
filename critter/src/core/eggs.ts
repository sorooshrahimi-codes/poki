import type { BiomeId, MutationId, Rarity } from "./types.ts";
import { critterOf, type CritterDef } from "../data/critters.ts";
import type { Rng } from "./rng.ts";

// Eggs: special catches sometimes leave an egg. It hatches after real minutes, a reason to come back,
// and the surprise inside can be a critter you have never seen, or a golden one.

export type EggTier = "speckled" | "sky" | "star" | "golden";
export interface Egg { tier: EggTier; biome: BiomeId; readyAt: number }

export const EGG_ART: Record<EggTier, string> = { speckled: "egg_speckled", sky: "egg_sky", star: "egg_star", golden: "egg_golden" };
export const EGG_MINUTES: Record<EggTier, number> = { speckled: 3, sky: 10, star: 30, golden: 60 };
export const NEST_SLOTS = 4;

/** what a catch may drop: rarer critters drop rarer eggs more often */
export function eggDrop(rarity: Rarity, mut: MutationId | null, rng: Rng): EggTier | null {
  if (mut === "gold" || mut === "rainbow") return rng() < 0.35 ? "golden" : null;
  const r = rng();
  if (rarity === "legendary") return r < 0.7 ? "star" : null;
  if (rarity === "epic") return r < 0.4 ? "star" : r < 0.6 ? "sky" : null;
  if (rarity === "rare") return r < 0.25 ? "sky" : r < 0.4 ? "speckled" : null;
  return r < 0.03 ? "speckled" : null;
}

/** what hatches: each tier leans to its rarities; golden eggs always give a golden critter */
export function hatch(e: Egg, rng: Rng): { def: CritterDef; mut: MutationId | null } {
  const pool = critterOf(e.biome);
  const want: Rarity[] = e.tier === "speckled" ? ["common", "rare"] : e.tier === "sky" ? ["rare", "epic"] : e.tier === "star" ? ["epic", "legendary"] : ["common", "rare", "epic", "legendary"];
  const weights: Record<Rarity, number> = e.tier === "star" ? { common: 0, rare: 0, epic: 3, legendary: 1, secret: 0 } : { common: 3, rare: 2, epic: 1, legendary: 0.4, secret: 0 };
  const cand = pool.filter((d) => want.includes(d.rarity));
  let tot = cand.reduce((a, d) => a + weights[d.rarity], 0), r = rng() * tot;
  let def = cand[0];
  for (const d of cand) { r -= weights[d.rarity]; if (r <= 0) { def = d; break; } }
  const mut: MutationId | null = e.tier === "golden" ? "gold" : rng() < 0.08 ? "gold" : null;
  return { def, mut };
}
