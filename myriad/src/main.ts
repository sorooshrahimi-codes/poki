// MYRIAD — phase 1 tech core: a swarm that grows to 200k, follows the finger, lights the world, never hitches.
import { invert, lookAt, mul, perspective } from "./gl.ts";
import { Governor, TIERS } from "./perf.ts";
import { Post } from "./post.ts";
import { S, Swarm, TEAM_CAP } from "./swarm.ts";
import { WALL, World, type Palette } from "./world.ts";
import { City, theme, type Kind } from "./city.ts";
import { poki } from "./poki.ts";
import { Grass } from "./grass.ts";
import { Audio } from "./audio.ts";
import { Terrain } from "./terrain.ts";
import { loadShape, nextShape } from "./shapes.ts";
import { LEVELS, goalText, renderMap, saveStars, unlocked, type Level } from "./saga.ts";

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
function makeLand(d: number, seed = d) {
  const L = landOf(d);
  let a = seed * 101 + 7;
  const rnd = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const list: { x: number; z: number; kind: Kind; seed: number; scale?: number; y?: number }[] = [];
  const pond = terrain.plan(seed);
  // the first meals are right next to the seed: little things, a bite away
  for (let i = 0; i < 7; i++) {
    const an = (i / 7) * Math.PI * 2 + rnd(), r = 5 + rnd() * 4;
    list.push({ x: Math.cos(an) * r, z: Math.sin(an) * r, kind: L.starter[0], seed: Math.floor(rnd() * 1e6), scale: L.starter[1] + rnd() * L.starter[2] });
  }
  const n = Math.floor(54 / L.gap);
  for (let gz = -n; gz <= n; gz++) for (let gx = -n; gx <= n; gx++) {
    if (gx === 0 && gz === 0) continue; // the square in the middle stays open: the seed starts there
    const x = gx * L.gap + (rnd() - 0.5) * 6, z = gz * L.gap + (rnd() - 0.5) * 6;
    if (Math.hypot(x, z) > WALL - 9 || rnd() < L.skip) continue;
    if (Math.hypot(x - pond.x, z - pond.z) < pond.r + 6) continue; // nothing stands in a pond
    if (Math.hypot(x - terrain.pond2.x, z - terrain.pond2.z) < terrain.pond2.r + 6) continue;
    let r = rnd(), kind = L.mix[0][0];
    for (const [k, w] of L.mix) { if (r < w) { kind = k; break; } r -= w; }
    list.push({ x, z, kind, seed: Math.floor(rnd() * 1e6) });
  }
  theme.snow = L.snow;
  theme.giant = (d - 1) % LANDS.length;
  world.pal = L.pal;
  world.scenery(d, d % LANDS.length); // beyond the wall: the next land
  world.liquid = L.liquid; terrain.amp = L.amp;
  const out = list.slice(0, 56); // (64 volumes: the land, plus six for the giant)
  // the hills, with a level pad under every building (sunk a little, so it sits in the ground)
  const ys = terrain.build(seed, out.map((b) => ({ x: b.x, z: b.z, half: (32 * 0.28 * (b.scale ?? 1)) / 2 + 0.6 })));
  out.forEach((b, k) => (b.y = ys[k] - 0.12));
  return out;
}
// progress is kept: the land you are on and how big the swarm has grown
const SAVE = "glowmites-save";
let saved: { land: number; active: number } = { land: 1, active: 800 };
try { const j = JSON.parse(localStorage.getItem(SAVE) || "null"); if (j && j.land >= 1) saved = j; } catch { /* private mode */ }
function save() { try { localStorage.setItem(SAVE, JSON.stringify({ land: district, active })); } catch { /* ignore */ } }
let lvlI = Math.min(LEVELS.length - 1, Math.max(0, params.has("lvl") ? Number(params.get("lvl")) - 1 : unlocked()));
let LV: Level = LEVELS[lvlI];
let district = LV.land;
void saved;
city.build(makeLand(district, LV.seed));


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
function xform(out: Float32Array, m: Float32Array, v: Float32Array) {
  for (let i = 0; i < 4; i++) out[i] = m[i] * v[0] + m[4 + i] * v[1] + m[8 + i] * v[2] + m[12 + i] * v[3];
}
let down = false;
countNInit();
function countNInit() { const el = document.getElementById("countN"); if (el) el.textContent = String(Number(params.get("start") ?? 800)); }
// ---------------------------------------------------------------- the saga: one short level at a time
let mine = 0, goldMine = 0, castle = -1, bossK = -1, bestActive = 400;
const hard = new Float32Array(64).fill(1);
const mapEl = document.getElementById("map")!, introEl = document.getElementById("intro")!, goalTxt = document.getElementById("goalTxt")!;
function startLevel(i: number) {
  lvlI = i; LV = LEVELS[i]; district = LV.land; roundLen = LV.time;
  city.build(makeLand(district, LV.seed)); resetRound();
  if (boostNext) { active = START_SIZE * 5; boostNext = false; }
  contactT.fill(0); hpOf.fill(1); hpPrev.fill(1); wasGone.fill(0); killer.fill(-1); hard.fill(1); combo = 0;
  giant = -1; parts = []; stompT = -1; giantState = "sleep"; won = false; progress = 0; landT = 0; firstBite = i > 0;
  if (i > 0) hand.classList.add("gone");
  mine = 0; goldMine = 0; castle = -1; bossK = -1; bestActive = START_SIZE;
  // which rivals play: none, some, or one giant red boss
  for (let k = 1; k < 4; k++) if (k > LV.rivals) { swarm.A[k] = 0; rv.dead[k] = Infinity; }
  if (LV.goal === "boss") { bossK = 2; swarm.A[2] = LV.n; rv.dead[2] = 0; swarm.L[6] = 0; swarm.L[8] = -36; }
  if (LV.goal === "castle") {
    // the biggest thing in the land, made far tougher: grow first, then bring it down
    let bs = -1; for (let b = 7; b < city.buildings.length; b++) if (city.buildings[b].solid > bs) { bs = city.buildings[b].solid; castle = b; }
    if (castle >= 0) hard[castle] = LV.n;
  }
  leader[0] = 0; leader[2] = 0; target[0] = 0; target[2] = 0; camX = 0; camZ = 0; swarm.reset = true; swarm.open = false; travel = -1; hasTarget = false; lastMove = time;
  roundT = -2.4; // the goal is shown first; the clock starts after it
  introEl.innerHTML = `<small>${i + 1}</small><div>${goalText(LV)}</div><em>⏱ ${LV.time}</em>`;
  introEl.classList.remove("show"); void introEl.offsetWidth; introEl.classList.add("show");
  boardEl.style.display = LV.rivals > 0 || bossK > 0 ? "" : "none";
  document.getElementById("fade")!.classList.remove("on");
  document.getElementById("win")!.classList.remove("show");
  mapEl.classList.remove("show");
  audio.chime(2);
  poki.gameplayStart();
}
/** how far the goal is done, 0..1 */
function goalProgress() {
  switch (LV.goal) {
    case "wreck": return mine / LV.n;
    case "gold": return goldMine / LV.n;
    case "grow": return active / LV.n;
    case "castle": return castle >= 0 ? (city.gone[castle] ? 1 : 1 - hpOf[castle]) : 0;
    case "boss": return bossK > 0 ? (rv.dead[bossK] > 0 && swarm.A[bossK] < 1 ? 1 : active / (active + swarm.A[bossK])) : 0;
    case "race": return Math.max(0, roundT) / roundLen;
  }
}
function checkGoal() {
  if (roundT < 0) return;
  const p = goalProgress();
  if (LV.goal === "race") { if (roundT >= roundLen) { const place = [1, 2, 3].filter((k) => sizeOf(k) > active).length; finishLevel(place < 3, 3 - place); } return; }
  const done = LV.goal === "boss" ? p >= 1 : p >= 1;
  if (done) { const left = 1 - roundT / roundLen; finishLevel(true, left > 0.4 ? 3 : left > 0.15 ? 2 : 1); }
  else if (roundT >= roundLen) finishLevel(false, 0);
}
let lastWin = false;
function finishLevel(win: boolean, stars: number) {
  roundOver = true; won = true; lastWin = win; poki.gameplayStop();
  if (win) { shake = 0.8; city.bloom = 2.5; saveStars(lvlI, stars); for (let i = 0; i < 3 + stars; i++) setTimeout(() => audio.chime(3 + i), i * 140); }
  else audio.thump(0.8);
  const fmt = (n: number) => n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
  let body = `<div class="lv">${lvlI + 1}</div><div class="st">${win ? "★".repeat(stars) + "☆".repeat(3 - stars) : "⏱"}</div>`;
  if (LV.goal === "race" || LV.rivals > 0 || bossK > 0) {
    const medal = ["🥇", "🥈", "🥉", "4"];
    const ks = [0, 1, 2, 3].filter((k) => k === 0 || k <= LV.rivals || k === bossK);
    body += ks.map((k) => ({ k, n: sizeOf(k) })).sort((a, b) => b.n - a.n).map((o, i) => `<div class="row${o.k === 0 ? " me" : ""}"><span>${medal[i]}</span><span>${o.k === 0 ? "✨" : o.k === bossK ? "👾" : RIVAL_NAMES[o.k]}</span><b>${fmt(o.n)}</b></div>`).join("");
  } else body += `<div class="row me"><span>${goalText(LV)}</span><b>${Math.min(100, Math.round(goalProgress() * 100))}%</b></div>`;
  document.getElementById("rank")!.innerHTML = body;
  const nextBtn = document.getElementById("next")!;
  nextBtn.textContent = win ? "▶" : "↻";
  document.getElementById("boost")!.classList.toggle("off", win);
  document.getElementById("boost")!.classList.remove("used");
  save();
  setTimeout(() => document.getElementById("win")!.classList.add("show"), win ? 1200 : 600);
}
let adBusy = false, boostNext = false;
function afterAd(fn: () => void) {
  if (adBusy) return; adBusy = true; audio.setMuted(true);
  poki.commercialBreak().then(() => { adBusy = false; audio.setMuted(false); fn(); });
}
document.getElementById("next")!.addEventListener("click", () => afterAd(() => startLevel(lastWin ? Math.min(LEVELS.length - 1, lvlI + 1) : lvlI)));
document.getElementById("mapBtn")!.addEventListener("click", () => afterAd(showMap));
function showMap() { document.getElementById("win")!.classList.remove("show"); renderMap(mapEl, (i) => startLevel(i)); mapEl.classList.add("show"); }
document.getElementById("boost")!.addEventListener("click", (e) => {
  // a rewarded ad: try again with a far bigger swarm
  if (adBusy) return; adBusy = true; audio.setMuted(true);
  const btn = e.currentTarget as HTMLElement;
  poki.rewardedBreak().then((ok) => {
    adBusy = false; audio.setMuted(false);
    if (ok) { btn.classList.add("used"); boostNext = true; startLevel(lvlI); }
  });
});
function nextLand() { finishLevel(true, 3); }
const timerEl = document.getElementById("timer")!, boardEl = document.getElementById("board")!;
const hand = document.getElementById("hand")!, countN = document.getElementById("countN")!, countBox = document.getElementById("count")!, goalFill = document.getElementById("goalFill")!;
// test builds only: five quick taps on the swarm counter skip to the next land
const SKIP_TEST = import.meta.env.MODE !== "poki";
let taps = 0, skipT = 0;
countBox.style.pointerEvents = "auto";
countBox.addEventListener("pointerdown", () => { if (!SKIP_TEST) return; const n = performance.now(); taps = n - skipT < 600 ? taps + 1 : 1; skipT = n; if (taps >= 5) { taps = 0; nextLand(); } });
let touched = false;
// pointers: one finger (or the mouse) steers; two fingers pinch to zoom; the wheel zooms too
const ptrs = new Map<number, { x: number; y: number }>();
let pinch0 = 0, zoom0 = 1, userZoom = 1, aimX = 0, aimY = 0, aiming = false;
canvas.addEventListener("pointerdown", (e) => {
  audio.start();
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = userZoom; aiming = false; }
  else { down = true; aiming = true; aimX = e.clientX; aimY = e.clientY; tapT = time; tapX = e.clientX; tapY = e.clientY; }
  lastMove = time;
  if (!touched) { touched = true; hand.classList.add("gone"); }
  if (!document.getElementById("win")!.classList.contains("show")) poki.gameplayStart();
});
addEventListener("pointermove", (e) => {
  const p = ptrs.get(e.pointerId);
  if (p) { p.x = e.clientX; p.y = e.clientY; }
  if (ptrs.size === 2 && pinch0 > 0) {
    const [a, b] = [...ptrs.values()];
    userZoom = Math.min(2.6, Math.max(0.4, zoom0 * pinch0 / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y))));
    return;
  }
  if (down || e.pointerType === "mouse") { aiming = true; aimX = e.clientX; aimY = e.clientY; lastMove = time; }
});
const lift = (e: PointerEvent) => {
  // a quick tap is a punch: the whole swarm lunges at that spot and hits hard
  if (ptrs.size === 1 && time - tapT < 0.28 && Math.hypot(e.clientX - tapX, e.clientY - tapY) < 24) { pick(e.clientX, e.clientY); dashT = 0.5; shake = Math.max(shake, 0.35); audio.thump(0.45); }
  ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0; if (ptrs.size === 0) down = false; };
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

// ---------------------------------------------------------------- the growing swarm (phase 1 demo: grows by itself)
const CAP = Math.min(TEAM_CAP[0], Number(params.get("n") ?? TEAM_CAP[0]));
// ---------------------------------------------------------------- the round: two minutes, you and three rival swarms
/** a rival that trails the player eats faster, so the race stays close */
const catchUp = (k: number) => Math.min(2.2, Math.max(1, (sizeOf(0) + 200) / (swarm.A[k] + 200)));
/** the golden target: one building at a time is worth a big burst; everyone races for it */
const TEAM_CSS = ["#ffc05a", "#5aa6ff", "#ff4d5a", "#73ff73"];
let gold = -1, goldNext = 5, goldCount = 0;
let roundLen = 90; const START_SIZE = 400;
const RIVAL_NAMES = ["", "🔵", "🔴", "🟢"];
let roundT = 0, roundOver = false;
const rv = { tx: new Float32Array(4), tz: new Float32Array(4), think: new Float32Array(4), dead: new Float32Array(4), meal: new Float32Array(4) };
const contactBy = new Float32Array(64 * 4);
let playerDead = 0, safeT = 0;
function resetRound() {
  gold = -1; goldNext = 5; goldCount = 0;
  roundT = 0; roundOver = false; active = START_SIZE; meal = 0; playerDead = 0; milestone = 0;
  for (let k = 1; k < 4; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.6;
    swarm.L[k * 3] = Math.cos(a) * 40; swarm.L[k * 3 + 2] = Math.sin(a) * 40; swarm.L[k * 3 + 1] = terrain.floor(swarm.L[k * 3], swarm.L[k * 3 + 2]);
    swarm.LV.fill(0, k * 3, k * 3 + 3); swarm.A[k] = START_SIZE; rv.think[k] = 0; rv.dead[k] = 0; rv.meal[k] = 0;
  }
  contactBy.fill(0);
}
/** which swarm is working on building b right now (the nearest leader in reach), -1 if none */
function teamAt(x: number, z: number, reach: number) {
  let best = -1, bd = 1e9;
  for (let k = 0; k < 4; k++) {
    const A = k === 0 ? active : swarm.A[k]; if (A < 1) continue;
    const lx = k === 0 ? leader[0] : swarm.L[k * 3], lz = k === 0 ? leader[2] : swarm.L[k * 3 + 2];
    const d = Math.hypot(x - lx, z - lz) - (3 + Math.sqrt(A) * 0.05);
    if (d < reach && d < bd) { bd = d; best = k; }
  }
  return best;
}
function sizeOf(k: number) { return k === 0 ? active : swarm.A[k]; }
// "grow=1" is the phase-1 stress demo (grows by itself); the game grows only by eating
const grow = params.get("grow") === "1";
let active = grow ? 100 : Number(params.get("start") ?? START_SIZE);
let meal = 0;
queueMicrotask(() => startLevel(lvlI));
let landT = 0, firstBite = false;
const contactT = new Float32Array(64), hpOf = new Float32Array(64).fill(1), killer = new Int8Array(64);
let gContact = 0, gHp = 1;
let travel = -1; // >= 0: the swarm is marching out of the north gate to the next land
// ---------------------------------------------------------------- the stone giant: wakes when the village is mostly colour again
// The giant is six volumes (head, body, two arms, two legs), each with its own fine detail, moved every frame:
// legs step, arms swing, the body bobs, a leg lifts high and slams down to stomp. When it is beaten, the parts fall.
const PART_SCALE = [0.62, 0.95, 0.7, 0.7, 0.75, 0.75];
let giant = -1, giantState: "sleep" | "rise" | "walk" | "fallen" = "sleep", giantT = 0, giantY = 0, nextStomp = 0, won = false;
let parts: number[] = [], gM = 1, gX = 0, gZ = 0, gPhase = 0, gDirX = 0, gDirZ = 1, stompT = -1;
const partY = new Float32Array(6), partVY = new Float32Array(6), partX = new Float32Array(6), partZ = new Float32Array(6);
const isPart = (b: number) => parts.indexOf(b) >= 0;
const giantGone = () => parts.length > 0 && parts.every((p) => city.gone[p]);
function giantSolid() { let t = 0, e = 0; for (const p of parts) { const B = city.buildings[p]; t += B.solid; e += Math.min(B.solid, B.eaten); } return e / Math.max(1, t); }
/** where every part goes this frame: a walk cycle (and a stomp) around the giant's feet at (gX, gZ) */
function poseGiant(baseY: number) {
  const m = gM, VSZ = 32 * 0.28;
  const legH = VSZ * PART_SCALE[4] * m * 0.97, bodyH = VSZ * PART_SCALE[1] * m * 0.94;
  const sw = Math.sin(gPhase), walking = giantState === "walk" ? 1 : 0;
  const lift = [Math.max(0, sw), Math.max(0, -sw)], fwd = [Math.cos(gPhase), -Math.cos(gPhase)];
  // a stomp: the left leg rises high, then slams
  let stompLift = 0;
  if (stompT >= 0) { const t = stompT; stompLift = t < 0.55 ? Math.sin((t / 0.55) * Math.PI * 0.5) * 3.2 : Math.max(0, 1 - (t - 0.55) / 0.12) * 3.2; }
  const bob = Math.abs(sw) * 0.35 * m * walking;
  const side = [-1, 1];
  const set = (i: number, ox: number, oy: number, oz: number) => { partX[i] = gX + ox; partZ[i] = gZ + oz; partY[i] = baseY + oy; };
  for (let k = 0; k < 2; k++) { // legs
    const l = (lift[k] * 1.1 * walking + (k === 0 ? stompLift : 0)) * m, f = fwd[k] * 0.9 * m * walking;
    set(4 + k, side[k] * 2.1 * m + gDirX * f, l, side[k] * 0 + gDirZ * f);
  }
  const by = legH - 0.9 * m + bob;
  set(1, 0, by, 0);
  for (let k = 0; k < 2; k++) { // arms swing against the legs
    const f = -fwd[k] * 0.8 * m * walking;
    set(2 + k, side[k] * 5.1 * m + gDirX * f, by + bodyH - VSZ * PART_SCALE[2] * m * 0.98 + 0.4 * m, gDirZ * f);
  }
  set(0, 0, by + bodyH - 0.6 * m + bob * 0.5, 0);
}
let GIANT_H = 20;
let progress = 0;
// what the new mites look like: the colours of what the swarm is eating
const BIRTH: number[][] = [[3, 1, 2, 4], [8, 9, 7, 10], [6, 14, 13, 6], [15, 11, 2, 16], [6, 17, 19, 6], [17, 19, 10, 6], [10, 9, 8, 13], [20, 21, 22, 20], [24, 24, 7, 23], [27, 1, 6, 4], [25, 25, 26, 25]];
const GIANT_BIRTH: number[][] = [[17, 19, 10, 6], [20, 21, 22, 20], [27, 12, 13, 14], [23, 23, 17, 25], [26, 25, 18, 25]];
city.onEat = (b, amount) => {
  // every voxel eaten hatches new mites, for whichever swarm is eating it
  { const B0 = city.buildings[b], k = teamAt(B0.x, B0.z, 8); if (k === 0) meal += amount * 0.7; else if (k > 0) rv.meal[k] += amount * (k === bossK ? 0.35 : 1.1 * catchUp(k)); if (k !== 0) return; }
  { const k = city.buildings[b].kind; const m = k === 5 ? GIANT_BIRTH[theme.giant % 5] : BIRTH[k]; if (m) swarm.birth.set(m); }
  audio.eat(amount);
  const B = city.buildings[b];
  // a building is gone when (nearly) all of it, rubble included, has been eaten
  // (the last bits, half sunk in the ground or tucked under rubble, crumble away with it)
  if (!city.gone[b] && B.eaten > B.solid * 0.88) { city.remove(b); audio.thump(0.3); }
  // the first big bites of a building shake the camera a little (things are coming down)
  // structural failure: a fifth of a building gone and the rest comes down (trees a little later)
  const failAt = B.kind === 1 ? 0.3 : B.kind === 6 ? 0.5 : B.kind === 5 ? 0.45 : 0.3;
  if (B.eaten > B.solid * failAt && B.collapseAt < 0 && !isPart(b)) {
    B.collapseAt = time; city.fail(b); firstBite = true;
    shake = B.kind === 6 ? 0.2 : 0.9; audio.thump(B.kind === 1 || B.kind === 6 ? 0.6 : 1.2);
  }
};

// ---------------------------------------------------------------- the readable layer: health bars, the boss bar, arrows to what is left, combos
const fx = document.getElementById("fx") as HTMLCanvasElement, fctx = fx.getContext("2d")!;
const bossEl = document.getElementById("boss")!, bossFill = document.getElementById("bossFill")!, leftEl = document.getElementById("left")!, comboEl = document.getElementById("combo")!;
const hpPrev = new Float32Array(64).fill(1), hpFlash = new Float32Array(64), wasGone = new Uint8Array(64);
let bossPrev = 1, combo = 0, lastKill = -9, fxW = 0, fxH = 0;
function project(x: number, y: number, z: number, out: Float32Array) {
  const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  out[0] = ((vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / w * 0.5 + 0.5) * fxW;
  out[1] = (0.5 - (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / w * 0.5) * fxH;
  out[2] = w;
}
const pr = new Float32Array(3);
function drawFx(dt: number) {
  const dpr = Math.min(2, devicePixelRatio || 1), W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
  if (fx.width !== W || fx.height !== H) { fx.width = W; fx.height = H; }
  fxW = W; fxH = H;
  fctx.clearRect(0, 0, W, H);
  let left = 0;
  const offs: { d: number; x: number; z: number }[] = [];
  for (let b = 0; b < city.buildings.length; b++) {
    if (isPart(b)) continue;
    const B = city.buildings[b];
    // destroyed: count the combo
    if (city.gone[b]) {
      if (!wasGone[b] && killer[b] !== 0) wasGone[b] = 1;
      if (!wasGone[b]) { wasGone[b] = 1; combo = time - lastKill < 4 ? combo + 1 : 1; lastKill = time; meal += 30 * combo; if (combo >= 2) { comboEl.style.color = ""; comboEl.textContent = `×${combo}`; comboEl.classList.remove("pop"); void comboEl.offsetWidth; comboEl.classList.add("pop"); audio.chime(Math.min(9, combo + 2)); } }
      continue;
    }
    wasGone[b] = 0; left++;
    const sc = city.s2Arr[b * 4] || 1, top = city.s2Arr[b * 4 + 1] + B.h * 0.28 * sc + 0.6;
    const hp = hpOf[b];
    if (hp < hpPrev[b] - 0.0015) hpFlash[b] = 1;
    hpPrev[b] = hp; hpFlash[b] = Math.max(0, hpFlash[b] - dt * 3.5);
    const dist = Math.hypot(B.x - leader[0], B.z - leader[2]);
    project(B.x, top, B.z, pr);
    const on = pr[2] > 0 && pr[0] > 0 && pr[0] < W && pr[1] > 0 && pr[1] < H;
    if (!on) { offs.push({ d: dist, x: B.x, z: B.z }); continue; }
    if (hp > 0.999 && dist > 22) continue;
    // a bar above the thing: green, then yellow, then red; it flashes red every time it loses a bit
    const bw = Math.max(26, Math.min(90, 2600 / pr[2])) * dpr * 0.6, bh = (5 + 4 * hpFlash[b]) * dpr;
    const x0 = pr[0] - bw / 2, y0 = pr[1] - bh;
    fctx.fillStyle = "rgba(10,10,20,0.65)"; fctx.fillRect(x0 - dpr, y0 - dpr, bw + 2 * dpr, bh + 2 * dpr);
    fctx.fillStyle = `hsl(${Math.round(hp * 115)},90%,${50 + hpFlash[b] * 25}%)`; fctx.fillRect(x0, y0, bw * hp, bh);
    if (hpFlash[b] > 0) { fctx.fillStyle = `rgba(255,40,30,${hpFlash[b] * 0.7})`; fctx.fillRect(x0 - 2 * dpr, y0 - 2 * dpr, bw + 4 * dpr, bh + 4 * dpr); }
  }
  // arrows at the edge of the screen to the nearest things still standing
  offs.sort((a, c) => a.d - c.d);
  for (let k = 0; k < Math.min(3, offs.length); k++) {
    project(offs[k].x, 1, offs[k].z, pr);
    let ax = pr[0] - W / 2, ay = pr[1] - H / 2;
    if (pr[2] < 0) { ax = -ax; ay = -ay; }
    const a = Math.atan2(ay, ax), m = Math.min((W / 2 - 40 * dpr) / Math.abs(Math.cos(a) || 1e-3), (H / 2 - 50 * dpr) / Math.abs(Math.sin(a) || 1e-3));
    const px = W / 2 + Math.cos(a) * m, py = H / 2 + Math.sin(a) * m, s = (16 - k * 3) * dpr, pulse = 0.65 + 0.35 * Math.sin(time * 6 + k);
    fctx.save(); fctx.translate(px, py); fctx.rotate(a);
    fctx.fillStyle = `rgba(255,214,110,${pulse})`; fctx.shadowColor = "rgba(255,160,60,0.9)"; fctx.shadowBlur = 12 * dpr;
    fctx.beginPath(); fctx.moveTo(s, 0); fctx.lineTo(-s * 0.7, s * 0.7); fctx.lineTo(-s * 0.35, 0); fctx.lineTo(-s * 0.7, -s * 0.7); fctx.closePath(); fctx.fill();
    fctx.restore();
  }
  // the golden target: a big star over it, or a big gold arrow at the edge when it is off screen
  for (const [mb, icon] of [[gold, "🌟"], [castle, "🏰"]] as [number, string][]) {
    if (mb < 0 || city.gone[mb]) continue;
    const B = city.buildings[mb], sc = city.s2Arr[mb * 4] || 1;
    project(B.x, city.s2Arr[mb * 4 + 1] + B.h * 0.28 * sc + 2.5, B.z, pr);
    const on = pr[2] > 0 && pr[0] > 0 && pr[0] < W && pr[1] > 0 && pr[1] < H, pulse = 1 + 0.15 * Math.sin(time * 7);
    fctx.save(); fctx.textAlign = "center"; fctx.textBaseline = "middle"; fctx.shadowColor = "rgba(255,200,40,1)"; fctx.shadowBlur = 18 * dpr;
    if (on) { fctx.font = `${Math.round(38 * dpr * pulse)}px sans-serif`; fctx.fillText(icon, pr[0], pr[1] - 10 * dpr * Math.sin(time * 3)); }
    else {
      let ax = pr[0] - W / 2, ay = pr[1] - H / 2; if (pr[2] < 0) { ax = -ax; ay = -ay; }
      const a = Math.atan2(ay, ax), m = Math.min((W / 2 - 46 * dpr) / Math.abs(Math.cos(a) || 1e-3), (H / 2 - 60 * dpr) / Math.abs(Math.sin(a) || 1e-3));
      const px = W / 2 + Math.cos(a) * m, py = H / 2 + Math.sin(a) * m, s2 = 26 * dpr * pulse;
      fctx.font = `${Math.round(30 * dpr)}px sans-serif`; fctx.fillText(icon, px - Math.cos(a) * 34 * dpr, py - Math.sin(a) * 34 * dpr);
      fctx.translate(px, py); fctx.rotate(a); fctx.fillStyle = "#ffd23c";
      fctx.beginPath(); fctx.moveTo(s2, 0); fctx.lineTo(-s2 * 0.7, s2 * 0.75); fctx.lineTo(-s2 * 0.3, 0); fctx.lineTo(-s2 * 0.7, -s2 * 0.75); fctx.closePath(); fctx.fill();
    }
    fctx.restore();
  }
  // a crown floats over whoever is biggest right now
  if (LV.rivals > 0 || bossK > 0) { let top = 0; for (let k = 1; k < 4; k++) if (sizeOf(k) > sizeOf(top)) top = k;
    if (top === bossK) { /* the boss wears no crown: it is the boss */ }
    const x = top === 0 ? leader[0] : swarm.L[top * 3], z = top === 0 ? leader[2] : swarm.L[top * 3 + 2], y = (top === 0 ? leader[1] : swarm.L[top * 3 + 1]) + 3 + Math.sqrt(sizeOf(top)) * 0.03;
    project(x, y, z, pr);
    if (sizeOf(top) > 0 && pr[2] > 0) { fctx.save(); fctx.textAlign = "center"; fctx.font = `${Math.round((top === 0 ? 34 : 28) * dpr)}px sans-serif`; fctx.fillText("👑", pr[0], pr[1] + 4 * dpr * Math.sin(time * 4)); fctx.restore(); } }
  leftEl.textContent = ""; void left;
  // the giant's own bar at the top: it flashes on every hit
  const up = giant >= 0 && !giantGone() && giantState !== "fallen" && giantState !== "sleep";
  bossEl.classList.toggle("on", up);
  if (up) {
    const hp = gHp;
    bossFill.style.width = `${(hp * 100).toFixed(1)}%`;
    bossEl.classList.toggle("hit", hp < bossPrev - 0.001);
    bossPrev = hp;
  } else bossPrev = 1;
}

// ---------------------------------------------------------------- loop
let time = 0, last = 0, refreshSamples = 0, refreshAcc = 0;
function frame(now: number) {
  requestAnimationFrame(frame);
  const ms = last ? now - last : 16.7;
  last = now;
  if (refreshSamples < 90 && ms < 40) { refreshAcc += ms; refreshSamples++; if (refreshSamples === 90) gov.setRefresh(1000 / (refreshAcc / 90)); }
  gov.push(ms);
  const dt = Math.min(1 / 30, ms / 1000);
  time += dt;
  if (forcedTier === null) gov.update(dt);
  const tier = TIERS[gov.tier];

  if (grow && active < CAP) active = Math.min(CAP, Math.round(100 * Math.pow(2, time / 3.6)));
  if (meal >= 1) { const add = Math.floor(meal); meal -= add; active = Math.min(CAP, active + add); }
  // district progress (also drives the goal bar)
  { let tot = 0, eat = 0; for (let b = 0; b < city.buildings.length; b++) { if (isPart(b)) continue; const B = city.buildings[b]; tot += B.solid; eat += city.gone[b] ? B.solid : Math.min(B.solid, B.eaten); } progress = Math.min(1, (eat / Math.max(1, tot)) * 1.15); }
  swarm.shock[3] = 0;
  if (giant < 0 && params.get("giant") === "1" && time > 1.5) {
    // it rises on the far side of the swarm from the camera, so the player sees it come up out of the ground
    const ang = Math.atan2(leader[2] - cam[2], leader[0] - cam[0]);
    gX = Math.max(-50, Math.min(50, leader[0] + Math.cos(ang) * 34)); gZ = Math.max(-50, Math.min(50, leader[2] + Math.sin(ang) * 34));
    gM = landOf(district).giant / 2.4;
    GIANT_H = 32 * 0.28 * gM * 2.4;
    const lap = Math.floor((district - 1) / LANDS.length);
    // each land's giant is tougher than the last (and tougher again on every lap)
    const tough = [0.24, 0.21, 0.19, 0.17, 0.15][(district - 1) % LANDS.length] / (1 + lap * 0.3);
    parts = [];
    for (let k = 0; k < 6; k++) { theme.part = k; const b = city.add({ x: gX, z: gZ, kind: 5, seed: 4242 + district * 7 + k }, PART_SCALE[k] * gM, -40, tough); if (b >= 0) parts.push(b); }
    giant = parts[0] ?? -1;
    giantState = "rise"; giantT = 0; gContact = 0; gHp = 1; audio.thump(1.4); shake = 1.2;
  }
  if (giant >= 0 && !giantGone()) {
    giantT += dt;
    const ground = terrain.floor(gX, gZ);
    if (giantState === "rise") {
      giantY = -GIANT_H * Math.max(0, 1 - giantT / 3.2) ** 2;
      shake = Math.max(shake, 0.5);
      if (giantT > 3.2) { giantState = "walk"; giantY = 0; nextStomp = giantT + 1.5; }
      poseGiant(ground + giantY);
    } else if (giantState === "walk") {
      const dx = leader[0] - gX, dz = leader[2] - gZ, d = Math.hypot(dx, dz);
      if (d > 0.1) { gDirX += (dx / d - gDirX) * Math.min(1, dt * 2); gDirZ += (dz / d - gDirZ) * Math.min(1, dt * 2); }
      const hurt = 1 - gHp;
      const moving = d > 5 && stompT < 0;
      if (moving) { const step = Math.min(d, (2.2 + hurt * 1.2) * dt * gM); gX += (dx / d) * step; gZ += (dz / d) * step; gPhase += dt * (3.2 + hurt * 1.5); }
      if (stompT >= 0) {
        stompT += dt;
        if (stompT >= 0.67 && stompT - dt < 0.67) { // the slam
          swarm.shock[0] = gX; swarm.shock[1] = gZ; swarm.shock[2] = (16 + hurt * 8) * gM; swarm.shock[3] = 22 + hurt * 14;
          shake = Math.max(shake, 1.0); audio.thump(1.2);
        }
        if (stompT > 1.0) stompT = -1;
      } else if (giantT >= nextStomp) { stompT = 0; nextStomp = giantT + 2.4 - hurt * 1.0; }
      poseGiant(terrain.floor(gX, gZ));
      // beaten: half of it eaten, it falls apart
      if (gHp <= 0) {
        giantState = "fallen"; shake = 1.4; audio.thump(1.6); stompT = -1;
        for (let k = 0; k < 6; k++) { partVY[k] = 2 + Math.random() * 3; partX[k] += (Math.random() - 0.5) * 4 * gM; partZ[k] += (Math.random() - 0.5) * 4 * gM; }
      }
    } else if (giantState === "fallen") {
      // the parts tumble down onto the ground, and each one crumbles where it lands
      for (let k = 0; k < parts.length; k++) {
        const g = terrain.floor(partX[k], partZ[k]) - 0.15;
        if (partY[k] > g) { partVY[k] -= 22 * dt; partY[k] = Math.max(g, partY[k] + partVY[k] * dt); if (partY[k] === g) { const B = city.buildings[parts[k]]; if (B.collapseAt < 0) { B.collapseAt = time; city.fail(parts[k]); shake = Math.max(shake, 0.8); audio.thump(0.9); } } }
      }
    }
    for (let k = 0; k < parts.length; k++) if (!city.gone[parts[k]]) city.place(parts[k], partX[k], partZ[k], partY[k]);
  }
  if (giant >= 0 && giantGone() && !won) {
    won = true; shake = 1; city.bloom = 3.5;
    save(); poki.gameplayStop();
    finishLevel(true, 3);
    for (let i = 0; i < 6; i++) setTimeout(() => audio.chime(4 + i), i * 160);
  }
  while (milestone < MILESTONES.length && active >= MILESTONES[milestone]) audio.chime(milestone++);
  audio.swarm(active, Math.hypot(leaderVel[0], leaderVel[2]));
  // left alone (no touch, no mouse move) the swarm gathers into a shape; the next touch bursts it back
  const fighting = giant >= 0 && !giantGone() && giantState !== "fallen";
  const idle = !down && time - lastMove > 1.0 && time > 3 && !fighting && !won && travel < 0;
  if (travel >= 0) {
    travel += dt; swarm.open = true;
    target[0] = 0; target[2] = -70; hasTarget = true; aiming = false;
    if (travel > 2.2) document.getElementById("fade")!.classList.add("on");
    if (travel > 2.8) nextLand();
  }
  const sh = swarm.shape;
  if (idle && shapeOn && sh.blend > 0.95) { shapeT += dt; if (shapeT > 5) { shapeT = 0; shapeK = nextShape(shapeK); loadShape(shapeK, sh); } } // one shape melts into the next
  if (idle && !shapeOn) { shapeOn = true; shapeT = 0; loadShape(shapeK, sh); sh.pos[0] = leader[0]; sh.pos[2] = leader[2]; sh.pos[1] = terrain.floor(leader[0], leader[2]); }
  if (!idle && shapeOn && sh.blend < 0.05) { shapeOn = false; shapeK = nextShape(shapeK); }
  sh.blend = shapeOn && idle ? Math.min(1, sh.blend + dt * 2.2) : Math.max(0, sh.blend - dt * 3);
  sh.scale = 2.4 + Math.sqrt(active) * 0.07;
  if (shapeOn && idle) { target[0] = leader[0]; target[2] = leader[2]; }
  else if (aiming && (down || !("ontouchstart" in window))) pick(aimX, aimY);
  { const r = Math.hypot(target[0], target[2]), lim = WALL - 4; if (r > lim && travel < 0) { target[0] *= lim / r; target[2] *= lim / r; } }
  const speed = 8.5 + Math.sqrt(active) * 0.025;
  const dx = target[0] - leader[0], dz = target[2] - leader[2], d = Math.hypot(dx, dz);
  // the seed is the finger: it gets there fast, easing in at the end
  dashT = Math.max(0, dashT - dt);
  const vmax = speed * (dashT > 0 ? 3.2 : 1.25);
  const vx = d > 0.01 ? (dx / d) * Math.min(d * (dashT > 0 ? 8 : 3.5), vmax) : 0, vz = d > 0.01 ? (dz / d) * Math.min(d * (dashT > 0 ? 8 : 3.5), vmax) : 0;
  leaderVel[0] += (vx - leaderVel[0]) * Math.min(1, dt * 7); leaderVel[2] += (vz - leaderVel[2]) * Math.min(1, dt * 7);
  leader[0] += leaderVel[0] * dt; leader[2] += leaderVel[2] * dt;
  leader[1] = terrain.floor(leader[0], leader[2]);

  // health: the swarm touching something drains it at a steady, readable rate (a fast pass drains more, a punch most);
  // at zero it comes down and crumbles away. The pieces eaten along the way count too.
  const swarmR = 3 + Math.sqrt(active) * 0.05;
  const hitRate = (1 + 1.5 * Math.min(1.3, Math.hypot(leaderVel[0], leaderVel[2]) / speed) + (dashT > 0 ? 4 : 0)) * (1 + Math.sqrt(active) / 150);
  for (let b = 0; b < city.buildings.length; b++) {
    if (city.gone[b] || isPart(b)) continue;
    const B = city.buildings[b];
    const sc = city.s2Arr[b * 4] || 1, half = (32 * 0.28 * sc) / 2;
    if (active > 0 && Math.hypot(B.x - leader[0], B.z - leader[2]) < half + swarmR * 0.95) { contactT[b] += dt * hitRate; contactBy[b * 4] += dt * hitRate; }
    for (let k = 1; k < 4; k++) {
      const A = swarm.A[k]; if (A < 1) continue;
      const rr = 3 + Math.sqrt(A) * 0.05, rate = 1.6 * (1 + Math.sqrt(A) / 150);
      if (Math.hypot(B.x - swarm.L[k * 3], B.z - swarm.L[k * 3 + 2]) < half + rr * 0.95) { contactT[b] += dt * rate; contactBy[b * 4 + k] += dt * rate; }
    }
    const T = (0.6 + B.solid / 2500) / Math.max(0.2, city.s2Arr[b * 4 + 2]) * 0.5 * hard[b];
    hpOf[b] = Math.max(0, 1 - Math.max(B.eaten / (B.solid * 0.88), contactT[b] / T));
    if (hpOf[b] <= 0) {
      if (B.collapseAt < 0) { B.collapseAt = time; city.fail(b); audio.thump(0.8); shake = Math.max(shake, 0.6); }
      else if (time - B.collapseAt > 0.7) {
        // whoever did most of the work gets the prize: a burst of new mites
        let kb = 0; for (let k = 1; k < 4; k++) if (contactBy[b * 4 + k] > contactBy[b * 4 + kb]) kb = k;
        killer[b] = kb; const prize = 40 + B.solid * 0.05;
        if (kb === 0) mine++;
        if (kb === 0) meal += prize; else rv.meal[kb] += prize * (kb === bossK ? 0.4 : 1.3 * catchUp(kb));
        if (b === gold) {
          const bonus = Math.round(Math.max(700, sizeOf(kb) * 0.45) * (kb === 0 ? 1 : catchUp(kb)));
          if (kb === 0) { meal += bonus; goldMine++; audio.chime(9); shake = Math.max(shake, 1); } else rv.meal[kb] += bonus;
          comboEl.textContent = kb === 0 ? `🌟 +${bonus}` : `🌟 ✖`; comboEl.style.color = kb === 0 ? "" : TEAM_CSS[kb];
          comboEl.classList.remove("pop"); void comboEl.offsetWidth; comboEl.classList.add("pop");
          gold = -1; goldNext = roundT + (LV.goal === "gold" ? 1.5 : 7);
        }
        city.remove(b);
      }
    }
  }
  // the giant: the same, on a bigger scale (punch it!)
  if (giant >= 0 && giantState === "walk") {
    if (Math.hypot(gX - leader[0], gZ - leader[2]) < 5 * gM + swarmR * 0.6) gContact += dt * hitRate / (1 + Math.sqrt(active) / 150) * (1 + Math.sqrt(active) / 400);
    const TG = (14 + ((district - 1) % LANDS.length) * 3) * (1 + Math.floor((district - 1) / LANDS.length) * 0.3);
    gHp = Math.max(0, 1 - Math.max(giantSolid() / 0.5, gContact / TG));
  }
  if (giantState === "fallen") for (let k = 0; k < parts.length; k++) { const B = city.buildings[parts[k]]; if (!city.gone[parts[k]] && B.collapseAt >= 0 && time - B.collapseAt > 1.4 + k * 0.25) { city.remove(parts[k]); audio.thump(0.5); } }
  // ---- the rivals: each one hunts what it can eat and runs from what can eat it
  if (!roundOver) roundT += dt;
  bestActive = Math.max(bestActive, active);
  // a new golden target: a big building, not too close to anyone, a little farther each time
  if (gold >= 0 && city.gone[gold]) { gold = -1; goldNext = roundT + (LV.goal === "gold" ? 1.5 : 7); }
  if (gold < 0 && !roundOver && (LV.goal === "gold" || LV.goal === "race") && roundT > (LV.goal === "gold" ? 0.5 : goldNext) && roundT < roundLen - 6) {
    let best = -1, bs = -1;
    for (let b = 0; b < city.buildings.length; b++) { if (city.gone[b] || isPart(b) || city.buildings[b].collapseAt >= 0) continue; const B = city.buildings[b];
      let near = 1e9; for (let k = 0; k < 4; k++) { const x = k === 0 ? leader[0] : swarm.L[k * 3], z = k === 0 ? leader[2] : swarm.L[k * 3 + 2]; near = Math.min(near, Math.hypot(B.x - x, B.z - z)); }
      const sc = (B.solid + 300) * Math.min(1, near / 18) * (0.6 + Math.random() * 0.8); if (sc > bs) { bs = sc; best = b; } }
    if (best >= 0) { gold = best; goldCount++; audio.chime(6); }
  }
  for (let k = 1; k < 4; k++) {
    if (roundT < 0 || roundOver) { swarm.LV[k * 3] = 0; swarm.LV[k * 3 + 2] = 0; swarm.SP[k] = 8; continue; }
    if (rv.dead[k] > 0) { rv.dead[k] -= dt; if (rv.dead[k] <= 0) { const a = Math.random() * 6.28; swarm.L[k * 3] = Math.cos(a) * 45; swarm.L[k * 3 + 2] = Math.sin(a) * 45; swarm.A[k] = Math.max(300, Math.floor(sizeOf(0) * 0.35)); } continue; }
    if (rv.meal[k] >= 1) { const add = Math.floor(rv.meal[k]); rv.meal[k] -= add; swarm.A[k] = Math.min(TEAM_CAP[k], swarm.A[k] + add); }
    const A = swarm.A[k], lx = swarm.L[k * 3], lz = swarm.L[k * 3 + 2];
    rv.think[k] -= dt;
    if (rv.think[k] <= 0) {
      rv.think[k] = 0.25 + Math.random() * 0.25;
      let tx = NaN, tz = NaN, flee = false;
      for (let j = 0; j < 4; j++) { if (j === k) continue; const B = sizeOf(j); if (B < 1) continue;
        const jx = j === 0 ? leader[0] : swarm.L[j * 3], jz = j === 0 ? leader[2] : swarm.L[j * 3 + 2], d = Math.hypot(jx - lx, jz - lz);
        if (B > A * 1.15 && d < 22 + Math.sqrt(B) * 0.04) { tx = lx + (lx - jx); tz = lz + (lz - jz); flee = true; break; }
        if (A > B * 1.15 && (d < (j === 0 ? 45 : 32) || (k === bossK && j === 0)) && Number.isNaN(tx) && roundT > (k === bossK ? 3 : 8) && !(j === 0 && safeT > 0)) { tx = jx; tz = jz; } }
      if (!flee && Number.isNaN(tx)) {
        let best = -1, bs = -1;
        for (let b = 0; b < city.buildings.length; b++) { if (city.gone[b]) continue; const B = city.buildings[b]; const d = Math.hypot(B.x - lx, B.z - lz); const sc = (B.solid + 400) / (d + 8) * (b === gold ? 9 : 1); if (sc > bs) { bs = sc; best = b; } }
        if (best >= 0) { tx = city.buildings[best].x; tz = city.buildings[best].z; } else { tx = (Math.random() - 0.5) * 80; tz = (Math.random() - 0.5) * 80; }
      }
      const r = Math.hypot(tx, tz); if (r > WALL - 6) { tx *= (WALL - 6) / r; tz *= (WALL - 6) / r; }
      rv.tx[k] = tx; rv.tz[k] = tz;
    }
    const sp = (8.5 + Math.sqrt(A) * 0.025) * (A > sizeOf(0) ? 0.97 : 0.92);
    const ddx = rv.tx[k] - lx, ddz = rv.tz[k] - lz, dd = Math.hypot(ddx, ddz);
    const wx = dd > 0.01 ? (ddx / dd) * Math.min(dd * 3, sp * 1.2) : 0, wz = dd > 0.01 ? (ddz / dd) * Math.min(dd * 3, sp * 1.2) : 0;
    swarm.LV[k * 3] += (wx - swarm.LV[k * 3]) * Math.min(1, dt * 5); swarm.LV[k * 3 + 2] += (wz - swarm.LV[k * 3 + 2]) * Math.min(1, dt * 5);
    swarm.L[k * 3] += swarm.LV[k * 3] * dt; swarm.L[k * 3 + 2] += swarm.LV[k * 3 + 2] * dt;
    swarm.L[k * 3 + 1] = terrain.floor(swarm.L[k * 3], swarm.L[k * 3 + 2]); swarm.SP[k] = sp;
  }
  // ---- swarm eats swarm: a clearly bigger swarm that catches a smaller one drains it into itself
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    if (i === j) continue;
    const Ai = sizeOf(i), Aj = sizeOf(j); if (Ai < 1 || Aj < 1 || Ai < Aj * 1.15 || roundT < (bossK > 0 ? 2 : 7) || roundOver || (j === 0 && safeT > 0)) continue;
    const ix = i === 0 ? leader[0] : swarm.L[i * 3], iz = i === 0 ? leader[2] : swarm.L[i * 3 + 2], jx = j === 0 ? leader[0] : swarm.L[j * 3], jz = j === 0 ? leader[2] : swarm.L[j * 3 + 2];
    const reach = (4 + Math.sqrt(Ai) * 0.05 + Math.sqrt(Aj) * 0.05) * 0.8;
    if (Math.hypot(ix - jx, iz - jz) > reach) continue;
    const take = Math.min(Aj, Math.ceil(dt * (Ai * 0.35 + 300)));
    if (j === 0) { active -= take; shake = Math.max(shake, 0.4); } else swarm.A[j] -= take;
    if (i === 0) { meal += take * 0.8; audio.eat(take * 0.05); } else rv.meal[i] += take * 0.8;
    if (sizeOf(j) < 40) {
      if (j === 0) { active = 0; playerDead = 2.5; shake = 1.2; audio.thump(1.2); }
      else { swarm.A[j] = 0; rv.dead[j] = j === bossK ? Infinity : 3; if (i === 0) { audio.thump(1); for (let c = 0; c < 4; c++) setTimeout(() => audio.chime(6 + c), c * 100); } }
    }
  }
  safeT = Math.max(0, safeT - dt);
  if (playerDead > 0) { playerDead -= dt; if (playerDead <= 0) { active = Math.round(START_SIZE + bestActive * 0.3); safeT = 4; leader[0] = (Math.random() - 0.5) * 60; leader[2] = (Math.random() - 0.5) * 60; target[0] = leader[0]; target[2] = leader[2]; camX = leader[0]; camZ = leader[2]; } }
  // ---- the end of the round: everyone is ranked by size
  if (!roundOver) checkGoal();
  swarm.step(dt, time, leader, leaderVel, active, speed, cityLink);
  // a storm hits harder than a swarm at rest; a punch hits hardest
  city.boost = 1 + 2.5 * Math.min(1.3, Math.hypot(leaderVel[0], leaderVel[2]) / speed) + (dashT > 0 ? 6 : 0);
  city.feed(swarm.state.tex[0], swarm.state.tex[1], swarm.span(), dt, time);
  if (city.bloom > 0) { city.bloom -= dt; city.flood(dt * 0.45); }
  // onboarding (wordless): a pulsing ring around the nearest little thing until the first bite brings it down
  landT += dt;
  world.hint[3] = 0;
  { const mk = gold >= 0 ? gold : castle >= 0 && !city.gone[castle] ? castle : -1; if (mk >= 0) { const B = city.buildings[mk]; world.hint[0] = B.x; world.hint[1] = B.z; world.hint[2] = 3 + (city.s2Arr[mk * 4] || 1) * 4.5; world.hint[3] = 0.75 + 0.25 * Math.sin(time * 5); } }
  if (!firstBite && lvlI === 0 && landT > 2.5) {
    let best = -1, bd = 1e9;
    for (let b = 0; b < Math.min(7, city.buildings.length); b++) { if (city.gone[b]) continue; const B = city.buildings[b]; const dd = Math.hypot(B.x - leader[0], B.z - leader[2]); if (dd < bd) { bd = dd; best = b; } }
    if (best >= 0) { const B = city.buildings[best]; world.hint[0] = B.x; world.hint[1] = B.z; world.hint[2] = 3.2; world.hint[3] = Math.min(1, (landT - 2.5) * 0.7); if (touched && bd < 4) hand.classList.add("gone"); else if (!touched) hand.classList.remove("gone"); }
  }
  if ((gov.frames & 255) === 0) save();

  // camera: behind and above the seed, pulling back as the swarm grows
  const want = 15 + Math.sqrt(active) * 0.13 + (fighting ? 14 : 0) + sh.blend * sh.scale * 1.2;
  // opening: close and low on the glowing seed, rising and pulling back over ~3 s
  const open = Math.min(1, time / 3.2), ease = open * open * (3 - 2 * open);
  const wantD = (2.2 + (want - 2.2) * ease) * userZoom;
  camD += (wantD - camD) * Math.min(1, dt * (time < 3.2 ? 6 : 3));
  camX += (leader[0] - camX) * Math.min(1, dt * 2.2); camZ += (leader[2] - camZ) * Math.min(1, dt * 2.2);
  // a slow orbit gives parallax: the swarm reads as a volume, not a decal
  const pitch = 0.3 + 0.52 * ease; // height / distance: low at first, then the overview
  camY += (terrain.floor(camX, camZ) + sh.blend * sh.scale * 0.35 - camY) * Math.min(1, dt * 2);
  cam[0] = camX; cam[1] = camY + 0.6 + camD * pitch; cam[2] = camZ + camD * 0.95;
  const aspect = cw / ch;
  perspective(proj, aspect < 1 ? 1.05 : 0.85, aspect, 0.3, 600);
  // a building coming down shakes the camera a little
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

  // the wordless HUD: the swarm count, and how much of the village has its colour back
  if ((gov.frames & 7) === 0) {
    const txt = active >= 10000 ? `${(active / 1000).toFixed(active >= 100000 ? 0 : 1)}k` : String(active);
    if (countN.textContent !== txt) { countN.textContent = txt; countBox.classList.remove("pop"); void countBox.offsetWidth; countBox.classList.add("pop"); }
    const tot = 0, eat = 0;
    void tot; void eat;
    goalFill.style.width = `${(Math.min(1, Math.max(0, LV.goal === "race" ? 1 - roundT / roundLen : goalProgress())) * 100).toFixed(1)}%`;
    const fmtG = (n: number) => n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
    const gt = LV.goal === "wreck" ? `🏚️ ${mine}/${LV.n}` : LV.goal === "gold" ? `🌟 ${goldMine}/${LV.n}` : LV.goal === "grow" ? `🐜 ${fmtG(active)}/${fmtG(LV.n)}` : LV.goal === "castle" ? "🏰" : LV.goal === "boss" ? "👾" : "🥇";
    if (goalTxt.textContent !== gt) { goalTxt.textContent = gt; goalTxt.classList.remove("pop"); void goalTxt.offsetWidth; goalTxt.classList.add("pop"); }
    const left = Math.max(0, Math.ceil(roundLen - Math.max(0, roundT)));
    timerEl.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    timerEl.classList.toggle("hurry", left <= 15 && !roundOver);
    // the live ranking: four colour dots, biggest first
    const fmt = (n: number) => n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
    boardEl.innerHTML = [0, 1, 2, 3].filter((k) => k === 0 || k <= LV.rivals || k === bossK).map((k) => ({ k, n: sizeOf(k) })).sort((a, b) => b.n - a.n).map((o) => `<div class="${o.k === 0 ? "me" : ""}">${o.k === bossK ? "👾" : `<i style="background:${["#ffc35a", "#5aa6ff", "#ff5a60", "#6dff7a"][o.k]}"></i>`}${fmt(o.n)}</div>`).join("");
  }
  if (showHud && hudCanvas.style.display !== "none" && (gov.frames & 3) === 0) gov.graph(hud, `${active.toLocaleString()} mites  ${cw}x${ch} @${Math.round(tier.scale * 100)}%`);
}
requestAnimationFrame(frame);
poki.init().then(() => poki.loadingFinished());

if (import.meta.env.MODE === "qa") (window as unknown as { __my: unknown }).__my = { startLevel, showMap, finishLevel, gov, city, swarm, leader, target, poke: () => { lastMove = time; }, terrain, get active() { return active; }, set active(v: number) { active = v; } };
