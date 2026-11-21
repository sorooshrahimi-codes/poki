import "@fontsource/fredoka/500.css";
import "@fontsource/fredoka/600.css";
import "@fontsource/fredoka/700.css";
import "./style.css";
import { newField, sizeField, stepField, spawn, type Field } from "./core/field.ts";
import { OFFLINE_CAP_MS, UPGRADES, UPGRADE_ORDER, catchCoins, power, range, tankSize, upgradeCost, type UpgradeId } from "./core/economy.ts";
import { makeRng } from "./core/rng.ts";
import { loadSave, writeSave } from "./core/save.ts";
import { COMPANIONS } from "./core/field.ts";
import { BIOMES, CRITTERS, CRITTER_BY_ID, RECIPES, MUTATIONS, RARITY_COLOR, STAR_MULT, biomeName, critterName, starOf } from "./data/critters.ts";
import { LANGS, LANG_FLAG, LANG_NAME, detectLang, getLang, setLang, t as tr, tf } from "./i18n.ts";
import type { BiomeId } from "./core/types.ts";
import { commercialBreak, gameplayStart, gameplayStop, initPoki, loadingFinished, rewardedBreak, shareURL, urlParam } from "./platform/poki.ts";
import { setDucked, setMuted, setRain, sfx, unlockAudio } from "./platform/audio.ts";
import { View, img, loadArt } from "./render/view.ts";
import { EGG_ART, EGG_MINUTES, NEST_SLOTS, eggDrop, hatch } from "./core/eggs.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const save = loadSave();
setLang(save.lang ?? detectLang());
const view = new View($<HTMLCanvasElement>("game"));
const rng = makeRng((Date.now() & 0xffff) + 1);
let field: Field = newField(view.W, view.H, save.up, save.biome);
/** which place's page of the park is showing */
let parkBiome: BiomeId = save.biome;
let mode: "field" | "park" | "rush" = "field";
/** the 60-second race: a seeded field, a fixed vacuum, a score to beat */
const RUSH_UP = { power: 6, range: 5, tank: 999 };
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
      jar.push({ id: c.def.id, mut: c.mut });
      // quick catches in a row build a chain: each link adds a quarter more coins
      combo = t - lastCatch < 1.7 ? combo + 1 : 1;
      lastCatch = t;
      let coins = Math.round(catchCoins(c.def.income, mult) * (1 + (combo - 1) * 0.25));
      if (c.boss > 0) coins += Math.round(c.def.income * 60);
      if (rush) rush.score += coins; else { save.coins += coins; save.catches++; }
      if (combo >= 3) { view.text(field.nozzle.x + 70 * field.kid.face, field.nozzle.y - 70, `🔥×${combo}`, combo >= 6 ? "#ff7ad1" : "#7cf29a", 16 + Math.min(10, combo)); sfx.coin(combo); }
      if (c.boss > 0 && !(save.restored ??= []).includes(field.biome)) {
        // the giant was Gloom's: the colour floods back into this place, for good
        save.restored.push(field.biome); writeSave(save);
        view.gloomFlee = 0.01; colourTarget = 1;
        setTimeout(() => { toast(`☁️💨 ${BIOMES.find((b) => b.id === field.biome)!.icon} 🌈`, 3600); sfx.reveal("legendary"); view.shake = 10; }, 700);
      }
      if (c.boss > 0) { toast(`👑${ic(c.def.id)} ✔ ${COIN}+${short(coins)}`, 3200); view.shake = 14; sfx.reveal("legendary"); }
      if (c.boss > 0 || c.mut || c.def.rarity === "epic" || c.def.rarity === "legendary") view.cheer = 1.2;
      // special catches sometimes leave an egg in the nest
      const egg = c.boss > 0 ? "golden" : eggDrop(c.def.rarity, c.mut, rng);
      if (egg && !rush && save.nest.length < NEST_SLOTS) {
        save.nest.push({ tier: egg, biome: field.biome, readyAt: Date.now() + EGG_MINUTES[egg] * 60_000 });
        view.text(field.nozzle.x + 60 * field.kid.face, field.nozzle.y - 90, "🥚!", "#fff4c0", 18);
        sfx.newFish();
        if (!save.tips.includes("egg")) { save.tips.push("egg"); setTimeout(() => toast(`<img src="./art/${EGG_ART[egg]}.webp" alt=""> ⏱${EGG_MINUTES[egg]}′ ➜ 🐣`, 3200), 900); }
      }
      const isNew = !rush && !save.index[c.def.id] && !jar.slice(0, -1).some((j) => j.id === c.def.id);
      sfx.hook(c.def.rarity === "legendary" ? "legendary" : c.def.rarity);
      view.burst(field.nozzle.x, field.nozzle.y, c.mut === "gold" ? "#ffd84a" : RARITY_COLOR[c.def.rarity], c.def.rarity === "common" && !c.mut ? 10 : 24);
      view.text(field.nozzle.x + 40 * field.kid.face, field.nozzle.y - 34 - (field.jar % 2) * 22, isNew ? "🆕✨" : `+🪙${coins}`, isNew ? "#ff9ad1" : "#ffe066", isNew ? 20 : 17);
      if (c.mut || c.def.rarity === "epic" || c.def.rarity === "legendary") { view.shake = 8; sfx.reveal(c.def.rarity === "legendary" ? "legendary" : "epic"); }
      if (isNew) sfx.newFish();
      if (!rush && field.jar >= field.cap) { toast(`<img src="./art/jar.webp" alt=""> ✔ ➜ 🏡`, 2400); sfx.event(); }
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
      if (e.s === "visitor" && e.c) toast(`✨${ic(e.c.def.id)}✨`, 2600);
      else if (e.s === "boss" && e.c) { toast(`⚠️ 👑${ic(e.c.def.id)}`, 3200); view.shake = 10; sfx.snap(); }
      else if (e.s === "golden_rain") toast("🌧️ ✨🪙✨", 2400);
      else toast("💨💨💨", 2400);
    } else if (e.kind === "bubbled") {
      sfx.boing(); view.text(e.c.x, e.c.y - 80, "🫧", "#bfefff", 15);
    } else if (e.kind === "ability") {
      sfx.event(); view.text(field.left + 40, field.nearY - 90, e.id === "sunpup" ? "🐕💨" : "❄️❄️", "#ffe066", 17);
      if (e.id === "frostking") view.burst(field.nozzle.x + 120, field.nearY - 60, "#bfefff", 30, 260);
    } else if (e.kind === "split") {
      view.burst(e.c.x, e.c.y - 30, "#7fd3ff", 14, 140); view.text(e.c.x, e.c.y - 70, "✌️", "#9be7ff", 15); sfx.boing();
    } else if (e.kind === "hide") {
      sfx.bonk();
      if (started && !save.tips.includes(e.c.def.behave)) { save.tips.push(e.c.def.behave); toast(e.c.def.behave === "shell" ? `${ic(e.c.def.id)} 🐚 ➜ ⏳ ➜ 🌀` : `${ic(e.c.def.id)} 🕳️ ➜ 👀 ➜ 🌀`, 3000); }
    } else if (e.kind === "flee") {
      if (started && !save.tips.includes("shy")) { save.tips.push("shy"); toast("🙈 ➜ 🐢🌀", 3000); }
    } else if (e.kind === "bossPhase") {
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
const toolsOwned = (): Tool[] => ["vac", ...(save.catches >= 15 ? ["bubble" as Tool] : []), ...(save.biomes.includes("forest") ? ["flute" as Tool] : [])];
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
    b.onpointerdown = (ev) => { ev.stopPropagation(); field.tool = tl; sfx.tap(); toolsKey = ""; renderTools(); };
    box.appendChild(b);
  }
}
/** the lab: with 3 of each parent, 2 of each go in and a lab egg comes out */
function fuse(id: string) {
  const rc = RECIPES.find((r) => r.hybrid === id)!;
  const A = CRITTER_BY_ID[rc.a], B = CRITTER_BY_ID[rc.b];
  if ((save.index[rc.a]?.count ?? 0) < 3 || (save.index[rc.b]?.count ?? 0) < 3) { toast(`${ic(A.id)}×3 + ${ic(B.id)}×3`, 2600); sfx.tap(); return; }
  if (save.nest.length >= NEST_SLOTS) { toast(`🥚 ${NEST_SLOTS}/${NEST_SLOTS} ✋`, 2200); return; }
  save.index[rc.a].count -= 2; save.index[rc.b].count -= 2;
  save.nest.push({ tier: "lab", biome: "lab", readyAt: Date.now() + EGG_MINUTES.lab * 60_000, hybrid: rc.hybrid });
  toast(`${ic(A.id)} + ${ic(B.id)} ➜ <img src="./art/lab_egg.webp" alt=""> ⏱${EGG_MINUTES.lab}′`, 3000);
  sfx.reveal("epic");
  writeSave(save); nestKey = ""; gridKey = ""; updateUi();
}
/** a legend comes along on the hunt (tap again to leave it home) */
function toggleCompanion(id: string) {
  save.companion = save.companion === id ? null : id;
  if (save.companion) { toast(`${ic(id)} 🐾 ✔`, 2400); sfx.reveal("legendary"); }
  writeSave(save); gridKey = ""; updateUi();
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
      if (d.rarity === "legendary" && (COMPANIONS as string[]).includes(d.id)) {
        const b = document.createElement("button");
        b.className = "btn comp" + (save.companion === d.id ? " on" : "");
        b.textContent = save.companion === d.id ? "✔🐾" : "🐾";
        b.onclick = () => toggleCompanion(d.id);
        card.appendChild(b);
      }
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
  toast(goal ? `🏁 🎯 ${goal.toLocaleString()}` : "🏁 ⏱60", 2600);
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
  $("resTitle").textContent = tr(r.goal === null ? "rushOver" : won ? "won" : "close");
  $("resBody").innerHTML = `<div>🎯 <b>${r.score.toLocaleString()}</b></div>` + (r.goal !== null ? `<div>🤝 ${r.goal.toLocaleString()}</div>` : "") + `<div><small>${tf("best", { n: best.toLocaleString() })} · 🪙+${prize.toLocaleString()}</small></div>`;
  $("result").classList.remove("hidden");
  sfx.reveal(won || r.goal === null ? "epic" : "rare");
  mode = "park";
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
  $("resTitle").textContent = tr("challenged");
  $("resBody").innerHTML = `<div>${tf("chScore", { n: `<b>${score.toLocaleString()}</b>` })}</div><div><small>${tr("chDesc")}</small></div>`;
  shareIsPlay = true; applyLang();
  $("resShare").onclick = () => { shareIsPlay = false; applyLang(); $("resShare").onclick = () => void shareRush(); void startRush(seed, score); };
  $("result").classList.remove("hidden");
}

// ------------------------------------------------------------------ the park
async function goPark() {
  if (busy || mode === "park") return;
  busy = true;
  input.on = false;
  mode = "park";
  // the jar empties onto the pedestals: each critter earns from now on
  const brought = jar.length;
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
  updateUi();
}

async function goField() {
  if (busy || mode === "field") return;
  busy = true;
  // the natural break between rounds: Poki decides whether an ad plays
  await commercialBreak();
  mode = "field";
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
  toast("✨🪙 ×3", 2600);
  sfx.reveal("epic");
  await goField();
}

function buy(id: UpgradeId) {
  const cost = upgradeCost(save.up, id);
  if (cost === null) return;
  if (cost > save.coins) { toast(`${COIN} ${short(save.coins)} / ${short(cost)}`, 1400); sfx.tap(); return; }
  save.coins -= cost; save.up[id]++;
  sfx.buy(); writeSave(save); updateUi();
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
type Plot = "meadow" | "forest" | "frost" | "lab" | "nest" | "shop";
const PLOTS: Plot[] = ["meadow", "forest", "frost", "lab", "nest", "shop"];
let mapKey = "", sheet: Plot | null = null;
const plotEls: Partial<Record<Plot, HTMLElement>> = {};
const labOpen = () => Object.keys(save.index).length >= 6;
function plotIncome(p: Plot) { return CRITTERS.filter((d) => d.biome === p).reduce((a, d) => a + d.income * STAR_MULT[starOf(save.index[d.id]?.count ?? 0)], 0); }
/** coins shown as a little stack of coin icons: 1 to 5, growing with the pen's income */
const coinStack = (inc: number) => inc <= 0 ? "" : `<span class="stack">${'<img src="./art/coin.webp" alt="">'.repeat(Math.max(1, Math.min(5, Math.ceil(Math.log10(inc + 1) * 1.6))))}</span>`;
function renderMap() {
  const now = Date.now();
  const canBuy = UPGRADE_ORDER.some((id) => { const c = upgradeCost(save.up, id); return c !== null && c <= save.coins; });
  const upKey = UPGRADE_ORDER.map((id) => save.up[id] + "" + ((upgradeCost(save.up, id) ?? 1e99) <= save.coins)).join();
  const key = [getLang(), save.biomes.join(), save.biome, save.companion, Object.entries(save.index).map(([k, v]) => k + v.count).join(),
    save.nest.map((e) => e.tier + Math.ceil((e.readyAt - now) / 60_000)).join(), upKey, labOpen(), BIOMES.map((b) => Math.floor(Math.min(1, save.coins / Math.max(1, b.price)) * 20)).join(), [...newIn].join()].join("|");
  if (key === mapKey) return;
  mapKey = key;
  const box = $("parkMap");
  box.innerHTML = "";
  for (const p of PLOTS) {
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
        const k = Math.min(1, save.coins / bi.price);
        el.classList.add("locked");
        if (k >= 1) el.classList.add("ready");
        el.innerHTML = `<div class="sign">${bi.icon}</div><div class="lockMid">${k >= 1 ? "🔨" : "🔒"}</div><div class="price"><img src="./art/coin.webp" alt="">${short(bi.price)}</div><div class="prog"><i style="width:${Math.round(k * 100)}%"></i></div>`;
      } else {
        // the pen: every species has its own spot, caught ones live there, empty spots wait with a "?"
        const spots = list.map((d, i) => {
          const e = save.index[d.id];
          if (!e) return `<span class="spot empty">?</span>`;
          const st = starOf(e.count);
          return `<span class="spot${newIn.has(d.id) ? " got" : ""}" style="--d:${(i * 0.37) % 1.6}s;--rc:${RARITY_COLOR[d.rarity]}"><img src="./art/${d.art}.webp" alt="">${st ? `<i class="stars">${"★".repeat(st)}</i>` : ""}</span>`;
        }).join("");
        const inc = plotIncome(bi.id);
        el.innerHTML = `<div class="sign">${bi.icon} <small>${got}/${list.length}</small></div><div class="pen">${spots}</div><div class="earn">${coinStack(inc)}<b>${short(inc)}/s</b></div>${save.biome === bi.id ? '<div class="here">🫙</div>' : ""}`;
      }
    } else if (p === "lab") {
      const made = CRITTERS.filter((d) => d.biome === "lab" && save.index[d.id]);
      const can = RECIPES.filter((r) => (save.index[r.a]?.count ?? 0) >= 3 && (save.index[r.b]?.count ?? 0) >= 3).length;
      if (!labOpen()) {
        el.classList.add("locked");
        el.innerHTML = `<div class="sign">🧪</div><div class="lockMid">🧪</div><div class="price">📖 ${Object.keys(save.index).length}/6</div><div class="prog"><i style="width:${Math.round(Object.keys(save.index).length / 6 * 100)}%"></i></div>`;
      } else {
        const r0 = RECIPES.find((r) => !save.index[r.hybrid]) ?? RECIPES[0];
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
      el.innerHTML = `<div class="sign">🔧</div><div class="shop">${rows}</div>`;
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
    if (save.coins < bi.price) { toast(`🔒 🪙${short(bi.price - save.coins)}`, 1600); sfx.tap(); return; }
    save.coins -= bi.price; save.biomes.push(bi.id); save.biome = bi.id;
    sfx.reveal("legendary"); toast(`🔓 ${bi.icon} 🎉`, 2400);
    writeSave(save); mapKey = ""; updateUi(); return;
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
/** one bouncing arrow always points at the next useful step: the park when the jar is full,
 *  a place you can now build, an egg ready to hatch, an upgrade you can afford, then back to catching */
function guideTarget(): HTMLElement | null {
  if (!started && mode === "field") return null;
  if (mode === "field") return field.jar >= field.cap ? $("parkBtn") : null;
  if (mode !== "park" || sheet || !$("result").classList.contains("hidden")) return null;
  for (const b of BIOMES) if (!save.biomes.includes(b.id) && save.coins >= b.price) return plotEls[b.id as Plot] ?? null;
  if (save.nest.some((e) => Date.now() >= e.readyAt)) return plotEls.nest?.querySelector<HTMLElement>(".eslot.ready") ?? null;
  const up = plotEls.shop?.querySelector<HTMLElement>(".uprow.ok");
  if (up && save.up.power + save.up.range + save.up.tank < 12) return up;
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
  $("hint").innerHTML = `👆⏺ ➜ 🌀 ➜ <img src="./art/jar.webp" alt="">`;
  $("parkTitle").textContent = "🏡";
  $("lureBtn").textContent = "🎬 ✨";
  $("rushBtn").textContent = tr("rush");
  $("resOk").textContent = tr("ok");
  $("resShare").textContent = tr(shareIsPlay ? "play" : "share");
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
const ic = (id: string) => `<img src="./art/${CRITTER_BY_ID[id].art}.webp" alt="">`;
const COIN = `<img src="./art/coin.webp" alt="">`;
const short = (n: number) => (n < 10_000 ? Math.floor(n).toLocaleString() : n < 1e6 ? `${(n / 1000).toFixed(1)}K` : `${(n / 1e6).toFixed(2)}M`);
const UP_LABEL: Record<UpgradeId, (l: number) => string> = {
  power: (l) => `${Math.round(power({ power: l, range: 0, tank: 0 }))}`,
  range: (l) => `${Math.round(range({ power: 0, range: l, tank: 0 }) / 10)}m`,
  tank: (l) => `${tankSize({ power: 0, range: 0, tank: l })}`,
};

function updateUi() {
  $("coinsN").textContent = short(save.coins);
  $("indexN").textContent = `${Object.keys(save.index).length}/${CRITTERS.length}`;
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
  $("parkTitle").innerHTML = [...BIOMES.map((b) => {
    const own = save.biomes.includes(b.id), done = (save.restored ?? []).includes(b.id);
    return `<span class="step${own ? " own" : ""}">${b.icon}${done ? "🌈" : own ? "" : "🔒"}</span>`;
  }), `<span class="step${labOpen() ? " own" : ""}">🧪${labOpen() ? "" : "🔒"}</span>`].join("<i>━</i>");
  $("rushBtn").textContent = "🏁⏱" + (save.rushBest ? ` 🏆${short(save.rushBest)}` : "");
  if (mode === "park") renderMap(); else if (sheet) closeSheet();
  if (sheet) renderParkGrid();
  renderNest();
  // the field header: where you are, how much of it you have found, and the goal while Gloom is here
  const here = BIOMES.find((b) => b.id === field.biome)!;
  const found = CRITTERS.filter((d) => d.biome === field.biome && save.index[d.id]).length, total = CRITTERS.filter((d) => d.biome === field.biome).length;
  $("fhPlace").textContent = `${here.icon} 📖 ${found}/${total}`;
  $("fhGoal").textContent = (save.restored ?? []).includes(field.biome) ? "🌈" : "☁️ ➜ 👑🌀 ➜ 🌈";
  renderTools();
  placeGuide();
  // the first legend you own: tell the player it can come along
  if (mode === "park" && !save.tips.includes("comp") && CRITTERS.some((d) => d.rarity === "legendary" && save.index[d.id])) { save.tips.push("comp"); toast("🐾 👆", 3000); }
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
    b.innerHTML = `<span class="ui">${UPGRADES[id].icon}</span><span class="un">${tr(`up.${id}`)}</span><span class="ul">${UP_LABEL[id](save.up[id])} ➜ <b>${UP_LABEL[id](save.up[id] + 1)}</b></span><span class="lvbar"><i style="width:${Math.min(100, save.up[id] * 5)}%"></i></span><span class="uc">${cost === null ? tr("max") : `<img src="./art/coin.webp" alt="">` + short(cost)}</span>`;
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
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
  // the park pays every second, wherever you are
  coinAcc += incomePerSec() * dt;
  if (coinAcc >= 1) { const n = Math.floor(coinAcc); coinAcc -= n; save.coins += n; save.lastSeen = Date.now(); }
  view.fluting = input.on && field.tool === "flute";
  // grey until its giant is caught; the colour eases in when restored
  if (!(save.restored ?? []).includes(field.biome) && view.gloomFlee === 0) colourTarget = 0;
  view.colour += (colourTarget - view.colour) * Math.min(1, dt * 1.2);
  field.companion = (save.companion as Field["companion"]) ?? null;
  if (mode === "rush" && rush) {
    rush.left -= dt;
    stepField(field, dt, input, RUSH_UP, rushRng);
    handleEvents();
    setRain(field.beam ? 0.9 : 0);
    view.drawField(field, RUSH_UP, t, dt);
    if (rush.left <= 0) endRush();
  } else if (mode === "field") {
    stepField(field, dt, input, save.up, rng);
    handleEvents();
    setRain(field.beam ? 0.9 : 0); // the vacuum's whoosh
    view.drawField(field, save.up, t, dt);
  } else {
    setRain(0);
    view.drawPark(save, parkBiome, t, dt);
    coinStream(dt);
  }
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

Promise.all([initPoki({ adStart: () => setDucked(true), adEnd: () => setDucked(false) }), loadArt((k) => { ($("loadBar") as HTMLElement).style.width = `${Math.round(k * 100)}%`; }), document.fonts?.ready]).then(() => {
  loadingFinished();
  $("loading").classList.add("gone");
  payOffline();
  // the story, once: one short card, then straight into play

  setTimeout(offerRush, 700);
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
