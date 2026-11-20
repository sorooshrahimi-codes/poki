// Recolour parts of a sprite by hue: the blue life vest (outfits) or the red hull stripe (boat paint).
// Shading is kept: only hue (and optionally saturation/brightness) changes. Results are cached.

export interface Tint { hue: number; sat?: number; light?: number }
export type Part = "vest" | "stripe";

const cache = new Map<string, HTMLCanvasElement>();

function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  const f = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
}

/** which pixels belong to the part: by hue band and height in the sprite */
function inPart(part: Part, h: number, s: number, l: number, yFrac: number): boolean {
  if (part === "vest") return h >= 195 && h <= 245 && s > 0.35 && l > 0.18 && l < 0.85 && yFrac > 0.36 && yFrac < 0.8;
  return (h >= 345 || h <= 15) && s > 0.45 && l > 0.25 && yFrac > 0.6;
}

export function recolor(key: string, src: HTMLImageElement | HTMLCanvasElement, parts: { part: Part; tint: Tint }[]): HTMLCanvasElement {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(src, 0, 0);
  const data = x.getImageData(0, 0, c.width, c.height);
  const d = data.data, w = c.width, hgt = c.height;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 20) continue;
    const [h, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]);
    const yFrac = Math.floor(i / 4 / w) / hgt;
    for (const { part, tint } of parts) {
      if (!inPart(part, h, s, l, yFrac)) continue;
      const [r, g, b] = hsl2rgb(tint.hue, Math.min(1, s * (tint.sat ?? 1)), Math.min(0.95, l * (tint.light ?? 1)));
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
      break;
    }
  }
  x.putImageData(data, 0, 0);
  cache.set(key, c);
  return c;
}
