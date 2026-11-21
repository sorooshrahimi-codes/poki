import { depthK, type Critter, type Field } from "../core/field.ts";
import { CONE, range, type Upgrades } from "../core/economy.ts";
import type { MutationId } from "../core/types.ts";
import { BIOMES, CRITTERS, RARITY_COLOR, RECIPES, STAR_MULT, critterOf, starOf } from "../data/critters.ts";
import type { BiomeId } from "../core/types.ts";
import { EYES } from "../data/eyes.ts";
import type { SaveData } from "../core/save.ts";

type Ctx = CanvasRenderingContext2D;
const NAMES = [...CRITTERS.map((c) => c.art), "lab_egg", "kid_vac", "kid_vac_suck", "kid_cheer", "egg_speckled", "egg_sky", "egg_star", "egg_golden", "bg_frost", "bg_meadow", "bg_forest", "bg_park", "pedestal", "jar", "coin", "nozzle"];
const imgs = new Map<string, HTMLImageElement>();
export const img = (n: string) => imgs.get(n) ?? null;
export function loadArt(onProgress: (k: number) => void) {
  let done = 0;
  return Promise.all(NAMES.map((n) => new Promise<void>((res) => {
    const im = new Image();
    im.onload = () => { imgs.set(n, im); onProgress(++done / NAMES.length); res(); };
    im.onerror = () => { onProgress(++done / NAMES.length); res(); };
    im.src = `./art/${n}.webp`;
  })));
}

/** gold / rainbow copies of a sprite, keeping its shading (cached) */
const tints = new Map<string, HTMLCanvasElement>();
function tinted(name: string, mut: MutationId | null): CanvasImageSource | null {
  const im = img(name);
  if (!im || !mut || mut === "giant") return im;
  const key = name + mut;
  const hit = tints.get(key); if (hit) return hit;
  const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
  const x = c.getContext("2d")!;
  x.drawImage(im, 0, 0);
  x.globalCompositeOperation = "color";
  if (mut === "gold") { const g = x.createLinearGradient(0, 0, im.width, im.height); g.addColorStop(0, "#ffe680"); g.addColorStop(0.5, "#ffb300"); g.addColorStop(1, "#e08a00"); x.fillStyle = g; }
  else { const g = x.createLinearGradient(0, 0, im.width, 0); ["#ff5b6e", "#ffb347", "#ffe66d", "#6ee7a0", "#5bc8ff", "#a77bff"].forEach((col, i) => g.addColorStop(i / 5, col)); x.fillStyle = g; }
  x.fillRect(0, 0, im.width, im.height);
  if (mut === "gold") { x.globalCompositeOperation = "soft-light"; x.fillStyle = "#fff2b0"; x.fillRect(0, 0, im.width, im.height); }
  x.globalCompositeOperation = "destination-in"; x.drawImage(im, 0, 0);
  tints.set(key, c);
  return c;
}

export interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number; text?: string }

export class View {
  readonly c: Ctx;
  scale = 1; W = 360; H = 640; dpr = 1;
  parts: Part[] = [];
  shake = 0;
  /** seconds left of the kid's cheer after a great catch */
  cheer = 0;
  canvas: HTMLCanvasElement;
  constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; this.c = canvas.getContext("2d")!; this.resize(); }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + "px"; this.canvas.style.height = h + "px";
    // short landscape screens (phones on their side) see a shorter world, so everything stays big
    this.scale = Math.min(w / 360, h / (w > h && h < 600 ? 470 : 640));
    this.W = w / this.scale; this.H = h / this.scale;
  }
  toWorld(px: number, py: number) { return { x: px / this.scale, y: py / this.scale }; }

  private begin() {
    const c = this.c, k = this.dpr * this.scale;
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    c.setTransform(k, 0, 0, k, sx * k, sy * k);
    c.clearRect(-20, -20, this.W + 40, this.H + 40);
  }

  /** a background image covering the screen, anchored to the bottom so the ground lines up.
   *  On wide screens it is fitted to the height and continued sideways with mirrored copies, instead of zooming in. */
  private cover(name: string, shift = 0) {
    const im = img(name), c = this.c;
    if (!im) { c.fillStyle = "#8fd36b"; c.fillRect(0, 0, this.W, this.H); return; }
    const k = Math.max(this.H / im.height, Math.min(this.W / im.width, (this.H * 1.25) / im.height));
    const w = im.width * k, h = im.height * k, y0 = this.H - h;
    // a gentle sideways drift (parallax), never past the picture's edge when it is a single picture
    const room = Math.max(0, (w - this.W) / 2), x0 = (this.W - w) / 2 + (room > 0 ? Math.max(-room, Math.min(room, shift)) : shift);
    c.drawImage(im, x0, y0, w, h);
    for (let i = 1; x0 - (i - 1) * w > 0 || x0 + i * w < this.W; i++) {
      for (const side of [-1, 1]) {
        const x = x0 + side * i * w;
        if (x > this.W || x + w < 0) continue;
        c.save();
        if (i % 2) { c.translate(x + w, y0); c.scale(-1, 1); c.drawImage(im, 0, 0, w, h); } else c.drawImage(im, x, y0, w, h);
        c.restore();
      }
    }
  }

  /** 0 = grey (Gloom still here), 1 = full colour; animated by the controller when a place is restored */
  colour = 1;
  /** Gloom flees across the sky after its boss is caught */
  gloomFlee = 0;
  drawField(f: Field, up: Upgrades, t: number, dt: number) {
    this.begin();
    const c = this.c;
    if (this.colour < 1) c.filter = `saturate(${0.25 + 0.75 * this.colour}) brightness(${0.85 + 0.15 * this.colour})`;
    // the camera leans in a little while the vacuum roars
    this.zoom += ((this.zoomTarget || (f.beam ? 1.035 : 1)) - this.zoom) * Math.min(1, dt * 3);
    const zx = f.nozzle.x + 120, zy = f.nearY - 40;
    c.translate(zx, zy); c.scale(this.zoom, this.zoom); c.translate(-zx, -zy);
    this.cover(BIOMES.find((b) => b.id === f.biome)!.bg, -f.kid.x * 0.14);
    c.filter = "none";
    this.lastField = f;
    if (!f.critters.some((k) => k.boss > 0)) this.gloom(t, dt);
    // the fisher... the catcher: a kid with a vacuum, on the left, standing on the near ground
    this.cheer = Math.max(0, this.cheer - dt);
    const kid = img(this.cheer > 0 && img("kid_cheer") ? "kid_cheer" : f.beam ? "kid_vac_suck" : "kid_vac");
    // the kid stands where they walked to: smaller further back, bobbing with each stride
    const gy = f.farY + (f.nearY - f.farY) * f.kid.d, kk = depthK(f, gy);
    const moving = Math.abs(f.kid.walk - this.lastWalk) > 0.2;
    this.stride = moving ? this.stride + dt : 0;
    if (moving && Math.random() < dt * 8) this.dust(f.left + f.kid.x + 40 * kk, gy + 2);
    this.lastWalk = f.kid.walk;
    const step = moving ? Math.abs(Math.sin(f.kid.walk * 0.09)) * 5 : 0;
    const grow = 1 + Math.min(0.3, this.vac * 0.01);
    const kw = 118 * kk * grow, kh = kid ? (kw * kid.height) / kid.width : 130 * kk;
    const kx = f.left + f.kid.x, ky = gy + 6 * kk - kh - step + Math.sin(t * 2.4) * 1.5;
    const face = f.kid.face;
    f.nozzle.x = face > 0 ? kx + kw * (f.beam ? 0.97 : 0.95) : kx + kw * (f.beam ? 0.03 : 0.05); f.nozzle.y = ky + kh * (f.beam ? 0.5 : 0.52);
    // critters far to near, so near ones overlap far ones; the kid takes their place in that order
    const list = [...f.critters].sort((a, b) => a.y - b.y);
    for (const cr of list) this.shadow(f, cr);
    if (f.beam) this.cone(f, up, t);
    const drawKid = () => {
      c.fillStyle = "rgba(0,40,30,0.18)"; c.beginPath(); c.ellipse(kx + kw * 0.45, gy + 4, kw * 0.32, 6 * kk, 0, 0, Math.PI * 2); c.fill();
      if (kid) this.drawKidBody(kid, kx + kw / 2, gy, kw, kh, ky - gy, face, f.kid.walk, moving, dt, f.beam);
    };
    let kidDone = false;
    for (const cr of list) {
      if (!kidDone && cr.y > gy) { drawKid(); kidDone = true; }
      this.critter(f, cr, t);
    }
    if (!kidDone) drawKid();
    // bubbles flying from the wand
    for (const b of f.bubbles) this.bubble(b.x, b.y, 12, t);
    // the flute: notes drifting out over the meadow
    if (f.tool === "flute" && this.fluting) {
      for (let i = 0; i < 6; i++) {
        const p = (t * 0.7 + i / 6) % 1;
        c.globalAlpha = 1 - p; c.font = "bold 20px system-ui"; c.textAlign = "center";
        c.fillText(i % 2 ? "🎵" : "🎶", f.nozzle.x + p * 260, f.nozzle.y - 20 - Math.sin(p * 8 + i) * 18 - p * 40);
      }
      c.globalAlpha = 1;
    }
    // the companion trots beside the kid
    if (f.companion) {
      const im = img(f.companion);
      if (im) {
        const w = 52, h = (w * im.height) / im.width, hop = Math.abs(Math.sin(t * 4)) * 6;
        // it trots a step behind the kid, on the near side
        const px = Math.max(f.left + 30, kx - 26), py = Math.min(f.nearY + 8, gy + 18);
        c.fillStyle = "rgba(0,40,20,0.2)"; c.beginPath(); c.ellipse(px, py - 2, 20, 5, 0, 0, Math.PI * 2); c.fill();
        c.drawImage(im, px - w / 2, py - h - hop, w, h);
        blink(c, f.companion, px - w / 2, py - h - hop, w, h, t, 77);
      }
    }
    this.particles(dt);
    this.foreground(f, t);
  }
  zoom = 1;
  /** set by the controller for the giant's finale (0 = normal) */
  zoomTarget = 0;
  private faceAnim = 1;
  private swing = 0;
  /** the kid as a little puppet: the picture is cut at the hips, the legs swing in turn, the body bobs and leans,
   *  and turning around squeezes through a thin side view like a real turn. */
  private drawKidBody(im: HTMLImageElement, cx: number, gy: number, kw: number, kh: number, top: number, face: number, walk: number, moving: boolean, dt: number, sucking: boolean) {
    const c = this.c;
    this.faceAnim += (face - this.faceAnim) * Math.min(1, dt * 9);
    const sx = Math.sign(this.faceAnim || 1) * Math.max(0.12, Math.abs(this.faceAnim));
    const ph = walk * 0.075;
    this.swing += ((moving ? Math.sin(ph) : 0) - this.swing) * Math.min(1, dt * 12);
    const sw = this.swing;
    // one whole picture: a small hop on every step, a squash when the foot lands, a gentle sway
    const step = Math.abs(Math.sin(ph));
    const bob = moving ? -step * kh * 0.035 : 0;
    const squash = moving ? 1 + (step - 0.6) * 0.05 : 1;
    const tilt = moving ? sw * 0.05 : sucking ? -0.04 : 0;
    c.save();
    c.translate(cx, gy + bob);
    c.scale(sx, 1);
    c.rotate(tilt);
    c.scale(1 / squash, squash);
    c.drawImage(im, -kw / 2, top, kw, kh);
    c.restore();
  }
  private lastField: Field | null = null;
  /** the vacuum level: the kid and the vacuum grow a little with it */
  vac = 0;
  private lastWalk = 0;
  private stride = 0;
  private dust(x: number, y: number) {
    this.parts.push({ x, y, vx: -20 - Math.random() * 30, vy: -10 - Math.random() * 20, life: 0, max: 0.5, col: "rgba(230,215,180,0.8)", size: 3 + Math.random() * 3 });
  }
  /** grass right in front of the camera, drifting faster than the field: depth without extra art */
  private foreground(f: Field, t: number) {
    const c = this.c, shift = -f.kid.x * 0.55;
    const col = f.biome === "frost" ? ["#cfe6f7", "#a9c9e6"] : f.biome === "forest" ? ["#1f5a46", "#2d7a5c"] : ["#3f8f33", "#5fb44a"];
    const base = this.H + 6;
    for (let i = -2; i < this.W / 46 + 3; i++) {
      const x = ((i * 46 + shift) % (46 * 40)) + ((i * 37) % 13), hgt = 22 + ((i * 53) % 17), sway = Math.sin(t * 1.3 + i) * 3;
      c.fillStyle = col[i & 1];
      c.beginPath();
      c.moveTo(x - 14, base);
      c.quadraticCurveTo(x - 8 + sway, base - hgt * 0.6, x - 4 + sway * 1.5, base - hgt);
      c.quadraticCurveTo(x, base - hgt * 0.5, x + 2, base - hgt * 0.75 + sway);
      c.quadraticCurveTo(x + 6, base - hgt * 0.4, x + 12 + sway, base - hgt * 0.85);
      c.quadraticCurveTo(x + 10, base - hgt * 0.3, x + 16, base);
      c.fill();
    }
  }

  private shadow(f: Field, cr: Critter) {
    const k = depthK(f, cr.y), s = cr.def.size * k * cr.scale;
    const fade = Math.max(0.25, 1 - cr.lift / 80);
    this.c.fillStyle = `rgba(0,40,20,${0.22 * fade})`;
    this.c.beginPath(); this.c.ellipse(cr.x, cr.y, s * 0.45 * fade, s * 0.12 * fade, 0, 0, Math.PI * 2); this.c.fill();
  }

  private critter(f: Field, cr: Critter, t: number) {
    const c = this.c, k = depthK(f, cr.y);
    let s = cr.def.size * k * cr.scale * Math.min(1, (f.t - cr.born) / 0.25 + 0.2);
    // burrowed: only a little mound of earth, wiggling
    if (cr.hidden && cr.def.behave === "burrow") {
      c.fillStyle = "#8a5a32"; c.strokeStyle = "#0d1e45"; c.lineWidth = 2.5;
      c.beginPath(); c.ellipse(cr.x + Math.sin(t * 14 + cr.uid) * 1.5, cr.y - 4, s * 0.38, s * 0.16, 0, Math.PI, 0); c.fill(); c.stroke();
      c.fillStyle = "#a8774a"; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(cr.x - s * 0.2 + i * s * 0.2, cr.y - 6 - (i % 2) * 3, 2.5, 0, Math.PI * 2); c.fill(); }
      return;
    }
    const sp = tinted(cr.def.art, cr.mut);
    const bx = cr.x, by = cr.y - cr.lift - s * 0.5;
    c.save();
    c.translate(bx, by);
    // rare and mutated ones glow softly
    if (cr.def.rarity !== "common" || cr.mut) {
      const col = cr.mut === "gold" ? "255,210,80" : cr.mut === "rainbow" ? "200,160,255" : hex(RARITY_COLOR[cr.def.rarity]);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, s);
      g.addColorStop(0, `rgba(${col},${0.35 + 0.1 * Math.sin(t * 4 + cr.uid)})`); g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, s, 0, Math.PI * 2); c.fill();
    }
    let sx = 1, sy = 1, rot = 0;
    if (cr.state === "pulled" || cr.state === "tug") {
      // stretched toward the nozzle, shrinking as it is sucked in
      const dx = f.nozzle.x - bx, dy = f.nozzle.y - by, d = Math.hypot(dx, dy);
      rot = Math.atan2(dy, dx);
      const str = cr.state === "pulled" ? Math.min(0.55, 0.15 + cr.pullT * 0.8) : 0.12 + 0.06 * Math.sin(t * 20);
      sx = 1 + str; sy = 1 - str * 0.6;
      if (cr.state === "pulled") s *= Math.max(0.25, Math.min(1, d / 70));
      if (cr.state === "tug") c.translate(Math.sin(t * 40) * 2, 0);
    } else {
      // squash on landing, stretch on take-off
      const ph = cr.hopT % 1;
      const land = ph > 0.45 && ph < 0.6 ? Math.sin(((ph - 0.45) / 0.15) * Math.PI) : 0;
      const air = ph < 0.45 ? Math.sin((ph / 0.45) * Math.PI) : 0;
      sx = 1 + land * 0.18 - air * 0.06; sy = 1 - land * 0.16 + air * 0.08;
    }
    // tucked in its shell: squashed small and still, a shiny shell bubble around it
    if (cr.hidden) { sx *= 0.75; sy *= 0.6; }
    c.rotate(rot);
    c.scale(sx, sy);
    c.rotate(-rot);
    const face = cr.state === "roam" ? cr.dir : -1;
    c.scale(face < 0 ? -1 : 1, 1);
    if (sp) {
      const w0 = (sp as HTMLImageElement).width, h0 = (sp as HTMLImageElement).height, w = s * 1.15, h = (w * h0) / w0;
      c.drawImage(sp, -w / 2, -h / 2, w, h);
      if (cr.state === "roam") blink(c, cr.def.art, -w / 2, -h / 2, w, h, t, cr.uid);
      else if (cr.state === "tug") blink(c, cr.def.art, -w / 2, -h / 2, w, h, t, cr.uid, 0.55); // squinting with effort
    } else { c.fillStyle = cr.def.color; c.beginPath(); c.arc(0, 0, s / 2, 0, Math.PI * 2); c.fill(); }
    c.restore();
    if (cr.hidden && cr.def.behave === "shell") {
      const g = c.createRadialGradient(bx - s * 0.2, by - s * 0.25, 2, bx, by, s * 0.55);
      g.addColorStop(0, "rgba(255,255,255,0.7)"); g.addColorStop(0.6, "rgba(200,180,255,0.35)"); g.addColorStop(1, "rgba(150,120,220,0.55)");
      c.fillStyle = g; c.strokeStyle = "#0d1e45"; c.lineWidth = 2.5;
      c.beginPath(); c.arc(bx, by + s * 0.05, s * 0.5, 0, Math.PI * 2); c.fill(); c.stroke();
      c.font = "14px system-ui"; c.textAlign = "center"; c.fillText("💤", bx + s * 0.4, by - s * 0.45);
    }
    if (cr.bubbled > 0) this.bubble(bx, by, s * 0.62 + Math.sin(t * 5 + cr.uid) * 2, t);
    if (cr.frozen > 0) {
      c.save(); c.globalAlpha = 0.45; c.fillStyle = "#bfefff"; c.strokeStyle = "#ffffff"; c.lineWidth = 2;
      c.beginPath(); c.roundRect(bx - s * 0.45, by - s * 0.45, s * 0.9, s * 0.9, 8); c.fill(); c.stroke(); c.restore();
      c.font = "14px system-ui"; c.textAlign = "center"; c.fillText("❄️", bx + s * 0.35, by - s * 0.4);
    }
    if (cr.fleeT > 0) { c.font = "bold 18px system-ui"; c.textAlign = "center"; c.fillText("❗", bx, by - s * 0.7 - Math.abs(Math.sin(t * 14)) * 4); }
    if (cr.boss > 0) {
      // the boss: a crown and its remaining phases
      c.font = `${Math.round(s * 0.38)}px system-ui`; c.textAlign = "center"; c.fillText("👑", bx, by - s * 0.62 + Math.sin(t * 3) * 2);
      for (let i = 0; i < 3; i++) { c.fillStyle = i < cr.boss ? "#ff4d6d" : "rgba(13,30,69,0.5)"; c.strokeStyle = "#0d1e45"; c.lineWidth = 2; c.beginPath(); c.arc(bx - 16 + i * 16, by + s * 0.55, 6, 0, Math.PI * 2); c.fill(); c.stroke(); }
    }
    // tug: a ring above it fills while the cone holds it
    if (cr.state === "tug") {
      const ry = by - s * 0.75;
      c.lineWidth = 6; c.lineCap = "round";
      c.strokeStyle = "rgba(13,30,69,0.6)"; c.beginPath(); c.arc(bx, ry, 15, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = cr.grip > 0.66 ? "#7cf29a" : "#ffe066";
      c.beginPath(); c.arc(bx, ry, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cr.grip); c.stroke();
      c.font = "bold 13px Fredoka, system-ui"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#fff"; c.fillText("💪", bx, ry + 1);
    }
  }

  /** the place's giant, far away on the horizon: asleep (breathing, Zzz) while the vacuum is too weak,
   *  awake and bouncing with a "!" once it is strong enough. Set by the controller; null when there is none to show. */
  giant: { art: string; ready: boolean } | null = null;
  private gloom(t: number, _dt: number) {
    const g = this.giant, f = this.lastField;
    if (!g || !f) return;
    const im = img(g.art);
    if (!im) return;
    const c = this.c;
    const h = Math.min(this.H * 0.27, 230), w = (h * im.width) / im.height;
    const x = Math.min(f.right, this.W) - w * 0.6, base = f.farY - 18;
    const breathe = g.ready ? 1 + Math.abs(Math.sin(t * 5)) * 0.06 : 1 + Math.sin(t * 1.3) * 0.025;
    const hop = g.ready ? Math.abs(Math.sin(t * 5)) * 14 : 0;
    c.save();
    // far away: a little hazy and blue, sitting behind the hills
    c.globalAlpha = g.ready ? 0.95 : 0.78;
    c.filter = g.ready ? "none" : "saturate(.5) brightness(1.05) blur(.6px)";
    c.translate(x, base - hop);
    c.scale(1 / breathe * (g.ready ? 1 : 1), breathe);
    c.drawImage(im, -w / 2, -h, w, h);
    c.restore();
    c.filter = "none";
    c.save();
    c.textAlign = "center"; c.font = "bold 26px Fredoka, system-ui";
    if (g.ready) {
      c.fillStyle = "#ff4d6d"; c.strokeStyle = "#fff"; c.lineWidth = 5;
      const y = base - h - 18 - hop + Math.sin(t * 8) * 4;
      c.strokeText("❗", x, y); c.fillText("❗", x, y);
    } else {
      // sleeping: Z's drifting up
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.35 + i / 3) % 1;
        c.globalAlpha = Math.sin(p * Math.PI);
        c.fillStyle = "#ffffff"; c.font = `bold ${16 + p * 14}px Fredoka, system-ui`;
        c.fillText("Z", x + w * 0.22 + p * 30, base - h * 0.8 - p * 60);
      }
    }
    c.restore();
  }


  /** a soap bubble: rainbow sheen and a highlight */
  private bubble(x: number, y: number, r: number, t: number) {
    const c = this.c;
    const g = c.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.75)"); g.addColorStop(0.55, "rgba(190,230,255,0.18)"); g.addColorStop(1, `hsla(${(t * 90) % 360},90%,75%,0.55)`);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.8)"; c.lineWidth = 1.5; c.stroke();
  }
  /** true while the flute is being played (set by the controller) */
  fluting = false;

  private cone(f: Field, up: Upgrades, t: number) {
    const c = this.c, R = range(up), ang = Math.atan2(f.aim.y - f.nozzle.y, f.aim.x - f.nozzle.x);
    c.save(); c.translate(f.nozzle.x, f.nozzle.y); c.rotate(ang);
    const g = c.createLinearGradient(0, 0, R, 0);
    g.addColorStop(0, "rgba(190,240,255,0.55)"); g.addColorStop(1, "rgba(190,240,255,0)");
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, -CONE, CONE); c.closePath(); c.fill();
    // wind streaks rushing into the nozzle
    c.strokeStyle = "rgba(255,255,255,0.8)"; c.lineWidth = 2.5; c.lineCap = "round";
    for (let i = 0; i < 14; i++) {
      const p = 1 - ((t * 1.8 + i * 0.37) % 1), r = 14 + p * (R - 14), a = (((i * 0.61) % 1) - 0.5) * 2 * CONE * 0.9 * (r / R);
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      c.globalAlpha = Math.min(1, p * 1.5) * 0.8;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - Math.cos(a) * 16, y - Math.sin(a) * 16); c.stroke();
    }
    c.restore();
  }

  burst(x: number, y: number, col: string, n = 14, sp = 160) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = sp * (0.4 + Math.random() * 0.6); this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0, max: 0.6 + Math.random() * 0.3, col, size: 3 + Math.random() * 3 }); }
  }
  text(x: number, y: number, text: string, col: string, size = 18) {
    // keep the whole label on screen, whatever the language
    this.c.font = `bold ${size}px Fredoka, system-ui`;
    const half = this.c.measureText(text).width / 2 + 6;
    x = Math.max(half, Math.min(this.W - half, x));
    this.parts.push({ x, y, vx: 0, vy: -46, life: 0, max: 1.2, col, size, text });
  }

  private particles(dt: number) {
    const c = this.c;
    for (const p of this.parts) {
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (!p.text) p.vy += 300 * dt;
      const a = Math.max(0, 1 - p.life / p.max);
      c.globalAlpha = a;
      if (p.text) {
        c.font = `bold ${p.size}px Fredoka, system-ui`; c.textAlign = "center"; c.lineWidth = 4; c.strokeStyle = "#0d1e45";
        c.strokeText(p.text, p.x, p.y); c.fillStyle = p.col; c.fillText(p.text, p.x, p.y);
      } else { c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2); c.fill(); }
    }
    c.globalAlpha = 1;
    this.parts = this.parts.filter((p) => p.life < p.max);
    this.shake = Math.max(0, this.shake - dt * 30);
  }

  /** pedestal positions for one place's page of the park: a 3-wide grid filling the lawn */
  /** room the park ui takes at the bottom (set by the controller) */
  parkBottom = 270;
  /** room the park ui takes on the right (landscape phones put it in a side column) */
  parkRight = 0;
  parkSlots(biome: BiomeId) {
    const wide = this.W > 640;
    const list = critterOf(biome), cols = wide ? 6 : 3, rows = Math.ceil(list.length / cols);
    const area = this.W - this.parkRight;
    const top = this.parkRight ? 70 : 112, bottom = this.H - this.parkBottom, gw = Math.min(area - 20, wide ? 760 : 420);
    return list.map((d, i) => ({ def: d, x: (area - gw) / 2 + gw * ((i % cols) + 0.5) / cols, y: top + (bottom - top) * (Math.floor(i / cols) + 0.75) / rows }));
  }

  /** critters flying out of the jar to their pedestals */
  fliers: { art: string; x0: number; y0: number; x1: number; y1: number; t: number }[] = [];
  fly(art: string, x0: number, y0: number, x1: number, y1: number, delay: number) { this.fliers.push({ art, x0, y0, x1, y1, t: -delay }); }

  drawPark(_save: SaveData, _biome: BiomeId, _t: number, dt: number) {
    // the park is a calm backdrop; the collection itself is a tidy card grid in the page
    this.begin();
    this.cover("bg_park");
    const c = this.c;
    c.fillStyle = "rgba(13,30,69,0.35)"; c.fillRect(0, 0, this.W, this.H);
    this.particles(dt);
  }

}

/** eyelids: blink now and then on each critter's own rhythm (eyes found by tools/art/eyes.py) */
function blink(c: Ctx, name: string, x: number, y: number, w: number, h: number, t: number, seed: number, force = -1) {
  const eyes = EYES[name];
  if (!eyes) return;
  let k = force;
  if (k < 0) {
    const per = 2.4 + (Math.abs(seed * 7919) % 23) / 10, ph = (t + (seed % 97) * 0.61) % per;
    k = ph < 0.16 ? Math.sin((ph / 0.16) * Math.PI) : 0;
  }
  if (k < 0.05) return;
  for (const [ex, ey, rx, ry, col] of eyes) {
    const cx = x + ex * w, cy = y + ey * h, ax = rx * w, ay = ry * h;
    c.save();
    c.beginPath(); c.ellipse(cx, cy, ax, ay, 0, 0, Math.PI * 2); c.clip();
    const up = cy - ay + ay * 1.15 * k;
    c.fillStyle = col;
    c.beginPath(); c.moveTo(cx - ax, cy - ay - 2); c.lineTo(cx + ax, cy - ay - 2); c.lineTo(cx + ax, up); c.quadraticCurveTo(cx, up + ay * 0.45 * k, cx - ax, up); c.closePath(); c.fill();
    c.strokeStyle = "rgba(25,22,45,0.9)"; c.lineWidth = Math.max(1.2, ax * 0.22); c.lineCap = "round";
    c.beginPath(); c.moveTo(cx - ax * 0.9, up); c.quadraticCurveTo(cx, up + ay * 0.45 * k, cx + ax * 0.9, up); c.stroke();
    c.restore();
  }
}

const hex = (h: string) => `${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)}`;
