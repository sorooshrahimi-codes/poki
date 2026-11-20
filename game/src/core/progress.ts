import type { Rarity } from "./types.ts";

// Long-term goals: fisher level, weekly league against character rivals, derbies, new voyages.
// No server: everything is computed from the save and the UTC clock.

// ---------------------------------------------------------------- fisher level
export const MAX_LEVEL = 50;
/** XP needed to go from `level` to the next */
export const xpNeed = (level: number) => Math.round(40 * Math.pow(level, 1.55));
export const xpForCatch = (value: number) => Math.max(1, Math.round(Math.sqrt(value) * 1.6));
export const levelReward = (level: number) => 60 * level;
/** title index for a level (6 titles) */
export const titleIndex = (level: number) => Math.min(5, Math.floor((level - 1) / 9));

/** add XP; returns the levels gained */
export function addXp(p: { level: number; xp: number }, amount: number): number[] {
  const gained: number[] = [];
  p.xp += amount;
  while (p.level < MAX_LEVEL && p.xp >= xpNeed(p.level)) {
    p.xp -= xpNeed(p.level);
    p.level++;
    gained.push(p.level);
  }
  return gained;
}

// ---------------------------------------------------------------- league points
const RARITY_POINTS: Record<Rarity, number> = { common: 1, rare: 4, epic: 15, legendary: 60, secret: 200 };
export const leaguePoints = (rarity: Rarity, mutated: boolean, junk: boolean) => (junk ? 0 : RARITY_POINTS[rarity] * (mutated ? 2 : 1));

// ---------------------------------------------------------------- weekly league
export const TIERS = ["bronze", "silver", "gold", "diamond", "legend"] as const;
export type Tier = (typeof TIERS)[number];
export const TIER_ICON: Record<Tier, string> = { bronze: "🥉", silver: "🥈", gold: "🥇", diamond: "💎", legend: "👑" };
/** points the strongest rival reaches by the end of the week, per tier */
const TIER_TOP: Record<Tier, number> = { bronze: 900, silver: 2400, gold: 5500, diamond: 12000, legend: 26000 };
export const LEAGUE_SIZE = 20;
export const PROMOTE = 5;
export const DEMOTE = 4;

const WEEK_MS = 7 * 24 * 3600_000;
/** UTC week number (weeks start Monday 00:00 UTC) */
export const weekOf = (now: number) => Math.floor((now - 4 * 24 * 3600_000) / WEEK_MS);
export const weekEndsAt = (week: number) => (week + 1) * WEEK_MS + 4 * 24 * 3600_000;
const weekProgress = (now: number) => {
  const w = weekOf(now);
  return Math.min(1, Math.max(0, (now - (w * WEEK_MS + 4 * 24 * 3600_000)) / WEEK_MS));
};

function hash(n: number) {
  let x = (n * 2654435761) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 2246822507) >>> 0; x ^= x >>> 13; x = Math.imul(x, 3266489917) >>> 0; x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export const RIVAL_NAMES = [
  "Captain Bo", "Chef Miso", "Dr. Pip", "Granny Gill", "Reel Rita", "Salty Sam", "Bubbles", "Finn", "Coral Kai", "Mako",
  "Nori", "Skipper Jo", "Luna Lure", "Hook Hana", "Tide Tom", "Pearl", "Captain Kiko", "Marlin Max", "Wade",
];

export interface Standing { name: string; npc: number; score: number; you?: boolean }

/** the league table now: 19 character rivals (deterministic per week and tier) and you */
export function leagueTable(week: number, tier: Tier, you: number, now: number): Standing[] {
  const top = TIER_TOP[tier];
  const k = weekProgress(now);
  // rivals do not fish evenly: an S-curve over the week with a personal pace
  const rows: Standing[] = RIVAL_NAMES.map((name, i) => {
    const seed = week * 131 + i * 17 + TIERS.indexOf(tier) * 7;
    const target = top * (0.18 + 0.85 * Math.pow(hash(seed), 0.8));
    const pace = 0.7 + hash(seed + 3) * 0.6;
    const curve = Math.min(1, Math.pow(k, pace));
    return { name, npc: i % 4, score: Math.round(target * curve) };
  });
  rows.push({ name: "", npc: -1, score: you, you: true });
  return rows.sort((a, b) => b.score - a.score);
}

export const rankOf = (table: Standing[]) => table.findIndex((r) => r.you) + 1;
export const leagueReward = (tier: Tier, rank: number) => Math.round((TIERS.indexOf(tier) + 1) * 400 * Math.max(0.2, (LEAGUE_SIZE + 1 - rank) / LEAGUE_SIZE));

// ---------------------------------------------------------------- derby (timed tournament)
export type DerbyRule = "value" | "count" | "heaviest";
export const DERBY_MS = 3 * 60_000;
export const DERBY_COOLDOWN_MS = 20 * 60_000;
export const DERBY_RULES: DerbyRule[] = ["value", "count", "heaviest"];

/**
 * Rival results for a derby, scaled to what this player can do (their recent dive average) so the
 * contest is fair at any progress: the winner needs a strong, not perfect, run.
 */
export function derbyRivals(seed: number, rule: DerbyRule, avgDiveValue: number, avgDiveCount: number, avgBestKg: number) {
  const dives = DERBY_MS / 16_000; // about one dive every 16 s
  const base = rule === "value" ? avgDiveValue * dives : rule === "count" ? avgDiveCount * dives : avgBestKg * 1.6;
  return [0, 1, 2, 3, 4].map((i) => ({
    name: RIVAL_NAMES[(seed + i * 5) % RIVAL_NAMES.length],
    npc: (seed + i) % 4,
    score: Math.max(1, Math.round(base * (0.55 + 0.75 * hash(seed * 7 + i)) * 10) / 10),
  })).sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------- new voyage (prestige)
/** permanent bonus per voyage star */
export const voyageCoinMult = (stars: number) => 1 + 0.25 * stars;
export const voyageLuckBonus = (stars: number) => 0.05 * stars;
