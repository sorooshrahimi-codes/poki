import "@fontsource/fredoka/500.css";
import "@fontsource/fredoka/600.css";
import "@fontsource/fredoka/700.css";
import "./style.css";
import { newField, sizeField, stepField, spawn, type Field } from "./core/field.ts";
import { OFFLINE_CAP_MS, UPGRADES, UPGRADE_ORDER, catchCoins, power, range, tankSize, upgradeCost, type UpgradeId } from "./core/economy.ts";
import { makeRng } from "./core/rng.ts";
import { loadSave, writeSave } from "./core/save.ts";
import { BIOMES, CRITTERS, CRITTER_BY_ID, MUTATIONS, RARITY_COLOR, STAR_MULT, biomeName, critterName, starOf } from "./data/critters.ts";
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
  else if (mode === "park") pickCompanion();
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
  if (earned > 0 && away > 60_000) setTimeout(() => toast(tf("offline", { n: earned.toLocaleString() }), 3200), 600);
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
      if (combo >= 3) { view.text(field.nozzle.x + 70, field.nozzle.y - 70, tf("combo", { n: combo }), combo >= 6 ? "#ff7ad1" : "#7cf29a", 16 + Math.min(10, combo)); sfx.coin(combo); }
      if (c.boss > 0 && !(save.restored ??= []).includes(field.biome)) {
        // the giant was Gloom's: the colour floods back into this place, for good
        save.restored.push(field.biome); writeSave(save);
        view.gloomFlee = 0.01; colourTarget = 1;
        setTimeout(() => { toast(tf("restored", { place: biomeName(BIOMES.find((b) => b.id === field.biome)!) }), 3600); sfx.reveal("legendary"); view.shake = 10; }, 700);
      }
      if (c.boss > 0) { toast(tf("bossCaught", { name: critterName(c.def), n: coins.toLocaleString() }), 3200); view.shake = 14; sfx.reveal("legendary"); }
      if (c.boss > 0 || c.mut || c.def.rarity === "epic" || c.def.rarity === "legendary") view.cheer = 1.2;
      // special catches sometimes leave an egg in the nest
      const egg = c.boss > 0 ? "golden" : eggDrop(c.def.rarity, c.mut, rng);
      if (egg && !rush && save.nest.length < NEST_SLOTS) {
        save.nest.push({ tier: egg, biome: field.biome, readyAt: Date.now() + EGG_MINUTES[egg] * 60_000 });
        view.text(field.nozzle.x + 60, field.nozzle.y - 90, tr("egg"), "#fff4c0", 18);
        sfx.newFish();
        if (!save.tips.includes("egg")) { save.tips.push("egg"); setTimeout(() => toast(tf("eggTip", { n: EGG_MINUTES[egg] }), 3200), 900); }
      }
      const isNew = !rush && !save.index[c.def.id] && !jar.slice(0, -1).some((j) => j.id === c.def.id);
      sfx.hook(c.def.rarity === "legendary" ? "legendary" : c.def.rarity);
      view.burst(field.nozzle.x, field.nozzle.y, c.mut === "gold" ? "#ffd84a" : RARITY_COLOR[c.def.rarity], c.def.rarity === "common" && !c.mut ? 10 : 24);
      view.text(field.nozzle.x + 40, field.nozzle.y - 34 - (field.jar % 2) * 22, isNew ? tf("newName", { name: critterName(c.def) }) : `+🪙${coins}`, isNew ? "#ff9ad1" : "#ffe066", isNew ? 20 : 17);
      if (c.mut || c.def.rarity === "epic" || c.def.rarity === "legendary") { view.shake = 8; sfx.reveal(c.def.rarity === "legendary" ? "legendary" : "epic"); }
      if (isNew) sfx.newFish();
      if (!rush && field.jar >= field.cap) { toast(tr("jarFull"), 2400); sfx.event(); }
    } else if (e.kind === "tug") {
      if (!fresh(e.c.uid, "tug")) continue;
      sfx.turn();
      view.text(Math.min(view.W - 80, Math.max(80, e.c.x)), e.c.y - 95, tr(e.c.mut === "gold" ? "holdGold" : "hold"), "#ffe066", 16);
    } else if (e.kind === "escape") {
      if (!fresh(e.c.uid, "esc")) continue;
      view.text(e.c.x, e.c.y - 40, tr("escaped"), "#ffffff", 14); sfx.snap();
    } else if (e.kind === "full") {
      $("parkBtn").classList.add("pulse");
    } else if (e.kind === "surprise") {
      sfx.event(); view.shake = 4;
      if (e.s === "visitor" && e.c) toast(tf("visitor", { name: critterName(e.c.def) }), 2600);
      else if (e.s === "boss" && e.c) { toast(tf("boss", { name: critterName(e.c.def) }), 3200); view.shake = 10; sfx.snap(); }
      else if (e.s === "golden_rain") toast(tr("goldenRain"), 2400);
      else toast(tr("stampede"), 2400);
    } else if (e.kind === "bubbled") {
      sfx.boing(); view.text(e.c.x, e.c.y - 80, tr("bubbled"), "#bfefff", 15);
    } else if (e.kind === "ability") {
      sfx.event(); view.text(field.left + 40, field.nearY - 90, tr(e.id === "sunpup" ? "abHerd" : "abFreeze"), "#ffe066", 17);
      if (e.id === "frostking") view.burst(field.nozzle.x + 120, field.nearY - 60, "#bfefff", 30, 260);
    } else if (e.kind === "split") {
      view.burst(e.c.x, e.c.y - 30, "#7fd3ff", 14, 140); view.text(e.c.x, e.c.y - 70, tr("split"), "#9be7ff", 15); sfx.boing();
    } else if (e.kind === "hide") {
      sfx.bonk();
      if (started && !save.tips.includes(e.c.def.behave)) { save.tips.push(e.c.def.behave); toast(tr(e.c.def.behave === "shell" ? "tipShell" : "tipBurrow"), 3000); }
    } else if (e.kind === "flee") {
      if (started && !save.tips.includes("shy")) { save.tips.push("shy"); toast(tr("tipShy"), 3000); }
    } else if (e.kind === "bossPhase") {
      view.shake = 12; sfx.snap(); view.burst(e.c.x, e.c.y - 60, "#ffd84a", 30, 220);
      view.text(e.c.x, e.c.y - 110, tf("bossPhase", { n: e.c.boss }), "#ffe066", 17);
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
    setTimeout(() => { toast(`${tf("toolNew", { x: TOOL_ICON[tl] })} ${tr(tl === "bubble" ? "tipBubble" : "tipFlute")}`, 4200); sfx.reveal("epic"); }, 600);
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
/** in the park, tapping a legend's pedestal takes it along on the hunt */
function pickCompanion() {
  const slots = view.parkSlots(parkBiome);
  for (const s2 of slots) {
    if (s2.def.rarity !== "legendary" || !save.index[s2.def.id]) continue;
    if (Math.hypot(input.x - s2.x, input.y - (s2.y - 30)) > 48) continue;
    save.companion = save.companion === s2.def.id ? null : s2.def.id;
    if (save.companion) { toast(tf("compJoin", { name: critterName(s2.def) }), 2400); sfx.reveal("legendary"); view.burst(s2.x, s2.y - 40, "#ffe066", 24, 180); }
    writeSave(save);
    return;
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
  toast(goal ? tf("rushGoal", { n: goal.toLocaleString() }) : tr("rushStart"), 2600);
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
  try { await navigator.clipboard.writeText(`${text} ${url}`); toast(tr("copied"), 2400); } catch { toast(url, 6000); }
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
  const slots = view.parkSlots(parkBiome);
  jar.forEach((j, i) => {
    const s2 = slots.find((x) => x.def.id === j.id);
    if (s2) view.fly(CRITTER_BY_ID[j.id].art, 40, 70, s2.x, s2.y - 30, 0.25 + i * 0.12);
  });
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
  toast(tr("lureToast"), 2600);
  sfx.reveal("epic");
  await goField();
}

function buy(id: UpgradeId) {
  const cost = upgradeCost(save.up, id);
  if (cost === null || cost > save.coins) return;
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
  box.classList.toggle("hidden", save.nest.length === 0);
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
  parkBiome = def.biome; biomesKey = "";
  const slot = view.parkSlots(def.biome).find((s2) => s2.def.id === def.id);
  if (slot) view.fly(def.art, view.W / 2, view.H - 260, slot.x, slot.y - 30, 0.1);
  sfx.reveal(def.rarity === "legendary" ? "legendary" : def.rarity === "epic" ? "epic" : "rare");
  toast(tf(mut === "gold" ? "hatchedGold" : "hatched", { name: critterName(def) }) + (isNew ? ` ${tr("new")}` : ""), 2800);
  writeSave(save); nestKey = ""; updateUi();
}

/** a happy little coin sound for each critter landing on its pedestal */
function jarSounds(n: number) { for (let i = 0; i < Math.min(n, 12); i++) setTimeout(() => sfx.coin(i), 450 + i * 120); }

/** the places: tap one you own to see its park page (and catch there next); a locked one can be bought */
let biomesKey = "";
function renderBiomes() {
  const key = `${parkBiome}|${save.biomes.join()}|${BIOMES.map((b) => save.coins >= b.price).join()}`;
  if (key === biomesKey) return;
  biomesKey = key;
  const box = $("biomes");
  box.innerHTML = "";
  for (const b of BIOMES) {
    const owned = save.biomes.includes(b.id);
    const el = document.createElement("button");
    el.className = "btn bio" + (b.id === parkBiome ? " on" : "") + (owned ? "" : " locked");
    el.innerHTML = owned ? `${b.icon} ${biomeName(b)}` : `🔒 ${b.icon} 🪙${b.price.toLocaleString()}`;
    el.disabled = !owned && save.coins < b.price;
    el.onclick = () => {
      if (!owned) { if (save.coins < b.price) return; save.coins -= b.price; save.biomes.push(b.id); sfx.reveal("legendary"); toast(`${b.icon} ${tf("unlocked", { name: biomeName(b) })}`, 2400); }
      parkBiome = b.id; save.biome = b.id; writeSave(save); biomesKey = ""; updateUi();
    };
    box.appendChild(el);
  }
}

// ------------------------------------------------------------------ ui
/** whether the result's left button starts a friend's race ("Play!") or shares yours */
let shareIsPlay = false;
/** the fixed labels; the rest is rewritten by updateUi */
function applyLang() {
  $("hint").textContent = tr("hint");
  $("parkTitle").textContent = tr("parkTitle");
  $("lureBtn").textContent = tr("lure");
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
function toast(text: string, ms = 1800) {
  const el = $("toast"); el.textContent = text; el.classList.remove("hidden");
  clearTimeout(toastT); toastT = window.setTimeout(() => el.classList.add("hidden"), ms);
}
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
  $("goBtn").textContent = `${bi.icon} ${tr("catchMore")}`;
  $("jarN").textContent = `${field.jar}/${field.cap}`;
  ($("jarFill") as HTMLElement).style.width = `${Math.round((field.jar / field.cap) * 100)}%`;
  $("fieldUi").classList.toggle("hidden", mode !== "field");
  $("rushHud").classList.toggle("hidden", mode !== "rush");
  if (rush) { $("rushT").textContent = String(Math.ceil(rush.left)); $("rushS").textContent = `🎯 ${rush.score.toLocaleString()}`; $("rushGoal").textContent = rush.goal !== null ? `/ ${rush.goal.toLocaleString()}` : ""; }
  $("parkUi").classList.toggle("hidden", mode !== "park");
  $("incomeN").textContent = `🪙 ${short(incomePerSec())}/s`;
  renderBiomes();
  renderNest();
  renderTools();
  // the first legend you own: tell the player it can come along
  if (mode === "park" && !save.tips.includes("comp") && CRITTERS.some((d) => d.rarity === "legendary" && save.index[d.id])) { save.tips.push("comp"); toast(tr("compTip"), 3600); }
  // landscape phones: the park buttons sit in a right-hand column, the pedestals take the rest
  const side = innerWidth > innerHeight && innerHeight < 600;
  view.parkRight = side ? 330 / view.scale : 0;
  view.parkBottom = side ? 24 : save.nest.length ? 330 : 272;
  const anyReady = save.nest.some((e) => Date.now() >= e.readyAt);
  $("parkBtn").textContent = tr("park") + (anyReady ? " 🐣" : "");
  const box = $("ups");
  box.innerHTML = "";
  for (const id of UPGRADE_ORDER) {
    const cost = upgradeCost(save.up, id);
    const b = document.createElement("button");
    b.className = "btn up";
    b.disabled = cost === null || cost > save.coins;
    b.innerHTML = `<span class="ui">${UPGRADES[id].icon}</span><span class="un">${tr(`up.${id}`)}</span><span class="ul">⬆${UP_LABEL[id](save.up[id] + 1)}</span><span class="uc">${cost === null ? tr("max") : "🪙" + short(cost)}</span>`;
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
  b.onclick = () => { save.lang = l; setLang(l); writeSave(save); $("langPanel").classList.add("hidden"); biomesKey = ""; applyLang(); updateUi(); };
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
    // little coins rise from earning pedestals
    if (Math.random() < dt * 3) {
      const owned = view.parkSlots(parkBiome).filter((s) => save.index[s.def.id]);
      const s = owned[Math.floor(Math.random() * owned.length)];
      if (s) view.text(s.x, s.y - 50, `+${Math.round(s.def.income * STAR_MULT[starOf(save.index[s.def.id].count)])}`, "#ffe066", 13);
    }
    view.drawPark(save, parkBiome, t, dt);
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
  if (!save.tips.includes("story")) {
    $("storyText").textContent = tr("story"); $("storyGo").textContent = tr("storyGo");
    $("story").classList.remove("hidden");
    $("storyGo").onclick = () => { save.tips.push("story"); writeSave(save); $("story").classList.add("hidden"); };
  }
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
