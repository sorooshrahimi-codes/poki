// GLOWMITES — a two-minute arena: you and six rival swarms on one stone map. Eat the grey, grow, and eat any swarm
// smaller than you (while running from the bigger ones). When the clock runs out, the biggest swarm wins.
import { invert, lookAt, mul, perspective } from "./gl.ts";
import { Governor, TIERS } from "./perf.ts";
import { Post } from "./post.ts";
import { NT, S, Swarm, TEAM_CAP } from "./swarm.ts";
import { SHAPE, WALL, World, wallAt, type Palette } from "./world.ts";
import { City, theme, type Kind } from "./city.ts";
import { poki } from "./poki.ts";
import { Grass } from "./grass.ts";
import { Audio } from "./audio.ts";
import { Terrain } from "./terrain.ts";
import { loadShape, nextShape } from "./shapes.ts";
import { WATER } from "./terrain.ts";

const canvas = document.getElementById("gl") as HTMLCanvasElement;
const hudCanvas = document.getElementById("hud") as HTMLCanvasElement;
const hud = hudCanvas.getContext("2d")!;
const params = new URLSearchParams(location.search);
// test phase: the frame-time chart is on by default (H toggles it); the Poki build will hide it
const showHud = params.get("hud") === "1" || (import.meta.env.MODE === "qa" && params.get("hud") !== "0");
hudCanvas.style.display = showHud ? "block" : "none";

const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: true, powerPreference: "high-performance", preserveDrawingBuffer: false })!;
if (!gl || !gl.getExtension("EXT_color_buffer_float")) {
  document.body.insertAdjacentHTML("beforeend", `<div style="color:#fff;font:20px sans-serif;position:fixed;inset:0;display:flex;align-items:center;justify-content:center">WebGL2 float targets are not available</div>`);
  throw new Error("no float targets");
}
gl.getExtension("EXT_float_blend");

const swarm = new Swarm(gl);
if (import.meta.env.MODE === "qa" && params.has("draw")) swarm.drawCap = Number(params.get("draw")); // QA: draw fewer mites (fast headless runs)
const terrain = new Terrain(gl);
const world = new World(gl, terrain);
const post = new Post(gl);
const gov = new Governor();
const forcedTier = params.get("tier");
if (forcedTier !== null) gov.tier = Number(forcedTier);
const city = new City(gl);
const grass = new Grass(gl);
const audio = new Audio();
const MILESTONES = [1000, 2500, 5000, 10000, 25000, 50000, 100000, 150000, 200000];
let milestone = 0;

// ---------------------------------------------------------------- the five lands the grey has taken
// The grey spread out from a dead volcano at the heart of the world. The swarm brings each land back to life,
// one by one, from the meadow at the edge to the crystal heart. Then the lands come round again, harder.
type Land = { icon: string; amp: number; liquid: number; pal: Palette; snow: boolean; mix: [Kind, number][]; starter: [Kind, number, number]; gap: number; skip: number; giant: number };
const LANDS: Land[] = [
  { icon: "🌼", amp: 3.4, liquid: 0, snow: false, gap: 17, skip: 0.25, giant: 2.4, starter: [6, 0.38, 0.15], mix: [[1, 0.42], [0, 0.33], [3, 0.15], [2, 0.1]],
    pal: { skyLow: [0.20, 0.13, 0.22], skyTop: [0.03, 0.04, 0.10], horizon: [0.55, 0.28, 0.20], stoneA: [0.20, 0.19, 0.23], stoneB: [0.38, 0.36, 0.40], fog: [0.12, 0.08, 0.13], grassA: [0.20, 0.48, 0.16], grassB: [0.42, 0.70, 0.22] } },
  { icon: "🍄", amp: 3.6, liquid: 0, snow: false, gap: 16, skip: 0.2, giant: 2.5, starter: [7, 0.35, 0.12], mix: [[7, 0.42], [1, 0.3], [0, 0.18], [4, 0.1]],
    pal: { skyLow: [0.16, 0.10, 0.26], skyTop: [0.02, 0.03, 0.09], horizon: [0.25, 0.45, 0.50], stoneA: [0.17, 0.18, 0.22], stoneB: [0.33, 0.34, 0.40], fog: [0.09, 0.08, 0.15], grassA: [0.10, 0.42, 0.30], grassB: [0.30, 0.66, 0.38] } },
  { icon: "🏰", amp: 2.0, liquid: 0, snow: false, gap: 15, skip: 0.15, giant: 2.6, starter: [6, 0.4, 0.15], mix: [[9, 0.5], [2, 0.16], [1, 0.2], [0, 0.14]],
    pal: { skyLow: [0.28, 0.15, 0.12], skyTop: [0.05, 0.04, 0.10], horizon: [0.75, 0.40, 0.16], stoneA: [0.22, 0.20, 0.20], stoneB: [0.40, 0.37, 0.36], fog: [0.14, 0.09, 0.09], grassA: [0.26, 0.50, 0.16], grassB: [0.50, 0.72, 0.24] } },
  { icon: "❄️", amp: 4.8, liquid: 1, snow: true, gap: 16, skip: 0.2, giant: 2.7, starter: [8, 0.35, 0.12], mix: [[8, 0.45], [0, 0.25], [9, 0.15], [2, 0.15]],
    pal: { skyLow: [0.20, 0.24, 0.34], skyTop: [0.04, 0.06, 0.14], horizon: [0.50, 0.60, 0.75], stoneA: [0.30, 0.32, 0.38], stoneB: [0.55, 0.57, 0.63], fog: [0.16, 0.18, 0.24], grassA: [0.22, 0.50, 0.30], grassB: [0.50, 0.75, 0.45] } },
  { icon: "🌋", amp: 3.8, liquid: 2, snow: false, gap: 16, skip: 0.2, giant: 3.0, starter: [10, 0.32, 0.12], mix: [[10, 0.45], [4, 0.25], [2, 0.15], [7, 0.15]],
    pal: { skyLow: [0.30, 0.08, 0.06], skyTop: [0.05, 0.02, 0.05], horizon: [1.00, 0.30, 0.08], stoneA: [0.13, 0.11, 0.12], stoneB: [0.28, 0.24, 0.25], fog: [0.16, 0.06, 0.05], grassA: [0.24, 0.46, 0.14], grassB: [0.55, 0.72, 0.20] } },
];
function landOf(d: number) { return LANDS[(d - 1) % LANDS.length]; }
// each land has its own outline (lobes, depth): round meadow, four-lobed forest, six-sided castle land, a long ice valley, a star of lava
const SHAPES: [number, number][] = [[0, 0], [4, 0.2], [6, 0.14], [2, 0.32], [8, 0.13]];
function makeLand(d: number, seed = d) {
  const L = landOf(d);
  [SHAPE.k, SHAPE.a] = SHAPES[(d - 1) % LANDS.length];
  let a = seed * 101 + 7;
  const rnd = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const list: { x: number; z: number; kind: Kind; seed: number; scale?: number; y?: number }[] = [];
  const pond = terrain.plan(seed);
  // little things, a bite away, next to every swarm's starting point
  for (let i = 0; i < 9; i++) {
    const an = (i / 9) * Math.PI * 2 + rnd(), r = 5 + rnd() * 30;
    list.push({ x: Math.cos(an) * r, z: Math.sin(an) * r, kind: L.starter[0], seed: Math.floor(rnd() * 1e6), scale: L.starter[1] + rnd() * L.starter[2] });
  }
  const n = Math.floor(54 / L.gap);
  for (let gz = -n; gz <= n; gz++) for (let gx = -n; gx <= n; gx++) {
    if (gx === 0 && gz === 0) continue; // the square in the middle stays open: the seed starts there
    const x = gx * L.gap + (rnd() - 0.5) * 6, z = gz * L.gap + (rnd() - 0.5) * 6;
    if (Math.hypot(x, z) > wallAt(x, z) - 9 || rnd() < L.skip) continue;
    if (Math.hypot(x - pond.x, z - pond.z) < pond.r + 6) continue; // nothing stands in a pond
    if (Math.hypot(x - terrain.pond2.x, z - terrain.pond2.z) < terrain.pond2.r + 6) continue;
    let r = rnd(), kind = L.mix[0][0];
    for (const [k, w] of L.mix) { if (r < w) { kind = k; break; } r -= w; }
    list.push({ x, z, kind, seed: Math.floor(rnd() * 1e6) });
  }
  theme.snow = L.snow;
  theme.giant = (d - 1) % LANDS.length;
  world.pal = L.pal;
  // beyond the wall: the next land ahead (north), the land you came from behind (south)
  world.scenery(d, d % LANDS.length, -1);
  world.nextPal = L.pal; world.prevPal = undefined;
  world.liquid = L.liquid; terrain.amp = L.amp;
  const out = list.slice(0, 64);
  // the hills, with a level pad under every building (sunk a little, so it sits in the ground)
  const ys = terrain.build(seed, out.map((b) => ({ x: b.x, z: b.z, half: (32 * 0.28 * (b.scale ?? 1)) / 2 + 0.6 })));
  out.forEach((b, k) => (b.y = ys[k] - 0.12));
  return out;
}
// ---------------------------------------------------------------- sizing (capped pixel count keeps the fill cost bounded)
let cw = 0, ch = 0;
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
  const cap = 2_400_000, px = w * h;
  if (px > cap) { const k = Math.sqrt(cap / px); w = Math.round(w * k); h = Math.round(h * k); }
  canvas.width = cw = w; canvas.height = ch = h;
  post.resize(w, h);
}
resize();
addEventListener("resize", resize);

// ---------------------------------------------------------------- all state preallocated (zero garbage in the loop)
const cityLink = { grid: city.grid, atlas: city.atlas.tex[0], height: terrain.tex, b: city.bArr, b2: city.b2Arr, s2: city.s2Arr };
const proj = new Float32Array(16), view = new Float32Array(16), vp = new Float32Array(16), inv = new Float32Array(16);
const cam = new Float32Array(3), camR = new Float32Array(3), camU = new Float32Array(3);
const leader = new Float32Array([0, 0, 0]), leaderVel = new Float32Array(3);
const target = new Float32Array([0, 0, 0]);
let hasTarget = false, lastInput = -99, lastMove = 0, tapT = -9, tapX = 0, tapY = 0, dashT = 0;
// left alone, the swarm builds something: a heart, a dinosaur, a tower, a rocket, a whale, a star
let shapeK = Math.floor(Math.random() * 1000) % 17, shapeOn = false, shapeT = 0;
let camD = 2.2, camX = 0, camZ = 0, camY = 0, shake = 0;

// ---------------------------------------------------------------- input: the finger (or mouse) is where the seed goes
const ndc = new Float32Array(4), tmp4 = new Float32Array(4);
function pick(clientX: number, clientY: number) {
  const x = (clientX / innerWidth) * 2 - 1, y = 1 - (clientY / innerHeight) * 2;
  // unproject two points and intersect the ground plane y = 0
  ndc[0] = x; ndc[1] = y; ndc[2] = -1; ndc[3] = 1; xform(tmp4, inv, ndc);
  const ax = tmp4[0] / tmp4[3], ay = tmp4[1] / tmp4[3], az = tmp4[2] / tmp4[3];
  ndc[2] = 1; xform(tmp4, inv, ndc);
  const bx = tmp4[0] / tmp4[3], by = tmp4[1] / tmp4[3], bz = tmp4[2] / tmp4[3];
  // the ray meets the hills: start at the flat plane, then refine against the height map
  let gy = 0, t = 0;
  for (let k = 0; k < 4; k++) { t = (ay - gy) / (ay - by); if (!(t > 0)) return; gy = terrain.floor(ax + (bx - ax) * t, az + (bz - az) * t); }
  target[0] = ax + (bx - ax) * t; target[2] = az + (bz - az) * t;
  hasTarget = true; lastInput = time;
}
let stickMag = 1;
const g0 = new Float32Array(2), g1 = new Float32Array(2);
/** where the screen point meets the flat ground (y = 0); false if it looks at the sky */
function ground(clientX: number, clientY: number, out: Float32Array) {
  const x = (clientX / innerWidth) * 2 - 1, y = 1 - (clientY / innerHeight) * 2;
  ndc[0] = x; ndc[1] = y; ndc[2] = -1; ndc[3] = 1; xform(tmp4, inv, ndc);
  const ax = tmp4[0] / tmp4[3], ay = tmp4[1] / tmp4[3], az = tmp4[2] / tmp4[3];
  ndc[2] = 1; xform(tmp4, inv, ndc);
  const bx = tmp4[0] / tmp4[3], by = tmp4[1] / tmp4[3], bz = tmp4[2] / tmp4[3];
  const t = ay / (ay - by); if (!(t > 0)) return false;
  out[0] = ax + (bx - ax) * t; out[1] = az + (bz - az) * t; return true;
}
let burnAcc = 0;
const padNear: number[] = [];
function keepPad(x: number, z: number) {
  for (const b of padNear) { const B = city.buildings[b], h = (32 * 0.28 * (city.s2Arr[b * 4] || 1)) / 2 + 0.9; if (Math.abs(x - B.x) < h && Math.abs(z - B.z) < h) return true; }
  return false;
}
function xform(out: Float32Array, m: Float32Array, v: Float32Array) {
  for (let i = 0; i < 4; i++) out[i] = m[i] * v[0] + m[4 + i] * v[1] + m[8 + i] * v[2] + m[12 + i] * v[3];
}
let down = false;
// ---------------------------------------------------------------- the leaderboard: one shared list of best scores (falls back to this device only)
const LB_URL = location.hostname.endsWith("workers.dev") ? "/api/lb" : "https://kidgames.soroosh-ra.workers.dev/api/lb";
const ME = (() => {
  let id = "", name = "";
  try { id = localStorage.getItem("glowmites-id") || ""; name = localStorage.getItem("glowmites-name") || ""; } catch { /* */ }
  if (!id) { id = Array.from({ length: 16 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join(""); try { localStorage.setItem("glowmites-id", id); } catch { /* */ } }
  if (!name) { name = `Mite ${1000 + Math.floor(Math.random() * 9000)}`; try { localStorage.setItem("glowmites-name", name); } catch { /* */ } }
  return { id, name };
})();
type Row = { id: string; n: string; s: number; l: number };
let lbRows: Row[] = [], lastSent = 0;
async function lbCall(post: boolean): Promise<Row[] | null> {
  try {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch(LB_URL, post ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: ME.id, name: ME.name, score: Math.round(score), land: district }), signal: ctl.signal } : { signal: ctl.signal });
    clearTimeout(tm); if (!r.ok) return null; lbRows = await r.json(); if (post) lastSent = score; return lbRows;
  } catch { return null; }
}
const myRank = () => { const i = lbRows.findIndex((e) => e.id === ME.id.slice(0, 6)); return i >= 0 ? i + 1 : 0; };
addEventListener("visibilitychange", () => { if (document.hidden && score > lastSent) void lbCall(true); });
const lbEl = document.getElementById("lb")!;
let lbWasOver = false;
function showBoard() {
  lbWasOver = roundOver; roundOver = true;
  const fmt = (n: number) => n.toLocaleString("en");
  const render = (rows: Row[] | null) => {
    const list = (rows && rows.length ? rows : [{ id: ME.id.slice(0, 6), n: ME.name, s: Math.round(score), l: district }]).slice(0, 30);
    lbEl.innerHTML = `<div class="box"><button class="x">✕</button><h2>🏆 Leaderboard</h2>
      <div class="meRow"><input maxlength="16" value="${ME.name.replace(/"/g, "")}"/><b>⭐ ${fmt(Math.round(score))}</b></div>
      ${rows ? "" : `<p class="off">offline: only your own score</p>`}
      <div class="list">${list.map((e, i) => `<div class="r${e.id === ME.id.slice(0, 6) ? " me" : ""}"><span>${i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span><em>${e.n.replace(/[<>&]/g, "")}</em><i>${LAND_ICON[(e.l - 1) % 5] ?? ""}</i><b>${fmt(e.s)}</b></div>`).join("")}</div></div>`;
    lbEl.querySelector(".x")!.addEventListener("click", () => { lbEl.classList.remove("show"); roundOver = lbWasOver; });
    const inp = lbEl.querySelector("input")!;
    inp.addEventListener("change", () => { ME.name = inp.value.trim().slice(0, 16) || ME.name; try { localStorage.setItem("glowmites-name", ME.name); } catch { /* */ } void lbCall(true).then(render); });
  };
  render(lbRows.length ? lbRows : null); lbEl.classList.add("show");
  void lbCall(score > lastSent).then(render);
}
document.getElementById("lbBtn")!.addEventListener("click", showBoard);
let touched = false;
// pointers: one finger (or the mouse) steers; two fingers pinch to zoom; the wheel zooms too
const ptrs = new Map<number, { x: number; y: number }>();
let stick = false, stX = 0, stY = 0, stCX = 0, stCY = 0;
const stickEl = document.getElementById("stick")!, knobEl = stickEl.firstElementChild as HTMLElement;
let pinch0 = 0, zoom0 = 1, userZoom = 1, aimX = 0, aimY = 0, aiming = false;
canvas.addEventListener("pointerdown", (e) => {
  audio.start();
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = userZoom; aiming = false; stick = false; }
  else { down = true; aiming = true; aimX = e.clientX; aimY = e.clientY; tapT = time; tapX = e.clientX; tapY = e.clientY;
    if (e.pointerType !== "mouse") { stick = true; stX = e.clientX; stY = e.clientY; stCX = stX; stCY = stY; } }
  lastMove = time;
  if (!touched) { touched = true; hand.classList.add("gone"); }
  if (!roundOver) poki.gameplayStart();
});
addEventListener("pointermove", (e) => {
  const p = ptrs.get(e.pointerId);
  if (p) { p.x = e.clientX; p.y = e.clientY; }
  if (ptrs.size === 2 && pinch0 > 0) {
    const [a, b] = [...ptrs.values()];
    userZoom = Math.min(2.6, Math.max(0.4, zoom0 * pinch0 / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y))));
    return;
  }
  if (stick && ptrs.size === 1) {
    // a floating stick: the drag from where the finger landed is the direction; drag further, go faster
    stCX = e.clientX; stCY = e.clientY; lastMove = time;
    const dx = stCX - stX, dy = stCY - stY, d = Math.hypot(dx, dy), R = 70;
    if (d > R) { stX = stCX - dx / d * R; stY = stCY - dy / d * R; }
    return;
  }
  if (down || e.pointerType === "mouse") { aiming = true; aimX = e.clientX; aimY = e.clientY; lastMove = time; }
});
const lift = (e: PointerEvent) => {
  // a quick tap is a punch: the whole swarm lunges at that spot and hits hard
  if (ptrs.size === 1 && e.pointerType === "mouse" && time - tapT < 0.28 && Math.hypot(e.clientX - tapX, e.clientY - tapY) < 24) { pick(e.clientX, e.clientY); dashT = 0.5; shake = Math.max(shake, 0.35); audio.thump(0.45); }
  ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0; if (ptrs.size === 0) { down = false; stick = false; } };
addEventListener("pointerup", lift);
addEventListener("pointercancel", lift);
canvas.addEventListener("wheel", (e) => { e.preventDefault(); userZoom = Math.min(2.6, Math.max(0.4, userZoom * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
addEventListener("keydown", (e) => {
  audio.start();
  if (e.key === " " || e.key.startsWith("Arrow")) e.preventDefault();
  if (e.key === "+" || e.key === "=") userZoom = Math.max(0.4, userZoom / 1.15);
  if (e.key === "-" || e.key === "_") userZoom = Math.min(2.6, userZoom * 1.15);
  if (e.key === "h") hudCanvas.style.display = hudCanvas.style.display === "none" ? "block" : "none";
});

// ---------------------------------------------------------------- the arena: seven swarms, two minutes
const ROUND = 120, START_SIZE = 400, EAT_RATIO = 1.1;
const NAMES = ["", "🦊 Foxy", "🐸 Ribbit", "🐙 Inky", "🦄 Sparkle", "🐝 Buzz", "🐲 Draco"];
const TEAM_CSS = ["#ffc05a", "#5aa6ff", "#ff4d5a", "#73ff73", "#d98cff", "#4dfff0", "#ff8cd9"];
const LAND_ICON = ["🌼", "🍄", "🏰", "❄️", "🌋"], LAND_NAME = ["Flower Meadow", "Mushroom Forest", "Castle Hills", "Ice Valley", "Fire Mountain"];
const QA = import.meta.env.MODE === "qa", BOT = QA && params.get("bot") === "1";
let district = 1 + Math.floor(Math.random() * 5);
let roundT = -3, roundOver = true, started = false;
let active = Number(params.get("start") ?? START_SIZE), meal = 0, bestSize = START_SIZE, kills = 0, deaths = 0;
let playerDead = 0, safeT = 0, burn = 0;
const rv = { tx: new Float32Array(NT), tz: new Float32Array(NT), think: new Float32Array(NT), dead: new Float32Array(NT), meal: new Float32Array(NT), aggr: new Float32Array(NT), best: new Float32Array(NT) };
const contactT = new Float32Array(64), hpOf = new Float32Array(64).fill(1), killer = new Int8Array(64);
const contactBy = new Float32Array(64 * NT);
const sizeOf = (k: number) => (k === 0 ? active : swarm.A[k]);
const posX = (k: number) => (k === 0 ? leader[0] : swarm.L[k * 3]), posZ = (k: number) => (k === 0 ? leader[2] : swarm.L[k * 3 + 2]);
const nameOf = (k: number) => (k === 0 ? "You" : NAMES[k]);
/** body radius: the drawn body stops growing at the GPU cap */
const bodyR = (n: number) => 3 + Math.sqrt(Math.min(n, 98304)) * 0.05;
/** bigger swarms are slower: the small can always run */
const speedOf = (n: number) => Math.max(5.5, 11.5 - Math.sqrt(Math.min(n, 98304)) * 0.02);
function qaLog(m: string) { if (QA) console.log(`[gm] t=${roundT.toFixed(1)} size=${Math.round(active)} ${m}`); }

const winEl = document.getElementById("win")!, introEl = document.getElementById("intro")!, comboEl = document.getElementById("combo")!;
const timerEl = document.getElementById("timer")!, boardEl = document.getElementById("board")!, feedEl = document.getElementById("feed")!;
const hand = document.getElementById("hand")!, countN = document.getElementById("countN")!, countBox = document.getElementById("count")!;
function toast(t: string, col = "#ffe27a") { comboEl.style.color = col; comboEl.textContent = t; comboEl.classList.remove("pop"); void comboEl.offsetWidth; comboEl.classList.add("pop"); }
/** the kill feed: who ate whom, a few lines that fade */
function feed(html: string) { const d = document.createElement("div"); d.innerHTML = html; feedEl.prepend(d); while (feedEl.children.length > 3) feedEl.lastChild!.remove(); setTimeout(() => d.remove(), 4000); }
const tag = (k: number) => `<b style="color:${TEAM_CSS[k]}">${nameOf(k)}</b>`;

/** spawn point for swarm k: on a ring, spread around the map, away from everyone else when possible */
function spawnAt(k: number, out: number[]) {
  let bx = 0, bz = 0, bd = -1;
  for (let t = 0; t < 16; t++) {
    const a = Math.random() * Math.PI * 2, r = (0.35 + Math.random() * 0.45) * wallAt(Math.cos(a), Math.sin(a)), x = Math.cos(a) * r, z = Math.sin(a) * r;
    let near = 1e9; for (let j = 0; j < NT; j++) if (j !== k && sizeOf(j) > 0) near = Math.min(near, Math.hypot(posX(j) - x, posZ(j) - z));
    if (near > bd) { bd = near; bx = x; bz = z; }
  }
  out[0] = bx; out[1] = bz;
}
const sp2 = [0, 0];
function newRound() {
  district = params.has("map") ? Number(params.get("map")) : 1 + Math.floor(Math.random() * 5);
  city.build(makeLand(district, 1000 + Math.floor(Math.random() * 9000)));
  contactT.fill(0); hpOf.fill(1); hpPrev.fill(1); wasGone.fill(0); killer.fill(-1); contactBy.fill(0); combo = 0;
  active = Number(params.get("start") ?? START_SIZE); meal = 0; bestSize = active; kills = 0; deaths = 0; playerDead = 0; safeT = 0; gold = -1; goldNext = 12;
  leader[0] = 0; leader[2] = 0; target[0] = 0; target[2] = 0; camX = 0; camZ = 0; hasTarget = false;
  for (let k = 1; k < NT; k++) {
    const a = (k / (NT - 1)) * Math.PI * 2 + 0.3, r = 0.62 * wallAt(Math.cos(a), Math.sin(a));
    swarm.L[k * 3] = Math.cos(a) * r; swarm.L[k * 3 + 2] = Math.sin(a) * r; swarm.L[k * 3 + 1] = terrain.floor(swarm.L[k * 3], swarm.L[k * 3 + 2]);
    swarm.LV.fill(0, k * 3, k * 3 + 3); swarm.A[k] = START_SIZE; rv.think[k] = 0; rv.dead[k] = 0; rv.meal[k] = 0; rv.best[k] = START_SIZE;
    rv.aggr[k] = 0.6 + Math.random() * 0.8; // some hunt, some graze
  }
  swarm.reset = true; roundT = -3; roundOver = false; started = true;
  introEl.innerHTML = `<h1>${LAND_ICON[district - 1]} ${LAND_NAME[district - 1]}</h1><div>3</div><p>Be the biggest swarm in 2 minutes!</p>`;
  introEl.classList.remove("show"); void introEl.offsetWidth; introEl.classList.add("show", "long");
  winEl.classList.remove("show");
  audio.chime(2); qaLog(`ROUND start map=${district}`);
}
function endRound() {
  roundOver = true; poki.gameplayStop();
  const order = [...Array(NT).keys()].sort((a, b) => sizeOf(b) - sizeOf(a)), place = order.indexOf(0) + 1;
  const final = Math.round(active); if (final > score) score = final;
  try { localStorage.setItem("glowmites-best", String(score)); } catch { /* */ }
  const medal = ["🥇", "🥈", "🥉"];
  const fmt = (n: number) => n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
  winEl.innerHTML = `<div class="card"><div class="t">${place === 1 ? "🏆 You win!" : place <= 3 ? `${medal[place - 1]} ${place}${["", "st", "nd", "rd"][place]} place` : `${place}th of ${NT}`}</div>
    <div class="list">${order.map((k, i) => `<div class="r${k === 0 ? " me" : ""}"><span>${i < 3 ? medal[i] : i + 1}</span><em style="color:${TEAM_CSS[k]}">${nameOf(k)}</em><b>${fmt(sizeOf(k))}</b></div>`).join("")}</div>
    <div class="row">🍴 ate ${kills} swarm${kills === 1 ? "" : "s"} · 💀 eaten ${deaths}×</div>
    <div class="row tot">best ever: ${fmt(score)}</div><div class="row rk">🏆 …</div>
    <div class="btns"><button class="lbb">🏆</button><button class="go">▶</button></div></div>`;
  winEl.classList.add("show");
  if (place === 1) { city.bloom = 3; for (let i = 0; i < 6; i++) setTimeout(() => audio.chime(4 + i), i * 140); } else audio.chime(3);
  void lbCall(true).then((r) => { const rk = winEl.querySelector(".rk"); if (rk) rk.textContent = r ? `🏆 #${myRank() || "–"} in the world` : "🏆 offline"; });
  winEl.querySelector(".lbb")!.addEventListener("click", showBoard);
  winEl.querySelector(".go")!.addEventListener("click", () => poki.commercialBreak().then(newRound));
  qaLog(`ROUND end place=${place} size=${final} kills=${kills} deaths=${deaths} order=${order.map((k) => `${k}:${Math.round(sizeOf(k))}`).join(",")}`);
}
function titleCard() {
  winEl.innerHTML = `<div class="card story"><div class="t">GLOWMITES</div>
    <div class="st"><span>✨</span><p>You are a glowing swarm. Eat the stone world to grow.</p></div>
    <div class="st"><span>🍴</span><p>Eat any swarm smaller than you. Run from the bigger ones!</p></div>
    <div class="st"><span>⏱</span><p>Two minutes. The biggest swarm wins.</p></div>
    <div class="btns"><button class="go">▶</button></div></div>`;
  winEl.classList.add("show");
  winEl.querySelector(".go")!.addEventListener("click", () => { audio.start(); newRound(); });
}

// ---------------------------------------------------------------- eating
// what the new mites look like: the colours of what the swarm is eating
const BIRTH: number[][] = [[3, 1, 2, 4], [8, 9, 7, 10], [6, 14, 13, 6], [15, 11, 2, 16], [6, 17, 19, 6], [17, 19, 10, 6], [10, 9, 8, 13], [20, 21, 22, 20], [24, 24, 7, 23], [27, 1, 6, 4], [25, 25, 26, 25]];
/** which swarm is working on building b right now (the nearest leader in reach), -1 if none */
function teamAt(x: number, z: number, reach: number) {
  let best = -1, bd = 1e9;
  for (let k = 0; k < NT; k++) { const A = sizeOf(k); if (A < 1) continue; const d = Math.hypot(x - posX(k), z - posZ(k)) - bodyR(A); if (d < reach && d < bd) { bd = d; best = k; } }
  return best;
}
city.onEat = (b, amount) => {
  const B = city.buildings[b], k = teamAt(B.x, B.z, 8);
  if (k === 0) meal += amount * 0.7; else if (k > 0) rv.meal[k] += amount * 0.7 * (swarm.A[k] < active ? 1.25 : 1);
  if (!city.gone[b] && B.eaten > B.solid * 0.88) { city.remove(b); if (k === 0) audio.thump(0.3); }
  if (k !== 0) return;
  { const m = BIRTH[B.kind]; if (m) swarm.birth.set(m); }
  audio.eat(amount);
  const failAt = B.kind === 1 ? 0.3 : B.kind === 6 ? 0.5 : 0.3;
  if (B.eaten > B.solid * failAt && B.collapseAt < 0) { B.collapseAt = time; city.fail(b); shake = Math.max(shake, B.kind === 6 ? 0.2 : 0.6); audio.thump(0.6); }
};
// the golden food: every so often one building glows gold; whoever takes it gets a big burst
let gold = -1, goldNext = 12;

// ---------------------------------------------------------------- the readable layer: health bars, names over every swarm, points
const fx = document.getElementById("fx") as HTMLCanvasElement, fctx = fx.getContext("2d")!;
const hpPrev = new Float32Array(64).fill(1), hpFlash = new Float32Array(64), wasGone = new Uint8Array(64);
let combo = 0, lastKill = -9, fxW = 0, fxH = 0;
const pops: { x: number; y: number; z: number; t: number; txt: string; big: boolean }[] = [];
function project(x: number, y: number, z: number, out: Float32Array) {
  const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  out[0] = ((vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / w * 0.5 + 0.5) * fxW;
  out[1] = (0.5 - (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / w * 0.5) * fxH;
  out[2] = w;
}
const pr = new Float32Array(3);
const fmtN = (n: number) => n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
function drawFx(dt: number) {
  const dpr = Math.min(2, devicePixelRatio || 1), W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
  if (fx.width !== W || fx.height !== H) { fx.width = W; fx.height = H; }
  fxW = W; fxH = H; fctx.clearRect(0, 0, W, H);
  for (let b = 0; b < city.buildings.length; b++) {
    const B = city.buildings[b];
    if (city.gone[b]) { if (!wasGone[b]) { wasGone[b] = 1; if (killer[b] === 0) { combo = time - lastKill < 4 ? combo + 1 : 1; lastKill = time; if (combo >= 2) { meal += 25 * combo; toast(`×${combo}`); audio.chime(Math.min(9, combo + 2)); } } } continue; }
    wasGone[b] = 0;
    const sc = city.s2Arr[b * 4] || 1, top = city.s2Arr[b * 4 + 1] + B.h * 0.28 * sc + 0.6, hp = hpOf[b];
    if (hp < hpPrev[b] - 0.0015) hpFlash[b] = 1;
    hpPrev[b] = hp; hpFlash[b] = Math.max(0, hpFlash[b] - dt * 3.5);
    project(B.x, top, B.z, pr);
    if (pr[2] <= 0 || pr[0] < 0 || pr[0] > W || pr[1] < 0 || pr[1] > H) continue;
    if (b === gold) { fctx.save(); fctx.textAlign = "center"; fctx.shadowColor = "#ffd23c"; fctx.shadowBlur = 18 * dpr; fctx.font = `${Math.round(34 * dpr * (1 + 0.12 * Math.sin(time * 7)))}px sans-serif`; fctx.fillText("🌟", pr[0], pr[1] - 18 * dpr); fctx.restore(); }
    if (hp > 0.999) continue;
    const bw = Math.max(26, Math.min(90, 2600 / pr[2])) * dpr * 0.6, bh = (5 + 4 * hpFlash[b]) * dpr, x0 = pr[0] - bw / 2, y0 = pr[1] - bh;
    fctx.fillStyle = "rgba(10,10,20,0.65)"; fctx.fillRect(x0 - dpr, y0 - dpr, bw + 2 * dpr, bh + 2 * dpr);
    fctx.fillStyle = `hsl(${Math.round(hp * 115)},90%,${50 + hpFlash[b] * 25}%)`; fctx.fillRect(x0, y0, bw * hp, bh);
  }
  // every swarm wears its name and size; red if it can eat you, green if you can eat it
  fctx.save(); fctx.textAlign = "center"; fctx.textBaseline = "middle";
  for (let k = 0; k < NT; k++) {
    const A = sizeOf(k); if (A < 1) continue;
    project(posX(k), (k === 0 ? leader[1] : swarm.L[k * 3 + 1]) + 3 + bodyR(A) * 0.45, posZ(k), pr);
    if (pr[2] <= 0) continue;
    const onS = pr[0] > 0 && pr[0] < W && pr[1] > 0 && pr[1] < H;
    const threat = k > 0 && A >= active * EAT_RATIO, prey = k > 0 && active >= A * EAT_RATIO;
    if (onS) {
      fctx.font = `900 ${Math.round((k === 0 ? 17 : 15) * dpr)}px system-ui, sans-serif`;
      const t = `${nameOf(k)} ${fmtN(A)}`, w = fctx.measureText(t).width + 14 * dpr;
      fctx.fillStyle = threat ? "rgba(140,20,20,0.75)" : prey ? "rgba(20,110,40,0.75)" : "rgba(10,8,24,0.6)";
      fctx.beginPath(); fctx.roundRect(pr[0] - w / 2, pr[1] - 12 * dpr, w, 24 * dpr, 12 * dpr); fctx.fill();
      fctx.fillStyle = TEAM_CSS[k]; fctx.fillText(t, pr[0], pr[1] + dpr);
    } else if (k > 0 && (threat || prey) && Math.hypot(posX(k) - leader[0], posZ(k) - leader[2]) < 70) {
      // off screen but close: an edge arrow, red for danger, green for a meal
      let ax = pr[0] - W / 2, ay = pr[1] - H / 2; const a = Math.atan2(ay, ax);
      const m = Math.min((W / 2 - 30 * dpr) / Math.abs(Math.cos(a) || 1e-3), (H / 2 - (ay < 0 ? 120 : 90) * dpr) / Math.abs(Math.sin(a) || 1e-3));
      ax = W / 2 + Math.cos(a) * m; ay = H / 2 + Math.sin(a) * m;
      fctx.save(); fctx.translate(ax, ay); fctx.rotate(a); const s2 = 16 * dpr; fctx.fillStyle = threat ? "#ff4d4d" : "#6dff6d";
      fctx.beginPath(); fctx.moveTo(s2, 0); fctx.lineTo(-s2 * 0.7, s2 * 0.75); fctx.lineTo(-s2 * 0.3, 0); fctx.lineTo(-s2 * 0.7, -s2 * 0.75); fctx.closePath(); fctx.fill(); fctx.restore();
    }
  }
  fctx.restore();
  for (let k = pops.length - 1; k >= 0; k--) {
    const q = pops[k]; q.t += dt; if (q.t > 1.3) { pops.splice(k, 1); continue; }
    project(q.x, q.y + q.t * 3, q.z, pr); if (pr[2] <= 0) continue;
    const sz = (q.big ? 32 : 20) * dpr;
    fctx.save(); fctx.globalAlpha = Math.min(1, (1.3 - q.t) * 2.5); fctx.textAlign = "center"; fctx.font = `900 ${Math.round(sz)}px system-ui, sans-serif`;
    fctx.lineWidth = 4 * dpr; fctx.strokeStyle = "rgba(40,20,0,0.85)"; fctx.strokeText(q.txt, pr[0], pr[1]);
    fctx.fillStyle = q.big ? "#ffe27a" : "#fff3c4"; fctx.fillText(q.txt, pr[0], pr[1]); fctx.restore();
  }
}
// the minimap: the arena, every swarm as a dot in its colour (size by size)
const miniC = document.getElementById("mini") as HTMLCanvasElement, mctx = miniC.getContext("2d")!;
function drawMini() {
  const dpr = Math.min(2, devicePixelRatio || 1), W = 104, H = 104;
  if (miniC.width !== W * dpr) { miniC.width = W * dpr; miniC.height = H * dpr; }
  const c = mctx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
  const s = 46 / WALL, ox = W / 2, oy = H / 2;
  c.beginPath(); for (let i = 0; i <= 64; i++) { const an = (i / 64) * Math.PI * 2, r = wallAt(Math.cos(an), Math.sin(an)) * s; const x = ox + Math.cos(an) * r, y = oy + Math.sin(an) * r; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
  c.closePath(); c.fillStyle = "rgba(90,90,110,0.45)"; c.fill(); c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 1.5; c.stroke();
  if (gold >= 0 && !city.gone[gold]) { const B = city.buildings[gold]; c.font = "11px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("🌟", ox + B.x * s, oy + B.z * s); }
  for (let k = NT - 1; k >= 0; k--) { const A = sizeOf(k); if (A < 1) continue; c.beginPath(); c.arc(ox + posX(k) * s, oy + posZ(k) * s, Math.max(2.5, bodyR(A) * s), 0, Math.PI * 2); c.fillStyle = TEAM_CSS[k]; c.fill(); if (k === 0) { c.strokeStyle = "#fff"; c.lineWidth = 1.5; c.stroke(); } }
}

// ---------------------------------------------------------------- the rivals think: hunt the smaller, run from the bigger, graze in between
function think(k: number) {
  const A = sizeOf(k), lx = posX(k), lz = posZ(k);
  let tx = NaN, tz = NaN, bestThreat = 1e9, bestPrey = -1;
  for (let j = 0; j < NT; j++) {
    if (j === k) continue; const B = sizeOf(j); if (B < 1) continue;
    const d = Math.hypot(posX(j) - lx, posZ(j) - lz);
    if (B >= A * EAT_RATIO && d < 16 + bodyR(B) * 2 && d < bestThreat && !(k === 0 && safeT > 0)) { bestThreat = d; tx = lx + (lx - posX(j)) * 2; tz = lz + (lz - posZ(j)) * 2; }
  }
  if (Number.isNaN(tx)) for (let j = 0; j < NT; j++) {
    if (j === k) continue; const B = sizeOf(j); if (B < 1 || A < B * EAT_RATIO || (j === 0 && safeT > 0)) continue;
    const d = Math.hypot(posX(j) - lx, posZ(j) - lz), reach = 20 + 25 * (k === 0 ? 1 : rv.aggr[k]);
    const sc = B / (d + 10); if (d < reach && sc > bestPrey) { bestPrey = sc; tx = posX(j); tz = posZ(j); }
  }
  if (Number.isNaN(tx)) {
    let best = -1, bs = -1;
    for (let b = 0; b < city.buildings.length; b++) { if (city.gone[b]) continue; const B = city.buildings[b], d = Math.hypot(B.x - lx, B.z - lz); const sc = (B.solid + 400) / (d + 8) * (b === gold ? 8 : 1); if (sc > bs) { bs = sc; best = b; } }
    if (best >= 0) { tx = city.buildings[best].x; tz = city.buildings[best].z; } else { tx = (Math.random() - 0.5) * 70; tz = (Math.random() - 0.5) * 70; }
  }
  const r = Math.hypot(tx, tz), lim = wallAt(tx, tz) - 6; if (r > lim) { tx *= lim / r; tz *= lim / r; }
  rv.tx[k] = tx; rv.tz[k] = tz;
}

// ---------------------------------------------------------------- loop
let time = 0, last = 0, refreshSamples = 0, refreshAcc = 0, score = 0;
try { score = Number(localStorage.getItem("glowmites-best") || 0); } catch { /* */ }
const DTMAX = QA && params.has("dtmax") ? Number(params.get("dtmax")) : 1 / 30;
function frame(now: number) {
  requestAnimationFrame(frame);
  const ms = last ? now - last : 16.7;
  last = now;
  if (refreshSamples < 90 && ms < 40) { refreshAcc += ms; refreshSamples++; if (refreshSamples === 90) gov.setRefresh(1000 / (refreshAcc / 90)); }
  gov.push(ms);
  const dt = Math.min(DTMAX, ms / 1000);
  time += dt;
  if (forcedTier === null) gov.update(dt);
  const tier = TIERS[gov.tier];
  const live = started && !roundOver;
  if (live) {
    const was = roundT; roundT += dt;
    if (was < 0 && Math.ceil(was) !== Math.ceil(roundT)) { const n = Math.ceil(-roundT); const big = introEl.querySelector("div"); if (big) big.textContent = n > 0 ? String(n) : "GO!"; audio.chime(n > 0 ? 3 : 7); if (n <= 0) poki.gameplayStart(); }
    if (roundT >= ROUND) endRound();
  }
  const playing = live && roundT >= 0;
  if (meal >= 1) { const add = Math.floor(meal); meal -= add; active += add; }
  bestSize = Math.max(bestSize, active);

  // ---- the player's swarm
  const idle = !down && time - lastMove > 1.0 && time > 3 && !BOT && playerDead <= 0;
  const sh = swarm.shape;
  if (idle && shapeOn && sh.blend > 0.95) { shapeT += dt; if (shapeT > 5) { shapeT = 0; shapeK = nextShape(shapeK); loadShape(shapeK, sh); } }
  if (idle && !shapeOn) { shapeOn = true; shapeT = 0; loadShape(shapeK, sh); sh.pos[0] = leader[0]; sh.pos[2] = leader[2]; sh.pos[1] = terrain.floor(leader[0], leader[2]); }
  if (!idle && shapeOn && sh.blend < 0.05) { shapeOn = false; shapeK = nextShape(shapeK); }
  sh.blend = shapeOn && idle ? Math.min(1, sh.blend + dt * 2.2) : Math.max(0, sh.blend - dt * 3);
  sh.scale = 2.4 + Math.sqrt(Math.min(active, TEAM_CAP[0])) * 0.07;
  let mag = 1;
  if (BOT && playing) { rv.think[0] -= dt; if (rv.think[0] <= 0) { rv.think[0] = 0.3; think(0); } target[0] = rv.tx[0]; target[2] = rv.tz[0]; hasTarget = true; lastMove = time; }
  else if (shapeOn && idle) { target[0] = leader[0]; target[2] = leader[2]; }
  else if (stick) {
    const sx = stCX - stX, sy = stCY - stY, sl = Math.hypot(sx, sy);
    if (sl > 6) {
      const cx = innerWidth / 2, cy = innerHeight * 0.55;
      if (ground(cx, cy, g0) && ground(cx + sx / sl * 60, cy + sy / sl * 60, g1)) {
        const wx = g1[0] - g0[0], wz = g1[1] - g0[1], wl = Math.hypot(wx, wz) || 1;
        mag = Math.min(1, sl / 55); target[0] = leader[0] + wx / wl * 30; target[2] = leader[2] + wz / wl * 30; hasTarget = true;
      }
    } else { target[0] = leader[0]; target[2] = leader[2]; }
  } else if (aiming && (down || !("ontouchstart" in window))) pick(aimX, aimY);
  stickEl.style.display = stick ? "block" : "none";
  if (stick) { stickEl.style.transform = `translate(${stX}px,${stY}px)`; knobEl.style.transform = `translate(${stCX - stX}px,${stCY - stY}px)`; }
  { const r = Math.hypot(target[0], target[2]), lim = wallAt(target[0], target[2]) - 4; if (r > lim) { target[0] *= lim / r; target[2] *= lim / r; } }
  // over water the swarm is slowed; ice makes it skate; lava burns it
  const wet = terrain.at(leader[0], leader[2]) < WATER - 0.05, inMain = Math.hypot(leader[0] - terrain.pond.x, leader[2] - terrain.pond.z) < terrain.pond.r * 1.3;
  const liq = wet ? (inMain ? world.liquid : 0) : -1;
  if (liq === 2 && playing && active > 60) { const loss = active * 0.05 * dt; burn += loss; active = Math.max(60, active - loss); if (burn > 30 + active * 0.02) { pops.push({ x: leader[0], y: leader[1] + 4, z: leader[2], t: 0, txt: `🔥 -${Math.round(burn)}`, big: false }); burn = 0; } }
  const speed = speedOf(active), canMove = roundT >= 0 && playerDead <= 0;
  const dx = target[0] - leader[0], dz = target[2] - leader[2], d = Math.hypot(dx, dz);
  const vmax = canMove ? speed * mag * (liq === 0 ? 0.65 : liq === 1 ? 1.3 : 1) : 0;
  const vx = d > 0.01 ? (dx / d) * Math.min(d * 3.5, vmax) : 0, vz = d > 0.01 ? (dz / d) * Math.min(d * 3.5, vmax) : 0;
  const acc = Math.min(1, dt * (stick ? 10 : 7) * (liq === 1 ? 0.2 : 1));
  leaderVel[0] += (vx - leaderVel[0]) * acc; leaderVel[2] += (vz - leaderVel[2]) * acc;
  leader[0] += leaderVel[0] * dt; leader[2] += leaderVel[2] * dt; leader[1] = terrain.floor(leader[0], leader[2]);
  world.swarmXZ[0] = leader[0]; world.swarmXZ[1] = leader[2];

  // ---- buildings take damage from whoever touches them; the one who did most gets the prize
  if (playing) {
    for (let b = 0; b < city.buildings.length; b++) {
      if (city.gone[b]) continue;
      const B = city.buildings[b], half = (32 * 0.28 * (city.s2Arr[b * 4] || 1)) / 2;
      for (let k = 0; k < NT; k++) {
        const A = sizeOf(k); if (A < 1 || (k === 0 && playerDead > 0)) continue;
        if (Math.hypot(B.x - posX(k), B.z - posZ(k)) < half + bodyR(A) * 0.95) { const rate = (1.5 + (k === 0 ? 1.2 * Math.min(1.3, Math.hypot(leaderVel[0], leaderVel[2]) / speed) : 0.6)) * (1 + Math.sqrt(Math.min(A, 98304)) / 150); contactT[b] += dt * rate; contactBy[b * NT + k] += dt * rate; }
      }
      const T = (0.6 + B.solid / 2500) / Math.max(0.2, city.s2Arr[b * 4 + 2]) * 0.5 * (b === gold ? 2.5 : 1);
      hpOf[b] = Math.max(0, hpOf[b] - dt * 0.9, 1 - Math.max(B.eaten / (B.solid * 0.88), contactT[b] / T));
      if (hpOf[b] > 0) continue;
      if (B.collapseAt < 0) { B.collapseAt = time; city.fail(b); shake = Math.max(shake, 0.4); }
      else if (time - B.collapseAt > 0.7) {
        let kb = 0; for (let k = 1; k < NT; k++) if (contactBy[b * NT + k] > contactBy[b * NT + kb]) kb = k;
        killer[b] = kb; const prize = 40 + B.solid * 0.05 + (b === gold ? 1500 + sizeOf(kb) * 0.1 : 0);
        if (kb === 0) { meal += prize; pops.push({ x: B.x, y: city.s2Arr[b * 4 + 1] + 3, z: B.z, t: 0, txt: `+${Math.round(prize)}`, big: b === gold }); audio.thump(0.5); }
        else rv.meal[kb] += prize;
        if (b === gold) { toast(kb === 0 ? "🌟 golden food!" : `🌟 → ${nameOf(kb)}`, kb === 0 ? "#ffe27a" : TEAM_CSS[kb]); gold = -1; goldNext = roundT + 15; }
        city.remove(b);
      }
    }
    if (gold < 0 && roundT > goldNext && roundT < ROUND - 10) {
      let best = -1, bs = -1;
      for (let b = 0; b < city.buildings.length; b++) { if (city.gone[b] || city.buildings[b].collapseAt >= 0) continue; const B = city.buildings[b], sc = (B.solid + 500) * (0.5 + Math.random()); if (sc > bs) { bs = sc; best = b; } }
      if (best >= 0) { gold = best; audio.chime(6); feed(`🌟 golden food appeared!`); }
    }
  }
  // the ground itself is eaten: the swarm digs a shallow trail as it goes
  if (playing && active > 0 && playerDead <= 0) {
    padNear.length = 0; const swarmR = bodyR(active);
    for (let b = 0; b < city.buildings.length; b++) { if (city.gone[b]) continue; const B = city.buildings[b]; if (Math.abs(B.x - leader[0]) < swarmR + 8 && Math.abs(B.z - leader[2]) < swarmR + 8) padNear.push(b); }
    terrain.dig(leader[0], leader[2], swarmR * 0.85, dt * (0.15 + 0.03 * Math.hypot(leaderVel[0], leaderVel[2])), keepPad);
    if ((gov.frames & 1) === 0) terrain.flush();
  }

  // ---- the rivals
  for (let k = 1; k < NT; k++) {
    if (!playing) { swarm.LV[k * 3] = 0; swarm.LV[k * 3 + 2] = 0; swarm.SP[k] = 8; continue; }
    if (rv.dead[k] > 0) { rv.dead[k] -= dt; if (rv.dead[k] <= 0) { spawnAt(k, sp2); swarm.L[k * 3] = sp2[0]; swarm.L[k * 3 + 2] = sp2[1]; const sizes = [...Array(NT).keys()].map(sizeOf).sort((a, b) => a - b); swarm.A[k] = Math.max(START_SIZE, Math.round(sizes[3] * 0.3)); } continue; }
    if (rv.meal[k] >= 1) { const add = Math.floor(rv.meal[k]); rv.meal[k] -= add; swarm.A[k] += add; }
    rv.best[k] = Math.max(rv.best[k], swarm.A[k]);
    rv.think[k] -= dt; if (rv.think[k] <= 0) { rv.think[k] = 0.25 + Math.random() * 0.3; think(k); }
    const A = swarm.A[k], lx = swarm.L[k * 3], lz = swarm.L[k * 3 + 2], sp = speedOf(A) * 0.93;
    const ddx = rv.tx[k] - lx, ddz = rv.tz[k] - lz, dd = Math.hypot(ddx, ddz);
    const wx = dd > 0.01 ? (ddx / dd) * Math.min(dd * 3, sp) : 0, wz = dd > 0.01 ? (ddz / dd) * Math.min(dd * 3, sp) : 0;
    swarm.LV[k * 3] += (wx - swarm.LV[k * 3]) * Math.min(1, dt * 5); swarm.LV[k * 3 + 2] += (wz - swarm.LV[k * 3 + 2]) * Math.min(1, dt * 5);
    swarm.L[k * 3] += swarm.LV[k * 3] * dt; swarm.L[k * 3 + 2] += swarm.LV[k * 3 + 2] * dt;
    swarm.L[k * 3 + 1] = terrain.floor(swarm.L[k * 3], swarm.L[k * 3 + 2]); swarm.SP[k] = sp;
  }
  // ---- swarm eats swarm: a bigger one that catches a smaller one drains it
  safeT = Math.max(0, safeT - dt);
  if (playing) for (let i = 0; i < NT; i++) for (let j = 0; j < NT; j++) {
    if (i === j) continue;
    const Ai = sizeOf(i), Aj = sizeOf(j); if (Ai < 1 || Aj < 1 || Ai < Aj * EAT_RATIO || (j === 0 && (safeT > 0 || playerDead > 0)) || (i === 0 && playerDead > 0)) continue;
    if (Math.hypot(posX(i) - posX(j), posZ(i) - posZ(j)) > (bodyR(Ai) + bodyR(Aj)) * 0.7) continue;
    const take = Math.min(Aj, Math.ceil(dt * (Ai * 0.5 + 400)));
    if (j === 0) { active -= take; shake = Math.max(shake, 0.4); } else swarm.A[j] -= take;
    if (i === 0) { meal += take * 0.9; audio.eat(take * 0.05); } else rv.meal[i] += take * 0.9;
    if (sizeOf(j) < 40) {
      if (j === 0) { active = 0; playerDead = 2.5; deaths++; shake = 1.2; audio.thump(1.2); toast(`💀 ${nameOf(i)} ate you!`, TEAM_CSS[i]); feed(`${tag(i)} ate ${tag(0)}`); }
      else { swarm.A[j] = 0; rv.dead[j] = 4; feed(`${tag(i)} ate ${tag(j)}`); if (i === 0) { kills++; audio.thump(1); toast(`🍴 you ate ${nameOf(j)}!`, "#8dff7a"); for (let c = 0; c < 4; c++) setTimeout(() => audio.chime(6 + c), c * 100); } }
    }
  }
  if (playerDead > 0) { playerDead -= dt; if (playerDead <= 0) { spawnAt(0, sp2); active = Math.round(START_SIZE + bestSize * 0.25); safeT = 3; leader[0] = sp2[0]; leader[2] = sp2[1]; target[0] = leader[0]; target[2] = leader[2]; camX = leader[0]; camZ = leader[2]; swarm.reset = true; } }

  swarm.step(dt, time, leader, leaderVel, playerDead > 0 ? 0 : active, speed, cityLink);
  city.boost = (1 + 2.5 * Math.min(1.3, Math.hypot(leaderVel[0], leaderVel[2]) / speed)) * Math.min(1, Math.sqrt(12000 / Math.max(1, Math.min(active, 98304))));
  city.feed(swarm.state.tex[0], swarm.state.tex[1], swarm.span(), dt, time);
  if (city.bloom > 0) { city.bloom -= dt; city.flood(dt * 0.45); }
  world.hint[3] = 0;
  if (!touched && started && roundT > -1) hand.classList.remove("gone");

  // ---- camera: behind and above the swarm, pulling back as it grows
  const want = 17 + Math.sqrt(Math.min(active, TEAM_CAP[0])) * 0.13 + sh.blend * sh.scale * 1.2;
  const open = Math.min(1, time / 3.2), ease = open * open * (3 - 2 * open);
  const wantD = (2.2 + (want - 2.2) * ease) * userZoom;
  camD += (wantD - camD) * Math.min(1, dt * (time < 3.2 ? 6 : 3));
  camX += (leader[0] - camX) * Math.min(1, dt * 2.2); camZ += (leader[2] - camZ) * Math.min(1, dt * 2.2);
  const pitch = 0.3 + 0.52 * ease;
  camY += (terrain.floor(camX, camZ) + sh.blend * sh.scale * 0.35 - camY) * Math.min(1, dt * 2);
  cam[0] = camX; cam[1] = camY + 0.6 + camD * pitch; cam[2] = camZ + camD * 0.95;
  const aspect = cw / ch;
  perspective(proj, aspect < 1 ? 1.05 : 0.85, aspect, 0.3, 600);
  shake = Math.max(0, shake - dt * 1.6);
  const sk = shake * shake * 0.35;
  lookAt(view, cam[0] + Math.sin(time * 61) * sk, cam[1] + Math.sin(time * 47) * sk, cam[2], camX, camY, camZ - camD * 0.12);
  mul(vp, proj, view); invert(inv, vp);
  camR[0] = view[0]; camR[1] = view[4]; camR[2] = view[8];
  camU[0] = view[1]; camU[1] = view[5]; camU[2] = view[9];

  post.begin(tier.scale);
  world.draw(vp, inv, cam, swarm.light, city.color.tex[0], time);
  city.focus[0] = leader[0]; city.focus[1] = leader[1] + 1.5; city.focus[2] = leader[2];
  city.draw(vp, cam, swarm.light);
  grass.draw(vp, cam, camX, camZ - camD * 0.1, time, city.color.tex[0], swarm.light, swarm.light, 1, terrain.tex);
  city.shadows = gov.tier <= 2;
  world.drawWater(vp, cam, swarm.light, city.color.tex[0], time);
  swarm.draw(vp, camR, camU, time, active, 2 / (proj[5] * ch * tier.scale), leader, cityLink);
  post.end(tier.scale, time, tier.bloom, cw, ch);
  drawFx(dt);

  // ---- HUD: size, the clock, the live ranking
  if ((gov.frames & 7) === 0) {
    const txt = fmtN(active); if (countN.textContent !== txt) { countN.textContent = txt; countBox.classList.remove("pop"); void countBox.offsetWidth; countBox.classList.add("pop"); }
    const left = Math.max(0, Math.ceil(ROUND - Math.max(0, roundT)));
    timerEl.textContent = started ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "";
    timerEl.classList.toggle("hurry", left <= 10 && !roundOver && started);
    const order = [...Array(NT).keys()].sort((a, b) => sizeOf(b) - sizeOf(a));
    boardEl.innerHTML = order.map((k, i) => `<div class="${k === 0 ? "me" : ""}${sizeOf(k) < 1 ? " dead" : ""}"><span>${i + 1}</span><i style="background:${TEAM_CSS[k]}"></i><em>${nameOf(k)}</em><b>${sizeOf(k) < 1 ? "💀" : fmtN(sizeOf(k))}</b></div>`).join("");
  }
  if ((gov.frames & 3) === 0) drawMini();
  if (showHud && hudCanvas.style.display !== "none" && (gov.frames & 3) === 0) gov.graph(hud, `${Math.round(active).toLocaleString()} mites  ${cw}x${ch} @${Math.round(tier.scale * 100)}%`);
}
requestAnimationFrame(frame);
poki.init().then(() => poki.loadingFinished());
queueMicrotask(() => { if (BOT || params.has("go")) newRound(); else titleCard(); });

if (QA) (window as unknown as { __my: unknown }).__my = { newRound, endRound, gov, city, swarm, leader, target, terrain, rv, get roundT() { return roundT; }, set roundT(v: number) { roundT = v; }, get active() { return active; }, set active(v: number) { active = v; } };
