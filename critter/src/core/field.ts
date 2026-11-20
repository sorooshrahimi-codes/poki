import { CONE, power, range, tankSize, type Upgrades } from "./economy.ts";
import type { BiomeId, MutationId } from "./types.ts";
import { MUTATIONS, RARITY_WEIGHT, critterOf, type CritterDef } from "../data/critters.ts";
import type { Rng } from "./rng.ts";

// The catching field, as pure rules (the renderer only draws this state).
// Critters roam a meadow seen from the side; y is where their feet touch the ground, and a smaller
// y is further away. Hold to switch the vacuum on; everything inside the cone gets pulled in.
// Critters that resist (rare, golden, big) need the cone kept on them until their grip bar fills.

export type CState = "roam" | "pulled" | "tug" | "caught";
export interface Critter {
  uid: number; def: CritterDef; mut: MutationId | null;
  x: number; y: number; dir: 1 | -1;
  /** height above the ground while hopping or being lifted */
  lift: number;
  hopT: number; hopPer: number;
  state: CState;
  /** tug progress 0..1 */
  grip: number;
  /** seconds this critter has been in the cone (for the stretch effect) */
  pullT: number;
  resist: number;
  /** appears with a little pop */
  born: number;
}

export type Surprise = "visitor" | "golden_rain" | "stampede";
export type FieldEv = { kind: "surprise"; s: Surprise; c?: Critter } | { kind: "caught"; c: Critter } | { kind: "tug"; c: Critter } | { kind: "escape"; c: Critter } | { kind: "full" } | { kind: "spawn"; c: Critter };

export interface Field {
  biome: BiomeId;
  /** seconds until the next surprise */
  nextSurprise: number;
  W: number; H: number;
  /** ground band: far edge and near edge (feet y) */
  farY: number; nearY: number;
  nozzle: { x: number; y: number };
  critters: Critter[];
  beam: boolean; aim: { x: number; y: number };
  jar: number; cap: number;
  t: number; spawnT: number;
  /** scripted first-minute moments already done */
  script: number;
  /** next spawns forced golden (a rewarded lure) */
  lure: number;
  ev: FieldEv[];
}

let uid = 1;
export const depthK = (f: Field, y: number) => 0.62 + 0.38 * Math.max(0, Math.min(1, (y - f.farY) / (f.nearY - f.farY)));

export function newField(W: number, H: number, up: Upgrades, biome: BiomeId = "meadow"): Field {
  return { biome, nextSurprise: 22, W, H, farY: H * 0.6, nearY: H * 0.88, nozzle: { x: 0, y: 0 }, critters: [], beam: false, aim: { x: W * 0.6, y: H * 0.7 }, jar: 0, cap: tankSize(up), t: 0, spawnT: 0, script: 0, lure: 0, ev: [] };
}

function pick(f: Field, rng: Rng): CritterDef {
  const pool = critterOf(f.biome);
  let total = 0;
  for (const d of pool) total += RARITY_WEIGHT[d.rarity];
  let r = rng() * total;
  for (const d of pool) { r -= RARITY_WEIGHT[d.rarity]; if (r <= 0) return d; }
  return pool[0];
}

export function spawn(f: Field, rng: Rng, opt: { def?: CritterDef; mut?: MutationId | null; x?: number; y?: number } = {}): Critter {
  const def = opt.def ?? pick(f, rng);
  let mut: MutationId | null = opt.mut === undefined ? null : opt.mut;
  if (opt.mut === undefined) {
    if (f.lure > 0) { mut = "gold"; f.lure--; }
    else for (const m of MUTATIONS) if (rng() < m.chance) { mut = m.id; break; }
  }
  const mr = MUTATIONS.find((m) => m.id === mut)?.resist ?? 1;
  const c: Critter = {
    uid: uid++, def, mut,
    x: opt.x ?? f.nozzle.x + 90 + rng() * (f.W - f.nozzle.x - 120),
    y: opt.y ?? f.farY + rng() * (f.nearY - f.farY),
    dir: rng() < 0.5 ? 1 : -1, lift: 0, hopT: rng(), hopPer: 0.7 + rng() * 0.8,
    state: "roam", grip: 0, pullT: 0, resist: def.resist * mr, born: f.t,
  };
  f.critters.push(c);
  f.ev.push({ kind: "spawn", c });
  return c;
}

export interface FieldInput { on: boolean; x: number; y: number }

export function stepField(f: Field, dt: number, inp: FieldInput, up: Upgrades, rng: Rng) {
  f.t += dt;
  f.cap = tankSize(up);
  f.beam = inp.on && f.jar < f.cap;
  if (inp.on && f.jar >= f.cap && Math.floor(f.t * 2) !== Math.floor((f.t - dt) * 2)) f.ev.push({ kind: "full" });
  f.aim.x = inp.x; f.aim.y = inp.y;

  // keep the meadow lively: a new critter every couple of seconds, up to a crowd
  const want = 7;
  f.spawnT -= dt;
  if (f.spawnT <= 0 && f.critters.filter((c) => c.state !== "caught").length < want) { spawn(f, rng); f.spawnT = 1.4 + rng() * 1.6; }
  // the first minute is scripted: easy catches close by, then a golden one that fights back
  const pool = critterOf(f.biome);
  if (f.script === 0) {
    for (let i = 0; i < 4; i++) spawn(f, rng, { def: pool[i], mut: null, x: f.nozzle.x + 110 + i * 46, y: f.farY + (f.nearY - f.farY) * (0.35 + (i % 2) * 0.4) });
    f.script = 1;
  } else if (f.script === 1 && f.t > 7) {
    spawn(f, rng, { def: pool[0], mut: "gold", x: f.nozzle.x + 170, y: f.farY + (f.nearY - f.farY) * 0.6 });
    f.script = 2;
  }

  // surprises keep every visit different: a rare visitor, a shower of golden critters, a stampede
  f.nextSurprise -= dt;
  if (f.nextSurprise <= 0 && f.script >= 2) {
    f.nextSurprise = 26 + rng() * 18;
    const roll = rng();
    if (roll < 0.45) {
      const rares = pool.filter((d) => d.rarity !== "common");
      const w = (d: CritterDef) => (d.rarity === "rare" ? 6 : d.rarity === "epic" ? 3 : 1);
      let tot = rares.reduce((a, d) => a + w(d), 0), r = rng() * tot, def = rares[0];
      for (const d of rares) { r -= w(d); if (r <= 0) { def = d; break; } }
      const c = spawn(f, rng, { def, x: f.W - 30, y: f.farY + (f.nearY - f.farY) * (0.3 + rng() * 0.5) });
      c.dir = -1;
      f.ev.push({ kind: "surprise", s: "visitor", c });
    } else if (roll < 0.75) {
      for (let i = 0; i < 3; i++) spawn(f, rng, { mut: "gold", x: f.nozzle.x + 140 + i * 60, y: f.farY + (f.nearY - f.farY) * (0.2 + i * 0.3) });
      f.ev.push({ kind: "surprise", s: "golden_rain" });
    } else {
      for (let i = 0; i < 6; i++) { const c = spawn(f, rng, { def: pool[Math.floor(rng() * 5)], mut: null, x: f.W + 20 + i * 30, y: f.farY + (f.nearY - f.farY) * rng() }); c.dir = -1; c.hopPer = 0.45; }
      f.ev.push({ kind: "surprise", s: "stampede" });
    }
  }

  const P = power(up), R = range(up);
  const ang = Math.atan2(f.aim.y - f.nozzle.y, f.aim.x - f.nozzle.x);
  for (const c of f.critters) {
    if (c.state === "caught") continue;
    // where its body is (feet minus lift), relative to the nozzle
    const bx = c.x, by = c.y - c.lift - c.def.size * 0.4 * depthK(f, c.y);
    const dx = bx - f.nozzle.x, dy = by - f.nozzle.y, dist = Math.hypot(dx, dy);
    let da = Math.atan2(dy, dx) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
    // a critter already in a tug stays caught a little past the cone's reach: fair to a moving finger
    const reach = c.state === "tug" ? R * 1.15 : R, spread = c.state === "tug" ? CONE * 1.1 : CONE;
    const inCone = f.beam && dist < reach && Math.abs(da) < spread;

    if (c.state === "roam" || c.state === "tug") {
      if (inCone) {
        if (c.resist <= 1.5) c.state = "pulled";
        else {
          if (c.state !== "tug") { c.state = "tug"; f.ev.push({ kind: "tug", c }); }
          c.grip += dt * (P / 230) / c.resist * 0.95;
          // it struggles: little scrambles sideways, trying to slip out of the cone
          c.x += Math.sin(f.t * 7 + c.uid) * 60 * dt;
          c.lift = Math.max(0, Math.sin(f.t * 11 + c.uid) * 6);
          if (c.grip >= 1) c.state = "pulled";
        }
      } else if (c.state === "tug") {
        c.grip -= dt * 0.5;
        if (c.grip <= 0) { c.grip = 0; c.state = "roam"; f.ev.push({ kind: "escape", c }); c.dir = dx > 0 ? 1 : -1; }
      }
    }
    if (c.state === "roam") {
      // hop about, turning at the edges
      c.hopT += dt / c.hopPer;
      const ph = c.hopT % 1;
      c.lift = ph < 0.45 ? Math.sin((ph / 0.45) * Math.PI) * c.def.hop * depthK(f, c.y) : 0;
      if (ph < 0.45) c.x += c.dir * 34 * dt;
      if (c.x < f.nozzle.x + 60) c.dir = 1;
      if (c.x > f.W - 24) c.dir = -1;
      c.pullT = Math.max(0, c.pullT - dt);
    } else if (c.state === "pulled") {
      // flies into the nozzle, faster as it gets close
      c.pullT += dt;
      const sp = (P / Math.max(1, c.resist * 0.6)) * (0.6 + 0.8 * Math.min(1, c.pullT));
      const k = Math.min(1, (sp * dt) / Math.max(1, dist));
      c.x -= dx * k;
      const nby = by - dy * k;
      c.lift = c.y - nby - c.def.size * 0.4 * depthK(f, c.y);
      if (dist < 16) { c.state = "caught"; f.jar++; f.ev.push({ kind: "caught", c }); }
      if (!f.beam && c.resist > 1.5) { c.state = "tug"; }
    }
  }
  f.critters = f.critters.filter((c) => c.state !== "caught");
}
