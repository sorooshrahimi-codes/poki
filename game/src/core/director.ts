import type { Rng } from "./rng.ts";
import type { ZoneId } from "./types.ts";

// The surprise director: a hidden "film director" for each session. Players feel that anything
// can happen at any moment; underneath, these rules decide when and what. Only we know them.

export type SurpriseKind = "golden_school" | "shark" | "bottle" | "whirlpool" | "chest" | "shadow" | "glimpse";

export interface DirectorState {
  /** dives in a row without anything rare, epic+ or mutated */
  dry: number;
  /** play-seconds of the last surprise */
  lastAt: number;
  last: SurpriseKind | null;
  count: number;
}

export const newDirector = (): DirectorState => ({ dry: 0, lastAt: -999, last: null, count: 0 });

/** never two surprises closer than this (play seconds): surprise must stay surprising */
const COOLDOWN = 30;
/** the first surprise of a player's life lands here, and it is always a nice one */
const FIRST_AT = 45;

interface Options { zone: ZoneId; bottom: number; floor: number; capacity: number }

const WEIGHTS: Record<SurpriseKind, (o: Options) => number> = {
  golden_school: () => 3,
  shark: (o) => (o.capacity >= 4 && o.bottom >= 300 ? 2 : 0),
  bottle: () => 2,
  whirlpool: (o) => (o.bottom < o.floor - 250 ? 1.6 : 0),
  chest: (o) => (o.bottom >= 500 ? 1.5 : 0),
  shadow: (o) => (o.bottom >= 700 ? 1.4 : 0),
  glimpse: () => 0, // scripted only: the early "a legend lives down there" tease
};

/** decide, at the start of a dive, whether something unexpected will happen in it */
export function pickSurprise(st: DirectorState, playSec: number, o: Options, rng: Rng): SurpriseKind | null {
  if (playSec - st.lastAt < COOLDOWN) return null;
  if (st.count === 0) return playSec >= FIRST_AT ? "golden_school" : null;
  // dry spells raise the odds: the player never goes long without a moment
  const chance = Math.min(0.85, 0.3 + 0.1 * Math.max(0, st.dry - 3));
  if (rng() > chance) return null;
  const kinds = (Object.keys(WEIGHTS) as SurpriseKind[]).filter((k) => k !== st.last);
  let total = 0;
  for (const k of kinds) total += WEIGHTS[k](o);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const k of kinds) { r -= WEIGHTS[k](o); if (r <= 0) return k; }
  return null;
}

export function noteSurprise(st: DirectorState, kind: SurpriseKind, playSec: number) {
  st.last = kind; st.lastAt = playSec; st.count++;
}

/** after each dive: did it have a "moment"? */
export function noteDive(st: DirectorState, hadMoment: boolean) {
  st.dry = hadMoment ? 0 : st.dry + 1;
}
