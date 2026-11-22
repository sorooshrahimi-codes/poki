// The petrified world, phase 2 (v2): fine voxel buildings with real materials and gravity.
//
//  * Each building or tree is a 32^3 volume, one 256x128 tile of an RGBA16F "world atlas"
//    (32 slices of 32x32). Per voxel: R = solid (eaten away below 0.5), G = support (how firmly it is held
//    up), B = material, A = per-voxel variation.
//  * Rendering ray-marches every volume on the GPU (a DDA walk through the grid, one ray per pixel of the
//    building's box), with ambient occlusion and a short sun shadow. The cost is pixels, not voxel count, so fine
//    detail is cheap.
//  * Physics: support flows up from the ground (straight up through solid voxels, and sideways with a falloff
//    that depends on the material: stone holds a short overhang, wood longer, leaves on branches longest).
//    Any voxel whose support drops too low falls, one cell per pass, and lands on whatever is below. Eat a trunk and
//    the crown comes down; eat the walls and the roof crashes into a heap of rubble. Rubble is food too.
//  * The swarm eats by subtracting density from the voxel each eating mite is in (scattered points into the atlas),
//    counted per building and read back asynchronously.
//  * The colour map is world-space paint: everything blends from stone grey to its real colours where the swarm went.
import { FULLSCREEN_VS, bindTex, program, target, texture, type GL, type Program, type Target } from "./gl.ts";
import { S, WORLD } from "./swarm.ts";
import { MAT_GLSL } from "./mats.ts";

export const V = 32;
export const VS = 0.28;
export const NB = 64;
export const AW = 2048, AH = 1024; // atlas: 8 x 8 tiles of 256 x 128
export const GRID = 80;
export const COLOR = 512;

export type Kind = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10; // house, tree, tower, barn, boulders, giant, flower bush, mushroom, pine, townhouse, crystal spire
export interface Building { x: number; z: number; kind: Kind; seed: number; solid: number; eaten: number; collapseAt: number; h: number; rubble?: number }

// materials (index -> colour); index 0 = empty

// how far support carries sideways, per material (stone short, wood long, leaves on branches longest)
const HOLD = [0, 0.86, 0.93, 0.9, 0.85, 0.92, 0.84, 0.95, 0.965, 0.965, 0.965, 0.8, 0.86, 0.85, 0.9, 0.92, 0.9, 0.9, 0.9, 0.9, 0.95, 0.95, 0.95, 0.8, 0.965, 0.88, 0.86, 0.9];
const HOLD_GLSL = `const float HOLD[${HOLD.length}] = float[${HOLD.length}](${HOLD.map((v) => v.toFixed(3)).join(",")});`;

const ATLAS = `
ivec2 atl(int b, ivec3 v) { return ivec2((b % 8) * 256 + (v.z % 8) * 32 + v.x, (b / 8) * 128 + (v.z / 8) * 32 + v.y); }
`;

// ---------------------------------------------------------------- physics: support + falling (pull formulation, no conflicts)
const SIM_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform float uMark; // 1 in play: pieces that move are marked as fallen (0 while the land settles at load)
uniform ivec3 uDir; // this pass's sliding direction (cycles through the four sides)
out vec4 o;
${ATLAS}${HOLD_GLSL}
int B; ivec3 VV;
vec4 cell(ivec3 v) {
  if (v.y < 0) return vec4(1.0, 1.0, 17.0, 0.0); // the ground: solid, fully holding
  if (any(lessThan(v, ivec3(0))) || any(greaterThan(v, ivec3(31)))) return vec4(0.0);
  return texelFetch(uSrc, atl(B, v), 0);
}
const float THR = 0.3;
// G channel: support 0..1 for held voxels, -1 while falling (a falling voxel ignores walls: it only lands on held ground)
void main() {
  ivec2 fc = ivec2(gl_FragCoord.xy);
  ivec2 tile = ivec2(fc.x / 256, fc.y / 128);
  B = tile.y * 8 + tile.x;
  ivec2 l = fc - tile * ivec2(256, 128);
  ivec3 v = ivec3(l.x % 32, l.y % 32, (l.x / 32) + (l.y / 32) * 8);
  vec4 c = cell(v), up = cell(v + ivec3(0, 1, 0)), dn = cell(v - ivec3(0, 1, 0));
  bool solid = c.r > 0.5, dnSolid = dn.r > 0.5;
  vec4 r = solid ? c : vec4(0.0);
  // straight down first; then loose voxels resting on loose voxels slide down one side (rubble spreads into a heap)
  vec4 src = cell(v - uDir + ivec3(0, 1, 0));                    // the voxel that could slide into this cell
  vec4 srcDn = cell(v - uDir);                                   // what that voxel rests on
  vec4 tgt = cell(v + uDir - ivec3(0, 1, 0));                    // where this voxel could slide to
  vec4 tgtUp = cell(v + uDir);                                   // the cell above that target
  bool upFalls = up.r > 0.5 && up.g < THR;
  if (!solid && upFalls) r = vec4(up.r, -1.0, up.b, fract(up.a) + 2.0 * uMark);                          // drop in from above
  else if (!solid && up.r < 0.5 && src.r > 0.5 && src.g < 0.0 && srcDn.r > 0.5 && srcDn.g < THR && v.y < 31)
    r = vec4(src.r, -1.0, src.b, fract(src.a) + 2.0 * uMark);                                            // slide in diagonally
  else if (solid && c.g < THR && !dnSolid) r = vec4(0.0);                                       // drop out
  else if (solid && c.g < 0.0 && dnSolid && dn.g < THR && tgt.r < 0.5 && tgtUp.r < 0.5 && v.y > 0 && all(greaterThanEqual(v + uDir, ivec3(0))) && all(lessThanEqual(v + uDir, ivec3(31))))
    r = vec4(0.0);                                                                               // slide out diagonally
  if (r.r > 0.5) {
    if (r.g < 0.0) {
      // falling: it lands only on something that is itself held up
      if (dnSolid && dn.g >= THR) r.g = dn.g;
    } else {
      float s = dnSolid ? max(dn.g, 0.0) : 0.0;
      float hold = HOLD[int(r.b + 0.5)];
      vec4 n1 = cell(v + ivec3(1, 0, 0)), n2 = cell(v - ivec3(1, 0, 0)), n3 = cell(v + ivec3(0, 0, 1)), n4 = cell(v - ivec3(0, 0, 1));
      float side = max(max(n1.r > 0.5 ? n1.g : 0.0, n2.r > 0.5 ? n2.g : 0.0), max(n3.r > 0.5 ? n3.g : 0.0, n4.r > 0.5 ? n4.g : 0.0));
      float upS = up.r > 0.5 ? max(up.g, 0.0) * 0.5 : 0.0; // hanging from above helps a little (beams, branches)
      r.g = max(s, max(side, upS) * hold);
      if (r.g < THR) r.g = -1.0; // no longer held: it starts to fall
    }
  }
  o = r;
}`;

// ---------------------------------------------------------------- rendering: ray-march every volume
const MARCH_VS = `#version 300 es
precision highp float;
uniform mat4 uVP;
uniform vec4 uB[${NB}];
uniform vec4 uS2[${NB}]; // scale, y offset
out vec3 vW;
flat out int vB;
const vec3 P[8] = vec3[8](vec3(0,0,0), vec3(1,0,0), vec3(1,1,0), vec3(0,1,0), vec3(0,0,1), vec3(1,0,1), vec3(1,1,1), vec3(0,1,1));
const int I[36] = int[36](0,2,1, 0,3,2, 4,5,6, 4,6,7, 0,1,5, 0,5,4, 3,7,6, 3,6,2, 0,4,7, 0,7,3, 1,2,6, 1,6,5);
void main() {
  int b = gl_InstanceID;
  vec4 B = uB[b];
  vB = b;
  if (B.w < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float vs = ${VS.toFixed(3)} * uS2[b].x;
  vec3 lo = vec3(B.x - 16.0 * vs, uS2[b].y, B.y - 16.0 * vs);
  vW = lo + P[I[gl_VertexID]] * 32.0 * vs;
  gl_Position = uVP * vec4(vW, 1.0);
}`;
const MARCH_FS = `#version 300 es
precision highp float;
uniform sampler2D uAtlas, uColor, uLight;
uniform mat4 uVP;
uniform vec4 uB[${NB}];
uniform vec4 uS2[${NB}];
uniform vec3 uCam, uSun, uFocus;
uniform float uWorld, uShadow;
in vec3 vW;
flat in int vB;
out vec4 o;
${ATLAS}${MAT_GLSL}
int b;
vec4 vox(ivec3 v) {
  if (any(lessThan(v, ivec3(0))) || any(greaterThan(v, ivec3(31)))) return vec4(0.0);
  return texelFetch(uAtlas, atl(b, v), 0);
}
float occ(ivec3 v) { return vox(v).r > 0.5 ? 1.0 : 0.0; }
void main() {
  b = vB;
  vec4 B = uB[b];
  float vs = ${VS.toFixed(3)} * uS2[b].x;
  vec3 lo = vec3(B.x - 16.0 * vs, uS2[b].y, B.y - 16.0 * vs);
  vec3 ro = (uCam - lo) / vs, rd = normalize(vW - uCam);
  // enter the 32^3 box (or start inside it)
  vec3 inv = 1.0 / rd;
  vec3 t0 = (vec3(0.0) - ro) * inv, t1 = (vec3(32.0) - ro) * inv;
  vec3 tmin = min(t0, t1), tmax = max(t0, t1);
  float tn = max(max(tmin.x, tmin.y), max(tmin.z, 0.0)), tf = min(min(tmax.x, tmax.y), tmax.z);
  if (tn > tf) discard;
  vec3 p = ro + rd * (tn + 1e-3);
  ivec3 cell = clamp(ivec3(floor(p)), ivec3(0), ivec3(31));
  ivec3 stp = ivec3(sign(rd));
  vec3 tDelta = abs(inv);
  vec3 tNext = (vec3(cell) + max(vec3(stp), 0.0) - ro) * inv;
  vec3 nrm = -vec3(stp) * vec3(equal(tmin, vec3(tn)));
  float t = tn;
  vec4 hit = vec4(0.0);
  for (int i = 0; i < 110; i++) {
    hit = vox(cell);
    if (hit.r > 0.5) break;
    if (tNext.x < tNext.y && tNext.x < tNext.z) { t = tNext.x; tNext.x += tDelta.x; cell.x += stp.x; nrm = vec3(-float(stp.x), 0, 0); }
    else if (tNext.y < tNext.z) { t = tNext.y; tNext.y += tDelta.y; cell.y += stp.y; nrm = vec3(0, -float(stp.y), 0); }
    else { t = tNext.z; tNext.z += tDelta.z; cell.z += stp.z; nrm = vec3(0, 0, -float(stp.z)); }
    if (any(lessThan(cell, ivec3(0))) || any(greaterThan(cell, ivec3(31)))) discard;
  }
  if (hit.r < 0.5) discard;
  vec3 hp = ro + rd * t;
  vec3 wp = lo + hp * vs;
  // between the camera and the swarm? then it is see-through (screen-door, no sorting needed)
  {
    vec3 ctr = vec3(B.x, 0.0, B.y);
    vec3 seg = uFocus - uCam;
    float k = clamp(dot(ctr - uCam, seg) / dot(seg, seg), 0.0, 1.0);
    float dd = length((uCam + seg * k - ctr).xz);
    if (k < 0.92 && dd < 16.0 * vs + 2.5 && wp.y > 1.2) {
      ivec2 q = ivec2(gl_FragCoord.xy) & 3;
      if ((q.x + q.y * 2) % 3 != 0) discard;
    }
  }
  vec4 clip = uVP * vec4(wp, 1.0);
  gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
  // material, with a per-voxel variation and a soft bevel so it reads as many small pieces
  vec3 col = MAT[int(hit.b + 0.5)] * (0.86 + 0.28 * fract(hit.a));
  bool fallen = hit.a >= 2.0; // pieces that came down show their true colours
  vec3 f = fract(hp) - 0.5;
  vec3 fa = abs(f) * (1.0 - abs(nrm));
  float bevel = 1.0 - smoothstep(0.38, 0.5, max(fa.x, max(fa.y, fa.z))) * 0.18;
  // ambient occlusion from the neighbours around the face
  ivec3 n = ivec3(nrm), a = cell + n;
  ivec3 t1v = n.x != 0 ? ivec3(0, 1, 0) : ivec3(1, 0, 0), t2v = n.z != 0 ? ivec3(0, 1, 0) : ivec3(0, 0, 1);
  if (n.y != 0) { t1v = ivec3(1, 0, 0); t2v = ivec3(0, 0, 1); }
  float ao = occ(a + t1v) + occ(a - t1v) + occ(a + t2v) + occ(a - t2v);
  ao += 0.5 * (occ(a + t1v + t2v) + occ(a - t1v + t2v) + occ(a + t1v - t2v) + occ(a - t1v - t2v));
  ao = 1.0 - ao * 0.09;
  // a short shadow ray toward the sun inside the volume
  float sh = 1.0;
  if (uShadow > 0.5 && dot(nrm, uSun) > 0.0) {
    vec3 q = hp + nrm * 0.51;
    for (int k = 1; k < 14; k++) { ivec3 c2 = ivec3(floor(q + uSun * float(k) * 1.3)); if (any(lessThan(c2, ivec3(0))) || any(greaterThan(c2, ivec3(31)))) break; if (occ(c2) > 0.5) { sh = 0.45; break; } }
  }
  float diff = max(dot(nrm, uSun), 0.0) * sh;
  vec2 uv = wp.xz / uWorld + 0.5;
  float rest = fallen ? 1.0 : clamp(texture(uColor, uv).r * 1.4, 0.0, 1.0);
  vec3 grey = vec3(dot(col, vec3(0.3, 0.59, 0.11))) * 0.62 + 0.05;
  vec3 base = mix(grey, col, rest);
  float sw = texture(uLight, uv).r;
  float glow = (1.0 - exp(-sw * 0.012)) * exp(-wp.y * 0.1);
  vec3 sky = mix(vec3(0.30, 0.28, 0.36), vec3(0.55, 0.62, 0.75), rest);
  vec3 sunC = mix(vec3(0.85, 0.72, 0.65), vec3(1.25, 1.12, 0.95), rest);
  vec3 c = base * (sky * (0.55 + 0.45 * nrm.y) * ao + sunC * diff * 0.9) * bevel + base * glow * 1.4 + vec3(1.0, 0.5, 0.15) * glow * 0.25;
  if (int(hit.b + 0.5) == 18) c = vec3(3.0, 1.6, 0.4); // the giant's eyes burn
  if (int(hit.b + 0.5) == 25) c += col * (0.12 + 0.9 * rest) * 0.9; // crystals glow
  float dist = length(wp - uCam);
  c = mix(c, vec3(0.20, 0.16, 0.22), smoothstep(80.0, 240.0, dist));
  o = vec4(c, 1.0);
}`;

const FAIL_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform float uSeed;
out vec4 o;
float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719)) + uSeed) * 43758.5453); }
void main() {
  ivec2 fc = ivec2(gl_FragCoord.xy);
  ivec2 tile = ivec2(fc.x / 256, fc.y / 128);
  ivec2 l = fc - tile * ivec2(256, 128);
  vec3 v = vec3(l.x % 32, l.y % 32, (l.x / 32) + (l.y / 32) * 8);
  vec4 c = texelFetch(uSrc, fc, 0);
  if (c.r > 0.5) {
    // the structure gives way: a share of the base crumbles, everything above comes loose
    if (v.y < 5.0 && h(v) < 0.45) c = vec4(0.0);
    else if (v.y >= 1.0) c.g = -1.0;
  }
  o = c;
}`;

// ---------------------------------------------------------------- eating and painting
const EAT_VS = `#version 300 es
precision highp float;
uniform sampler2D uPos, uVel;
uniform float uS, uMode;
uniform vec4 uB[${NB}];
uniform vec4 uS2[${NB}];
out float vK;
${ATLAS}
void main() {
  int i = gl_VertexID;
  vK = 1.0;
  vec4 p = texelFetch(uPos, ivec2(i % int(uS), i / int(uS)), 0);
  gl_PointSize = 1.0;
  if (p.w < 1.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  int b = int(floor(p.w - 2.0 + 0.01));
  bool ahead = fract(p.w) > 0.25;
  vK = uS2[b].z > 0.0 ? uS2[b].z : 1.0;
  vec4 B = uB[b];
  vec3 lp = (p.xyz - vec3(B.x, uS2[b].y, B.y)) / (${VS.toFixed(3)} * uS2[b].x) + vec3(16.0, 0.0, 16.0);
  if (ahead) { vec3 vel = texelFetch(uVel, ivec2(i % int(uS), i / int(uS)), 0).xyz; lp += (length(vel) > 0.1 ? normalize(vel) : vec3(0.0, -1.0, 0.0)) * 1.2; }
  ivec3 v = clamp(ivec3(floor(lp)), ivec3(0), ivec3(31));
  if (uMode < 0.5) gl_Position = vec4((vec2(atl(b, v)) + 0.5) / vec2(${AW}.0, ${AH}.0) * 2.0 - 1.0, 0.0, 1.0);
  else gl_Position = vec4((float(b) + 0.5) / ${NB}.0 * 2.0 - 1.0, 0.0, 0.0, 1.0);
}`;
const EAT_FS = `#version 300 es
precision highp float;
uniform float uAmount;
in float vK;
out vec4 o;
void main() { o = vec4(uAmount * vK, 0.0, 0.0, 0.0); }`;
const PAINT_VS = `#version 300 es
precision highp float;
uniform sampler2D uPos;
uniform float uS, uWorld;
out float vW;
void main() {
  int i = gl_VertexID;
  vec4 p = texelFetch(uPos, ivec2(i % int(uS), i / int(uS)), 0);
  if (p.w < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  vW = p.w > 1.5 ? 1.0 : 0.12;
  gl_Position = vec4(p.xz / uWorld * 2.0, 0.0, 1.0);
  gl_PointSize = 3.0;
}`;
const PAINT_FS = `#version 300 es
precision highp float;
uniform float uDt;
in float vW;
out vec4 o;
void main() { vec2 q = gl_PointCoord * 2.0 - 1.0; o = vec4(vW * uDt * 1.6 * max(0.0, 1.0 - dot(q, q))); }`;

export class City {
  gl: GL;
  atlas: Target; atlasB: Target; counter: Target; color: Target;
  grid: WebGLTexture; gridData = new Uint8Array(GRID * GRID * 4); // up to four volumes per cell (a giant's parts stack)
  march: Program; sim: Program; eat: Program; paint: Program; fillP: Program; failP: Program;
  private pass = 0;
  private static DIRS = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  vao: WebGLVertexArrayObject;
  buildings: Building[] = [];
  bArr = new Float32Array(NB * 4); b2Arr = new Float32Array(NB * 4);
  s2Arr = new Float32Array(NB * 4); // per building: scale, y offset
  gone = new Uint8Array(NB);
  active = new Float32Array(NB); // seconds of physics left per building (woken by eating)
  pbo: WebGLBuffer; fence: WebGLSync | null = null; readBuf = new Float32Array(NB * 4); readAt = 0;
  lastCount = new Float32Array(NB);
  shadows = true;
  onEat: (b: number, amount: number) => void = () => {};
  constructor(gl: GL) {
    this.gl = gl;
    const rgba16 = { internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT, filter: gl.NEAREST };
    this.atlas = target(gl, AW, AH, [rgba16]);
    this.atlasB = target(gl, AW, AH, [rgba16]);
    this.counter = target(gl, NB, 1, [{ internal: gl.RGBA32F, format: gl.RGBA, type: gl.FLOAT, filter: gl.NEAREST }]);
    this.color = target(gl, COLOR, COLOR, [{ internal: gl.R16F, format: gl.RED, type: gl.HALF_FLOAT, filter: gl.LINEAR }]);
    this.grid = texture(gl, GRID, GRID, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);
    this.march = program(gl, MARCH_VS, MARCH_FS, "march");
    this.sim = program(gl, FULLSCREEN_VS, SIM_FS, "sim");
    this.failP = program(gl, FULLSCREEN_VS, FAIL_FS, "fail");
    this.eat = program(gl, EAT_VS, EAT_FS, "eat");
    this.paint = program(gl, PAINT_VS, PAINT_FS, "paint");
    this.fillP = program(gl, FULLSCREEN_VS, `#version 300 es
precision highp float;
uniform float uAmount;
out vec4 o;
void main() { o = vec4(uAmount); }`, "fill");
    this.vao = gl.createVertexArray()!;
    this.pbo = gl.createBuffer()!;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, NB * 16, gl.STREAM_READ);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  }

  build(list: { x: number; z: number; kind: Kind; seed: number; scale?: number; y?: number }[]) {
    const gl = this.gl;
    const data = new Float32Array(AW * AH * 4);
    this.gridData.fill(0);
    this.buildings = [];
    list.slice(0, NB).forEach((L, b) => {
      const vol = new Uint8Array(V * V * V);
      const rnd = mulberry(L.seed);
      generate(L.kind, vol, rnd);
      let solid = 0, top = 0;
      for (let z = 0; z < V; z++) for (let y = 0; y < V; y++) for (let x = 0; x < V; x++) {
        const m = vol[(z * V + y) * V + x];
        if (!m) continue;
        const tx = (b % 8) * 256 + (z % 8) * 32 + x, ty = Math.floor(b / 8) * 128 + Math.floor(z / 8) * 32 + y;
        const o = (ty * AW + tx) * 4;
        data[o] = 1; data[o + 1] = 1; data[o + 2] = m; data[o + 3] = rnd();
        solid++; top = Math.max(top, y);
      }
      this.buildings.push({ x: L.x, z: L.z, kind: L.kind, seed: L.seed, solid, eaten: 0, collapseAt: -1, h: top + 1 });
      // how hard each thing is to eat: bushes are soft, trees firmer, houses and barns hard, towers hardest
      const TOUGH = [0.35, 0.65, 0.22, 0.33, 0.25, 0.06, 1.0, 0.5, 0.6, 0.22, 0.18];
      this.s2Arr[b * 4] = L.scale ?? 1; this.s2Arr[b * 4 + 1] = L.y ?? 0; this.s2Arr[b * 4 + 2] = TOUGH[L.kind];
      const half = (V * VS * (L.scale ?? 1)) / 2 + 1.0;
      for (let gz = 0; gz < GRID; gz++) for (let gx = 0; gx < GRID; gx++) {
        const wx = (gx + 0.5) / GRID * WORLD - WORLD / 2, wz = (gz + 0.5) / GRID * WORLD - WORLD / 2;
        if (Math.abs(wx - L.x) <= half && Math.abs(wz - L.z) <= half) this.gridData[(gz * GRID + gx) * 4] = b + 1;
      }
    });
    for (const t of [this.atlas, this.atlasB]) {
      gl.bindTexture(gl.TEXTURE_2D, t.tex[0]);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, AW, AH, gl.RGBA, gl.FLOAT, data);
    }
    gl.bindTexture(gl.TEXTURE_2D, this.grid);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GRID, GRID, gl.RGBA, gl.UNSIGNED_BYTE, this.gridData);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.color.fb); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.counter.fb); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.lastCount.fill(0); this.gone.fill(0); this.active.fill(0);
    this.syncUniforms();
    this.settle(70);
  }
  /** run the physics on every tile at once (at load: support flows up from the ground, loose bits drop) */
  settle(passes: number) {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.sim.p);
    gl.uniform1f(this.sim.u.uMark, 0);
    for (let i = 0; i < passes; i++) {
      const [src, dst] = i % 2 ? [this.atlasB, this.atlas] : [this.atlas, this.atlasB];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0, 0, AW, AH);
      bindTex(gl, 0, src.tex[0], this.sim.u.uSrc);
      const d = City.DIRS[i & 3]; gl.uniform3i(this.sim.u.uDir, d[0], d[1], d[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  /** structural failure: the base crumbles and everything above comes down (then gravity and sliding take over) */
  fail(b: number) {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    const x = (b % 8) * 256, y = Math.floor(b / 8) * 128;
    gl.useProgram(this.failP.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.atlasB.fb); gl.viewport(x, y, 256, 128);
    bindTex(gl, 0, this.atlas.tex[0], this.failP.u.uSrc); gl.uniform1f(this.failP.u.uSeed, b * 7.31);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.useProgram(this.sim.p);
    gl.uniform1f(this.sim.u.uMark, 1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.atlas.fb); gl.viewport(x, y, 256, 128);
    bindTex(gl, 0, this.atlasB.tex[0], this.sim.u.uSrc); gl.uniform3i(this.sim.u.uDir, 1, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.wake(b, 12);
  }
  syncUniforms() {
    this.bArr.fill(0); this.b2Arr.fill(0);
    for (let b = 0; b < NB; b++) {
      const B = this.buildings[b];
      if (!B || this.gone[b]) { this.bArr[b * 4 + 3] = -1; this.b2Arr[b * 4] = -1; continue; }
      this.bArr[b * 4] = B.x; this.bArr[b * 4 + 1] = B.z; this.bArr[b * 4 + 2] = B.kind; this.bArr[b * 4 + 3] = B.seed % 97;
      this.b2Arr[b * 4] = -1; this.b2Arr[b * 4 + 1] = B.h;
      if (this.s2Arr[b * 4] === 0) this.s2Arr[b * 4] = 1;
    }
  }

  /** eating, counting, painting, then gravity for every building that is being eaten or still settling */
  feed(posTex: WebGLTexture, velTex: WebGLTexture, active: number, dt: number, t: number) {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.useProgram(this.eat.p);
    const u = this.eat.u;
    bindTex(gl, 0, posTex, u.uPos); bindTex(gl, 1, velTex, u.uVel);
    gl.uniform1f(u.uS, S); gl.uniform4fv(u.uB, this.bArr); gl.uniform4fv(u.uS2, this.s2Arr);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.atlas.fb); gl.viewport(0, 0, AW, AH);
    gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT); gl.blendFunc(gl.ONE, gl.ONE);
    gl.uniform1f(u.uMode, 0); gl.uniform1f(u.uAmount, dt * 2.4);
    gl.drawArrays(gl.POINTS, 0, active);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.counter.fb); gl.viewport(0, 0, NB, 1);
    gl.blendEquation(gl.FUNC_ADD);
    gl.uniform1f(u.uMode, 1); gl.uniform1f(u.uAmount, dt * 2.4);
    gl.drawArrays(gl.POINTS, 0, active);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.color.fb); gl.viewport(0, 0, COLOR, COLOR);
    gl.useProgram(this.paint.p);
    bindTex(gl, 0, posTex, this.paint.u.uPos);
    gl.uniform1f(this.paint.u.uS, S); gl.uniform1f(this.paint.u.uWorld, WORLD); gl.uniform1f(this.paint.u.uDt, dt);
    gl.drawArrays(gl.POINTS, 0, active);
    gl.disable(gl.BLEND);
    // gravity: two passes per frame (A -> B -> A) over the tiles that are awake
    gl.useProgram(this.sim.p);
    gl.uniform1f(this.sim.u.uMark, 1);
    for (let b = 0; b < this.buildings.length; b++) {
      if (this.gone[b] || this.active[b] <= 0) continue;
      this.active[b] -= dt;
      const x = (b % 8) * 256, y = Math.floor(b / 8) * 128;
      for (const [src, dst] of [[this.atlas, this.atlasB], [this.atlasB, this.atlas]] as const) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
        gl.viewport(x, y, 256, 128);
        bindTex(gl, 0, src.tex[0], this.sim.u.uSrc);
        const d = City.DIRS[this.pass++ & 3]; gl.uniform3i(this.sim.u.uDir, d[0], d[1], d[2]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.readback(t);
  }
  /** keep a building's physics running (called when it is being eaten) */
  wake(b: number, seconds = 6) { this.active[b] = Math.max(this.active[b], seconds); }
  private readback(t: number) {
    const gl = this.gl;
    if (this.fence) {
      const st = gl.clientWaitSync(this.fence, 0, 0);
      if (st === gl.TIMEOUT_EXPIRED) return;
      gl.deleteSync(this.fence); this.fence = null;
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this.readBuf);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      for (let b = 0; b < this.buildings.length; b++) {
        const now = this.readBuf[b * 4], d = now - this.lastCount[b];
        this.lastCount[b] = now;
        if (d > 0) { this.buildings[b].eaten += d; this.wake(b); this.onEat(b, d); }
      }
    }
    if (t - this.readAt < 0.15) return;
    this.readAt = t;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.counter.fb);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
    gl.readPixels(0, 0, NB, 1, gl.RGBA, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  }
  bloom = 0;
  /** victory: colour soaks into the whole district at once */
  flood(amount: number) {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.color.fb); gl.viewport(0, 0, COLOR, COLOR);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this.fillP.p); gl.uniform1f(this.fillP.u.uAmount, amount);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  remove(b: number) { this.gone[b] = 1; this.syncUniforms(); }
  /** add one more volume (the giant) into a free slot, uploading only its tile */
  add(L: { x: number; z: number; kind: Kind; seed: number }, scale: number, yOff: number, tough = 1): number {
    const gl = this.gl, b = this.buildings.length;
    if (b >= NB) return -1;
    const vol = new Uint8Array(V * V * V), rnd = mulberry(L.seed);
    generate(L.kind, vol, rnd);
    const tile = new Float32Array(256 * 128 * 4);
    let solid = 0;
    for (let z = 0; z < V; z++) for (let y = 0; y < V; y++) for (let x = 0; x < V; x++) {
      const m = vol[(z * V + y) * V + x]; if (!m) continue;
      const o = (((Math.floor(z / 8) * 32 + y) * 256) + (z % 8) * 32 + x) * 4;
      tile[o] = 1; tile[o + 1] = 1; tile[o + 2] = m; tile[o + 3] = rnd(); solid++;
    }
    for (const t of [this.atlas, this.atlasB]) {
      gl.bindTexture(gl.TEXTURE_2D, t.tex[0]);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, (b % 8) * 256, Math.floor(b / 8) * 128, 256, 128, gl.RGBA, gl.FLOAT, tile);
    }
    this.buildings.push({ x: L.x, z: L.z, kind: L.kind, seed: L.seed, solid, eaten: 0, collapseAt: -1, h: 32 });
    this.s2Arr[b * 4] = scale; this.s2Arr[b * 4 + 1] = yOff; this.s2Arr[b * 4 + 2] = tough;
    this.syncUniforms();
    this.place(b, L.x, L.z, yOff);
    return b;
  }
  /** move a volume (the walking giant): update its position and its cells in the lookup grid */
  place(b: number, x: number, z: number, yOff: number) {
    const B = this.buildings[b];
    const sc = this.s2Arr[b * 4] || 1;
    const half = (V * VS * sc) / 2 + 1.0;
    for (let i = 0; i < this.gridData.length; i++) if (this.gridData[i] === b + 1) this.gridData[i] = 0;
    const put = (c: number) => { for (let k = 0; k < 4; k++) if (this.gridData[c * 4 + k] === 0) { this.gridData[c * 4 + k] = b + 1; return; } };
    B.x = x; B.z = z;
    for (let gz = 0; gz < GRID; gz++) for (let gx = 0; gx < GRID; gx++) {
      const wx = (gx + 0.5) / GRID * WORLD - WORLD / 2, wz = (gz + 0.5) / GRID * WORLD - WORLD / 2;
      if (Math.abs(wx - x) <= half && Math.abs(wz - z) <= half) put(gz * GRID + gx);
    }
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.grid);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GRID, GRID, gl.RGBA, gl.UNSIGNED_BYTE, this.gridData);
    this.bArr[b * 4] = x; this.bArr[b * 4 + 1] = z; this.s2Arr[b * 4 + 1] = yOff;
  }

  focus = new Float32Array(3);
  draw(vp: Float32Array, cam: Float32Array, light: WebGLTexture) {
    const gl = this.gl, u = this.march.u;
    gl.bindVertexArray(this.vao);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT); // back faces: works from outside and from inside the box
    gl.useProgram(this.march.p);
    bindTex(gl, 0, this.atlas.tex[0], u.uAtlas); bindTex(gl, 1, this.color.tex[0], u.uColor); bindTex(gl, 2, light, u.uLight);
    gl.uniformMatrix4fv(u.uVP, false, vp);
    gl.uniform4fv(u.uB, this.bArr); gl.uniform4fv(u.uS2, this.s2Arr);
    gl.uniform3fv(u.uCam, cam); gl.uniform3fv(u.uFocus, this.focus); gl.uniform3f(u.uSun, -0.45, 0.78, 0.43); gl.uniform1f(u.uWorld, WORLD); gl.uniform1f(u.uShadow, this.shadows ? 1 : 0);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, this.buildings.length);
    gl.disable(gl.CULL_FACE);
  }
}

// ---------------------------------------------------------------- procedural shapes at 32^3, with real materials
export const theme = { snow: false, giant: 0, part: 0 };
function generate(kind: Kind, vol: Uint8Array, rnd: () => number) {
  const ROOF = theme.snow ? 23 : 3;
  const set = (x: number, y: number, z: number, m: number) => { if (x >= 0 && y >= 0 && z >= 0 && x < V && y < V && z < V) vol[(z * V + y) * V + x] = m; };
  const get = (x: number, y: number, z: number) => (x >= 0 && y >= 0 && z >= 0 && x < V && y < V && z < V ? vol[(z * V + y) * V + x] : 0);
  if (kind === 0) { // timber-framed cottage with a tiled gable roof and a brick chimney
    const x0 = 5, x1 = 26, z0 = 7, z1 = 24, wallTop = 15;
    for (let y = 0; y <= wallTop; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const edgeX = x === x0 || x === x1, edgeZ = z === z0 || z === z1;
      if (!(edgeX || edgeZ) && y > 0) continue; // hollow inside (a floor at y = 0)
      let m = 1;
      if (y <= 1) m = 6; // stone footing
      else if ((edgeX && edgeZ) || y === 8 || y === wallTop || (edgeZ && (x - x0) % 7 === 0) || (edgeX && (z - z0) % 6 === 0)) m = 2; // timber frame
      else if (y >= 4 && y <= 6 && ((edgeZ && [3, 4, 10, 11, 17, 18].includes(x - x0)) || (edgeX && [4, 5, 11, 12].includes(z - z0)))) m = 4; // windows
      else if (y >= 10 && y <= 12 && ((edgeZ && [4, 5, 15, 16].includes(x - x0)) || (edgeX && [7, 8].includes(z - z0)))) m = 4;
      if (z === z0 && x >= x0 + 9 && x <= x0 + 11 && y >= 2 && y <= 7) m = 5; // the door
      set(x, y, z, m);
    }
    // gable roof along x, 1 voxel overhang, two voxels thick
    const cz = (z0 + z1) / 2, rise = 10;
    for (let y = wallTop + 1; y <= wallTop + rise; y++) {
      const half = (z1 - z0) / 2 + 1.5 - (y - wallTop - 1) * 1.05;
      if (half < 0) break;
      for (let x = x0 - 1; x <= x1 + 1; x++) for (let z = 0; z < V; z++) {
        const d = Math.abs(z - cz);
        if (d <= half && d > half - 2.2) set(x, y, z, ROOF);
        else if (d <= half - 2.2 && (x === x0 || x === x1)) set(x, y, z, 1); // gable ends
      }
    }
    for (let y = 12; y <= wallTop + rise + 2; y++) for (let z = 18; z <= 19; z++) for (let x = 21; x <= 22; x++) set(x, y, z, 12);
  } else if (kind === 1) { // a tree: tapering trunk, a few branches, a crown of leaf clusters with blossoms
    const tx = 15.5, tz = 15.5, top = 14 + Math.floor(rnd() * 4);
    for (let y = 0; y <= top; y++) {
      const r = 1.9 - y * 0.05 + (y < 2 ? 0.8 : 0);
      for (let z = 0; z < V; z++) for (let x = 0; x < V; x++) if ((x - tx) ** 2 + (z - tz) ** 2 <= r * r) set(x, y, z, 7);
    }
    const clusters: [number, number, number, number][] = [];
    for (let i = 0; i < 4; i++) { // branches reaching out and up
      const a = rnd() * Math.PI * 2, len = 5 + rnd() * 4, y0 = top - 5 + rnd() * 3;
      for (let s = 0; s <= len; s += 0.4) {
        const bx = Math.round(tx + Math.cos(a) * s), by = Math.round(y0 + s * 0.6), bz = Math.round(tz + Math.sin(a) * s);
        for (let dy = 0; dy <= 1; dy++) for (let dz = -1; dz <= 0; dz++) for (let dx = -1; dx <= 0; dx++) set(bx + dx, by + dy, bz + dz, 7);
      }
      clusters.push([tx + Math.cos(a) * len, y0 + len * 0.6 + 1, tz + Math.sin(a) * len, 4 + rnd() * 2.5]);
    }
    clusters.push([tx, top + 4, tz, 6 + rnd() * 1.5]);
    for (const [cx, cy, cz, r] of clusters) for (let y = 0; y < V; y++) for (let z = 0; z < V; z++) for (let x = 0; x < V; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2 * 1.2 + (z - cz) ** 2);
      if (d <= r + (rnd() - 0.5) * 1.2 && !get(x, y, z)) set(x, y, z, rnd() < 0.04 ? 10 : rnd() < 0.45 ? 9 : 8);
    }
  } else if (kind === 2) { // round stone tower, gold windows, blue cone roof
    const c = 15.5;
    for (let y = 0; y < V; y++) for (let z = 0; z < V; z++) for (let x = 0; x < V; x++) {
      const r = Math.hypot(x - c, z - c);
      if (y <= 21) {
        if (r <= 7 && r > 5.6) set(x, y, z, y % 6 === 3 && (Math.abs(x - c) < 1 || Math.abs(z - c) < 1) ? 13 : 6);
        else if (r <= 5.6 && y % 7 === 0) set(x, y, z, 2); // wooden floors inside
      } else {
        const rr = (31 - y) * 0.85;
        if (r <= rr && r > rr - 1.8) set(x, y, z, 14);
      }
    }
  } else if (kind === 3) { // red barn with white trim and a gambrel roof
    const x0 = 3, x1 = 28, z0 = 8, z1 = 23, wallTop = 12;
    for (let y = 0; y <= wallTop; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const edgeX = x === x0 || x === x1, edgeZ = z === z0 || z === z1;
      if (!(edgeX || edgeZ) && y > 0) continue;
      let m = (x + z) % 3 === 0 ? 16 : 15;
      if (y === 0) m = 6;
      if ((edgeX && edgeZ) || y === wallTop) m = 16;
      if (edgeZ && z === z0 && x >= 13 && x <= 18 && y >= 1 && y <= 9) m = (x + y) % 4 === 0 ? 16 : 5;
      set(x, y, z, m);
    }
    const cz = (z0 + z1) / 2;
    for (let y = wallTop + 1; y <= wallTop + 9; y++) {
      const k = y - wallTop - 1;
      const half = k < 4 ? (z1 - z0) / 2 + 1 - k * 0.4 : (z1 - z0) / 2 - 0.6 - (k - 4) * 1.6;
      if (half < 0) break;
      for (let x = x0 - 1; x <= x1 + 1; x++) for (let z = 0; z < V; z++) {
        const d = Math.abs(z - cz);
        if (d <= half && d > half - 1.8) set(x, y, z, ROOF);
        else if (d <= half - 1.8 && (x === x0 || x === x1)) set(x, y, z, 15);
      }
    }
    for (let y = 1; y <= 5; y++) for (let z = 24; z <= 30; z++) for (let x = 20; x <= 29; x++) if (rnd() < 0.85 && (x - 24.5) ** 2 + (y * 1.6) ** 2 + (z - 27) ** 2 < 30) set(x, y, z, 11); // a hay pile
  } else if (kind === 5) { // a part of this land's giant (theme.giant, theme.part): each part is its own volume, so it can walk
    const ell = (x: number, y: number, z: number, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1;
    const cap = (x: number, y: number, z: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number) => {
      const dx = bx - ax, dy = by - ay, dz = bz - az, l2 = dx * dx + dy * dy + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / l2));
      return (x - ax - dx * t) ** 2 + (y - ay - dy * t) ** 2 + (z - az - dz * t) ** 2 <= r * r;
    };
    const g = theme.giant % 5, part = theme.part;
    const noise = (x: number, y: number, z: number) => Math.sin(x * 1.7 + y * 0.9) * Math.sin(z * 1.3 - y * 1.1) + Math.sin(x * 0.5 + z * 0.7 + y * 0.3) * 0.5;
    // the skin of each giant
    const skin = (x: number, y: number, z: number): number => {
      if (g === 0) return noise(x, y, z) > 0.55 ? 6 : rnd() < 0.1 ? 19 : 17;
      if (g === 1) return 22;
      if (g === 2) return (y % 6 === 0) ? 16 : 27;
      if (g === 3) return rnd() < 0.15 ? 16 : 23;
      return noise(x, y, z) > 0.95 ? 18 : 26;
    };
    const fill = (f: (x: number, y: number, z: number) => number) => { for (let y = 0; y < V; y++) for (let z = 0; z < V; z++) for (let x = 0; x < V; x++) { const m = f(x, y, z); if (m) set(x, y, z, m); } };
    const fur = g === 3 ? 1.2 : g === 0 ? 0.6 : 0;
    const j = () => (rnd() - 0.5) * fur;
    if (part === 4 || part === 5) { // a leg: thigh, knee, shin, a broad foot (toes to the front)
      const stub = g === 1 ? 0.8 : 1;
      fill((x, y, z) => {
        if (ell(x, y, z, 15.5, 2.6, 18.5, 7.5, 2.8 + (g === 2 ? 0.3 : 0), 10)) return g === 2 ? 26 : g === 4 ? 26 : skin(x, y, z); // foot
        if (g !== 1 && y <= 3 && z >= 26 && (x === 11 || x === 15 || x === 19) && ell(x, y, z, 15.5, 2.6, 18.5, 8, 3, 11)) return g === 3 || g === 4 ? 16 : 6; // toes / claws
        if (cap(x, y, z, 15.5, 31, 15.5, 15.5, 14, 15.5, (7.2 + j()) * stub)) return skin(x, y, z);         // thigh
        if (ell(x, y, z, 15.5, 13, 16.5, 6.2, 3.8, 6.2)) return g === 2 ? 16 : g === 4 ? 25 : skin(x, y, z);  // knee
        if (cap(x, y, z, 15.5, 13, 15.5, 15.5, 3, 16.5, (5.8 + j()) * stub)) return skin(x, y, z);          // shin
        return 0;
      });
    } else if (part === 1) { // the body
      fill((x, y, z) => {
        const r = ell(x, y, z, 15.5, 15, 15.5, 14 + j(), 15.5, 10 + j());
        if (!r) {
          if (g === 4 && cap(x, y, z, 15.5, 6, 6, 15.5, 30, 2, 2.2) && ((y >> 2) & 1) === 0) return 25; // crystal ridge down the back
          return 0;
        }
        const front = z >= 22;
        if (g === 2 && front) { const cx = x - 15.5, cy = y - 18; const d = cx * cx + cy * cy;
          if (d <= 30) return (Math.abs(cx) < 0.7 && cy > 0 && cy < 5) || (Math.abs(cy) < 0.7 && cx > 0 && cx < 4) ? 26 : d > 24 ? 13 : 16; // a clock on its chest
          if (y >= 6 && y <= 8) return 12; // a brick belt
          if ((x + y) % 7 === 0) return 13; }  // gold rivets
        if (g === 1 && y >= 27) return rnd() < 0.3 ? 21 : 22;                     // gills under the king's collar
        if (g === 1 && front && y >= 10 && y <= 12 && Math.abs(x - 15.5) < 5) return 15; // a red sash
        if (g === 3 && front && ell(x, y, z, 15.5, 14, 24, 8, 9, 3)) return 16;   // a pale chest
        if (g === 0 && y >= 26 && rnd() < 0.5) return rnd() < 0.2 ? 10 : 19;       // moss and flowers on the shoulders
        return skin(x, y, z);
      });
    } else if (part === 2 || part === 3) { // an arm: shoulder, upper arm, elbow, forearm, a big fist
      fill((x, y, z) => {
        if (ell(x, y, z, 15.5, 27, 15.5, 8.5, 5, 8.5)) return g === 2 ? 14 : g === 4 && rnd() < 0.35 ? 25 : g === 0 && rnd() < 0.4 ? 19 : skin(x, y, z); // shoulder
        if (g === 4 && cap(x, y, z, 15.5, 29, 15.5, 15.5, 31, 13, 1.6)) return 25;
        if (cap(x, y, z, 15.5, 26, 15.5, 15.5, 15, 15.5, 4.6 + j())) return skin(x, y, z);
        if (cap(x, y, z, 15.5, 15, 15.5, 15.5, 7, 17.5, 5 + j())) return g === 2 ? 27 : skin(x, y, z);
        if (ell(x, y, z, 15.5, 4.5, 18, 6.2, 4.5, 6.2)) return (z >= 23 && y >= 6 && (x % 3) === 0) ? (g === 3 || g === 4 ? 16 : 6) : g === 2 ? 26 : skin(x, y, z); // fist with knuckles
        return 0;
      });
    } else { // the head: its own face for every giant
      fill((x, y, z) => {
        const fx = x - 15.5;
        if (g === 0) { // the golem: a rough boulder with a heavy brow, deep burning eyes, a cracked mouth, moss hair with flowers
          if (!ell(x, y, z, 15.5, 13, 15.5, 11 + j(), 11, 10 + j())) return 0;
          if (z >= 23 && y >= 13 && y <= 15 && Math.abs(Math.abs(fx) - 4.5) <= 1.6) return 18;
          if (z >= 24 && y >= 16 && y <= 17 && Math.abs(fx) <= 8) return 6;    // brow
          if (z >= 23 && y === 8 && Math.abs(fx) <= 4 + (x % 2)) return 26;    // mouth
          if (y >= 20 && rnd() < 0.65) return rnd() < 0.15 ? (rnd() < 0.5 ? 10 : 13) : 19;
          return skin(x, y, z);
        }
        if (g === 1) { // the mushroom king: a vast spotted cap, a round face with big eyes and a smile
          if (y >= 13 && ell(x, y, z, 15.5, 16, 15.5, 15.5, 15, 15.5)) { if (y <= 14) return 21; const sp = Math.sin(x * 0.9) * Math.sin(z * 0.9 + 1) * Math.sin(y * 0.8); return sp > 0.55 ? 21 : 20; }
          if (!ell(x, y, z, 15.5, 7.5, 16, 9, 7.5, 8.5)) return 0;
          if (z >= 22 && ell(x, y, z, 15.5 + (fx < 0 ? -3.5 : 3.5), 9, 24, 2.2, 2.6, 2)) return (Math.abs(x - (fx < 0 ? 12 : 19)) <= 0.6 && y >= 8 && y <= 9) ? 26 : 16;
          if (z >= 23 && y === 4 && Math.abs(fx) <= 3) return 26;
          if (z >= 23 && y === 5 && Math.abs(fx) >= 3 && Math.abs(fx) <= 4) return 26;
          if (z >= 22 && y === 6 && Math.abs(Math.abs(fx) - 6) <= 1) return 10; // rosy cheeks
          return 22;
        }
        if (g === 2) { // the clockwork knight: a great helm, a glowing visor, a red crest, gold rivets
          const inHelm = Math.abs(fx) <= 9.5 && y <= 22 && z >= 6 && z <= 25 && (Math.abs(fx) <= 8.5 || y <= 20) && (fx * fx + (y - 14) * (y - 14) * 0.4) < 120;
          if (inHelm) {
            if (z >= 24 && y >= 12 && y <= 13 && Math.abs(fx) <= 7) return 18;
            if (z >= 24 && Math.abs(fx) <= 0.6 && y < 12 && y > 3) return 13;
            if ((y === 3 || y === 21) && (x % 3 === 0)) return 13;
            return 27;
          }
          if (Math.abs(fx) <= 1.2 && z >= 4 && z <= 26 && y >= 22 && y <= 22 + 6 * Math.sin(((z - 4) / 22) * Math.PI)) return 15;
          return 0;
        }
        if (g === 3) { // the yeti: shaggy, a grey face, small fierce eyes, fangs, curled horns
          if (cap(x, y, z, 7, 18, 15, 2, 25, 13, 2.2) || cap(x, y, z, 2, 25, 13, 4, 30, 17, 1.6) || cap(x, y, z, 24, 18, 15, 29, 25, 13, 2.2) || cap(x, y, z, 29, 25, 13, 27, 30, 17, 1.6)) return 6;
          if (!ell(x, y, z, 15.5, 13, 15.5, 11 + j(), 12 + j(), 10 + j())) return 0;
          if (z >= 21 && ell(x, y, z, 15.5, 11, 25, 7, 7, 3)) {
            if (y >= 13 && y <= 14 && Math.abs(Math.abs(fx) - 3.5) <= 1) return 18;
            if (y >= 6 && y <= 7 && Math.abs(fx) <= 4) return y === 6 && Math.abs(fx) >= 2.5 ? 16 : 26;
            return 17;
          }
          return 23;
        }
        // the crystal titan: an angular obsidian head, slanted burning eyes, a crown of crystal
        const crown = [[-7, 3], [-3.5, 6], [0, 8], [3.5, 6], [7, 3]].some(([cx, h]) => cap(x, y, z, 15.5 + cx, 18, 15.5, 15.5 + cx * 1.25, 19 + h + 4, 14, 1.5));
        if (crown) return 25;
        if (!(Math.abs(fx) + Math.abs(y - 11) * 0.6 <= 10 && Math.abs(z - 15.5) <= 9 && y <= 19)) return 0;
        if (z >= 24 && y >= 11 && y <= 12 + (Math.abs(fx) > 4 ? 1 : 0) && Math.abs(fx) >= 2 && Math.abs(fx) <= 6) return 18;
        return skin(x, y, z);
      });
    }
  } else if (kind === 7) { // a giant mushroom: a creamy stem and a red cap with white spots
    const c = 15.5, capY = 18 + Math.floor(rnd() * 4);
    for (let y = 0; y < capY; y++) for (let z = 0; z < V; z++) for (let x = 0; x < V; x++) if ((x - c) ** 2 + (z - c) ** 2 <= (3.2 - y * 0.04) ** 2) set(x, y, z, 22);
    for (let y = capY; y < V; y++) for (let z = 0; z < V; z++) for (let x = 0; x < V; x++) {
      const r = Math.hypot(x - c, z - c), top = 13.5 * Math.sqrt(Math.max(0, 1 - ((y - capY) / (V - capY)) ** 2));
      if (r <= top) set(x, y, z, y < capY + 2 ? 22 : rnd() < 0.1 ? 21 : 20); // a solid cap (hollow ones cannot hold their rim)
    }
  } else if (kind === 8) { // a pine: layered cones on a trunk (snow on the tiers in the snow lands)
    const c = 15.5;
    for (let y = 0; y < 8; y++) for (let z = 0; z < V; z++) for (let x = 0; x < V; x++) if ((x - c) ** 2 + (z - c) ** 2 <= 2.2) set(x, y, z, 7);
    for (let y = 6; y < V; y++) {
      const tier = (y - 6) % 7, r = Math.max(0.6, (10 - (y - 6) * 0.32) * (1 - tier / 9));
      for (let z = 0; z < V; z++) for (let x = 0; x < V; x++) {
        const d = Math.hypot(x - c, z - c);
        if (d <= r + (rnd() - 0.5) * 0.8) set(x, y, z, theme.snow && tier <= 1 && d > r - 2 ? 23 : 24);
      }
    }
  } else if (kind === 9) { // a tall town house: stone ground floor, plaster storeys, slate roof, many windows
    const x0 = 8, x1 = 23, z0 = 8, z1 = 23, top = 22;
    for (let y = 0; y <= top; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const ex = x === x0 || x === x1, ez = z === z0 || z === z1;
      if (!(ex || ez) && y % 7 !== 0) continue;
      let m = y < 6 ? 6 : 1;
      if ((ex && ez) || y % 7 === 0) m = y < 6 ? 6 : 2;
      if (y % 7 >= 2 && y % 7 <= 4 && ((ez && (x - x0) % 4 === 2) || (ex && (z - z0) % 4 === 2))) m = 4;
      if (z === z0 && x >= 14 && x <= 16 && y >= 1 && y <= 4) m = 5;
      set(x, y, z, m);
    }
    for (let y = top + 1; y < V; y++) {
      const half = 8.5 - (y - top - 1) * 1.1;
      if (half < 0) break;
      for (let z = 0; z < V; z++) for (let x = x0 - 1; x <= x1 + 1; x++) { const d = Math.abs(z - 15.5); if (d <= half && d > half - 2) set(x, y, z, theme.snow ? 23 : 27); else if (d <= half - 2 && (x === x0 || x === x1)) set(x, y, z, 1); }
    }
  } else if (kind === 10) { // a crystal spire on obsidian
    const c = 15.5;
    for (let y = 0; y < 5; y++) for (let z = 0; z < V; z++) for (let x = 0; x < V; x++) if ((x - c) ** 2 + (z - c) ** 2 < 60 - y * 8 + (rnd() - 0.5) * 6) set(x, y, z, 26);
    for (let k = 0; k < 4; k++) {
      const a = rnd() * 6.28, tilt = 0.15 + rnd() * 0.25, bx = c + Math.cos(a) * 2, bz = c + Math.sin(a) * 2, h = 18 + rnd() * 13;
      for (let y = 2; y < h; y++) {
        const r = 2.6 * (1 - (y - 2) / h) + 0.4;
        const cx = bx + Math.cos(a) * y * tilt, cz = bz + Math.sin(a) * y * tilt;
        for (let z = 0; z < V; z++) for (let x = 0; x < V; x++) if (Math.abs(x - cx) + Math.abs(z - cz) <= r) set(x, Math.round(y), z, 25);
      }
    }
  } else if (kind === 6) { // a flower bush: a mound of leaves with big blossoms (seen small: scale ~0.45)
    const c = 15.5;
    for (let y = 0; y < 22; y++) for (let z = 0; z < V; z++) for (let x = 0; x < V; x++) {
      const d = Math.sqrt((x - c) ** 2 + ((y - 6) * 1.25) ** 2 + (z - c) ** 2);
      if (d < 12 + (rnd() - 0.5) * 2.5 && y < 18) set(x, y, z, rnd() < 0.16 ? 10 : rnd() < 0.08 ? 13 : rnd() < 0.5 ? 9 : 8);
    }
    for (let y = 0; y < 4; y++) for (let z = 14; z <= 17; z++) for (let x = 14; x <= 17; x++) set(x, y, z, 7);
  } else { // boulders
    for (let i = 0; i < 3; i++) {
      const cx = 8 + rnd() * 16, cz = 8 + rnd() * 16, r = 4 + rnd() * 4;
      for (let y = 0; y < V; y++) for (let z = 0; z < V; z++) for (let x = 0; x < V; x++) {
        const d = Math.sqrt((x - cx) ** 2 + (y * 1.3) ** 2 + (z - cz) ** 2);
        if (d < r + (rnd() - 0.5)) set(x, y, z, 17);
      }
    }
  }
}
function mulberry(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
