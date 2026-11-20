import type { MutationId, Rarity } from "../core/types.ts";

// Baits change what bites; gear changes what you can see. All data: the AI studio adds more.

export type BaitTier = "basic" | "fine" | "magic" | "legend";

export interface BaitDef {
  id: string;
  /** sprite name in public/art */
  art: string;
  icon: string;
  tier: BaitTier;
  price: number;
  /** how many casts one purchase lasts */
  uses: number;
  rarity?: Partial<Record<Rarity, number>>;
  mutation?: Partial<Record<MutationId, number>>;
  /** these species get a big spawn boost */
  attracts?: string[];
  /** allows event-only (secret) fish to spawn without their event */
  unlocksSecret?: boolean;
  names: Record<"en" | "es" | "pt" | "hi" | "ja", string>;
}

export const BAITS: BaitDef[] = [
  { id: "worm", art: "b_worm", icon: "🪱", tier: "basic", price: 40, uses: 5, rarity: { rare: 1.35 },
    names: { en: "Wiggly Worm", es: "Gusano", pt: "Minhoca", hi: "केंचुआ", ja: "ミミズ" } },
  { id: "shrimp", art: "b_shrimp", icon: "🦐", tier: "basic", price: 90, uses: 5, rarity: { rare: 1.6, epic: 1.2 },
    names: { en: "Juicy Shrimp", es: "Camarón", pt: "Camarão", hi: "झींगा", ja: "エビ" } },
  { id: "firefly", art: "b_firefly", icon: "✨", tier: "fine", price: 220, uses: 4, mutation: { ghost: 3 },
    attracts: ["glow_eel", "angler", "jelly", "frost_jelly"],
    names: { en: "Firefly Lure", es: "Señuelo luciérnaga", pt: "Isca vaga-lume", hi: "जुगनू चारा", ja: "ホタルルアー" } },
  { id: "golden", art: "b_golden", icon: "🥇", tier: "fine", price: 350, uses: 4, mutation: { gold: 4 },
    names: { en: "Golden Lure", es: "Señuelo dorado", pt: "Isca dourada", hi: "सुनहरा चारा", ja: "金のルアー" } },
  { id: "rainbow", art: "b_rainbow", icon: "🌈", tier: "magic", price: 700, uses: 3, mutation: { rainbow: 5 },
    names: { en: "Rainbow Jelly", es: "Gelatina arcoíris", pt: "Geleia arco-íris", hi: "इंद्रधनुष जेली", ja: "虹のゼリー" } },
  { id: "ice", art: "b_ice", icon: "❄️", tier: "magic", price: 600, uses: 4, rarity: { epic: 1.8 },
    attracts: ["crystal_trout", "beluga", "narwhal_king"],
    names: { en: "Frost Drop", es: "Gota helada", pt: "Gota gelada", hi: "बर्फ़ की बूँद", ja: "氷のしずく" } },
  { id: "moon", art: "b_moon", icon: "🌙", tier: "legend", price: 2500, uses: 2, rarity: { legendary: 2.5 }, unlocksSecret: true,
    names: { en: "Moon Lure", es: "Señuelo lunar", pt: "Isca lunar", hi: "चंद्र चारा", ja: "月のルアー" } },
];
export const BAIT_BY_ID: Record<string, BaitDef> = Object.fromEntries(BAITS.map((b) => [b.id, b]));

/** the shop restocks on the UTC clock, so friends see the same offers at the same time */
export const SHOP_SLOT_MS = 5 * 60_000;
const TIER_WEIGHT: Record<BaitTier, number> = { basic: 10, fine: 5, magic: 2, legend: 0.45 };

function hash(n: number) {
  let x = (n * 2246822519) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 3266489917) >>> 0; x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** three offers for the current restock window: one basic, two random by tier weight */
export function shopOffers(now: number): { offers: BaitDef[]; restockAt: number } {
  const slot = Math.floor(now / SHOP_SLOT_MS);
  const basics = BAITS.filter((b) => b.tier === "basic");
  const offers: BaitDef[] = [basics[Math.floor(hash(slot * 7) * basics.length)]];
  let k = 1;
  while (offers.length < 3 && k < 40) {
    const pool = BAITS.filter((b) => !offers.includes(b));
    let total = 0;
    for (const b of pool) total += TIER_WEIGHT[b.tier];
    let r = hash(slot * 7 + k++) * total;
    for (const b of pool) { r -= TIER_WEIGHT[b.tier]; if (r <= 0) { offers.push(b); break; } }
  }
  return { offers, restockAt: (slot + 1) * SHOP_SLOT_MS };
}

// ---------------------------------------------------------------- gear (levels)
export interface GearDef { id: "lantern" | "sonar"; art: string; max: number; cost: (l: number) => number }
export const GEAR: GearDef[] = [
  { id: "lantern", art: "g_lantern", max: 5, cost: (l) => Math.round(400 * Math.pow(2.1, l)) },
  { id: "sonar", art: "g_sonar", max: 3, cost: (l) => Math.round(900 * Math.pow(2.6, l)) },
];
/** hook light radius in the dark, world units */
export const lanternRadius = (l: number) => 150 + l * 35;
/** how far (world units) the sonar can see rare fish, 0 = no sonar */
export const sonarRange = (l: number) => (l <= 0 ? 0 : 350 + l * 250);
