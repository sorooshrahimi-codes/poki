import type { ZoneId } from "../core/types.ts";
import { makeRng } from "../core/rng.ts";
import { SPOTS, type SpotDef } from "../data/spots.ts";
import { img } from "../render/assets.ts";

// The world map: a big hand-drawn-looking sea you can drag around. Islands, an inland lake, ice floes,
// a coral atoll and a volcano are drawn in code (no image to download). Spots are pins on a winding
// dotted route; places you have not opened yet sleep under clouds.

export const MAP_W = 1600, MAP_H = 1100;
type Ctx = CanvasRenderingContext2D;

export interface MapState {
  owned: (z: ZoneId) => boolean;
  /** this spot is open (its place is owned and enough kinds are caught) */
  spotOpen: (s: SpotDef) => boolean;
  current: string;
  boat: string;
  regionLabel: (z: ZoneId) => string;
}

const REGION: Record<ZoneId, { c: [number, number]; r: number }> = {
  lake: { c: [330, 800], r: 270 },
  ocean: { c: [760, 640], r: 230 },
  ice: { c: [270, 230], r: 250 },
  reef: { c: [1330, 790], r: 250 },
  volcano: { c: [1250, 290], r: 230 },
};
export const regionAt = (x: number, y: number): ZoneId | null => {
  for (const z of ["lake", "ice", "reef", "volcano", "ocean"] as ZoneId[]) {
    const g = REGION[z];
    if (Math.hypot(x - g.c[0], y - g.c[1]) < g.r) return z;
  }
  return null;
};

/** the route: spots in order inside each place, and the bridges between places */
const ROUTE: [string, string][] = [
  ["lily_pond", "old_mill"], ["old_mill", "misty_falls"], ["old_mill", "sunny_bay"],
  ["sunny_bay", "shipwreck"], ["shipwreck", "blue_deep"],
  ["blue_deep", "igloo_cove"], ["igloo_cove", "glacier_gate"], ["glacier_gate", "aurora_rift"],
  ["shipwreck", "turtle_lagoon"], ["turtle_lagoon", "coral_garden"], ["coral_garden", "manta_wall"],
  ["blue_deep", "ash_beach"], ["ash_beach", "obsidian_cove"], ["obsidian_cove", "fire_heart"],
];
const SPOT = Object.fromEntries(SPOTS.map((s) => [s.id, s]));
const LABEL_AT: Record<ZoneId, [number, number]> = { lake: [330, 1000], ocean: [600, 560], ice: [250, 470], reef: [1330, 1040], volcano: [1250, 525] };
const ICON: Record<ZoneId, string> = { lake: "🌿", ocean: "🐚", ice: "❄️", reef: "🪸", volcano: "🔥" };

/** a wobbly closed blob around a centre: the base shape of every island */
function blob(c: Ctx, cx: number, cy: number, r: number, seed: number, rough = 0.18, sx = 1, sy = 1) {
  const rng = makeRng(seed);
  const k = [rng() * 6, rng() * 6, rng() * 6];
  c.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const rr = r * (1 + rough * (Math.sin(a * 3 + k[0]) * 0.5 + Math.sin(a * 5 + k[1]) * 0.3 + Math.sin(a * 9 + k[2]) * 0.2));
    const x = cx + Math.cos(a) * rr * sx, y = cy + Math.sin(a) * rr * sy;
    if (i) c.lineTo(x, y); else c.moveTo(x, y);
  }
  c.closePath();
}

function island(c: Ctx, cx: number, cy: number, r: number, seed: number, land: [string, string], sand = "#f3dc9a", sx = 1, sy = 1) {
  // shallow-water halo, sand, land, outline, glossy rim
  c.fillStyle = "rgba(160,240,255,0.45)"; blob(c, cx, cy, r * 1.22, seed, 0.18, sx, sy); c.fill();
  c.fillStyle = sand; blob(c, cx, cy, r * 1.08, seed, 0.18, sx, sy); c.fill();
  c.lineWidth = 6; c.strokeStyle = "#16345e"; c.stroke();
  const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, land[0]); g.addColorStop(1, land[1]);
  c.fillStyle = g; blob(c, cx, cy, r * 0.94, seed + 1, 0.16, sx, sy); c.fill();
  c.lineWidth = 3; c.strokeStyle = "rgba(22,52,94,0.55)"; c.stroke();
}

function tree(c: Ctx, x: number, y: number, s: number, col = "#3fae4a") {
  c.fillStyle = "#7a4a2a"; c.fillRect(x - s * 0.12, y, s * 0.24, s * 0.5);
  c.fillStyle = col; c.strokeStyle = "#16345e"; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.6, y + s * 0.15); c.lineTo(x - s * 0.6, y + s * 0.15); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = "rgba(255,255,255,0.35)"; c.beginPath(); c.moveTo(x - s * 0.1, y - s * 0.7); c.lineTo(x - s * 0.35, y - s * 0.05); c.lineTo(x - s * 0.18, y - s * 0.05); c.closePath(); c.fill();
}

function palm(c: Ctx, x: number, y: number, s: number) {
  c.strokeStyle = "#8a5a32"; c.lineWidth = s * 0.14; c.lineCap = "round";
  c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + s * 0.2, y - s * 0.5, x + s * 0.05, y - s); c.stroke();
  c.fillStyle = "#3fbf5a"; c.strokeStyle = "#16345e"; c.lineWidth = 2;
  for (const a of [-2.6, -1.9, -1.2, -0.5]) {
    c.beginPath(); c.ellipse(x + s * 0.05 + Math.cos(a) * s * 0.35, y - s + Math.sin(a) * s * 0.18, s * 0.38, s * 0.12, a, 0, Math.PI * 2); c.fill(); c.stroke();
  }
}

/** everything that never moves, drawn once into an offscreen canvas */
function drawStatic(c: Ctx) {
  // the sea: lighter in the middle, each place tints its water
  const sea = c.createRadialGradient(MAP_W / 2, MAP_H / 2, 100, MAP_W / 2, MAP_H / 2, MAP_W * 0.7);
  sea.addColorStop(0, "#3fb6e8"); sea.addColorStop(1, "#1a5fa8");
  c.fillStyle = sea; c.fillRect(0, 0, MAP_W, MAP_H);
  const tint = (z: ZoneId, col: string) => {
    const g = REGION[z], gr = c.createRadialGradient(g.c[0], g.c[1], 20, g.c[0], g.c[1], g.r * 1.3);
    gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = gr; c.fillRect(g.c[0] - g.r * 1.4, g.c[1] - g.r * 1.4, g.r * 2.8, g.r * 2.8);
  };
  tint("ice", "rgba(210,245,255,0.55)"); tint("reef", "rgba(90,240,220,0.5)"); tint("volcano", "rgba(120,40,60,0.45)");
  // little wave marks
  const rng = makeRng(7);
  c.strokeStyle = "rgba(255,255,255,0.25)"; c.lineWidth = 3; c.lineCap = "round";
  for (let i = 0; i < 90; i++) {
    const x = rng() * MAP_W, y = rng() * MAP_H;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 9, y - 6, x + 18, y); c.quadraticCurveTo(x + 27, y + 6, x + 36, y); c.stroke();
  }

  // LAKE: a green island with a lake inside, forest round it
  island(c, 330, 800, 250, 11, ["#7fd86a", "#3e9a45"]);
  c.fillStyle = "#4fc3ef"; blob(c, 330, 795, 150, 12, 0.14); c.fill(); c.lineWidth = 4; c.strokeStyle = "#16345e"; c.stroke();
  c.fillStyle = "rgba(255,255,255,0.25)"; blob(c, 300, 760, 70, 13, 0.2); c.fill();
  const tr = makeRng(14);
  for (let i = 0; i < 26; i++) {
    const a = tr() * Math.PI * 2, d = 175 + tr() * 50;
    tree(c, 330 + Math.cos(a) * d * 1.02, 800 + Math.sin(a) * d * 0.95, 20 + tr() * 10, tr() < 0.3 ? "#2f9a52" : "#46b54e");
  }
  // the old mill: a little house with a wheel
  c.fillStyle = "#d9884a"; c.strokeStyle = "#16345e"; c.lineWidth = 3;
  c.fillRect(450, 760, 40, 34); c.strokeRect(450, 760, 40, 34);
  c.fillStyle = "#b8483a"; c.beginPath(); c.moveTo(444, 762); c.lineTo(470, 738); c.lineTo(496, 762); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = "#8a5a32"; c.beginPath(); c.arc(446, 790, 15, 0, Math.PI * 2); c.fill(); c.stroke();
  // the falls: white streaks from the hills
  c.fillStyle = "#8c9aa8"; c.beginPath(); c.moveTo(260, 640); c.lineTo(300, 600); c.lineTo(345, 640); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = "rgba(255,255,255,0.9)"; c.fillRect(296, 632, 10, 42);

  // OCEAN: open sea with a palm islet and a wreck
  island(c, 905, 780, 48, 21, ["#7fd86a", "#3e9a45"]);
  palm(c, 900, 780, 60);
  c.strokeStyle = "#5a3a22"; c.lineWidth = 6; c.beginPath(); c.moveTo(800, 660); c.lineTo(830, 600); c.stroke();
  c.fillStyle = "#6a4a2a"; c.beginPath(); c.ellipse(820, 664, 40, 12, -0.2, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#f0f0e0"; c.beginPath(); c.moveTo(830, 602); c.lineTo(858, 628); c.lineTo(826, 630); c.closePath(); c.fill();

  // FROZEN NORTH: ice floes on a cold sea, an igloo
  const fr = makeRng(31);
  const floes: [number, number, number][] = [[260, 200, 120], [120, 300, 70], [420, 180, 80], [350, 380, 55], [90, 120, 60], [200, 60, 70], [520, 300, 45]];
  for (const [x, y, r] of floes) island(c, x, y, r, Math.floor(fr() * 999), ["#ffffff", "#cdeeff"], "#e8f8ff", 1.15, 0.85);
  c.fillStyle = "#ffffff"; c.strokeStyle = "#16345e"; c.lineWidth = 3;
  c.beginPath(); c.arc(300, 205, 30, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = "#16345e"; c.beginPath(); c.arc(300, 205, 10, Math.PI, 0); c.fill();
  for (const [x, y] of [[480, 420], [60, 420], [560, 160]]) {
    c.fillStyle = "#e6f8ff"; c.beginPath(); c.moveTo(x - 22, y); c.lineTo(x, y - 34); c.lineTo(x + 22, y); c.closePath(); c.fill(); c.stroke();
  }

  // CORAL REEF: an atoll ring with a turquoise lagoon and coral dots
  island(c, 1330, 790, 200, 41, ["#f6e2a8", "#e9cc82"], "#f9ecc0");
  c.fillStyle = "#62e6e0"; blob(c, 1320, 795, 135, 42, 0.12); c.fill(); c.lineWidth = 4; c.strokeStyle = "#16345e"; c.stroke();
  const cr = makeRng(43);
  for (let i = 0; i < 26; i++) {
    const a = cr() * Math.PI * 2, d = cr() * 115;
    c.fillStyle = ["#ff7a9a", "#ffb04a", "#b07aff", "#ff5a6a"][i % 4];
    c.beginPath(); c.arc(1320 + Math.cos(a) * d, 795 + Math.sin(a) * d * 0.9, 6 + cr() * 7, 0, Math.PI * 2); c.fill();
  }
  palm(c, 1190, 660, 46); palm(c, 1470, 900, 46);

  // VOLCANO: dark rock island with a smoking cone and a lava crater
  island(c, 1250, 290, 175, 51, ["#7a6068", "#3d2a33"], "#5a4a48");
  c.fillStyle = "#5a3e44"; c.strokeStyle = "#16345e"; c.lineWidth = 5;
  c.beginPath(); c.moveTo(1150, 330); c.lineTo(1220, 210); c.lineTo(1285, 210); c.lineTo(1355, 330); c.closePath(); c.fill(); c.stroke();
  const lava = c.createRadialGradient(1252, 214, 4, 1252, 214, 40);
  lava.addColorStop(0, "#fff2a0"); lava.addColorStop(0.5, "#ff8a2a"); lava.addColorStop(1, "rgba(255,60,20,0)");
  c.fillStyle = lava; c.beginPath(); c.ellipse(1252, 212, 40, 16, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "#ff7a2a"; c.lineWidth = 6; c.lineCap = "round";
  c.beginPath(); c.moveTo(1240, 222); c.quadraticCurveTo(1225, 270, 1200, 320); c.stroke();
  c.beginPath(); c.moveTo(1268, 222); c.quadraticCurveTo(1290, 280, 1310, 318); c.stroke();
}

export class WorldMap {
  private c: Ctx;
  private stat: HTMLCanvasElement | null = null;
  private statScale = 0;
  private scale = 1;
  /** world point at the screen centre */
  private cx = MAP_W / 2;
  private cy = MAP_H / 2;
  private raf = 0;
  private t = 0;
  selected: string | null = null;
  private drag: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;

  private canvas: HTMLCanvasElement;
  private state: () => MapState;
  private onSelect: (spot: SpotDef | null, zone: ZoneId | null) => void;

  constructor(canvas: HTMLCanvasElement, state: () => MapState, onSelect: (spot: SpotDef | null, zone: ZoneId | null) => void) {
    this.canvas = canvas; this.state = state; this.onSelect = onSelect;
    this.c = canvas.getContext("2d")!;
    canvas.addEventListener("pointerdown", (e) => {
      canvas.setPointerCapture(e.pointerId);
      this.drag = { x: e.clientX, y: e.clientY, cx: this.cx, cy: this.cy, moved: false };
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 8) this.drag.moved = true;
      if (this.drag.moved) { this.cx = this.drag.cx - dx / this.scale; this.cy = this.drag.cy - dy / this.scale; this.clamp(); }
    });
    canvas.addEventListener("pointerup", (e) => {
      const d = this.drag; this.drag = null;
      if (!d || d.moved) return;
      const r = canvas.getBoundingClientRect();
      this.tap(this.cx + (e.clientX - r.left - r.width / 2) / this.scale, this.cy + (e.clientY - r.top - r.height / 2) / this.scale);
    });
  }

  open() {
    const cur = SPOTS.find((s) => s.id === this.state().current);
    if (cur) { this.cx = cur.at[0]; this.cy = cur.at[1]; }
    this.selected = cur?.id ?? null;
    this.resize();
    cancelAnimationFrame(this.raf);
    let last = performance.now();
    const loop = (now: number) => {
      this.t += Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
      if (this.canvas.clientWidth && (this.canvas.width !== Math.round(this.canvas.clientWidth * devicePixelRatio))) this.resize();
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    if (cur) this.onSelect(cur, cur.zone);
  }
  close() { cancelAnimationFrame(this.raf); }

  private resize() {
    const w = this.canvas.clientWidth || 300, h = this.canvas.clientHeight || 300, dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    // the map is always bigger than the screen: there is something to explore
    this.scale = Math.max(w / MAP_W, h / MAP_H) * (w > h ? 1.25 : 1.12);
    const q = Math.min(1.6, this.scale * dpr);
    if (!this.stat || Math.abs(q - this.statScale) > 0.05) {
      this.stat = document.createElement("canvas");
      this.stat.width = Math.ceil(MAP_W * q); this.stat.height = Math.ceil(MAP_H * q);
      const sc = this.stat.getContext("2d")!; sc.scale(q, q); drawStatic(sc);
      this.statScale = q;
    }
    this.clamp();
  }

  private clamp() {
    const w = this.canvas.clientWidth / this.scale / 2, h = this.canvas.clientHeight / this.scale / 2;
    this.cx = Math.max(w, Math.min(MAP_W - w, this.cx));
    this.cy = Math.max(h, Math.min(MAP_H - h, this.cy));
  }

  private tap(x: number, y: number) {
    let best: SpotDef | null = null, bd = 60;
    for (const s of SPOTS) { const d = Math.hypot(s.at[0] - x, s.at[1] - y); if (d < bd) { bd = d; best = s; } }
    if (best) { this.selected = best.id; this.onSelect(best, best.zone); return; }
    const z = regionAt(x, y);
    this.selected = null;
    this.onSelect(null, z);
  }

  private draw() {
    const c = this.c, st = this.state(), dpr = this.canvas.width / (this.canvas.clientWidth || 1), t = this.t;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    c.translate(this.canvas.clientWidth / 2, this.canvas.clientHeight / 2);
    c.scale(this.scale, this.scale);
    c.translate(-this.cx, -this.cy);
    if (this.stat) c.drawImage(this.stat, 0, 0, MAP_W, MAP_H);

    // living sea: drifting sparkle lines and a fish leaping now and then
    c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 3; c.lineCap = "round";
    for (let i = 0; i < 18; i++) {
      const x = (i * 211 + t * 12) % MAP_W, y = (i * 137) % MAP_H, k = (Math.sin(t * 1.5 + i) + 1) / 2;
      c.globalAlpha = k * 0.6;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 10, y - 6, x + 20, y); c.stroke();
    }
    c.globalAlpha = 1;
    const jump = (t * 0.4) % 1, ji = Math.floor(t * 0.4) % SPOTS.length, js = SPOTS[(ji * 7) % SPOTS.length];
    if (jump < 0.35) {
      const p = jump / 0.35, fx = js.at[0] + 60 - p * 60, fy = js.at[1] + 50 - Math.sin(p * Math.PI) * 50;
      const fishImg = img(js.attracts[0]);
      if (fishImg) { c.save(); c.translate(fx, fy); c.rotate(-0.8 + p * 1.6); c.scale(-1, 1); c.drawImage(fishImg, -22, -14, 44, (44 * fishImg.height) / fishImg.width); c.restore(); }
    }
    // volcano smoke
    for (let i = 0; i < 5; i++) {
      const p = ((t * 0.25 + i / 5) % 1);
      c.fillStyle = `rgba(90,80,90,${0.5 * (1 - p)})`;
      c.beginPath(); c.arc(1252 + Math.sin(p * 6 + i) * 14, 200 - p * 140, 14 + p * 26, 0, Math.PI * 2); c.fill();
    }

    // the route
    for (const [a, b] of ROUTE) {
      const A = SPOT[a], B = SPOT[b];
      const open = st.spotOpen(A) && st.spotOpen(B);
      const mx = (A.at[0] + B.at[0]) / 2 + (B.at[1] - A.at[1]) * 0.18, my = (A.at[1] + B.at[1]) / 2 - (B.at[0] - A.at[0]) * 0.18;
      c.setLineDash([2, 14]); c.lineCap = "round"; c.lineWidth = 7;
      c.strokeStyle = open ? "#fff3b0" : "rgba(255,255,255,0.45)";
      c.lineDashOffset = open ? -t * 20 : 0;
      c.beginPath(); c.moveTo(A.at[0], A.at[1]); c.quadraticCurveTo(mx, my, B.at[0], B.at[1]); c.stroke();
    }
    c.setLineDash([]);

    // clouds over the places not opened yet
    for (const z of Object.keys(REGION) as ZoneId[]) {
      if (st.owned(z)) continue;
      const g = REGION[z], rng = makeRng(z.length * 97 + g.c[0]);
      for (let i = 0; i < 11; i++) {
        const a = rng() * Math.PI * 2, d = rng() * g.r * 0.75;
        const x = g.c[0] + Math.cos(a) * d + Math.sin(t * 0.3 + i) * 8, y = g.c[1] + Math.sin(a) * d * 0.8;
        const r = 70 + rng() * 60;
        c.fillStyle = "rgba(20,40,80,0.18)"; c.beginPath(); c.arc(x + 8, y + 14, r, 0, Math.PI * 2); c.fill();
        const cg = c.createRadialGradient(x - r * 0.3, y - r * 0.4, 5, x, y, r);
        cg.addColorStop(0, "#ffffff"); cg.addColorStop(1, "#d6e6f5");
        c.fillStyle = cg; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      }
    }

    // spot pins
    for (const s of SPOTS) {
      if (!st.owned(s.zone)) continue;
      const open = st.spotOpen(s), here = s.id === st.current, sel = s.id === this.selected;
      const [x, y] = s.at;
      const bob = Math.sin(t * 3 + x) * 3;
      if (sel) {
        c.strokeStyle = `rgba(255,230,100,${0.5 + 0.5 * Math.sin(t * 5)})`; c.lineWidth = 6;
        c.beginPath(); c.arc(x, y, 46 + Math.sin(t * 5) * 3, 0, Math.PI * 2); c.stroke();
      }
      c.fillStyle = "rgba(10,25,60,0.3)"; c.beginPath(); c.ellipse(x, y + 30, 26, 8, 0, 0, Math.PI * 2); c.fill();
      const pg = c.createRadialGradient(x - 10, y - 12 + bob, 4, x, y + bob, 34);
      pg.addColorStop(0, open ? "#fff3a0" : "#cfd6e2"); pg.addColorStop(1, open ? "#f0a020" : "#7b879c");
      c.fillStyle = pg; c.strokeStyle = "#16345e"; c.lineWidth = 5;
      c.beginPath(); c.arc(x, y + bob, 30, 0, Math.PI * 2); c.fill(); c.stroke();
      c.font = "28px system-ui"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(open ? ICON[s.zone] : "🔒", x, y + bob + 1);
      if (here) {
        const boat = img(st.boat);
        if (boat) { const w = 92, h = (w * boat.height) / boat.width; c.drawImage(boat, x + 18, y - h + 26 + Math.sin(t * 2.4) * 4, w, h); }
      }
    }
    // place names on banners
    for (const z of Object.keys(REGION) as ZoneId[]) {
      const label = st.regionLabel(z), [lx, y] = LABEL_AT[z];
      c.font = "bold 30px 'Baloo 2', system-ui"; c.textAlign = "center"; c.textBaseline = "middle";
      const w = c.measureText(label).width + 40;
      c.fillStyle = "rgba(13,30,69,0.82)"; c.strokeStyle = "#ffe066"; c.lineWidth = 3;
      c.beginPath(); c.roundRect(lx - w / 2, y - 22, w, 44, 22); c.fill(); c.stroke();
      c.fillStyle = "#fff"; c.fillText(label, lx, y + 1);
    }
  }
}
