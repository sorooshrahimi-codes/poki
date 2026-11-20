import type { HarborId } from "../data/harbor.ts";
import { img, spriteTinted } from "./assets.ts";
import { blink } from "./scene.ts";

// The harbor next to the boat, drawn in code in the game's glossy style (thick navy outline,
// soft shading, a highlight). Positions are in world units: the water surface is y = 0 and the
// boat sits around x = 95..245 in a 360-wide column; landscape screens simply show more of it.

type Ctx = CanvasRenderingContext2D;
const OL = "#16345e";

export interface HarborView {
  built: Set<HarborId>;
  best: string[];
  tank: string[];
  statue: string | null;
  daylight: number;
  /** 0..1 right after a rare catch: the visitors jump and cheer */
  cheer: number;
  /** id of a stage that was just built: it pops in */
  fresh: HarborId | null;
  freshT: number;
}

function wood(c: Ctx, x: number, y: number, w: number, h: number) {
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#c98a52"); g.addColorStop(1, "#8a5530");
  c.fillStyle = g; c.strokeStyle = OL; c.lineWidth = 2.5;
  c.beginPath(); c.roundRect(x, y, w, h, Math.min(4, h / 2)); c.fill(); c.stroke();
}

/** grows from 0 when a stage is first built, with a little overshoot */
function popScale(h: HarborView, id: HarborId) {
  if (h.fresh !== id) return 1;
  const k = Math.min(1, h.freshT / 0.7);
  return k < 1 ? Math.sin(k * Math.PI * 0.5) * (1 + 0.25 * Math.sin(k * Math.PI)) : 1;
}
function withPop(c: Ctx, h: HarborView, id: HarborId, ax: number, ay: number, draw: () => void) {
  const k = popScale(h, id);
  if (k <= 0.01) return;
  c.save(); c.translate(ax, ay); c.scale(k, k); c.translate(-ax, -ay); draw(); c.restore();
}

export function drawHarbor(c: Ctx, h: HarborView, t: number, left: number, right: number) {
  const b = h.built;
  c.save();
  c.lineJoin = "round"; c.lineCap = "round";
  // the boat takes x 95..245; the harbor spreads into whatever room the screen has on each side
  const wideL = Math.max(0, -left), wideR = Math.max(0, right - 360);
  const pierL = Math.min(-60, left - 20), pierR = 90;
  const standX = wideL > 60 ? -70 : 22, visX = wideL > 60 ? 4 : 58, trophyX = wideL > 60 ? -160 : 76, trophyY = wideL > 60 ? -60 : -96;
  const tankX = wideR > 60 ? 300 : 272, statueX = wideR > 60 ? 390 : 336, lightX = wideR > 60 ? 360 + wideR * 0.7 : 306;
  const lightK = wideR > 60 ? 1 : 0.6;

  // far shore first (smaller = further away)
  if (b.has("lighthouse")) withPop(c, h, "lighthouse", lightX, -14, () => { c.save(); c.translate(lightX, wideR > 60 ? -14 : -22); c.scale(lightK, lightK); lighthouse(c, 0, 0, t, h.daylight); c.restore(); });
  if (b.has("bunting")) withPop(c, h, "bunting", 40, -120, () => bunting(c, pierL, pierR, right, t, b.has("festival")));
  if (b.has("pier")) withPop(c, h, "pier", 40, 0, () => pier(c, pierL, pierR, t));
  if (b.has("trophy")) withPop(c, h, "trophy", trophyX, trophyY, () => trophy(c, trophyX, trophyY, h.best));
  if (b.has("stand")) withPop(c, h, "stand", standX, -14, () => stand(c, standX, -14, t));
  if (b.has("visitors")) withPop(c, h, "visitors", visX, -14, () => visitors(c, visX - 14, -14, t, h.cheer));
  if (b.has("tank")) withPop(c, h, "tank", tankX, 0, () => tank(c, tankX, 0, t, h.tank));
  if (b.has("statue")) withPop(c, h, "statue", statueX, 0, () => statue(c, statueX, 0, t, h.statue));
  if (b.has("festival") && h.daylight < 0.7) fireworks(c, left, right, t);
  c.restore();
}

function pier(c: Ctx, x0: number, x1: number, t: number) {
  // posts into the water, then the deck, then a rail
  for (let x = x0 + 14; x < x1; x += 34) {
    c.fillStyle = "#7a4a2a"; c.strokeStyle = OL; c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(x - 4, -12, 8, 40, 3); c.fill(); c.stroke();
    // a ring of ripples where each post meets the water
    c.strokeStyle = `rgba(255,255,255,${0.35 + 0.15 * Math.sin(t * 2 + x)})`; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(x, 2, 9 + Math.sin(t * 2 + x) * 2, 2.5, 0, 0, Math.PI * 2); c.stroke();
  }
  wood(c, x0, -16, x1 - x0, 9);
  c.strokeStyle = "rgba(90,50,25,0.6)"; c.lineWidth = 1;
  for (let x = x0 + 10; x < x1; x += 12) { c.beginPath(); c.moveTo(x, -15); c.lineTo(x, -8); c.stroke(); }
  // rail
  for (let x = x0 + 8; x <= x1 - 4; x += 26) wood(c, x - 2.5, -38, 5, 22);
  wood(c, x0, -40, x1 - x0, 5);
}

function trophy(c: Ctx, x: number, y: number, best: string[]) {
  wood(c, x - 2, y + 18, 4, Math.max(30, -16 - (y + 18)));
  c.fillStyle = "#f6e3b4"; c.strokeStyle = OL; c.lineWidth = 3;
  c.beginPath(); c.roundRect(x - 26, y - 14, 52, 34, 6); c.fill(); c.stroke();
  c.fillStyle = "#ffcf3a"; c.beginPath(); c.arc(x, y - 16, 7, 0, Math.PI * 2); c.fill(); c.stroke();
  best.forEach((id, i) => {
    const im = img(id); if (!im) return;
    const w = i === 0 ? 30 : 20, hh = (w * im.height) / im.width;
    const fx = i === 0 ? x : x + (i === 1 ? -16 : 16), fy = i === 0 ? y - 2 : y + 11;
    c.drawImage(im, fx - w / 2, fy - hh / 2, w, hh);
  });
}

function stand(c: Ctx, x: number, y: number, t: number) {
  // counter with ice and fish, a striped awning on two poles, the chef behind
  const chef = img("npc_chef");
  if (chef) { const w = 34, hh = (w * chef.height) / chef.width, bob = Math.sin(t * 2.2) * 1.5; c.drawImage(chef, x - w / 2, y - 26 - hh + bob + 8, w, hh); blink(c, "npc_chef", x - w / 2, y - 26 - hh + bob + 8, w, hh, t, 21); }
  wood(c, x - 26, y - 26, 52, 24);
  c.fillStyle = "#e9f7ff"; c.beginPath(); c.roundRect(x - 23, y - 30, 46, 6, 3); c.fill();
  const f = img("minnow"); if (f) for (let i = 0; i < 3; i++) c.drawImage(f, x - 20 + i * 13, y - 34, 14, 7);
  wood(c, x - 26, y - 64, 4, 40); wood(c, x + 22, y - 64, 4, 40);
  // awning
  const top = y - 72, sway = Math.sin(t * 1.6) * 1.2;
  for (let i = 0; i < 5; i++) {
    c.fillStyle = i % 2 ? "#ffffff" : "#ff5a6a";
    c.beginPath(); c.moveTo(x - 30 + i * 12, top); c.lineTo(x - 18 + i * 12, top); c.lineTo(x - 18 + i * 12 + sway, top + 14); c.quadraticCurveTo(x - 24 + i * 12 + sway, top + 19, x - 30 + i * 12 + sway, top + 14); c.closePath(); c.fill();
  }
  c.strokeStyle = OL; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(x - 30, top); c.lineTo(x + 30, top); c.stroke();
}

function bunting(c: Ctx, x0: number, x1: number, right: number, t: number, lanterns: boolean) {
  const cols = ["#ff5a6a", "#ffd04a", "#5bc8ff", "#7be495", "#c77dff"];
  const lines: [number, number, number, number][] = [[x0, -96, x1, -76], [262, -70, right + 10, -100]];
  for (const [ax, ay, bx, by] of lines) {
    const sag = 16;
    c.strokeStyle = "rgba(22,52,94,0.8)"; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + sag, bx, by); c.stroke();
    const n = Math.max(3, Math.floor((bx - ax) / 16));
    for (let i = 1; i < n; i++) {
      const k = i / n, px = ax + (bx - ax) * k, py = ay + (by - ay) * k + 4 * sag * k * (1 - k) * 2 / 2;
      if (lanterns && i % 2 === 0) {
        const gl = c.createRadialGradient(px, py + 7, 1, px, py + 7, 14);
        gl.addColorStop(0, "rgba(255,210,120,0.8)"); gl.addColorStop(1, "rgba(255,210,120,0)");
        c.fillStyle = gl; c.beginPath(); c.arc(px, py + 7, 14, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#ff8a3a"; c.strokeStyle = OL; c.lineWidth = 1.5;
        c.beginPath(); c.ellipse(px, py + 7, 4.5, 6, 0, 0, Math.PI * 2); c.fill(); c.stroke();
        continue;
      }
      const flap = Math.sin(t * 4 + i) * 2;
      c.fillStyle = cols[i % cols.length]; c.strokeStyle = OL; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(px - 5, py); c.lineTo(px + 5, py); c.lineTo(px + flap, py + 11); c.closePath(); c.fill(); c.stroke();
    }
  }
}

function lighthouse(c: Ctx, x: number, y: number, t: number, day: number) {
  // a small tower on a rock on the far shore; at dusk its lamp turns and sweeps a beam
  c.fillStyle = "#7d8a99"; c.strokeStyle = OL; c.lineWidth = 2;
  c.beginPath(); c.ellipse(x, y, 22, 7, 0, Math.PI, 0); c.fill(); c.stroke();
  const h = 62, wB = 15, wT = 10;
  c.save();
  c.beginPath(); c.moveTo(x - wB, y - 2); c.lineTo(x - wT, y - h); c.lineTo(x + wT, y - h); c.lineTo(x + wB, y - 2); c.closePath();
  c.fillStyle = "#ffffff"; c.fill(); c.clip();
  c.fillStyle = "#ff5a5a"; for (let i = 0; i < 3; i++) c.fillRect(x - 20, y - 14 - i * 18, 40, 8);
  c.restore();
  c.strokeStyle = OL; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(x - wB, y - 2); c.lineTo(x - wT, y - h); c.lineTo(x + wT, y - h); c.lineTo(x + wB, y - 2); c.closePath(); c.stroke();
  c.fillStyle = "#ffe066"; c.beginPath(); c.roundRect(x - 8, y - h - 12, 16, 12, 3); c.fill(); c.stroke();
  c.fillStyle = "#ff5a5a"; c.beginPath(); c.moveTo(x - 11, y - h - 12); c.lineTo(x, y - h - 22); c.lineTo(x + 11, y - h - 12); c.closePath(); c.fill(); c.stroke();
  const night = 1 - day;
  if (night > 0.15) {
    const a = t * 0.9, ly = y - h - 6;
    c.save(); c.globalCompositeOperation = "lighter";
    c.beginPath(); c.rect(-2000, -2000, 4000, 2000 - 2); c.clip(); // the beam lights the sky, not the water
    for (const dir of [a, a + Math.PI]) {
      const len = 260, sp = 0.11;
      const g = c.createRadialGradient(x, ly, 4, x, ly, len);
      g.addColorStop(0, `rgba(255,240,170,${0.32 * night})`); g.addColorStop(1, "rgba(255,240,170,0)");
      c.fillStyle = g;
      c.beginPath(); c.moveTo(x, ly); c.arc(x, ly, len, dir - sp, dir + sp); c.closePath(); c.fill();
    }
    c.restore();
  }
}

function visitors(c: Ctx, x: number, y: number, t: number, cheer: number) {
  // two friends leaning on the rail; after a rare catch they jump and wave
  const who = ["npc_granny", "npc_scientist"];
  who.forEach((n, i) => {
    const im = img(n); if (!im) return;
    const w = 34, hh = (w * im.height) / im.width;
    const jump = cheer > 0 ? Math.abs(Math.sin((t * 9) + i)) * 10 * cheer : Math.sin(t * 1.8 + i * 2) * 1.2;
    const px = x + i * 30 - w / 2, py = y - 30 - hh + 14 - jump;
    c.drawImage(im, px, py, w, hh);
    blink(c, n, px, py, w, hh, t, 31 + i * 17);
    if (cheer > 0.2) { c.font = "14px system-ui"; c.textAlign = "center"; c.fillText(i ? "👏" : "🎉", px + w / 2 + (i ? 14 : -14), py + 6 - jump * 0.5); }
  });
}

function tank(c: Ctx, x: number, y: number, t: number, fish: string[]) {
  // a little raft carrying a glass aquarium with your own kept fish swimming in it
  const bob = Math.sin(t * 1.7) * 2;
  c.save(); c.translate(0, bob);
  wood(c, x - 32, y - 6, 64, 8);
  const W = 50, H = 34, gx = x - W / 2, gy = y - 6 - H;
  const g = c.createLinearGradient(0, gy, 0, gy + H);
  g.addColorStop(0, "rgba(160,235,255,0.75)"); g.addColorStop(1, "rgba(40,130,200,0.85)");
  c.fillStyle = g; c.beginPath(); c.roundRect(gx, gy, W, H, 6); c.fill();
  fish.forEach((id, i) => {
    const im = img(id); if (!im) return;
    const fw = 16, fh = (fw * im.height) / im.width;
    const p = (t * (0.18 + i * 0.05) + i * 0.37) % 1, dir = Math.floor(t * (0.18 + i * 0.05) + i * 0.37) % 2 ? -1 : 1;
    const fx = dir > 0 ? gx + 6 + p * (W - 12) : gx + W - 6 - p * (W - 12), fy = gy + 9 + (i % 3) * 8 + Math.sin(t * 2 + i) * 2;
    c.save(); c.translate(fx, fy); c.scale(dir, 1); c.drawImage(im, -fw / 2, -fh / 2, fw, fh); c.restore();
  });
  c.fillStyle = "rgba(255,255,255,0.45)"; c.fillRect(gx + 5, gy + 4, 4, H - 10);
  c.strokeStyle = OL; c.lineWidth = 2.5; c.beginPath(); c.roundRect(gx, gy, W, H, 6); c.stroke();
  c.restore();
}

function statue(c: Ctx, x: number, y: number, t: number, id: string | null) {
  // your best legendary, cast in gold on a stone pedestal, glinting
  c.fillStyle = "#8d96a3"; c.strokeStyle = OL; c.lineWidth = 2.5;
  c.beginPath(); c.ellipse(x, y + 2, 24, 7, 0, Math.PI, 0); c.fill(); c.stroke();
  c.fillStyle = "#c8ced8"; c.beginPath(); c.roundRect(x - 12, y - 18, 24, 18, 4); c.fill(); c.stroke();
  if (!id) return;
  const gold = spriteTinted(id, "gold"); if (!gold) return;
  const w = 58, hh = (w * gold.height) / gold.width;
  c.save(); c.translate(x, y - 20 - hh / 2 + 4); c.rotate(-0.35);
  c.drawImage(gold, -w / 2, -hh / 2, w, hh);
  c.restore();
  const k = (t * 0.5) % 1;
  if (k < 0.2) { const s = 5 * Math.sin((k / 0.2) * Math.PI); c.fillStyle = "#fffbe0"; c.beginPath(); c.moveTo(x + 10, y - 50 - s); c.lineTo(x + 12, y - 50); c.lineTo(x + 10, y - 50 + s); c.lineTo(x + 8, y - 50); c.closePath(); c.fill(); }
}

function fireworks(c: Ctx, left: number, right: number, t: number) {
  // a firework every couple of seconds high in the sky, at dusk and at night
  const per = 2.4;
  for (let n = 0; n < 2; n++) {
    const k = ((t + n * per * 0.5) % per) / per, seed = Math.floor((t + n * per * 0.5) / per) * 7 + n;
    if (k > 0.55) continue;
    const x = left + 40 + ((seed * 97) % Math.max(1, right - left - 80)), y = -150 - ((seed * 53) % 60);
    const r = 34 * Math.min(1, k / 0.3), a = 1 - Math.max(0, (k - 0.3) / 0.25);
    const col = ["#ffd04a", "#ff5a8a", "#5bc8ff", "#7be495"][seed % 4];
    c.strokeStyle = col; c.globalAlpha = a; c.lineWidth = 2;
    for (let i = 0; i < 12; i++) { const an = (i / 12) * Math.PI * 2; c.beginPath(); c.moveTo(x + Math.cos(an) * r * 0.4, y + Math.sin(an) * r * 0.4); c.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r + k * 8); c.stroke(); }
    c.globalAlpha = 1;
  }
}
