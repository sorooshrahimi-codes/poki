// MYRIAD — phase 1 tech core: a swarm that grows to 200k, follows the finger, lights the world, never hitches.
import { invert, lookAt, mul, perspective } from "./gl.ts";
import { Governor, TIERS } from "./perf.ts";
import { Post } from "./post.ts";
import { S, Swarm } from "./swarm.ts";
import { WALL, World, type Palette } from "./world.ts";
import { City, theme, type Kind } from "./city.ts";
import { poki } from "./poki.ts";
import { Grass } from "./grass.ts";
import { Audio } from "./audio.ts";

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
const world = new World(gl);
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
type Land = { icon: string; pal: Palette; snow: boolean; mix: [Kind, number][]; starter: [Kind, number, number]; gap: number; skip: number; giant: number };
const LANDS: Land[] = [
  { icon: "🌼", snow: false, gap: 17, skip: 0.25, giant: 2.4, starter: [6, 0.38, 0.15], mix: [[1, 0.42], [0, 0.33], [3, 0.15], [2, 0.1]],
    pal: { skyLow: [0.20, 0.13, 0.22], skyTop: [0.03, 0.04, 0.10], horizon: [0.55, 0.28, 0.20], stoneA: [0.20, 0.19, 0.23], stoneB: [0.38, 0.36, 0.40], fog: [0.12, 0.08, 0.13], grassA: [0.20, 0.48, 0.16], grassB: [0.42, 0.70, 0.22] } },
  { icon: "🍄", snow: false, gap: 16, skip: 0.2, giant: 2.5, starter: [7, 0.35, 0.12], mix: [[7, 0.42], [1, 0.3], [0, 0.18], [4, 0.1]],
    pal: { skyLow: [0.16, 0.10, 0.26], skyTop: [0.02, 0.03, 0.09], horizon: [0.25, 0.45, 0.50], stoneA: [0.17, 0.18, 0.22], stoneB: [0.33, 0.34, 0.40], fog: [0.09, 0.08, 0.15], grassA: [0.10, 0.42, 0.30], grassB: [0.30, 0.66, 0.38] } },
  { icon: "🏰", snow: false, gap: 15, skip: 0.15, giant: 2.6, starter: [6, 0.4, 0.15], mix: [[9, 0.5], [2, 0.16], [1, 0.2], [0, 0.14]],
    pal: { skyLow: [0.28, 0.15, 0.12], skyTop: [0.05, 0.04, 0.10], horizon: [0.75, 0.40, 0.16], stoneA: [0.22, 0.20, 0.20], stoneB: [0.40, 0.37, 0.36], fog: [0.14, 0.09, 0.09], grassA: [0.26, 0.50, 0.16], grassB: [0.50, 0.72, 0.24] } },
  { icon: "❄️", snow: true, gap: 16, skip: 0.2, giant: 2.7, starter: [8, 0.35, 0.12], mix: [[8, 0.45], [0, 0.25], [9, 0.15], [2, 0.15]],
    pal: { skyLow: [0.20, 0.24, 0.34], skyTop: [0.04, 0.06, 0.14], horizon: [0.50, 0.60, 0.75], stoneA: [0.30, 0.32, 0.38], stoneB: [0.55, 0.57, 0.63], fog: [0.16, 0.18, 0.24], grassA: [0.22, 0.50, 0.30], grassB: [0.50, 0.75, 0.45] } },
  { icon: "🌋", snow: false, gap: 16, skip: 0.2, giant: 3.0, starter: [10, 0.32, 0.12], mix: [[10, 0.45], [4, 0.25], [2, 0.15], [7, 0.15]],
    pal: { skyLow: [0.30, 0.08, 0.06], skyTop: [0.05, 0.02, 0.05], horizon: [1.00, 0.30, 0.08], stoneA: [0.13, 0.11, 0.12], stoneB: [0.28, 0.24, 0.25], fog: [0.16, 0.06, 0.05], grassA: [0.24, 0.46, 0.14], grassB: [0.55, 0.72, 0.20] } },
];
function landOf(d: number) { return LANDS[(d - 1) % LANDS.length]; }
function makeLand(d: number) {
  const L = landOf(d);
  let a = d * 101 + 7;
  const rnd = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const list: { x: number; z: number; kind: Kind; seed: number; scale?: number }[] = [];
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
    let r = rnd(), kind = L.mix[0][0];
    for (const [k, w] of L.mix) { if (r < w) { kind = k; break; } r -= w; }
    list.push({ x, z, kind, seed: Math.floor(rnd() * 1e6) });
  }
  theme.snow = L.snow;
  world.pal = L.pal;
  return list.slice(0, 62);
}
// progress is kept: the land you are on and how big the swarm has grown
const SAVE = "glowmites-save";
let saved: { land: number; active: number } = { land: 1, active: 800 };
try { const j = JSON.parse(localStorage.getItem(SAVE) || "null"); if (j && j.land >= 1) saved = j; } catch { /* private mode */ }
function save() { try { localStorage.setItem(SAVE, JSON.stringify({ land: district, active })); } catch { /* ignore */ } }
let district = params.has("land") ? Number(params.get("land")) : saved.land;
city.build(makeLand(district));


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
const cityLink = { grid: city.grid, atlas: city.atlas.tex[0], b: city.bArr, b2: city.b2Arr, s2: city.s2Arr };
const proj = new Float32Array(16), view = new Float32Array(16), vp = new Float32Array(16), inv = new Float32Array(16);
const cam = new Float32Array(3), camR = new Float32Array(3), camU = new Float32Array(3);
const leader = new Float32Array([0, 0, 0]), leaderVel = new Float32Array(3);
const target = new Float32Array([0, 0, 0]);
let hasTarget = false, lastInput = -99;
let camD = 2.2, camX = 0, camZ = 0, shake = 0;

// ---------------------------------------------------------------- input: the finger (or mouse) is where the seed goes
const ndc = new Float32Array(4), tmp4 = new Float32Array(4);
function pick(clientX: number, clientY: number) {
  const x = (clientX / innerWidth) * 2 - 1, y = 1 - (clientY / innerHeight) * 2;
  // unproject two points and intersect the ground plane y = 0
  ndc[0] = x; ndc[1] = y; ndc[2] = -1; ndc[3] = 1; xform(tmp4, inv, ndc);
  const ax = tmp4[0] / tmp4[3], ay = tmp4[1] / tmp4[3], az = tmp4[2] / tmp4[3];
  ndc[2] = 1; xform(tmp4, inv, ndc);
  const bx = tmp4[0] / tmp4[3], by = tmp4[1] / tmp4[3], bz = tmp4[2] / tmp4[3];
  const t = ay / (ay - by);
  if (!(t > 0)) return;
  target[0] = ax + (bx - ax) * t; target[2] = az + (bz - az) * t;
  hasTarget = true; lastInput = time;
}
function xform(out: Float32Array, m: Float32Array, v: Float32Array) {
  for (let i = 0; i < 4; i++) out[i] = m[i] * v[0] + m[4 + i] * v[1] + m[8 + i] * v[2] + m[12 + i] * v[3];
}
let down = false;
countNInit();
function countNInit() { const el = document.getElementById("countN"); if (el) el.textContent = String(Number(params.get("start") ?? 800)); }
function nextLand() {
  // the next land: the swarm keeps everything it has
  district++; save();
  city.build(makeLand(district));
  giant = -1; giantState = "sleep"; won = false; progress = 0; time = Math.min(time, 1e9); landT = 0; firstBite = false;
  leader[0] = leader[2] = 0; target[0] = target[2] = 0; camD = 6;
  document.getElementById("win")!.classList.remove("show");
  audio.chime(2);
  poki.gameplayStart();
}
let adBusy = false;
document.getElementById("next")!.addEventListener("click", () => {
  if (adBusy) return; adBusy = true;
  audio.setMuted(true);
  poki.commercialBreak().then(() => { adBusy = false; audio.setMuted(false); nextLand(); });
});
document.getElementById("boost")!.addEventListener("click", (e) => {
  if (adBusy) return; adBusy = true; audio.setMuted(true);
  const btn = e.currentTarget as HTMLElement;
  poki.rewardedBreak().then((ok) => {
    adBusy = false; audio.setMuted(false);
    if (ok) { active = Math.min(CAP, Math.round(active * 1.5) + 2000); save(); btn.classList.add("used"); for (let i = 0; i < 5; i++) setTimeout(() => audio.chime(6 + i), i * 120); }
  });
});
function renderPath() {
  // the road through the five lands: done ones in colour, the next one pulsing
  const el = document.getElementById("path")!;
  const lap = Math.floor((district - 1) / LANDS.length), at = (district - 1) % LANDS.length;
  el.innerHTML = LANDS.map((L, i) => `<span class="${i <= at ? "done" : i === at + 1 ? "next" : ""}">${L.icon}</span>`).join("<i></i>") + (lap > 0 ? `<b>${"★".repeat(Math.min(5, lap))}</b>` : "");
}
const hand = document.getElementById("hand")!, countN = document.getElementById("countN")!, countBox = document.getElementById("count")!, goalFill = document.getElementById("goalFill")!;
// test builds only: five quick taps on the swarm counter skip to the next land
const SKIP_TEST = import.meta.env.MODE !== "poki";
let taps = 0, tapT = 0;
countBox.style.pointerEvents = "auto";
countBox.addEventListener("pointerdown", () => { if (!SKIP_TEST) return; const n = performance.now(); taps = n - tapT < 600 ? taps + 1 : 1; tapT = n; if (taps >= 5) { taps = 0; nextLand(); } });
let touched = false;
// pointers: one finger (or the mouse) steers; two fingers pinch to zoom; the wheel zooms too
const ptrs = new Map<number, { x: number; y: number }>();
let pinch0 = 0, zoom0 = 1, userZoom = 1, aimX = 0, aimY = 0, aiming = false;
canvas.addEventListener("pointerdown", (e) => {
  audio.start();
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = userZoom; aiming = false; }
  else { down = true; aiming = true; aimX = e.clientX; aimY = e.clientY; }
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
  if (down || e.pointerType === "mouse") { aiming = true; aimX = e.clientX; aimY = e.clientY; }
});
const lift = (e: PointerEvent) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0; if (ptrs.size === 0) down = false; };
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
const CAP = Math.min(S * S, Number(params.get("n") ?? 200_000));
// "grow=1" is the phase-1 stress demo (grows by itself); the game grows only by eating
const grow = params.get("grow") === "1";
let active = grow ? 100 : Number(params.get("start") ?? Math.max(800, saved.land === district ? saved.active : 800));
let meal = 0;
let landT = 0, firstBite = false;
// ---------------------------------------------------------------- the stone giant: wakes when the village is mostly colour again
let GIANT_SCALE = 2.4, GIANT_H = 32 * 0.28 * GIANT_SCALE;
let giant = -1, giantState: "sleep" | "rise" | "walk" | "fallen" = "sleep", giantT = 0, giantY = -GIANT_H, nextStomp = 0, won = false;
let progress = 0;
city.onEat = (b, amount) => {
  meal += amount * 2.5; // every voxel eaten hatches new mites
  audio.eat(amount);
  const B = city.buildings[b];
  // a building is gone when (nearly) all of it, rubble included, has been eaten
  if (!city.gone[b] && B.eaten > B.solid * 0.97) city.remove(b);
  // the first big bites of a building shake the camera a little (things are coming down)
  // structural failure: a fifth of a building gone and the rest comes down (trees a little later)
  const failAt = B.kind === 1 ? 0.3 : B.kind === 6 ? 0.5 : B.kind === 5 ? 0.45 : 0.3;
  if (B.eaten > B.solid * failAt && B.collapseAt < 0 && b !== giant) {
    B.collapseAt = time; city.fail(b); firstBite = true;
    shake = B.kind === 6 ? 0.2 : 0.9; audio.thump(B.kind === 1 || B.kind === 6 ? 0.6 : 1.2);
  }
};

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
  { let tot = 0, eat = 0; for (let b = 0; b < city.buildings.length; b++) { if (b === giant) continue; const B = city.buildings[b]; tot += B.solid; eat += Math.min(B.solid, B.eaten); } progress = Math.min(1, (eat / Math.max(1, tot)) * 1.15); }
  swarm.shock[3] = 0;
  if (giant < 0 && progress >= (params.get("giant") === "1" && time > 1.5 ? 0 : 0.5)) {
    // it rises on the far side of the swarm from the camera, so the player sees it come up out of the ground
    const ang = Math.atan2(leader[2] - cam[2], leader[0] - cam[0]);
    const gx = Math.max(-60, Math.min(60, leader[0] + Math.cos(ang) * 38)), gz = Math.max(-60, Math.min(60, leader[2] + Math.sin(ang) * 38));
    GIANT_SCALE = landOf(district).giant; GIANT_H = 32 * 0.28 * GIANT_SCALE;
    const lap = Math.floor((district - 1) / LANDS.length);
    giant = city.add({ x: gx, z: gz, kind: 5, seed: 4242 + district }, GIANT_SCALE, -GIANT_H, 0.06 / (1 + lap * 0.5)); // hard stone: a real fight
    giantState = "rise"; giantT = 0; audio.thump(1.4); shake = 1.2;
  }
  if (giant >= 0 && !city.gone[giant]) {
    const G = city.buildings[giant];
    giantT += dt;
    if (giantState === "rise") {
      giantY = -GIANT_H * Math.max(0, 1 - giantT / 3.2) ** 2;
      shake = Math.max(shake, 0.5);
      if (giantT > 3.2) { giantState = "walk"; giantY = 0; nextStomp = giantT + 1.2; }
      city.place(giant, G.x, G.z, giantY);
    } else if (giantState === "walk") {
      const dx = leader[0] - G.x, dz = leader[2] - G.z, d = Math.hypot(dx, dz);
      const step = Math.min(d, 2.4 * dt);
      const bob = -Math.abs(Math.sin(giantT * 3.9)) * 0.5;
      if (d > 4) city.place(giant, G.x + (dx / d) * step, G.z + (dz / d) * step, bob);
      if (giantT >= nextStomp) {
        // the more of it is gone, the angrier: faster and harder stomps
        const hurt = Math.min(1, G.eaten / (G.solid * 0.55));
        nextStomp = giantT + 1.7 - hurt * 0.8;
        swarm.shock[0] = G.x; swarm.shock[1] = G.z; swarm.shock[2] = 16 + hurt * 8; swarm.shock[3] = 22 + hurt * 14;
        shake = Math.max(shake, 0.9); audio.thump(1.1);
      }
      if (G.eaten > G.solid * 0.55) { giantState = "fallen"; shake = 1.4; audio.thump(1.6); city.place(giant, G.x, G.z, 0); }
    }
  }
  if (giant >= 0 && city.gone[giant] && !won) {
    won = true; shake = 1; city.bloom = 3.5;
    save(); poki.gameplayStop();
    setTimeout(() => { district++; renderPath(); district--; document.getElementById("boost")!.classList.remove("used"); document.getElementById("win")!.classList.add("show"); }, 2200);
    for (let i = 0; i < 6; i++) setTimeout(() => audio.chime(4 + i), i * 160);
  }
  while (milestone < MILESTONES.length && active >= MILESTONES[milestone]) audio.chime(milestone++);
  audio.swarm(active, Math.hypot(leaderVel[0], leaderVel[2]));
  if (aiming && (down || !("ontouchstart" in window))) pick(aimX, aimY);
  // the seed: to the finger, or a slow wander when nobody touches
  if (!hasTarget || time - lastInput > 4) {
    const a = time * 0.16;
    target[0] = Math.cos(a) * 34 + Math.sin(a * 2.3) * 12; target[2] = Math.sin(a * 1.3) * 28 + Math.cos(a * 3.1) * 6;
  }
  { const r = Math.hypot(target[0], target[2]), lim = WALL - 4; if (r > lim) { target[0] *= lim / r; target[2] *= lim / r; } }
  const speed = 8.5 + Math.sqrt(active) * 0.025;
  const dx = target[0] - leader[0], dz = target[2] - leader[2], d = Math.hypot(dx, dz);
  // the seed is the finger: it gets there fast, easing in at the end
  const vx = d > 0.01 ? (dx / d) * Math.min(d * 3.5, speed * 1.25) : 0, vz = d > 0.01 ? (dz / d) * Math.min(d * 3.5, speed * 1.25) : 0;
  leaderVel[0] += (vx - leaderVel[0]) * Math.min(1, dt * 7); leaderVel[2] += (vz - leaderVel[2]) * Math.min(1, dt * 7);
  leader[0] += leaderVel[0] * dt; leader[2] += leaderVel[2] * dt;

  swarm.step(dt, time, leader, leaderVel, active, speed, cityLink);
  city.feed(swarm.state.tex[0], swarm.state.tex[1], active, dt, time);
  if (city.bloom > 0) { city.bloom -= dt; city.flood(dt * 0.45); }
  // onboarding (wordless): a pulsing ring around the nearest little thing until the first bite brings it down
  landT += dt;
  world.hint[3] = 0;
  if (!firstBite && district === 1 && time > 2.5) {
    let best = -1, bd = 1e9;
    for (let b = 0; b < Math.min(7, city.buildings.length); b++) { if (city.gone[b]) continue; const B = city.buildings[b]; const dd = Math.hypot(B.x - leader[0], B.z - leader[2]); if (dd < bd) { bd = dd; best = b; } }
    if (best >= 0) { const B = city.buildings[best]; world.hint[0] = B.x; world.hint[1] = B.z; world.hint[2] = 3.2; world.hint[3] = Math.min(1, (time - 2.5) * 0.7); if (touched && bd < 4) hand.classList.add("gone"); else if (!touched) hand.classList.remove("gone"); }
  }
  if ((gov.frames & 255) === 0) save();

  // camera: behind and above the seed, pulling back as the swarm grows
  const want = 15 + Math.sqrt(active) * 0.13 + (giant >= 0 && giantState !== "fallen" && !city.gone[giant] ? 14 : 0);
  // opening: close and low on the glowing seed, rising and pulling back over ~3 s
  const open = Math.min(1, time / 3.2), ease = open * open * (3 - 2 * open);
  const wantD = (2.2 + (want - 2.2) * ease) * userZoom;
  camD += (wantD - camD) * Math.min(1, dt * (time < 3.2 ? 6 : 3));
  camX += (leader[0] - camX) * Math.min(1, dt * 2.2); camZ += (leader[2] - camZ) * Math.min(1, dt * 2.2);
  // a slow orbit gives parallax: the swarm reads as a volume, not a decal
  const pitch = 0.3 + 0.52 * ease; // height / distance: low at first, then the overview
  cam[0] = camX; cam[1] = 0.6 + camD * pitch; cam[2] = camZ + camD * 0.95;
  const aspect = cw / ch;
  perspective(proj, aspect < 1 ? 1.05 : 0.85, aspect, 0.3, 600);
  // a building coming down shakes the camera a little
  shake = Math.max(0, shake - dt * 1.6);
  const sk = shake * shake * 0.35;
  lookAt(view, cam[0] + Math.sin(time * 61) * sk, cam[1] + Math.sin(time * 47) * sk, cam[2], camX, 0, camZ - camD * 0.12);
  mul(vp, proj, view); invert(inv, vp);
  camR[0] = view[0]; camR[1] = view[4]; camR[2] = view[8];
  camU[0] = view[1]; camU[1] = view[5]; camU[2] = view[9];

  post.begin(tier.scale);
  world.draw(vp, inv, cam, swarm.light, city.color.tex[0], time);
  city.focus[0] = leader[0]; city.focus[1] = 1.5; city.focus[2] = leader[2];
  city.draw(vp, cam, swarm.light);
  grass.draw(vp, cam, camX, camZ - camD * 0.1, time, city.color.tex[0], swarm.light, swarm.light, 1);
  city.shadows = gov.tier <= 2;
  world.drawWall(vp, time);
  swarm.draw(vp, camR, camU, time, active, 2 / (proj[5] * ch * tier.scale), leader, cityLink);
  post.end(tier.scale, time, tier.bloom, cw, ch);

  // the wordless HUD: the swarm count, and how much of the village has its colour back
  if ((gov.frames & 7) === 0) {
    const txt = active >= 10000 ? `${(active / 1000).toFixed(active >= 100000 ? 0 : 1)}k` : String(active);
    if (countN.textContent !== txt) { countN.textContent = txt; countBox.classList.remove("pop"); void countBox.offsetWidth; countBox.classList.add("pop"); }
    const tot = 0, eat = 0;
    void tot; void eat;
    goalFill.style.width = `${(won ? 100 : progress * 100).toFixed(1)}%`;
  }
  if (showHud && hudCanvas.style.display !== "none" && (gov.frames & 3) === 0) gov.graph(hud, `${active.toLocaleString()} mites  ${cw}x${ch} @${Math.round(tier.scale * 100)}%`);
}
requestAnimationFrame(frame);
poki.init().then(() => poki.loadingFinished());

if (import.meta.env.MODE === "qa") (window as unknown as { __my: unknown }).__my = { gov, city, leader, target, get active() { return active; }, set active(v: number) { active = v; } };
