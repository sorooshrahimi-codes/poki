import "@fontsource/fredoka/500.css";
import "@fontsource/fredoka/600.css";
import "@fontsource/fredoka/700.css";
import "./style.css";
import { newField, sizeField, stepField, spawn, type Field } from "./core/field.ts";
import { OFFLINE_CAP_MS, UPGRADES, UPGRADE_ORDER, catchCoins, power, range, tankSize, upgradeCost, type UpgradeId } from "./core/economy.ts";
import { makeRng } from "./core/rng.ts";
import { loadSave, writeSave } from "./core/save.ts";
import { GIANTS, SKINS, giantOf, giantStep } from "./data/critters.ts";
import { MOUTH_FULL, REACH_FULL, vacLevel, valueMult } from "./core/economy.ts";
import { BIOMES, CRITTERS, CRITTER_BY_ID, RECIPES, MUTATIONS, RARITY_COLOR, STAR_MULT, biomeName, critterName, starOf } from "./data/critters.ts";
import { LANGS, LANG_FLAG, LANG_NAME, detectLang, getLang, setLang, t as tr, tf } from "./i18n.ts";
import type { BiomeId } from "./core/types.ts";
import { commercialBreak, gameplayStart, gameplayStop, initPoki, loadingFinished, rewardedBreak, shareURL, urlParam } from "./platform/poki.ts";
import { setDucked, setIntensity, setMuted, setVacuum, sfx, unlockAudio } from "./platform/audio.ts";
import { View, img, loadArt } from "./render/view.ts";
import { EGG_ART, EGG_MINUTES, NEST_SLOTS, eggDrop, hatch } from "./core/eggs.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const save = loadSave();
setLang(save.lang ?? detectLang());
const view = new View($<HTMLCanvasElement>("game"));
const rng = makeRng((Date.now() & 0xffff) + 1);
/** the field is always where the next giant waits: every place on the way there is open (this also repairs
 *  saves from before new places were added, where the road stopped short) */
function syncRoad() {
  const g = giantStep(save.giantWins ?? 0);
  const upTo = BIOMES.findIndex((b) => b.id === g.biome);
  for (let i = 0; i <= upTo; i++) if (!save.biomes.includes(BIOMES[i].id)) save.biomes.push(BIOMES[i].id);
  save.biome = g.biome;
}
syncRoad();
let field: Field = newField(view.W, view.H, save.up, save.biome);
/** which place's page of the park is showing */
let parkBiome: BiomeId = save.biome;
let mode: "field" | "park" | "rush" = "field";
/** the 60-second race: a seeded field, a fixed vacuum, a score to beat */
const RUSH_UP = { power: 6, range: 5, tank: 0 };
let rush: { seed: number; left: number; score: number; goal: number | null } | null = null;
let rushRng = makeRng(1);
/** what is in the jar right now (species and mutation of each critter) */
let jar: { id: string; mut: string | null }[] = [];
let busy = false, t = 0, combo = 0, lastCatch = -9, colourTarget = 1;

// ------------------------------------------------------------------ input: hold anywhere to suck, aim with the finger
const input: { on: boolean; x: number; y: number; tap?: boolean } = { on: false, x: view.W * 0.6, y: view.H * 0.7 };
const canvas = $("game");
const aimAt = (e: PointerEvent) => { const p = view.toWorld(e.clientX, e.clientY); input.x = p.x; input.y = p.y; };
canvas.addEventListener("pointerdown", (e) => {
  unlockAudio(); aimAt(e);
  if (mode === "field" || mode === "rush") { input.on = true; input.tap = true; firstTouch(); }

});
window.addEventListener("pointermove", (e) => { if (input.on || e.pointerType === "mouse") aimAt(e); });
window.addEventListener("pointerup", () => { input.on = false; });
window.addEventListener("pointercancel", () => { input.on = false; });
window.addEventListener("keydown", (e) => { if (e.key === " ") { input.on = true; firstTouch(); } });
window.addEventListener("keyup", (e) => { if (e.key === " ") input.on = false; });
window.addEventListener("resize", () => { view.resize(); sizeField(field, view.W, view.H); });

let started = false;
function firstTouch() {
  if (started) return;
  started = true;
  $("hint").classList.add("hidden");
  gameplayStart();
}

// ------------------------------------------------------------------ park income
const incomePerSec = () => CRITTERS.reduce((a, d) => a + d.income * STAR_MULT[starOf(save.index[d.id]?.count ?? 0)], 0);
function payOffline() {
  const away = Math.min(OFFLINE_CAP_MS, Date.now() - save.lastSeen);
  const earned = Math.floor((away / 1000) * incomePerSec());
  save.lastSeen = Date.now();
  if (earned > 0 && away > 60_000) setTimeout(() => toast(`🌙💤 ➜ ${COIN}+${short(earned)}`, 3200), 600);
  save.coins += earned;
}

// ------------------------------------------------------------------ field events
/** a label per critter at most every 2.5 s, so a wriggling critter does not stack messages */
const lastSaid = new Map<string, number>();
function fresh(uid: number, what: string) {
  const k = uid + what, now = t;
  if (now - (lastSaid.get(k) ?? -9) < 2.5) return false;
  lastSaid.set(k, now);
  return true;
}
function handleEvents() {
  for (const e of field.ev) {
    if (e.kind === "caught") {
      const c = e.c, mult = MUTATIONS.find((m) => m.id === c.mut)?.mult ?? 1;
      // every catch goes straight into the book: a new species is celebrated, a repeat makes it stronger
      const isNew = !rush && !save.index[c.def.id];
      if (!rush) { const en = (save.index[c.def.id] ??= { count: 0, muts: [] }); en.count++; if (c.mut && !en.muts.includes(c.mut)) en.muts.push(c.mut); }
      // quick catches in a row build a chain: each link adds a quarter more coins
      combo = t - lastCatch < 1.7 ? combo + 1 : 1;
      lastCatch = t;
      const airborne = (c.launch ?? 0) > 0;
      let coins = Math.round(catchCoins(c.def.income, mult) * (1 + (combo - 1) * 0.25) * (rush ? 1 : valueMult(save.up)) * (airborne ? 2 : 1));
      if (airborne) view.text(field.nozzle.x + 50 * field.kid.face, field.nozzle.y - 100, "🔥×2", "#ff9a3a", 22);
      if (c.boss > 0) coins += Math.round(c.def.income * 60);
      if (rush) rush.score += coins; else { save.coins += coins; save.catches++; }
      if (combo >= 3) view.text(field.nozzle.x + 70 * field.kid.face, field.nozzle.y - 70, `🔥×${combo}`, combo >= 6 ? "#ff7ad1" : "#7cf29a", 16 + Math.min(10, combo));
      if (c.boss > 0 && nextGiant().biome === field.biome) { save.giantWins = (save.giantWins ?? 0) + 1; save.charge = 0; }
      if (c.boss > 0 && !(save.restored ??= []).includes(field.biome)) {
        // the giant was Gloom's: the colour floods back into this place, for good
        save.restored.push(field.biome);
        const nb = BIOMES[BIOMES.findIndex((b) => b.id === field.biome) + 1];
        if (nb && nb.id !== "lab" && !save.biomes.includes(nb.id)) {
          save.biomes.push(nb.id); save.biome = nb.id;
          setTimeout(() => { toast(`🔓 ${nb.icon} 🎉`, 3200); sfx.reveal("epic"); }, 3400);
        }
        writeSave(save); mapKey = "";
        view.gloomFlee = 0.01; colourTarget = 1;
        setTimeout(() => { sfx.reveal("legendary"); view.shake = 10; }, 700);
      }
      if (c.boss > 0) {
        // the big moment: POP, a burst of light and a rain of coins, then the kid burps
        sfx.pop(); view.shake = 18;
        const sk = SKINS[(save.giantWins ?? 0)];
        if (sk && !rush) { save.skin = sk.id; setTimeout(() => toast(`${sk.icon} 🌀 ✔`, 2600), 2600); }
        for (let i = 0; i < 4; i++) setTimeout(() => view.burst(field.nozzle.x + (Math.random() - 0.5) * 60, field.nozzle.y - Math.random() * 40, ["#ffe066", "#ff7ad1", "#7be495", "#5bc8ff"][i], 30), i * 90);
        flyCoins(field.nozzle.x, field.nozzle.y, 14);
        setTimeout(() => { sfx.burp(); view.cheer = 1.6; view.shake = 6; view.text(field.nozzle.x - 40 * field.kid.face, field.nozzle.y - 70, "💨", "#ffffff", 34); }, 900);
        setTimeout(() => sfx.reveal("legendary"), 1400);
        // after the celebration: on to where the next giant waits (a natural moment for a break);
        // the Moon itself is the end of the road and gets its own big moment first
        const theEnd = field.biome === "moon" && !save.tips.includes("moonDone");
        if (theEnd) { save.tips.push("moonDone"); setTimeout(() => void moonFinale(), 3600); }
        else setTimeout(() => void nextPlace(), 4200);
      }
      if (c.boss > 0 || c.mut || c.def.rarity === "epic" || c.def.rarity === "legendary") view.cheer = 1.2;
      sfx.catchPop(combo, c.def.rarity);
      view.burst(field.nozzle.x, field.nozzle.y, c.mut === "gold" ? "#ffd84a" : RARITY_COLOR[c.def.rarity], c.def.rarity === "common" && !c.mut ? 10 : 24);
      view.text(field.nozzle.x + 40 * field.kid.face, field.nozzle.y - 34 - (save.catches % 2) * 22, `+🪙${short(coins)}`, "#ffe066", 17);
      if (!rush) flyCoins(field.nozzle.x, field.nozzle.y, Math.min(4, 1 + Math.floor(Math.log10(coins + 1))));
      // every catch also pushes the giant bar a little, right away
      if (!rush && c.boss === 0) {
        const add = ({ common: 0.06, rare: 0.12, epic: 0.25, legendary: 0.5, secret: 0.5 } as const)[c.def.rarity] * (c.mut ? 2 : 1);
        const before = Math.floor(save.charge ?? 0);
        save.charge = (save.charge ?? 0) + add;
        sparkToBar(field.nozzle.x, field.nozzle.y, Math.floor(save.charge) > before);
      }
      // a new species gets its big moment, unless a giant fight is on (then it slips into the book quietly)
      if (isNew && !field.critters.some((k) => k.boss > 0 && k.state !== "caught") && c.boss === 0) { celebrating.add(c.def.id); void celebrate([c.def.id]); }
      else if (isNew) { const bb = $("bookBtn"); bb.classList.remove("got"); void bb.offsetWidth; bb.classList.add("got"); }
      if (c.mut || c.def.rarity === "epic" || c.def.rarity === "legendary") { view.shake = 8; sfx.reveal(c.def.rarity === "legendary" ? "legendary" : "epic"); }
      if (isNew) sfx.newFish();
    } else if (e.kind === "tug") {
      if (!fresh(e.c.uid, "tug")) continue;
      sfx.turn();
      view.text(Math.min(view.W - 80, Math.max(80, e.c.x)), e.c.y - 95, e.c.mut === "gold" ? "✨👆⏺💪" : "👆⏺💪", "#ffe066", 16);
    } else if (e.kind === "escape") {
      if (!fresh(e.c.uid, "esc")) continue;
      view.text(e.c.x, e.c.y - 40, "💨", "#ffffff", 14); sfx.snap();
    } else if (e.kind === "full") {
      $("parkBtn").classList.add("pulse");
    } else if (e.kind === "surprise") {
      sfx.event(); view.shake = 4;
      // surprises speak for themselves on the field: only a sound, and a shake for the giant
      if (e.s === "boss") { view.shake = 10; sfx.rumble(); } else sfx.event();
    } else if (e.kind === "bubbled") {
      sfx.boing(); view.text(e.c.x, e.c.y - 80, "🫧", "#bfefff", 15);
    } else if (e.kind === "ability") {
      sfx.event(); view.text(field.left + 40, field.nearY - 90, e.id === "sunpup" ? "🐕💨" : "❄️❄️", "#ffe066", 17);
      if (e.id === "frostking") view.burst(field.nozzle.x + 120, field.nearY - 60, "#bfefff", 30, 260);
    } else if (e.kind === "split") {
      view.burst(e.c.x, e.c.y - 30, "#7fd3ff", 14, 140); view.text(e.c.x, e.c.y - 70, "✌️", "#9be7ff", 15); sfx.boing();
    } else if (e.kind === "hide") {
      sfx.bonk();
      // (no tip messages: the critter's behaviour shows on the field)
    } else if (e.kind === "flee") {
      // (no tip message)
    } else if (e.kind === "tease") {
      // the first meeting: the giant laughs you off. The bar flashes: you are too weak, for now
      view.shake = 12; sfx.boing(); view.text(e.c.x, e.c.y - 170, "😂", "#ffffff", 40);
      const fh = $("fieldHead"); fh.classList.remove("nope"); void fh.offsetWidth; fh.classList.add("nope");
      if (!save.tips.includes("intro")) { save.tips.push("intro"); writeSave(save); }
    } else if (e.kind === "erupt") {
      view.shake = 9; sfx.boing();
      for (let i = 0; i < 5; i++) view.burst(field.left + 60 + Math.random() * (field.right - field.left - 120), field.nearY - Math.random() * 60, "#ff7a2a", 16, 180);
    } else if (e.kind === "bossPhase") {
      slowT = 0.45;
      view.shake = 12; sfx.snap(); view.burst(e.c.x, e.c.y - 60, "#ffd84a", 30, 220);
      view.text(e.c.x, e.c.y - 110, `👑 ${"❤️".repeat(e.c.boss)}`, "#ffe066", 17);
    } else if (e.kind === "spawn" && e.c.mut) {
      // a mutated one arrives: make sure the player notices it
      view.burst(e.c.x, e.c.y - 30, e.c.mut === "gold" ? "#ffd84a" : "#c9a7ff", 16, 120);
    }
  }
  field.ev.length = 0;
}

// ------------------------------------------------------------------ tools and companions
type Tool = Field["tool"];
const TOOL_ICON: Record<Tool, string> = { vac: "🌀", bubble: "🫧", flute: "🎵" };
/** tools grow with you: the bubble wand after 15 catches, the flute with the forest */
/** only the vacuum: extra tools were cut, the game is about one clear thing */
const toolsOwned = (): Tool[] => ["vac"];
let toolsKey = "";
function renderTools() {
  const own = toolsOwned();
  for (const tl of own) {
    if (tl === "vac" || save.tips.includes("tool_" + tl)) continue;
    save.tips.push("tool_" + tl);
    setTimeout(() => { toast(tl === "bubble" ? "🔓🫧 · 👆 ➜ 🫧 ➜ 🌀" : "🔓🎵 · 👆⏺ ➜ 🐾🐾 ➜ 🌀", 4200); sfx.reveal("epic"); }, 600);
  }
  const key = own.join() + field.tool + Math.floor(field.charges);
  if (key === toolsKey) return;
  toolsKey = key;
  const box = $("tools");
  box.classList.toggle("hidden", own.length < 2 || mode !== "field");
  box.innerHTML = "";
  for (const tl of own) {
    const b = document.createElement("button");
    b.className = "btn tool" + (field.tool === tl ? " on" : "");
    b.innerHTML = TOOL_ICON[tl] + (tl === "bubble" ? `<small>${Math.floor(field.charges)}</small>` : "");
    b.dataset.tool = tl;
    b.onpointerdown = (ev) => { ev.stopPropagation(); field.tool = tl; if (!save.tips.includes("used_" + tl)) save.tips.push("used_" + tl); sfx.tap(); toolsKey = ""; renderTools(); };
    box.appendChild(b);
  }
}
/** the lab: with 3 of each parent, 2 of each go in and a lab egg comes out */
function fuse(id: string) {
  const rc = RECIPES.find((r) => r.hybrid === id)!;
  const A = CRITTER_BY_ID[rc.a], B = CRITTER_BY_ID[rc.b];
  if ((save.index[rc.a]?.count ?? 0) < 3 || (save.index[rc.b]?.count ?? 0) < 3) { toast(`${ic(A.id)}×3 + ${ic(B.id)}×3`, 2600); sfx.tap(); return; }
  // two of each go into the machine, the hybrid comes straight out
  save.index[rc.a].count -= 2; save.index[rc.b].count -= 2;
  const fresh = !save.index[rc.hybrid];
  (save.index[rc.hybrid] ??= { count: 0, muts: [] }).count++;
  toast(`${ic(A.id)}×2 + ${ic(B.id)}×2 ➜ ${ic(rc.hybrid)}`, 3000);
  sfx.reveal("epic");
  if (fresh) { closeSheet(); celebrating.add(rc.hybrid); mapKey = ""; updateUi(); void celebrate([rc.hybrid]); }
  writeSave(save); nestKey = ""; gridKey = ""; updateUi();
}

/** the collection as a tidy grid: same-size cards, caught ones in colour with stars and income, the rest as dark silhouettes */
let gridKey = "";
const newIn = new Set<string>();
function renderParkGrid() {
  const list = CRITTERS.filter((d) => d.biome === parkBiome);
  const key = parkBiome + "|" + list.map((d) => `${save.index[d.id]?.count ?? 0}`).join() + "|" + save.companion + "|" + [...newIn].join() + getLang();
  if (key === gridKey) return;
  gridKey = key;
  const box = $("parkGrid");
  box.innerHTML = "";
  for (const d of list) {
    const e = save.index[d.id], star = starOf(e?.count ?? 0);
    const card = document.createElement("div");
    card.className = "pcard" + (e ? " own" : "") + (newIn.has(d.id) ? " got" : "");
    card.style.setProperty("--rc", RARITY_COLOR[d.rarity]);
    if (e) {
      card.innerHTML = `<img src="./art/${d.art}.webp" alt=""><span class="st">${"★".repeat(star)}${"☆".repeat(3 - star)}</span><span class="inc">🪙${Math.round(d.income * STAR_MULT[star])}/s</span><span class="cnt">×${e.count}</span>`;
    } else {
      card.innerHTML = `<img class="sil" src="./art/${d.art}.webp" alt=""><span class="st">?</span>`;
      const rc = RECIPES.find((r) => r.hybrid === d.id);
      if (rc) {
        // a lab recipe: both parents and how many you have of each (3 needed)
        const part = (pid: string) => { const have = save.index[pid]?.count ?? 0; return `<span class="par${have >= 3 ? " ok" : ""}"><img src="./art/${CRITTER_BY_ID[pid].art}.webp" class="${have ? "" : "sil"}" alt="">${Math.min(have, 3)}/3</span>`; };
        card.insertAdjacentHTML("beforeend", `<div class="rec">${part(rc.a)}${part(rc.b)}</div>`);
        const ok = (save.index[rc.a]?.count ?? 0) >= 3 && (save.index[rc.b]?.count ?? 0) >= 3;
        const b = document.createElement("button");
        b.className = "btn fuse"; b.textContent = "🧪"; b.disabled = !ok;
        b.onclick = () => fuse(d.id);
        card.appendChild(b);
      }
    }
    box.appendChild(card);
  }
}

// ------------------------------------------------------------------ rush: the 60-second race you can send to a friend
let lastRush: { seed: number; score: number } | null = null;
async function startRush(seed: number, goal: number | null) {
  if (busy) return;
  busy = true;
  if (save.catches > 0) await commercialBreak();
  busy = false;
  rush = { seed, left: 60, score: 0, goal };
  rushRng = makeRng(seed);
  mode = "rush";
  field = newField(view.W, view.H, RUSH_UP, save.biome);
  field.script = 2;
  for (let i = 0; i < 7; i++) spawn(field, rushRng);
  $("result").classList.add("hidden");

  gameplayStart();
  updateUi();
}
function endRush() {
  if (!rush) return;
  const r = rush;
  rush = null;
  input.on = false;
  gameplayStop();
  const best = Math.max(save.rushBest ?? 0, r.score);
  save.rushBest = best;
  const won = r.goal !== null && r.score > r.goal;
  const prize = Math.round(incomePerSec() * 30 + 200) * (won ? 3 : 1);
  save.coins += prize;
  lastRush = { seed: r.seed, score: r.score };
  writeSave(save);
  $("resTitle").textContent = r.goal === null ? (r.score >= best ? "🏁 🏆✨" : "🏁") : won ? "🏆🎉" : "😅";
  // you against the friend (or your best): two bars side by side say who won at a glance
  const other = r.goal ?? best, top = Math.max(1, r.score, other);
  const bar = (who: string, n: number, cls: string) => `<div class="vs ${cls}"><span>${who}</span><i style="width:${Math.max(4, Math.round((n / top) * 100))}%"></i><b>${n.toLocaleString()}</b></div>`;
  $("resBody").innerHTML = bar("🙂", r.score, "me") + bar(r.goal !== null ? "🤝" : "🏆", other, "them") + `<div class="prize">${COIN} +${short(prize)}</div>`;
  $("result").classList.remove("hidden");
  // a record or a win: this is the moment to send it to a friend
  $("resShare").classList.toggle("pulse", r.score >= best || won);
  sfx.reveal(won || r.goal === null ? "epic" : "rare");
  mode = "field";
  field = newField(view.W, view.H, save.up, save.biome); field.script = 2;
  for (let i = 0; i < 5; i++) spawn(field, rng);
  updateUi();
}
async function shareRush() {
  if (!lastRush) return;
  const url = await shareURL({ cvr: String(lastRush.seed), cvs: String(lastRush.score) });
  const text = tf("shareText", { n: lastRush.score.toLocaleString() });
  try { if (navigator.share) { await navigator.share({ text, url }); return; } } catch { /* cancelled */ }
  try { await navigator.clipboard.writeText(`${text} ${url}`); toast("📋 ✔", 2400); } catch { toast(url, 6000); }
}
/** arriving from a friend's link: offer their race */
function offerRush() {
  const seed = parseInt(urlParam("cvr"), 10), score = parseInt(urlParam("cvs"), 10);
  if (!(seed > 0) || !(score >= 0)) return;
  $("resTitle").textContent = "🤝 🏁";
  $("resBody").innerHTML = `<div class="vs them"><span>🤝</span><i style="width:100%"></i><b>${score.toLocaleString()}</b></div><div class="vs me"><span>🙂</span><i style="width:4%"></i><b>?</b></div><div class="prize">⏱60 · 🎯</div>`;
  shareIsPlay = true; applyLang();
  $("resShare").onclick = () => { shareIsPlay = false; applyLang(); $("resShare").onclick = () => void shareRush(); void startRush(seed, score); };
  $("result").classList.remove("hidden");
}

/** after a giant: the field moves to where the next giant waits */
async function nextPlace() {
  if (mode !== "field") return;
  const ng = nextGiant();
  const fromI = BIOMES.findIndex((b) => b.id === field.biome);
  void ng; syncRoad();
  busy = true;
  await commercialBreak();
  const toI = BIOMES.findIndex((b) => b.id === save.biome);
  if (toI !== fromI) await showJourney(fromI, toI);
  busy = false;
  field = newField(view.W, view.H, save.up, save.biome); field.script = 2;
  for (let i = 0; i < 5; i++) spawn(field, rng);
  colourTarget = (save.restored ?? []).includes(save.biome) ? 1 : 0; view.colour = colourTarget;
  writeSave(save); updateUi();
}
/** the journey: a road of every place with its giant, the kid walking from the last place to the new one,
 *  and the Moon waiting at the end. Shown at the very start and whenever a new place opens. No words. */
async function showJourney(from: number, to: number) {
  const box = $("journey");
  const places = BIOMES;
  box.innerHTML = `<div class="road">${places.map((b, i) => {
    const g = GIANTS.find((x) => x.biome === b.id), done = (save.restored ?? []).includes(b.id);
    return `<div class="stop${i <= to ? " on" : ""}${i === places.length - 1 ? " goal" : ""}"><span class="pi">${b.icon}</span>${g ? `<img class="gg${done ? " done" : ""}" src="./art/${CRITTER_BY_ID[g.id].art}.webp" alt="">` : ""}${done ? "<i>✔</i>" : ""}</div>`;
  }).join('<b class="dots"></b>')}</div><img class="walker" src="./art/kid_vac.webp" alt="">`;
  box.classList.remove("hidden");
  const stops = box.querySelectorAll<HTMLElement>(".stop"), walker = box.querySelector<HTMLElement>(".walker")!;
  const at = (i: number) => { const r = stops[Math.max(0, Math.min(stops.length - 1, i))].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top }; };
  const a = at(from), b = at(to);
  walker.style.left = `${a.x}px`; walker.style.top = `${a.y}px`;
  await new Promise((r) => setTimeout(r, 450));
  walker.style.transition = "left 1.1s ease-in-out, top 1.1s ease-in-out";
  walker.style.left = `${b.x}px`; walker.style.top = `${b.y}px`;
  sfx.event();
  await new Promise((r) => setTimeout(r, 1900));
  box.classList.add("hidden");
}

/** the end of the road: you sucked up the Moon. A trophy moment, a share button, then the giants come back stronger. */
async function moonFinale() {
  const box = $("finale");
  box.innerHTML = `<div class="rays"></div><img class="moon" src="./art/bigmoon.webp" alt=""><img class="kid" src="./art/kid_cheer.webp" alt=""><div class="trophy">🏆</div><div class="row"><button class="btn big rush" id="finShare">📤 🌙</button><button class="btn big go" id="finGo">★2 ▶</button></div>`;
  box.classList.remove("hidden");
  sfx.reveal("legendary"); setTimeout(() => sfx.event(), 600);
  for (let i = 0; i < 30; i++) setTimeout(() => { const s = document.createElement("i"); s.className = "confetti"; s.style.left = `${Math.random() * 100}%`; s.style.background = ["#ffe066", "#ff7ad1", "#7be495", "#5bc8ff"][i % 4]; box.appendChild(s); setTimeout(() => s.remove(), 2600); }, i * 60);
  $("finShare").onclick = async () => {
    const url = await shareURL({});
    try { if (navigator.share) { await navigator.share({ text: "🫙🌙 I vacuumed up the MOON in Critter Vac! Can you?", url }); return; } } catch { /* cancelled */ }
    try { await navigator.clipboard.writeText(`🫙🌙 I vacuumed up the MOON in Critter Vac! ${url}`); toast("📋 ✔", 2000); } catch { /* nothing */ }
  };
  await new Promise<void>((r) => { $("finGo").onclick = () => r(); });
  box.classList.add("hidden");
  await nextPlace();
}

/** coins fly from the nozzle up to the coin counter: you see where the money goes */
function flyCoins(wx: number, wy: number, n: number) {
  const target = $("coinIco").getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const c = document.createElement("img");
    c.src = "./art/coin.webp"; c.className = "flycoin";
    const x0 = wx * view.scale + (Math.random() - 0.5) * 30, y0 = wy * view.scale + (Math.random() - 0.5) * 20;
    c.style.left = `${x0}px`; c.style.top = `${y0}px`;
    document.body.appendChild(c);
    setTimeout(() => requestAnimationFrame(() => { c.style.transform = `translate(${target.left - x0}px, ${target.top - y0}px) scale(.7)`; c.style.opacity = "0.5"; }), i * 70);
    setTimeout(() => { c.remove(); const k = $("coinIco"); k.classList.remove("bump"); void k.offsetWidth; k.classList.add("bump"); if (i === 0) sfx.coinTick(n); }, 900 + i * 70);
  }
}
/** the three upgrades, always at the bottom of the screen: what it is, how far it is, what the next step costs */
let upBarKey = "";
function renderUpBar() {
  const key = UPGRADE_ORDER.map((id) => `${save.up[id]}${(upgradeCost(save.up, id) ?? 1e99) <= save.coins}`).join() + mode;
  if (key === upBarKey) return;
  upBarKey = key;
  const box = $("upBar");
  box.innerHTML = "";
  for (const id of UPGRADE_ORDER) {
    const c = upgradeCost(save.up, id), ok = c !== null && c <= save.coins;
    const b = document.createElement("button");
    b.className = "upb" + (ok ? " ok" : "");
    b.dataset.up = id;
    const icon = id !== "range" ? UPGRADES[id].icon : save.up.range >= MOUTH_FULL ? "🌪️💰" : save.up.range >= REACH_FULL ? "🌪️" : "📏";
    b.innerHTML = `<span class="ui">${icon}</span><span class="uc">${c === null ? "MAX" : `${COIN}${short(c)}`}</span><i class="lvl" style="width:${Math.min(100, (save.up[id] / UPGRADES[id].max) * 100)}%"></i>`;
    b.onpointerdown = (ev) => { ev.stopPropagation(); };
    b.onclick = () => { buy(id); b.classList.add("bought"); flyUp(b); };
    box.appendChild(b);
  }
}
/** a catch sends a small spark to the giant bar; when it adds a whole point the number pops */
function sparkToBar(wx: number, wy: number, point: boolean) {
  const g = document.querySelector("#fieldHead .gbar");
  if (!g) return;
  const b = g.getBoundingClientRect(), x0 = wx * view.scale, y0 = wy * view.scale;
  const s = document.createElement("div");
  s.className = "spark small"; s.textContent = "✦";
  s.style.left = `${x0}px`; s.style.top = `${y0}px`;
  document.body.appendChild(s);
  requestAnimationFrame(() => requestAnimationFrame(() => { s.style.transform = `translate(${b.left + b.width * 0.85 - x0}px, ${b.top + b.height / 2 - y0}px) scale(.7)`; }));
  setTimeout(() => {
    s.remove(); updateUi();
    if (point) { const m = document.querySelector("#fieldHead .me"); m?.classList.remove("plus"); void (m as HTMLElement | null)?.offsetWidth; m?.classList.add("plus"); }
  }, 600);
}
/** a bought upgrade sends a spark up to the giant gauge: the bar is what the coins are for */
function flyUp(from: HTMLElement) {
  const g = document.querySelector("#fieldHead .gbar");
  if (!g) return;
  const a = from.getBoundingClientRect(), b = g.getBoundingClientRect();
  const s = document.createElement("div");
  s.className = "spark"; s.textContent = "🌀";
  s.style.left = `${a.left + a.width / 2}px`; s.style.top = `${a.top}px`;
  document.body.appendChild(s);
  requestAnimationFrame(() => requestAnimationFrame(() => { s.style.transform = `translate(${b.left + b.width * 0.8 - a.left - a.width / 2}px, ${b.top - a.top}px) scale(.6)`; }));
  setTimeout(() => s.remove(), 700);
}
/** the book: your collection by place, just to look at */
function openBook(b: BiomeId = save.biome) {
  sheet = b as Plot; parkBiome = b; gridKey = "";
  const tabs = save.biomes.map((id) => { const bi = BIOMES.find((x) => x.id === id)!; const got = CRITTERS.filter((d) => d.biome === id && save.index[d.id]).length, all = CRITTERS.filter((d) => d.biome === id).length; return `<button class="btn tab${id === b ? " on" : ""}" data-b="${id}">${bi.icon} ${got}/${all}</button>`; }).join("");
  // the styles you have won: one per giant beaten
  const won = Math.min(SKINS.length, 1 + (save.giantWins ?? 0));
  const skins = SKINS.map((k, i) => `<button class="skin${i >= won ? " locked" : ""}${(save.skin ?? "air") === k.id ? " on" : ""}" data-skin="${k.id}" style="--sk:rgb(${k.fill})">${i < won ? k.icon : "🔒"}</button>`).join("");
  $("shTitle").innerHTML = `<div class="skins">${skins}</div><div class="tabs">${tabs}</div>`;
  for (const el of $("shTitle").querySelectorAll<HTMLElement>("[data-skin]")) el.onclick = () => { if (el.classList.contains("locked")) { sfx.nope(); return; } save.skin = el.dataset.skin; writeSave(save); sfx.tap(); openBook(b); };
  for (const el of $("shTitle").querySelectorAll<HTMLElement>("[data-b]")) el.onclick = () => openBook(el.dataset.b as BiomeId);
  $("shHunt").classList.add("hidden");
  $("parkGrid").classList.remove("hidden"); $("nest").classList.add("hidden"); $("ups").classList.add("hidden");
  $("sheet").classList.remove("hidden");
  input.on = false;
  renderParkGrid();
}
$("bookBtn").onclick = () => openBook();
$("lureBtn2").onclick = () => void lure();
$("rushBtn2").onclick = () => void startRush(1 + Math.floor(Math.random() * 999_983), null);

// ------------------------------------------------------------------ the park
async function goPark() {
  if (busy || mode === "park") return;
  busy = true;
  input.on = false;
  mode = "park";
  // the jar empties onto the pedestals: each critter earns from now on
  const brought = jar.length;
  const brandNew = [...new Set(jar.map((j) => j.id))].filter((id) => !save.index[id]);
  parkBiome = save.biome;
  newIn.clear();
  for (const j of jar) newIn.add(j.id);
  setTimeout(() => { newIn.clear(); gridKey = ""; }, 2500);
  for (const j of jar) {
    const e = (save.index[j.id] ??= { count: 0, muts: [] });
    e.count++;
    if (j.mut && !e.muts.includes(j.mut)) e.muts.push(j.mut);
  }
  jar = []; field.jar = 0;
  writeSave(save);
  $("parkBtn").classList.remove("pulse");
  if (brought) { sfx.reveal("rare"); jarSounds(brought); }
  gameplayStop();
  busy = false;
  for (const id of brandNew) celebrating.add(id);
  mapKey = "";
  updateUi();
  void celebrate(brandNew);
}

async function goField() {
  if (busy || mode === "field") return;
  busy = true;
  // the natural break between rounds: Poki decides whether an ad plays
  await commercialBreak();
  mode = "field";
  // a giant that is ready to fight: that is where we go
  syncRoad();
  field = newField(view.W, view.H, save.up, save.biome);
  field.script = 2; // the tutorial moments only happen once per visit... first visit keeps them
  for (let i = 0; i < 5; i++) spawn(field, rng);
  busy = false;
  gameplayStart();
  updateUi();
}

async function lure() {
  if (busy) return;
  busy = true;
  const ok = await rewardedBreak();
  busy = false;
  if (!ok) return;
  field.lure += 3;
  view.burst(field.nozzle.x, field.nozzle.y - 40, "#ffd84a", 30);
  sfx.reveal("epic");
}

function buy(id: UpgradeId) {
  const cost = upgradeCost(save.up, id);
  if (cost === null) return;
  if (cost > save.coins) { sfx.nope(); return; }
  save.coins -= cost; save.up[id]++;
  sfx.buy(); writeSave(save); updateUi();
  { const m = document.querySelector("#fieldHead .me"); m?.classList.remove("plus"); void (m as HTMLElement | null)?.offsetWidth; m?.classList.add("plus"); }
}

/** the nest in the park: eggs count down in real time; a ready one hatches on tap, a waiting one can be hurried with a video */
let nestKey = "";
function renderNest() {
  const now = Date.now();
  const key = save.nest.map((e) => `${e.tier}${Math.max(0, Math.ceil((e.readyAt - now) / 1000))}`).join() + mode;
  if (key === nestKey) return;
  nestKey = key;
  const box = $("nest");
  box.innerHTML = "";
  save.nest.forEach((e, i) => {
    const left = e.readyAt - now, ready = left <= 0;
    const b = document.createElement("button");
    b.className = "btn egg" + (ready ? " ready" : "");
    const mm = Math.floor(left / 60_000), ss = Math.floor((left % 60_000) / 1000);
    b.innerHTML = `<img src="./art/${EGG_ART[e.tier]}.webp" alt=""><span>${ready ? "🐣!" : `${mm}:${String(ss).padStart(2, "0")} 🎬`}</span>`;
    b.onclick = async () => {
      if (busy) return;
      if (!ready) { busy = true; const ok = await rewardedBreak(); busy = false; if (!ok) return; }
      closeSheet();
      hatchEgg(i);
    };
    box.appendChild(b);
  });
}
function hatchEgg(i: number) {
  const e = save.nest[i];
  if (!e) return;
  save.nest.splice(i, 1);
  const { def, mut } = hatch(e, rng);
  const isNew = !save.index[def.id];
  const entry = (save.index[def.id] ??= { count: 0, muts: [] });
  entry.count++;
  if (mut && !entry.muts.includes(mut)) entry.muts.push(mut);
  parkBiome = def.biome; mapKey = "";
  newIn.clear(); newIn.add(def.id); gridKey = "";
  setTimeout(() => { newIn.clear(); gridKey = ""; }, 2500);
  sfx.reveal(def.rarity === "legendary" ? "legendary" : def.rarity === "epic" ? "epic" : "rare");
  toast(`🐣 ${mut === "gold" ? "✨" : ""}${ic(def.id)}${mut === "gold" ? "✨" : ""}${isNew ? " 🆕" : ""}`, 2800);
  writeSave(save); nestKey = ""; updateUi();
}

/** a happy little coin sound for each critter landing on its pedestal */
function jarSounds(n: number) { for (let i = 0; i < Math.min(n, 12); i++) setTimeout(() => sfx.coin(i), 450 + i * 120); }

/** the park as a little place: one fenced pen per region with its critters living inside, a lab, a nest and a workshop.
 *  Locked pens show what they cost and how close you are. Tapping a building opens its page. */
type Plot = BiomeId | "nest" | "shop";
/** what the park shows: the places, the workshop, and the lab once the first giant is caught */
const plotsNow = (): Plot[] => labOpen() ? ["meadow", "forest", "frost", "lab", "shop"] : ["meadow", "forest", "frost", "shop"];
let mapKey = "", sheet: Plot | null = null;
const plotEls: Partial<Record<Plot, HTMLElement>> = {};
const labOpen = () => false; // the lab was cut: it added a system without a clear need
function plotIncome(p: Plot) { return CRITTERS.filter((d) => d.biome === p).reduce((a, d) => a + d.income * STAR_MULT[starOf(save.index[d.id]?.count ?? 0)], 0); }
/** coins shown as a little stack of coin icons: 1 to 5, growing with the pen's income */
const coinStack = (inc: number) => inc <= 0 ? "" : `<span class="stack">${'<img src="./art/coin.webp" alt="">'.repeat(Math.max(1, Math.min(5, Math.ceil(Math.log10(inc + 1) * 1.6))))}</span>`;
function renderMap() {
  const now = Date.now();
  const canBuy = UPGRADE_ORDER.some((id) => { const c = upgradeCost(save.up, id); return c !== null && c <= save.coins; });
  const upKey = UPGRADE_ORDER.map((id) => save.up[id] + "" + ((upgradeCost(save.up, id) ?? 1e99) <= save.coins)).join();
  const key = [getLang(), save.biomes.join(), save.biome, save.companion, Object.entries(save.index).map(([k, v]) => k + v.count).join(),
    save.nest.map((e) => e.tier + Math.ceil((e.readyAt - now) / 60_000)).join(), upKey, labOpen(), barPower(), (save.restored ?? []).join(), [...newIn].join()].join("|");
  if (key === mapKey) return;
  mapKey = key;
  const box = $("parkMap");
  box.innerHTML = "";
  const plots = plotsNow();
  box.className = `n${plots.length}`;
  for (const p of plots) {
    const el = document.createElement("div");
    el.className = `plot p-${p}`;
    plotEls[p] = el;
    const bi = BIOMES.find((b) => b.id === p);
    if (bi) {
      const owned = save.biomes.includes(bi.id);
      const list = CRITTERS.filter((d) => d.biome === bi.id);
      const got = list.filter((d) => save.index[d.id]).length;
      if (!owned) {
        // a fenced empty plot waiting to be built: what it costs and how close you are
        // the giant of the place before guards the way in
        const prev = GIANTS[BIOMES.findIndex((b) => b.id === bi.id) - 1];
        el.classList.add("locked");
        el.innerHTML = `<div class="sign">🔒 ${bi.icon}</div><div class="lockMid">${prev ? giantImg(prev.id, "big") : "🔒"}</div>${prev ? gauge(prev) : ""}`;
      } else {
        // the pen: every species has its own spot, caught ones live there, empty spots wait with a "?"
        const spots = list.map((d, i) => {
          const e = save.index[d.id];
          if (!e) return `<span class="spot empty">?</span>`;
          const st = starOf(e.count);
          return `<span class="spot${newIn.has(d.id) ? " got" : ""}${celebrating.has(d.id) ? " wait" : ""}" data-id="${d.id}" style="--d:${(i * 0.37) % 1.6}s;--rc:${RARITY_COLOR[d.rarity]}"><img src="./art/${d.art}.webp" alt="">${st ? `<i class="stars">${"★".repeat(st)}</i>` : ""}</span>`;
        }).join("");
        const inc = plotIncome(bi.id);
        const gl = giantLeft(bi.id), gd = giantOf(bi.id);
        el.innerHTML = `${gd ? `<div class="trophy${gl ? " todo" : ""}">${giantImg(gd.id)}${gl ? "" : "<i>👑</i>"}</div>` : ""}<div class="sign">${bi.icon} <small>${got}/${list.length}</small></div><div class="pen">${spots}</div><div class="earn">${coinStack(inc)}<b>${short(inc)}/s</b></div>${save.biome === bi.id ? '<div class="here">🫙</div>' : ""}`;
      }
    } else if (p === "lab") {
      const made = CRITTERS.filter((d) => d.biome === "lab" && save.index[d.id]);
      const can = RECIPES.filter((r) => (save.index[r.a]?.count ?? 0) >= 3 && (save.index[r.b]?.count ?? 0) >= 3).length;
      if (!labOpen()) {
        el.classList.add("locked");
        el.innerHTML = `<div class="sign">🧪</div><div class="lockMid">🧪</div><div class="price">📖 ${Object.keys(save.index).length}/6</div><div class="prog"><i style="width:${Math.round(Object.keys(save.index).length / 6 * 100)}%"></i></div>`;
      } else {
        const ready = (r: (typeof RECIPES)[number]) => (save.index[r.a]?.count ?? 0) >= 3 && (save.index[r.b]?.count ?? 0) >= 3;
        const r0 = RECIPES.find(ready) ?? RECIPES.find((r) => !save.index[r.hybrid]) ?? RECIPES[0];
        const ic = (id: string, sil = false) => `<img src="./art/${CRITTER_BY_ID[id].art}.webp" class="${sil ? "sil" : ""}" alt="">`;
        el.innerHTML = `<div class="sign">🧪 <small>${made.length}/${RECIPES.length}</small></div><div class="formula">${ic(r0.a, !save.index[r0.a])}<b>+</b>${ic(r0.b, !save.index[r0.b])}<b>=</b>${ic(r0.hybrid, !save.index[r0.hybrid])}</div>${can ? `<div class="badge">${can}</div>` : ""}`;
      }
    } else if (p === "nest") {
      const slots = Array.from({ length: NEST_SLOTS }, (_, i) => {
        const e = save.nest[i];
        if (!e) return `<span class="eslot"></span>`;
        const ready = now >= e.readyAt, left = e.readyAt - now;
        return `<button class="eslot${ready ? " ready" : ""}" data-egg="${i}"><img src="./art/${EGG_ART[e.tier]}.webp" alt=""><small>${ready ? "🐣" : `⏱${Math.ceil(left / 60_000)}′ 🎬`}</small></button>`;
      }).join("");
      const ready = save.nest.filter((e) => now >= e.readyAt).length;
      el.innerHTML = `<div class="sign">🥚 <small>${save.nest.length}/${NEST_SLOTS}</small></div><div class="eggs">${slots}</div>${ready ? `<div class="badge">🐣</div>` : ""}`;
    } else {
      // each upgrade is a row: what it is, how far it has grown, and what the next step costs
      const rows = UPGRADE_ORDER.map((id) => {
        const c = upgradeCost(save.up, id), ok = c !== null && c <= save.coins;
        return `<button class="uprow${ok ? " ok" : ""}" data-up="${id}"><span class="ui">${UPGRADES[id].icon}</span><span class="lv"><i style="width:${Math.min(100, 8 + save.up[id] * 6)}%"></i><em>${UP_LABEL[id](save.up[id])}</em></span><span class="uc">${c === null ? "MAX" : COIN + short(c)}</span></button>`;
      }).join("");
      const ng = nextGiant();
      el.innerHTML = `<div class="sign">🔧</div>${ng ? gauge(ng) : ""}<div class="shop">${rows}</div>`;
    }
    el.onclick = (ev) => {
      const tgt = (ev.target as HTMLElement).closest("button");
      if (tgt?.dataset.up) { buy(tgt.dataset.up as UpgradeId); tgt.classList.add("bought"); return; }
      if (tgt?.dataset.egg) { void tapEgg(+tgt.dataset.egg); return; }
      if (p === "shop" || p === "nest") return;
      tapPlot(p);
    };
    box.appendChild(el);
  }
}
function tapPlot(p: Plot) {
  const bi = BIOMES.find((b) => b.id === p);
  if (bi && !save.biomes.includes(bi.id)) {
    const g = nextGiant();
    if (g) toast(`${giantImg(g.id)} ➜ 🔓 ${bi.icon}`, 2000);
    sfx.tap(); return;
  }
  if (p === "lab" && !labOpen()) { toast("🧪 📖 6", 1400); sfx.tap(); return; }
  sfx.tap();
  openSheet(p);
}
async function tapEgg(i: number) {
  const e = save.nest[i];
  if (!e || busy) return;
  if (Date.now() < e.readyAt) { busy = true; const ok = await rewardedBreak(); busy = false; if (!ok) return; }
  hatchEgg(i);
}
function openSheet(p: Plot) {
  sheet = p;
  if (p !== "nest" && p !== "shop") parkBiome = p as BiomeId;
  gridKey = ""; nestKey = "";
  const bi = BIOMES.find((b) => b.id === p);
  $("shTitle").textContent = bi ? bi.icon : p === "lab" ? "🧪" : p === "nest" ? "🥚" : "🔧";
  $("shHunt").classList.toggle("hidden", !bi);
  $("shHunt").innerHTML = `<img src="./art/jar.webp" alt=""> ▶`;
  $("parkGrid").classList.toggle("hidden", !(bi || p === "lab"));
  $("nest").classList.toggle("hidden", p !== "nest");
  $("ups").classList.toggle("hidden", p !== "shop");
  $("sheet").classList.remove("hidden");
  updateUi();
}
/** the first catches: a hand shows the move. It goes to the nearest critter, presses and holds there, so
 *  "hold your finger on a critter" is understood without a word. It comes back if the player stops for a while. */
let idleT = 0;
function tutorialHand(dt: number) {
  const h = $("tutHand");
  idleT = input.on ? 0 : idleT + dt;
  const boss = mode === "field" ? field.critters.find((k) => k.boss > 0 && k.state === "roam") : undefined;
  const show = mode === "field" && (save.catches < 3 || !!boss) && idleT > (started ? 2.5 : 0.6) && $("result").classList.contains("hidden") && $("story").classList.contains("hidden");
  const c = show && boss ? boss : show ? field.critters.filter((k) => k.state === "roam" && !k.hidden && k.x > field.left + 20 && k.x < field.right - 20).sort((a, b) => Math.abs(a.x - field.nozzle.x - 160) - Math.abs(b.x - field.nozzle.x - 160))[0] : null;
  if (!c) { h.classList.add("hidden"); return; }
  const p = (t % 2.4) / 2.4;
  const tx = c.x, ty = c.y - c.lift - c.def.size * 0.35;
  const sx = field.nozzle.x + 40, sy = field.nozzle.y + 60;
  const k = Math.min(1, p / 0.35), e = k * k * (3 - 2 * k);
  const x = sx + (tx - sx) * e, y = sy + (ty - sy) * e;
  h.classList.remove("hidden");
  h.classList.toggle("press", p > 0.35 && p < 0.92);
  h.style.opacity = String(p > 0.92 ? (1 - p) / 0.08 : 1);
  h.style.left = `${x * view.scale}px`; h.style.top = `${y * view.scale}px`;
}

/** one bouncing arrow always points at the next useful step: the park when the jar is full,
 *  a place you can now build, an egg ready to hatch, an upgrade you can afford, then back to catching */
function guideTarget(): HTMLElement | null {
  if (!started && mode === "field") return null;
  if (mode === "field") {
    const ngG = nextGiant();
    if (barPower() < ngG.need && save.catches >= 4 && barPower() < 4) { const ok = document.querySelector<HTMLElement>("#upBar .upb.ok"); if (ok) return ok; }
    // a tool you just got and have not tried yet
    for (const tl of toolsOwned()) if (tl !== "vac" && !save.tips.includes("used_" + tl)) return document.querySelector<HTMLElement>(`#tools [data-tool="${tl}"]`);
    return null;
  }
  if (mode !== "park" || sheet || !$("result").classList.contains("hidden")) return null;
  const ng = nextGiant();
  if (ng && barPower() >= ng.need) return $("goBtn");
  if (save.nest.some((e) => Date.now() >= e.readyAt)) return plotEls.nest?.querySelector<HTMLElement>(".eslot.ready") ?? null;
  const up = plotEls.shop?.querySelector<HTMLElement>(".uprow.ok");
  if (up) return up;
  if (save.catches < 80) return $("goBtn");
  return null;
}
function placeGuide() {
  const g = $("guide"), tg = guideTarget();
  if (!tg || !tg.isConnected) { g.classList.add("hidden"); return; }
  const r = tg.getBoundingClientRect();
  g.classList.remove("hidden");
  g.style.left = `${r.left + r.width / 2}px`; g.style.top = `${r.top}px`;
}
function closeSheet() { sheet = null; $("sheet").classList.add("hidden"); }
$("shClose").onclick = closeSheet;
$("sheet").onclick = (e) => { if (e.target === $("sheet")) closeSheet(); };
$("shHunt").onclick = () => { if (sheet && sheet !== "lab" && sheet !== "nest" && sheet !== "shop") { save.biome = sheet; writeSave(save); closeSheet(); void goField(); } };

/** a species seen for the first time gets its moment: it pops up big in a burst of light, then hops into its own spot */
const celebrating = new Set<string>();
async function celebrate(ids: string[]) {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (const id of ids.slice(0, 4)) {
    const d = CRITTER_BY_ID[id];
    const box = document.createElement("div");
    box.className = "newcomer";
    box.style.setProperty("--rc", RARITY_COLOR[d.rarity]);
    box.innerHTML = `<div class="rays"></div><img src="./art/${d.art}.webp" alt=""><b>🆕</b>`;
    document.body.appendChild(box);
    sfx.reveal(d.rarity === "legendary" ? "legendary" : d.rarity === "epic" ? "epic" : "rare");
    await wait(mode === "field" ? 800 : 1100);
    const spot = mode === "field" ? $("bookBtn") : document.querySelector<HTMLElement>(`.spot[data-id="${id}"]`);
    const im = box.querySelector("img")!;
    if (spot) {
      const a = im.getBoundingClientRect(), b = spot.getBoundingClientRect();
      box.classList.add("go");
      im.style.transform = `translate(${b.left + b.width / 2 - (a.left + a.width / 2)}px, ${b.top + b.height / 2 - (a.top + a.height / 2)}px) scale(${Math.max(0.15, b.height / a.height)})`;
      await wait(650);
      celebrating.delete(id);
      spot.classList.remove("wait", "got"); void spot.offsetWidth; spot.classList.add("got");
      sfx.coin(3);
    } else celebrating.delete(id);
    box.remove();
  }
  mapKey = "";
}

/** coins float from each earning pen up to the coin counter, more often the more it earns */
const coinClock: Partial<Record<Plot, number>> = {};
function coinStream(dt: number) {
  if (mode !== "park" || sheet || document.hidden) return;
  const target = $("coinIco").getBoundingClientRect();
  for (const b of BIOMES) {
    const inc = plotIncome(b.id), el = plotEls[b.id];
    if (inc <= 0 || !el || !el.isConnected) continue;
    coinClock[b.id] = (coinClock[b.id] ?? Math.random()) - dt;
    if (coinClock[b.id]! > 0) continue;
    coinClock[b.id] = Math.max(0.35, 2.4 - Math.log10(inc + 1) * 0.5);
    const r = el.getBoundingClientRect();
    const c = document.createElement("img");
    c.src = "./art/coin.webp"; c.className = "flycoin";
    c.style.left = `${r.left + r.width * (0.3 + Math.random() * 0.4)}px`; c.style.top = `${r.top + r.height * 0.5}px`;
    document.body.appendChild(c);
    requestAnimationFrame(() => requestAnimationFrame(() => { c.style.transform = `translate(${target.left - parseFloat(c.style.left)}px, ${target.top - parseFloat(c.style.top)}px) scale(.7)`; c.style.opacity = "0.4"; }));
    setTimeout(() => { c.remove(); $("coinIco").classList.remove("bump"); void $("coinIco").offsetWidth; $("coinIco").classList.add("bump"); }, 900);
  }
}

// ------------------------------------------------------------------ ui
/** whether the result's left button starts a friend's race ("Play!") or shares yours */
let shareIsPlay = false;
/** the fixed labels; the rest is rewritten by updateUi */
function applyLang() {
  $("hint").innerHTML = "";
  $("parkTitle").textContent = "🏡";
  $("lureBtn").textContent = "🎬 ✨";
  $("rushBtn").textContent = tr("rush");
  $("resOk").textContent = "✔";
  $("resShare").textContent = shareIsPlay ? "🏁 ▶" : "📤 🤝";
  $("langTitle").textContent = tr("lang");
  $("langBtn").setAttribute("aria-label", tr("lang"));
  const cur = getLang();
  ($("langFlag") as HTMLImageElement).src = LANG_FLAG[cur];
  for (const b of $("langList").children) (b as HTMLElement).classList.toggle("on", (b as HTMLElement).dataset.lang === cur);
}
let toastT = 0;
/** toasts are little picture lines: a critter's picture, icons and numbers, almost no words */
function toast(html: string, ms = 1800) {
  const el = $("toast"); el.innerHTML = html; el.classList.remove("hidden");
  clearTimeout(toastT); toastT = window.setTimeout(() => el.classList.add("hidden"), ms);
}
/** the giant still standing in a place (null once caught) and the next giant on the road */
/** the giant bar: your vacuum level plus what your catches have added since the last giant */
const barPower = () => vacLevel(save.up) + Math.floor(save.charge ?? 0);
const nextGiant = () => giantStep(save.giantWins ?? 0);
const giantLeft = (b: BiomeId) => { const g = nextGiant(); return g.biome === b ? g : null; };
const giantImg = (id: string, cls = "") => `<img class="gi ${cls}" src="./art/${CRITTER_BY_ID[id].art}.webp" alt="">`;
/** the gauge: your vacuum against a giant. Full = it will come down and fight */
function gauge(g: { id: string; need: number; tier?: number }) {
  const L = barPower(), k = Math.min(1, L / g.need);
  return `<div class="gauge${k >= 1 ? " full" : ""}"><span class="me">🌀<b>${L}</b></span><span class="gbar"><i style="width:${Math.round(k * 100)}%"></i></span><span class="them">${giantImg(g.id)}${(g.tier ?? 1) > 1 ? `<sup>★${g.tier}</sup>` : ""}<b>${g.need}</b></span></div>`;
}
const ic = (id: string) => `<img src="./art/${CRITTER_BY_ID[id].art}.webp" alt="">`;
const COIN = `<img src="./art/coin.webp" alt="">`;
const short = (n: number) => (n < 10_000 ? Math.floor(n).toLocaleString() : n < 1e6 ? `${(n / 1000).toFixed(1)}K` : `${(n / 1e6).toFixed(2)}M`);
const UP_LABEL: Record<UpgradeId, (l: number) => string> = {
  power: (l) => `Lv${l + 1}`,
  range: (l) => `Lv${l + 1}`,
  tank: (l) => `×${valueMult({ power: 0, range: 0, tank: l }).toFixed(2).replace(/0$/, "")}`,
};

function updateUi() {
  $("coinsN").textContent = short(save.coins);
  const wild = CRITTERS.filter((d) => d.biome !== "lab");
  $("indexN").textContent = `${wild.filter((d) => save.index[d.id]).length}/${wild.length}`;
  const bi = BIOMES.find((b) => b.id === save.biome)!;
  $("goBtn").innerHTML = `${bi.icon} <img class="bi" src="./art/jar.webp" alt=""> ▶`;
  $("jarN").textContent = `${field.jar}/${field.cap}`;
  ($("jarFill") as HTMLElement).style.width = `${Math.round((field.jar / field.cap) * 100)}%`;
  $("fieldUi").classList.toggle("hidden", mode !== "field");
  $("rushHud").classList.toggle("hidden", mode !== "rush");
  if (rush) { $("rushT").textContent = String(Math.ceil(rush.left)); $("rushS").textContent = `🎯 ${rush.score.toLocaleString()}`; $("rushGoal").textContent = rush.goal !== null ? `/ ${rush.goal.toLocaleString()}` : ""; }
  $("parkUi").classList.toggle("hidden", mode !== "park");
  $("incomeN").innerHTML = `${COIN} ${short(incomePerSec())}/s`;
  // the road ahead: every place, done or still locked, so the goal is clear from the first minute
  // the whole idea in one line of pictures: critters make coins, coins make the vacuum stronger, a stronger vacuum catches the giant
  const ngL = nextGiant();
  const anyCritter = CRITTERS.find((d) => save.index[d.id]) ?? CRITTERS[0];
  $("loopStrip").innerHTML = `${ic(anyCritter.id)}<i>➜</i>${COIN}<i>➜</i><span class="vacup">🌀⬆</span><i>➜</i>${ngL ? giantImg(ngL.id) : "🏆"}`;
  $("parkTitle").innerHTML = BIOMES.flatMap((b) => {
    const own = save.biomes.includes(b.id), g = giantOf(b.id), done = (save.restored ?? []).includes(b.id);
    return [`<span class="step${own ? " own" : ""}${b.id === save.biome ? " here" : ""}">${b.icon}${b.id === save.biome ? '<img class="you" src="./art/kid_vac.webp" alt="">' : ""}</span>`, g ? `<span class="step g${done ? " done" : own ? " own" : ""}">${giantImg(g.id, done ? "" : "sil")}${done ? "<i>✔</i>" : ""}</span>` : ""];
  }).filter(Boolean).join("<em>━</em>");
  $("rushBtn").textContent = "🏁⏱" + (save.rushBest ? ` 🏆${short(save.rushBest)}` : "");
  $("rushBtn2").innerHTML = "🏁" + (save.rushBest ? `<small class="best">🏆${short(save.rushBest)}</small>` : "");
  if (mode === "park") renderMap();
  if (sheet) renderParkGrid();
  renderNest();
  // the field header: where you are, how much of it you have found, and the goal while Gloom is here
  const here = BIOMES.find((b) => b.id === field.biome)!;
  const found = CRITTERS.filter((d) => d.biome === field.biome && save.index[d.id]).length, total = CRITTERS.filter((d) => d.biome === field.biome).length;
  const gHere = giantLeft(field.biome);
  const ngF = nextGiant();
  const fhHtml = mode === "rush" ? "" : gHere ? gauge(gHere) : `<span class="where">${BIOMES.find((b) => b.id === ngF.biome)!.icon}</span>${gauge(ngF)}`;
  // only rebuilt when it changes, so the bar can animate and a number pop is not wiped
  if ($("fhPlace").dataset.h !== fhHtml) { $("fhPlace").dataset.h = fhHtml; $("fhPlace").innerHTML = fhHtml; }
  $("fhGoal").textContent = "";
  renderTools();
  renderUpBar();
  $("rateN").textContent = incomePerSec() > 0 ? ` +${short(incomePerSec())}/s` : "";
  placeGuide();
  // the first legend you own: tell the player it can come along

  const anyReady = save.nest.some((e) => Date.now() >= e.readyAt);
  $("parkBtn").textContent = "🏡" + (anyReady ? " 🐣" : "");
  const box = $("ups");
  if (sheet !== "shop") return;
  const upKey = UPGRADE_ORDER.map((id) => `${save.up[id]}${(upgradeCost(save.up, id) ?? 1e99) <= save.coins}`).join() + getLang();
  if (box.dataset.k === upKey) return;
  box.dataset.k = upKey;
  box.innerHTML = "";
  for (const id of UPGRADE_ORDER) {
    const cost = upgradeCost(save.up, id);
    const b = document.createElement("button");
    b.className = "btn up";
    b.disabled = cost === null || cost > save.coins;
    const icon = id !== "range" ? UPGRADES[id].icon : save.up.range >= MOUTH_FULL ? "🌪️💰" : save.up.range >= REACH_FULL ? "🌪️" : "📏";
    b.innerHTML = `<span class="ui">${icon}</span><span class="un">${tr(`up.${id}`)}</span><span class="ul">${UP_LABEL[id](save.up[id])} ➜ <b>${UP_LABEL[id](save.up[id] + 1)}</b></span><span class="lvbar"><i style="width:${Math.min(100, save.up[id] * 5)}%"></i></span><span class="uc">${cost === null ? tr("max") : `<img src="./art/coin.webp" alt="">` + short(cost)}</span>`;
    b.onclick = () => buy(id);
    box.appendChild(b);
  }
}

$("parkBtn").onclick = () => void goPark();
$("rushBtn").onclick = () => void startRush(1 + Math.floor(Math.random() * 999_983), null);
$("resOk").onclick = () => { $("result").classList.add("hidden"); };
$("resShare").onclick = () => void shareRush();
$("goBtn").onclick = () => void goField();
$("lureBtn").onclick = () => void lure();
$("langBtn").onclick = () => { $("langPanel").classList.toggle("hidden"); };
$("langPanel").onclick = (e) => { if (e.target === $("langPanel")) $("langPanel").classList.add("hidden"); };
for (const l of LANGS) {
  const b = document.createElement("button");
  b.className = "btn lang";
  b.dataset.lang = l;
  b.innerHTML = `<img src="${LANG_FLAG[l]}" alt=""><span>${LANG_NAME[l]}</span>`;
  b.onclick = () => { save.lang = l; setLang(l); writeSave(save); $("langPanel").classList.add("hidden"); mapKey = ""; applyLang(); updateUi(); };
  $("langList").appendChild(b);
}
$("muteBtn").onclick = () => { save.muted = !save.muted; setMuted(save.muted); $("muteBtn").textContent = save.muted ? "🔇" : "🔊"; writeSave(save); };

applyLang();

// ------------------------------------------------------------------ main loop
let last = performance.now(), uiT = 0, coinAcc = 0;
/** slow motion: a beat when a giant breaks free, and while it is finally being pulled in */
let slowT = 0, timeK = 1;
function frame(now: number) {
  const rdt = Math.min(0.05, (now - last) / 1000); last = now;
  const finale = mode === "field" && field.critters.some((c) => c.boss > 0 && c.state === "pulled");
  slowT = Math.max(0, slowT - rdt);
  timeK += ((finale || slowT > 0 ? 0.3 : 1) - timeK) * Math.min(1, rdt * 8);
  view.zoomTarget = finale ? 1.14 : 0;
  const dt = rdt * timeK; t += dt;
  // the park pays every second, wherever you are
  coinAcc += incomePerSec() * dt;
  if (coinAcc >= 1) { const n = Math.floor(coinAcc); coinAcc -= n; save.coins += n; save.lastSeen = Date.now(); }
  view.fluting = input.on && field.tool === "flute";
  // grey until its giant is caught; the colour eases in when restored
  if (!(save.restored ?? []).includes(field.biome) && view.gloomFlee === 0) colourTarget = 0;
  view.colour += (colourTarget - view.colour) * Math.min(1, dt * 1.2);
  field.companion = null; // companions were cut
  if (mode === "field" && !busy && field.biome !== nextGiant().biome && !field.critters.some((c) => c.boss > 0 && c.state !== "caught")) void nextPlace();
  const gH = mode === "rush" ? null : giantLeft(field.biome), L = barPower();
  field.giant = gH ? { id: gH.id, ready: L >= gH.need, resist: gH.resist, scale: gH.scale } : null;
  const teasing = field.critters.some((c) => c.tease && c.state !== "caught");
  view.giant = gH && !teasing ? { art: CRITTER_BY_ID[gH.id].art, ready: L >= gH.need, k: Math.min(1, L / gH.need) } : null;
  view.vac = L;
  view.skin = SKINS.find((k) => k.id === save.skin) ?? SKINS[0];
  if (mode === "rush" && rush) {
    rush.left -= dt;
    stepField(field, dt, input, RUSH_UP, rushRng);
    handleEvents();
    setVacuum(field.beam, 0.5, field.critters.some((c) => c.state === "tug"));
    view.drawField(field, RUSH_UP, t, dt);
    if (rush.left <= 0) endRush();
  } else if (mode === "field") {
    stepField(field, dt, input, save.up, rng);
    handleEvents();
    setVacuum(field.beam, Math.min(1, barPower() / 60), field.critters.some((c) => c.state === "tug"));
    // the music picks up while a giant is on the field
    setIntensity(field.critters.some((c) => c.boss > 0 && c.state !== "caught") ? 1 : 0);
    view.drawField(field, save.up, t, dt);
  } else {
    setVacuum(false, 0, false); setIntensity(0);
    view.drawPark(save, parkBiome, t, dt);
    coinStream(dt);
  }
  tutorialHand(dt);
  input.tap = false;
  // a full jar that is still being fed rattles: time to go to the park
  const over = mode === "field" && input.on && field.jar >= field.cap;
  $("jarBox").classList.toggle("shake", over);
  if (over) $("parkBtn").classList.add("pulse");
  uiT -= dt;
  if (uiT <= 0) { uiT = 0.25; updateUi(); }
  requestAnimationFrame(frame);
}

document.addEventListener("visibilitychange", () => { save.lastSeen = Date.now(); writeSave(save); if (!document.hidden) payOffline(); });
setInterval(() => writeSave(save), 5000);
setMuted(save.muted); $("muteBtn").textContent = save.muted ? "🔇" : "🔊";

Promise.all([initPoki({ adStart: () => setDucked(true), adEnd: () => setDucked(false) }), loadArt((k) => { ($("loadBar") as HTMLElement).style.width = `${Math.round(k * 100)}%`; }, save.biome), document.fonts?.ready]).then(() => {
  loadingFinished();
  $("loading").classList.add("gone");
  payOffline();
  // eggs from older saves simply hatch
  for (const e of save.nest.splice(0)) { const { def } = hatch(e, rng); (save.index[def.id] ??= { count: 0, muts: [] }).count++; }
  // the story, once: one short card, then straight into play

  setTimeout(offerRush, 700);
  // a brand-new player meets the giant first, and loses: that is the whole game in ten seconds
  if (!save.tips.includes("intro") && save.catches === 0 && field.biome === "meadow") {
    const g = giantStep(0);
    const c = spawn(field, rng, { def: CRITTER_BY_ID[g.id], mut: null, x: field.left + Math.min(300, (field.right - field.left) * 0.62), y: field.farY + (field.nearY - field.farY) * 0.45 });
    c.boss = 1; c.scale = 2.6; c.resist = 9; c.tease = true; c.dir = -1; c.hopPer = 1.4;
  }
  if (!save.tips.includes("road")) { save.tips.push("road"); writeSave(save); setTimeout(() => void showJourney(0, 0), 400); }
  if (save.catches > 0) $("hint").classList.add("hidden");
  const coin = img("coin"), jarImg = img("jar");
  if (coin) $("coinIco").innerHTML = `<img src="./art/coin.webp" alt="">`;
  if (jarImg) $("jarIco").innerHTML = `<img src="./art/jar.webp" alt="">`;
  updateUi();
  requestAnimationFrame((n) => { last = n; requestAnimationFrame(frame); });
});
// test handle for automated checks (harmless in production)
(window as unknown as { __cv: unknown }).__cv = {
  field: () => field, save,
  spawn: (id: string, opt: { mut?: "gold" | "rainbow" | "giant" | null; boss?: boolean; x?: number } = {}) => {
    const c = spawn(field, rng, { def: CRITTER_BY_ID[id], mut: opt.mut ?? null, x: opt.x });
    if (opt.boss) { c.boss = 3; c.scale = 2.1; }
    return c.uid;
  },
};
