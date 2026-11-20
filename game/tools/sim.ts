// Economy simulator: plays the real dive rules (src/core) with a bot, many times, and prints the
// pacing targets from the design (first upgrade ~40 s, ocean ~6 min). It is also the judge for
// AI-made content: run it after adding fish and it fails (exit 1) when pacing leaves the targets.
//   node tools/sim.ts [sessions=200] [minutes=15]
import { catchValue, COLUMN, VENT_WARN, ventCycle, resolveSnap, startDive, stepDive, type Dive, type DiveContext, type DiveInput } from "../src/core/dive.ts";
import { newDirector, noteDive, noteSurprise, pickSurprise } from "../src/core/director.ts";
import { maxDepth, UPGRADE_ORDER, upgradeCost, capacity as capOf } from "../src/core/economy.ts";
import { makeRng } from "../src/core/rng.ts";
import { weatherAt } from "../src/core/weather.ts";
import { newSave } from "../src/core/save.ts";
import type { Rarity } from "../src/core/types.ts";
import { FISH } from "../src/data/fish.ts";
import { RARITY_ORDER, ZONES } from "../src/data/world.ts";

const SESSIONS = Number(process.argv[2] ?? 200);
const MINUTES = Number(process.argv[3] ?? 15);
const DT = 1 / 30;
/** cast, reveal and dock time per dive (seconds) */
const OVERHEAD = 4;

const bad = (f: { def: { rarity: Rarity; junk?: boolean } }) => f.def.junk || f.def.rarity === "common";

function botInput(d: Dive, rng: () => number, skill: number, memo: { x: number; next: number; hold: boolean; stuck: number; lastY: number; aim?: number }): DiveInput {
  if (d.phase === "fight" && d.fight) {
    // a human sees the zone late and over-corrects: decide every 0.12-0.35 s, aim with noise
    const fg = d.fight;
    if (fg.kind === "timing") {
      // a human taps a little early or late
      // one decision per ring: a human picks a moment and commits to it
      if (fg.ring > 0.9 || memo.aim === undefined) memo.aim = 0.3 + (rng() - 0.5) * (1 - skill) * 0.6;
      const tap = fg.t > 2.6 && Math.abs(fg.ring - memo.aim) < 0.03 && d.t >= memo.next;
      if (tap) memo.next = d.t + 0.5;
      return { targetX: null, axis: 0, hold: false, tap };
    }
    if (fg.kind === "follow") {
      // a human looks, then moves the finger: a quarter to half a second late, and never exactly on the fish
      if (d.t >= memo.next) { memo.next = d.t + 0.25 + (1 - skill) * 0.3; memo.x = (fg.fishPos + (rng() - 0.5) * (0.12 + (1 - skill) * 0.3)) * COLUMN; }
      return { targetX: memo.x, axis: 0, hold: false };
    }
    if (d.t >= memo.next) {
      memo.next = d.t + 0.12 + (1 - skill) * 0.23;
      const aim = fg.zone + (rng() - 0.5) * (1 - skill) * 0.6;
      memo.hold = fg.marker + fg.vel * 0.1 * skill < aim;
    }
    return { targetX: null, axis: 0, hold: memo.hold };
  }
  // a crab holds the hook: tap as fast as a human does (4-7 taps a second)
  if (d.surprise?.kind === "crab" && d.surprise.state === "active") {
    const tap = d.t >= memo.next;
    if (tap) memo.next = d.t + 0.14 + (1 - skill) * 0.12 + rng() * 0.05;
    return { targetX: null, axis: 0, hold: false, tap };
  }
  // ice: blocked by a slab -> go around it; near the surface -> aim for the hole
  if (d.slabs.length || d.hole) {
    if (Math.abs(d.hookY - memo.lastY) < 0.5) memo.stuck += 1 / 30; else memo.stuck = 0;
    memo.lastY = d.hookY;
    if (memo.stuck > 0.25) {
      const sl = d.slabs.find((q) => Math.abs(d.hookX - q.x) <= q.w / 2 + 8 && Math.abs(d.hookY - q.y) < 40);
      memo.x = sl ? (sl.x > COLUMN / 2 ? sl.x - sl.w / 2 - 25 : sl.x + sl.w / 2 + 25) : COLUMN / 2;
      memo.next = d.t + 0.5;
      return { targetX: memo.x, axis: 0, hold: false };
    }
    if (d.phase === "ascend" && d.hookY < 160 && d.hole) return { targetX: COLUMN / 2, axis: 0, hold: false };
  }
  // reaction time: the bot re-decides every 0.15-0.4 s
  if (d.t < memo.next) return { targetX: memo.x, axis: 0, hold: false };
  memo.next = d.t + 0.15 + (1 - skill) * 0.25;
  const down = d.phase === "descend";
  let best = d.hookX, bestScore = -Infinity;
  for (let x = 15; x <= COLUMN - 15; x += 15) {
    let s = -Math.abs(x - d.hookX) * 0.002;
    for (const f of d.fish) {
      if (f.hooked) continue;
      const dy = down ? f.y - d.hookY : d.hookY - f.y;
      if (dy < 0 || dy > 140) continue;
      const near = Math.abs(f.x + f.dir * f.speed * (dy / 200) - x) < f.size * 0.5 + 18;
      if (!near) continue;
      if (down) s += bad(f) ? -1 : catchValue(f) / 100;
      else s += catchValue(f) / 50;
    }
    // vents: a human sees the glow and steers clear of a column about to erupt
    for (const v of d.vents) {
      if (Math.abs(x - v.x) > 34) continue;
      const ahead = down ? v.y + v.h - d.hookY : d.hookY - v.y;
      if (ahead < -10 || ahead > 220) continue;
      if (ventCycle(v, d.t + 0.4) >= VENT_WARN * skill + 0.2) s -= 3;
    }
    if (s > bestScore) { bestScore = s; best = x; }
  }
  if (rng() > skill) best = d.hookX + (rng() - 0.5) * 120;
  memo.x = best;
  return { targetX: best, axis: 0, hold: false };
}

interface Result { buys: number[]; gaps: number[]; ice: number; surprises: number; firstSurprise: number; stolen: number; firstUpgrade: number; ocean: number; coins: number[]; rarities: Record<Rarity, number>; fights: number; won: number; dives: number; legFights: number; firstLegendary: number }

const KSTAT: Record<string, [number, number]> = {};
let curKind = "";
function session(seed: number): Result {
  const rng = makeRng(seed);
  const skill = 0.45 + rng() * 0.45; // from distracted kid to focused player
  const s = newSave();
  let t = 0, firstUpgrade = -1, ocean = -1, ice = -1;
  const buyTimes: number[] = [];
  const coins: number[] = [];
  const rarities = Object.fromEntries(RARITY_ORDER.map((r) => [r, 0])) as Record<Rarity, number>;
  let fights = 0, won = 0, dives = 0, earned = 0, legFights = 0, firstLegendary = -1, surprises = 0, firstSurprise = -1, stolen = 0;
  const director = newDirector();
  while (t < MINUTES * 60) {
    // real weather rotation, each session starting at a different time of day
    const ctx: DiveContext = { upgrades: s.upgrades, event: null, night: false, rng, weather: weatherAt(seed * 977_000 + t * 1000).def };
    const kind = pickSurprise(director, t, { zone: s.zone, bottom: Math.min(maxDepth(s.upgrades), ZONES[s.zone].floor), floor: ZONES[s.zone].floor, capacity: capOf(s.upgrades) }, rng);
    if (kind) { noteSurprise(director, kind, t); surprises++; if (firstSurprise < 0) firstSurprise = t; }
    const d = startDive(s.zone, ctx, kind);
    const memo = { x: d.hookX, next: 0, hold: false, stuck: 0, lastY: -1 };
    let fighting = false;
    while (d.phase !== "done" && d.t < 120) {
      if (d.phase === "snapped") resolveSnap(d, false);
      if (d.phase === "fight" && !fighting) {
        fighting = true; fights++;
        if (d.fight) { const k = d.fight.kind; KSTAT[k] = KSTAT[k] ?? [0, 0]; KSTAT[k][0]++; curKind = k; }
        if (d.fight && d.fight.fish.def.rarity !== "epic") { legFights++; if (firstLegendary < 0) firstLegendary = t + d.t; }
      }
      if (d.phase !== "fight") fighting = false;
      stepDive(d, DT, botInput(d, rng, skill, memo), ctx);
      for (const fx of d.fx) { if (fx.kind === "fightWon") { won++; if (curKind) KSTAT[curKind][1]++; } if (fx.kind === "stolen") stolen++; }
      d.fx.length = 0;
    }
    dives++;
    t += d.t + OVERHEAD;
    for (const f of d.hooked) { const v = catchValue(f); s.coins += v; earned += v; rarities[f.def.rarity]++; }
    s.coins += d.bonusCoins; earned += d.bonusCoins;
    noteDive(director, !!kind || d.hooked.some((f) => f.mut || f.def.rarity !== "common"));
    // spending: unlock the ocean as soon as it is affordable, otherwise the cheapest upgrade,
    // but stop buying small upgrades once the ticket is close
    const oceanLocked = !s.zones.includes("ocean");
    if (oceanLocked && s.coins >= ZONES.ocean.price) { s.coins -= ZONES.ocean.price; s.zones.push("ocean"); s.zone = "ocean"; ocean = t; }
    else if (!oceanLocked && s.upgrades.line >= 12) {
      // the map forks after the ocean: half the bots go north, half to the reef
      const pick = seed % 2 ? "ice" : "reef";
      if (!s.zones.includes(pick) && s.coins >= ZONES[pick].price) { s.coins -= ZONES[pick].price; s.zones.push(pick); s.zone = pick; ice = t; }
    }
    for (;;) {
      const options = UPGRADE_ORDER.map((id) => ({ id, cost: upgradeCost(s.upgrades, id) })).filter((o) => o.cost !== null) as { id: typeof UPGRADE_ORDER[number]; cost: number }[];
      options.sort((a, b) => a.cost - b.cost);
      const o = options[0];
      if (!o || o.cost > s.coins) break;
      if (!s.zones.includes("ocean") && s.coins - o.cost < ZONES.ocean.price * 0.5 && o.cost > ZONES.ocean.price * 0.3) break;
      s.coins -= o.cost; s.upgrades[o.id]++;
      buyTimes.push(t);
      if (firstUpgrade < 0) firstUpgrade = t;
    }
    while (coins.length < Math.floor(t / 60)) coins.push(earned);
  }
  const buys = [120, 300, 600].map((m) => buyTimes.filter((x) => x <= m).length);
  // the longest wait between two purchases in the first 5 minutes: the "nothing to buy" dead time
  const early = [0, ...buyTimes.filter((x) => x <= 300), 300];
  const mid = [300, ...buyTimes.filter((x) => x > 300 && x <= 900), 900];
  const gaps = [Math.max(...early.slice(1).map((x, i) => x - early[i])), Math.max(...mid.slice(1).map((x, i) => x - mid[i]))];
  return { buys, gaps, ice, firstUpgrade, ocean, coins, rarities, fights, won, dives, legFights, firstLegendary, surprises, firstSurprise, stolen };
}

const median = (a: number[]) => { const b = a.filter((x) => x >= 0).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
const results = Array.from({ length: SESSIONS }, (_, i) => session(1000 + i));
const fmt = (s: number) => (isNaN(s) ? "never" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);

const first = median(results.map((r) => r.firstUpgrade));
const ocean = median(results.map((r) => r.ocean));
const reachedOcean = results.filter((r) => r.ocean >= 0).length / SESSIONS;
console.log(`Deep Luck economy sim: ${SESSIONS} sessions x ${MINUTES} min, ${FISH.length} fish`);
console.log(`first upgrade   median ${fmt(first)}   (target 0:12-1:15: sooner is better)`);
console.log(`ocean unlocked  median ${fmt(ocean)}   (target 4:30-8:00), ${(reachedOcean * 100).toFixed(0)}% of sessions`);
console.log(`upgrades bought  by 2 min ${median(results.map((r) => r.buys[0]))}, by 5 min ${median(results.map((r) => r.buys[1]))}, by 10 min ${median(results.map((r) => r.buys[2]))}; longest wait in first 5 min median ${fmt(median(results.map((r) => r.gaps[0])))}, in 5-15 min ${fmt(median(results.map((r) => r.gaps[1])))}`);
console.log(`third zone       median ${fmt(median(results.map((r) => r.ice)))}, ${(results.filter((r) => r.ice >= 0).length / SESSIONS * 100).toFixed(0)}% of sessions`);
console.log(`dives per minute ${(median(results.map((r) => r.dives)) / MINUTES).toFixed(1)}`);
for (const m of [1, 3, 5, 10, 15].filter((m) => m <= MINUTES)) console.log(`coins earned by minute ${String(m).padStart(2)}: ${median(results.map((r) => r.coins[m - 1] ?? 0))}`);
const tot = Object.fromEntries(RARITY_ORDER.map((r) => [r, results.reduce((a, x) => a + x.rarities[r], 0) / SESSIONS]));
console.log("catches per session:", Object.entries(tot).map(([k, v]) => `${k} ${(v as number).toFixed(1)}`).join(", "));
const fights = results.reduce((a, r) => a + r.fights, 0), won = results.reduce((a, r) => a + r.won, 0);
console.log(`fights per session ${(fights / SESSIONS).toFixed(1)}, won ${(fights ? (won / fights) * 100 : 0).toFixed(0)}% (target 50-92%: kids should mostly win, with real near-misses)`);

console.log(`legendary fights per session ${(results.reduce((a, r) => a + r.legFights, 0) / SESSIONS).toFixed(1)}, first one median ${fmt(median(results.map((r) => r.firstLegendary)))}, ${(results.filter((r) => r.firstLegendary >= 0).length / SESSIONS * 100).toFixed(0)}% of sessions (target: most players meet one in the first session)`);

const sur = results.reduce((a, r) => a + r.surprises, 0) / SESSIONS;
console.log(`surprises per session ${sur.toFixed(1)} (one every ${((MINUTES * 60) / sur).toFixed(0)} s), first at ${fmt(median(results.map((r) => r.firstSurprise)))}, sharks stole ${(results.reduce((a, r) => a + r.stolen, 0) / SESSIONS).toFixed(1)} fish`);

console.log("fight types:", Object.entries(KSTAT).map(([k, [n, w]]) => `${k} ${(w / n * 100).toFixed(0)}% of ${n}`).join(", "));
const fails: string[] = [];
if (!(first >= 12 && first <= 75)) fails.push("first upgrade out of range");
if (!(ocean >= 270 && ocean <= 480)) fails.push("ocean unlock out of range");
if (fights && !(won / fights >= 0.5 && won / fights <= 0.92)) fails.push("fight win rate out of range");
if (fails.length) { console.log("FAIL: " + fails.join("; ")); process.exit(1); }
console.log("PASS");
