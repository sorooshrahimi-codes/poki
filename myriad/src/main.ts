// MYRIAD — phase 1 tech core: a swarm that grows to 200k, follows the finger, lights the world, never hitches.
import { invert, lookAt, mul, perspective } from "./gl.ts";
import { Governor, TIERS } from "./perf.ts";
import { Post } from "./post.ts";
import { S, Swarm } from "./swarm.ts";
import { World } from "./world.ts";
import { City, type Kind } from "./city.ts";

const canvas = document.getElementById("gl") as HTMLCanvasElement;
const hudCanvas = document.getElementById("hud") as HTMLCanvasElement;
const hud = hudCanvas.getContext("2d")!;
const params = new URLSearchParams(location.search);
const showHud = params.get("hud") !== "0";
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
const city = new City(gl);

// ---------------------------------------------------------------- a district: a petrified farm village
function village(seed: number) {
  let a = seed;
  const rnd = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const list: { x: number; z: number; kind: Kind; seed: number }[] = [];
  for (let gz = -3; gz <= 3; gz++) for (let gx = -3; gx <= 3; gx++) {
    if (Math.abs(gx) + Math.abs(gz) <= 0) continue; // the square in the middle stays open: the seed starts there
    if (rnd() < 0.25) continue;
    const r = rnd();
    const kind: Kind = r < 0.42 ? 1 : r < 0.75 ? 0 : r < 0.9 ? 3 : 2;
    list.push({ x: gx * 17 + (rnd() - 0.5) * 6, z: gz * 17 + (rnd() - 0.5) * 6, kind, seed: Math.floor(rnd() * 1e6) });
  }
  return list;
}
city.build(village(Number(params.get("seed") ?? 7)));


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
const cityLink = { grid: city.grid, atlas: city.atlas.tex[0], b: city.bArr, b2: city.b2Arr };
const proj = new Float32Array(16), view = new Float32Array(16), vp = new Float32Array(16), inv = new Float32Array(16);
const cam = new Float32Array(3), camR = new Float32Array(3), camU = new Float32Array(3);
const leader = new Float32Array([0, 0, 0]), leaderVel = new Float32Array(3);
const target = new Float32Array([0, 0, 0]);
let hasTarget = false, lastInput = -99;
let camD = 20, camX = 0, camZ = 0;

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
canvas.addEventListener("pointerdown", (e) => { down = true; pick(e.clientX, e.clientY); });
addEventListener("pointermove", (e) => { if (down || e.pointerType === "mouse") pick(e.clientX, e.clientY); });
addEventListener("pointerup", () => { down = false; });
addEventListener("keydown", (e) => {
  if (e.key === " " || e.key.startsWith("Arrow")) e.preventDefault();
  if (e.key === "h") hudCanvas.style.display = hudCanvas.style.display === "none" ? "block" : "none";
});

// ---------------------------------------------------------------- the growing swarm (phase 1 demo: grows by itself)
const CAP = Math.min(S * S, Number(params.get("n") ?? 200_000));
// "grow=1" is the phase-1 stress demo (grows by itself); the game grows only by eating
const grow = params.get("grow") === "1";
let active = grow ? 100 : Number(params.get("start") ?? 300);
let meal = 0;
city.onEat = (b, amount) => {
  meal += amount * 4; // every voxel eaten hatches new mites
  const B = city.buildings[b];
  if (B.collapseAt < 0 && B.eaten > B.solid * 0.42) { B.collapseAt = time; city.syncUniforms(); }
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
  gov.update(dt);
  const tier = TIERS[gov.tier];

  if (grow && active < CAP) active = Math.min(CAP, Math.round(100 * Math.pow(2, time / 3.6)));
  if (meal >= 1) { const add = Math.floor(meal); meal -= add; active = Math.min(CAP, active + add); }
  // the seed: to the finger, or a slow wander when nobody touches
  if (!hasTarget || time - lastInput > 4) {
    const a = time * 0.32;
    target[0] = Math.cos(a) * 34 + Math.sin(a * 2.3) * 12; target[2] = Math.sin(a * 1.3) * 28 + Math.cos(a * 3.1) * 6;
  }
  const speed = 9 + Math.sqrt(active) * 0.035;
  const dx = target[0] - leader[0], dz = target[2] - leader[2], d = Math.hypot(dx, dz);
  const vx = d > 0.01 ? (dx / d) * Math.min(d * 2.5, speed) : 0, vz = d > 0.01 ? (dz / d) * Math.min(d * 2.5, speed) : 0;
  leaderVel[0] += (vx - leaderVel[0]) * Math.min(1, dt * 5); leaderVel[2] += (vz - leaderVel[2]) * Math.min(1, dt * 5);
  leader[0] += leaderVel[0] * dt; leader[2] += leaderVel[2] * dt;

  swarm.step(dt, time, leader, leaderVel, active, speed, cityLink);
  city.feed(swarm.state.tex[0], active, dt, time);

  // camera: behind and above the seed, pulling back as the swarm grows
  const want = 15 + Math.sqrt(active) * 0.13;
  camD += (want - camD) * Math.min(1, dt * 1.5);
  camX += (leader[0] - camX) * Math.min(1, dt * 3); camZ += (leader[2] - camZ) * Math.min(1, dt * 3);
  // a slow orbit gives parallax: the swarm reads as a volume, not a decal
  const orb = Math.sin(time * 0.11) * 0.55;
  cam[0] = camX + Math.sin(orb) * camD * 0.95; cam[1] = camD * 0.55; cam[2] = camZ + Math.cos(orb) * camD * 0.95;
  const aspect = cw / ch;
  perspective(proj, aspect < 1 ? 1.05 : 0.85, aspect, 0.3, 600);
  lookAt(view, cam[0], cam[1], cam[2], camX, 0, camZ - camD * 0.12);
  mul(vp, proj, view); invert(inv, vp);
  camR[0] = view[0]; camR[1] = view[4]; camR[2] = view[8];
  camU[0] = view[1]; camU[1] = view[5]; camU[2] = view[9];

  post.begin(tier.scale);
  world.draw(vp, inv, cam, swarm.light, city.color.tex[0]);
  city.draw(vp, cam, swarm.light, time);
  swarm.draw(vp, camR, camU, time, active, 2 / (proj[5] * ch * tier.scale));
  post.end(tier.scale, time, tier.bloom, cw, ch);

  if (showHud && hudCanvas.style.display !== "none" && (gov.frames & 3) === 0) gov.graph(hud, `${active.toLocaleString()} mites  ${cw}x${ch} @${Math.round(tier.scale * 100)}%`);
}
requestAnimationFrame(frame);

if (import.meta.env.MODE === "qa") (window as unknown as { __my: unknown }).__my = { gov, city, leader, target, get active() { return active; }, set active(v: number) { active = v; } };
