// The world (phase 1): a dusk sky and a grey stone plain that the swarm lights up from below.
import { FULLSCREEN_VS, bindTex, program, type GL, type Program } from "./gl.ts";
import { WORLD } from "./swarm.ts";
import { HEIGHT_GLSL, WATER, type Terrain } from "./terrain.ts";

const SKY_FS = `#version 300 es
precision highp float;
uniform mat4 uInvVP;
uniform vec3 uCam;
uniform vec3 uSkyLow, uSkyTop, uHorizon;
in vec2 vUv;
out vec4 o;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec4 w = uInvVP * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 dir = normalize(w.xyz / w.w - uCam);
  float y = dir.y;
  vec3 c = mix(uSkyLow, uSkyTop, smoothstep(-0.05, 0.6, y));
  c += uHorizon * exp(-abs(y) * 14.0) * 0.6; // the glow on the horizon
  // a few stars
  vec2 sp = dir.xz / max(0.15, y + 0.2) * 60.0;
  float s = step(0.996, h(floor(sp))) * smoothstep(0.1, 0.5, y);
  o = vec4(c + s * 0.8, 1.0);
}`;

// the land inside the world square is a height-mapped grid (hills, hollows, the pond); outside it, a flat plain
const GN = 192;
const GROUND_VS = `#version 300 es
precision highp float;
uniform mat4 uVP;
uniform float uSize, uWorld, uGrid;
uniform sampler2D uHeight;
out vec3 vW;
out vec3 vN;
${HEIGHT_GLSL}
void main() {
  if (uGrid > 0.5) {
    int cell = gl_VertexID / 6, c = gl_VertexID % 6;
    int ci = cell % ${GN}, cj = cell / ${GN};
    ivec2 o = c == 0 ? ivec2(0, 0) : c == 1 ? ivec2(1, 0) : c == 2 ? ivec2(1, 1) : c == 3 ? ivec2(0, 0) : c == 4 ? ivec2(1, 1) : ivec2(0, 1);
    vec2 xz = (vec2(ci + o.x, cj + o.y) / float(${GN}) - 0.5) * uWorld;
    float e = uWorld / float(${GN});
    vN = normalize(vec3(groundH(xz - vec2(e, 0.0)) - groundH(xz + vec2(e, 0.0)), 2.0 * e, groundH(xz - vec2(0.0, e)) - groundH(xz + vec2(0.0, e))));
    vW = vec3(xz.x, groundH(xz), xz.y);
  } else {
    vec2 q = vec2(float((gl_VertexID & 1)), float((gl_VertexID >> 1) & 1)) * 2.0 - 1.0;
    vW = vec3(q.x * uSize, -0.01, q.y * uSize);
    vN = vec3(0.0, 1.0, 0.0);
  }
  gl_Position = uVP * vec4(vW, 1.0);
}`;
const GROUND_FS = `#version 300 es
precision highp float;
uniform sampler2D uLight, uColor;
uniform float uWorld, uGrid;
uniform vec3 uCam;
uniform vec3 uStoneA, uStoneB, uFog, uGrassA, uGrassB;
uniform vec4 uHint; // x, z, radius, strength: a pulsing ring that says "eat this" (onboarding)
uniform float uTime, uWall;
in vec3 vW;
in vec3 vN;
out vec4 o;
const float WATER = ${WATER.toFixed(2)};
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 p = vW.xz;
  if (uGrid < 0.5 && abs(p.x) < uWorld * 0.5 - 0.3 && abs(p.y) < uWorld * 0.5 - 0.3) discard; // the hill grid covers this
  // petrified ground: irregular stone slabs (voronoi) with dark cracks and grit
  vec2 gp = p / 2.2, gi = floor(gp), gf = fract(gp);
  float d1 = 9.0, d2 = 9.0; vec2 cell = gi;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 o2 = vec2(float(i), float(j)), pt = o2 + vec2(h(gi + o2), h(gi + o2 + 17.0)) * 0.9;
    float dd = length(gf - pt);
    if (dd < d1) { d2 = d1; d1 = dd; cell = gi + o2; } else if (dd < d2) d2 = dd;
  }
  float crack = smoothstep(0.0, 0.08, d2 - d1);
  float n = vn(p * 0.35) * 0.5 + vn(p * 1.7) * 0.25 + h(cell) * 0.16 + vn(p * 6.0) * 0.08;
  vec3 stone = mix(uStoneA, uStoneB, n) * mix(0.55, 1.0, crack);
  // the swarm's own light, from the blurred density field
  vec2 uv = p / uWorld + 0.5;
  float d = (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) ? texture(uLight, uv).r : 0.0;
  float glow = 1.0 - exp(-d * 0.012);
  // colour coming back: grass and flowers where the swarm has been
  float rest = (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) ? clamp(texture(uColor, uv).r, 0.0, 1.0) : 0.0;
  // living ground seen from afar: meadow colours that vary (clover, dry patches, flower drifts)
  float m1 = vn(p * 0.12), m2 = vn(p * 0.5 + 7.0), m3 = vn(p * 2.3);
  vec3 grass = mix(uGrassA, uGrassB, m1);
  grass = mix(grass, vec3(0.62, 0.66, 0.30), smoothstep(0.62, 0.85, m2) * 0.6);
  grass *= 0.82 + 0.3 * m3;
  grass = mix(grass, vec3(0.95, 0.82, 0.35), smoothstep(0.8, 0.95, vn(p * 1.1 + 3.0)) * 0.35);
  grass = mix(grass, vec3(0.92, 0.55, 0.80), smoothstep(0.82, 0.97, vn(p * 1.3 + 11.0)) * 0.3);
  float flower = step(0.985, h(floor(p * 2.0)));
  grass = mix(grass, mix(vec3(1.0, 0.85, 0.3), vec3(1.0, 0.45, 0.7), h(floor(p * 2.0) + 3.1)), flower);
  // the edge of the colour is ragged and alive, like paint soaking into stone
  float edge = smoothstep(0.0, 1.0, rest * 1.6 - (vn(p * 0.9) * 0.6 + vn(p * 3.1) * 0.3));
  vec3 ground = mix(stone, grass * mix(0.75, 1.0, crack), edge);
  rest = edge;
  vec3 lit = ground * (0.45 + 1.6 * glow) * mix(1.0, 1.25, rest) + vec3(1.0, 0.5, 0.15) * glow * 0.4;
  // the onboarding ring: a soft pulse around the first thing to eat
  if (uHint.w > 0.0) {
    float dh = length(p - uHint.xy), ph = fract(uTime * 0.8);
    float ring = exp(-pow((dh - uHint.z * (0.7 + ph * 0.6)) * 2.2, 2.0)) * (1.0 - ph);
    lit += vec3(1.0, 0.8, 0.35) * ring * uHint.w * 1.4;
  }
  // hills catch the light (strong, so the land reads as land); the pond's floor is dark silt
  float sun = max(0.0, dot(normalize(vN), normalize(vec3(0.4, 1.0, 0.3))));
  lit *= 0.38 + 0.8 * sun;
  if (vW.y < WATER) lit *= mix(0.45, 0.85, smoothstep(WATER - 2.0, WATER, vW.y));
  // beyond the wall the land is still grey: the next land waits out there
  float rr = length(p);
  lit = mix(lit, stone * (0.35 + 0.6 * sun), smoothstep(uWall + 1.0, uWall + 3.0, rr));
  float dist = length(vW - uCam);
  lit = mix(lit, uFog, smoothstep(70.0, 230.0, dist));
  o = vec4(lit, 1.0);
}`;


// still water: grey and dull while petrified, deep sparkling blue once the colour is back
const WATER_VS = `#version 300 es
precision highp float;
uniform mat4 uVP;
uniform vec4 uPond; // x, z, half size
out vec3 vW;
void main() {
  vec2 q = vec2(float((gl_VertexID & 1)), float((gl_VertexID >> 1) & 1)) * 2.0 - 1.0;
  vW = vec3(uPond.x + q.x * uPond.z, ${WATER.toFixed(2)}, uPond.y + q.y * uPond.z);
  gl_Position = uVP * vec4(vW, 1.0);
}`;
const WATER_FS = `#version 300 es
precision highp float;
uniform sampler2D uColor, uHeight, uLight;
uniform float uWorld, uTime, uLiquid; // 0 water, 1 ice, 2 lava
uniform vec3 uCam, uFog, uSkyLow;
in vec3 vW;
out vec4 o;
${HEIGHT_GLSL}
void main() {
  float depth = WATER - groundH(vW.xz);
  if (depth < 0.0) discard;
  vec2 uv = vW.xz / uWorld + 0.5;
  float rest = clamp(texture(uColor, uv).r * 1.3, 0.0, 1.0);
  float glow = 1.0 - exp(-texture(uLight, uv).r * 0.012);
  vec3 v = normalize(vW - uCam);
  vec2 w = vW.xz * 0.9 + vec2(uTime * 0.4, uTime * 0.25);
  vec3 n = normalize(vec3(sin(w.x) * 0.06 + sin(w.y * 1.7 + 1.0) * 0.04, 1.0, cos(w.y) * 0.06 + sin(w.x * 1.3) * 0.04) * vec3(rest, 1.0, rest) + vec3(0.0, 0.0, 0.0));
  float fres = pow(1.0 - max(0.0, dot(-v, n)), 3.0);
  vec3 deep = mix(vec3(0.20, 0.21, 0.24), mix(vec3(0.05, 0.25, 0.45), vec3(0.10, 0.55, 0.65), smoothstep(1.5, 0.0, depth)), rest);
  vec3 sky = mix(uSkyLow * 1.6 + 0.08, vec3(0.6, 0.75, 0.9), rest * 0.6);
  vec3 c = mix(deep, sky, fres * 0.8) + vec3(1.0, 0.6, 0.25) * glow * 0.6;
  float spark = pow(max(0.0, sin(w.x * 3.1) * sin(w.y * 2.7)), 40.0) * rest;
  c += spark * 0.8;
  float a = clamp(0.55 + depth * 0.4, 0.0, 0.92) * smoothstep(0.0, 0.12, depth);
  if (uLiquid > 1.5) { // lava: a glowing crust that cracks open, bright whatever the colour
    float crust = smoothstep(0.35, 0.6, sin(vW.x * 1.3 + uTime * 0.3) * sin(vW.z * 1.1 - uTime * 0.2) * 0.5 + 0.5 + sin(vW.x * 3.7 + vW.z * 2.9) * 0.2);
    c = mix(vec3(3.2, 1.1, 0.25), vec3(0.18, 0.08, 0.06), crust) * mix(0.8, 1.2, rest);
    a = smoothstep(0.0, 0.08, depth);
  } else if (uLiquid > 0.5) { // ice: pale, opaque, with white cracks
    float crack = smoothstep(0.96, 1.0, abs(sin(vW.x * 0.9 + sin(vW.z * 0.7) * 2.0)));
    c = mix(vec3(0.55, 0.60, 0.66), vec3(0.75, 0.90, 1.0), rest) * (0.85 + 0.25 * fres) + crack * 0.4 + vec3(1.0, 0.6, 0.25) * glow * 0.5;
    a = smoothstep(0.0, 0.08, depth);
  }
  c = mix(c, uFog, smoothstep(70.0, 230.0, length(vW - uCam)));
  o = vec4(c * a, a);
}`;

// the wall around the land, and the grey country beyond it: a few thousand instanced boxes
const BOX_VS = `#version 300 es
precision highp float;
uniform mat4 uVP;
layout(location = 0) in vec4 aA; // x, y, z, yaw
layout(location = 1) in vec4 aB; // half sizes, kind
out vec3 vW;
out vec3 vN;
flat out float vKind;
out float vY;
void main() {
  int f = gl_VertexID / 6, c = gl_VertexID % 6;
  int k = c == 0 ? 0 : c == 1 ? 1 : c == 2 ? 2 : c == 3 ? 0 : c == 4 ? 2 : 3;
  vec2 q = vec2(k == 1 || k == 2 ? 1.0 : -1.0, k >= 2 ? 1.0 : -1.0);
  vec3 n = f == 0 ? vec3(1, 0, 0) : f == 1 ? vec3(-1, 0, 0) : f == 2 ? vec3(0, 1, 0) : f == 3 ? vec3(0, -1, 0) : f == 4 ? vec3(0, 0, 1) : vec3(0, 0, -1);
  vec3 t1 = abs(n.y) > 0.5 ? vec3(1, 0, 0) : vec3(0, 1, 0), t2 = cross(n, t1);
  vec3 p = n + t1 * q.x + t2 * q.y;
  // roofs are wedges, trees and mountains taper to a point
  if (aB.w > 1.5 && aB.w < 2.5 && p.y > 0.0) p.z *= 0.04;
  if ((aB.w > 2.5 && aB.w < 3.5 || aB.w > 5.5 && aB.w < 6.5 || aB.w > 7.5) && p.y > 0.0) p.xz *= 0.06;
  vY = p.y * 0.5 + 0.5;
  vec3 lp = p * aB.xyz;
  float cs = cos(aA.w), sn = sin(aA.w);
  vec3 wp = vec3(lp.x * cs - lp.z * sn, lp.y, lp.x * sn + lp.z * cs) + aA.xyz;
  vec3 wn = n;
  if (aB.w > 1.5 && aB.w < 2.5 && n.y > 0.5) wn = vec3(0.0, 0.7, 0.7);
  vN = vec3(wn.x * cs - wn.z * sn, wn.y, wn.x * sn + wn.z * cs);
  vW = wp; vKind = aB.w;
  gl_Position = uVP * vec4(wp, 1.0);
}`;
const BOX_FS = `#version 300 es
precision highp float;
uniform vec3 uCam, uFog, uStoneA, uStoneB;
in vec3 vW;
in vec3 vN;
flat in float vKind;
in float vY;
out vec4 o;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 base = mix(uStoneA, uStoneB, 0.55);
  int k = int(vKind + 0.5);
  if (k == 0 || k == 5) { // wall stone: courses of blocks
    vec2 b = vec2(dot(vW.xz, normalize(vec2(-vW.z, vW.x) + 1e-4)) * 1.1, vW.y * 2.2);
    b.x += floor(b.y) * 0.5;
    float m = step(0.08, fract(b.x)) * step(0.1, fract(b.y));
    base = mix(uStoneA, uStoneB, 0.35 + 0.4 * h(floor(b))) * mix(0.6, 1.0, m);
  }
  if (k == 1) base *= 1.05;                 // house walls, slightly paler
  if (k == 2) base *= 0.7;                  // roofs, darker
  if (k == 3) base *= 0.8 + 0.2 * vY;       // grey petrified trees
  if (k == 4) base *= 0.6;                  // trunks
  if (k == 6) base = mix(base * 0.7, base * 1.4, smoothstep(0.65, 0.9, vY)); // far mountains with pale tops
  // the next land shows beyond the wall (still grey, but its shapes and a hint of its colours)
  if (k == 7) base = mix(base, vec3(0.62, 0.30, 0.28), 0.45);             // mushroom caps
  if (k == 8) base = mix(base, vec3(0.85, 0.88, 0.95), 0.6 * smoothstep(0.3, 0.8, vY)); // snowy pines
  if (k == 9) base = mix(base, vec3(0.55, 0.42, 0.80), 0.5) * (1.0 + 0.6 * vY); // crystals
  float sun = max(0.0, dot(normalize(vN), normalize(vec3(0.4, 1.0, 0.3))));
  vec3 c = base * (0.45 + 0.6 * sun);
  c = mix(c, uFog, smoothstep(70.0, 240.0, length(vW - uCam)));
  o = vec4(c, 1.0);
}`;
export const WALL = 64;
export type Palette = { skyLow: number[]; skyTop: number[]; horizon: number[]; stoneA: number[]; stoneB: number[]; fog: number[]; grassA: number[]; grassB: number[] };

export class World {
  pal!: Palette;
  hint = new Float32Array(4);
  sky: Program; ground: Program; water: Program; box: Program; vao: WebGLVertexArrayObject; boxVao: WebGLVertexArrayObject;
  boxBuf: WebGLBuffer; boxN = 0;
  gl: GL; terrain: Terrain;
  constructor(gl: GL, terrain: Terrain) {
    this.gl = gl; this.terrain = terrain;
    this.sky = program(gl, FULLSCREEN_VS, SKY_FS, "sky");
    this.ground = program(gl, GROUND_VS, GROUND_FS, "ground");
    this.water = program(gl, WATER_VS, WATER_FS, "water");
    this.box = program(gl, BOX_VS, BOX_FS, "boxes");
    this.vao = gl.createVertexArray()!;
    this.boxVao = gl.createVertexArray()!;
    this.boxBuf = gl.createBuffer()!;
    gl.bindVertexArray(this.boxVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.boxBuf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(0, 1);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
  }
  /** the wall and the grey country beyond it (different for every land) */
  liquid = 0;
  scenery(seed: number, next: number) {
    let a = seed * 48271 + 11;
    const rnd = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
    const out: number[] = [];
    const box = (x: number, y: number, z: number, yaw: number, hx: number, hy: number, hz: number, kind: number) => out.push(x, y + hy, z, yaw, hx, hy, hz, kind);
    const R = WALL + 2.2;
    // the wall: a ring of stone with battlements, and round-ish towers with pointed roofs
    const SEG = 112;
    const gate = (an: number) => Math.abs(Math.cos(an)) < 0.06; // north and south gates
    for (let i = 0; i < SEG; i++) {
      const an = (i / SEG) * Math.PI * 2, x = Math.cos(an) * R, z = Math.sin(an) * R, yaw = -an + Math.PI / 2;
      if (gate(an)) continue;
      box(x, 0, z, yaw, (Math.PI * R) / SEG + 0.05, 2.6, 1.0, 0);
      const ox = Math.cos(an) * 0.75, oz = Math.sin(an) * 0.75;
      box(x - ox, 5.2, z - oz, yaw, 0.7, 0.45, 0.25, 5);
    }
    for (let i = 0; i < 16; i++) {
      const an = ((i + 0.5) / 16) * Math.PI * 2, x = Math.cos(an) * R, z = Math.sin(an) * R;
      box(x, 0, z, an, 2.2, 4.2, 2.2, 5); box(x, 8.4, z, an + 0.785, 2.7, 0.35, 2.7, 5); box(x, 9.1, z, an, 2.4, 2.6, 2.4, 3);
    }
    // gatehouses: two big towers either side of each gate
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) { const x = sx * 6.2, z = sz * Math.sqrt(R * R - 38); box(x, 0, z, 0, 2.4, 5.2, 2.4, 5); box(x, 10.4, z, 0.785, 2.9, 0.4, 2.9, 5); box(x, 11.2, z, 0, 2.6, 3.2, 2.6, 3); }
    // beyond: the next land, still grey (its shapes show what is coming), and far mountains
    for (let k = 0; k < 900; k++) {
      const an = rnd() * Math.PI * 2, r = R + 5 + Math.pow(rnd(), 0.8) * 120, x = Math.cos(an) * r, z = Math.sin(an) * r;
      const yaw = rnd() * Math.PI;
      if (Math.abs(x) < 7 && Math.abs(z) > R - 2 && Math.abs(z) < R + 40) continue; // the road out of each gate stays open
      if (next === 1 && rnd() < 0.55) { const hgt = 1.5 + rnd() * 3; box(x, 0, z, yaw, 0.45, hgt, 0.45, 4); box(x, hgt * 2, z, yaw, 1.6 + rnd() * 1.6, 0.5, 1.6 + rnd() * 1.6, 7); continue; }
      if (next === 3 && rnd() < 0.6) { const hgt = 2 + rnd() * 3; box(x, 0, z, yaw, 0.25, 0.7, 0.25, 4); box(x, 1.0, z, yaw, 1.2 + rnd() * 0.6, hgt, 1.2 + rnd() * 0.6, 8); continue; }
      if (next === 4 && rnd() < 0.5) { const hgt = 3 + rnd() * 6; box(x, 0, z, yaw, 0.7 + rnd() * 0.6, hgt, 0.7 + rnd() * 0.6, 9); continue; }
      if (next === 2 && rnd() < 0.5) { const w = 1.6 + rnd(), hgt = 3 + rnd() * 3; box(x, 0, z, yaw, w, hgt, w, 1); box(x, hgt * 2, z, yaw, w + 0.2, 1.2, w + 0.2, 2); continue; }
      if (rnd() < 0.42) {
        const w = 1.4 + rnd() * 1.4, d = 1.2 + rnd() * 1.2, hgt = 1.2 + rnd() * (r > 110 ? 3.5 : 1.6);
        box(x, 0, z, yaw, w, hgt, d, 1); box(x, hgt * 2, z, yaw, w + 0.2, 0.9 + rnd() * 0.6, d + 0.25, 2);
      } else {
        const hgt = 1.6 + rnd() * 2.4;
        box(x, 0, z, yaw, 0.25, 0.8, 0.25, 4); box(x, 1.2, z, yaw, 1.1 + rnd() * 0.8, hgt, 1.1 + rnd() * 0.8, 3);
      }
    }
    for (let k = 0; k < 40; k++) {
      const an = (k / 40) * Math.PI * 2 + rnd() * 0.1, r = 215 + rnd() * 30;
      box(Math.cos(an) * r, -2, Math.sin(an) * r, rnd() * 3, 18 + rnd() * 20, 14 + rnd() * 22, 18 + rnd() * 20, 6);
    }
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.boxBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(out), gl.STATIC_DRAW);
    this.boxN = out.length / 8;
  }
  draw(vp: Float32Array, invVP: Float32Array, cam: Float32Array, light: WebGLTexture, color: WebGLTexture, t: number) {
    const P = this.pal;
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.sky.p);
    gl.uniformMatrix4fv(this.sky.u.uInvVP, false, invVP); gl.uniform3fv(this.sky.u.uCam, cam);
    gl.uniform3fv(this.sky.u.uSkyLow, P.skyLow); gl.uniform3fv(this.sky.u.uSkyTop, P.skyTop); gl.uniform3fv(this.sky.u.uHorizon, P.horizon);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
    const g = this.ground.u;
    gl.useProgram(this.ground.p);
    gl.uniformMatrix4fv(g.uVP, false, vp);
    gl.uniform1f(g.uSize, 400); gl.uniform1f(g.uWorld, WORLD); gl.uniform3fv(g.uCam, cam);
    gl.uniform3fv(g.uStoneA, P.stoneA); gl.uniform3fv(g.uStoneB, P.stoneB); gl.uniform3fv(g.uFog, P.fog); gl.uniform3fv(g.uGrassA, P.grassA); gl.uniform3fv(g.uGrassB, P.grassB);
    gl.uniform4fv(g.uHint, this.hint); gl.uniform1f(g.uTime, t); gl.uniform1f(g.uWall, WALL + 2.2);
    bindTex(gl, 0, light, g.uLight); bindTex(gl, 1, color, g.uColor); bindTex(gl, 2, this.terrain.tex, g.uHeight);
    gl.uniform1f(g.uGrid, 1); gl.drawArrays(gl.TRIANGLES, 0, GN * GN * 6);
    gl.uniform1f(g.uGrid, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // the wall and the land beyond
    const b = this.box.u;
    gl.useProgram(this.box.p);
    gl.uniformMatrix4fv(b.uVP, false, vp); gl.uniform3fv(b.uCam, cam); gl.uniform3fv(b.uFog, P.fog);
    gl.uniform3fv(b.uStoneA, P.stoneA); gl.uniform3fv(b.uStoneB, P.stoneB);
    gl.bindVertexArray(this.boxVao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, this.boxN);
    gl.bindVertexArray(this.vao);
  }
  /** the pond (transparent: after the solid things, before the swarm) */
  drawWater(vp: Float32Array, cam: Float32Array, light: WebGLTexture, color: WebGLTexture, t: number) {
    const gl = this.gl, w = this.water.u, pd = this.terrain.pond;
    if (pd.r <= 0) return;
    gl.bindVertexArray(this.vao);
    gl.useProgram(this.water.p);
    gl.uniformMatrix4fv(w.uVP, false, vp); gl.uniform4f(w.uPond, pd.x, pd.z, pd.r * 1.5, 0);
    gl.uniform1f(w.uWorld, WORLD); gl.uniform1f(w.uTime, t); gl.uniform1f(w.uLiquid, this.liquid); gl.uniform3fv(w.uCam, cam); gl.uniform3fv(w.uFog, this.pal.fog); gl.uniform3fv(w.uSkyLow, this.pal.skyLow);
    bindTex(gl, 0, color, w.uColor); bindTex(gl, 1, this.terrain.tex, w.uHeight); bindTex(gl, 2, light, w.uLight);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.depthMask(true); gl.disable(gl.BLEND);
  }
}
