import { cone, power, range, tankSize, type Upgrades } from "./economy.ts";
import type { BiomeId, MutationId } from "./types.ts";
import { MUTATIONS, RARITY_WEIGHT, critterOf, type CritterDef, CRITTER_BY_ID } from "../data/critters.ts";
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
  /** burrow (under ground) or shell (tucked in): cannot be pulled right now */
  hidden: boolean;
  /** timer for burrow / shell / shy behaviour */
  cycleT: number;
  /** shy: seconds left of a dash away */
  fleeT: number;
  /** split critters already split once */
  split: boolean;
  /** size multiplier (split halves are smaller, bosses are huge) */
  scale: number;
  /** boss: phases left to win (0 = not a boss) */
  boss: number;
  /** fly: cruising height */
  air: number;
  /** seconds left trapped in a bubble (floats down, cannot fly, hide or flee) */
  bubbled: number;
  /** seconds left frozen by a companion (does not move, easy to catch) */
  frozen: number;
  /** seconds left being herded toward the kid */
  herd: number;
  /** the first-time giant: it cannot be pulled in yet, it laughs and walks off */
  tease?: boolean;
  leaving?: boolean;
  /** volcano: seconds left flying after an eruption threw it up */
  launch?: number;
}
export type ToolId = "vac" | "bubble" | "flute";
/** companions: legends that come along and help */
export type CompanionId = "sunpup" | "prismane" | "elderoak" | "moonfawn" | "frostking" | "wyrmling";
export const COMPANIONS: CompanionId[] = ["sunpup", "prismane", "elderoak", "moonfawn", "frostking", "wyrmling"];

export type Surprise = "visitor" | "golden_rain" | "stampede" | "boss";
export type FieldEv = { kind: "rivalIn" } | { kind: "stolen"; c: Critter } | { kind: "rivalBlown" } | { kind: "rivalMiss" } | { kind: "tease"; c: Critter } | { kind: "erupt" } | { kind: "surprise"; s: Surprise; c?: Critter } | { kind: "caught"; c: Critter } | { kind: "tug"; c: Critter } | { kind: "escape"; c: Critter } | { kind: "full" } | { kind: "spawn"; c: Critter } | { kind: "split"; c: Critter } | { kind: "hide"; c: Critter } | { kind: "flee"; c: Critter } | { kind: "bossPhase"; c: Critter } | { kind: "bubbled"; c: Critter } | { kind: "ability"; id: CompanionId };

export interface Field {
  biome: BiomeId;
  /** seconds until the next surprise */
  nextSurprise: number;
  W: number; H: number;
  /** the play area: on wide screens it stays a phone-like strip in the middle (the kid stands at `left`) */
  left: number; right: number;
  /** ground band: far edge and near edge (feet y) */
  farY: number; nearY: number;
  nozzle: { x: number; y: number };
  /** the kid walks: x = steps from the left edge, d = depth on the ground (1 = nearest), walk = distance walked (for the stride) */
  kid: { x: number; d: number; walk: number; face: 1 | -1 };
  /** this place's giant, when it is still to be caught; ready = the vacuum is strong enough, so it comes down */
  giant: { id: string; ready: boolean; resist: number; scale: number } | null;
  giantT: number;
  /** volcano: seconds to the next eruption */
  eruptT: number;
  /** the rival kid: sneaks in now and then to steal a critter; blow him away with your wind */
  rival: { x: number; y: number; phase: "in" | "grab" | "out" | "blown"; t: number; target: number; got: boolean } | null;
  rivalT: number;
  /** set by the controller: rivals only show up once the player knows the basics */
  rivalOn: boolean;
  /** the special move: fills with catches; the controller fires it */
  special: number;
  /** seconds the special's swirl is still showing (for the drawing) */
  specialFx: number;
  /** perks: golden chance multiplier, a pull drawing critters toward the kid, slower rival */
  goldK: number;
  magnet: number;
  rivalSlow: number;
  /** level tweaks: a species that shows up often, a rival who raids nonstop */
  favor: string | null;
  rivalFast: boolean;
  critters: Critter[];
  beam: boolean; aim: { x: number; y: number };
  jar: number; cap: number;
  t: number; spawnT: number;
  /** scripted first-minute moments already done */
  script: number;
  /** the tool in hand */
  tool: ToolId;
  /** bubbles in flight, and bubble charges */
  bubbles: { x: number; y: number; vx: number; vy: number; life: number }[];
  charges: number;
  /** the legend that came along, and its ability timer */
  companion: CompanionId | null;
  abilityT: number;
  /** next spawns forced golden (a rewarded lure) */
  lure: number;

  ev: FieldEv[];
}

let uid = 1;
/** seconds of catching (across visits to the park) until the region boss may show up */
let bossClock = 75;
export const resetBossClock = (s: number) => { bossClock = s; };
export const depthK = (f: Field, y: number) => 0.62 + 0.38 * Math.max(0, Math.min(1, (y - f.farY) / (f.nearY - f.farY)));

export const PLAY_W = 620;
export function sizeField(f: Field, W: number, H: number) {
  f.W = W; f.H = H; f.farY = H * 0.56; f.nearY = H * 0.8;
  f.left = Math.max(6, (W - PLAY_W) / 2); f.right = Math.min(W, f.left + PLAY_W);
}
export function newField(W: number, H: number, up: Upgrades, biome: BiomeId = "meadow"): Field {
  const left = Math.max(6, (W - PLAY_W) / 2);
  return { tool: "vac", bubbles: [], charges: 3, companion: null, abilityT: 6, biome, nextSurprise: 22, W, H, left, right: Math.min(W, left + PLAY_W), farY: H * 0.56, nearY: H * 0.8, nozzle: { x: 0, y: 0 }, kid: { x: 0, d: 1, walk: 0, face: 1 }, giant: null, giantT: 4, eruptT: 9, special: 0, specialFx: 0, goldK: 1, magnet: 0, rivalSlow: 1, rival: null, rivalT: 25, rivalOn: false, favor: null, rivalFast: false, critters: [], beam: false, aim: { x: W * 0.6, y: H * 0.7 }, jar: 0, cap: tankSize(up), t: 0, spawnT: 0, script: 0, lure: 0, ev: [] };
}

function pick(f: Field, rng: Rng): CritterDef {
  if (f.favor && rng() < 0.45) return CRITTER_BY_ID[f.favor];
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
    // candy hills: a sugar rush of golden critters
    else for (const m of MUTATIONS) if (rng() < m.chance * (f.companion === "prismane" ? 2.2 : 1) * (f.biome === "candy" && m.id === "gold" ? 3.5 : 1) * (m.id === "gold" ? f.goldK : 1)) { mut = m.id; break; }
  }
  const mr = MUTATIONS.find((m) => m.id === mut)?.resist ?? 1;
  const c: Critter = {
    uid: uid++, def, mut,
    x: opt.x ?? (() => { const x = f.left + 40 + rng() * (f.right - f.left - 70); return Math.abs(x - f.nozzle.x) < 80 ? Math.min(f.right - 30, f.nozzle.x + 110) : x; })(),
    y: opt.y ?? f.farY + rng() * (f.nearY - f.farY),
    dir: rng() < 0.5 ? 1 : -1, lift: 0, hopT: rng(), hopPer: 0.7 + rng() * 0.8,
    state: "roam", grip: 0, pullT: 0, resist: def.resist * mr, born: f.t,
    hidden: false, cycleT: rng() * 3, fleeT: 0, split: false, scale: mut === "giant" ? 1.6 : 1, boss: 0, air: 70 + rng() * 90, bubbled: 0, frozen: 0, herd: 0,
  };
  f.critters.push(c);
  f.ev.push({ kind: "spawn", c });
  return c;
}

export interface FieldInput { on: boolean; x: number; y: number; tap?: boolean }
export const MAX_CHARGES = 3;

export function stepField(f: Field, dt: number, inp: FieldInput, up: Upgrades, rng: Rng) {
  f.t += dt;
  f.cap = Math.round(tankSize(up) * (f.companion === "wyrmling" ? 1.5 : 1));
  f.beam = inp.on && f.tool === "vac" && f.jar < f.cap;
  const flute = inp.on && f.tool === "flute";
  // bubble wand: each tap fires a bubble toward the finger; charges refill over time
  f.charges = Math.min(MAX_CHARGES, f.charges + dt / 1.4);
  if (inp.tap && f.tool === "bubble" && f.charges >= 1) {
    f.charges -= 1;
    const a = Math.atan2(inp.y - f.nozzle.y, inp.x - f.nozzle.x);
    f.bubbles.push({ x: f.nozzle.x, y: f.nozzle.y, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430, life: 1.1 });
  }
  for (const b of f.bubbles) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    for (const c of f.critters) {
      if (c.state === "caught" || c.bubbled > 0 || c.hidden) continue;
      const by = c.y - c.lift - c.def.size * c.scale * 0.4 * depthK(f, c.y);
      if (Math.hypot(c.x - b.x, by - b.y) < c.def.size * c.scale * 0.55 + 8) {
        c.bubbled = 7; c.fleeT = 0; c.state = c.state === "tug" ? "roam" : c.state; c.grip = 0; b.life = 0;
        f.ev.push({ kind: "bubbled", c });
        break;
      }
    }
  }
  f.bubbles = f.bubbles.filter((b) => b.life > 0);
  // companion abilities
  if (f.companion) {
    f.abilityT -= dt;
    if (f.abilityT <= 0) {
      const near = f.critters.filter((c) => c.state === "roam" && !c.hidden).sort((a, b) => Math.abs(a.x - f.nozzle.x) - Math.abs(b.x - f.nozzle.x));
      if (f.companion === "sunpup") { near.slice(0, 4).forEach((c) => { c.herd = 1.4; c.fleeT = 0; }); f.abilityT = 11; f.ev.push({ kind: "ability", id: "sunpup" }); }
      else if (f.companion === "frostking") { near.slice(0, 6).forEach((c) => { c.frozen = 2.8; }); f.abilityT = 10; f.ev.push({ kind: "ability", id: "frostking" }); }
      else f.abilityT = 999;
    }
  }
  if (inp.on && f.jar >= f.cap && Math.floor(f.t * 2) !== Math.floor((f.t - dt) * 2)) f.ev.push({ kind: "full" });
  f.aim.x = inp.x; f.aim.y = inp.y;
  // a gentle aim helper: the cone leans onto the critter nearest the finger (and holds on to one that is fighting back),
  // so a rough aim still works on a small phone screen
  if (inp.on) {
    let best: Critter | null = null, bd = 1e9;
    for (const c of f.critters) {
      if (c.state === "caught" || c.hidden) continue;
      const bx = c.x, by = c.y - c.lift - c.def.size * c.scale * 0.4 * depthK(f, c.y);
      // the giant is big: aiming anywhere on its body counts, and it wins over the little ones crowding around it
      const d = Math.max(0, Math.hypot(bx - inp.x, by - inp.y) - (c.boss > 0 ? c.def.size * c.scale * 0.4 : 0)) * (c.state === "tug" ? 0.4 : c.state === "pulled" ? 0.6 : 1) * (c.boss > 0 ? 0.3 : 1);
      if (d < bd) { bd = d; best = c; }
    }
    if (best && bd < 90) {
      const bx = best.x, by = best.y - best.lift - best.def.size * best.scale * 0.4 * depthK(f, best.y);
      const k = best.state === "tug" ? 0.8 : 0.55;
      f.aim.x = inp.x + (bx - inp.x) * k; f.aim.y = inp.y + (by - inp.y) * k;
    }
  }
  // while aiming, the kid strides toward the action: along the ground and into the depth of the field
  if (inp.on) {
    // turn to face the aim (with a little dead zone so it does not flicker)
    const mid = f.left + f.kid.x + 59;
    if (inp.x < mid - 30) f.kid.face = -1; else if (inp.x > mid + 30) f.kid.face = 1;
    const tx = Math.max(0, Math.min(f.right - f.left - 125, inp.x - f.left - 59 - 150 * f.kid.face));
    const td = Math.max(0.35, Math.min(1, (inp.y - f.farY) / (f.nearY - f.farY) + 0.45));
    const mx = Math.max(-110 * dt, Math.min(110 * dt, tx - f.kid.x)), md = Math.max(-0.7 * dt, Math.min(0.7 * dt, td - f.kid.d));
    f.kid.x += mx; f.kid.d += md;
    f.kid.walk += Math.abs(mx) + Math.abs(md) * 120;
  }

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

  bossClock -= dt;
  f.specialFx = Math.max(0, f.specialFx - dt);
  stepRival(f, dt, inp, up, rng);
  if (f.biome === "volcano" && f.script >= 2) {
    f.eruptT -= dt;
    if (f.eruptT <= 0) {
      f.eruptT = 9 + rng() * 5;
      for (const c of f.critters) if (c.state === "roam" && c.boss === 0 && c.def.behave !== "fly" && !c.hidden) { c.launch = 1.5; c.dir = rng() < 0.5 ? 1 : -1; }
      f.ev.push({ kind: "erupt" });
    }
  }
  // the giant: once the vacuum is strong enough it climbs down from the horizon and fights, three rounds
  if (f.giant?.ready && f.script >= 2 && !f.critters.some((c) => c.boss > 0)) {
    f.giantT -= dt;
    if (f.giantT <= 0) {
      const def = CRITTER_BY_ID[f.giant.id];
      const c = spawn(f, rng, { def, mut: null, x: f.right - 80, y: f.farY + (f.nearY - f.farY) * 0.5 });
      c.boss = 3; c.scale = f.giant.scale; c.resist = f.giant.resist; c.dir = -1;
      f.giantT = 8;
      f.ev.push({ kind: "surprise", s: "boss", c });
    }
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
      const c = spawn(f, rng, { def, x: f.right - 30, y: f.farY + (f.nearY - f.farY) * (0.3 + rng() * 0.5) });
      c.dir = -1;
      f.ev.push({ kind: "surprise", s: "visitor", c });
    } else if (roll < 0.75) {
      for (let i = 0; i < 3; i++) spawn(f, rng, { mut: "gold", x: f.nozzle.x + 140 + i * 60, y: f.farY + (f.nearY - f.farY) * (0.2 + i * 0.3) });
      f.ev.push({ kind: "surprise", s: "golden_rain" });
    } else {
      for (let i = 0; i < 6; i++) { const c = spawn(f, rng, { def: pool[Math.floor(rng() * 5)], mut: null, x: f.right + 20 + i * 30, y: f.farY + (f.nearY - f.farY) * rng() }); c.dir = -1; c.hopPer = 0.45; }
      f.ev.push({ kind: "surprise", s: "stampede" });
    }
  }

  const P = power(up), R = range(up), CONE = cone(up);
  const ang = Math.atan2(f.aim.y - f.nozzle.y, f.aim.x - f.nozzle.x);
  for (const c of f.critters) {
    if (c.state === "caught") continue;
    // trapped in a bubble: it sinks gently to a hovering height and stays put
    if (c.bubbled > 0) { c.bubbled -= dt; c.hidden = false; c.fleeT = 0; if (c.state === "roam") c.lift += (24 - c.lift) * Math.min(1, dt * 2); }
    if (c.frozen > 0) c.frozen -= dt;
    // the flute: everything nearby comes walking toward the music, burrowers pop up, shy ones calm down
    if (flute && c.state === "roam" && c.boss === 0 && Math.abs(c.x - f.nozzle.x) < 330) {
      c.hidden = false; c.fleeT = 0; c.herd = Math.max(c.herd, 0.2);
      if (c.def.behave === "fly") c.air = Math.max(30, c.air - 60 * dt);
    }
    // magnet perk: everything drifts slowly toward the kid
    if (f.magnet > 0 && c.state === "roam" && c.boss === 0 && Math.abs(f.nozzle.x - c.x) > 90) c.x += Math.sign(f.nozzle.x - c.x) * 14 * f.magnet * dt;
    if (c.herd > 0 && c.state === "roam") { c.herd -= dt; const s = Math.sign(f.nozzle.x - c.x); c.dir = s >= 0 ? 1 : -1; if (Math.abs(f.nozzle.x - c.x) > 70) c.x += s * 70 * dt; }
    // moonlight: shy ones stay calm, burrowers stay up
    if (f.companion === "moonfawn") { c.fleeT = 0; if (c.def.behave === "burrow") c.hidden = false; }
    // where its body is (feet minus lift), relative to the nozzle
    const bx = c.x, by = c.y - c.lift - c.def.size * c.scale * 0.4 * depthK(f, c.y);
    const dx = bx - f.nozzle.x, dy = by - f.nozzle.y, dist = Math.hypot(dx, dy);
    let da = Math.atan2(dy, dx) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
    // a critter already in a tug stays caught a little past the cone's reach: fair to a moving finger
    const reach = c.state === "tug" ? R * 1.15 : R, spread = c.state === "tug" ? CONE * 1.1 : CONE;
    const inCone = f.beam && !c.leaving && dist < reach && Math.abs(da) < spread;

    // behaviours that react to the cone before it catches them
    const nearCone = f.beam && dist < reach * 1.35 && Math.abs(da) < spread * 1.8;
    const busyFx = c.bubbled > 0 || c.frozen > 0 || flute;
    if (c.state === "roam" && !busyFx) {
      const b = c.def.behave;
      if (b === "burrow") {
        // up for a while, then down under the ground: catch it while its head is out
        c.cycleT += dt;
        const per = 4.2, ph = c.cycleT % per;
        const was = c.hidden;
        c.hidden = ph > 2.8;
        if (c.hidden && !was) f.ev.push({ kind: "hide", c });
      } else if (b === "shell") {
        // hit by the cone it tucks into its shell for a moment, then peeks out again
        if (c.hidden) { c.cycleT -= dt; if (c.cycleT <= 0) { c.hidden = false; c.cycleT = -1.4; } }
        else if (inCone && c.cycleT >= 0) { c.hidden = true; c.cycleT = 1.3; f.ev.push({ kind: "hide", c }); }
        else if (c.cycleT < 0) c.cycleT += dt; // a short window after peeking when it cannot hide again
      } else if (b === "shy" && nearCone && !inCone && c.fleeT <= 0) {
        c.fleeT = 1.1; c.dir = dx > 0 ? 1 : -1;
        f.ev.push({ kind: "flee", c });
      }
    }
    if (c.fleeT > 0) { c.fleeT -= dt; c.x += c.dir * 150 * dt; c.x = Math.max(f.left + 20, Math.min(f.right - 20, c.x)); }
    if (c.hidden) { c.lift = 0; continue; }
    if (inCone && c.def.behave === "split" && !c.split && c.state === "roam" && c.boss === 0) {
      // pop! it becomes two smaller ones, each worth catching
      c.split = true; c.scale *= 0.78;
      const twin = spawn(f, rng, { def: c.def, mut: c.mut, x: c.x + 34, y: Math.min(f.nearY, c.y + 18) });
      twin.split = true; twin.scale = c.scale; twin.dir = 1;
      f.ev.push({ kind: "split", c });
    }
    if (c.state === "roam" || c.state === "tug") {
      if (inCone) {
        if (c.resist <= 1.5 || c.bubbled > 0) c.state = "pulled";
        else {
          if (c.state !== "tug") { c.state = "tug"; f.ev.push({ kind: "tug", c }); }
          c.grip += dt * (P / 230) / c.resist * 0.95 * (c.boss > 0 ? 1.6 : 1) * (f.companion === "elderoak" ? 1.6 : 1) * (c.frozen > 0 ? 2 : 1);
          if (c.tease) {
            // too strong for you yet: it holds, then laughs and stomps off
            c.grip = Math.min(c.grip, 0.4); c.cycleT += dt;
            if (c.cycleT > 2.4) { c.state = "roam"; c.grip = 0; c.boss = 0; c.leaving = true; c.dir = 1; f.ev.push({ kind: "tease", c }); }
          }
          // it struggles: little scrambles sideways, trying to slip out of the cone
          c.x += Math.sin(f.t * 7 + c.uid) * 60 * dt;
          // (a flier keeps its height: dropping it would pull it out of the cone and it would flicker in and out)
          c.lift = c.def.behave === "fly" && c.boss === 0 ? c.lift + (c.air - c.lift) * Math.min(1, dt * 0.5) + Math.sin(f.t * 11 + c.uid) * 0.4 : Math.max(0, Math.sin(f.t * 11 + c.uid) * 6);
          if (c.grip >= 1) {
            if (c.boss > 1) {
              // the boss breaks free and leaps away: two more rounds
              c.boss--; c.grip = 0; c.state = "roam"; c.x = f.left + 60 + rng() * (f.right - f.left - 100); c.lift = 60;
              f.ev.push({ kind: "bossPhase", c });
              for (let i = 0; i < 2; i++) spawn(f, rng, { def: pool[Math.floor(rng() * 4)], mut: null, x: c.x + (i ? 40 : -40), y: c.y });
            } else c.state = "pulled";
          }
        }
      } else if (c.state === "tug") {
        c.grip -= dt * 0.3;
        if (c.grip <= 0) { c.grip = 0; c.state = "roam"; f.ev.push({ kind: "escape", c }); c.dir = dx > 0 ? 1 : -1; }
      }
    }
    if (c.leaving) {
      // the teasing giant stomps away over the hill
      c.hopT += dt * 2.2; c.lift = Math.abs(Math.sin(c.hopT * Math.PI)) * 30; c.x += 160 * dt;
      if (c.x > f.right + 160) c.state = "caught";
    } else if (c.launch && c.launch > 0 && c.state === "roam") {
      // thrown up by the volcano: a high arc, worth double if caught in the air
      c.launch -= dt;
      const k = 1 - Math.max(0, c.launch) / 1.5;
      c.lift = Math.sin(k * Math.PI) * 170 * depthK(f, c.y);
      c.x += c.dir * 40 * dt;
      c.x = Math.max(f.left + 20, Math.min(f.right - 20, c.x));
    } else if (c.state === "roam" && (c.bubbled > 0 || c.frozen > 0)) {
      // held still: no hopping, no flying off
    } else if (c.state === "roam" && c.def.behave === "fly" && c.boss === 0) {
      // fliers cruise high above the meadow on a lazy wave: aim up
      c.hopT += dt;
      c.lift = c.air + Math.sin(c.hopT * 1.6 + c.uid) * 26;
      c.x += c.dir * 46 * dt;
      if (c.x < f.left + 24) c.dir = 1;
      if (c.x > f.right - 24) c.dir = -1;
    } else if (c.state === "roam") {
      // hop about, turning at the edges
      // the moon: low gravity, slow high floaty hops · the ice: they slide on and on
      const moon = f.biome === "moon", ice = f.biome === "frost";
      c.hopT += dt / (c.hopPer * (moon ? 1.8 : 1));
      const ph = c.hopT % 1, air = moon ? 0.75 : 0.45;
      c.lift = ph < air ? Math.sin((ph / air) * Math.PI) * c.def.hop * depthK(f, c.y) * (c.boss ? 2 : 1) * (moon && !c.boss ? 3.2 : 1) : 0;
      if (ph < air) c.x += c.dir * (ice ? 62 : 34) * dt;
      else if (ice) c.x += c.dir * 30 * dt;
      if (c.x < f.left + 24) c.dir = 1;
      if (c.x > f.right - 24) c.dir = -1;
      c.pullT = Math.max(0, c.pullT - dt);
    } else if (c.state === "pulled") {
      // flies into the nozzle, faster as it gets close
      c.pullT += dt;
      const sp = (P / Math.max(1, c.resist * 0.6)) * (0.6 + 0.8 * Math.min(1, c.pullT));
      const k = Math.min(1, (sp * dt) / Math.max(1, dist));
      c.x -= dx * k;
      const nby = by - dy * k;
      c.lift = c.y - nby - c.def.size * c.scale * 0.4 * depthK(f, c.y);
      if (dist < 16) { c.state = "caught"; f.jar++; f.ev.push({ kind: "caught", c }); }
      if (!f.beam && c.resist > 1.5) { c.state = "tug"; }
    }
  }
  f.critters = f.critters.filter((c) => c.state !== "caught");
}

/** the rival: walks in from the right edge toward a critter, sucks it into his own vacuum and walks off smirking.
 *  If your wind hits him on the way, he is blown off his feet and leaves empty-handed. */
function stepRival(f: Field, dt: number, inp: FieldInput, up: Upgrades, rng: Rng) {
  if (!f.rivalOn || f.script < 2 || f.critters.some((c) => c.boss > 0 && c.state !== "caught")) { if (!f.rival) return; }
  if (!f.rival) {
    f.rivalT -= dt;
    if (f.rivalT > 0 || !f.rivalOn) return;
    // he goes for one in the middle of the field, where you can see him and blow him away
    const mid = (f.left + f.right) / 2 + 40;
    const prey = f.critters.filter((c) => c.state === "roam" && c.boss === 0 && !c.hidden && c.def.behave !== "fly" && c.x < f.right - 110).sort((a, b) => Math.abs(a.x - mid) - Math.abs(b.x - mid))[0];
    f.rivalT = (f.rivalFast ? 5 + rng() * 4 : 35 + rng() * 25) * f.rivalSlow;
    if (!prey) return;
    f.rival = { x: f.right + 60, y: Math.min(f.nearY, prey.y + 6), phase: "in", t: 0, target: prey.uid, got: false };
    f.ev.push({ kind: "rivalIn" });
    return;
  }
  const r = f.rival, prey = f.critters.find((c) => c.uid === r.target);
  r.t += dt;
  // your wind can blow him away (unless he is already leaving)
  if (f.beam && (r.phase === "in" || r.phase === "grab")) {
    const ang = Math.atan2(f.aim.y - f.nozzle.y, f.aim.x - f.nozzle.x), ry = r.y - 40;
    const dx = r.x - f.nozzle.x, dy = ry - f.nozzle.y;
    let da = Math.atan2(dy, dx) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.hypot(dx, dy) < range(up) * 1.1 && Math.abs(da) < cone(up) * 1.2) { r.phase = "blown"; r.t = 0; f.ev.push({ kind: "rivalBlown" }); }
  }
  if (r.phase === "in") {
    if (!prey || prey.state !== "roam") { r.phase = "out"; r.t = 0; f.ev.push({ kind: "rivalMiss" }); return; }
    const tx = prey.x + 70;
    r.x += Math.sign(tx - r.x) * Math.min(Math.abs(tx - r.x), 150 * dt);
    r.y += (Math.min(f.nearY, prey.y + 6) - r.y) * Math.min(1, dt * 3);
    if (Math.abs(tx - r.x) < 4) { r.phase = "grab"; r.t = 0; }
  } else if (r.phase === "grab") {
    if (!prey || prey.state !== "roam") { r.phase = "out"; r.t = 0; f.ev.push({ kind: "rivalMiss" }); return; }
    prey.x += (r.x - 30 - prey.x) * Math.min(1, dt * 4);
    prey.lift += 30 * dt;
    if (r.t > 0.9) { prey.state = "caught"; r.got = true; r.phase = "out"; r.t = 0; f.ev.push({ kind: "stolen", c: prey }); }
  } else if (r.phase === "out") {
    r.x += 170 * dt;
    if (r.x > f.right + 80) f.rival = null;
  } else {
    r.x += 380 * dt;
    if (r.x > f.right + 120) f.rival = null;
  }
}

/** the special move, stronger with every evolution of the vacuum:
 *  tier 1 a tornado around the nozzle, tier 2 a bigger one that also freezes the rest, tier 3 a black hole that takes the whole field.
 *  A giant in the way gets a big tug. */
export function fireSpecial(f: Field, tier: number) {
  if (tier < 1 || f.special < 1) return false;
  f.special = 0; f.specialFx = 1.2;
  const R = tier >= 3 ? 9999 : tier === 2 ? 330 : 230;
  for (const c of f.critters) {
    if (c.state === "caught" || c.leaving) continue;
    const by = c.y - c.lift - c.def.size * c.scale * 0.4 * depthK(f, c.y);
    const near = Math.hypot(c.x - f.nozzle.x, by - f.nozzle.y) < R;
    if (c.boss > 0) { if (near || tier >= 3) { c.grip = Math.min(0.98, c.grip + (tier >= 3 ? 0.6 : 0.35)); c.state = "tug"; } continue; }
    if (near) { c.hidden = false; c.state = "pulled"; c.bubbled = 0; }
    else if (tier >= 2) c.frozen = 3;
  }
  if (f.rival && (f.rival.phase === "in" || f.rival.phase === "grab")) { f.rival.phase = "blown"; f.rival.t = 0; f.ev.push({ kind: "rivalBlown" }); }
  return true;
}
