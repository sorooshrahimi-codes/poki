// The land is not flat: soft hills and hollows, a pond in each land, and a flat pad under every building
// (so nothing stands on a slope or floats). One height map, built on the CPU at each land, is shared by
// everything: the ground mesh, the grass, the swarm's floor, the buildings' bases and the finger's ray.
import { WORLD } from "./swarm.ts";
import type { GL } from "./gl.ts";

export const HN = 256; // height samples per side (over WORLD units)
export const WATER = -0.7; // the water level
const RIM = 58; // the land is flat from here out to the wall (and beyond it)
/** every land has its own outline: lobes around a circle (k lobes, depth a); north and south (the gates) stay full size */
export const SHAPE = { k: 0, a: 0 };
export function wallF(an: number) { return 1 - SHAPE.a * (1 - Math.cos(SHAPE.k * (an + Math.PI / 2))) / 2; }

export class Terrain {
  h = new Float32Array(HN * HN);
  tex: WebGLTexture;
  pond = { x: 0, z: 0, r: 0 };
  pond2 = { x: 0, z: 0, r: 0 }; // a second pond: always clear water
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
    const r = Math.hypot(x, z) / wallF(Math.atan2(z, x));
    y *= this.amp * smooth(6, 16, r) * (1 - smooth(RIM - 10, RIM, r)); // the seed's square and the rim stay level
    // only the ponds hold water: elsewhere the land never dips below the water line
    let wet = 1, dig = 0;
    for (const p of [this.pond, this.pond2]) if (p.r > 0) { const d = Math.hypot(x - p.x, z - p.z) / p.r; wet *= smooth(0.7, 1.5, d); dig += 3.4 * Math.exp(-d * d * 1.3); }
    y = Math.max(y, WATER + 0.35) * wet - dig;
    return y;
  }
  /** a new land: hills, a pond, and level pads (x, z, half size) under the buildings; returns each pad's height */
  /** where this land's pond lies (call before placing buildings, so none stands in the water) */
  plan(seed: number) {
    let a = seed * 7919 + 13;
    const rnd = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
    const ang = rnd() * Math.PI * 2, rr = 26 + rnd() * 10;
    const pr = 14 + rnd() * 4, rr2 = Math.min(rr, 58 * wallF(ang) - pr - 2);
    this.pond = { x: Math.cos(ang) * rr2, z: Math.sin(ang) * rr2, r: pr };
    const a2 = ang + Math.PI * (0.8 + rnd() * 0.4), q = 11 + rnd() * 3, r2 = Math.min(26 + rnd() * 10, 58 * wallF(a2) - q - 2);
    this.pond2 = { x: Math.cos(a2) * r2, z: Math.sin(a2) * r2, r: q };
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
    this.h0.set(H); this.dirty = [HN, HN, -1, -1];
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, HN, HN, gl.RED, gl.FLOAT, H);
    return heights;
  }
  /** the untouched land (the swarm digs into it, never deeper than DIG below) */
  h0 = new Float32Array(HN * HN);
  dirty = [HN, HN, -1, -1];
  /** the swarm eats the ground itself: lower it around (x, z), skipping where keep() says a building stands */
  dig(x: number, z: number, r: number, amt: number, keep: (x: number, z: number) => boolean) {
    const cell = WORLD / HN, H = this.h, H0 = this.h0, DIG = 1.3;
    const i0 = Math.max(1, Math.floor((x - r + WORLD / 2) / cell)), i1 = Math.min(HN - 2, Math.ceil((x + r + WORLD / 2) / cell));
    const j0 = Math.max(1, Math.floor((z - r + WORLD / 2) / cell)), j1 = Math.min(HN - 2, Math.ceil((z + r + WORLD / 2) / cell));
    let any = false;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = (i + 0.5) * cell - WORLD / 2, pz = (j + 0.5) * cell - WORLD / 2, d = Math.hypot(px - x, pz - z) / r;
      if (d >= 1) continue;
      const k = j * HN + i, lo = Math.max(WATER + 0.12, H0[k] - DIG);
      if (H[k] <= lo || keep(px, pz)) continue;
      H[k] = Math.max(lo, H[k] - amt * (1 - d * d)); any = true;
    }
    if (any) { const D = this.dirty; D[0] = Math.min(D[0], i0); D[1] = Math.min(D[1], j0); D[2] = Math.max(D[2], i1); D[3] = Math.max(D[3], j1); }
  }
  /** send the dug part of the height map to the GPU */
  flush() {
    const D = this.dirty; if (D[2] < 0) return;
    const gl = this.gl, w = D[2] - D[0] + 1;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, HN);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, D[0], D[1], w, D[3] - D[1] + 1, gl.RED, gl.FLOAT, this.h, D[1] * HN + D[0]);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    D[0] = HN; D[1] = HN; D[2] = -1; D[3] = -1;
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
