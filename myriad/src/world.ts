// The world (phase 1): a dusk sky and a grey stone plain that the swarm lights up from below.
import { FULLSCREEN_VS, bindTex, program, type GL, type Program } from "./gl.ts";
import { WORLD } from "./swarm.ts";

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

const GROUND_VS = `#version 300 es
precision highp float;
uniform mat4 uVP;
uniform float uSize;
out vec3 vW;
void main() {
  vec2 q = vec2(float((gl_VertexID & 1)), float((gl_VertexID >> 1) & 1)) * 2.0 - 1.0;
  vW = vec3(q.x * uSize, 0.0, q.y * uSize);
  gl_Position = uVP * vec4(vW, 1.0);
}`;
const GROUND_FS = `#version 300 es
precision highp float;
uniform sampler2D uLight, uColor;
uniform float uWorld;
uniform vec3 uCam;
uniform vec3 uStoneA, uStoneB, uFog, uGrassA, uGrassB;
uniform vec4 uHint; // x, z, radius, strength: a pulsing ring that says "eat this" (onboarding)
uniform float uTime, uWall;
in vec3 vW;
out vec4 o;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 p = vW.xz;
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
  // distance fog into the dusk, and the grey mist that walls the land in
  float dist = length(vW - uCam);
  lit = mix(lit, uFog, smoothstep(60.0, 220.0, dist));
  float rr = length(p);
  lit = mix(lit, uFog * 1.2, smoothstep(uWall - 4.0, uWall + 6.0, rr + vn(p * 0.2 + uTime * 0.05) * 4.0));
  o = vec4(lit, 1.0);
}`;

// the edge of the land: a ring of slow grey mist the swarm cannot pass (the grey still holds the rest of the world)
const WALL_VS = `#version 300 es
precision highp float;
uniform mat4 uVP;
uniform float uWall;
out vec2 vQ;
void main() {
  int seg = gl_VertexID >> 1;
  float a = float(seg) / 128.0 * 6.2831853, y = float(gl_VertexID & 1);
  vQ = vec2(float(seg) / 128.0, y);
  gl_Position = uVP * vec4(cos(a) * uWall, y * 22.0, sin(a) * uWall, 1.0);
}`;
const WALL_FS = `#version 300 es
precision highp float;
uniform vec3 uFog;
uniform float uTime;
in vec2 vQ;
out vec4 o;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 q = vec2(vQ.x * 90.0, vQ.y * 6.0);
  float n = vn(q + vec2(uTime * 0.3, -uTime * 0.2)) * 0.6 + vn(q * 2.3 - vec2(uTime * 0.5, 0.0)) * 0.4;
  float a = (1.0 - vQ.y) * (0.45 + 0.55 * n);
  a = clamp(a * 1.1, 0.0, 0.92);
  vec3 c = uFog * (1.1 + 0.5 * n);
  o = vec4(c * a, a);
}`;

export const WALL = 64;
export type Palette = { skyLow: number[]; skyTop: number[]; horizon: number[]; stoneA: number[]; stoneB: number[]; fog: number[]; grassA: number[]; grassB: number[] };

export class World {
  wall: Program;
  pal!: Palette;
  hint = new Float32Array(4);
  sky: Program; ground: Program; vao: WebGLVertexArrayObject;
  gl: GL;
  constructor(gl: GL) {
    this.gl = gl;
    this.sky = program(gl, FULLSCREEN_VS, SKY_FS, "sky");
    this.ground = program(gl, GROUND_VS, GROUND_FS, "ground");
    this.wall = program(gl, WALL_VS, WALL_FS, "wall");
    this.vao = gl.createVertexArray()!;
  }
  /** the grey mist that rings the land (drawn after the solid things, before the swarm) */
  drawWall(vp: Float32Array, t: number) {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.useProgram(this.wall.p);
    gl.uniformMatrix4fv(this.wall.u.uVP, false, vp); gl.uniform1f(this.wall.u.uWall, WALL + 2);
    gl.uniform3fv(this.wall.u.uFog, this.pal.fog); gl.uniform1f(this.wall.u.uTime, t);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 258);
    gl.depthMask(true); gl.disable(gl.BLEND);
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
    gl.useProgram(this.ground.p);
    gl.uniformMatrix4fv(this.ground.u.uVP, false, vp);
    gl.uniform1f(this.ground.u.uSize, 400); gl.uniform1f(this.ground.u.uWorld, WORLD); gl.uniform3fv(this.ground.u.uCam, cam);
    const g = this.ground.u;
    gl.uniform3fv(g.uStoneA, P.stoneA); gl.uniform3fv(g.uStoneB, P.stoneB); gl.uniform3fv(g.uFog, P.fog); gl.uniform3fv(g.uGrassA, P.grassA); gl.uniform3fv(g.uGrassB, P.grassB);
    gl.uniform4fv(g.uHint, this.hint); gl.uniform1f(g.uTime, t); gl.uniform1f(g.uWall, WALL);
    bindTex(gl, 0, light, this.ground.u.uLight); bindTex(gl, 1, color, this.ground.u.uColor);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
