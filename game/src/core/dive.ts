import { FISH } from "../data/fish.ts";
import { FIGHT, MUTATIONS, RARITY_WEIGHT, ZONES } from "../data/world.ts";
import { ascendSpeed, capacity, descendSpeed, luckMult, maxDepth } from "./economy.ts";
import type { ActiveEvent } from "./events.ts";
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
  /** body length after the giant mutation */
  size: number;
  bob: number;
  hooked: boolean;
}

export interface Fight {
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
}

export type DiveFx = { kind: "hook"; fish: LiveFish } | { kind: "turn" } | { kind: "fightWon"; fish: LiveFish } | { kind: "snap"; fish: LiveFish } | { kind: "surface" };

export interface DiveInput {
  /** absolute target x for pointer control (world units), or null */
  targetX: number | null;
  /** -1..1 from keys */
  axis: number;
  /** pointer down / space held: reels during a fight */
  hold: boolean;
}

export interface DiveContext {
  upgrades: UpgradeLevels;
  event: ActiveEvent | null;
  night: boolean;
  rng: Rng;
}

let uidCounter = 1;

function rollMutation(ctx: DiveContext): MutationId | null {
  for (const m of MUTATIONS) {
    if (m.event && ctx.event?.def.id !== m.event) continue;
    if (m.night && !ctx.night) continue;
    const boost = ctx.event?.def.mutation?.[m.id] ?? 1;
    if (ctx.rng() < m.chance * boost) return m.id;
  }
  return null;
}

export function spawnFish(zone: ZoneId, y: number, ctx: DiveContext): LiveFish | null {
  const luck = luckMult(ctx.upgrades);
  const pool = FISH.filter((f) => f.zone === zone && y >= f.depth[0] && y <= f.depth[1] && (!f.event || f.event === ctx.event?.def.id));
  const def = pickWeighted(pool, (f) => {
    const base = RARITY_WEIGHT[f.rarity];
    const ev = ctx.event?.def.rarity?.[f.rarity] ?? 1;
    // junk is a joke, not a nuisance: it shows up, but rarely
    return base * (f.rarity === "common" ? 1 : luck) * ev * (f.junk ? 0.3 : 1);
  }, ctx.rng);
  if (!def) return null;
  const mut = def.junk ? null : rollMutation(ctx);
  const dir: 1 | -1 = ctx.rng() < 0.5 ? 1 : -1;
  return {
    uid: uidCounter++, def, mut, y, dir,
    x: ctx.rng() * COLUMN,
    speed: def.speed * (0.8 + ctx.rng() * 0.4),
    size: def.size * (mut === "giant" ? 1.7 : 1),
    bob: ctx.rng() * Math.PI * 2,
    hooked: false,
  };
}

export function startDive(zone: ZoneId, ctx: DiveContext): Dive {
  const z = ZONES[zone];
  const bottom = Math.min(maxDepth(ctx.upgrades), z.floor);
  const fish: LiveFish[] = [];
  // fish all the way down, a little past the hook's reach so the deep end never looks empty
  for (let y = 110; y < bottom + 160; y += 34 + ctx.rng() * 30) {
    const f = spawnFish(zone, y, ctx);
    if (f) fish.push(f);
  }
  return {
    zone, phase: "descend", resume: "descend", hookX: COLUMN / 2, hookY: 0, bottom,
    capacity: capacity(ctx.upgrades), fish, hooked: [], fight: null, t: 0, escaped: null, fx: [],
  };
}

export function catchValue(f: LiveFish): number {
  const m = MUTATIONS.find((x) => x.id === f.mut);
  return Math.round(f.def.value * (m ? m.mult : 1));
}

export const diveCatches = (d: Dive): Catch[] => d.hooked.map((f) => ({ fish: f.def.id, mut: f.mut, value: catchValue(f) }));

function startFight(d: Dive, f: LiveFish, ctx: DiveContext) {
  d.resume = d.phase === "ascend" ? "ascend" : "descend";
  d.phase = "fight";
  const cfg = FIGHT[f.def.rarity]!;
  d.fight = { fish: f, zone: 0.5, zoneHalf: cfg.half, speed: cfg.speed, marker: 0.5, vel: 0, progress: 0.3, t: 0, seed: ctx.rng() * 100, retried: false };
}

function stepFight(d: Dive, dt: number, input: DiveInput) {
  const fg = d.fight!;
  fg.t += dt;
  const speed = fg.speed;
  // the fish pulls the green zone around: two sines make it feel alive but readable
  fg.zone = 0.5 + 0.3 * Math.sin(fg.t * 1.35 * speed + fg.seed) + 0.12 * Math.sin(fg.t * 3.3 * speed + fg.seed * 2);
  fg.vel += (input.hold ? 2.9 : -2.5) * dt;
  fg.vel *= Math.pow(0.12, dt);
  fg.marker = Math.max(0, Math.min(1, fg.marker + fg.vel * dt));
  if (fg.marker === 0 || fg.marker === 1) fg.vel = 0;
  const inZone = Math.abs(fg.marker - fg.zone) <= fg.zoneHalf;
  fg.progress += (inZone ? 0.3 : -0.25) * dt;
  if (fg.progress >= 1) {
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
    d.fight.progress = 0.55;
    d.fight.marker = d.fight.zone;
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
  // fish keep swimming during a fight, it looks dead otherwise
  for (const f of d.fish) {
    if (f.hooked || f === d.fight?.fish) continue;
    f.x += f.dir * f.speed * dt;
    f.bob += dt * 2;
    if (f.x < -40) { f.x = -40; f.dir = 1; }
    if (f.x > COLUMN + 40) { f.x = COLUMN + 40; f.dir = -1; }
  }
  if (d.phase === "fight") { stepFight(d, dt, input); return; }

  // steer
  let vx = 0;
  if (input.targetX !== null) {
    const dx = input.targetX - d.hookX;
    vx = Math.sign(dx) * Math.min(Math.abs(dx) * 9, HOOK_SPEED);
  }
  if (input.axis) vx = input.axis * HOOK_SPEED * 0.75;
  d.hookX = Math.max(12, Math.min(COLUMN - 12, d.hookX + vx * dt));

  if (d.phase === "descend") {
    d.hookY += descendSpeed(d.bottom) * dt;
    if (d.hookY >= d.bottom) { d.hookY = d.bottom; d.phase = "ascend"; d.fx.push({ kind: "turn" }); }
  } else if (d.phase === "ascend") {
    d.hookY -= ascendSpeed(d.bottom) * dt;
    if (d.hookY <= 0) { d.hookY = 0; d.phase = "done"; d.fx.push({ kind: "surface" }); return; }
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
