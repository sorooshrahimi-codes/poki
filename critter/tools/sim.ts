// Critter Vac pacing simulator: a bot aims at the nearest critter, holds, returns to the park when the jar is full,
// buys the cheapest upgrade, unlocks the forest when it can. Prints the numbers that decide whether the loop feels good.
//   node tools/sim.ts [sessions=60] [minutes=15]
import { newField, stepField } from "../src/core/field.ts";
import { UPGRADE_ORDER, upgradeCost, type Upgrades } from "../src/core/economy.ts";
import { makeRng } from "../src/core/rng.ts";
import { BIOMES, CRITTERS, MUTATIONS, STAR_MULT, catchCoinsOf, starOf } from "../src/data/critters.ts";
import type { BiomeId } from "../src/core/types.ts";

const SESSIONS = Number(process.argv[2] ?? 60), MINUTES = Number(process.argv[3] ?? 15), DT = 1 / 30;
const median = (a: number[]) => { const b = a.filter((x) => x >= 0).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
const fmt = (s: number) => (isNaN(s) ? "never" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);

const res: { firstJar: number; forest: number; coins: number[]; buys: number; income: number; species: number; tugs: number; tugWon: number }[] = [];
for (let n = 0; n < SESSIONS; n++) {
  const rng = makeRng(n * 7919 + 1), skill = 0.5 + rng() * 0.45;
  const up: Upgrades = { power: 0, range: 0, tank: 0 };
  const index: Record<string, number> = {};
  let coins = 0, t = 0, firstJar = -1, forest = -1, buys = 0, biome: BiomeId = "meadow", tugs = 0, tugWon = 0;
  const owned: BiomeId[] = ["meadow"];
  const coinsAt: number[] = [];
  const income = () => CRITTERS.reduce((a, d) => a + d.income * STAR_MULT[starOf(index[d.id] ?? 0)], 0);
  while (t < MINUTES * 60) {
    const f = newField(360, 640, up, biome);
    if (t > 0) f.script = 2;
    f.nozzle = { x: 110, y: 640 * 0.8 };
    const jar: string[] = [];
    let aimX = 250, aimY = 560, holdT = 0;
    // one visit: catch until the jar is full (or 90 s pass)
    let v = 0;
    while (f.jar < f.cap && v < 90) {
      // a person re-aims a few times a second, at the nearest critter, with some wobble
      holdT -= DT;
      if (holdT <= 0) {
        holdT = 0.25 + (1 - skill) * 0.4;
        // a person keeps the cone on a critter that is fighting back; otherwise goes for the nearest
        const target = f.critters.find((c) => c.state === "tug") ?? f.critters.filter((c) => c.state !== "caught").sort((a, b) => Math.hypot(a.x - f.nozzle.x, a.y - f.nozzle.y) - Math.hypot(b.x - f.nozzle.x, b.y - f.nozzle.y))[0];
        if (target) { aimX = target.x + (rng() - 0.5) * 40 * (1 - skill); aimY = target.y - 20 + (rng() - 0.5) * 40 * (1 - skill); }
      }
      stepField(f, DT, { on: true, x: aimX, y: aimY }, up, rng);
      for (const e of f.ev) {
        if (e.kind === "caught") { jar.push(e.c.def.id); coins += catchCoinsOf(e.c.def, MUTATIONS.find((m) => m.id === e.c.mut)?.mult ?? 1); if (e.c.resist > 1.5) tugWon++; }
        if (e.kind === "tug") tugs++;
      }
      f.ev.length = 0;
      v += DT; t += DT;
      coins += income() * DT;
    }
    if (firstJar < 0) firstJar = t;
    for (const id of jar) index[id] = (index[id] ?? 0) + 1;
    t += 6; coins += income() * 6; // walk to the park, look around, buy
    for (const b of BIOMES) if (!owned.includes(b.id) && coins >= b.price) { coins -= b.price; owned.push(b.id); biome = b.id; if (b.id === "forest") forest = t; }
    for (;;) {
      const o = UPGRADE_ORDER.map((id) => ({ id, c: upgradeCost(up, id) })).filter((x) => x.c !== null).sort((a, b) => a.c! - b.c!)[0];
      if (!o || o.c! > coins) break;
      // save up for the forest once it is close
      if (!owned.includes("forest") && coins - o.c! < BIOMES[1].price * 0.6 && o.c! > 200) break;
      coins -= o.c!; up[o.id]++; buys++;
    }
    for (const m of [1, 3, 5, 10, 15]) if (coinsAt.length < [1, 3, 5, 10, 15].indexOf(m) + 1 && t >= m * 60) coinsAt.push(Math.round(coins));
  }
  res.push({ firstJar, forest, coins: coinsAt, buys, income: Math.round(income()), species: Object.keys(index).length, tugs, tugWon });
}
console.log(`Critter Vac sim: ${SESSIONS} sessions x ${MINUTES} min`);
console.log(`first full jar    median ${fmt(median(res.map((r) => r.firstJar)))}  (target 0:15-1:00: the first reward comes fast)`);
console.log(`forest unlocked   median ${fmt(median(res.map((r) => r.forest)))}, ${Math.round((res.filter((r) => r.forest >= 0).length / SESSIONS) * 100)}% of sessions (target 5:00-10:00)`);
console.log(`upgrades bought   median ${median(res.map((r) => r.buys))}; species found median ${median(res.map((r) => r.species))}/${CRITTERS.length}; park income median ${median(res.map((r) => r.income))}/s`);
console.log(`tug fights        ${(res.reduce((a, r) => a + r.tugs, 0) / SESSIONS).toFixed(1)} per session, won ${Math.round((res.reduce((a, r) => a + r.tugWon, 0) / Math.max(1, res.reduce((a, r) => a + r.tugs, 0))) * 100)}%`);
