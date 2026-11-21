// Critter Vac pacing simulator: a bot aims at the nearest critter, holds, returns to the park when the jar is full,
// buys the cheapest upgrade, unlocks the forest when it can. Prints the numbers that decide whether the loop feels good.
//   node tools/sim.ts [sessions=60] [minutes=15]
import { newField, resetBossClock, stepField } from "../src/core/field.ts";
import { UPGRADE_ORDER, upgradeCost, vacLevel, valueMult, type Upgrades } from "../src/core/economy.ts";
import { makeRng } from "../src/core/rng.ts";
import { BIOMES, CRITTERS, MUTATIONS, STAR_MULT, catchCoinsOf, giantStep, starOf } from "../src/data/critters.ts";
import type { BiomeId } from "../src/core/types.ts";

const SESSIONS = Number(process.argv[2] ?? 60), MINUTES = Number(process.argv[3] ?? 15), DT = 1 / 30;
const median = (a: number[]) => { const b = a.filter((x) => x >= 0).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
const fmt = (s: number) => (isNaN(s) ? "never" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);

let bossTotal = 0;
const giants: number[] = [];
const winT: number[] = [];
const winAt: number[][] = [];
const lvlAt: Record<number, number[]> = {}, lvlT: Record<number, number[]> = {};
const res: { frost: number; firstJar: number; forest: number; coins: number[]; buys: number; income: number; species: number; tugs: number; tugWon: number }[] = [];
for (let n = 0; n < SESSIONS; n++) {
  const rng = makeRng(n * 7919 + 1), skill = 0.5 + rng() * 0.45;
  resetBossClock(75);
  const up: Upgrades = { power: 0, range: 0, tank: 0 };
  const index: Record<string, number> = {};
  let bosses = 0;
  let frost = -1;
  let coins = 0, t = 0, firstJar = -1, forest = -1, buys = 0, biome: BiomeId = "meadow", tugs = 0, tugWon = 0;
  const owned: BiomeId[] = ["meadow"];
  const restored: BiomeId[] = [];
  let firstGiant = -1, wins = 0, charge = 0;
  const bar = () => vacLevel(up) + Math.floor(charge);
  const coinsAt: number[] = [];
  const income = () => CRITTERS.reduce((a, d) => a + d.income * STAR_MULT[starOf(index[d.id] ?? 0)], 0);
  let fld: ReturnType<typeof newField> | null = null;
  while (t < MINUTES * 60) {
    { const g0 = giantStep(wins); if (g0.biome !== biome && owned.includes(g0.biome) && bar() >= g0.need) biome = g0.biome; }
    // one continuous field per place (the game no longer leaves it for a park)
    if (!fld || fld.biome !== biome) { fld = newField(360, 640, up, biome); if (t > 0) fld.script = 2; fld.nozzle = { x: 110, y: 640 * 0.8 }; }
    const f = fld;
    const g = giantStep(wins);
    if (g.biome !== biome && owned.includes(g.biome) && bar() >= g.need) biome = g.biome;
    f.giant = g.biome === biome ? { id: g.id, ready: bar() >= g.need, resist: g.resist, scale: g.scale } : null;
    const jar: string[] = [];
    let aimX = 250, aimY = 560, holdT = 0;
    // one visit: catch until the jar is full (or 90 s pass)
    let v = 0;
    let nextBiome: BiomeId | null = null;
    // one stretch of play between looks at the upgrade buttons
    while (v < 8 || f.critters.some((c) => c.boss > 0 && c.state !== "caught")) {
      // a person re-aims a few times a second, at the nearest critter, with some wobble
      holdT -= DT;
      if (holdT <= 0) {
        holdT = 0.25 + (1 - skill) * 0.4;
        // a person keeps the cone on a critter that is fighting back; otherwise goes for the nearest
        const target = f.critters.find((c) => c.state === "tug") ?? f.critters.filter((c) => c.state !== "caught" && !c.hidden).sort((a, b) => Math.hypot(a.x - f.nozzle.x, a.y - f.nozzle.y) - Math.hypot(b.x - f.nozzle.x, b.y - f.nozzle.y))[0];
        if (target) { aimX = target.x + (rng() - 0.5) * 40 * (1 - skill); aimY = target.y - target.lift - 25 + (rng() - 0.5) * 40 * (1 - skill); }
      }
      // a person lets go now and then (to re-aim, or when a shell critter tucks in)
      const on = f.critters.some((c) => !c.hidden && c.state !== "caught");
      stepField(f, DT, { on, x: aimX, y: aimY }, up, rng);
      for (const e of f.ev) {
        if (e.kind === "caught" && e.c.boss === 0) charge += ({ common: 0.06, rare: 0.12, epic: 0.25, legendary: 0.5, secret: 0.5 } as Record<string, number>)[e.c.def.rarity] * (e.c.mut ? 2 : 1);
        if (e.kind === "caught") { index[e.c.def.id] = (index[e.c.def.id] ?? 0) + 1; coins += catchCoinsOf(e.c.def, MUTATIONS.find((m) => m.id === e.c.mut)?.mult ?? 1) * valueMult(up); if (e.c.resist > 1.5) tugWon++; if (firstJar < 0 && Object.values(index).reduce((a, b) => a + b, 0) >= 8) firstJar = t; }
        if (e.kind === "tug") tugs++;
        if (e.kind === "caught" && e.c.boss > 0) {
          bosses++; charge = 0; (winAt[wins] ??= []).push(t); wins++; winT.push(t);
          if (!restored.includes(biome)) {
            restored.push(biome);
            if (firstGiant < 0) firstGiant = t;
            const nb = BIOMES[BIOMES.findIndex((b) => b.id === biome) + 1];
            if (nb && nb.id !== "lab") { owned.push(nb.id); if (nb.id === "forest") forest = t; if (nb.id === "frost") frost = t; nextBiome = nb.id; }
          }
        }
      }
      f.ev.length = 0;
      v += DT; t += DT;
      coins += income() * DT;
    }
    t += 0.5; coins += income() * 0.5; // a tap on an upgrade
    if (nextBiome) biome = nextBiome;
    for (;;) {
      const o = UPGRADE_ORDER.map((id) => ({ id, c: upgradeCost(up, id) })).filter((x) => x.c !== null).sort((a, b) => a.c! - b.c!)[0];
      if (!o || o.c! > coins) break;
      coins -= o.c!; up[o.id]++; buys++;
      const L = vacLevel(up); if (L % 10 === 0 && !(lvlAt[L] ??= []).includes(n)) { lvlAt[L].push(n); lvlT[L] = [...(lvlT[L] ?? []), t]; }
    }
    for (const m of [1, 3, 5, 10, 15]) if (coinsAt.length < [1, 3, 5, 10, 15].indexOf(m) + 1 && t >= m * 60) coinsAt.push(Math.round(coins));
  }
  bossTotal += bosses;
  giants.push(firstGiant);
  res.push({ frost, firstJar, forest, coins: coinsAt, buys, income: Math.round(income()), species: Object.keys(index).length, tugs, tugWon });
}
console.log(`Critter Vac sim: ${SESSIONS} sessions x ${MINUTES} min`);
console.log(`8 catches         median ${fmt(median(res.map((r) => r.firstJar)))}  (target 0:15-1:00: the first reward comes fast)`);
console.log(`first giant       median ${fmt(median(giants))}  (target 2:00-4:00: the goal is proven early)`);
console.log(`forest unlocked   median ${fmt(median(res.map((r) => r.forest)))}, ${Math.round((res.filter((r) => r.forest >= 0).length / SESSIONS) * 100)}% of sessions (= first giant)`);
console.log(`frost unlocked    median ${fmt(median(res.map((r) => r.frost)))}, ${Math.round((res.filter((r) => r.frost >= 0).length / SESSIONS) * 100)}% of sessions (= second giant, target 7:00-10:00)`);
console.log(`upgrades bought   median ${median(res.map((r) => r.buys))}; species found median ${median(res.map((r) => r.species))}/${CRITTERS.length}; park income median ${median(res.map((r) => r.income))}/s`);
console.log(`tug fights        ${(res.reduce((a, r) => a + r.tugs, 0) / SESSIONS).toFixed(1)} per session, won ${Math.round((res.reduce((a, r) => a + r.tugWon, 0) / Math.max(1, res.reduce((a, r) => a + r.tugs, 0))) * 100)}%`);
console.log(`bosses caught     ${(bossTotal / SESSIONS).toFixed(1)} per session`);
console.log("vacuum level reached at (median): " + Object.keys(lvlT).map((k) => `L${k} ${fmt(median(lvlT[+k]))}`).join(", "));
console.log(`giants beaten     ${(winT.length / SESSIONS).toFixed(1)} per session`);
console.log("giant n beaten at (median): " + winAt.map((a, i) => `#${i + 1} ${fmt(median(a))} (${a.length})`).join(", "));
