import { FISH } from "../data/fish.ts";
import { FIGHT, MUTATIONS, RARITY_WEIGHT, ZONES } from "../data/world.ts";
import { ascendSpeed, capacity, descendSpeed, luckMult, maxDepth } from "./economy.ts";
import type { SurpriseKind } from "./director.ts";
import type { ActiveEvent } from "./events.ts";
import type { WeatherDef } from "./weather.ts";
import type { BaitDef } from "../data/gear.ts";
import { pickWeighted, type Rng } from "./rng.ts";
import type { Catch, FishDef, MutationId, UpgradeLevels, ZoneId } from "./types.ts";

// One dive, as pure state + a step function. The renderer draws it, the simulator plays it.

/** the play column is this wide in world units; the view scales to fit */
export const COLUMN = 360;
const HOOK_R = 9;
const HOOK_SPEED = 520;

export interface LiveFish {
  uid: number;
  def: FishDef;
  mut: MutationId | null;
  x: number;
  y: number;
  dir: 1 | -1;
  speed: number;
  /** body length after size roll and the giant mutation */
  size: number;
  /** individual size roll (0.8-1.25): bigger = heavier and worth a bit more */
  scale: number;
  bob: number;
  hooked: boolean;
}

/** three ways to land a big fish, so every fight is not the same */
export type FightKind = "hold" | "timing" | "follow";
/** seconds of "get ready" before a fight starts to cost line */
export const FIGHT_GRACE = 2.6;

export interface Fight {
  kind: FightKind;
  /** timing: hits landed / needed; ring phase 0..1 (1 = big, 0 = closed) */
  hits: number;
  need: number;
  ring: number;
  /** follow: where the fish is on the bar (0..1) */
  fishPos: number;
  /** last result flash for the renderer: +1 hit, -1 miss */
  flash: number;
  fish: LiveFish;
  /** 0..1, where the green zone is centred */
  zone: number;
  zoneHalf: number;
  /** how fast the fish drags the zone */
  speed: number;
  marker: number;
  vel: number;
  progress: number;
  t: number;
  seed: number;
  /** one ad retry per fish: after that the only choice is to let it go */
  retried: boolean;
}

export interface Slab { x: number; y: number; w: number; h: number }
export interface Current { y: number; h: number; v: number }
/** a hot vent: a geyser column at x from y to y+h that glows, then erupts every `period` seconds */
export interface Vent { x: number; y: number; h: number; period: number; phase: number }
/** 0..1 through the vent's cycle; warns from WARN, erupts from ERUPT */
export const VENT_WARN = 0.45, VENT_ERUPT = 0.66;
export const ventCycle = (v: Vent, t: number) => (((t + v.phase) % v.period) + v.period) % v.period / v.period;
export const ICE_HOLE: [number, number] = [COLUMN / 2 - 62, COLUMN / 2 + 62];

/** an unexpected event inside a dive (picked by the director, played out by these rules) */
export interface Surprise {
  kind: SurpriseKind;
  x: number;
  y: number;
  dir: 1 | -1;
  /** waiting -> active -> done */
  state: "waiting" | "active" | "done";
  t: number;
  /** shark: how far below the hook it is */
  gap: number;
}

export type DivePhase = "descend" | "fight" | "snapped" | "ascend" | "done";

export interface Dive {
  zone: ZoneId;
  phase: DivePhase;
  /** phase to return to after a fight */
  resume: "descend" | "ascend";
  hookX: number;
  hookY: number;
  bottom: number;
  capacity: number;
  fish: LiveFish[];
  hooked: LiveFish[];
  fight: Fight | null;
  t: number;
  /** a fish escaped: the renderer shows a splash */
  escaped: LiveFish | null;
  /** events the renderer turns into sound and particles; cleared by the caller */
  fx: DiveFx[];
  surprise: Surprise | null;
  /** ice zone: slabs that block the hook (x = centre) */
  slabs: Slab[];
  /** ice zone: the only way back up through the surface */
  hole: [number, number] | null;
  /** a treasure-map dive: the chest is guaranteed and huge */
  treasure: boolean;
  /** reef zone: horizontal water currents (y = top, h = height, v = push speed) */
  currents: Current[];
  /** volcano zone: hot vents */
  vents: Vent[];
  /** seconds before a vent can hit again */
  ventCool: number;
  /** coins found during the dive (chests) and map pieces (bottles) */
  bonusCoins: number;
  mapPieces: number;
}

export type DiveFx = { kind: "hook"; fish: LiveFish } | { kind: "turn" } | { kind: "fightWon"; fish: LiveFish } | { kind: "snap"; fish: LiveFish } | { kind: "surface" }
  | { kind: "surprise"; surprise: SurpriseKind } | { kind: "stolen"; fish: LiveFish } | { kind: "sharkGone" }
  | { kind: "bottle" } | { kind: "chest"; coins: number } | { kind: "whirlpool"; extra: number } | { kind: "bonk" } | { kind: "vent"; fish: LiveFish | null; x: number; y: number };

export interface DiveInput {
  /** absolute target x for pointer control (world units), or null */
  targetX: number | null;
  /** -1..1 from keys */
  axis: number;
  /** pointer down / space held: reels during a fight */
  hold: boolean;
  /** pressed this frame (tap / space down): timing fights */
  tap?: boolean;
}

export interface DiveContext {
  upgrades: UpgradeLevels;
  event: ActiveEvent | null;
  night: boolean;
  rng: Rng;
  weather?: WeatherDef | null;
  bait?: BaitDef | null;
}

let uidCounter = 1;

function rollMutation(ctx: DiveContext): MutationId | null {
  for (const m of MUTATIONS) {
    const byWeather = ctx.weather?.mutation?.[m.id];
    const byBait = ctx.bait?.mutation?.[m.id];
    const allowed = byWeather || byBait;
    if (m.event && ctx.event?.def.id !== m.event && !allowed) continue;
    if (m.night && !ctx.night && !allowed) continue;
    const boost = (ctx.event?.def.mutation?.[m.id] ?? 1) * (byWeather ?? 1) * (byBait ?? 1);
    if (ctx.rng() < m.chance * boost) return m.id;
  }
  return null;
}

export function spawnFish(zone: ZoneId, y: number, ctx: DiveContext): LiveFish | null {
  const luck = luckMult(ctx.upgrades);
  const pool = FISH.filter((f) => f.zone === zone && y >= f.depth[0] && y <= f.depth[1] && (!f.event || f.event === ctx.event?.def.id || ctx.bait?.unlocksSecret));
  const def = pickWeighted(pool, (f) => {
    const base = RARITY_WEIGHT[f.rarity];
    const ev = (ctx.event?.def.rarity?.[f.rarity] ?? 1) * (ctx.weather?.rarity?.[f.rarity] ?? 1) * (ctx.bait?.rarity?.[f.rarity] ?? 1)
      * (ctx.bait?.attracts?.includes(f.id) ? 4 : 1);
    // junk is a joke, not a nuisance: it shows up, but rarely
    return base * (f.rarity === "common" ? 1 : luck) * ev * (f.junk ? 0.3 : 1);
  }, ctx.rng);
  if (!def) return null;
  const mut = def.junk ? null : rollMutation(ctx);
  const scale = 0.8 + ctx.rng() * 0.45;
  const dir: 1 | -1 = ctx.rng() < 0.5 ? 1 : -1;
  return {
    uid: uidCounter++, def, mut, y, dir,
    x: ctx.rng() * COLUMN,
    speed: def.speed * (0.8 + ctx.rng() * 0.4),
    scale,
    size: def.size * scale * (mut === "giant" ? 1.7 : 1),
    bob: ctx.rng() * Math.PI * 2,
    hooked: false,
  };
}

function fillFish(zone: ZoneId, from: number, to: number, ctx: DiveContext, into: LiveFish[]) {
  for (let y = from; y < to; y += 34 + ctx.rng() * 30) {
    const f = spawnFish(zone, y, ctx);
    if (f) into.push(f);
  }
}

export function startDive(zone: ZoneId, ctx: DiveContext, surprise: SurpriseKind | null = null, treasure = false, guaranteeRare = false): Dive {
  const z = ZONES[zone];
  const bottom = Math.min(maxDepth(ctx.upgrades), z.floor);
  const fish: LiveFish[] = [];
  // fish all the way down, a little past the hook's reach so the deep end never looks empty
  fillFish(zone, 110, bottom + 160, ctx, fish);
  const d: Dive = {
    zone, phase: "descend", resume: "descend", hookX: COLUMN / 2, hookY: 0, bottom,
    capacity: capacity(ctx.upgrades), fish, hooked: [], fight: null, t: 0, escaped: null, fx: [],
    surprise: null, bonusCoins: 0, mapPieces: 0, slabs: [], hole: null, treasure: false, currents: [], vents: [], ventCool: 0,
  };
  if (z.currents) {
    for (let y = 220; y < bottom - 40; y += 230 + ctx.rng() * 160) {
      d.currents.push({ y, h: 70 + ctx.rng() * 50, v: (ctx.rng() < 0.5 ? -1 : 1) * (120 + ctx.rng() * 70) });
    }
    // fish caught in a current ride it
    for (const f of d.fish) {
      const c = d.currents.find((q) => f.y >= q.y && f.y <= q.y + q.h);
      if (c) { f.dir = c.v > 0 ? 1 : -1; f.speed = Math.abs(c.v) * 0.9 + f.speed * 0.3; }
    }
  }
  if (z.vents) {
    // a vent every 200-330 units, never two in a row on the same side, each with its own rhythm
    let side = ctx.rng() < 0.5 ? 0 : 1;
    for (let y = 200; y < bottom - 60; y += 200 + ctx.rng() * 130) {
      side = 1 - side;
      d.vents.push({ x: COLUMN * (side ? 0.58 + ctx.rng() * 0.3 : 0.12 + ctx.rng() * 0.3), y, h: 130 + ctx.rng() * 70, period: 2.4 + ctx.rng() * 1.4, phase: ctx.rng() * 4 });
    }
  }
  if (z.ice) {
    d.hole = ICE_HOLE;
    for (let y = 170; y < bottom - 60; y += 150 + ctx.rng() * 90) {
      const w = 90 + ctx.rng() * 80;
      d.slabs.push({ x: w / 2 + ctx.rng() * (COLUMN - w), y, w, h: 18 });
    }
  }
  if (guaranteeRare) {
    // early game: one rare swims right across the hook's path, deep enough to need a dodge on the way down
    const y = Math.max(140, bottom * 0.75);
    const pool = FISH.filter((f) => f.zone === zone && f.rarity === "rare" && !f.junk && y >= f.depth[0] - 250 && y <= f.depth[1]);
    const def = pool[Math.floor(ctx.rng() * pool.length)];
    if (def) {
      d.fish = d.fish.filter((f) => Math.abs(f.y - y) > 40);
      d.fish.push({ uid: uidCounter++, def, mut: null, x: COLUMN * (0.25 + ctx.rng() * 0.5), y, dir: ctx.rng() < 0.5 ? 1 : -1, speed: def.speed * 0.5, size: def.size * 1.1, scale: 1.1, bob: 0, hooked: false });
    }
  }
  d.treasure = treasure;
  if (treasure) surprise = "chest";
  if (surprise) setupSurprise(d, surprise, ctx);
  return d;
}

/** typical coin value of a fish at this depth: chests scale with how deep you are */
function depthValue(zone: ZoneId, y: number) {
  const near = FISH.filter((f) => f.zone === zone && !f.junk && f.rarity === "rare" && y >= f.depth[0] - 200 && y <= f.depth[1]);
  return near.length ? near.reduce((a, f) => a + f.value, 0) / near.length : 30;
}

function setupSurprise(d: Dive, kind: SurpriseKind, ctx: DiveContext) {
  const r = ctx.rng;
  const s: Surprise = { kind, x: COLUMN / 2, y: 0, dir: r() < 0.5 ? 1 : -1, state: "waiting", t: 0, gap: 0 };
  d.surprise = s;
  if (kind === "golden_school") {
    // a line of golden fish crossing the hook's path somewhere in the middle of the dive
    s.y = d.bottom * (0.35 + r() * 0.35);
    const pool = FISH.filter((f) => f.zone === d.zone && f.rarity === "common" && !f.junk && s.y >= f.depth[0] - 100 && s.y <= f.depth[1] + 100);
    const def = pool[Math.floor(r() * pool.length)] ?? FISH.find((f) => f.zone === d.zone && !f.junk)!;
    for (let i = 0; i < 7; i++) {
      d.fish.push({ uid: uidCounter++, def, mut: "gold", x: (s.dir > 0 ? -60 : COLUMN + 60) - s.dir * i * 50, y: s.y + Math.sin(i * 1.7) * 26,
        dir: s.dir, speed: 70, size: def.size, scale: 1, bob: i, hooked: false });
    }
  } else if (kind === "bottle" || kind === "chest") {
    s.y = kind === "chest" ? d.bottom - 25 : d.bottom * (0.3 + r() * 0.5);
    s.x = 50 + r() * (COLUMN - 100);
  } else if (kind === "whirlpool") {
    s.y = d.bottom * (0.4 + r() * 0.3);
  } else if (kind === "glimpse") {
    // a legendary drifts past just below the hook's reach: "one day that will be mine"
    s.y = d.bottom + 70;
    s.x = s.dir > 0 ? -160 : COLUMN + 160;
  } else if (kind === "shadow") {
    // a huge shape drifts past far behind; this dive the zone's secret creature is in the water
    s.y = d.bottom * (0.5 + r() * 0.3);
    s.x = s.dir > 0 ? -200 : COLUMN + 200;
    const secret = FISH.find((f) => f.zone === d.zone && f.rarity === "secret");
    if (secret) {
      const y = Math.min(d.bottom - 20, Math.max(secret.depth[0], d.bottom * 0.7));
      d.fish.push({ uid: uidCounter++, def: secret, mut: null, x: r() * COLUMN, y, dir: s.dir, speed: secret.speed * 0.8, size: secret.size, scale: 1, bob: 0, hooked: false });
    }
  }
}

function stepSurprise(d: Dive, dt: number) {
  const s = d.surprise;
  if (!s || s.state === "done") return;
  s.t += dt;
  const touch = (r: number) => Math.hypot(s.x - d.hookX, s.y - d.hookY) < r;
  switch (s.kind) {
    case "golden_school":
    case "shadow":
    case "glimpse":
      if (s.state === "waiting" && Math.abs(d.hookY - s.y) < 260) { s.state = "active"; d.fx.push({ kind: "surprise", surprise: s.kind }); }
      if (s.kind === "shadow") s.x += s.dir * 60 * dt;
      if (s.kind === "glimpse" && s.state === "active") s.x += s.dir * 75 * dt;
      break;
    case "bottle":
    case "chest":
      if (s.state === "waiting" && Math.abs(d.hookY - s.y) < 220) { s.state = "active"; d.fx.push({ kind: "surprise", surprise: s.kind }); }
      if (s.state === "active" && touch(30)) {
        s.state = "done";
        if (s.kind === "bottle") { d.mapPieces++; d.bonusCoins += Math.round(depthValue(d.zone, s.y) * 1.5); d.fx.push({ kind: "bottle" }); }
        else { const coins = Math.round(depthValue(d.zone, s.y) * (d.treasure ? 25 : 6)); d.bonusCoins += coins; d.fx.push({ kind: "chest", coins }); }
      }
      break;
    case "whirlpool":
      if (s.state === "waiting" && d.phase === "descend" && d.hookY >= s.y - 20) {
        s.state = "done";
        // the current drags the hook deeper than the line can go: a peek at what lies below
        const floor = ZONES[d.zone].floor;
        const extra = Math.min(floor - d.bottom, Math.round(d.bottom * 0.35 + 120));
        if (extra > 40) { fillFishBelow(d, d.bottom + 160, d.bottom + extra + 160); d.bottom += extra; }
        d.fx.push({ kind: "whirlpool", extra });
      }
      break;
    case "shark":
      // appears below the hook on the way up, closes in, steals the last fish unless you dodge
      if (s.state === "waiting" && d.phase === "ascend" && d.hookY > 90) {
        s.state = "active"; s.gap = 170; s.x = d.hookX + s.dir * 120; s.t = 0;
        d.fx.push({ kind: "surprise", surprise: "shark" });
      }
      if (s.state === "active") {
        s.gap = Math.max(0, s.gap - 55 * dt);
        s.y = d.hookY + 14 + s.gap;
        const dx = d.hookX - s.x;
        s.x += Math.sign(dx) * Math.min(Math.abs(dx), 150 * dt);
        s.dir = dx >= 0 ? 1 : -1;
        if (s.gap < 30 && Math.abs(dx) < 34 && d.hooked.length > 0) {
          const f = d.hooked.pop()!;
          s.state = "done";
          d.fx.push({ kind: "stolen", fish: f });
        } else if (s.t > 7 || d.phase !== "ascend" || d.hookY < 60) {
          s.state = "done";
          d.fx.push({ kind: "sharkGone" });
        }
      }
      break;
  }
}

let pendingFillCtx: DiveContext | null = null;
function fillFishBelow(d: Dive, from: number, to: number) {
  if (pendingFillCtx) fillFish(d.zone, from, to, pendingFillCtx, d.fish);
}

export function catchValue(f: LiveFish): number {
  const m = MUTATIONS.find((x) => x.id === f.mut);
  return Math.round(f.def.value * (m ? m.mult : 1) * (f.scale ?? 1));
}

/** weight in kg: volume grows with the cube of length */
export function catchKg(f: LiveFish): number {
  const kg = 0.00003 * Math.pow(f.def.size, 3) * Math.pow(f.scale ?? 1, 3) * (f.mut === "giant" ? 4.9 : 1);
  return Math.round(kg * 100) / 100;
}

export const diveCatches = (d: Dive): Catch[] => d.hooked.map((f) => ({ fish: f.def.id, mut: f.mut, value: catchValue(f), kg: catchKg(f) }));

function startFight(d: Dive, f: LiveFish, ctx: DiveContext) {
  d.resume = d.phase === "ascend" ? "ascend" : "descend";
  d.phase = "fight";
  const cfg = FIGHT[f.def.rarity]!;
  // the fish's body decides how it fights: slippery eels and fast swimmers run, round ones snap
  const shape = f.def.look.shape;
  const kind: FightKind = shape === "eel" || f.def.speed >= 95 ? "follow" : shape === "puffer" || shape === "jelly" || shape === "crab" ? "timing" : "hold";
  const need = f.def.rarity === "epic" ? 3 : f.def.rarity === "legendary" ? 4 : 5;
  d.fight = { kind, hits: 0, need, ring: 1, fishPos: 0.5, flash: 0, fish: f, zone: 0.5, zoneHalf: cfg.half, speed: cfg.speed * (ctx.weather?.fight ?? 1),
    marker: 0.5, vel: 0, progress: kind === "timing" ? 1 : 0.3, t: 0, seed: ctx.rng() * 100, retried: false };
}

function stepFight(d: Dive, dt: number, input: DiveInput) {
  const fg = d.fight!;
  fg.t += dt;
  fg.flash = Math.max(0, Math.abs(fg.flash) - dt * 3) * Math.sign(fg.flash);
  const speed = fg.speed;
  // a few seconds to get ready: everything moves gently and nothing is lost yet
  const ready = fg.t >= FIGHT_GRACE;
  const pace = ready ? 1 : 0.35;
  const tt = ready ? fg.t - FIGHT_GRACE * 0.65 : fg.t * pace;
  if (fg.kind === "hold") {
    // the fish pulls the green zone around: two sines make it feel alive but readable
    fg.zone = 0.5 + 0.3 * Math.sin(tt * 1.35 * speed + fg.seed) + 0.12 * Math.sin(tt * 3.3 * speed + fg.seed * 2);
    fg.vel += (input.hold ? 2.9 : -2.5) * dt;
    fg.vel *= Math.pow(0.12, dt);
    fg.marker = Math.max(0, Math.min(1, fg.marker + fg.vel * dt));
    if (fg.marker === 0 || fg.marker === 1) fg.vel = 0;
    const inZone = Math.abs(fg.marker - fg.zone) <= fg.zoneHalf;
    if (ready) fg.progress += (inZone ? 0.3 : -0.25) * dt;
  } else if (fg.kind === "follow") {
    // the fish darts left and right; keep your marker (steer like the hook) under it
    fg.fishPos = 0.5 + 0.3 * Math.sin(tt * 1.5 * speed + fg.seed) + 0.12 * Math.sin(tt * 3.7 * speed + fg.seed * 3) + 0.06 * Math.sin(tt * 7.3 * speed + fg.seed);
    let target = fg.marker;
    if (input.targetX !== null) target = Math.max(0, Math.min(1, input.targetX / COLUMN));
    if (input.axis) target = fg.marker + input.axis * 1.4 * dt;
    fg.marker += Math.max(-1.25 * dt, Math.min(1.25 * dt, target - fg.marker));
    fg.marker = Math.max(0, Math.min(1, fg.marker));
    const on = Math.abs(fg.marker - fg.fishPos) <= fg.zoneHalf * 0.65;
    if (ready) fg.progress += (on ? 0.26 : -0.3) * dt;
  } else {
    // timing: a ring closes on the fish; tap when it meets the gold circle
    const period = 1.0 / speed;
    fg.ring -= dt / period;
    if (fg.ring < -0.25) fg.ring = 1; // missed the window entirely: it just comes round again
    if (input.tap && ready) {
      const good = Math.abs(fg.ring - 0.3) <= 0.06 + fg.zoneHalf * 0.12;
      if (good) { fg.hits++; fg.flash = 1; fg.ring = 1; }
      else { fg.progress -= 0.34; fg.flash = -1; }
    }
  }
  // timing fights are won by hits (progress is the line's health there); the others by the bar
  const won = fg.kind === "timing" ? fg.hits >= fg.need : fg.progress >= 1;
  if (won) {
    fg.fish.hooked = true;
    d.hooked.push(fg.fish);
    d.fx.push({ kind: "fightWon", fish: fg.fish });
    d.fight = null;
    d.phase = d.hooked.length >= d.capacity ? "ascend" : d.resume;
  } else if (fg.progress <= 0) {
    d.phase = "snapped";
    d.fx.push({ kind: "snap", fish: fg.fish });
  }
}

/** after "snapped": retry (from a rewarded ad) or let it go */
export function resolveSnap(d: Dive, retry: boolean) {
  if (d.phase !== "snapped" || !d.fight) return;
  if (retry && !d.fight.retried) {
    d.fight.retried = true;
    d.fight.progress = d.fight.kind === "timing" ? 0.67 : 0.55;
    d.fight.marker = d.fight.kind === "follow" ? d.fight.fishPos : d.fight.zone;
    d.fight.t = FIGHT_GRACE * 0.5; // a short new countdown
    d.fight.vel = 0;
    d.phase = "fight";
    return;
  }
  const f = d.fight.fish;
  d.fish = d.fish.filter((x) => x !== f);
  d.escaped = f;
  d.fight = null;
  d.phase = d.resume;
}

export function stepDive(d: Dive, dt: number, input: DiveInput, ctx: DiveContext) {
  if (d.phase === "done" || d.phase === "snapped") return;
  d.t += dt;
  pendingFillCtx = ctx;
  if (d.phase !== "fight") stepSurprise(d, dt);
  // fish keep swimming during a fight, it looks dead otherwise
  for (const f of d.fish) {
    if (f.hooked || f === d.fight?.fish) continue;
    f.x += f.dir * f.speed * dt;
    f.bob += dt * 2;
    const inCur = d.currents.length > 0 && d.currents.some((q) => f.y >= q.y && f.y <= q.y + q.h);
    if (inCur) { if (f.x < -60) f.x = COLUMN + 60; else if (f.x > COLUMN + 60) f.x = -60; }
    else {
      if (f.x < -40) { f.x = -40; f.dir = 1; }
      if (f.x > COLUMN + 40) { f.x = COLUMN + 40; f.dir = -1; }
    }
  }
  if (d.phase === "fight") { stepFight(d, dt, input); return; }

  // steer
  let vx = 0;
  if (input.targetX !== null) {
    const dx = input.targetX - d.hookX;
    vx = Math.sign(dx) * Math.min(Math.abs(dx) * 9, HOOK_SPEED);
  }
  if (input.axis) vx = input.axis * HOOK_SPEED * 0.75;
  // inside a current the hook is heavy to steer and gets carried along
  const cur = d.currents.find((q) => d.hookY >= q.y && d.hookY <= q.y + q.h);
  if (cur) vx = Math.max(-260, Math.min(260, vx)) * 0.55 + cur.v;
  d.hookX = Math.max(12, Math.min(COLUMN - 12, d.hookX + vx * dt));

  const prevY = d.hookY;
  if (d.phase === "descend") {
    d.hookY += descendSpeed(d.bottom) * dt;
    if (d.hookY >= d.bottom) { d.hookY = d.bottom; d.phase = "ascend"; d.fx.push({ kind: "turn" }); }
  } else if (d.phase === "ascend") {
    d.hookY -= ascendSpeed(d.bottom) * dt;
  }
  // ice slabs: the hook rests on (or under) a slab until it is steered around it
  for (const sl of d.slabs) {
    if (Math.abs(d.hookX - sl.x) > sl.w / 2 + 6) continue;
    const topY = sl.y - 9, botY = sl.y + sl.h + 9;
    if (d.phase === "descend" && prevY <= topY && d.hookY > topY) { if (prevY < topY - 0.5) d.fx.push({ kind: "bonk" }); d.hookY = topY; }
    if (d.phase === "ascend" && prevY >= botY && d.hookY < botY) { if (prevY > botY + 0.5) d.fx.push({ kind: "bonk" }); d.hookY = botY; }
  }
  // hot vents: an eruption blasts the hook up and knocks the last fish off the line
  if (d.ventCool > 0) d.ventCool -= dt;
  else for (const v of d.vents) {
    if (Math.abs(d.hookX - v.x) > 26 || d.hookY < v.y || d.hookY > v.y + v.h) continue;
    if (ventCycle(v, d.t) < VENT_ERUPT) continue;
    const lost = d.hooked.pop() ?? null;
    if (lost) { d.fish = d.fish.filter((x) => x !== lost); d.escaped = lost; }
    d.fx.push({ kind: "vent", fish: lost, x: d.hookX, y: d.hookY });
    d.hookY = Math.max(16, v.y - 30);
    d.ventCool = 0.9;
    break;
  }
  if (d.phase === "ascend") {
    // under the ice sheet you can only surface through the hole
    if (d.hole && d.hookY < 14 && (d.hookX < d.hole[0] + 8 || d.hookX > d.hole[1] - 8)) {
      if (prevY >= 14) d.fx.push({ kind: "bonk" });
      d.hookY = 14;
    } else if (d.hookY <= 0) { d.hookY = 0; d.phase = "done"; d.fx.push({ kind: "surface" }); return; }
  }

  if (d.hooked.length >= d.capacity) return;
  for (const f of d.fish) {
    if (f.hooked) continue;
    const r = f.size * (f.def.look.shape === "eel" ? 0.3 : 0.42) + HOOK_R;
    const dx = f.x - d.hookX, dy = (f.y + Math.sin(f.bob) * 4) - d.hookY;
    if (dx * dx + dy * dy > r * r) continue;
    if (FIGHT[f.def.rarity]) { startFight(d, f, ctx); return; }
    f.hooked = true;
    d.hooked.push(f);
    d.fx.push({ kind: "hook", fish: f });
    if (d.hooked.length >= d.capacity) {
      if (d.phase === "descend") d.fx.push({ kind: "turn" });
      d.phase = "ascend";
      return;
    }
  }
}
