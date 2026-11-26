// The saga: a road of 30 short levels through the five lands, each with its own goal.
// Goals (all wordless, an icon and a number):
//   wreck  🏚️ ×n   bring down n things before the time runs out (a rival may compete for them)
//   gold   🌟 ×n   grab n golden targets, one after another (rivals race you for them)
//   grow   🐜 n    grow the swarm to n mites
//   race   🥇      a round against three rival swarms: finish in the top three
//   castle 🏰      bring down one huge, very tough tower: grow first, then hit it
//   boss   👾      a giant red swarm: grow bigger than it, then eat it
export type Goal = "wreck" | "gold" | "grow" | "race" | "castle" | "boss";
export type Level = { land: number; goal: Goal; n: number; time: number; rivals: number; seed: number };

const PATTERN: Goal[][] = [
  ["wreck", "gold", "grow", "wreck", "castle", "race"],
  ["gold", "wreck", "race", "grow", "castle", "boss"],
  ["castle", "gold", "race", "wreck", "grow", "boss"],
  ["race", "grow", "gold", "castle", "wreck", "boss"],
  ["gold", "race", "castle", "grow", "wreck", "boss"],
];

export const LEVELS: Level[] = [];
for (let i = 0; i < 30; i++) {
  const land = Math.floor(i / 6) + 1, goal = PATTERN[land - 1][i % 6], t = i / 29;
  let n = 0, time = 60, rivals = 0;
  switch (goal) {
    case "wreck": n = Math.round(6 + t * 20); time = 60; rivals = i < 6 ? 0 : 1; break;
    case "gold": n = 3 + Math.floor(t * 3); time = 40 + n * 9; rivals = i < 2 ? 0 : t < 0.6 ? 1 : 2; break;
    case "grow": n = Math.round((2500 + t * 11000) / 500) * 500; time = 60; rivals = 0; break;
    case "race": n = 3; time = 75; rivals = 3; break;
    case "castle": n = 2.5 + t * 4; time = 60; rivals = 0; break;
    case "boss": n = Math.round(1500 + t * 6000); time = 90; rivals = 0; break;
  }
  LEVELS.push({ land, goal, n, time, rivals, seed: 1000 + i * 37 });
}

export const GOAL_ICON: Record<Goal, string> = { wreck: "🏚️", gold: "🌟", grow: "🐜", race: "🥇", castle: "🏰", boss: "👾" };
export function goalText(L: Level) {
  const fmt = (n: number) => n >= 10000 ? `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}k` : n.toLocaleString("en");
  switch (L.goal) {
    case "wreck": case "gold": return `${GOAL_ICON[L.goal]} ×${L.n}`;
    case "grow": return `${GOAL_ICON.grow} ${fmt(L.n)}`;
    default: return GOAL_ICON[L.goal];
  }
}

/** the goal in a few plain words, for the level card and the intro */
export function goalSentence(L: Level) {
  switch (L.goal) {
    case "wreck": return `Destroy ${L.n} buildings`;
    case "gold": return `Grab ${L.n} golden stars 🌟`;
    case "grow": return `Grow your swarm to ${L.n.toLocaleString("en")}`;
    case "race": return `Be in the top 3 biggest swarms`;
    case "castle": return `Bring down the big castle 🏰`;
    case "boss": return `Grow bigger than the red boss, then eat it`;
  }
}

// ---------------------------------------------------------------- saved progress: stars per level
const KEY = "glowmites-saga";
export const prog: { stars: number[] } = { stars: [] };
try { const j = JSON.parse(localStorage.getItem(KEY) || "null"); if (j && Array.isArray(j.stars)) prog.stars = j.stars; } catch { /* private mode */ }
export function saveStars(i: number, s: number) {
  prog.stars[i] = Math.max(prog.stars[i] || 0, s);
  try { localStorage.setItem(KEY, JSON.stringify(prog)); } catch { /* ignore */ }
}
/** the furthest level you may play: one past the last level with a star */
export function unlocked() { let u = 0; while (u < LEVELS.length - 1 && (prog.stars[u] || 0) > 0) u++; return u; }

// ---------------------------------------------------------------- the map: a winding road, level 1 at the bottom
const LAND_ICON = ["🌼", "🍄", "🏰", "❄️", "🌋"];
const LAND_BG = ["#1d3a1c", "#1c2d3a", "#3a2a1a", "#22324a", "#3a1614"];
export function renderMap(el: HTMLElement, onPick: (i: number) => void, from = -1) {
  const STEP = 96, PAD = 140, PADB = 230, H = PAD + PADB + STEP * (LEVELS.length - 1), W = Math.min(innerWidth, 520);
  const xy = (i: number) => ({ x: W / 2 + Math.sin(i * 0.95) * W * 0.28, y: H - PADB - i * STEP });
  const u = unlocked();
  let svg = `<svg width="${W}" height="${H}" style="position:absolute;left:50%;top:0;translate:-50% 0">`;
  for (let l = 0; l < 5; l++) {
    const y0 = xy(l * 6 + 5).y - STEP / 2, y1 = l === 0 ? H : xy(l * 6).y + STEP / 2;
    svg += `<rect x="0" y="${l === 4 ? 0 : y0}" width="${W}" height="${y1 - (l === 4 ? 0 : y0)}" fill="${LAND_BG[l]}" opacity="0.55"/>`;
  }
  svg += `<polyline fill="none" stroke="rgba(255,230,160,0.35)" stroke-width="8" stroke-linecap="round" stroke-dasharray="2 16" points="${LEVELS.map((_, i) => { const p = xy(i); return `${p.x},${p.y}`; }).join(" ")}"/></svg>`;
  let html = `<div class="mapIn" style="height:${H}px;width:${W}px">${svg}`;
  for (let l = 0; l < 5; l++) { const i = l * 6 + 2.5, p = xy(i); html += `<div class="landIcon" style="left:${W / 2 - Math.sin(i * 0.95) * W * 0.3}px;top:${p.y}px">${LAND_ICON[l]}</div>`; }
  LEVELS.forEach((L, i) => {
    const p = xy(i), s = prog.stars[i] || 0, lock = i > u;
    html += `<div class="node${lock ? " lock" : ""}${i === u ? " cur" : ""}${L.goal === "boss" ? " boss" : ""}" data-i="${i}" style="left:${p.x}px;top:${p.y}px">`
      + `<b>${i + 1}</b><span class="gi">${lock ? "🔒" : GOAL_ICON[L.goal]}</span><span class="st">${lock ? "" : "★".repeat(s) + "☆".repeat(3 - s)}</span></div>`;
  });
  const me = from >= 0 ? from : u, mp = xy(me);
  html += `<div class="me" style="left:${mp.x - 46}px;top:${mp.y - 30}px">✨</div></div>`;
  const total = prog.stars.reduce((a, b) => a + (b || 0), 0);
  html += `<div class="top"><div class="logo">GLOWMITES</div><div class="tot">★ ${total}/${LEVELS.length * 3}</div></div>`;
  html += `<button class="play">▶ <span>${u + 1}</span></button>`;
  el.innerHTML = html;
  el.querySelector(".play")!.addEventListener("click", () => onPick(unlocked()));
  el.querySelectorAll<HTMLElement>(".node").forEach((n) => n.addEventListener("click", () => { const i = Number(n.dataset.i); if (i <= unlocked()) onPick(i); }));
  // scroll so the current level sits in the middle
  requestAnimationFrame(() => { el.scrollTop = xy(me).y - el.clientHeight / 2; });
  // after a win the marker walks along the road to the new level, then that level opens
  if (from >= 0 && u !== from) {
    const m = el.querySelector<HTMLElement>(".me")!, q = xy(u);
    setTimeout(() => {
      m.style.transition = "left 1.1s ease-in-out, top 1.1s ease-in-out"; m.style.left = `${q.x - 46}px`; m.style.top = `${q.y - 30}px`;
      el.scrollTo({ top: q.y - el.clientHeight / 2, behavior: "smooth" });
    }, 500);
    setTimeout(() => onPick(u), 1900);
  }
}
