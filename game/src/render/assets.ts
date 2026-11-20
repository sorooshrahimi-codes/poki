import type { MutationId, ZoneId } from "../core/types.ts";
import { FISH } from "../data/fish.ts";

// Sprites made by the AI art pipeline (tools/art), served from public/art as WebP.
// Every sprite also gets a cached copy with a soft drop shadow baked in (2.5D depth for free),
// and tinted copies per mutation, so the per-frame cost is one drawImage.

export type Sprite = HTMLCanvasElement;

const PROPS: Record<ZoneId, string[]> = {
  lake: ["p_reeds", "p_boulder", "p_post", "p_grass"],
  ocean: ["p_kelp", "p_coral", "p_anemone", "p_glow"],
  ice: ["p_crystal", "p_iceberg", "p_arctickelp", "p_icicles"],
  reef: ["p_seafan", "p_brain", "p_anemone2", "p_tube"],
  volcano: ["p_vent", "p_tubeworm", "p_geode", "p_emberweed"],
};
export const propNames = (z: ZoneId) => PROPS[z];

/** where the water surface sits in each background image (fraction of its height) */
export const BG_WATERLINE: Record<ZoneId, number> = { lake: 0.245, ocean: 0.228, ice: 0.305, reef: 0.245, volcano: 0.25 };

const NAMES = [
  ...FISH.map((f) => f.id), ...["cap", "beanie", "rain", "sailor", "frog", "straw", "pirate", "crown"].flatMap((h) => ["idle", "cast", "reel", "cheer"].map((p) => `kid_${h}_${p}`)),
  "hat_cap", "hat_rain", "hat_frog", "hat_sailor", "npc_captain", "npc_chef", "npc_scientist", "npc_granny", "floor_lake", "floor_ocean", "floor_ice", "floor_reef", "floor_volcano", "bg_lake", "bg_ocean", "bg_ice", "bg_reef", "bg_volcano", "bg_aquarium",
  "pet_cat", "pet_dog", "pet_parrot", "pet_penguin", "hat_pirate", "hat_crown", "hat_beanie", "hat_straw",
  ...PROPS.lake, ...PROPS.ocean, ...PROPS.ice, ...PROPS.reef, ...PROPS.volcano, "i_coin", "i_line", "i_hooks", "i_luck", "s_shark", "s_bottle", "s_chest", "s_gull", "b_worm", "b_shrimp", "b_firefly", "b_golden", "b_moon", "b_ice", "b_rainbow", "g_lantern", "g_sonar", "g_shop", "g_map",
];

const raw = new Map<string, HTMLImageElement>();
const shadowed = new Map<string, Sprite>();
const tinted = new Map<string, Sprite>();
const bgBottom = new Map<string, string>();
const bgTop = new Map<string, string>();

export const img = (name: string) => raw.get(name) ?? null;
export const artUrl = (name: string) => `./art/${name}.webp`;

/** what the first minute needs: the lake, the fisher, the UI. The rest streams in afterwards. */
function isCore(n: string) {
  const f = FISH.find((x) => x.id === n);
  if (f) return f.zone === "lake";
  if (n.startsWith("kid_")) return n.startsWith("kid_cap_");
  if (/^(bg|floor)_/.test(n)) return n.endsWith("_lake");
  if (n.startsWith("p_")) return PROPS.lake.includes(n);
  return !/^(pet_|hat_|npc_|b_|bg_aquarium)/.test(n);
}

export function loadRest(): Promise<void> {
  return loadList(NAMES.filter((n) => !isCore(n) && !raw.has(n)), () => {}).then(() => {
    for (const z of ["lake", "ocean", "ice", "reef", "volcano"] as const) {
      const im = raw.get(`bg_${z}`);
      if (im && !bgBottom.has(z)) { bgBottom.set(z, sampleRow(im, im.height - 8)); bgTop.set(z, sampleRow(im, 0)); }
    }
  });
}

export function loadAssets(onProgress: (k: number) => void, extra: string[] = []): Promise<void> {
  return loadList(NAMES.filter((n) => isCore(n) || extra.includes(n)), onProgress).then(() => {
    for (const z of ["lake", "ocean", "ice", "reef", "volcano"] as const) {
      const im = raw.get(`bg_${z}`);
      if (im) { bgBottom.set(z, sampleRow(im, im.height - 8)); bgTop.set(z, sampleRow(im, 0)); }
    }
  });
}

function loadList(list: string[], onProgress: (k: number) => void): Promise<void> {
  let done = 0;
  const NAMES = list;
  return Promise.all(NAMES.map((n) => new Promise<void>((resolve) => {
    const im = new Image();
    im.onload = () => { raw.set(n, im); onProgress(++done / NAMES.length); resolve(); };
    im.onerror = () => { onProgress(++done / NAMES.length); resolve(); }; // missing art falls back to drawn shapes
    im.src = artUrl(n);
  }))).then(() => undefined);
}

function sampleRow(im: HTMLImageElement, y: number) {
  const c = document.createElement("canvas");
  c.width = 32; c.height = 4;
  const x = c.getContext("2d")!;
  x.drawImage(im, 0, y, im.width, 8, 0, 0, 32, 4);
  const d = x.getImageData(8, 0, 16, 4).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4;
  return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
}
export const bgBottomColor = (z: ZoneId) => bgBottom.get(z) ?? "#1d5f8a";
export const bgTopColor = (z: ZoneId) => bgTop.get(z) ?? "#3aa0f0";

/** sprite with a soft shadow baked in; `pad` px on every side */
export const SHADOW_PAD = 14;
export function spriteShadowed(name: string, mut: MutationId | null = null): Sprite | null {
  const key = `${name}|${mut ?? ""}`;
  const hit = shadowed.get(key);
  if (hit) return hit;
  const src = mut ? spriteTinted(name, mut) : raw.get(name);
  if (!src) return null;
  const w = src.width, h = src.height;
  const c = document.createElement("canvas");
  c.width = w + SHADOW_PAD * 2; c.height = h + SHADOW_PAD * 2;
  const x = c.getContext("2d")!;
  x.shadowColor = "rgba(0,18,40,0.38)";
  x.shadowBlur = 10;
  x.shadowOffsetY = 7;
  x.drawImage(src, SHADOW_PAD, SHADOW_PAD - 3);
  shadowed.set(key, c);
  return c;
}

/** recoloured copy for a mutation: keeps the drawing's shading, swaps its colours */
export function spriteTinted(name: string, mut: MutationId): Sprite | null {
  if (mut === "giant") return raw.get(name) ? spriteFromImage(name) : null;
  const key = `${name}|${mut}`;
  const hit = tinted.get(key);
  if (hit) return hit;
  const im = raw.get(name);
  if (!im) return null;
  const c = document.createElement("canvas");
  c.width = im.width; c.height = im.height;
  const x = c.getContext("2d")!;
  x.drawImage(im, 0, 0);
  x.globalCompositeOperation = "source-atop";
  if (mut === "gold") {
    x.globalCompositeOperation = "color";
    const g = x.createLinearGradient(0, 0, im.width, im.height);
    g.addColorStop(0, "#ffe680"); g.addColorStop(0.5, "#ffb300"); g.addColorStop(1, "#e08a00");
    x.fillStyle = g; x.fillRect(0, 0, im.width, im.height);
    x.globalCompositeOperation = "soft-light";
    x.fillStyle = "#fff2b0"; x.fillRect(0, 0, im.width, im.height);
  } else if (mut === "rainbow") {
    x.globalCompositeOperation = "color";
    const g = x.createLinearGradient(0, 0, im.width, 0);
    ["#ff5b6e", "#ffb347", "#ffe66d", "#6ee7a0", "#5bc8ff", "#a77bff"].forEach((col, i) => g.addColorStop(i / 5, col));
    x.fillStyle = g; x.fillRect(0, 0, im.width, im.height);
  } else if (mut === "ghost") {
    x.globalCompositeOperation = "color";
    x.fillStyle = "#9fe8ff"; x.fillRect(0, 0, im.width, im.height);
  } else if (mut === "electric") {
    x.globalCompositeOperation = "color";
    x.fillStyle = "#38e1ff"; x.fillRect(0, 0, im.width, im.height);
    x.globalCompositeOperation = "soft-light";
    x.fillStyle = "#fff36b"; x.fillRect(0, 0, im.width, im.height);
  }
  // blend modes paint the transparent area too: cut the result back to the sprite's shape
  x.globalCompositeOperation = "destination-in";
  x.drawImage(im, 0, 0);
  if (mut === "ghost") { x.globalCompositeOperation = "destination-in"; x.fillStyle = "rgba(0,0,0,0.6)"; x.fillRect(0, 0, im.width, im.height); }
  tinted.set(key, c);
  return c;
}

function spriteFromImage(name: string): Sprite {
  const key = `${name}|plain`;
  const hit = tinted.get(key);
  if (hit) return hit;
  const im = raw.get(name)!;
  const c = document.createElement("canvas");
  c.width = im.width; c.height = im.height;
  c.getContext("2d")!.drawImage(im, 0, 0);
  tinted.set(key, c);
  return c;
}

/** a wandering specular glint across a sprite: the glossy "toy" shine, not a glow */
export function drawGlint(ctx: CanvasRenderingContext2D, sprite: Sprite, x: number, y: number, w: number, h: number, phase: number, res = 2) {
  const k = phase % 1;
  if (k > 0.35) return; // the glint passes, then rests a while
  const pw = Math.ceil(w * res), ph = Math.ceil(h * res);
  const scratch = glintCanvas(pw, ph);
  const g = scratch.getContext("2d")!;
  g.globalCompositeOperation = "source-over";
  g.clearRect(0, 0, pw, ph);
  g.drawImage(sprite, 0, 0, pw, ph);
  g.globalCompositeOperation = "source-in";
  const cx = -pw * 0.3 + (k / 0.35) * pw * 1.6;
  const grad = g.createLinearGradient(cx - pw * 0.15, 0, cx + pw * 0.15, ph);
  grad.addColorStop(0, "rgba(255,255,255,0)"); grad.addColorStop(0.5, "rgba(255,255,255,0.5)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, pw, ph);
  ctx.drawImage(scratch, 0, 0, pw, ph, x, y, w, h);
}
let scratchC: HTMLCanvasElement | null = null;
function glintCanvas(w: number, h: number) {
  if (!scratchC) scratchC = document.createElement("canvas");
  if (scratchC.width < w || scratchC.height < h) { scratchC.width = Math.max(w, scratchC.width); scratchC.height = Math.max(h, scratchC.height); }
  return scratchC;
}
