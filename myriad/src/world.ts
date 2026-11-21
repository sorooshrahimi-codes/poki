// The world (phase 1): a dusk sky and a grey stone plain that the swarm lights up from below.
import { FULLSCREEN_VS, bindTex, program, type GL, type Program } from "./gl.ts";
import { WORLD } from "./swarm.ts";

const SKY_FS = `#version 300 es
precision highp float;
uniform mat4 uInvVP;
uniform vec3 uCam;
in vec2 vUv;
out vec4 o;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec4 w = uInvVP * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 dir = normalize(w.xyz / w.w - uCam);
  float y = dir.y;
  vec3 c = mix(vec3(0.20, 0.13, 0.22), vec3(0.03, 0.04, 0.10), smoothstep(-0.05, 0.6, y));
  c += vec3(0.55, 0.28, 0.20) * exp(-abs(y) * 14.0) * 0.6; // ember horizon
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
  vec3 stone = mix(vec3(0.20, 0.19, 0.23), vec3(0.38, 0.36, 0.40), n) * mix(0.55, 1.0, crack);
  // the swarm's own light, from the blurred density field
  vec2 uv = p / uWorld + 0.5;
  float d = (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) ? texture(uLight, uv).r : 0.0;
  float glow = 1.0 - exp(-d * 0.012);
  // colour coming back: grass and flowers where the swarm has been
  float rest = (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) ? clamp(texture(uColor, uv).r, 0.0, 1.0) : 0.0;
  // living ground seen from afar: meadow colours that vary (clover, dry patches, flower drifts)
  float m1 = vn(p * 0.12), m2 = vn(p * 0.5 + 7.0), m3 = vn(p * 2.3);
  vec3 grass = mix(vec3(0.20, 0.48, 0.16), vec3(0.42, 0.70, 0.22), m1);
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
  // distance fog into the dusk
  float dist = length(vW - uCam);
  lit = mix(lit, vec3(0.12, 0.08, 0.13), smoothstep(60.0, 220.0, dist));
  o = vec4(lit, 1.0);
}`;

export class World {
  sky: Program; ground: Program; vao: WebGLVertexArrayObject;
  gl: GL;
  constructor(gl: GL) {
    this.gl = gl;
    this.sky = program(gl, FULLSCREEN_VS, SKY_FS, "sky");
    this.ground = program(gl, GROUND_VS, GROUND_FS, "ground");
    this.vao = gl.createVertexArray()!;
  }
  draw(vp: Float32Array, invVP: Float32Array, cam: Float32Array, light: WebGLTexture, color: WebGLTexture) {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.sky.p);
    gl.uniformMatrix4fv(this.sky.u.uInvVP, false, invVP); gl.uniform3fv(this.sky.u.uCam, cam);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(this.ground.p);
    gl.uniformMatrix4fv(this.ground.u.uVP, false, vp);
    gl.uniform1f(this.ground.u.uSize, 400); gl.uniform1f(this.ground.u.uWorld, WORLD); gl.uniform3fv(this.ground.u.uCam, cam);
    bindTex(gl, 0, light, this.ground.u.uLight); bindTex(gl, 1, color, this.ground.u.uColor);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
