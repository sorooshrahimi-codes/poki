import { FISH } from "./fish.ts";

// Cosmetics: pure show-off. No stats, so nothing is pay-to-win; they come from coins,
// from collection milestones, or a rewarded-ad "try it" that lasts a few dives.

export type CosmeticKind = "pet" | "hat" | "outfit" | "boat";

export interface CosmeticDef {
  id: string;
  kind: CosmeticKind;
  /** sprite name in public/art */
  art: string;
  price?: number;
  /** unlocked by the album: this many species caught */
  album?: number;
  /** unlocked by catching this fish */
  fish?: string;
  /** unlocked by catching any fish of this rarity */
  rarity?: "legendary" | "secret";
  /** everyone owns it from the start */
  free?: boolean;
  /** outfit / boat paint: target hue (degrees) and saturation/brightness tweaks */
  tint?: { hue: number; sat?: number; light?: number };
}

export const COSMETICS: CosmeticDef[] = [
  { id: "hat_cap", kind: "hat", art: "hat_cap", free: true },
  { id: "hat_beanie", kind: "hat", art: "hat_beanie", price: 500 },
  { id: "hat_rain", kind: "hat", art: "hat_rain", price: 700 },
  { id: "hat_sailor", kind: "hat", art: "hat_sailor", price: 1200 },
  { id: "hat_frog", kind: "hat", art: "hat_frog", album: 20 },
  { id: "hat_straw", kind: "hat", art: "hat_straw", price: 900 },
  { id: "hat_pirate", kind: "hat", art: "hat_pirate", album: 10 },
  { id: "hat_crown", kind: "hat", art: "hat_crown", rarity: "legendary" },
  // life-vest colours: the real art recoloured, so the style always matches
  { id: "vest_blue", kind: "outfit", art: "", free: true, tint: { hue: 215 } },
  { id: "vest_red", kind: "outfit", art: "", price: 600, tint: { hue: 0 } },
  { id: "vest_green", kind: "outfit", art: "", price: 600, tint: { hue: 120 } },
  { id: "vest_pink", kind: "outfit", art: "", price: 900, tint: { hue: 320 } },
  { id: "vest_purple", kind: "outfit", art: "", album: 12, tint: { hue: 275 } },
  { id: "vest_gold", kind: "outfit", art: "", album: 25, tint: { hue: 45, sat: 1.1, light: 1.25 } },
  // boat paint: the hull stripe
  { id: "paint_red", kind: "boat", art: "", free: true, tint: { hue: 0 } },
  { id: "paint_blue", kind: "boat", art: "", price: 800, tint: { hue: 210 } },
  { id: "paint_green", kind: "boat", art: "", price: 800, tint: { hue: 135 } },
  { id: "paint_purple", kind: "boat", art: "", price: 1200, tint: { hue: 280 } },
  { id: "paint_gold", kind: "boat", art: "", rarity: "legendary", tint: { hue: 45, sat: 1.1, light: 1.3 } },
  { id: "pet_cat", kind: "pet", art: "pet_cat", price: 800 },
  { id: "pet_dog", kind: "pet", art: "pet_dog", price: 1500 },
  { id: "pet_parrot", kind: "pet", art: "pet_parrot", album: 15 },
  { id: "pet_penguin", kind: "pet", art: "pet_penguin", fish: "baby_penguin" },
];

/** dives a rewarded "try it" lasts */
export const TRY_DIVES = 8;

export function milestoneMet(c: CosmeticDef, album: Record<string, unknown>): boolean {
  if (c.free) return true;
  if (c.album !== undefined) return Object.keys(album).length >= c.album;
  if (c.fish) return !!album[c.fish];
  if (c.rarity) return FISH.some((f) => f.rarity === c.rarity && album[f.id]);
  return false;
}

// ---------------------------------------------------------------- aquarium
/** the aquarium shows your most valuable catches and earns from them while you are away */
export const AQUARIUM_SLOTS = 6;
/** coins per minute = this share of the shown fishes' best values */
export const AQUARIUM_RATE = 0.012;
export const AQUARIUM_CAP_MIN = 8 * 60;

import { STAR_POWER, bestStar, tankPower, type Tank } from "../core/tank.ts";
export { STAR_POWER };

/** the aquarium shows the strongest fish in your tank (kept and merged) */
export function aquariumFish(tank: Tank): { id: string; star: number }[] {
  return Object.entries(tank).filter(([, e]) => bestStar(e) > 0)
    .sort((a, b) => tankPower(b[0], b[1]) - tankPower(a[0], a[1])).slice(0, AQUARIUM_SLOTS)
    .map(([id, e]) => ({ id, star: bestStar(e) }));
}

/** coins per minute from the tank's top fish */
export function aquariumRate(tank: Tank): number {
  return aquariumFish(tank).reduce((a, f) => a + tankPower(f.id, tank[f.id]), 0) * AQUARIUM_RATE;
}

export function aquariumEarned(tank: Tank, since: number, now: number): number {
  const minutes = Math.min(AQUARIUM_CAP_MIN, Math.max(0, (now - since) / 60_000));
  return Math.floor(aquariumRate(tank) * minutes);
}
