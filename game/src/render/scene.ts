import { COLUMN, type Dive, type LiveFish } from "../core/dive.ts";
import type { ActiveEvent } from "../core/events.ts";
import type { FishDef, MutationId, ZoneId } from "../core/types.ts";
import { RARITY_COLOR, ZONES } from "../data/world.ts";
import { drawFish } from "./fish.ts";

type Ctx = CanvasRenderingContext2D;

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; kind: "dot" | "ring" | "bubble" }

export interface View {
  /** css pixels */
  w: number;
  h: number;
  /** world units -> css pixels */
  scale: number;
  /** css x of world x = 0 */
  ox: number;
  /** world units visible vertically */
  viewH: number;
}

export interface SceneState {
  mode: "dock" | "dive" | "reveal";
  zone: ZoneId;
  dive: Dive | null;
  event: ActiveEvent | null;
  /** seconds since start, for animation */
  t: number;
  /** a hint hand pulses over the water when the player has not cast yet */
  hint: boolean;
}

const BOAT_Y = -8;

function lerpColor(a: string, b: string, k: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function waterAt(zone: ZoneId, y: number) {
  const z = ZONES[zone];
  const k = Math.max(0, Math.min(1, y / z.floor));
  return k < 0.5 ? lerpColor(z.water[0], z.water[1], k * 2) : lerpColor(z.water[1], z.water[2], (k - 0.5) * 2);
}

export class Renderer {
  view: View = { w: 1, h: 1, scale: 1, ox: 0, viewH: 600 };
  camY = -300;
  private parts: Particle[] = [];
  private shake = 0;
  private ctx: Ctx;
  private canvas: HTMLCanvasElement;

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
    const scale = Math.min(w / COLUMN, h / 560);
    this.view = { w, h, scale, ox: (w - COLUMN * scale) / 2, viewH: h / scale };
  }

  /** css pixel -> world x */
  toWorldX(px: number) { return (px - this.view.ox) / this.view.scale; }

  burst(x: number, y: number, color: string, n = 14, speed = 160) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.5 + Math.random() * 0.4, color, size: 2 + Math.random() * 3, kind: "dot" });
    }
    this.parts.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.45, color, size: 6, kind: "ring" });
  }
  splash(x: number) { this.burst(x, 0, "#e9fbff", 18, 120); }
  shakeIt(amount: number) { this.shake = Math.max(this.shake, amount); }

  update(dt: number, s: SceneState) {
    const v = this.view;
    let target = -v.viewH * 0.42;
    if (s.mode === "dive" && s.dive) {
      const d = s.dive;
      target = d.hookY - v.viewH * (d.phase === "ascend" ? 0.6 : 0.36);
      target = Math.min(target, ZONES[s.zone].floor + 60 - v.viewH);
      target = Math.max(target, -v.viewH * 0.42);
    }
    this.camY += (target - this.camY) * Math.min(1, dt * (s.mode === "dive" ? 7 : 3));
    // ambient bubbles
    if (Math.random() < dt * 6) {
      this.parts.push({ x: Math.random() * COLUMN, y: this.camY + v.viewH + 10, vx: 0, vy: -30 - Math.random() * 40, life: 0, max: 6, color: "rgba(255,255,255,0.35)", size: 1.5 + Math.random() * 2.5, kind: "bubble" });
    }
    for (const p of this.parts) {
      p.life += dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === "dot") { p.vx *= 0.92; p.vy = p.vy * 0.92 + 120 * dt; }
      if (p.kind === "bubble") p.x += Math.sin(p.life * 3 + p.y) * 0.3;
    }
    this.parts = this.parts.filter((p) => p.life < p.max && !(p.kind === "bubble" && p.y < 0));
    this.shake = Math.max(0, this.shake - dt * 30);
  }

  draw(s: SceneState) {
    const c = this.ctx, v = this.view;
    c.save();
    c.clearRect(0, 0, v.w, v.h);
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    // world transform: x in column units, y in world units relative to the camera
    c.translate(v.ox + sx, sy);
    c.scale(v.scale, v.scale);
    c.translate(0, -this.camY);
    const top = this.camY, bottom = this.camY + v.viewH;
    const left = -v.ox / v.scale, right = COLUMN + v.ox / v.scale;

    this.drawSky(c, s, top, left, right);
    this.drawWater(c, s, top, bottom, left, right);
    this.drawFloor(c, s, left, right);
    this.drawMarkers(c, top, bottom);
    if (s.dive) this.drawDiveFish(c, s.dive, s.t, top, bottom);
    this.drawBoat(c, s);
    if (s.dive && s.mode === "dive") this.drawHook(c, s.dive, s.t);
    this.drawParticles(c);
    // darken the area outside the play column on wide screens
    if (v.ox > 4) {
      c.fillStyle = "rgba(0,10,25,0.28)";
      c.fillRect(left, top, -left, v.viewH);
      c.fillRect(COLUMN, top, right - COLUMN, v.viewH);
    }
    if (s.hint && s.mode === "dock") this.drawHint(c, s.t);
    c.restore();
    if (s.dive?.fight && (s.dive.phase === "fight" || s.dive.phase === "snapped")) this.drawFight(c, s.dive, s.t);
  }

  private drawSky(c: Ctx, s: SceneState, top: number, left: number, right: number) {
    if (top > 0) return;
    const g = c.createLinearGradient(0, top, 0, 0);
    const ev = s.event?.def;
    g.addColorStop(0, ev?.id === "blood_moon" ? "#2a0614" : ev?.id === "meteor" ? "#0b1030" : "#7fd3ff");
    g.addColorStop(1, ev?.id === "blood_moon" ? "#a3243f" : ev?.id === "meteor" ? "#3c3a7a" : ev?.id === "golden_hour" ? "#ffd27a" : "#d6f3ff");
    c.fillStyle = g;
    c.fillRect(left, top, right - left, -top);
    if (ev?.id === "rainbow_sky") {
      c.lineWidth = 8;
      ["#ff5b5b", "#ffb347", "#fff275", "#7dff8a", "#5bc8ff", "#a77bff"].forEach((col, i) => {
        c.strokeStyle = col; c.globalAlpha = 0.55;
        c.beginPath(); c.arc(COLUMN / 2, 20, 210 - i * 8, Math.PI, 0); c.stroke();
      });
      c.globalAlpha = 1;
    }
    // sun or moon
    const moon = ev?.id === "blood_moon" || ev?.id === "meteor";
    c.fillStyle = ev?.id === "blood_moon" ? "#ff4561" : moon ? "#f3f0ff" : "#fff6c9";
    c.beginPath(); c.arc(COLUMN * 0.8, top * 0.55, 26, 0, Math.PI * 2); c.fill();
    if (ev?.id === "meteor") {
      c.strokeStyle = "#ffe9a8"; c.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const k = (s.t * 0.6 + i * 0.37) % 1;
        const x = COLUMN * (1.1 - k * 1.2), y = top * (0.95 - k * 0.6);
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + 30, y - 18); c.stroke();
      }
    }
  }

  private drawWater(c: Ctx, s: SceneState, top: number, bottom: number, left: number, right: number) {
    const y0 = Math.max(0, top);
    if (bottom <= y0) return;
    const g = c.createLinearGradient(0, y0, 0, bottom);
    g.addColorStop(0, waterAt(s.zone, y0));
    g.addColorStop(1, waterAt(s.zone, bottom));
    c.fillStyle = g;
    c.fillRect(left, y0, right - left, bottom - y0);
    if (s.event) {
      c.fillStyle = s.event.def.tint; c.globalAlpha = 0.08;
      c.fillRect(left, y0, right - left, bottom - y0);
      c.globalAlpha = 1;
    }
    // light rays near the surface
    if (top < 420) {
      c.save();
      c.globalAlpha = 0.07;
      c.fillStyle = "#ffffff";
      for (let i = 0; i < 5; i++) {
        const x = ((i * 97 + s.t * 8) % (COLUMN + 160)) - 80;
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 40, 0); c.lineTo(x + 120, 420); c.lineTo(x + 60, 420); c.fill();
      }
      c.restore();
    }
    // surface line with small waves
    if (top < 10) {
      c.strokeStyle = "rgba(255,255,255,0.7)"; c.lineWidth = 2;
      c.beginPath();
      for (let x = left; x <= right; x += 8) {
        const y = Math.sin(x * 0.06 + s.t * 2) * 2;
        if (x === left) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
  }

  private drawFloor(c: Ctx, s: SceneState, left: number, right: number) {
    const floor = ZONES[s.zone].floor;
    if (this.camY + this.view.viewH < floor - 10) return;
    c.fillStyle = s.zone === "lake" ? "#3b3324" : "#1c1a2a";
    c.beginPath();
    c.moveTo(left, floor + 200);
    for (let x = left; x <= right; x += 20) c.lineTo(x, floor + 14 + Math.sin(x * 0.05) * 8 + Math.sin(x * 0.13) * 4);
    c.lineTo(right, floor + 200);
    c.fill();
    c.strokeStyle = s.zone === "lake" ? "#3f7a3a" : "#7a3f6e"; c.lineWidth = 3;
    for (let x = 10; x < COLUMN; x += 37) {
      c.beginPath(); c.moveTo(x, floor + 16);
      c.quadraticCurveTo(x + 6, floor - 10, x + Math.sin(x) * 6, floor - 26 - (x % 20));
      c.stroke();
    }
  }

  private drawMarkers(c: Ctx, top: number, bottom: number) {
    c.fillStyle = "rgba(255,255,255,0.4)";
    c.font = "bold 10px system-ui, sans-serif";
    c.textAlign = "left";
    for (let y = Math.max(100, Math.ceil(top / 100) * 100); y < bottom; y += 100) {
      c.fillRect(0, y, 8, 1.5);
      c.fillText(`${y / 10}m`, 11, y + 4);
    }
  }

  private drawOneFish(c: Ctx, def: FishDef, mut: MutationId | null, x: number, y: number, size: number, dir: number, t: number) {
    // value glow: rarer fish shine, so the player can see what is worth chasing
    if (def.rarity !== "common" || mut) {
      const col = mut ? (mut === "gold" ? "#ffd84a" : mut === "rainbow" ? `hsl(${(t * 120) % 360},100%,65%)` : mut === "ghost" ? "#bdf0ff" : mut === "electric" ? "#6be4ff" : RARITY_COLOR[def.rarity]) : RARITY_COLOR[def.rarity];
      const r = size * (def.rarity === "rare" && !mut ? 0.7 : 1.05);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)");
      c.globalAlpha = 0.35 + 0.15 * Math.sin(t * 4 + x);
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
    }
    c.save();
    c.translate(x, y);
    c.scale(dir, 1);
    drawFish(c, def, mut, size, t + x * 0.01);
    c.restore();
  }

  private drawDiveFish(c: Ctx, d: Dive, t: number, top: number, bottom: number) {
    for (const f of d.fish) {
      if (f.hooked || f === d.fight?.fish) continue;
      if (f.y < top - 80 || f.y > bottom + 80) continue;
      this.drawOneFish(c, f.def, f.mut, f.x, f.y + Math.sin(f.bob) * 4, f.size, f.dir, t);
    }
  }

  private drawBoat(c: Ctx, s: SceneState) {
    const x = COLUMN / 2, bob = Math.sin(s.t * 2) * 2;
    c.save();
    c.translate(x, BOAT_Y + bob);
    // rod
    c.strokeStyle = "#5a3b22"; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-6, -22); c.lineTo(28, -58); c.stroke();
    // fisher: a round friendly blob with a cap
    c.fillStyle = "#ffcf9e"; c.beginPath(); c.arc(-14, -34, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#ff5a4e"; c.beginPath(); c.arc(-14, -37, 9.5, Math.PI, 0); c.fill(); c.fillRect(-14, -38, 14, 3);
    c.fillStyle = "#111"; c.beginPath(); c.arc(-10, -33, 1.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#3d7bd9"; c.fillRect(-22, -26, 16, 14);
    // hull
    c.fillStyle = "#f4f1e8";
    c.beginPath(); c.moveTo(-44, -14); c.lineTo(40, -14); c.lineTo(28, 6); c.lineTo(-34, 6); c.closePath(); c.fill();
    c.fillStyle = "#e0573f"; c.fillRect(-40, -9, 76, 5);
    c.restore();
  }

  private drawHook(c: Ctx, d: Dive, t: number) {
    const tipX = COLUMN / 2 + 28, tipY = BOAT_Y - 58;
    c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(tipX, tipY); c.quadraticCurveTo(tipX, 0, d.hookX, d.hookY - 8); c.stroke();
    // hooked fish dangle below the hook, newest on top
    d.hooked.forEach((f: LiveFish, i: number) => {
      const sway = Math.sin(t * 5 + i) * 6;
      c.save();
      c.translate(d.hookX + sway, d.hookY + 14 + i * 10);
      c.rotate(Math.PI / 2 * (d.phase === "ascend" ? 1 : -1) * 0.9);
      drawFish(c, f.def, f.mut, f.size * 0.9, t);
      c.restore();
    });
    // the hook
    c.strokeStyle = "#e8eef2"; c.lineWidth = 2.5; c.lineCap = "round";
    c.beginPath(); c.moveTo(d.hookX, d.hookY - 10); c.lineTo(d.hookX, d.hookY + 4); c.arc(d.hookX - 5, d.hookY + 4, 5, 0, Math.PI, false); c.stroke();
    c.fillStyle = "#ff4d4d"; c.beginPath(); c.arc(d.hookX, d.hookY - 12, 4, 0, Math.PI * 2); c.fill();
  }

  private drawParticles(c: Ctx) {
    for (const p of this.parts) {
      const k = 1 - p.life / p.max;
      c.globalAlpha = Math.max(0, k);
      if (p.kind === "ring") {
        c.strokeStyle = p.color; c.lineWidth = 3;
        c.beginPath(); c.arc(p.x, p.y, p.size + (1 - k) * 40, 0, Math.PI * 2); c.stroke();
      } else if (p.kind === "bubble") {
        c.globalAlpha = 1; c.strokeStyle = p.color; c.lineWidth = 1;
        c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.stroke();
      } else {
        c.fillStyle = p.color;
        c.beginPath(); c.arc(p.x, p.y, p.size * k + 0.5, 0, Math.PI * 2); c.fill();
      }
    }
    c.globalAlpha = 1;
  }

  private drawHint(c: Ctx, t: number) {
    // a pulsing hand: "tap the water" without a single word
    const k = (t % 1.2) / 1.2;
    const x = COLUMN / 2, y = 120;
    c.strokeStyle = "rgba(255,255,255,0.8)"; c.lineWidth = 3;
    c.globalAlpha = 1 - k;
    c.beginPath(); c.arc(x, y, 10 + k * 26, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = 1;
    c.font = "38px system-ui, sans-serif"; c.textAlign = "center";
    c.fillText("👆", x + 6, y + 34 - Math.sin(k * Math.PI) * 8);
  }

  /** fight UI in screen space: a tall meter on the right, the fish fighting in the middle */
  private drawFight(c: Ctx, d: Dive, t: number) {
    const fg = d.fight!, v = this.view;
    const H = Math.min(v.h * 0.55, 380), W = 34;
    const x = v.ox + COLUMN * v.scale - W - 18, y = (v.h - H) / 2;
    c.save();
    c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(0, 0, v.w, v.h);
    // meter
    c.fillStyle = "rgba(10,20,35,0.85)"; roundRect(c, x - 4, y - 4, W + 8, H + 8, 12); c.fill();
    const zy = y + (1 - fg.zone - fg.zoneHalf) * H, zh = fg.zoneHalf * 2 * H;
    const inZone = Math.abs(fg.marker - fg.zone) <= fg.zoneHalf;
    c.fillStyle = inZone ? "#5ef08a" : "#3fbf68"; roundRect(c, x, zy, W, zh, 8); c.fill();
    const my = y + (1 - fg.marker) * H;
    c.fillStyle = "#ffffff"; roundRect(c, x - 6, my - 4, W + 12, 8, 4); c.fill();
    // progress ring around the fish
    const cx = v.ox + COLUMN * v.scale * 0.42, cy = v.h * 0.45;
    const R = Math.min(90, v.w * 0.18);
    c.lineWidth = 10; c.strokeStyle = "rgba(255,255,255,0.18)";
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = RARITY_COLOR[fg.fish.def.rarity];
    c.beginPath(); c.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, fg.progress)); c.stroke();
    c.translate(cx + Math.sin(t * 13) * (inZone ? 2 : 8), cy);
    c.rotate(Math.sin(t * 6) * 0.25);
    drawFish(c, fg.fish.def, fg.fish.mut, Math.min(R * 1.5, fg.fish.size * 1.6), t);
    c.restore();
  }
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
