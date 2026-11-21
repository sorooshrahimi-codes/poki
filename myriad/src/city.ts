// The petrified world, phase 2: voxel buildings and trees that the swarm climbs, eats and collapses.
//
// Each building is a 16^3 voxel volume stored as one 64x64 tile of a float "density atlas" (16 slices of 16x16).
//  - Mites that touch a solid voxel are marked as eating (pos.w = 2) by the swarm update.
//  - An eat pass draws every eating mite as a point into the atlas with subtractive blending: the voxel it is on
//    loses density, and when it drops below 0.5 the voxel is gone (the renderer skips it).
//  - The same eat pass adds into a tiny per-building counter; it is read back asynchronously (never blocking)
//    so the CPU knows how much of each building is gone, grows the swarm and triggers the collapse.
//  - Collapse is analytic, in the vertex shader: every voxel falls after a delay set by its height, tumbles,
//    bounces and settles as rubble. No physics engine, no CPU work, no hitch.
// The colour map is a world-space texture the swarm paints into; every surface blends from stone grey to colour.
import { FULLSCREEN_VS, bindTex, program, target, texture, type GL, type Program, type Target } from "./gl.ts";
import { S, WORLD } from "./swarm.ts";

export const V = 16; // voxels per side
export const VS = 0.55; // voxel size in world units
export const NB = 64; // building slots (8 x 8 tiles in the atlas)
export const GRID = 80; // building lookup grid over the world (2 world units per cell)
export const COLOR = 512; // colour map resolution

export type Kind = 0 | 1 | 2 | 3; // house, tree, tower, barn

export interface Building { x: number; z: number; kind: Kind; seed: number; solid: number; eaten: number; collapseAt: number; h: number; rubble?: number }

const CUBE = `
const vec3 CUBE_P[8] = vec3[8](vec3(0,0,0), vec3(1,0,0), vec3(1,1,0), vec3(0,1,0), vec3(0,0,1), vec3(1,0,1), vec3(1,1,1), vec3(0,1,1));
const int CUBE_I[36] = int[36](0,2,1, 0,3,2, 4,5,6, 4,6,7, 0,1,5, 0,5,4, 3,7,6, 3,6,2, 0,4,7, 0,7,3, 1,2,6, 1,6,5);
const vec3 CUBE_N[6] = vec3[6](vec3(0,0,-1), vec3(0,0,1), vec3(0,-1,0), vec3(0,1,0), vec3(-1,0,0), vec3(1,0,0));
`;
const ATLAS = `
// atlas texel of voxel (x,y,z) of building b
ivec2 atlasTexel(int b, ivec3 v) {
  ivec2 tile = ivec2(b % 8, b / 8) * 64;
  return tile + ivec2((v.z % 4) * 16 + v.x, (v.z / 4) * 16 + v.y);
}
`;
const HASH = `
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
vec3 h31(float p) { vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xxy + p3.yzz) * p3.zyx); }
`;
/** the colour each voxel had before the grey: shared by the renderer (and later the rubble) */
const PALETTE = `
vec3 voxelColor(float kind, vec3 v, float seed) {
  float n = fract(sin(dot(v + seed, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  if (kind < 0.5) { // house: cream walls, red roof, blue windows, a door
    if (v.y >= 10.0) return mix(vec3(0.80, 0.22, 0.16), vec3(0.65, 0.16, 0.12), n);
    bool win = mod(v.y, 4.0) >= 1.0 && mod(v.y, 4.0) <= 2.0 && (mod(v.x, 5.0) >= 2.0 && mod(v.x, 5.0) <= 3.0 || mod(v.z, 5.0) >= 2.0 && mod(v.z, 5.0) <= 3.0);
    if (win) return vec3(0.25, 0.55, 0.95);
    return mix(vec3(0.96, 0.88, 0.70), vec3(0.90, 0.80, 0.62), n);
  }
  if (kind < 1.5) { // tree: brown trunk, green canopy with a few blossoms
    if (v.y < 6.0) return mix(vec3(0.45, 0.28, 0.16), vec3(0.38, 0.22, 0.12), n);
    return n > 0.93 ? vec3(1.0, 0.55, 0.75) : mix(vec3(0.25, 0.70, 0.25), vec3(0.45, 0.85, 0.30), n);
  }
  if (kind < 2.5) { // tower: warm stone, gold windows, blue roof
    if (v.y >= 14.0) return vec3(0.22, 0.40, 0.85);
    return mod(v.y, 3.0) < 1.0 && n > 0.5 ? vec3(1.0, 0.80, 0.30) : mix(vec3(0.78, 0.70, 0.60), vec3(0.68, 0.60, 0.52), n);
  }
  // barn: red planks, white trim
  if (v.y >= 9.0) return vec3(0.40, 0.25, 0.20);
  return mod(v.x + v.z, 4.0) < 1.0 ? vec3(0.95, 0.95, 0.90) : mix(vec3(0.80, 0.20, 0.15), vec3(0.70, 0.15, 0.10), n);
}
`;

const VOX_VS = `#version 300 es
precision highp float;
uniform sampler2D uAtlas, uColor;
uniform mat4 uVP;
uniform vec4 uB[${NB}];   // x, z, kind, seed
uniform vec4 uB2[${NB}];  // collapseAt (or -1), height (voxels), 0, 0
uniform float uTime, uWorld;
out vec3 vCol;
out vec3 vN;
out vec3 vW;
out float vRestored;
${CUBE}${ATLAS}${HASH}${PALETTE}
mat3 rot(vec3 a) { vec3 s = sin(a), c = cos(a);
  return mat3(c.y*c.z, c.y*s.z, -s.y, s.x*s.y*c.z - c.x*s.z, s.x*s.y*s.z + c.x*c.z, s.x*c.y, c.x*s.y*c.z + s.x*s.z, c.x*s.y*s.z - s.x*c.z, c.x*c.y); }
void main() {
  int inst = gl_InstanceID;
  int b = inst / 4096, vi = inst % 4096;
  ivec3 v = ivec3(vi % 16, (vi / 16) % 16, vi / 256);
  float d = texelFetch(uAtlas, atlasTexel(b, v), 0).r;
  vec4 B = uB[b], B2 = uB2[b];
  if (d < 0.5 || B.w < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  // hidden voxels (all six neighbours solid) are skipped: only the shell costs pixels
  bool inner = v.x > 0 && v.y > 0 && v.z > 0 && v.x < 15 && v.y < 15 && v.z < 15
    && texelFetch(uAtlas, atlasTexel(b, v + ivec3(1,0,0)), 0).r > 0.5 && texelFetch(uAtlas, atlasTexel(b, v - ivec3(1,0,0)), 0).r > 0.5
    && texelFetch(uAtlas, atlasTexel(b, v + ivec3(0,1,0)), 0).r > 0.5 && texelFetch(uAtlas, atlasTexel(b, v - ivec3(0,1,0)), 0).r > 0.5
    && texelFetch(uAtlas, atlasTexel(b, v + ivec3(0,0,1)), 0).r > 0.5 && texelFetch(uAtlas, atlasTexel(b, v - ivec3(0,0,1)), 0).r > 0.5;
  if (inner && B2.x < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  int ci = CUBE_I[gl_VertexID];
  vec3 local = CUBE_P[ci];
  vec3 n = CUBE_N[gl_VertexID / 6];
  vec3 base = vec3(B.x, 0.0, B.y) + (vec3(v) - vec3(8.0, 0.0, 8.0)) * ${VS.toFixed(3)};
  vec3 wp = base + local * ${VS.toFixed(3)};
  // analytic collapse: fall after a height-based delay, drift outward, tumble, bounce once, settle as rubble
  if (B2.x >= 0.0) {
    vec3 r = h31(float(inst) * 1.37);
    float tau = uTime - B2.x - (float(v.y) / 16.0) * 0.35 - r.x * 0.25;
    if (tau > 0.0) {
      vec3 c = base + vec3(0.5) * ${VS.toFixed(3)};
      vec3 out_ = normalize(vec3(c.x - B.x, 0.0, c.z - B.y) + (r - 0.5) * 2.0) * (2.0 + 4.0 * r.y);
      float h0 = c.y;
      float fallT = sqrt(2.0 * max(h0, 0.01) / 18.0);
      float tt = min(tau, fallT * 1.6);
      float y = h0 - 9.0 * tt * tt;
      float bounce = tau > fallT ? max(0.0, sin(min((tau - fallT) * 6.0, 3.1416))) * (0.6 + r.z) / (1.0 + (tau - fallT) * 4.0) : 0.0;
      float rest = ${VS.toFixed(3)} * (0.5 + 1.5 * r.z);
      y = max(y, rest) + bounce;
      vec3 off = out_ * min(tau, 1.2);
      mat3 R = rot((r * 2.0 - 1.0) * min(tau, 1.5) * 4.0);
      vec3 lc = (local - 0.5) * ${VS.toFixed(3)};
      wp = vec3(c.x, 0.0, c.z) + off + vec3(0.0, y, 0.0) + R * lc;
      n = R * n;
    }
  }
  vec4 col = vec4(voxelColor(B.z, vec3(v), B.w), 1.0);
  vec2 uv = wp.xz / uWorld + 0.5;
  vRestored = clamp(texture(uColor, uv).r, 0.0, 1.0);
  vCol = col.rgb;
  vN = n;
  vW = wp;
  gl_Position = uVP * vec4(wp, 1.0);
}`;
const VOX_FS = `#version 300 es
precision highp float;
uniform sampler2D uLight;
uniform float uWorld;
uniform vec3 uCam;
in vec3 vCol;
in vec3 vN;
in vec3 vW;
in float vRestored;
out vec4 o;
void main() {
  vec3 grey = vec3(dot(vCol, vec3(0.3, 0.59, 0.11))) * 0.55 + 0.06;
  vec3 base = mix(grey, vCol, vRestored);
  vec3 L = normalize(vec3(-0.5, 0.8, 0.3));
  float diff = max(dot(vN, L), 0.0) * 0.55 + 0.35 + 0.1 * vN.y;
  // the swarm's light (stronger close to the ground where the swarm crawls)
  float sw = texture(uLight, vW.xz / uWorld + 0.5).r;
  float glow = (1.0 - exp(-sw * 0.012)) * exp(-max(vW.y, 0.0) * 0.12);
  vec3 c = base * (diff * mix(0.55, 1.0, vRestored) + glow * 1.6) + vec3(1.0, 0.5, 0.15) * glow * 0.35;
  float dist = length(vW - uCam);
  c = mix(c, vec3(0.12, 0.08, 0.13), smoothstep(70.0, 230.0, dist));
  o = vec4(c, 1.0);
}`;

const EAT_VS = `#version 300 es
precision highp float;
uniform sampler2D uPos;
uniform float uS, uMode; // mode 0: into the atlas, 1: into the per-building counter
uniform vec4 uB[${NB}];
uniform sampler2D uGrid;
uniform float uWorld;
uniform float uTime;
${ATLAS}${HASH}
void main() {
  int i = gl_VertexID;
  vec4 p = texelFetch(uPos, ivec2(i % int(uS), i / int(uS)), 0);
  gl_PointSize = 1.0;
  if (p.w < 1.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  int b = int(p.w - 2.0 + 0.5); // the update stored the building index in w (w = 2 + index)
  vec4 B = uB[b];
  vec3 lp = (p.xyz - vec3(B.x, 0.0, B.y)) / ${VS.toFixed(3)} + vec3(8.0, 0.0, 8.0);
  ivec3 v = clamp(ivec3(floor(lp)), ivec3(0), ivec3(15));
  if (uMode < 0.5) {
    vec2 t = (vec2(atlasTexel(b, v)) + 0.5) / 512.0;
    gl_Position = vec4(t * 2.0 - 1.0, 0.0, 1.0);
  } else {
    gl_Position = vec4((float(b) + 0.5) / ${NB}.0 * 2.0 - 1.0, 0.0, 0.0, 1.0);
  }
}`;
const EAT_FS = `#version 300 es
precision highp float;
uniform float uAmount;
out vec4 o;
void main() { o = vec4(uAmount); }`;

const PAINT_VS = `#version 300 es
precision highp float;
uniform sampler2D uPos;
uniform float uS, uWorld;
out float vW;
void main() {
  int i = gl_VertexID;
  vec4 p = texelFetch(uPos, ivec2(i % int(uS), i / int(uS)), 0);
  if (p.w < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  vW = p.w > 1.5 ? 1.0 : 0.15; // eating mites paint much more
  gl_Position = vec4(p.xz / uWorld * 2.0, 0.0, 1.0);
  gl_PointSize = 3.0;
}`;
const PAINT_FS = `#version 300 es
precision highp float;
uniform float uDt;
in float vW;
out vec4 o;
void main() { vec2 q = gl_PointCoord * 2.0 - 1.0; o = vec4(vW * uDt * 2.0 * max(0.0, 1.0 - dot(q, q))); }`;

const SOLID_FS = `#version 300 es
precision highp float;
uniform float uAmount;
out vec4 o;
void main() { o = vec4(uAmount); }`;

const CLAMP_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
in vec2 vUv;
out vec4 o;
void main() { o = vec4(min(texture(uSrc, vUv).r, 1.0)); }`;

export class City {
  gl: GL;
  atlas: Target; counter: Target; color: Target; colorTmp: Target;
  grid: WebGLTexture; gridData = new Uint8Array(GRID * GRID);
  vox: Program; eat: Program; paint: Program; clamp: Program; fill: Program;
  vao: WebGLVertexArrayObject;
  buildings: Building[] = [];
  bArr = new Float32Array(NB * 4); b2Arr = new Float32Array(NB * 4);
  // async readback of the per-building counter (never stalls the frame)
  pbo: WebGLBuffer; fence: WebGLSync | null = null; readBuf = new Float32Array(NB * 4); readAt = 0;
  lastCount = new Float32Array(NB);
  onEat: (b: number, amount: number) => void = () => {};
  constructor(gl: GL) {
    this.gl = gl;
    const r16 = { internal: gl.R16F, format: gl.RED, type: gl.HALF_FLOAT, filter: gl.NEAREST };
    this.atlas = target(gl, 512, 512, [r16]);
    this.counter = target(gl, NB, 1, [{ internal: gl.RGBA32F, format: gl.RGBA, type: gl.FLOAT, filter: gl.NEAREST }]);
    const cm = { internal: gl.R16F, format: gl.RED, type: gl.HALF_FLOAT, filter: gl.LINEAR };
    this.color = target(gl, COLOR, COLOR, [cm]); this.colorTmp = target(gl, COLOR, COLOR, [cm]);
    this.grid = texture(gl, GRID, GRID, gl.R8, gl.RED, gl.UNSIGNED_BYTE, gl.NEAREST);
    this.vox = program(gl, VOX_VS, VOX_FS, "voxels");
    this.eat = program(gl, EAT_VS, EAT_FS, "eat");
    this.paint = program(gl, PAINT_VS, PAINT_FS, "paint");
    this.clamp = program(gl, FULLSCREEN_VS, CLAMP_FS, "clamp");
    this.fill = program(gl, FULLSCREEN_VS, SOLID_FS, "fill");
    this.vao = gl.createVertexArray()!;
    this.pbo = gl.createBuffer()!;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, NB * 16, gl.STREAM_READ);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  }

  /** build a district: CPU generates each building's voxels once (a few ms), uploads the whole atlas once */
  build(list: { x: number; z: number; kind: Kind; seed: number }[]) {
    const gl = this.gl;
    const data = new Float32Array(512 * 512);
    this.gridData.fill(0);
    this.buildings = [];
    list.slice(0, NB).forEach((L, b) => {
      let solid = 0, top = 0;
      const rnd = mulberry(L.seed);
      const hgt = L.kind === 2 ? 16 : L.kind === 1 ? 13 + Math.floor(rnd() * 3) : L.kind === 3 ? 12 : 13;
      for (let z = 0; z < V; z++) for (let y = 0; y < V; y++) for (let x = 0; x < V; x++) {
        if (!shape(L.kind, x, y, z, hgt, rnd)) continue;
        const tx = (b % 8) * 64 + (z % 4) * 16 + x, ty = Math.floor(b / 8) * 64 + Math.floor(z / 4) * 16 + y;
        data[ty * 512 + tx] = 1; solid++; top = Math.max(top, y);
      }
      this.buildings.push({ x: L.x, z: L.z, kind: L.kind, seed: L.seed, solid, eaten: 0, collapseAt: -1, h: top + 1 });
      // the lookup grid: which building owns each 2x2 cell (with a margin so mites "see" walls before they hit)
      const half = (V * VS) / 2 + 1.2;
      for (let gz = 0; gz < GRID; gz++) for (let gx = 0; gx < GRID; gx++) {
        const wx = (gx + 0.5) / GRID * WORLD - WORLD / 2, wz = (gz + 0.5) / GRID * WORLD - WORLD / 2;
        if (Math.abs(wx - L.x) <= half && Math.abs(wz - L.z) <= half) this.gridData[gz * GRID + gx] = b + 1;
      }
    });
    gl.bindTexture(gl.TEXTURE_2D, this.atlas.tex[0]);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 512, 512, gl.RED, gl.FLOAT, data);
    gl.bindTexture(gl.TEXTURE_2D, this.grid);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GRID, GRID, gl.RED, gl.UNSIGNED_BYTE, this.gridData);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.color.fb); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.counter.fb); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.lastCount.fill(0);
    this.gone.fill(0);
    this.syncUniforms();
  }
  syncUniforms() {
    this.bArr.fill(0); this.b2Arr.fill(0);
    for (let b = 0; b < NB; b++) {
      const B = this.buildings[b];
      if (!B || this.gone[b]) { this.bArr[b * 4 + 3] = -1; this.b2Arr[b * 4] = -1; continue; }
      this.bArr[b * 4] = B.x; this.bArr[b * 4 + 1] = B.z; this.bArr[b * 4 + 2] = B.kind; this.bArr[b * 4 + 3] = B.seed % 97;
      this.b2Arr[b * 4] = B.collapseAt; this.b2Arr[b * 4 + 1] = B.h;
    }
  }

  /** after the swarm step: eating mites bite into the atlas and are counted; every mite paints colour back */
  feed(posTex: WebGLTexture, active: number, dt: number, t: number) {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.useProgram(this.eat.p);
    const u = this.eat.u;
    bindTex(gl, 0, posTex, u.uPos);
    gl.uniform1f(u.uS, S); gl.uniform4fv(u.uB, this.bArr); gl.uniform1f(u.uWorld, WORLD); gl.uniform1f(u.uTime, t);
    // bite: density -= rate * dt for every eating mite on its voxel
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.atlas.fb); gl.viewport(0, 0, 512, 512);
    gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT); gl.blendFunc(gl.ONE, gl.ONE);
    gl.uniform1f(u.uMode, 0); gl.uniform1f(u.uAmount, dt * 2.2);
    gl.drawArrays(gl.POINTS, 0, active);
    // count: the same bites, summed per building
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.counter.fb); gl.viewport(0, 0, NB, 1);
    gl.blendEquation(gl.FUNC_ADD);
    gl.uniform1f(u.uMode, 1); gl.uniform1f(u.uAmount, dt * 2.2);
    gl.drawArrays(gl.POINTS, 0, active);
    // colour comes back where the swarm goes
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.color.fb); gl.viewport(0, 0, COLOR, COLOR);
    gl.useProgram(this.paint.p);
    bindTex(gl, 0, posTex, this.paint.u.uPos);
    gl.uniform1f(this.paint.u.uS, S); gl.uniform1f(this.paint.u.uWorld, WORLD); gl.uniform1f(this.paint.u.uDt, dt);
    gl.drawArrays(gl.POINTS, 0, active);
    gl.disable(gl.BLEND);
    this.readback(t);
  }
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
        if (d > 0) { this.buildings[b].eaten += d; this.onEat(b, d); }
      }
    }
    if (t - this.readAt < 0.2) return;
    this.readAt = t;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.counter.fb);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
    gl.readPixels(0, 0, NB, 1, gl.RGBA, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  }

  /** rubble of a collapsed building melts away under the swarm (a subtractive pass over its atlas tile only) */
  dissolve(b: number, amount: number) {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.atlas.fb);
    gl.viewport((b % 8) * 64, Math.floor(b / 8) * 64, 64, 64);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this.fill.p); gl.uniform1f(this.fill.u.uAmount, amount);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.blendEquation(gl.FUNC_ADD); gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  /** a building that is fully gone stops costing anything */
  remove(b: number) { this.bArr[b * 4 + 3] = -1; this.b2Arr[b * 4] = -1; this.buildings[b].kind = this.buildings[b].kind; this.gone[b] = 1; }
  gone = new Uint8Array(NB);

  draw(vp: Float32Array, cam: Float32Array, light: WebGLTexture, t: number) {
    const gl = this.gl, u = this.vox.u;
    gl.bindVertexArray(this.vao);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    gl.useProgram(this.vox.p);
    bindTex(gl, 0, this.atlas.tex[0], u.uAtlas); bindTex(gl, 1, this.color.tex[0], u.uColor); bindTex(gl, 2, light, u.uLight);
    gl.uniformMatrix4fv(u.uVP, false, vp);
    gl.uniform4fv(u.uB, this.bArr); gl.uniform4fv(u.uB2, this.b2Arr);
    gl.uniform1f(u.uTime, t); gl.uniform1f(u.uWorld, WORLD); gl.uniform3fv(u.uCam, cam);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, this.buildings.length * 4096);
    gl.disable(gl.CULL_FACE);
  }
}

// ---------------------------------------------------------------- procedural shapes (CPU, once per district)
function shape(kind: Kind, x: number, y: number, z: number, h: number, rnd: () => number): boolean {
  const cx = x - 7.5, cz = z - 7.5;
  if (kind === 0) { // house: box walls, a pitched roof
    if (y < 10) return Math.abs(cx) <= 6 && Math.abs(cz) <= 5;
    const roofHalf = 6.5 - (y - 10) * 1.6;
    return y < h && Math.abs(cz) <= roofHalf && Math.abs(cx) <= 6.5;
  }
  if (kind === 1) { // tree: trunk and a lumpy canopy
    if (y < 6) return Math.abs(cx) <= 1 && Math.abs(cz) <= 1;
    const dy = y - 10;
    const r = 5.6 - Math.abs(dy) * 0.35 + (rnd() - 0.5) * 0.9;
    return y < h && cx * cx + cz * cz + dy * dy * 0.8 <= r * r;
  }
  if (kind === 2) { // tower: round, with a cone roof
    const rr = cx * cx + cz * cz;
    if (y < 13) return rr <= 20;
    return rr <= Math.max(0, (16 - y) * 1.9) ** 2;
  }
  // barn: long box, gambrel roof
  if (y < 8) return Math.abs(cx) <= 7 && Math.abs(cz) <= 5;
  const half = 5.5 - (y - 8) * 1.2;
  return y < h && Math.abs(cz) <= half && Math.abs(cx) <= 7;
}
function mulberry(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
