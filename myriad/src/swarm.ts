// The swarm: up to S*S mites simulated entirely on the GPU.
// State lives in float textures (ping-pong). Separation comes from a density field: every mite is splatted
// into a grid over the world, the grid is blurred, and each mite moves down the density gradient.
// No sorting, no atomics, the same path on every WebGL2 device, and the cost does not depend on crowding.
import { FULLSCREEN_VS, bindTex, program, target, type GL, type Program, type Target } from "./gl.ts";

export const S = 512; // 262,144 slots
export const WORLD = 160; // world units across the density grid
export const DEN = 256; // density grid resolution

const HASH = `
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
vec3 h31(float p) { vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xxy + p3.yzz) * p3.zyx); }
`;

const VS_W = 0.28;
const UPDATE_FS = `#version 300 es
precision highp float;
uniform sampler2D uPos, uVel, uDen, uGrid, uAtlas;
uniform vec4 uB[64];
uniform vec4 uB2[64];
uniform vec4 uS2[64];
uniform vec4 uShock; // x, z, radius, strength (a stomp)
uniform vec3 uLeader, uLeaderVel;
uniform float uDt, uTime, uActive, uS, uWorld, uSpeed, uRep, uLift, uRadius;
uniform vec2 uDenTexel;
layout(location = 0) out vec4 oPos;
layout(location = 1) out vec4 oVel;
${HASH}
float den(vec2 xz) { return texture(uDen, xz / uWorld + 0.5).r; }
ivec2 atlasTexel(int b, ivec3 v) { return ivec2((b % 8) * 256 + (v.z % 8) * 32 + v.x, (b / 8) * 128 + (v.z / 8) * 32 + v.y); }
float solidAt(int b, ivec3 v) {
  if (any(lessThan(v, ivec3(0))) || any(greaterThan(v, ivec3(31)))) return 0.0;
  return texelFetch(uAtlas, atlasTexel(b, v), 0).r;
}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  float id = float(c.y) * uS + float(c.x);
  vec4 p = texelFetch(uPos, c, 0);
  vec4 v = texelFetch(uVel, c, 0);
  vec3 r = h31(id);
  if (id >= uActive) {
    // dormant: waits inside the seed, so it is born right where the swarm is
    oPos = vec4(uLeader + (r - 0.5) * vec3(1.5, 0.4, 1.5), 0.0);
    oVel = vec4(0.0, 0.0, 0.0, r.x);
    return;
  }
  vec3 pos = p.xyz, vel = v.xyz;
  if (p.w < 0.5) {
    // just born: a little burst out of the seed
    vec3 q = h31(id + floor(uTime * 60.0)) - 0.5;
    pos = uLeader + vec3(q.x, 0.4 + abs(q.y), q.z) * 2.0;
    vel = normalize(vec3(q.x, 0.6, q.z) + 1e-4) * (4.0 + 6.0 * r.y) + uLeaderVel;
  }
  // 1. seek the seed: every mite heads for the finger, arriving softly (so the swarm moves as one liquid body)
  vec3 rel = pos - uLeader;
  float dist = length(rel.xz);
  vec3 inward = dist > 1e-3 ? -vec3(rel.x, 0.0, rel.z) / dist : vec3(0.0);
  float vmaxSeek = uSpeed * (1.15 + 0.3 * r.z);
  // each mite keeps its own place inside a body whose size grows with the swarm (sqrt: an even disc)
  float home = uRadius * sqrt(r.y) * 0.95;
  vec3 seek = inward * clamp((dist - home) * 4.5, -vmaxSeek * 0.3, vmaxSeek);
  // 2. a gentle mill around the seed when it rests (life, not chaos)
  vec3 tang = vec3(-inward.z, 0.0, inward.x) * (r.x < 0.5 ? 1.0 : -0.7);
  float calm = 1.0 - min(1.0, length(uLeaderVel) / max(uSpeed * 0.5, 1.0));
  vec3 mill = tang * min(dist, uRadius) * (0.15 + 0.35 * calm);
  // 3. curl noise, small: shimmer inside the body of the swarm
  vec3 q = pos * 0.11;
  float t = uTime * 0.25;
  const vec3 k1 = vec3(1.0, 0.6, 0.3), k2 = vec3(-0.4, 1.1, 0.8), k3 = vec3(0.7, -0.3, 1.2), k4 = vec3(1.3, 0.9, -0.6);
  vec3 g1 = k1 * cos(dot(k1, q) + t) + k2 * cos(dot(k2, q) * 1.7 + 1.3 * t) * 0.6;
  vec3 g2 = k3 * cos(dot(k3, q) - 0.7 * t) + k4 * cos(dot(k4, q) * 1.9 + 0.5 * t) * 0.6;
  vec3 flow = cross(g1, g2) * (0.9 + 0.04 * uRadius) * (0.6 + 0.6 * r.z);
  // 4. away from crowding: the density gradient
  vec2 e = uDenTexel * uWorld;
  float c0 = den(pos.xz);
  vec2 g = vec2(den(pos.xz + vec2(e.x, 0.0)) - den(pos.xz - vec2(e.x, 0.0)), den(pos.xz + vec2(0.0, e.y)) - den(pos.xz - vec2(0.0, e.y)));
  vec3 rep = -vec3(g.x, 0.0, g.y) * uRep;
  vec3 want = uLeaderVel + seek + mill + flow;
  vel += ((want - vel) * 4.0 + rep) * uDt;
  // 5. height: a soft floor, a soft ceiling that grows with the swarm, and the flow lifts sheets into the air
  float cap = 1.5 + uRadius * 0.45 * uLift;
  vel.y += (max(0.0, 0.4 - pos.y) * 12.0 - max(0.0, pos.y - cap) * 4.0 - 0.6) * uDt;
  // a stomp: everything close is thrown up and away
  if (uShock.w > 0.0) {
    vec2 dv = pos.xz - uShock.xy; float dd = length(dv);
    if (dd < uShock.z) vel += vec3(dv / max(dd, 0.5), 1.2) * uShock.w * (1.0 - dd / uShock.z) * (0.6 + 0.8 * r.y);
  }
  // 6. stone: mites bore into buildings like termites, eating the voxel they are in
  float w = 1.0;
  float gi = texture(uGrid, pos.xz / uWorld + 0.5).r * 255.0;
  if (gi > 0.5) {
    int b = int(gi + 0.5) - 1;
    vec4 B = uB[b], B2 = uB2[b];
    if (B.w >= 0.0) {
      vec3 lp = (pos - vec3(B.x, uS2[b].y, B.y)) / (${VS_W.toFixed(3)} * uS2[b].x) + vec3(16.0, 0.0, 16.0);
      float here = solidAt(b, ivec3(floor(lp)));
      float above = solidAt(b, ivec3(floor(lp + vec3(0.0, 1.0, 0.0))));
      vec3 hd = length(vel) > 0.1 ? normalize(vel) : vec3(0.0, -1.0, 0.0);
      float ahead = solidAt(b, ivec3(floor(lp + hd * 1.2)));
      if (here > 0.5) {
        w = 2.0 + float(b);
        // chewing through stone slows a mite down; the swarm behind keeps pushing, so tunnels open up
        vel *= exp(-3.5 * uDt);
        vel.y += (above > 0.5 ? 2.0 : 4.0) * uDt;
      } else if (ahead > 0.5) {
        // stone right in front: bite it (w + 0.5 tells the eat pass to take the voxel ahead) and climb
        w = 2.5 + float(b);
        vel.xz *= exp(-2.0 * uDt);
        vel.y += 3.5 * uDt;
      } else {
        vel.y += 1.0 * uDt;
      }
    }
  }
  float sp = length(vel);
  float vmax = uSpeed * 1.8 + 6.0;
  if (sp > vmax) vel *= vmax / sp;
  pos += vel * uDt;
  if (pos.y < 0.08) { pos.y = 0.08; vel.y = abs(vel.y) * 0.3; }
  oPos = vec4(pos, w);
  oVel = vec4(vel, v.w);
}`;

const SPLAT_VS = `#version 300 es
precision highp float;
uniform sampler2D uPos;
uniform float uS, uWorld;
void main() {
  int i = gl_VertexID;
  vec4 p = texelFetch(uPos, ivec2(i % int(uS), i / int(uS)), 0);
  if (p.w < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  gl_Position = vec4(p.xz / uWorld * 2.0, 0.0, 1.0);
  gl_PointSize = 1.0;
}`;
const SPLAT_FS = `#version 300 es
precision mediump float;
out vec4 o;
void main() { o = vec4(1.0); }`;

const BLUR_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uDir;
in vec2 vUv;
out vec4 o;
void main() {
  vec4 s = texture(uSrc, vUv) * 0.227027;
  s += (texture(uSrc, vUv + uDir * 1.3846) + texture(uSrc, vUv - uDir * 1.3846)) * 0.3162162;
  s += (texture(uSrc, vUv + uDir * 3.2308) + texture(uSrc, vUv - uDir * 3.2308)) * 0.0702703;
  o = s;
}`;

const MITE_VS = `#version 300 es
precision highp float;
uniform sampler2D uPos, uVel;
uniform mat4 uVP;
uniform vec3 uCamR, uCamU;
uniform float uS, uSize, uTime, uMinPx, uPxScale;
in vec2 aCorner;
out vec2 vUv;
out vec3 vCol;
out float vBright;
${HASH}
void main() {
  int i = gl_InstanceID;
  ivec2 c = ivec2(i % int(uS), i / int(uS));
  vec4 p = texelFetch(uPos, c, 0);
  if (p.w < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec4 v = texelFetch(uVel, c, 0);
  vec3 r = h31(float(i) + 7.0);
  vec4 clip = uVP * vec4(p.xyz, 1.0);
  // never smaller than a pixel or two: far mites become glowing points, near ones are little winged sprites
  float size = max(uSize * (0.7 + 0.6 * r.x), uMinPx * clip.w * uPxScale);
  float flap = 0.55 + 0.45 * sin(uTime * (28.0 + 10.0 * r.y) + v.w * 6.2831);
  // stretch along the motion (seen from the camera): the flow becomes visible as streaks of light
  vec2 sv = vec2(dot(v.xyz, uCamR), dot(v.xyz, uCamU));
  float spd = length(sv);
  vec2 ax = spd > 1e-3 ? sv / spd : vec2(1.0, 0.0);
  vec2 ay = vec2(-ax.y, ax.x);
  float stretch = 1.0 + min(spd * 0.09, 2.2);
  vec2 k = ax * aCorner.x * stretch * (1.0 + 0.3 * flap) + ay * aCorner.y * (1.0 - 0.25 * flap);
  vec3 wp = p.xyz + (uCamR * k.x + uCamU * k.y) * size;
  gl_Position = uVP * vec4(wp, 1.0);
  vUv = aCorner;
  // gold to warm white, a few cyan sparks
  vCol = r.z < 0.12 ? vec3(0.45, 1.0, 1.0) : mix(vec3(1.0, 0.62, 0.18), vec3(1.0, 0.92, 0.6), r.y);
  vBright = 0.7 + 0.6 * flap;
}`;
const MITE_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
in vec3 vCol;
in float vBright;
out vec4 o;
void main() {
  // a firefly, seen from above: x runs along its flight (front = +x)
  vec2 q = vUv;
  float body = (q.x * q.x) / 0.85 + (q.y * q.y) / 0.12;
  vec2 wl = vec2(q.x + 0.05, abs(q.y) - 0.42);
  float wing = (wl.x * wl.x) / 0.22 + (wl.y * wl.y) / 0.09;
  if (body > 1.0 && wing > 1.0) discard;
  vec3 c;
  if (body <= 1.0) {
    float tail = smoothstep(0.1, -0.6, q.x);               // the glowing abdomen behind
    float head = smoothstep(0.45, 0.8, q.x);
    c = mix(vCol * 0.55, vCol * 2.6 * vBright, tail) * (1.0 - head * 0.45);
  } else {
    c = mix(vec3(0.45, 0.60, 0.70), vCol, 0.4) * (0.22 + 0.25 * vBright); // thin wings
  }
  o = vec4(c, 1.0);
}`;

// where the swarm bites: stone chips fly out and dust rises (drawn only for mites that are eating)
const CHIP_VS = `#version 300 es
precision highp float;
uniform sampler2D uPos;
uniform mat4 uVP;
uniform vec3 uCamR, uCamU;
uniform float uS, uTime;
in vec2 aCorner;
out vec2 vUv;
out float vA;
out float vKind;
${HASH}
void main() {
  int i = gl_InstanceID;
  vec4 p = texelFetch(uPos, ivec2(i % int(uS), i / int(uS)), 0);
  if (p.w < 1.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 r = h31(float(i) * 3.1);
  // a looping little arc: each biting mite throws a chip out and up every ~0.6 s
  float ph = fract(uTime * (1.4 + r.x) + r.y);
  vec3 dir = normalize(vec3(r.x - 0.5, 0.8 + r.z, r.y - 0.5));
  vec3 cp = p.xyz + dir * ph * 1.6 + vec3(0.0, -4.0 * ph * ph * 0.4, 0.0);
  bool dust = r.z > 0.55;
  float size = dust ? 0.35 + 0.6 * ph : 0.05 + 0.04 * r.x;
  vKind = dust ? 1.0 : 0.0;
  vA = dust ? (1.0 - ph) * 0.18 : 1.0 - ph * 0.6;
  vec3 wp = (dust ? p.xyz + vec3(0.0, ph * 1.2, 0.0) : cp) + (uCamR * aCorner.x + uCamU * aCorner.y) * size;
  vUv = aCorner;
  gl_Position = uVP * vec4(wp, 1.0);
}`;
const CHIP_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
in float vA;
in float vKind;
out vec4 o;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  vec3 c = vKind > 0.5 ? vec3(0.55, 0.52, 0.50) : vec3(0.42, 0.40, 0.38);
  float a = vKind > 0.5 ? vA * (1.0 - r2) : vA;
  o = vec4(c * a, a);
}`;

export class Swarm {
  pos: Target[]; // ping-pong pairs: [pos, vel] attachments
  cur = 0;
  den: Target; denA: Target; denB: Target;
  upd: Program; splat: Program; blur: Program; mite: Program; chip: Program;
  quad: WebGLVertexArrayObject; empty: WebGLVertexArrayObject;
  gl: GL;
  constructor(gl: GL) {
    this.gl = gl;
    const f32 = { internal: gl.RGBA32F, format: gl.RGBA, type: gl.FLOAT, filter: gl.NEAREST };
    this.pos = [target(gl, S, S, [f32, f32]), target(gl, S, S, [f32, f32])];
    const h16 = { internal: gl.R16F, format: gl.RED, type: gl.HALF_FLOAT, filter: gl.LINEAR };
    this.den = target(gl, DEN, DEN, [h16]); this.denA = target(gl, DEN, DEN, [h16]); this.denB = target(gl, DEN, DEN, [h16]);
    this.upd = program(gl, FULLSCREEN_VS, UPDATE_FS, "update");
    this.splat = program(gl, SPLAT_VS, SPLAT_FS, "splat");
    this.blur = program(gl, FULLSCREEN_VS, BLUR_FS, "blur");
    this.mite = program(gl, MITE_VS, MITE_FS, "mite");
    this.chip = program(gl, CHIP_VS, CHIP_FS, "chips");
    this.empty = gl.createVertexArray()!;
    this.quad = gl.createVertexArray()!;
    gl.bindVertexArray(this.quad);
    const b = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.mite.p, "aCorner");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }
  get state() { return this.pos[this.cur]; }
  /** the blurred density: also the swarm's light on the world */
  get light() { return this.denB.tex[0]; }

  shock = new Float32Array(4);
  step(dt: number, t: number, leader: Float32Array, leaderVel: Float32Array, active: number, speed: number, world: { grid: WebGLTexture; atlas: WebGLTexture; b: Float32Array; b2: Float32Array; s2: Float32Array }) {
    const gl = this.gl, src = this.pos[this.cur], dst = this.pos[1 - this.cur];
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
    gl.viewport(0, 0, S, S);
    const u = this.upd.u;
    gl.useProgram(this.upd.p);
    bindTex(gl, 0, src.tex[0], u.uPos); bindTex(gl, 1, src.tex[1], u.uVel); bindTex(gl, 2, this.denB.tex[0], u.uDen);
    bindTex(gl, 3, world.grid, u.uGrid); bindTex(gl, 4, world.atlas, u.uAtlas);
    gl.uniform4fv(u.uB, world.b); gl.uniform4fv(u.uB2, world.b2); gl.uniform4fv(u.uS2, world.s2); gl.uniform4fv(u.uShock, this.shock);
    gl.uniform3fv(u.uLeader, leader); gl.uniform3fv(u.uLeaderVel, leaderVel);
    gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uTime, t); gl.uniform1f(u.uActive, active); gl.uniform1f(u.uS, S); gl.uniform1f(u.uWorld, WORLD);
    gl.uniform1f(u.uSpeed, speed); gl.uniform1f(u.uRep, 1.0); gl.uniform1f(u.uLift, 1.7);
    gl.uniform1f(u.uRadius, 2.2 + Math.sqrt(active) * 0.05);
    gl.uniform2f(u.uDenTexel, 1 / DEN, 1 / DEN);
    gl.bindVertexArray(this.empty);
    // only the rows that hold living mites (plus the next few to be born) are simulated
    const rows = Math.min(S, Math.ceil((active + 2048) / S));
    gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, S, rows);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.SCISSOR_TEST);
    // rows we did not touch keep their old (dormant) values in the other buffer: copy them is not needed because
    // dormant mites are re-placed every time they wake (p.w = 0 path)
    this.cur = 1 - this.cur;
    // density: splat every living mite into the grid, then blur twice
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.den.fb);
    gl.viewport(0, 0, DEN, DEN);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this.splat.p);
    bindTex(gl, 0, this.state.tex[0], this.splat.u.uPos);
    gl.uniform1f(this.splat.u.uS, S); gl.uniform1f(this.splat.u.uWorld, WORLD);
    gl.drawArrays(gl.POINTS, 0, Math.min(active, S * S));
    gl.disable(gl.BLEND);
    gl.useProgram(this.blur.p);
    const pass = (from: WebGLTexture, to: Target, dx: number, dy: number) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, to.fb);
      bindTex(gl, 0, from, this.blur.u.uSrc);
      gl.uniform2f(this.blur.u.uDir, dx / DEN, dy / DEN);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    pass(this.den.tex[0], this.denA, 1, 0); pass(this.denA.tex[0], this.denB, 0, 1);
    pass(this.denB.tex[0], this.denA, 2, 0); pass(this.denA.tex[0], this.denB, 0, 2);
  }

  draw(vp: Float32Array, camR: Float32Array, camU: Float32Array, t: number, active: number, pxScale: number) {
    const gl = this.gl, u = this.mite.u;
    gl.useProgram(this.mite.p);
    bindTex(gl, 0, this.state.tex[0], u.uPos); bindTex(gl, 1, this.state.tex[1], u.uVel);
    gl.uniformMatrix4fv(u.uVP, false, vp);
    gl.uniform3fv(u.uCamR, camR); gl.uniform3fv(u.uCamU, camU);
    gl.uniform1f(u.uS, S); gl.uniform1f(u.uSize, 0.13); gl.uniform1f(u.uTime, t); gl.uniform1f(u.uMinPx, 1.15); gl.uniform1f(u.uPxScale, pxScale);
    // opaque with a depth test: order-free, and near mites hide far ones, which gives the swarm volume
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    gl.bindVertexArray(this.quad);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, active);
    // chips and dust where the swarm is biting (premultiplied alpha, no depth writes)
    const c = this.chip.u;
    gl.useProgram(this.chip.p);
    bindTex(gl, 0, this.state.tex[0], c.uPos);
    gl.uniformMatrix4fv(c.uVP, false, vp); gl.uniform3fv(c.uCamR, camR); gl.uniform3fv(c.uCamU, camU);
    gl.uniform1f(c.uS, S); gl.uniform1f(c.uTime, t);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, active);
    gl.depthMask(true); gl.disable(gl.BLEND);
  }
}
