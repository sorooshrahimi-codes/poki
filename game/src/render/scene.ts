import { COLUMN, type Dive, type LiveFish } from "../core/dive.ts";
import type { ActiveEvent } from "../core/events.ts";
import type { WeatherId } from "../core/weather.ts";
import { sfx } from "../platform/audio.ts";
import { makeRng } from "../core/rng.ts";
import type { FishDef, MutationId, ZoneId } from "../core/types.ts";
import { FISH } from "../data/fish.ts";
import { RARITY_COLOR, ZONES } from "../data/world.ts";
import { BG_WATERLINE, SHADOW_PAD, bgBottomColor, bgTopColor, drawGlint, img, propNames, spriteShadowed, spriteTinted } from "./assets.ts";
import { drawFish } from "./fish.ts";

type Ctx = CanvasRenderingContext2D;

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; kind: "dot" | "ring" | "bubble" | "star" | "mote" | "rain" }

export interface View { w: number; h: number; scale: number; ox: number; viewH: number; dpr: number }

export interface SceneState {
  mode: "dock" | "dive" | "reveal";
  zone: ZoneId;
  dive: Dive | null;
  event: ActiveEvent | null;
  t: number;
  hint: boolean;
  pose: Pose;
  weather: WeatherId;
  /** lantern: light radius around the hook in the dark */
  light: number;
  /** sonar range (world units), 0 = none */
  sonar: number;
  /** seconds since the pose changed: drives the squash-and-stretch pop */
  poseT: number;
}

interface Prop { name: string; x: number; y: number; h: number; flip: boolean; layer: 0 | 1 }
/** decorative far-away fish: depth cue only, never catchable */
interface Ambient { name: string; x: number; y: number; z: number; dir: 1 | -1; speed: number; size: number; phase: number }

/** sprite length relative to the fish's body size in the rules (sprites include fins and tail) */
const SPRITE_SCALE = 1.35;
const BOAT_W = 150;
/** rod tip and waterline inside the boat sprite, as fractions of its size */
/** per pose sprite: hull extent and rod tip, as fractions of the sprite (measured on the art) */
const POSE_GEO: Record<Pose, { hull: [number, number]; tip: [number, number] }> = {
  idle: { hull: [0, 0.917], tip: [0.998, 0.024] },
  cast: { hull: [0.155, 0.986], tip: [0, 0.029] },
  reel: { hull: [0.002, 0.857], tip: [0.971, 0.245] },
  cheer: { hull: [0, 0.988], tip: [0.967, 0.019] },
};
export type Pose = "idle" | "cast" | "reel" | "cheer";
/** shapes that do not bend when swimming */
const NO_BEND = new Set(["boot", "can", "duck", "puffer", "jelly"]);
/** fish that light up the dark */
const LUMINOUS = new Set(["glow_eel", "angler", "jelly", "moon_pike", "star_whale", "grand_marlin"]);

function mix(a: string, b: string, k: number) {
  const pa = toRgb(a), pb = toRgb(b);
  return `rgb(${Math.round(pa[0] * (1 - k) + pb[0] * k)},${Math.round(pa[1] * (1 - k) + pb[1] * k)},${Math.round(pa[2] * (1 - k) + pb[2] * k)})`;
}
function toRgb(c: string): [number, number, number] {
  if (c.startsWith("#")) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const m = c.match(/\d+/g)!; return [Number(m[0]), Number(m[1]), Number(m[2])];
}

export class Renderer {
  view: View = { w: 1, h: 1, scale: 1, ox: 0, viewH: 600, dpr: 1 };
  camY = -300;
  private parts: Particle[] = [];
  private shake = 0;
  private ctx: Ctx;
  private canvas: HTMLCanvasElement;
  private fog = document.createElement("canvas");
  private props = new Map<ZoneId, Prop[]>();
  /** visual facing per fish, eased so turning looks like a 2.5D card flip */
  private facing = new WeakMap<LiveFish, number>();
  private flash = 0;
  private zoom = 0;
  private lightning = 0;
  private nextBolt = 4;
  private boltX = 0;
  private zoomAt = { x: 0, y: 0 };
  private ambient = new Map<ZoneId, Ambient[]>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.resize();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingQuality = "high";
    // landscape zooms in a little more: fish read bigger on desktop and Chromebooks
    const scale = Math.min(w / COLUMN, h / (w > h ? 470 : 560));
    this.view = { w, h, scale, ox: (w - COLUMN * scale) / 2, viewH: h / scale, dpr };
    // the darkness layer works at half resolution: it is all soft gradients
    this.fog.width = Math.ceil(w / 2); this.fog.height = Math.ceil(h / 2);
  }

  toWorldX(px: number) { return (px - this.view.ox) / this.view.scale; }

  burst(x: number, y: number, color: string, n = 14, speed = 160) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.6 + Math.random() * 0.4, color, size: 2 + Math.random() * 3, kind: i % 3 === 0 ? "star" : "dot" });
    }
    this.parts.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.5, color, size: 6, kind: "ring" });
  }
  splash(x: number) {
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, v = 90 + Math.random() * 130;
      this.parts.push({ x, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.7, color: "#ffffff", size: 2.5 + Math.random() * 2.5, kind: "dot" });
    }
    this.parts.push({ x, y: 0, vx: 0, vy: 0, life: 0, max: 0.6, color: "#ffffff", size: 4, kind: "ring" });
  }
  shakeIt(amount: number) { this.shake = Math.max(this.shake, amount); }
  flashIt(k = 1) { this.flash = Math.max(this.flash, k); }
  /** quick camera punch-in on a world point (rare catch, boss landed) */
  punch(x: number, y: number, k = 0.12) { this.zoom = Math.max(this.zoom, k); this.zoomAt = { x, y }; }

  private propsFor(zone: ZoneId): Prop[] {
    let list = this.props.get(zone);
    if (list) return list;
    const rng = makeRng(zone === "lake" ? 11 : 23);
    const names = propNames(zone);
    list = [];
    const floor = ZONES[zone].floor;
    for (let y = 260; y < floor + 40; y += 120 + rng() * 120) {
      for (const side of [-1, 1]) {
        if (rng() < 0.35) continue;
        const near = rng() < 0.55;
        const h = near ? 80 + rng() * 70 : 110 + rng() * 90;
        // x is an inset from the screen edge on that side (negative side = left), resolved at draw time
        const inset = near ? 6 + rng() * 22 : 40 + rng() * 70;
        list.push({ name: names[Math.floor(rng() * names.length)], x: side * inset, y, h, flip: side > 0, layer: near ? 1 : 0 });
      }
    }
    this.props.set(zone, list);
    return list;
  }

  private ambientFor(zone: ZoneId): Ambient[] {
    let list = this.ambient.get(zone);
    if (list) return list;
    const rng = makeRng(zone === "lake" ? 5 : 9);
    const pool = FISH.filter((f) => f.zone === zone && !f.junk && (f.rarity === "common" || f.rarity === "rare")).map((f) => f.id);
    list = [];
    for (let y = 120; y < ZONES[zone].floor; y += 160 + rng() * 140) {
      const name = pool[Math.floor(rng() * pool.length)], z = 0.45 + rng() * 0.3, dir: 1 | -1 = rng() < 0.5 ? 1 : -1;
      const n = 3 + Math.floor(rng() * 4), x = rng() * COLUMN, speed = 14 + rng() * 16;
      for (let i = 0; i < n; i++) list.push({ name, x: x + (rng() - 0.5) * 70, y: y + (rng() - 0.5) * 40, z, dir, speed, size: 26 + rng() * 8, phase: rng() * 6 });
    }
    this.ambient.set(zone, list);
    return list;
  }

  update(dt: number, s: SceneState) {
    for (const a of this.ambientFor(s.zone)) {
      a.x += a.dir * a.speed * dt;
      if (a.x < -160) a.x = COLUMN + 160; else if (a.x > COLUMN + 160) a.x = -160;
    }
    // a trail of tiny bubbles behind the moving hook
    const d0 = s.dive;
    if (d0 && s.mode === "dive" && Math.random() < dt * 18) this.parts.push({ x: d0.hookX + (Math.random() - 0.5) * 4, y: d0.hookY - 10, vx: (Math.random() - 0.5) * 10, vy: -25 - Math.random() * 20, life: 0, max: 1.6, color: "rgba(255,255,255,0.6)", size: 1 + Math.random() * 1.6, kind: "bubble" });
    const v = this.view;
    const bg = img(`bg_${s.zone}`);
    const skyAbove = bg ? (BG_WATERLINE[s.zone] * ((COLUMN + 2 * v.ox / v.scale) * bg.height)) / bg.width : 300;
    let target = -Math.min(v.viewH * 0.45, Math.max(skyAbove, v.viewH * 0.3));
    if (s.mode === "dive" && s.dive) {
      const d = s.dive;
      target = d.hookY - v.viewH * (d.phase === "ascend" ? 0.62 : 0.36);
      target = Math.min(target, ZONES[s.zone].floor + 90 - v.viewH);
      target = Math.max(target, -Math.min(v.viewH * 0.45, Math.max(skyAbove, v.viewH * 0.3)));
    }
    this.camY += (target - this.camY) * Math.min(1, dt * (s.mode === "dive" ? 7 : 3));
    // bubbles rise, motes (plankton) drift: they sell the depth even when nothing else moves
    if (Math.random() < dt * 5) this.parts.push({ x: Math.random() * COLUMN, y: this.camY + v.viewH + 10, vx: 0, vy: -35 - Math.random() * 45, life: 0, max: 8, color: "rgba(255,255,255,0.5)", size: 1.5 + Math.random() * 3, kind: "bubble" });
    if (Math.random() < dt * 8) this.parts.push({ x: -40 + Math.random() * (COLUMN + 80), y: this.camY + Math.random() * v.viewH, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 0, max: 4 + Math.random() * 3, color: "#dff8ff", size: 0.8 + Math.random() * 1.4, kind: "mote" });
    // weather: rain drops fall into the sea, storms throw lightning
    const wx = s.weather;
    if ((wx === "rain" || wx === "storm") && this.camY < 0) {
      const left = -v.ox / v.scale, width = COLUMN + (2 * v.ox) / v.scale;
      const n = (wx === "storm" ? 160 : 70) * dt;
      for (let i = 0; i < n; i++) this.parts.push({ x: left + Math.random() * width, y: this.camY - 10, vx: wx === "storm" ? -90 : -25, vy: 520 + Math.random() * 160, life: 0, max: 3, color: "rgba(220,235,255,0.55)", size: 1, kind: "rain" });
    }
    if (wx === "storm") {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) { this.lightning = 1; this.nextBolt = 5 + Math.random() * 7; this.boltX = Math.random() * COLUMN; setTimeout(() => sfx.thunder(), 250 + Math.random() * 500); }
    }
    this.lightning = Math.max(0, this.lightning - dt * 3);
    for (const p of this.parts) {
      p.life += dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === "dot" || p.kind === "star") { p.vx *= 0.93; p.vy = p.vy * 0.93 + 140 * dt; }
      if (p.kind === "bubble") p.x += Math.sin(p.life * 3 + p.y * 0.05) * 0.4;
    }
    for (const p of this.parts) if (p.kind === "rain" && p.y >= 0) {
      p.life = p.max; // hit the water: leave a tiny ring
      if (Math.random() < 0.25) this.parts.push({ x: p.x, y: 1, vx: 0, vy: 0, life: 0, max: 0.4, color: "rgba(255,255,255,0.6)", size: 1, kind: "ring" });
    }
    this.parts = this.parts.filter((p) => p.life < p.max && !(p.kind === "bubble" && p.y < 2));
    if (this.parts.length > 400) this.parts.splice(0, this.parts.length - 400);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.zoom = Math.max(0, this.zoom - dt * 0.35);
  }

  private weatherNow: WeatherId = "sunny";

  draw(s: SceneState) {
    const c = this.ctx, v = this.view;
    this.weatherNow = s.weather;
    c.save();
    c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    c.clearRect(0, 0, v.w, v.h);
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    if (this.zoom > 0) {
      const zx = v.ox + this.zoomAt.x * v.scale, zy = (this.zoomAt.y - this.camY) * v.scale, z = 1 + this.zoom;
      c.translate(zx, zy); c.scale(z, z); c.translate(-zx, -zy);
    }
    c.translate(v.ox + sx, sy);
    c.scale(v.scale, v.scale);
    c.translate(0, -this.camY);
    const top = this.camY, bottom = this.camY + v.viewH;
    const left = -v.ox / v.scale, right = COLUMN + v.ox / v.scale;

    this.drawBackdrop(c, s, top, bottom, left, right);
    this.drawFloor(c, s, left, right, true);
    this.drawProps(c, s, 0, top, bottom, left, right);
    this.drawAmbient(c, s, top, bottom);
    this.drawRays(c, s, top, left, right);
    this.drawFloor(c, s, left, right, false);
    this.drawProps(c, s, 1, top, bottom, left, right);
    this.drawEdges(c, top, bottom, left, right);
    this.drawMarkers(c, top, bottom);
    if (s.dive) this.drawShadow(c, s.dive, s.t);
    if (s.dive) this.drawDiveFish(c, s.dive, s.t, top, bottom);
    if (s.dive) this.drawSurprise(c, s.dive, s.t);
    this.drawBoat(c, s);
    if (s.dive && s.mode === "dive") this.drawHook(c, s.dive, s.t, s.pose);
    this.drawParticles(c);
    c.restore();
    this.drawDarkness(s);
    if (s.hint && s.mode === "dock") this.drawHint(s.t);
    if (s.dive && s.mode === "dive" && s.sonar > 0) this.drawSonar(s);
    if (s.dive?.fight && (s.dive.phase === "fight" || s.dive.phase === "snapped")) this.drawFight(s.dive, s.t);
    if (this.flash > 0) {
      c.save(); c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      c.fillStyle = `rgba(255,255,255,${this.flash * 0.35})`; c.fillRect(0, 0, v.w, v.h);
      c.restore();
    }
  }

  // ------------------------------------------------------------- world layers
  private drawBackdrop(c: Ctx, s: SceneState, top: number, bottom: number, left: number, right: number) {
    const bg = img(`bg_${s.zone}`);
    const z = ZONES[s.zone];
    const width = right - left;
    let bgBottomY = 0;
    if (bg) {
      const h = (width * bg.height) / bg.width;
      const y0 = -BG_WATERLINE[s.zone] * h;
      bgBottomY = y0 + h;
      // sky above the painting (tall portrait screens), then the painting, then a soft fade into the deep
      if (top < y0) { c.fillStyle = bgTopColor(s.zone); c.fillRect(left, top, width, y0 - top + 2); }
      if (y0 < bottom && bgBottomY > top) {
        c.drawImage(bg, left, y0, width, h);
        // refraction: the band just under the surface wobbles sideways like real water
        if (top < 110) {
          const sy0 = Math.max(4, top), sy1 = Math.min(110, bottom);
          for (let yy = sy0; yy < sy1; yy += 3) {
            const dx = Math.sin(yy * 0.16 + s.t * 2.4) * 2.6 * (1 - yy / 120);
            const srcY = ((yy - y0) / h) * bg.height;
            c.drawImage(bg, 0, srcY, bg.width, (3 / h) * bg.height, left + dx, yy, width, 3.4);
          }
        }
        const fadeTop = y0 + h * 0.72;
        const fg = c.createLinearGradient(0, fadeTop, 0, bgBottomY);
        fg.addColorStop(0, "rgba(0,0,0,0)"); fg.addColorStop(1, bgBottomColor(s.zone));
        c.fillStyle = fg; c.fillRect(left, fadeTop, width, bgBottomY - fadeTop + 1);
      }
      // weather over the sky
      if (s.weather !== "sunny" && top < 0) {
        c.save();
        c.globalCompositeOperation = s.weather === "fog" ? "screen" : "multiply";
        c.fillStyle = s.weather === "rain" ? "#9fb2c6" : s.weather === "storm" ? "#5b6782" : "#c9d6e0";
        c.globalAlpha = s.weather === "fog" ? 0.55 : 0.85;
        c.fillRect(left, y0, width, -y0 + 30);
        c.restore();
      }
      if (this.lightning > 0 && top < 0) {
        c.save();
        c.fillStyle = `rgba(255,255,255,${this.lightning * 0.5})`; c.fillRect(left, y0, width, -y0);
        c.strokeStyle = `rgba(255,255,230,${this.lightning})`; c.lineWidth = 3; c.lineJoin = "round";
        c.beginPath(); let bx = this.boltX, by = y0 * 0.9; c.moveTo(bx, by);
        while (by < -10) { bx += (Math.random() - 0.5) * 40; by += 25 + Math.random() * 25; c.lineTo(bx, Math.min(by, -10)); }
        c.stroke(); c.restore();
      }
      // event mood over the sky
      const ev = s.event?.def.id;
      if (ev && top < 0) {
        c.save();
        c.globalCompositeOperation = ev === "golden_hour" ? "soft-light" : "multiply";
        c.fillStyle = ev === "blood_moon" ? "#ff5a7a" : ev === "meteor" ? "#5b5fc7" : ev === "golden_hour" ? "#ffcf5a" : "#bfe9ff";
        c.globalAlpha = ev === "rainbow_sky" ? 0.15 : 0.55;
        c.fillRect(left, y0, width, -y0 + 30);
        c.restore();
        if (ev === "rainbow_sky") this.drawRainbow(c, y0);
        if (ev === "blood_moon" || ev === "meteor") this.drawMoon(c, y0, ev, s.t);
      }
    } else {
      c.fillStyle = "#8fd8ff"; c.fillRect(left, top, width, -top);
    }
    // below the painted background: continue its colour down into the deep
    const from = Math.max(bgBottomY - 2, top);
    if (bottom > from) {
      const deep = z.water[2];
      const k0 = Math.min(1, Math.max(0, (from - bgBottomY) / (z.floor - bgBottomY)));
      const k1 = Math.min(1, Math.max(0, (bottom - bgBottomY) / (z.floor - bgBottomY)));
      const g = c.createLinearGradient(0, from, 0, bottom);
      g.addColorStop(0, mix(bgBottomColor(s.zone), deep, k0));
      g.addColorStop(1, mix(bgBottomColor(s.zone), deep, k1));
      c.fillStyle = g;
      c.fillRect(left, from, width, bottom - from);
    }
    if (s.event && bottom > 0) {
      c.fillStyle = s.event.def.tint; c.globalAlpha = 0.07;
      c.fillRect(left, Math.max(0, top), width, bottom - Math.max(0, top));
      c.globalAlpha = 1;
    }
  }

  private drawRainbow(c: Ctx, y0: number) {
    c.save(); c.lineWidth = 7; c.globalAlpha = 0.5;
    ["#ff6b6b", "#ffb347", "#ffe66d", "#7be495", "#5bc8ff", "#a77bff"].forEach((col, i) => {
      c.strokeStyle = col; c.beginPath(); c.arc(COLUMN / 2, -10, 230 - i * 7, Math.PI, 0); c.stroke();
    });
    c.restore();
    void y0;
  }

  private drawMoon(c: Ctx, y0: number, ev: string, t: number) {
    const x = COLUMN * 0.78, y = y0 * 0.45;
    const g = c.createRadialGradient(x, y, 4, x, y, 60);
    g.addColorStop(0, ev === "blood_moon" ? "rgba(255,90,110,0.6)" : "rgba(220,225,255,0.5)"); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.beginPath(); c.arc(x, y, 60, 0, Math.PI * 2); c.fill();
    c.fillStyle = ev === "blood_moon" ? "#ff5d73" : "#f4f2ff";
    c.beginPath(); c.arc(x, y, 22, 0, Math.PI * 2); c.fill();
    if (ev === "meteor") {
      c.strokeStyle = "rgba(255,240,190,0.9)"; c.lineWidth = 2; c.lineCap = "round";
      for (let i = 0; i < 4; i++) {
        const k = (t * 0.5 + i * 0.29) % 1;
        const mx = COLUMN * (1.2 - k * 1.4), my = y0 * (0.9 - k * 0.55);
        c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + 26, my - 14); c.stroke();
      }
    }
  }

  private drawRays(c: Ctx, s: SceneState, top: number, left: number, right: number) {
    if (top > 520) return;
    c.save();
    c.globalCompositeOperation = "lighter";
    // soft god rays
    for (let i = 0; i < 6; i++) {
      const x = left + ((i * 131 + s.t * 6) % (right - left + 200)) - 100;
      const g = c.createLinearGradient(0, 0, 0, 480);
      g.addColorStop(0, "rgba(255,255,240,0.07)"); g.addColorStop(1, "rgba(255,255,240,0)");
      c.fillStyle = g;
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 34, 0); c.lineTo(x + 130, 480); c.lineTo(x + 70, 480); c.fill();
    }
    // caustics: wobbly light lines just under the surface
    c.strokeStyle = "rgba(255,255,255,0.06)"; c.lineWidth = 2;
    for (let row = 0; row < 7; row++) {
      const y = 18 + row * 26;
      c.beginPath();
      for (let x = left; x <= right; x += 10) {
        const yy = y + Math.sin(x * 0.05 + s.t * 1.6 + row) * 6 + Math.sin(x * 0.11 - s.t * 1.1) * 3;
        if (x === left) c.moveTo(x, yy); else c.lineTo(x, yy);
      }
      c.stroke();
    }
    c.restore();
  }

  private drawProps(c: Ctx, s: SceneState, layer: 0 | 1, top: number, bottom: number, left: number, right: number) {
    const par = layer === 0 ? 0.82 : 1; // far layer lags behind the camera: depth
    const shift = this.camY * (1 - par);
    c.save();
    if (layer === 0) { c.globalAlpha = 0.55; c.filter = "blur(1.2px) saturate(0.7)"; }
    for (const p of this.propsFor(s.zone)) {
      if (p.layer !== layer) continue;
      const y = p.y + shift;
      if (y < top - 50 || y - p.h > bottom + 50) continue;
      const im = img(p.name);
      if (!im) continue;
      const w = (p.h * im.width) / im.height;
      const sway = Math.sin(s.t * 0.9 + p.y * 0.01) * 0.04;
      c.save();
      const px = p.x < 0 ? left - p.x : right - p.x;
      c.translate(px, y);
      c.rotate(sway);
      if (p.flip) c.scale(-1, 1);
      c.drawImage(im, -w / 2, -p.h, w, p.h);
      c.restore();
    }
    c.restore();
  }

  /** far schools: smaller, hazier, bluer and slower to scroll = depth */
  private drawAmbient(c: Ctx, s: SceneState, top: number, bottom: number) {
    c.save();
    c.filter = "blur(1.4px) saturate(0.55) brightness(0.9)";
    for (const a of this.ambientFor(s.zone)) {
      const par = 0.55 + a.z * 0.4;
      const y = a.y + this.camY * (1 - par) + Math.sin(s.t * 1.5 + a.phase) * 3;
      if (y < top - 40 || y > bottom + 40) continue;
      const im = img(a.name);
      if (!im) continue;
      const w = a.size * a.z * SPRITE_SCALE, h = (w * im.height) / im.width;
      c.globalAlpha = 0.35 + a.z * 0.3;
      c.save();
      c.translate(a.x, y);
      c.scale(a.dir, 1);
      c.drawImage(im, -w / 2, -h / 2, w, h);
      c.restore();
    }
    c.restore();
  }

  /** soft dark falloff at the screen sides: frames the play area and grounds the side plants */
  private drawEdges(c: Ctx, top: number, bottom: number, left: number, right: number) {
    const y0 = Math.max(0, top);
    if (bottom <= y0) return;
    const w = Math.min(90, (right - left) * 0.18);
    for (const [x0, x1] of [[left, left + w], [right, right - w]]) {
      const g = c.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, "rgba(3,20,45,0.45)"); g.addColorStop(1, "rgba(3,20,45,0)");
      c.fillStyle = g; c.fillRect(Math.min(x0, x1), y0, w, bottom - y0);
    }
  }

  /** two floor rows: the far one smaller, hazier and higher on screen gives the seabed perspective */
  private drawFloor(c: Ctx, s: SceneState, left: number, right: number, far: boolean) {
    const floor = ZONES[s.zone].floor;
    if (this.camY + this.view.viewH < floor - 140) return;
    const im = img(`floor_${s.zone}`);
    if (!im) return;
    c.save();
    const w = far ? 200 : 300, h = (w * im.height) / im.width;
    const y = far ? floor - 30 + this.camY * 0.12 - (floor - this.view.viewH) * 0.12 : floor + 50 - h * 0.75;
    if (far) { c.filter = "blur(1.2px) brightness(0.7) saturate(0.6)"; c.globalAlpha = 0.85; }
    const off = far ? 90 : 0;
    for (let x = left - ((((left - off) % w) + w) % w) - w; x < right; x += w) c.drawImage(im, x, y, w, h);
    c.restore();
  }

  private drawMarkers(c: Ctx, top: number, bottom: number) {
    c.save();
    c.fillStyle = "rgba(255,255,255,0.5)";
    c.font = "600 10px Fredoka, system-ui, sans-serif";
    c.textAlign = "left";
    for (let y = Math.max(100, Math.ceil(top / 100) * 100); y < bottom; y += 100) {
      c.globalAlpha = 0.5;
      c.fillRect(2, y, 7, 2);
      c.fillText(`${y / 10}m`, 12, y + 4);
    }
    c.restore();
  }

  // ------------------------------------------------------------- fish
  /**
   * Draws a fish sprite. `bend` > 0 makes the body undulate: the sprite is cut into vertical
   * slices that follow a travelling wave, strongest at the tail, still at the head: real swimming.
   */
  private drawFishSprite(c: Ctx, def: FishDef, mut: MutationId | null, size: number, t: number, glint: boolean, bend = 0, speed = 1) {
    const sp = spriteShadowed(def.id, mut);
    if (!sp) { drawFish(c, def, mut, size, t); return; }
    const inner = spriteTinted(def.id, mut ?? "giant")!; // plain copy for the glint mask
    const w = size * SPRITE_SCALE;
    const iw = sp.width - SHADOW_PAD * 2, ih = sp.height - SHADOW_PAD * 2;
    const k = w / iw, h = ih * k, pad = SHADOW_PAD * k;
    const rigid = NO_BEND.has(def.look.shape);
    if (rigid && def.look.shape === "jelly") { const p = 1 + Math.sin(t * 3) * 0.07; c.scale(1 / p, p); }
    if (bend <= 0 || rigid) {
      c.drawImage(sp, -w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2);
    } else {
      const N = 10, sw = sp.width / N, dw = (w + pad * 2) / N;
      for (let i = 0; i < N; i++) {
        const u = (i + 0.5) / N; // 0 = tail (sprites face right), 1 = head
        const tail = Math.pow(1 - u, 1.6);
        const dy = Math.sin(t * 7 * speed - u * 3.4) * bend * h * 0.16 * tail;
        c.drawImage(sp, i * sw, 0, sw + 1, sp.height, -w / 2 - pad + i * dw, -h / 2 - pad + dy, dw + 0.6, h + pad * 2);
      }
    }
    if (glint) drawGlint(c, mut ? spriteTinted(def.id, mut)! : inner, -w / 2, -h / 2, w, h, t * 0.33 + def.value * 0.01, this.view.scale * this.view.dpr);
  }

  /** a fish in the water: soft value aura, eased facing (card-flip turn), swim wobble */
  private drawSwimmer(c: Ctx, f: LiveFish, t: number) {
    const def = f.def, mut = f.mut;
    let face = this.facing.get(f) ?? f.dir;
    face += (f.dir - face) * 0.12;
    this.facing.set(f, face);
    const y = f.y + Math.sin(f.bob) * 4;
    if (def.rarity !== "common" || mut) {
      const col = mut === "gold" ? "255,210,80" : mut === "rainbow" ? "200,160,255" : mut === "ghost" ? "190,240,255" : mut === "electric" ? "110,230,255" : hexToTriplet(RARITY_COLOR[def.rarity]);
      const r = f.size * (def.rarity === "rare" && !mut ? 0.75 : 1.05);
      const g = c.createRadialGradient(f.x, y, 0, f.x, y, r);
      g.addColorStop(0, `rgba(${col},${0.22 + 0.08 * Math.sin(t * 3 + f.uid)})`); g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g; c.beginPath(); c.arc(f.x, y, r, 0, Math.PI * 2); c.fill();
    }
    c.save();
    c.translate(f.x, y);
    c.rotate(Math.sin(t * 3 + f.uid) * 0.06);
    c.scale(face * (1 + Math.sin(t * 6 + f.uid) * 0.02), 1 - Math.sin(t * 6 + f.uid) * 0.02);
    this.drawFishSprite(c, def, mut, f.size, t + f.uid, def.rarity !== "common" || !!mut, 1, 0.6 + f.speed / 120);
    if (mut === "electric") this.sparks(c, f.size, t);
    c.restore();
  }

  /** the "something huge" teaser: a giant dark silhouette gliding far behind everything */
  private drawShadow(c: Ctx, d: Dive, t: number) {
    const sp = d.surprise;
    if (!sp || sp.kind !== "shadow" || sp.state !== "active") return;
    const secret = FISH.find((f) => f.zone === d.zone && f.rarity === "secret");
    const im = secret ? img(secret.id) : null;
    if (!im) return;
    const w = 340, h = (w * im.height) / im.width;
    c.save();
    c.globalAlpha = 0.28;
    c.filter = "brightness(0) blur(3px)";
    c.translate(sp.x, sp.y + this.camY * 0.25 - d.hookY * 0.25 + Math.sin(t) * 8);
    c.scale(sp.dir, 1);
    c.drawImage(im, -w / 2, -h / 2, w, h);
    c.restore();
  }

  private drawSurprise(c: Ctx, d: Dive, t: number) {
    const sp = d.surprise;
    if (!sp) return;
    if (sp.kind === "whirlpool" && sp.state === "waiting") {
      c.save();
      c.translate(COLUMN / 2, sp.y);
      c.scale(1, 0.45);
      for (let i = 0; i < 6; i++) {
        c.strokeStyle = `rgba(220,250,255,${0.5 - i * 0.07})`;
        c.lineWidth = 4 - i * 0.4;
        c.beginPath();
        c.arc(0, 0, 30 + i * 26, t * (3 - i * 0.3) + i, t * (3 - i * 0.3) + i + Math.PI * 1.3);
        c.stroke();
      }
      c.restore();
    }
    if ((sp.kind === "bottle" || sp.kind === "chest") && sp.state !== "done") {
      const im = img(sp.kind === "bottle" ? "s_bottle" : "s_chest");
      if (!im) return;
      const w = sp.kind === "bottle" ? 38 : 72, h = (w * im.height) / im.width;
      const y = sp.y + Math.sin(t * 2) * (sp.kind === "bottle" ? 6 : 1.5);
      const g = c.createRadialGradient(sp.x, y, 0, sp.x, y, w);
      g.addColorStop(0, sp.kind === "bottle" ? "rgba(180,240,255,0.45)" : "rgba(255,215,90,0.5)"); g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g; c.beginPath(); c.arc(sp.x, y, w, 0, Math.PI * 2); c.fill();
      c.save();
      c.translate(sp.x, y);
      c.rotate(sp.kind === "bottle" ? Math.sin(t * 1.5) * 0.3 : 0);
      c.drawImage(im, -w / 2, -h / 2, w, h);
      c.restore();
      if (Math.random() < 0.08) this.parts.push({ x: sp.x + (Math.random() - 0.5) * w, y: y - h / 2, vx: 0, vy: -20, life: 0, max: 0.8, color: "#fff6c0", size: 2, kind: "star" });
    }
    if (sp.kind === "shark" && sp.state === "active") {
      const im = img("s_shark");
      if (!im) return;
      const w = 120, h = (w * im.height) / im.width;
      c.save();
      c.translate(sp.x, sp.y + 30);
      c.rotate(-0.5 * sp.dir); // nose up: it is coming for you
      c.scale(sp.dir, 1);
      const N = 8, sw = im.width / N, dw = w / N;
      for (let i = 0; i < N; i++) {
        const u = (i + 0.5) / N, dy = Math.sin(t * 12 - u * 3.4) * h * 0.12 * Math.pow(1 - u, 1.5);
        c.drawImage(im, i * sw, 0, sw + 1, im.height, -w / 2 + i * dw, -h / 2 + dy, dw + 0.6, h);
      }
      c.restore();
    }
  }

  private sparks(c: Ctx, len: number, t: number) {
    c.strokeStyle = "#fff36b"; c.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const a = t * 7 + i * 2.1, x = Math.cos(a) * len * 0.55, y = Math.sin(a * 1.3) * len * 0.3;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 5, y - 4); c.lineTo(x + 2, y + 1); c.lineTo(x + 7, y - 2); c.stroke();
    }
  }

  private drawDiveFish(c: Ctx, d: Dive, t: number, top: number, bottom: number) {
    for (const f of d.fish) {
      if (f.hooked || f === d.fight?.fish) continue;
      if (f.y < top - 90 || f.y > bottom + 90) continue;
      this.drawSwimmer(c, f, t);
    }
  }

  // ------------------------------------------------------------- boat, hook
  private boatImg(pose: Pose) { return img(pose === "idle" ? "boat" : `boat_${pose}`); }

  /**
   * Boat geometry for a pose. Every pose sprite is scaled so its hull has the same width and sits
   * at the same place: only the character and rod change, the boat never jumps.
   */
  private boatGeo(t: number, pose: Pose) {
    let p = pose, im = this.boatImg(p);
    if (!im) { p = "idle"; im = img("boat"); }
    const g = POSE_GEO[p];
    const hullW = BOAT_W * 0.917;
    const w = hullW / (g.hull[1] - g.hull[0]);
    const h = im ? (w * im.height) / im.width : 100;
    const rough = this.weatherNow === "storm" ? 3 : this.weatherNow === "rain" ? 1.6 : 1;
    const bob = Math.sin(t * 1.8 * Math.sqrt(rough)) * 2.2 * rough, tilt = Math.sin(t * 1.3 * Math.sqrt(rough)) * 0.03 * rough;
    const cx = COLUMN / 2 - 10;
    // hull bottom sits a little under the waterline
    const bottomY = 14 + bob;
    const left = -(g.hull[0] + g.hull[1]) / 2 * w;
    return { im, p, w, h, cx, bottomY, left, tilt, g };
  }

  private rodTip(t: number, pose: Pose) {
    const b = this.boatGeo(t, pose);
    const lx = b.left + b.g.tip[0] * b.w, ly = -b.h + b.g.tip[1] * b.h;
    return { x: b.cx + lx * Math.cos(b.tilt) - ly * Math.sin(b.tilt), y: b.bottomY + lx * Math.sin(b.tilt) + ly * Math.cos(b.tilt) };
  }

  private drawBoat(c: Ctx, s: SceneState) {
    const b = this.boatGeo(s.t, s.pose);
    // soft water shadow under the hull
    c.save();
    c.fillStyle = "rgba(0,40,70,0.18)";
    c.beginPath(); c.ellipse(b.cx, 8, BOAT_W * 0.42, 6, 0, 0, Math.PI * 2); c.fill();
    // squash and stretch when the pose changes: the character "pops" into it
    const pop = s.poseT < 0.35 ? Math.sin((s.poseT / 0.35) * Math.PI) * 0.08 : 0;
    c.translate(b.cx, b.bottomY);
    c.rotate(b.tilt);
    c.scale(1 - pop * 0.6, 1 + pop);
    if (b.im) c.drawImage(b.im, b.left, -b.h, b.w, b.h);
    c.restore();
    // ripples around the hull
    c.save();
    const bx = this.boatGeo(s.t, s.pose).cx;
    c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 1.5;
    for (let i = 0; i < 2; i++) {
      const k = (s.t * 0.5 + i * 0.5) % 1;
      c.globalAlpha = 1 - k;
      c.beginPath(); c.ellipse(bx, 6, BOAT_W * (0.45 + k * 0.35), 4 + k * 3, 0, 0, Math.PI * 2); c.stroke();
    }
    c.restore();
  }

  private drawHook(c: Ctx, d: Dive, t: number, pose: Pose) {
    const tip = this.rodTip(t, pose);
    c.save();
    c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(tip.x, tip.y); c.quadraticCurveTo(tip.x + 10, 10, d.hookX, d.hookY - 16); c.stroke();
    // hooked fish dangle under the hook
    d.hooked.forEach((f: LiveFish, i: number) => {
      c.save();
      c.translate(d.hookX + Math.sin(t * 5 + i) * 5, d.hookY + 18 + i * 9);
      c.rotate(Math.PI / 2 + Math.sin(t * 6 + i) * 0.15);
      this.drawFishSprite(c, f.def, f.mut, f.size * 0.85, t + i, false, 2.2, 1.6); // hooked fish wriggle hard
      c.restore();
    });
    // cute lure: red-white bobber weight + silver hook
    const lx = d.hookX, ly = d.hookY - 14;
    const g = c.createRadialGradient(lx - 2, ly - 3, 1, lx, ly, 7);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.35, "#ff5a5a"); g.addColorStop(1, "#b81e3a");
    c.fillStyle = g; c.strokeStyle = "#2a1b3d"; c.lineWidth = 1.6;
    c.beginPath(); c.arc(lx, ly, 6.5, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = "#2a1b3d"; c.lineWidth = 4; c.lineCap = "round";
    c.beginPath(); c.moveTo(lx, ly + 6); c.lineTo(lx, ly + 16); c.arc(lx - 5, ly + 16, 5, 0, Math.PI, false); c.stroke();
    c.strokeStyle = "#e9f2f7"; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(lx, ly + 6); c.lineTo(lx, ly + 16); c.arc(lx - 5, ly + 16, 5, 0, Math.PI, false); c.stroke();
    c.restore();
  }

  private drawParticles(c: Ctx) {
    for (const p of this.parts) {
      const k = 1 - p.life / p.max;
      if (p.kind === "rain") {
        c.globalAlpha = 1; c.strokeStyle = p.color; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025); c.stroke();
      } else if (p.kind === "ring") {
        c.globalAlpha = Math.max(0, k); c.strokeStyle = p.color; c.lineWidth = p.size > 1 ? 3 : 1;
        c.beginPath();
        if (p.size > 1) c.arc(p.x, p.y, p.size + (1 - k) * 42, 0, Math.PI * 2);
        else c.ellipse(p.x, p.y, 2 + (1 - k) * 9, 1 + (1 - k) * 2.5, 0, 0, Math.PI * 2);
        c.stroke();
      } else if (p.kind === "bubble") {
        c.globalAlpha = 0.8;
        c.strokeStyle = p.color; c.lineWidth = 1;
        c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.stroke();
        c.fillStyle = "rgba(255,255,255,0.6)";
        c.beginPath(); c.arc(p.x - p.size * 0.35, p.y - p.size * 0.35, p.size * 0.3, 0, Math.PI * 2); c.fill();
      } else if (p.kind === "mote") {
        c.globalAlpha = Math.sin((p.life / p.max) * Math.PI) * 0.35;
        c.fillStyle = p.color; c.fillRect(p.x, p.y, p.size, p.size);
      } else if (p.kind === "star") {
        c.globalAlpha = Math.max(0, k); c.fillStyle = p.color;
        star(c, p.x, p.y, p.size * 1.6 * k + 1, p.life * 6);
      } else {
        c.globalAlpha = Math.max(0, k); c.fillStyle = p.color;
        c.beginPath(); c.arc(p.x, p.y, p.size * k + 0.5, 0, Math.PI * 2); c.fill();
      }
    }
    c.globalAlpha = 1;
  }

  // ------------------------------------------------------------- deep water darkness
  private drawDarkness(s: SceneState) {
    const v = this.view;
    const mid = this.camY + v.viewH * 0.5;
    let k = Math.max(0, Math.min(1, (mid - 500) / (ZONES[s.zone].floor - 500)));
    if (s.weather === "storm") k = Math.min(1, k + 0.18);
    if (s.weather === "fog") this.drawFogLayer(s);
    if (this.lightning > 0) k *= 1 - this.lightning * 0.6;
    if (k <= 0.02) return;
    const f = this.fog.getContext("2d")!;
    const fw = this.fog.width, fh = this.fog.height, sc = 0.5;
    f.globalCompositeOperation = "source-over";
    f.clearRect(0, 0, fw, fh);
    f.fillStyle = `rgba(2,8,22,${0.78 * k})`;
    f.fillRect(0, 0, fw, fh);
    f.globalCompositeOperation = "destination-out";
    const hole = (wx: number, wy: number, r: number, strength: number) => {
      const x = (v.ox + wx * v.scale) * sc, y = (wy - this.camY) * v.scale * sc, rr = r * v.scale * sc;
      if (y < -rr || y > fh + rr) return;
      const g = f.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, `rgba(0,0,0,${strength})`); g.addColorStop(0.55, `rgba(0,0,0,${strength * 0.6})`); g.addColorStop(1, "rgba(0,0,0,0)");
      f.fillStyle = g; f.beginPath(); f.arc(x, y, rr, 0, Math.PI * 2); f.fill();
    };
    const d = s.dive;
    if (d && s.mode === "dive") {
      hole(d.hookX, d.hookY, s.light, 1);
      // a lantern beam pointing the way the hook travels
      const x = (v.ox + d.hookX * v.scale) * sc, y = (d.hookY - this.camY) * v.scale * sc;
      const dirY = d.phase === "ascend" ? -1 : 1, len = 260 * v.scale * sc, spread = 0.42;
      const g = f.createLinearGradient(x, y, x, y + dirY * len);
      g.addColorStop(0, "rgba(0,0,0,0.85)"); g.addColorStop(1, "rgba(0,0,0,0)");
      f.fillStyle = g;
      f.beginPath(); f.moveTo(x, y);
      f.lineTo(x - len * spread, y + dirY * len); f.lineTo(x + len * spread, y + dirY * len); f.closePath(); f.fill();
    }
    if (d) for (const fish of d.fish) {
      if (fish.hooked) continue;
      if (LUMINOUS.has(fish.def.id) || fish.mut === "electric" || fish.mut === "ghost") hole(fish.x, fish.y, fish.size * 1.1, 0.85);
      else if (fish.def.rarity !== "common" || fish.mut) hole(fish.x, fish.y, fish.size * 0.8, 0.45);
    }
    const sp = d?.surprise;
    if (sp && (sp.kind === "bottle" || sp.kind === "chest") && sp.state !== "done") hole(sp.x, sp.y, 70, 0.9);
    if (sp && sp.kind === "shark" && sp.state === "active") hole(sp.x, sp.y + 30, 80, 0.7);
    const c = this.ctx;
    c.save();
    c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    c.drawImage(this.fog, 0, 0, fw, fh, 0, 0, v.w, v.h);
    c.restore();
  }

  /** sonar: arrows at the screen edge point at valuable fish you cannot see yet */
  private drawSonar(s: SceneState) {
    const d = s.dive!, v = this.view, c = this.ctx;
    const top = this.camY, bottom = this.camY + v.viewH;
    c.save();
    c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    for (const f of d.fish) {
      if (f.hooked || (f.def.rarity === "common" || f.def.rarity === "rare") && !f.mut) continue;
      const dy = f.y - d.hookY;
      if (Math.abs(dy) > s.sonar) continue;
      if (f.y > top + 30 && f.y < bottom - 30) continue; // on screen: no arrow needed
      const below = f.y >= bottom - 30;
      const sx = Math.max(24, Math.min(v.w - 24, v.ox + f.x * v.scale));
      const sy = below ? v.h - 30 : 140;
      const pulse = 1 + Math.sin(s.t * 6 + f.uid) * 0.15;
      c.fillStyle = f.mut === "gold" ? "#ffd84a" : RARITY_COLOR[f.def.rarity];
      c.strokeStyle = "#0d1e45"; c.lineWidth = 3;
      c.beginPath();
      const r = 11 * pulse, dir = below ? 1 : -1;
      c.moveTo(sx, sy + dir * r); c.lineTo(sx - r, sy - dir * r * 0.6); c.lineTo(sx + r, sy - dir * r * 0.6); c.closePath();
      c.stroke(); c.fill();
      c.font = "700 11px Fredoka, sans-serif"; c.textAlign = "center"; c.fillStyle = "#fff";
      c.fillText(`${Math.round(Math.abs(dy) / 10)}m`, sx, sy - dir * 18);
    }
    c.restore();
  }

  /** fog: a milky veil underwater that only clears around the hook (sonar and lanterns matter) */
  private drawFogLayer(s: SceneState) {
    const v = this.view, f = this.fog.getContext("2d")!;
    const fw = this.fog.width, fh = this.fog.height, sc = 0.5;
    const surf = Math.max(0, (0 - this.camY) * v.scale * sc);
    f.globalCompositeOperation = "source-over";
    f.clearRect(0, 0, fw, fh);
    f.fillStyle = "rgba(205,222,235,0.42)";
    f.fillRect(0, surf, fw, fh - surf);
    const d = s.dive;
    if (d && s.mode === "dive") {
      f.globalCompositeOperation = "destination-out";
      const x = (v.ox + d.hookX * v.scale) * sc, y = (d.hookY - this.camY) * v.scale * sc, r = s.light * 0.9 * v.scale * sc;
      const g = f.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
      f.fillStyle = g; f.beginPath(); f.arc(x, y, r, 0, Math.PI * 2); f.fill();
    }
    const c = this.ctx;
    c.save(); c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    c.drawImage(this.fog, 0, 0, fw, fh, 0, 0, v.w, v.h);
    c.restore();
  }

  // ------------------------------------------------------------- screen-space overlays
  private drawHint(t: number) {
    const c = this.ctx, v = this.view;
    const k = (t % 1.2) / 1.2;
    const x = v.ox + (COLUMN / 2) * v.scale, y = (150 - this.camY) * v.scale;
    c.save();
    c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 4;
    c.globalAlpha = 1 - k;
    c.beginPath(); c.arc(x, y, 12 + k * 34, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = 1;
    c.font = "46px system-ui, sans-serif"; c.textAlign = "center";
    c.fillText("👆", x + 8, y + 44 - Math.sin(k * Math.PI) * 10);
    c.restore();
  }

  private drawFight(d: Dive, t: number) {
    const c = this.ctx, v = this.view, fg = d.fight!;
    const H = Math.min(v.h * 0.55, 380), W = 38;
    const x = v.ox + COLUMN * v.scale - W - 18, y = (v.h - H) / 2;
    const inZone = Math.abs(fg.marker - fg.zone) <= fg.zoneHalf;
    c.save();
    c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    const vg = c.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.2, v.w / 2, v.h / 2, Math.max(v.w, v.h) * 0.7);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,20,0.55)");
    c.fillStyle = vg; c.fillRect(0, 0, v.w, v.h);
    // meter: a chunky rounded tube
    c.fillStyle = "#1b2b4a"; c.strokeStyle = "#0d1630"; c.lineWidth = 4;
    roundRect(c, x - 5, y - 5, W + 10, H + 10, 18); c.fill(); c.stroke();
    const zy = y + (1 - fg.zone - fg.zoneHalf) * H, zh = fg.zoneHalf * 2 * H;
    const zg = c.createLinearGradient(x, 0, x + W, 0);
    zg.addColorStop(0, inZone ? "#7dffa8" : "#4cd17a"); zg.addColorStop(1, inZone ? "#3fdc7c" : "#2fa45d");
    c.fillStyle = zg; roundRect(c, x, zy, W, zh, 12); c.fill();
    c.fillStyle = "rgba(255,255,255,0.35)"; roundRect(c, x + 5, zy + 4, 7, Math.max(0, zh - 8), 4); c.fill();
    const my = y + (1 - fg.marker) * H;
    c.fillStyle = "#ffffff"; c.strokeStyle = "#0d1630"; c.lineWidth = 3;
    roundRect(c, x - 9, my - 6, W + 18, 12, 6); c.fill(); c.stroke();
    // progress ring around the fighting fish
    const cx = v.ox + COLUMN * v.scale * 0.42, cy = v.h * 0.45, R = Math.min(96, v.w * 0.2);
    c.lineCap = "round";
    c.lineWidth = 12; c.strokeStyle = "rgba(255,255,255,0.18)";
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = RARITY_COLOR[fg.fish.def.rarity];
    c.beginPath(); c.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, fg.progress)); c.stroke();
    c.translate(cx + Math.sin(t * 13) * (inZone ? 2 : 9), cy);
    c.rotate(Math.sin(t * 6) * 0.25);
    const size = Math.min(R * 1.25, fg.fish.size * 1.5) / SPRITE_SCALE * 1.2;
    this.drawFishSprite(c, fg.fish.def, fg.fish.mut, size, t, true, 2.5, 1.8);
    c.restore();
  }
}

function hexToTriplet(h: string) { const n = parseInt(h.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; }

function star(c: Ctx, x: number, y: number, r: number, rot: number) {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4, rr = i % 2 ? r * 0.4 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath(); c.fill();
}

export function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
