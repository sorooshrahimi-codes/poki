import { FISH } from "./fish.ts";

// Cosmetics: pure show-off. No stats, so nothing is pay-to-win; they come from coins,
// from collection milestones, or a rewarded-ad "try it" that lasts a few dives.

export type CosmeticKind = "pet" | "hat";

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
}

export const COSMETICS: CosmeticDef[] = [
  { id: "hat_beanie", kind: "hat", art: "hat_beanie", price: 500 },
  { id: "hat_straw", kind: "hat", art: "hat_straw", price: 900 },
  { id: "hat_pirate", kind: "hat", art: "hat_pirate", album: 10 },
  { id: "hat_crown", kind: "hat", art: "hat_crown", rarity: "legendary" },
  { id: "pet_cat", kind: "pet", art: "pet_cat", price: 800 },
  { id: "pet_dog", kind: "pet", art: "pet_dog", price: 1500 },
  { id: "pet_parrot", kind: "pet", art: "pet_parrot", album: 15 },
  { id: "pet_penguin", kind: "pet", art: "pet_penguin", fish: "baby_penguin" },
];

/** dives a rewarded "try it" lasts */
export const TRY_DIVES = 8;

export function milestoneMet(c: CosmeticDef, album: Record<string, unknown>): boolean {
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

export function aquariumFish(album: Record<string, { best: number }>): string[] {
  return Object.entries(album).sort((a, b) => b[1].best - a[1].best).slice(0, AQUARIUM_SLOTS).map(([id]) => id);
}

export function aquariumEarned(album: Record<string, { best: number }>, since: number, now: number): number {
  const minutes = Math.min(AQUARIUM_CAP_MIN, Math.max(0, (now - since) / 60_000));
  const rate = aquariumFish(album).reduce((a, id) => a + album[id].best, 0) * AQUARIUM_RATE;
  return Math.floor(rate * minutes);
}
