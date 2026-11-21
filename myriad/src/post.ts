// HDR scene target (rendered at a variable scale inside a fixed-size buffer: changing quality never reallocates),
// a cheap bloom chain, and the final tone-mapped composite.
import { FULLSCREEN_VS, bindTex, program, target, type GL, type Program, type Target } from "./gl.ts";

const DOWN_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uTexel, uScale;
uniform float uThreshold;
in vec2 vUv;
out vec4 o;
void main() {
  vec2 uv = vUv * uScale;
  vec3 c = texture(uSrc, uv + uTexel * vec2(-1, -1)).rgb + texture(uSrc, uv + uTexel * vec2(1, -1)).rgb
         + texture(uSrc, uv + uTexel * vec2(-1, 1)).rgb + texture(uSrc, uv + uTexel * vec2(1, 1)).rgb;
  c *= 0.25;
  if (uThreshold > 0.0) { float l = max(c.r, max(c.g, c.b)); c *= smoothstep(uThreshold, uThreshold * 2.0, l); }
  o = vec4(c, 1.0);
}`;
const UP_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uGain;
in vec2 vUv;
out vec4 o;
void main() {
  vec3 c = texture(uSrc, vUv + uTexel * vec2(-1, 0)).rgb + texture(uSrc, vUv + uTexel * vec2(1, 0)).rgb
         + texture(uSrc, vUv + uTexel * vec2(0, -1)).rgb + texture(uSrc, vUv + uTexel * vec2(0, 1)).rgb;
  o = vec4(c * 0.25 * uGain, 1.0);
}`;
const COMP_FS = `#version 300 es
precision highp float;
uniform sampler2D uScene, uBloom;
uniform vec2 uScale;
uniform float uTime;
in vec2 vUv;
out vec4 o;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec3 c = texture(uScene, vUv * uScale).rgb + texture(uBloom, vUv).rgb * 0.7;
  c = aces(c * 1.1);
  vec2 q = vUv - 0.5;
  c *= 1.0 - dot(q, q) * 0.7;
  float g = fract(sin(dot(vUv * 913.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
  c += (g - 0.5) * 0.018;
  o = vec4(pow(c, vec3(1.0 / 1.1)), 1.0);
}`;

export class Post {
  scene!: Target; chain: Target[] = [];
  down: Program; up: Program; comp: Program; vao: WebGLVertexArrayObject;
  w = 0; h = 0;
  gl: GL;
  constructor(gl: GL) {
    this.gl = gl;
    this.down = program(gl, FULLSCREEN_VS, DOWN_FS, "down");
    this.up = program(gl, FULLSCREEN_VS, UP_FS, "up");
    this.comp = program(gl, FULLSCREEN_VS, COMP_FS, "comp");
    this.vao = gl.createVertexArray()!;
  }
  resize(w: number, h: number) {
    const gl = this.gl;
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    const f16 = { internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT, filter: gl.LINEAR };
    this.scene = target(gl, w, h, [f16], true);
    this.chain = [];
    let cw = w >> 1, ch = h >> 1;
    for (let i = 0; i < 5; i++) { this.chain.push(target(gl, Math.max(1, cw), Math.max(1, ch), [f16])); cw >>= 1; ch >>= 1; }
  }
  begin(scale: number) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fb);
    gl.viewport(0, 0, Math.round(this.w * scale), Math.round(this.h * scale));
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }
  end(scale: number, t: number, levels: number, canvasW: number, canvasH: number) {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    // bloom: downsample (the first step only takes the bright parts of the scaled scene), then add back up
    gl.useProgram(this.down.p);
    let src = this.scene.tex[0], sw = this.w, sh = this.h, sx = scale, sy = scale;
    for (let i = 0; i < levels; i++) {
      const d = this.chain[i];
      gl.bindFramebuffer(gl.FRAMEBUFFER, d.fb); gl.viewport(0, 0, d.w, d.h);
      bindTex(gl, 0, src, this.down.u.uSrc);
      gl.uniform2f(this.down.u.uTexel, 1 / sw, 1 / sh); gl.uniform2f(this.down.u.uScale, sx, sy); gl.uniform1f(this.down.u.uThreshold, i === 0 ? 0.9 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = d.tex[0]; sw = d.w; sh = d.h; sx = 1; sy = 1;
    }
    gl.useProgram(this.up.p);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = levels - 1; i > 0; i--) {
      const s = this.chain[i], d = this.chain[i - 1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, d.fb); gl.viewport(0, 0, d.w, d.h);
      bindTex(gl, 0, s.tex[0], this.up.u.uSrc);
      gl.uniform2f(this.up.u.uTexel, 1 / s.w, 1 / s.h); gl.uniform1f(this.up.u.uGain, 1.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvasW, canvasH);
    gl.useProgram(this.comp.p);
    bindTex(gl, 0, this.scene.tex[0], this.comp.u.uScene); bindTex(gl, 1, this.chain[0].tex[0], this.comp.u.uBloom);
    gl.uniform2f(this.comp.u.uScale, scale, scale); gl.uniform1f(this.comp.u.uTime, t % 100);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
