// Pacing with levels: a bot plays each place's five levels in order (replays the first one when the giant bar is
// not full yet), buys the cheapest upgrades between levels, then fights the giant.  node tools/simlevels.ts [sessions] [minutes]
import { newField, spawn, stepField } from "../src/core/field.ts";
import { UPGRADE_ORDER, upgradeCost, vacLevel, valueMult, type Upgrades } from "../src/core/economy.ts";
import { makeRng } from "../src/core/rng.ts";
import { BIOMES, CRITTERS, MUTATIONS, STAR_MULT, catchCoinsOf, critterOf, giantStep, starOf } from "../src/data/critters.ts";
import type { BiomeId } from "../src/core/types.ts";

const SESSIONS = Number(process.argv[2] ?? 30), MINUTES = Number(process.argv[3] ?? 25), DT = 1 / 30;
const median = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
const fmt = (s: number) => (isNaN(s) ? "never" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);
const CH: Record<string, number> = { common: 0.06, rare: 0.12, epic: 0.25, legendary: 0.5, secret: 0.5 };
const tally: Record<string, [number, number]> = {};
const winAt: number[][] = [], levelTimes: number[] = [], fails: number[] = [];
for (let n = 0; n < SESSIONS; n++) {
  const rng = makeRng(n * 7919 + 3), skill = 0.5 + rng() * 0.45;
  const up: Upgrades = { power: 0, range: 0, tank: 0 }, index: Record<string, number> = {};
  let coins = 0, t = 0, charge = 0, wins = 0, failN = 0;
  const income = () => CRITTERS.reduce((a, d) => a + d.income * STAR_MULT[starOf(index[d.id] ?? 0)], 0);
  const stars: Record<string, number[]> = {};
  const play = (biome: BiomeId, task: string, goal: number, limit: number, giant: boolean) => {
    const f = newField(360, 640, up, biome); f.script = 2; f.nozzle = { x: 110, y: 640 * 0.8 };
    const k = BIOMES.findIndex((b) => b.id === biome);
    const commons = critterOf(biome).filter((d) => d.rarity === "common");
    if (task === "species") f.favor = commons[(k + 1) % commons.length].id;
    if (task === "golden") f.lure = 999;
    for (let i = 0; i < 6; i++) spawn(f, rng);
    if (giant) { const g = giantStep(wins); f.giant = { id: g.id, ready: true, resist: g.resist, scale: g.scale }; f.giantT = 1.5; }
    let cnt = 0, v = 0, holdT = 0, ax = 250, ay = 560, combo = 0, last = -9;
    while (v < (giant ? 200 : limit)) {
      holdT -= DT;
      if (holdT <= 0) {
        holdT = 0.25 + (1 - skill) * 0.4;
        const target = f.critters.find((c) => c.state === "tug") ?? f.critters.filter((c) => c.state !== "caught" && !c.hidden && (!giant || c.boss > 0 || !f.critters.some((b) => b.boss > 0))).sort((a, b) => Math.hypot(a.x - f.nozzle.x, a.y - f.nozzle.y) - Math.hypot(b.x - f.nozzle.x, b.y - f.nozzle.y))[0];
        if (target) { ax = target.x + (rng() - 0.5) * 40 * (1 - skill); ay = target.y - target.lift - 25 + (rng() - 0.5) * 40 * (1 - skill); }
      }
      stepField(f, DT, { on: true, x: ax, y: ay }, up, rng);
      for (const e of f.ev) if (e.kind === "caught") {
        const c = e.c;
        combo = v - last < 1.7 ? combo + 1 : 1; last = v;
        index[c.def.id] = (index[c.def.id] ?? 0) + 1;
        coins += catchCoinsOf(c.def, MUTATIONS.find((m) => m.id === c.mut)?.mult ?? 1) * valueMult(up) * (1 + (combo - 1) * 0.25) * (1 + 1.5 * Math.floor(wins / 6));
        if (c.boss > 0) { f.ev.length = 0; t += v; return { ok: true, left: 1 }; }
        charge += CH[c.def.rarity] * (c.mut ? 2 : 1);
        if (task === "any" || task === "rival" || (task === "species" && c.def.id === f.favor) || (task === "golden" && c.mut === "gold")) cnt++;
        else if (task === "combo") cnt = Math.max(cnt, combo);
      }
      f.ev.length = 0;
      v += DT; coins += income() * DT;
      if (!giant && cnt >= goal) break;
    }
    t += v;
    return { ok: giant ? false : cnt >= goal, left: Math.max(0, (limit - v) / limit) };
  };
  const shop = () => { for (;;) { const o = UPGRADE_ORDER.map((id) => ({ id, c: upgradeCost(up, id) })).filter((x) => x.c !== null).sort((a, b) => a.c! - b.c!)[0]; if (!o || o.c! > coins) break; coins -= o.c!; up[o.id]++; } };
  while (t < MINUTES * 60) {
    const g = giantStep(wins), biome = g.biome, k = BIOMES.findIndex((b) => b.id === biome);
    const lap = Math.floor(wins / 6), key = lap ? `${biome}@${lap}` : biome;
    const st = (stars[key] ??= [0, 0, 0, 0, 0]);
    const tasks = ["any", "species", "combo", "golden", "rival"];
    const lapK = 1 + 0.12 * Math.min(4, Math.floor(wins / 6));
    const goals0 = [k ? 11 + k * 3 : 8, 7 + k, 6 + (k >= 2 ? 1 : 0), 7 + k, 18 + k * 3]; const goals = goals0.map((x) => Math.round(x * lapK)); const limits = [45, 45, 45, 35, 55];
    const i = st.findIndex((x) => x === 0);
    if (i >= 0) {
      const s0 = t, r = play(biome, tasks[i], goals[i], limits[i], false);
      levelTimes.push(t - s0);
      if (r.ok) st[i] = r.left >= 0.5 ? 3 : r.left >= 0.25 ? 2 : 1; else failN++;
      const key = `${biome}:${tasks[i]}`; (tally[key] ??= [0, 0])[r.ok ? 0 : 1]++;
      coins += r.ok ? (income() * 25 + 80 * (1 + k * 3)) * (1 + st[i] * 0.5) : 0;
    } else if (vacLevel(up) + Math.floor(charge) >= g.need) {
      const r = play(biome, "giant", 1, 0, true);
      if (r.ok) { (winAt[wins] ??= []).push(t); wins++; charge = 0; }
    } else {
      const s0 = t, r = play(biome, "any", 11 + k * 3, 45, false); levelTimes.push(t - s0);
      if (r.ok) coins += income() * 25 + 80 * (1 + k * 3);
    }
    t += 4; coins += income() * 4; // the map, an upgrade or two
    shop();
  }
  fails.push(failN);
}
console.log(`levels sim: ${SESSIONS} sessions x ${MINUTES} min`);
console.log(`a level takes median ${fmt(median(levelTimes))}; failed levels per session median ${median(fails)}`);
console.log("giant n beaten at (median): " + winAt.map((a, i) => `#${i + 1} ${fmt(median(a))} (${a.length})`).join(", "));
console.log(Object.entries(tally).map(([k, [w, l]]) => `${k} ${Math.round((w / (w + l)) * 100)}%`).join("  "));
