/** small seeded PRNG (mulberry32) so the simulator is reproducible */
export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWeighted<T>(items: T[], weight: (t: T) => number, rng: Rng): T | null {
  let total = 0;
  for (const it of items) total += Math.max(0, weight(it));
  if (total <= 0) return null;
  let r = rng() * total;
  for (const it of items) {
    r -= Math.max(0, weight(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}
