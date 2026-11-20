import type { MutationId, Rarity } from "./types.ts";

// Weather follows the UTC clock like world events: everyone shares the same sky, no server.
// It changes how the water looks and sounds AND what swims in it.

export type WeatherId = "sunny" | "rain" | "storm" | "fog";

export interface WeatherDef {
  id: WeatherId;
  icon: string;
  weight: number;
  /** spawn weight multipliers per rarity */
  rarity?: Partial<Record<Rarity, number>>;
  /** mutation chance multipliers; listed mutations are also allowed outside their usual event/night */
  mutation?: Partial<Record<MutationId, number>>;
  /** fights: how much faster big fish pull */
  fight?: number;
}

export const WEATHER: Record<WeatherId, WeatherDef> = {
  sunny: { id: "sunny", icon: "☀️", weight: 40 },
  rain: { id: "rain", icon: "🌧️", weight: 25, rarity: { rare: 1.3 }, mutation: { ghost: 2 } },
  storm: { id: "storm", icon: "⛈️", weight: 15, rarity: { epic: 1.5, legendary: 1.6 }, mutation: { electric: 0.4 }, fight: 1.2 },
  fog: { id: "fog", icon: "☁️", weight: 20, rarity: { rare: 1.6, epic: 1.4, legendary: 1.2 } },
};

export const WEATHER_SLOT_MS = 6 * 60_000;

function hash(n: number) {
  let x = (n * 2654435761) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 2246822507) >>> 0; x ^= x >>> 13;
  return x / 4294967296;
}

function pick(slot: number): WeatherId {
  const ids = Object.keys(WEATHER) as WeatherId[];
  let total = 0;
  for (const id of ids) total += WEATHER[id].weight;
  let r = hash(slot) * total;
  for (const id of ids) { r -= WEATHER[id].weight; if (r <= 0) return id; }
  return "sunny";
}

/** weather at a moment; never two storms in a row */
export function weatherAt(now: number): { def: WeatherDef; endsAt: number } {
  const slot = Math.floor(now / WEATHER_SLOT_MS);
  let id = pick(slot);
  if (id === "storm" && pick(slot - 1) === "storm") id = "rain";
  return { def: WEATHER[id], endsAt: (slot + 1) * WEATHER_SLOT_MS };
}
