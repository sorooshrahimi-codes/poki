// Grass that grows back: tens of thousands of instanced blades around the camera. On grey ground they are short
// petrified stubble; where the swarm has passed they grow tall and green, with flowers, and they bend away from
// the swarm as it flows over them (the same density field that lights the world pushes the grass).
import { bindTex, program, type GL, type Program } from "./gl.ts";
import { WORLD } from "./swarm.ts";
import { HEIGHT_GLSL, SHAPE } from "./terrain.ts";

export const SIDE = 260; // blades per side of the patch
export const STEP = 0.24; // world units between blades

const VS = `#version 300 es
precision highp float;
uniform sampler2D uColor, uDen, uHeight;
uniform mat4 uVP;
uniform vec2 uOrigin, uCamXZ, uShape;
uniform float uTime, uWorld;
out vec3 vCol;
out float vTip;
out vec3 vW;
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
${HEIGHT_GLSL}
void main() {
  int i = gl_InstanceID;
  vec2 cell = vec2(float(i % ${SIDE}), float(i / ${SIDE}));
  vec2 world = uOrigin + cell * ${STEP.toFixed(3)};
  // a stable jitter per world cell (the patch scrolls with the camera, the blades stay put)
  vec2 key = floor(world / ${STEP.toFixed(3)} + 0.5);
  float r1 = h11(key.x * 12.9898 + key.y * 78.233), r2 = h11(key.x * 39.346 + key.y * 11.135), r3 = h11(key.x * 73.156 + key.y * 52.235);
  world += (vec2(r1, r2) - 0.5) * ${STEP.toFixed(3)} * 1.4;
  vec2 uv = world / uWorld + 0.5;
  float rest = clamp(texture(uColor, uv).r * 1.6 - (r3 * 0.5), 0.0, 1.0);
  float gy = groundH(world);
  // far blades shrink away (and the square patch fades at its rim), so no dark speckle shows from afar
  vec2 rim = abs(cell / float(${SIDE}) - 0.5) * 2.0;
  float far = (1.0 - smoothstep(0.6, 0.95, max(rim.x, rim.y))) * (1.0 - smoothstep(20.0, 31.0, length(world - uCamXZ)));
  float h = rest < 0.04 || gy < WATER + 0.05 || length(world) > 63.5 * (1.0 - uShape.y * (1.0 - cos(uShape.x * (atan(world.y, world.x) + 1.5708))) * 0.5) ? 0.0 : mix(0.05, 0.42 + 0.55 * r2, rest) * far;
  // the blade: 5 vertices (a tapering strip), bent by wind and pushed by the swarm
  int k = gl_VertexID;
  float t = float(k / 2) / 2.0;
  float side = (k % 2 == 0 ? -1.0 : 1.0) * (1.0 - t) * 0.035 * (0.7 + r1);
  if (k == 4) side = 0.0;
  float ang = r3 * 6.2831;
  vec2 dir = vec2(cos(ang), sin(ang));
  vec2 e = vec2(1.0 / 256.0) * uWorld;
  float d0 = texture(uDen, uv).r;
  vec2 g = vec2(texture(uDen, uv + vec2(e.x, 0) / uWorld).r - texture(uDen, uv - vec2(e.x, 0) / uWorld).r,
                texture(uDen, uv + vec2(0, e.y) / uWorld).r - texture(uDen, uv - vec2(0, e.y) / uWorld).r);
  vec2 push = -g * 0.02 + vec2(sin(uTime * 1.7 + world.x * 0.4 + world.y * 0.2), cos(uTime * 1.3 + world.y * 0.5)) * 0.12 * rest;
  push *= 1.0 + min(d0 * 0.02, 2.0);
  vec3 p = vec3(world.x, 0.0, world.y) + vec3(-dir.y, 0.0, dir.x) * side;
  p.y = gy + t * h;
  p.xz += push * t * t * h * 2.5;
  vW = p;
  vTip = t;
  // stubble is grey stone; living grass goes from deep green at the root to sunlit yellow-green, some flowers
  vec3 g0 = mix(vec3(0.16, 0.38, 0.10), vec3(0.20, 0.45, 0.12), r1), g1 = mix(vec3(0.55, 0.80, 0.25), vec3(0.75, 0.85, 0.35), r2);
  vec3 c = mix(g0, g1, t);
  if (r3 > 0.985 && t > 0.9) c = mix(vec3(1.0, 0.85, 0.30), vec3(1.0, 0.45, 0.75), r1);
  vCol = mix(vec3(0.30, 0.29, 0.33) * (0.7 + 0.5 * t), c, smoothstep(0.1, 0.6, rest));
  if (h < 0.02) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  gl_Position = uVP * vec4(p, 1.0);
}`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D uLight;
uniform float uWorld;
uniform vec3 uCam;
in vec3 vCol;
in float vTip;
in vec3 vW;
out vec4 o;
void main() {
  float sw = texture(uLight, vW.xz / uWorld + 0.5).r;
  float glow = 1.0 - exp(-sw * 0.012);
  vec3 c = vCol * (0.55 + 0.6 * vTip + glow * 1.4) + vec3(1.0, 0.5, 0.15) * glow * 0.3 * vTip;
  o = vec4(c, 1.0);
}`;

export class Grass {
  gl: GL; prog: Program; vao: WebGLVertexArrayObject;
  constructor(gl: GL) { this.gl = gl; this.prog = program(gl, VS, FS, "grass"); this.vao = gl.createVertexArray()!; }
  draw(vp: Float32Array, cam: Float32Array, cx: number, cz: number, t: number, color: WebGLTexture, den: WebGLTexture, light: WebGLTexture, density: number, height: WebGLTexture) {
    const gl = this.gl, u = this.prog.u;
    gl.bindVertexArray(this.vao);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.CULL_FACE);
    gl.useProgram(this.prog.p);
    bindTex(gl, 0, color, u.uColor); bindTex(gl, 1, den, u.uDen); bindTex(gl, 2, light, u.uLight); bindTex(gl, 3, height, u.uHeight);
    gl.uniformMatrix4fv(u.uVP, false, vp);
    // the patch is centred a little ahead of the camera target, snapped to the blade grid
    const half = (SIDE * STEP) / 2;
    gl.uniform2f(u.uOrigin, Math.floor((cx - half) / STEP) * STEP, Math.floor((cz - half) / STEP) * STEP);
    gl.uniform2f(u.uCamXZ, cx, cz); gl.uniform2f(u.uShape, SHAPE.k, SHAPE.a); gl.uniform1f(u.uTime, t); gl.uniform1f(u.uWorld, WORLD); gl.uniform3fv(u.uCam, cam);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 5, Math.floor(SIDE * SIDE * density));
  }
}
