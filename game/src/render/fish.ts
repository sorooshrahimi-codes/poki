import type { FishDef, MutationId } from "../core/types.ts";

// Procedural fish: a few canvas shapes per species, so the build has no art files yet.
// When the AI studio delivers sprites, drawFish becomes a drawImage with the same mutation pass.

type Ctx = CanvasRenderingContext2D;

function bodyFill(c: Ctx, def: FishDef, mut: MutationId | null, len: number, t: number): string | CanvasGradient {
  if (mut === "gold") {
    const g = c.createLinearGradient(-len / 2, -len / 3, len / 2, len / 3);
    g.addColorStop(0, "#fff3a8"); g.addColorStop(0.5, "#ffc61a"); g.addColorStop(1, "#c98a00");
    return g;
  }
  if (mut === "rainbow") {
    const g = c.createLinearGradient(-len / 2, 0, len / 2, 0);
    for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${(i * 60 + t * 120) % 360},90%,62%)`);
    return g;
  }
  if (mut === "ghost") return "rgba(200,240,255,0.55)";
  if (mut === "electric") return "#3ad7ff";
  return def.look.body;
}

function finColor(def: FishDef, mut: MutationId | null) {
  return mut === "gold" ? "#e0a100" : mut === "ghost" ? "rgba(160,220,255,0.5)" : mut === "electric" ? "#fff36b" : mut === "rainbow" ? "#ffffff" : def.look.fin;
}

/** draws the fish centred on 0,0 facing +x (flip with scale(-1,1) for left) */
export function drawFish(c: Ctx, def: FishDef, mut: MutationId | null, len: number, t: number) {
  const L = def.look;
  const h = len * L.aspect;
  const wag = Math.sin(t * 9) * 0.18;
  c.save();
  if (mut === "ghost") c.globalAlpha *= 0.75;
  switch (L.shape) {
    case "boot": drawBoot(c, len, def); break;
    case "can": drawCan(c, len, def); break;
    case "duck": drawDuck(c, len, def); break;
    case "jelly": drawJelly(c, len, def, mut, t); break;
    case "puffer": drawPuffer(c, len, def, mut, t); break;
    case "eel": drawEel(c, len, def, mut, t); break;
    default: {
      // tail
      c.fillStyle = finColor(def, mut);
      c.beginPath();
      c.moveTo(-len * 0.38, 0);
      c.lineTo(-len * 0.62, -h * 0.55 + wag * h);
      c.lineTo(-len * 0.55, 0);
      c.lineTo(-len * 0.62, h * 0.55 + wag * h);
      c.closePath();
      c.fill();
      // dorsal fin
      c.beginPath();
      c.moveTo(-len * 0.12, -h * 0.42);
      c.quadraticCurveTo(len * 0.02, -h * 0.85, len * 0.14, -h * 0.4);
      c.fill();
      // body
      c.fillStyle = bodyFill(c, def, mut, len, t);
      c.beginPath();
      c.ellipse(0, 0, len * 0.45, h / 2, 0, 0, Math.PI * 2);
      c.fill();
      // belly
      if (!mut) {
        c.fillStyle = L.belly;
        c.beginPath();
        c.ellipse(len * 0.02, h * 0.2, len * 0.34, h * 0.22, 0, 0, Math.PI);
        c.fill();
      }
      pattern(c, def, len, h);
      // eye
      c.fillStyle = "#fff";
      c.beginPath(); c.arc(len * 0.27, -h * 0.1, Math.max(2, h * 0.13), 0, Math.PI * 2); c.fill();
      c.fillStyle = "#111";
      c.beginPath(); c.arc(len * 0.29, -h * 0.1, Math.max(1.2, h * 0.07), 0, Math.PI * 2); c.fill();
      if (def.id === "angler") {
        c.strokeStyle = def.look.fin; c.lineWidth = 2;
        c.beginPath(); c.moveTo(len * 0.2, -h * 0.45); c.quadraticCurveTo(len * 0.45, -h * 0.9, len * 0.55, -h * 0.4); c.stroke();
        c.fillStyle = "#fff6a0"; c.beginPath(); c.arc(len * 0.55, -h * 0.38, 4 + Math.sin(t * 5), 0, Math.PI * 2); c.fill();
      }
      if (def.id === "swordfish" || def.id === "grand_marlin") {
        c.fillStyle = finColor(def, mut);
        c.beginPath(); c.moveTo(len * 0.42, -h * 0.08); c.lineTo(len * 0.85, 0); c.lineTo(len * 0.42, h * 0.08); c.fill();
      }
      if (def.id === "catfish" || def.id === "old_whiskers") {
        c.strokeStyle = "#1b1b1b"; c.lineWidth = 1.5;
        for (const s of [-1, 1]) { c.beginPath(); c.moveTo(len * 0.4, h * 0.05); c.quadraticCurveTo(len * 0.55, h * 0.3 * s, len * 0.62, h * 0.55 * s + wag * 6); c.stroke(); }
      }
    }
  }
  if (mut === "electric") sparks(c, len, t);
  c.restore();
}

function pattern(c: Ctx, def: FishDef, len: number, h: number) {
  if (!def.look.pattern) return;
  c.save();
  c.beginPath();
  c.ellipse(0, 0, len * 0.45, h / 2, 0, 0, Math.PI * 2);
  c.clip();
  c.fillStyle = def.look.pattern === "stripes" ? (def.id === "clownfish" ? "#ffffff" : "rgba(0,0,0,0.22)") : "rgba(0,0,0,0.25)";
  if (def.look.pattern === "stripes") {
    for (let i = -2; i <= 2; i++) c.fillRect(i * len * 0.17 - len * 0.03, -h, len * 0.07, h * 2);
  } else {
    for (let i = 0; i < 9; i++) {
      const x = ((i * 37) % 70) / 100 - 0.35, y = ((i * 53) % 60) / 100 - 0.3;
      c.beginPath(); c.arc(x * len, y * h, Math.max(1.5, h * 0.07), 0, Math.PI * 2); c.fill();
    }
  }
  c.restore();
}

function drawEel(c: Ctx, len: number, def: FishDef, mut: MutationId | null, t: number) {
  c.strokeStyle = bodyFill(c, def, mut, len, t) as string;
  c.lineCap = "round";
  c.lineWidth = Math.max(5, len * def.look.aspect);
  c.beginPath();
  for (let i = 0; i <= 12; i++) {
    const x = -len / 2 + (len * i) / 12;
    const y = Math.sin(t * 6 - i * 0.7) * len * 0.06;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.stroke();
  if (def.id === "glow_eel" && !mut) {
    c.shadowColor = def.look.body; c.shadowBlur = 12; c.stroke(); c.shadowBlur = 0;
  }
  c.fillStyle = "#111";
  c.beginPath(); c.arc(len * 0.44, Math.sin(t * 6 - 12 * 0.7) * len * 0.06 - 2, 2, 0, Math.PI * 2); c.fill();
}

function drawPuffer(c: Ctx, len: number, def: FishDef, mut: MutationId | null, t: number) {
  const r = len * 0.42 * (1 + Math.sin(t * 2) * 0.05);
  c.strokeStyle = finColor(def, mut); c.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    c.beginPath(); c.moveTo(Math.cos(a) * r, Math.sin(a) * r); c.lineTo(Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25); c.stroke();
  }
  c.fillStyle = bodyFill(c, def, mut, len, t);
  c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
  if (!mut) { c.fillStyle = def.look.belly; c.beginPath(); c.arc(0, r * 0.3, r * 0.65, 0, Math.PI); c.fill(); }
  c.fillStyle = "#fff"; c.beginPath(); c.arc(r * 0.45, -r * 0.25, r * 0.22, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#111"; c.beginPath(); c.arc(r * 0.5, -r * 0.25, r * 0.11, 0, Math.PI * 2); c.fill();
}

function drawJelly(c: Ctx, len: number, def: FishDef, mut: MutationId | null, t: number) {
  const r = len * 0.42, pulse = 1 + Math.sin(t * 3) * 0.08;
  c.strokeStyle = finColor(def, mut); c.lineWidth = 2; c.globalAlpha *= 0.85;
  for (let i = -2; i <= 2; i++) {
    c.beginPath(); c.moveTo(i * r * 0.3, 0);
    for (let k = 1; k <= 5; k++) c.lineTo(i * r * 0.3 + Math.sin(t * 3 + k + i) * 4, k * r * 0.3);
    c.stroke();
  }
  c.fillStyle = bodyFill(c, def, mut, len, t);
  c.beginPath(); c.ellipse(0, 0, r * pulse, r * 0.7 / pulse, 0, Math.PI, 0); c.fill();
}

function drawBoot(c: Ctx, len: number, def: FishDef) {
  const s = len / 30;
  c.fillStyle = def.look.body;
  c.beginPath();
  c.moveTo(-8 * s, -14 * s); c.lineTo(4 * s, -14 * s); c.lineTo(4 * s, 2 * s); c.lineTo(15 * s, 6 * s);
  c.lineTo(15 * s, 12 * s); c.lineTo(-8 * s, 12 * s); c.closePath(); c.fill();
  c.fillStyle = def.look.belly; c.fillRect(-9 * s, 10 * s, 25 * s, 4 * s);
  c.strokeStyle = def.look.fin; c.lineWidth = 1.5 * s;
  for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-6 * s, (-10 + i * 5) * s); c.lineTo(2 * s, (-8 + i * 5) * s); c.stroke(); }
}

function drawCan(c: Ctx, len: number, def: FishDef) {
  const w = len * 0.5, h = len * 0.8;
  c.fillStyle = def.look.body; c.fillRect(-w / 2, -h / 2, w, h);
  c.fillStyle = def.look.fin; c.fillRect(-w / 2, -h / 2 - 2, w, 4); c.fillRect(-w / 2, h / 2 - 2, w, 4);
  c.fillStyle = def.look.belly; c.fillRect(-w / 2, -h * 0.08, w, h * 0.16);
}

function drawDuck(c: Ctx, len: number, def: FishDef) {
  const s = len / 26;
  c.fillStyle = def.look.body;
  c.beginPath(); c.ellipse(0, 4 * s, 12 * s, 8 * s, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(7 * s, -6 * s, 6 * s, 0, Math.PI * 2); c.fill();
  c.fillStyle = def.look.belly;
  c.beginPath(); c.moveTo(12 * s, -6 * s); c.lineTo(18 * s, -4 * s); c.lineTo(12 * s, -2 * s); c.fill();
  c.fillStyle = "#111"; c.beginPath(); c.arc(9 * s, -8 * s, 1.3 * s, 0, Math.PI * 2); c.fill();
}

function sparks(c: Ctx, len: number, t: number) {
  c.strokeStyle = "#fff36b"; c.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const a = t * 7 + i * 2.1, x = Math.cos(a) * len * 0.5, y = Math.sin(a * 1.3) * len * 0.3;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + 5, y - 4); c.lineTo(x + 2, y + 1); c.lineTo(x + 7, y - 2); c.stroke();
  }
}
