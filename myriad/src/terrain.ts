// The land is not flat: soft hills and hollows, a pond in each land, and a flat pad under every building
// (so nothing stands on a slope or floats). One height map, built on the CPU at each land, is shared by
// everything: the ground mesh, the grass, the swarm's floor, the buildings' bases and the finger's ray.
import { WORLD } from "./swarm.ts";
import type { GL } from "./gl.ts";

export const HN = 256; // height samples per side (over WORLD units)
export const WATER = -0.7; // the water level
const RIM = 58; // the land is flat from here out to the wall (and beyond it)

export class Terrain {
  h = new Float32Array(HN * HN);
  tex: WebGLTexture;
  pond = { x: 0, z: 0, r: 0 };
  amp = 2;
  gl: GL;
  constructor(gl: GL) {
    this.gl = gl;
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, HN, HN, 0, gl.RED, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  /** the raw rolling land (before pads), seeded per land */
  raw(x: number, z: number, seed: number) {
    const s = seed * 0.37;
    let y = 1.7 * Math.sin(x * 0.065 + s) * Math.sin(z * 0.058 + s * 1.7)
      + 0.9 * Math.sin(x * 0.12 - z * 0.1 + s * 2.3) + 0.45 * Math.sin(x * 0.23 + z * 0.19 + s);
    const r = Math.hypot(x, z);
    y *= this.amp * smooth(6, 16, r) * (1 - smooth(RIM - 10, RIM, r)); // the seed's square and the rim stay level
    const p = this.pond;
    if (p.r > 0) { const d = Math.hypot(x - p.x, z - p.z) / p.r; y = Math.max(y, WATER + 0.35) * smooth(0.7, 1.5, d) - 3.4 * Math.exp(-d * d * 1.3); } // only the pond holds water
    return y;
  }
  /** a new land: hills, a pond, and level pads (x, z, half size) under the buildings; returns each pad's height */
  /** where this land's pond lies (call before placing buildings, so none stands in the water) */
  plan(seed: number) {
    let a = seed * 7919 + 13;
    const rnd = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
    const ang = rnd() * Math.PI * 2, rr = 26 + rnd() * 10;
    this.pond = { x: Math.cos(ang) * rr, z: Math.sin(ang) * rr, r: 14 + rnd() * 4 };
    return this.pond;
  }
  build(seed: number, pads: { x: number; z: number; half: number }[]) {
    const H = this.h, cell = WORLD / HN;
    for (let j = 0; j < HN; j++) for (let i = 0; i < HN; i++) H[j * HN + i] = this.raw((i + 0.5) * cell - WORLD / 2, (j + 0.5) * cell - WORLD / 2, seed);
    const heights = pads.map((p) => Math.max(WATER + 0.3, this.raw(p.x, p.z, seed)));
    // blend every pad in: level inside the footprint, easing back into the hills over a few units
    pads.forEach((p, k) => {
      const y = heights[k], ease = 4;
      const i0 = Math.max(0, Math.floor((p.x - p.half - ease + WORLD / 2) / cell)), i1 = Math.min(HN - 1, Math.ceil((p.x + p.half + ease + WORLD / 2) / cell));
      const j0 = Math.max(0, Math.floor((p.z - p.half - ease + WORLD / 2) / cell)), j1 = Math.min(HN - 1, Math.ceil((p.z + p.half + ease + WORLD / 2) / cell));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = (i + 0.5) * cell - WORLD / 2, z = (j + 0.5) * cell - WORLD / 2;
        const d = Math.max(Math.abs(x - p.x), Math.abs(z - p.z)) - p.half;
        const w = 1 - smooth(0, ease, d);
        H[j * HN + i] = H[j * HN + i] * (1 - w) + y * w;
      }
    });
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, HN, HN, gl.RED, gl.FLOAT, H);
    return heights;
  }
  /** the ground height at a point (bilinear, as the GPU samples it) */
  at(x: number, z: number) {
    const cell = WORLD / HN;
    const fx = (x + WORLD / 2) / cell - 0.5, fz = (z + WORLD / 2) / cell - 0.5;
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const g = (ii: number, jj: number) => this.h[Math.min(HN - 1, Math.max(0, jj)) * HN + Math.min(HN - 1, Math.max(0, ii))];
    return (g(i, j) * (1 - tx) + g(i + 1, j) * tx) * (1 - tz) + (g(i, j + 1) * (1 - tx) + g(i + 1, j + 1) * tx) * tz;
  }
  /** the top of what you stand on: ground or water */
  floor(x: number, z: number) { return Math.max(WATER, this.at(x, z)); }
}
function smooth(a: number, b: number, x: number) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

/** GLSL: the ground height from the shared map (uHeight, uWorld must exist) */
export const HEIGHT_GLSL = `
float groundH(vec2 xz) { vec2 uv = xz / uWorld + 0.5; return (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) ? texture(uHeight, uv).r : 0.0; }
const float WATER = ${WATER.toFixed(2)};
`;
