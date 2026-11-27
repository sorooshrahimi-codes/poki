import "@fontsource/fredoka/500.css";
import "@fontsource/fredoka/600.css";
import "@fontsource/fredoka/700.css";
import "./style.css";
import { newField, sizeField, stepField, spawn, type Field } from "./core/field.ts";
import { OFFLINE_CAP_MS, UPGRADES, UPGRADE_ORDER, catchCoins, power, range, tankSize, upgradeCost, type UpgradeId } from "./core/economy.ts";
import { makeRng } from "./core/rng.ts";
import { loadSave, writeSave } from "./core/save.ts";
import { GIANTS, SKINS, critterOf, giantOf, giantStep } from "./data/critters.ts";
import { MOUTH_FULL, REACH_FULL, tierOf, vacLevel, valueMult } from "./core/economy.ts";
import { fireSpecial, makeSpecial } from "./core/field.ts";
import { BIOMES, CRITTERS, CRITTER_BY_ID, RECIPES, MUTATIONS, RARITY_COLOR, STAR_MULT, biomeName, critterName, starOf } from "./data/critters.ts";
import { LANGS, LANG_FLAG, LANG_NAME, detectLang, getLang, setLang, t as tr, tf } from "./i18n.ts";
import type { BiomeId } from "./core/types.ts";
import { canShare, commercialBreak, gameplayStart, gameplayStop, initPoki, loadingFinished, rewardedBreak, shareURL, urlParam } from "./platform/poki.ts";
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
  if ((mode === "field" && lvl && !lvl.done) || mode === "rush") { input.on = true; input.tap = true; firstTouch(); }

});
window.addEventListener("pointermove", (e) => { if (input.on || e.pointerType === "mouse") aimAt(e); });
window.addEventListener("pointerup", () => { input.on = false; });
window.addEventListener("pointercancel", () => { input.on = false; });
window.addEventListener("keydown", (e) => { if (e.key === " " || e.key.startsWith("Arrow")) e.preventDefault(); if (e.key === " ") { input.on = true; firstTouch(); } });
window.addEventListener("keyup", (e) => { if (e.key === " ") input.on = false; });
window.addEventListener("resize", () => { view.resize(); sizeField(field, view.W, view.H); if (!$("levels").classList.contains("hidden")) renderLevels(); });

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
      combo = t - lastCatch < 2.1 + 0.5 * perkN("combo") ? combo + 1 : 1;
      lastCatch = t;
      const airborne = (c.launch ?? 0) > 0;
      let coins = Math.round(catchCoins(c.def.income, mult) * (1 + (combo - 1) * 0.25) * (rush ? 1 : valueMult(save.up) * (1 + 0.25 * perkN("coins"))) * (airborne ? 2 : 1) * (field.frenzy > 0 ? 2 : 1) * (c.kind === "treasure" ? 12 : 1) * (field.twist === "big" ? 2 : 1) * (rush ? 1 : (1 + 1.5 * lapNow()) * (1 + 0.12 * homeStage())));
      if (c.kind === "treasure") { view.text(field.nozzle.x, field.nozzle.y - 110, "💰💰💰", "#ffe066", 30); view.shake = 6; }
      if (c.kind === "box") openBox();
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
        if (lvl?.task === "giant") endLevel(true);
        lvl = null;
        const theEnd = field.biome === "moon" && !save.tips.includes("moonDone");
        if (theEnd) { save.tips.push("moonDone"); setTimeout(() => void moonFinale(), 3600); }
        else setTimeout(() => void pickPerk().then(() => nextPlace()), 4200);
      }
      if (c.boss > 0 || c.mut || c.def.rarity === "epic" || c.def.rarity === "legendary") view.cheer = 1.2;
      sfx.catchPop(combo, c.def.rarity);
      view.burst(field.nozzle.x, field.nozzle.y, c.mut === "gold" ? "#ffd84a" : RARITY_COLOR[c.def.rarity], c.def.rarity === "common" && !c.mut ? 10 : 24);
      view.text(field.nozzle.x + 40 * field.kid.face, field.nozzle.y - 34 - (save.catches % 2) * 22, `+🪙${short(coins)}`, "#ffe066", 17);
      if (!rush) flyCoins(field.nozzle.x, field.nozzle.y, Math.min(4, 1 + Math.floor(Math.log10(coins + 1))));
      if (lvl && !lvl.done && c.boss === 0) {
        const special: Record<string, string> = { bush: "bushed", slide: "slider", sticky: "sticky", lava: "faller", float: "floater" };
        if (special[lvl.task]) { if (c.kind === special[lvl.task]) lvl.count++; }
        else if (lvl.task === "bonus") { if (c.kind === "treasure" || c.kind === "box") lvl.count++; }
        else if (lvl.task === "any" || lvl.task === "rival" || (lvl.task === "species" && c.def.id === lvl.target) || (lvl.task === "golden" && c.mut === "gold")) lvl.count++;
        else if (lvl.task === "combo") lvl.count = Math.max(lvl.count, combo);
        if (lvl.count >= lvl.goal) { lvl.count = lvl.goal; setTimeout(() => endLevel(true), 400); }
      }
      if (!rush && c.boss === 0 && tierOf(vacLevel(save.up)) > 0) field.special = Math.min(1, field.special + 0.09 * (1 + 0.35 * perkN("special")));
      // every catch also pushes the giant bar a little, right away
      if (!rush && c.boss === 0) {
        const add = ({ common: 0.06, rare: 0.12, epic: 0.25, legendary: 0.5, secret: 0.5 } as const)[c.def.rarity] * (c.mut ? 2 : 1);
        const before = Math.floor(save.charge ?? 0);
        save.charge = (save.charge ?? 0) + add;
        sparkToBar(field.nozzle.x, field.nozzle.y, Math.floor(save.charge) > before);
      }
      // a new species gets its big moment, unless a giant fight is on (then it slips into the book quietly)
      if (isNew && !field.critters.some((k) => k.boss > 0 && k.state !== "caught") && c.boss === 0) { celebrating.add(c.def.id); void celebrate([c.def.id]).then(() => queued(() => checkChests(c.def.biome))); }
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
    } else if (e.kind === "lost") {
      // one got away (slid off the ice, fell into the lava, floated off into space)
      if (lvl && !lvl.done && MISS_TASKS.includes(lvl.task)) {
        lvl.stolen++; sfx.nope();
        view.text(Math.max(30, Math.min(view.W - 30, e.c.x)), Math.max(80, e.c.y - e.c.lift - 30), lvl.task === "lava" ? "💥" : lvl.task === "float" ? "👋" : "💨", "#ffffff", 26);
        if (lvl.stolen >= 5) setTimeout(() => endLevel(false), 500);
      }
    } else if (e.kind === "attack") {
      // the giant fights back: a big icon over it, a hit of the camera, a sound
      const icon = { stomp: "🦶💥", spit: "💣💣", roar: "😱" }[e.a];
      view.text(e.c.x, e.c.y - e.c.def.size * e.c.scale - 20, icon, "#ffffff", 40);
      view.shake = e.a === "stomp" ? 18 : 10;
      if (e.a === "roar") { sfx.rumble(); view.text(field.nozzle.x, field.nozzle.y - 70, "💫", "#ffffff", 30); } else sfx.boing();
    } else if (e.kind === "event") {
      // the event announces itself with a big icon and a sound, no words
      const icon = { box: "🎁", bombs: "💣", treasure: "💰", gust: "🌬️", parade: "🏃", frenzy: "🔥×2" }[e.e];
      view.text(view.W / 2, field.farY - 30, icon, "#ffffff", 46); sfx.event();
      if (e.e === "gust") { view.shake = 5; sfx.boing(); }
    } else if (e.kind === "boom") {
      view.shake = 16; sfx.pop(); view.burst(e.c.x, e.c.y - 30, "#ff5a2a", 30, 220);
      view.text(field.nozzle.x, field.nozzle.y - 80, "💥💫", "#ffffff", 34);
    } else if (e.kind === "rivalIn") {
      sfx.event();
    } else if (e.kind === "stolen") {
      sfx.nope(); if (field.rival) view.text(field.rival.x, field.rival.y - 130, "😏", "#ffffff", 34);
      if (lvl && lvl.task === "rival" && !lvl.done) { lvl.stolen++; if (lvl.stolen >= 3) setTimeout(() => endLevel(false), 600); }
    } else if (e.kind === "rivalMiss") {
      if (field.rival) view.text(field.rival.x, field.rival.y - 130, "😤", "#ffffff", 34);
    } else if (e.kind === "rivalBlown") {
      // blown off his feet: a little bonus for you
      sfx.boing(); view.shake = 6;
      const bonus = Math.max(20, Math.round(incomePerSec() * 8));
      save.coins += bonus;
      if (field.rival) { view.text(field.rival.x, field.rival.y - 120, "😵💨", "#ffffff", 32); flyCoins(field.rival.x, field.rival.y - 60, 5); }
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
  $("resShare").classList.toggle("hidden", !canShare() && !shareIsPlay); // GameDistribution and Playgama forbid outside links
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
  const toI = BIOMES.findIndex((b) => b.id === save.biome);
  if (lapNow() > 0 && !save.tips.includes(`night${lapNow()}`)) { save.tips.push(`night${lapNow()}`); writeSave(save); toast(`🌙 ➜ 🌃 ★${lapNow() + 1}`, 3200); }
  if (toI !== fromI) {
    if (BIOMES[toI].id === "moon" && BIOMES[fromI].id === "volcano") await showLaunch();
    await showWorld({ walkFrom: fromI + 1, newPart: true });
  }
  busy = false;
  field = newField(view.W, view.H, save.up, save.biome); field.script = 2;
  for (let i = 0; i < 5; i++) spawn(field, rng);
  colourTarget = (save.restored ?? []).includes(save.biome) ? 1 : 0; view.colour = colourTarget;
  writeSave(save); lvl = null; renderLevels(); updateUi();
}
/** the journey: a road of every place with its giant, the kid walking from the last place to the new one,
 *  and the Moon waiting at the end. Shown at the very start and whenever a new place opens. No words. */
async function showJourney(from: number, to: number) {
  const box = $("journey");
  const places = BIOMES;
  box.innerHTML = `<div class="road">${places.map((b, i) => {
    const g = GIANTS.find((x) => x.biome === b.id), done = (save.restored ?? []).includes(b.id);
    return `<div class="stop${i <= to ? " on" : ""}${i === places.length - 1 ? " goal" : ""}"><span class="pi">${b.icon}</span>${g ? `<img class="gg${done ? " done" : ""}" src="./art/${CRITTER_BY_ID[g.id].art}.webp" alt="">` : ""}${done ? "<i>✔</i>" : ""}</div>`;
  }).join('<b class="dots"></b>')}</div><img class="walker" src="./art/kid_vac.webp" alt=""><img class="rivalw" src="./art/kid_rival.webp" alt="">`;
  box.classList.remove("hidden");
  const stops = box.querySelectorAll<HTMLElement>(".stop"), walker = box.querySelector<HTMLElement>(".walker")!;
  const at = (i: number) => { const r = stops[Math.max(0, Math.min(stops.length - 1, i))].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top }; };
  const a = at(from), b = at(to);
  // the rival stands where he is on the road right now
  const rp = Math.min(BIOMES.length - 1, Math.floor(rivalPos(save.playTime ?? 0) % GIANTS.length)), rv = box.querySelector<HTMLElement>(".rivalw")!, ra = at(rp);
  rv.style.left = `${ra.x + 14}px`; rv.style.top = `${ra.y - 6}px`;
  rv.classList.toggle("hidden", (save.playTime ?? 0) < 20);
  walker.style.left = `${a.x}px`; walker.style.top = `${a.y}px`;
  await new Promise((r) => setTimeout(r, 450));
  walker.style.transition = "left 1.1s ease-in-out, top 1.1s ease-in-out";
  walker.style.left = `${b.x}px`; walker.style.top = `${b.y}px`;
  sfx.event();
  await new Promise((r) => setTimeout(r, 1900));
  box.classList.add("hidden");
}

/** the vacuum evolves: the old machine, a flash, the new one, and its special move */
async function evolve(tier: number) {
  const box = $("evolve");
  const from = tier === 1 ? "kid_vac" : `kid_vac${tier}`, to = `kid_vac${tier + 1}`;
  const move = ["", "🌪️", "🌪️❄️", "🌌"][tier];
  box.innerHTML = `<div class="rays"></div><img class="old" src="./art/${from}.webp" alt=""><img class="new" src="./art/${to}.webp" alt=""><div class="mv">${move}</div><button class="btn big go" id="evoGo">▶</button>`;
  box.classList.remove("hidden"); input.on = false;
  sfx.reveal("legendary"); setTimeout(() => sfx.event(), 900);
  await new Promise<void>((r) => { $("evoGo").onclick = () => r(); });
  box.classList.add("hidden");
  field.special = 1; // a first one to try right away
}

/** the end of the road: you sucked up the Moon. A trophy moment, a share button, then the giants come back stronger. */
async function moonFinale() {
  const box = $("finale");
  const mine = save.playTime ?? 0, his = rivalAt(GIANTS.length - 1), won = mine <= his;
  save.moonBest = Math.min(save.moonBest ?? 1e9, mine); writeSave(save);
  box.innerHTML = `<div class="rays"></div><img class="moon" src="./art/bigmoon.webp" alt=""><img class="kid" src="./art/kid_cheer.webp" alt=""><div class="trophy">${won ? "🏆" : "🥈"}</div>
    <div class="times"><div class="t${won ? " win" : ""}"><img src="./art/kid_vac.webp" alt="">⏱ ${clock(mine)}</div><div class="t${won ? "" : " win"}"><img src="./art/kid_rival.webp" alt="">⏱ ${clock(his)}</div></div><div class="row"><button class="btn big rush" id="finShare">📤 🌙</button><button class="btn big go" id="finGo">★2 ▶</button></div>`;
  box.classList.remove("hidden");
  if (!canShare()) $("finShare").remove();
  sfx.reveal("legendary"); setTimeout(() => sfx.event(), 600);
  for (let i = 0; i < 30; i++) setTimeout(() => { const s = document.createElement("i"); s.className = "confetti"; s.style.left = `${Math.random() * 100}%`; s.style.background = ["#ffe066", "#ff7ad1", "#7be495", "#5bc8ff"][i % 4]; box.appendChild(s); setTimeout(() => s.remove(), 2600); }, i * 60);
  $("finShare").onclick = async () => {
    const url = await shareURL({});
    const text = `🫙🌙 I vacuumed up the MOON in ${clock(mine)} in Critter Vac! Can you beat it?`;
    try { if (navigator.share) { await navigator.share({ text, url }); return; } } catch { /* cancelled */ }
    try { await navigator.clipboard.writeText(`${text} ${url}`); toast("📋 ✔", 2000); } catch { /* nothing */ }
  };
  await new Promise<void>((r) => { $("finGo").onclick = () => r(); });
  box.classList.add("hidden");
  await pickPerk();
  await nextPlace();
}

/** the world map: one illustrated road from the kid's house (bottom) to the Moon (top). Pins for every place with its giant,
 *  the kid where you are, the rival where he is. From the button it just closes; on the way it waits for a tap on your place. */
const WORLD_PINS: [number, number][] = [[29, 84], [54, 93], [48, 68], [47, 54], [46, 39], [55, 27], [52, 7]]; // home, 6 places (the Moon last), on the road in the picture
/** the home: what your coins build. Eight stages from a cottage to a sky castle, each a lot more expensive,
 *  each one a little bonus for good (+12% coins). Built on the world map by tapping the house. */
const HOME_COST = [6_000, 90_000, 1_400_000, 18_000_000, 240_000_000, 3_000_000_000, 40_000_000_000];
const homeStage = () => save.home ?? 0;
const homeNext = () => (homeStage() < HOME_COST.length ? HOME_COST[homeStage()] : null);
const homeReady = () => { const c = homeNext(); return c !== null && save.coins >= c; };
function buildHome() {
  const c = homeNext();
  if (c === null || save.coins < c) { sfx.nope(); return false; }
  save.coins -= c; save.home = homeStage() + 1; writeSave(save);
  sfx.reveal("legendary"); setTimeout(() => sfx.event(), 500);
  return true;
}
/** the rocket by the house: one part for each of the first five giants (pad, body, window, fins, boosters, then complete) */
const ROCKET_PLACES: BiomeId[] = ["meadow", "forest", "frost", "candy", "volcano"];
const rocketStage = () => Math.min(5, ROCKET_PLACES.filter((b) => (save.restored ?? []).includes(b)).length);
function showWorld(o: { walkFrom?: number; browse?: boolean; newPart?: boolean } = {}) {
  return new Promise<void>((done) => {
    const box = $("world"), here = placeIndex(save.biome) + 1; // pin index: 0 = home
    const rv = Math.min(BIOMES.length, Math.floor(rivalPos(save.playTime ?? 0)) % GIANTS.length + 1);
    const pin = (i: number) => `left:${WORLD_PINS[i][0]}%;top:${WORLD_PINS[i][1]}%`;
    box.classList.toggle("night", lapNow() > 0);
    box.innerHTML = `<div class="wbg"></div><div class="wmap"><img class="art" src="./art/world_map.webp" alt="">${lapNow() ? `<div class="lap">★${lapNow() + 1}</div>` : ""}
      <button class="pin home${homeReady() ? " ready" : ""}" style="${pin(0)}"><img src="./art/home_${homeStage()}.webp" alt="">${homeNext() !== null ? `<span class="hc${homeReady() ? " ok" : ""}">${homeReady() ? "🔨" : ""}${COIN}${short(homeNext()!)}</span>` : ""}<span class="hs">${"⭐".repeat(homeStage())}</span></button>
      <div class="rocket${o.newPart ? " built" : ""}"><img src="./art/rocket_${rocketStage()}.webp" alt=""><span class="parts">${[0, 1, 2, 3, 4].map((k) => `<i class="${k < rocketStage() ? "on" : ""}"></i>`).join("")}</span></div>
      ${BIOMES.map((b, k) => { const i = k + 1, g = GIANTS.find((x) => x.biome === b.id), beat = (save.restored ?? []).includes(b.id);
        return `<button class="pin place${i === here ? " here" : ""}${i < here || beat ? " past" : ""}${i > here && !beat ? " ahead" : ""}${b.id === "moon" ? " moon" : ""}" data-i="${i}" style="${pin(i)}"><span class="pi">${b.icon}</span>${g ? `<img class="gg${beat ? "" : " sil"}" src="./art/${CRITTER_BY_ID[g.id].art}.webp" alt="">` : ""}${beat ? "<i>✔</i>" : ""}</button>`; }).join("")}
      <img class="who him" src="./art/kid_rival.webp" alt="" style="${pin(rv)}">
      <img class="who me" src="./art/kid_vac.webp" alt="" style="${pin(o.walkFrom ?? here)}">
    </div>${o.browse ? `<button class="btn x" id="wClose">✕</button>` : ""}`;
    box.classList.remove("hidden"); input.on = false;
    const me = box.querySelector<HTMLElement>(".who.me")!;
    if (o.newPart) setTimeout(() => { sfx.reveal("epic"); }, 300);
    if (o.walkFrom !== undefined && o.walkFrom !== here) setTimeout(() => { me.classList.add("walk"); me.setAttribute("style", pin(here)); sfx.event(); }, o.newPart ? 1600 : 500);
    const close = () => { box.classList.add("hidden"); done(); };
    const cur = box.querySelector<HTMLElement>(`.pin.place[data-i="${here}"]`)!;
    cur.onclick = () => { sfx.tap(); close(); };
    for (const el of box.querySelectorAll<HTMLElement>(".pin.place:not(.here)")) el.onclick = () => sfx.nope();
    const c = document.getElementById("wClose"); if (c) c.onclick = close;
    // build the next stage of the home right here on the map
    const home = box.querySelector<HTMLElement>(".pin.home")!;
    home.onclick = () => {
      if (!buildHome()) return;
      const im = home.querySelector("img")!; im.src = `./art/home_${homeStage()}.webp`; home.classList.remove("built"); void home.offsetWidth; home.classList.add("built");
      const hc = home.querySelector<HTMLElement>(".hc"); const n = homeNext();
      if (hc) { if (n === null) hc.remove(); else { hc.className = `hc${homeReady() ? " ok" : ""}`; hc.innerHTML = `${homeReady() ? "🔨" : ""}${COIN}${short(n)}`; } }
      home.querySelector<HTMLElement>(".hs")!.textContent = "⭐".repeat(homeStage());
      home.classList.toggle("ready", homeReady());
      updateUi();
    };
  });
}
/** the rocket is complete: lift-off, up past the clouds, toward the Moon */
function showLaunch() {
  return new Promise<void>((done) => {
    const box = $("launch");
    box.innerHTML = `<div class="sky"></div><img class="moonL" src="./art/bigmoon.webp" alt=""><img class="r" src="./art/rocket_launch.webp" alt=""><div class="smoke"></div>`;
    box.classList.remove("hidden"); input.on = false;
    sfx.rumble(); view.shake = 14;
    setTimeout(() => { box.querySelector(".r")!.setAttribute("src", "./art/rocket_fly.webp"); box.classList.add("go"); sfx.reveal("legendary"); }, 1400);
    let over = false;
    const end = () => { if (over) return; over = true; box.classList.add("hidden"); box.classList.remove("go"); box.onclick = null; done(); };
    setTimeout(() => { box.onclick = end; }, 600);
    setTimeout(end, 4200);
  });
}
/** the dream: a night in the kid's room, the Moon in the window, and a thought: the Moon, in my vacuum */
function showDream() {
  return new Promise<void>((done) => {
    const box = $("dream");
    box.innerHTML = `<img class="art" src="./art/intro_dream.webp" alt=""><div class="bubble"><i></i><i></i><div class="b"><img class="m" src="./art/bigmoon.webp" alt=""><img class="v" src="./art/kid_vac_suck.webp" alt=""></div></div><div class="tap">👆</div>`;
    box.classList.remove("hidden");
    setTimeout(() => sfx.reveal("epic"), 900);
    let over = false;
    const end = () => { if (over) return; over = true; box.classList.add("hidden"); box.onclick = null; done(); };
    setTimeout(() => { box.onclick = end; }, 700);
    setTimeout(end, 2400); // straight on into play, even without a tap
  });
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
/** the book's chests: a place's species list (its giant is won, not collected here) and the three milestones */
const bookList = (b: BiomeId) => CRITTERS.filter((d) => d.biome === b && d.rarity !== "secret");
const bookGot = (b: BiomeId) => bookList(b).filter((d) => save.index[d.id]).length;
const chestsAt = (b: BiomeId) => [4, 8, bookList(b).length];
/** open any chest a place has earned: coins, then a perk card, then a big chest and a perk card */
async function checkChests(b: BiomeId) {
  const got = bookGot(b), at = chestsAt(b), done = ((save.bookChests ??= {})[b] ??= 0);
  if (done >= 3 || got < at[done]) return;
  save.bookChests[b] = done + 1; writeSave(save);
  const k = placeIndex(b), base = Math.max(200, Math.round(incomePerSec() * 60 + 150 * (1 + k * 4)));
  const prize = done === 0 ? base * 2 : done === 2 ? base * 8 : 0;
  const box = $("gift");
  box.innerHTML = `<div class="chest">${done === 2 ? "👑" : "🎁"}</div><div class="days">${bookList(b).slice(0, 12).map((d) => `<img class="${save.index[d.id] ? "" : "sil"}" src="./art/${d.art}.webp" alt="">`).join("")}</div>${prize ? `<div class="prize">${COIN} +${short(prize)}</div>` : ""}${done >= 1 ? `<div class="prize">🃏</div>` : ""}<button class="btn big go" id="giftGo">✔</button>`;
  box.classList.remove("hidden"); sfx.reveal(done === 2 ? "legendary" : "epic"); input.on = false;
  await new Promise<void>((r) => { $("giftGo").onclick = () => r(); });
  box.classList.add("hidden");
  if (prize) { save.coins += prize; flyCoins(view.W / 2, view.H / 2, 10); }
  if (done >= 1) await pickPerk();
  writeSave(save); updateUi();
}
/** the book: your collection by place, just to look at */
function openBook(b: BiomeId = save.biome) {
  sheet = b as Plot; parkBiome = b; gridKey = "";
  const tabs = save.biomes.map((id) => { const bi = BIOMES.find((x) => x.id === id)!; const got = CRITTERS.filter((d) => d.biome === id && save.index[d.id]).length, all = CRITTERS.filter((d) => d.biome === id).length; return `<button class="btn tab${id === b ? " on" : ""}" data-b="${id}">${bi.icon} ${got}/${all}</button>`; }).join("");
  const at = chestsAt(b), got = bookGot(b), opened = (save.bookChests ?? {})[b] ?? 0, all = at[2];
  const track = `<div class="ctrack"><i style="width:${Math.round((got / all) * 100)}%"></i>${at.map((n, i) => `<span class="ch${i < opened ? " open" : ""}" style="left:${(n / all) * 100}%">${i < opened ? "✔" : i === 2 ? "👑" : "🎁"}<small>${n}</small></span>`).join("")}</div>`;
  $("shTitle").innerHTML = `<div class="tabs">${tabs}</div>${track}`;
  for (const el of $("shTitle").querySelectorAll<HTMLElement>("[data-b]")) el.onclick = () => openBook(el.dataset.b as BiomeId);
  $("shHunt").classList.add("hidden");
  $("parkGrid").classList.remove("hidden"); $("nest").classList.add("hidden"); $("ups").classList.add("hidden");
  $("sheet").classList.remove("hidden");
  input.on = false;
  renderParkGrid();
}
$("bookBtn").onclick = () => openBook();
$("worldBtn").onclick = () => { if (lvl && !lvl.done) return; sfx.tap(); void showWorld({ browse: true }); };
$("lureBtn2").onclick = () => void lure();
$("specialBtn").onpointerdown = (e) => { e.stopPropagation(); if (fireSpecial(field, tierOf(vacLevel(save.up)))) { sfx.rumble(); view.shake = 12; } else sfx.nope(); };
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
  const tierBefore = tierOf(vacLevel(save.up));
  save.coins -= cost; save.up[id]++;
  if (tierOf(vacLevel(save.up)) > tierBefore) setTimeout(() => void queued(() => evolve(tierOf(vacLevel(save.up)))), 300);
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
// ------------------------------------------------------------------ perks: after each giant, pick one of two
interface Perk { id: string; icon: string }
const PERKS: Perk[] = [
  { id: "coins", icon: "💰" }, { id: "special", icon: "🌪️" }, { id: "time", icon: "⏱" },
  { id: "magnet", icon: "🧲" }, { id: "gold", icon: "✨" }, { id: "shield", icon: "🛡️" }, { id: "combo", icon: "🔥" },
];
const perkN = (id: string) => (save.perks ?? []).filter((x) => x === id).length;
/** two different perks, shown as big picture cards; the pick stays for good (they stack) */
async function pickPerk() {
  const pool = [...PERKS].sort(() => Math.random() - 0.5).slice(0, 2);
  const box = $("perks");
  box.innerHTML = `<div class="cards">${pool.map((p) => `<button class="card" data-p="${p.id}"><span class="pi">${p.icon}</span><span class="pl">${"●".repeat(perkN(p.id))}<b>●</b></span></button>`).join("")}</div>`;
  box.classList.remove("hidden"); sfx.event();
  await new Promise<void>((r) => { for (const el of box.querySelectorAll<HTMLElement>(".card")) el.onclick = () => { (save.perks ??= []).push(el.dataset.p!); writeSave(save); el.classList.add("picked"); sfx.reveal("epic"); setTimeout(r, 650); }; });
  box.classList.add("hidden");
}
/** the perks' effects on the field */
function applyPerks(f: Field) {
  f.goldK = 1 + perkN("gold");
  f.magnet = perkN("magnet");
  f.rivalSlow = 1 + 0.6 * perkN("shield");
}

/** a mystery box: one of five surprises */
function openBox() {
  const r = Math.random();
  sfx.reveal("epic");
  if (r < 0.2 && tierOf(vacLevel(save.up)) > 0) { field.special = 1; view.text(field.nozzle.x, field.nozzle.y - 110, "🎁➜🌪️", "#9fe0ff", 30); }
  else if (r < 0.4) { field.frenzy = 10; view.text(field.nozzle.x, field.nozzle.y - 110, "🎁➜🔥×2", "#ffb347", 30); }
  else if (r < 0.6) { field.lure += 5; view.text(field.nozzle.x, field.nozzle.y - 110, "🎁➜✨✨✨", "#ffe066", 30); for (let i = 0; i < 4; i++) spawn(field, rng); }
  else if (r < 0.8 && lvl && lvl.total) { lvl.left += 10; lvl.total += 10; view.text(field.nozzle.x, field.nozzle.y - 110, "🎁➜⏱+10", "#7be495", 30); }
  else { const n = Math.max(50, Math.round(incomePerSec() * 40)); save.coins += n; flyCoins(field.nozzle.x, field.nozzle.y, 8); view.text(field.nozzle.x, field.nozzle.y - 110, `🎁➜${COIN}`, "#ffe066", 30); }
}

// ------------------------------------------------------------------ the daily gift
const today = () => new Date().toISOString().slice(0, 10);
async function dailyGift() {
  const d = today();
  if (save.giftDay === d || save.catches < 5) return;
  const y = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const streak = save.giftDay === y ? Math.min(7, (save.giftStreak ?? 0) + 1) : 1;
  const prize = Math.round(Math.max(150, incomePerSec() * 90) * streak);
  const box = $("gift");
  box.innerHTML = `<div class="chest">🎁</div><div class="days">${Array.from({ length: 7 }, (_, i) => `<i class="${i < streak ? "on" : ""}">${i === 6 ? "⭐" : "●"}</i>`).join("")}</div><div class="prize">${COIN} +${short(prize)}</div><button class="btn big go" id="giftGo">✔</button>`;
  box.classList.remove("hidden"); sfx.reveal("epic");
  await new Promise<void>((r) => { $("giftGo").onclick = () => r(); });
  save.giftDay = d; save.giftStreak = streak; save.coins += prize; writeSave(save);
  flyCoins(view.W / 2, view.H / 2, 10);
  box.classList.add("hidden"); updateUi();
}

// ------------------------------------------------------------------ levels
/** every place: five short levels, each with its own task, then the giant */
type Task = "any" | "species" | "combo" | "golden" | "rival" | "giant" | "bush" | "slide" | "sticky" | "lava" | "float" | "bonus";
/** each place's own level: what makes it play differently from every other place */
const PLACE_TASK: Record<string, Task> = { meadow: "combo", forest: "bush", frost: "slide", candy: "sticky", volcano: "lava", moon: "float" };
const MISS_TASKS: Task[] = ["slide", "lava", "float"];
const LEVEL_TASKS: Task[] = ["any", "species", "combo", "golden", "rival"];
type Twist = NonNullable<Field["twist"]>;
const TWISTS: Twist[] = ["fog", "big", "tiny", "wind", "gold", "rush"];
const TWIST_ICON: Record<Twist, string> = { fog: "🌫️", big: "🐘", tiny: "🐜", wind: "🌬️", gold: "🌧️✨", rush: "🏃💨" };
interface Level { twist: Twist | null; biome: BiomeId; idx: number; task: Task; goal: number; count: number; left: number; total: number; stolen: number; target: string | null; done: boolean; hard: boolean }
let lvl: Level | null = null;
const placeIndex = (b: BiomeId) => BIOMES.findIndex((x) => x.id === b);
/** seven nodes per place: 0 and 1, then a fork (2-3 the normal way, 5-6 the risky way: a lucky wheel and a hard level), then 4, then the giant */
/** the lap: 0 = the first trip to the Moon, 1+ = night trips (every place again, at night, with fresh level maps) */
const lapNow = () => Math.floor((save.giantWins ?? 0) / GIANTS.length);
const lapKey = (b: BiomeId) => (lapNow() ? `${b}@${lapNow()}` : b);
const starsOf = (b: BiomeId) => { const st = ((save.stars ??= {})[lapKey(b)] ??= [0, 0, 0, 0, 0, 0, 0]); while (st.length < 7) st.push(0); return st; };
const branch = (b: BiomeId) => { const st = starsOf(b); return st[2] || st[3] ? "a" : st[5] || st[6] ? "b" : null; };
function nodeOpen(b: BiomeId, i: number) {
  const st = starsOf(b), br = branch(b);
  if (i === 0) return true;
  if (i === 1) return st[0] > 0;
  if (i === 2) return st[1] > 0 && br !== "b";
  if (i === 5) return st[1] > 0 && br !== "a";
  if (i === 3) return st[2] > 0;
  if (i === 6) return st[5] > 0;
  if (i === 4) return st[3] > 0 || st[6] > 0;
  return false;
}
const levelsDone = (b: BiomeId) => { const st = starsOf(b); return st[0] > 0 && st[1] > 0 && st[4] > 0 && ((st[2] > 0 && st[3] > 0) || (st[5] > 0 && st[6] > 0)); };
const TASK_ICON: Record<Task, string> = { any: "🎯", species: "", combo: "🔥", golden: "✨", rival: "🛡️", giant: "👑", bush: "🌳", slide: "⛸️", sticky: "🍬", lava: "🔥", float: "🫧", bonus: "🎁" };
function makeLevel(b: BiomeId, idx: number): Level {
  const k = placeIndex(b), hard = idx === 6;
  // node 2 is the place's own level, node 3 the other classic (combo or golden)
  const own = PLACE_TASK[b] ?? "combo";
  const task: Task = idx === 7 ? "giant" : idx === 5 ? "bonus" : hard ? (["any", "species", "golden"] as Task[])[k % 3] : idx === 2 ? own : idx === 3 ? (own === "combo" ? "golden" : k % 2 ? "combo" : "golden") : LEVEL_TASKS[Math.min(4, idx)];
  const commons = critterOf(b).filter((d) => d.rarity === "common");
  const target = task === "species" ? commons[(k + idx) % commons.length].id : null;
  const goal0 = task === "bonus" ? 8 + k * 2 : task === "bush" ? 8 + k : task === "slide" ? 10 + k : task === "sticky" ? 6 + k : task === "lava" ? 10 + k : task === "float" ? 10 + k : task === "any" ? (k ? 11 + k * 3 : 8) : task === "species" ? 7 + k : task === "combo" ? (k === 0 ? 4 : 6 + (k >= 2 ? 1 : 0)) : task === "golden" ? 7 + k : task === "rival" ? 18 + k * 3 : 1;
  const total = task === "giant" ? 0 : task === "bonus" ? 30 : task === "golden" ? 35 : task === "rival" ? 55 : MISS_TASKS.includes(task) || task === "bush" || task === "sticky" ? 55 : idx === 0 ? 60 : 45;
  const goal = Math.round((hard ? goal0 * 1.6 : goal0) * (1 + 0.12 * Math.min(4, lapNow())));
  const more = task === "giant" ? 0 : 8 * perkN("time");
  // a twist on most levels (not the first ones, the treasure room or the giant), different every time you play
  const twist = task === "giant" || task === "bonus" || (k === 0 && idx < 2) || Math.random() < 0.25 ? null : TWISTS[Math.floor(Math.random() * TWISTS.length)];
  return { twist, biome: b, idx, task, goal, count: 0, left: total + more, total: total + more, stolen: 0, target, done: false, hard };
}
/** what the level asks for, as a picture: the icon (or the critter), the count and the goal */
function taskHtml(l: Level) {
  const icon = l.task === "species" && l.target ? ic(l.target) : l.task === "rival" ? `<img src="./art/kid_rival.webp" alt="">🛡️` : TASK_ICON[l.task];
  const extra = l.task === "rival" ? ` <span class="lives">${"😏".repeat(l.stolen)}${"·".repeat(Math.max(0, 3 - l.stolen))}</span>` : MISS_TASKS.includes(l.task) ? ` <span class="lives">${"❤️".repeat(Math.max(0, 5 - l.stolen))}${"🖤".repeat(Math.min(5, l.stolen))}</span>` : "";
  return `<div class="task">${l.twist ? `<span class="tw">${TWIST_ICON[l.twist]}</span>` : ""}<span class="ti">${icon}</span><b>${l.count}/${l.goal}</b>${extra}<span class="tt">⏱${Math.ceil(l.left)}</span></div>`;
}
async function startLevel(b: BiomeId, idx: number) {
  if (busy) return;

  if (idx >= 7) {
    const g = nextGiant();
    if (g.biome !== b || barPower() < g.need) { sfx.nope(); const fh = $("levels").querySelector(".node.giant"); fh?.classList.remove("nope"); void (fh as HTMLElement | null)?.offsetWidth; fh?.classList.add("nope"); return; }
  }
  $("levels").classList.add("hidden");
  // Poki's natural break: from the map back into play (Poki decides whether an ad actually shows; never before the first catches)
  if (save.catches > 20) { busy = true; input.on = false; await commercialBreak(); busy = false; }
  lvl = makeLevel(b, idx);
  field = newField(view.W, view.H, save.up, b); field.script = 2;
  field.favor = lvl.target; field.rivalFast = lvl.task === "rival"; applyPerks(field);
  field.bonus = lvl.task === "bonus"; if (field.bonus) field.eventT = 0.6;
  field.twist = lvl.twist;
  if (lvl.twist) { const tw = lvl.twist; setTimeout(() => { view.text(view.W / 2, view.H * 0.38, TWIST_ICON[tw], "#ffffff", 54); sfx.event(); }, 500); }
  const m2: Record<string, Field["mode2"]> = { bush: "bush", slide: "slide", sticky: "sticky", lava: "lava", float: "float" };
  field.mode2 = m2[lvl.task] ?? null;

  if (lvl.task === "golden") field.lure = 999;
  for (let i = 0; i < 6; i++) spawn(field, rng);
  if (field.mode2) { for (const c of field.critters) if (Math.random() < 0.75) makeSpecial(field, c, rng); showHowTo(lvl.task); }
  if (lvl.task === "giant") { field.giantT = 1.5; field.fury = Math.min(4, Math.floor((save.giantWins ?? 0) / 1.5)); field.attackT = 2.5; }
  mode = "field"; gameplayStart(); updateUi();
}
/** first time a level type is played: a short picture of what to do */
function showHowTo(task: Task) {
  const key = "how_" + task;
  if (save.tips.includes(key)) return;
  save.tips.push(key); writeSave(save);
  const how: Record<string, string> = { bush: "🌳 ➜ 🌀🌀 ➜ 🐰", slide: "⛸️🐧 ➜ 🌀 · 💨 = 🖤", sticky: "🍬🐻 ➜ 🌀🌀🌀 ➜ ✔", lava: "🔥🐣 ➜ 🌀 · 🌋 = 🖤", float: "🫧🐰 ➜ 🌀 · 🚀 = 🖤" };
  if (how[task]) toast(how[task], 3600);
}
/** the level is over: stars by time left, coins, then back to the map */
function endLevel(win: boolean) {
  const l = lvl; if (!l || l.done) return;
  l.done = true; input.on = false; gameplayStop();
  const k = l.total ? l.left / l.total : 1;
  const stars = !win ? 0 : l.task === "giant" ? 3 : l.task === "bonus" ? Math.max(1, Math.min(3, Math.ceil((l.count / l.goal) * 3))) : k >= 0.5 ? 3 : k >= 0.25 ? 2 : 1;
  const prize = win ? Math.round((incomePerSec() * 25 + 80 * (1 + placeIndex(l.biome) * 3)) * (1 + stars * 0.5) * (l.hard ? 2.5 : 1)) : 0;
  if (win && l.idx < 7) { const st = starsOf(l.biome); st[l.idx] = Math.max(st[l.idx], stars); }
  save.coins += prize; writeSave(save);
  if (l.task === "giant") return; // the giant has its own celebration and then the journey
  const box = $("lvlEnd");
  box.innerHTML = `<div class="stars">${[0, 1, 2].map((i) => `<i class="${i < stars ? "on" : ""}" style="animation-delay:${0.15 + i * 0.25}s">★</i>`).join("")}</div>
    ${win ? `<div class="prize">${COIN} +${short(prize)}</div>` : `<div class="fail">😅</div>`}
    <div class="row">${win ? "" : `<button class="btn big rush" id="lvlRetry">↻</button>`}<button class="btn big go" id="lvlNext">▶</button></div>`;
  box.classList.remove("hidden");
  if (win) { sfx.reveal(stars === 3 ? "legendary" : "epic"); flyCoins(view.W / 2, view.H / 2, 8); } else sfx.nope();
  $("lvlNext").onclick = () => { box.classList.add("hidden"); void toMap(); };
  const r = document.getElementById("lvlRetry"); if (r) r.onclick = () => { box.classList.add("hidden"); lvl = null; void startLevel(l.biome, l.idx); };
}
/** between levels: the map of this place (a natural pause for an ad) */
/** big screens (chests, gift, rival, evolution) come one after another, never on top of each other */
let overlayQ: Promise<unknown> = Promise.resolve();
const queued = <T>(f: () => Promise<T>) => { const r = overlayQ.then(f, f); overlayQ = r.catch(() => undefined); return r; };
const OVERLAYS = ["gift", "vs", "perks", "evolve", "finale", "journey", "world", "dream", "launch"];
const overlayOpen = () => OVERLAYS.some((id) => !$(id).classList.contains("hidden"));
/** meeting the rival: you, the Moon, him. Once, before the race track starts to matter. */
async function meetRival() {
  if (save.tips.includes("rival")) return;
  save.tips.push("rival"); writeSave(save);
  const box = $("vs");
  box.innerHTML = `<img class="me" src="./art/kid_vac.webp" alt=""><div class="mid"><span class="moon">🌙</span><b>VS</b></div><img class="him" src="./art/kid_rival.webp" alt=""><div class="row2"><span>🌼</span><i></i><span>🌙</span></div><button class="btn big go" id="vsGo">▶</button>`;
  box.classList.remove("hidden"); sfx.reveal("epic");
  await new Promise<void>((r) => { $("vsGo").onclick = () => r(); });
  box.classList.add("hidden");
  // point at the race track for a moment
  const rc = $("race"); rc.classList.add("flash"); setTimeout(() => rc.classList.remove("flash"), 3000);
}
async function toMap() {
  lvl = null; mode = "field";
  if (save.catches >= 10) await queued(meetRival);
  syncRoad();
  if (field.biome !== save.biome || field.critters.length === 0) { field = newField(view.W, view.H, save.up, save.biome); field.script = 2; for (let i = 0; i < 5; i++) spawn(field, rng); }
  renderLevels(); updateUi();
}
let mapKidAt: number | null = null, mapKidPlace: BiomeId | null = null;
/** the place's map: two levels, a fork (the normal way or the risky way), one more level, the giant */
const NODE_TALL: Record<number, [number, number]> = { 0: [24, 88], 1: [50, 74], 2: [22, 57], 3: [22, 38], 5: [78, 57], 6: [78, 38], 4: [50, 24], 7: [50, 6] };
/** on wide screens the same map runs left to right */
const NODE_WIDE: Record<number, [number, number]> = { 0: [6, 62], 1: [20, 50], 2: [36, 24], 3: [54, 24], 5: [36, 78], 6: [54, 78], 4: [70, 50], 7: [88, 46] };
let NODE_POS = NODE_TALL;
const LINKS: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [5, 6], [6, 4], [4, 7]];
function renderLevels() {
  NODE_POS = innerWidth > innerHeight ? NODE_WIDE : NODE_TALL;
  $("levels").classList.toggle("wide", NODE_POS === NODE_WIDE);
  const b = save.biome, st = starsOf(b), box = $("levels"), br = branch(b);
  const order = [0, 1, ...(br === "b" ? [5, 6] : br === "a" ? [2, 3] : [2, 5]), 4];
  const next = order.find((i) => nodeOpen(b, i) && st[i] === 0);
  const g = nextGiant();
  const offWay = (a: number, c: number) => (br === "b" && (a === 2 || a === 3 || c === 2)) || (br === "a" && (a === 5 || a === 6 || c === 5));
  const line = ([a, c]: [number, number]) => { const [x1, y1] = NODE_POS[a], [x2, y2] = NODE_POS[c]; return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${offWay(a, c) ? "off" : ""}"/>`; };
  box.innerHTML = `<svg class="path" viewBox="0 0 100 100" preserveAspectRatio="none">${LINKS.map(line).join("")}</svg>` + Object.entries(NODE_POS).map(([key, [x, y]]) => {
    const i = +key;
    if (i === 7) {
      const ready = levelsDone(b) && g.biome === b;
      return `<button class="node giant${ready && barPower() >= g.need ? " go" : ""}${ready ? "" : " locked"}" data-i="7" style="left:${x}%;top:${y}%">${giantImg(g.id)}${ready ? "" : "<i>🔒</i>"}</button>`;
    }
    // one way forward: only the next level can be played (at the fork, both ways are offered)
    const fork = st[1] > 0 && !br && (i === 2 || i === 5);
    // every level done but the bar is short: finished levels can be played again for coins
    const grind = levelsDone(b) && barPower() < g.need && st[i] > 0;
    const open = nodeOpen(b, i) && (i === next || fork || grind);
    const done = st[i] > 0;
    let icon: string, cls = done ? " done" : "";
    if (i === 5) { icon = "🎁"; cls = " wheel"; }
    else {
      const L = makeLevel(b, i);
      icon = L.task === "species" && L.target ? ic(L.target) : L.task === "rival" ? `<img src="./art/kid_rival.webp" alt="">` : TASK_ICON[L.task];
      if (i === 6) { icon = `💀`; cls = " hard"; }
    }
    return `<button class="node${cls}${open || done ? "" : " locked"}${open ? " next" : ""}${grind ? " replay" : ""}" data-i="${i}" style="left:${x}%;top:${y}%"><span class="ni">${open || done ? icon : "🔒"}</span><span class="ns">${[0, 1, 2].map((k) => `<i class="${k < st[i] ? "on" : ""}">★</i>`).join("")}</span></button>`;
  }).join("");
  box.classList.remove("hidden");
  for (const el of box.querySelectorAll<HTMLElement>(".node")) el.onclick = () => { if (!el.classList.contains("next") && !el.classList.contains("go")) { sfx.nope(); return; } sfx.tap(); void startLevel(b, +el.dataset.i!); };
  // where you are: the place's sign at the top, and the kid standing on the next level (walking there from the last one)
  const here = BIOMES.find((x) => x.id === b)!;
  const at = next ?? (levelsDone(b) ? 7 : 0);
  box.insertAdjacentHTML("beforeend", `<div class="placeTag">${here.icon}<small>${placeIndex(b) + 1}/${BIOMES.length}</small></div><img class="mapKid" src="./art/kid_vac.webp" alt="">`);
  const kid = box.querySelector<HTMLElement>(".mapKid")!;
  const from = mapKidAt !== null && mapKidAt !== at && mapKidPlace === b ? mapKidAt : at;
  const put = (n: number) => { const [x, y] = NODE_POS[n]; kid.style.left = `${x}%`; kid.style.top = `${y}%`; };
  put(from);
  if (from !== at) requestAnimationFrame(() => requestAnimationFrame(() => { kid.classList.add("walk"); put(at); }));
  mapKidAt = at; mapKidPlace = b;
}

/** the rival's pace: when he beats each giant, in seconds of your play time. Ahead early, catchable mid-road,
 *  and a good run beats him to the Moon. After the Moon he keeps going, a giant every four minutes. */
const RIVAL_AT = [85, 200, 370, 580, 830, 1120];
const rivalAt = (i: number) => i < RIVAL_AT.length ? RIVAL_AT[i] : RIVAL_AT[RIVAL_AT.length - 1] + (i - RIVAL_AT.length + 1) * 240;
function rivalPos(pt: number) {
  let i = 0; while (rivalAt(i) <= pt) i++;
  const a = i ? rivalAt(i - 1) : 0, b = rivalAt(i);
  return i + (pt - a) / (b - a);
}
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
/** the race under the giant bar: the six stops, you and the rival */
let raceKey = "";
function renderRace() {
  const box = $("race");
  if (mode !== "field") { box.innerHTML = ""; raceKey = ""; return; }
  const wins = save.giantWins ?? 0, lap = Math.floor(wins / GIANTS.length), base = lap * GIANTS.length;
  const doneHere = starsOf(nextGiant().biome).filter((x, i) => x > 0 && i !== 5 || (i === 5 && x > 0)).length;
  const mine = wins + Math.min(0.95, doneHere / 6) - base;
  const his = rivalPos(save.playTime ?? 0) - base;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / GIANTS.length) * 100)).toFixed(1)}%`;
  const key = `${lap}|${pct(mine)}|${pct(his)}`;
  if (key === raceKey) return;
  if (!raceKey || box.dataset.lap !== String(lap)) {
    box.dataset.lap = String(lap);
    box.innerHTML = `<div class="track">${BIOMES.map((b, i) => `<span class="st" style="left:${((i + 1) / GIANTS.length) * 100}%">${b.icon}</span>`).join("")}<img class="who him" src="./art/kid_rival.webp" alt=""><img class="who me" src="./art/kid_vac.webp" alt=""></div>${lap ? `<b class="lap">★${lap + 1}</b>` : ""}`;
  }
  raceKey = key;
  (box.querySelector(".me") as HTMLElement).style.left = pct(mine);
  (box.querySelector(".him") as HTMLElement).style.left = pct(his);
  box.classList.toggle("ahead", mine >= his);
}
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
/** short numbers: 3 significant digits at most (9,870 · 12.3K · 394M · 1.25B) */
const short = (n: number) => { if (n < 10_000) return Math.floor(n).toLocaleString(); const u = n < 1e6 ? [1e3, "K"] : n < 1e9 ? [1e6, "M"] : [1e9, "B"]; const v = n / (u[0] as number); return `${v >= 100 ? Math.round(v) : v.toPrecision(3)}${u[1]}`; };
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
  const fhHtml = mode === "rush" ? "" : lvl && lvl.task !== "giant" ? taskHtml(lvl) : gHere ? gauge(gHere) : `<span class="where">${BIOMES.find((b) => b.id === ngF.biome)!.icon}</span>${gauge(ngF)}`;
  // only rebuilt when it changes, so the bar can animate and a number pop is not wiped
  if ($("fhPlace").dataset.h !== fhHtml) { $("fhPlace").dataset.h = fhHtml; $("fhPlace").innerHTML = fhHtml; }
  $("fhGoal").textContent = "";
  renderTools();
  renderUpBar();
  $("rateN").textContent = incomePerSec() > 0 ? ` +${short(incomePerSec())}/s` : "";
  renderRace();
  $("worldBtn").classList.toggle("ready", homeReady());
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
  const gH = mode === "rush" ? null : giantLeft(field.biome), L = barPower();
  field.giant = gH && lvl?.task === "giant" ? { id: gH.id, ready: L >= gH.need, resist: gH.resist, scale: gH.scale } : null;
  const teasing = field.critters.some((c) => c.tease && c.state !== "caught");
  const onMap = mode === "field" && !lvl && !$("levels").classList.contains("hidden");
  view.mapMode = onMap;
  view.giant = gH && !teasing && !onMap ? { art: CRITTER_BY_ID[gH.id].art, ready: L >= gH.need, k: Math.min(1, L / gH.need) } : null;
  view.vac = L;
  view.night = mode !== "rush" && lapNow() > 0;
  view.tier = tierOf(vacLevel(save.up));
  const sp = $("specialBtn");
  sp.classList.toggle("hidden", view.tier === 0 || !lvl || lvl.done || mode !== "field");
  sp.classList.toggle("ready", field.special >= 1);
  sp.style.setProperty("--k", String(field.special));
  view.skin = SKINS[Math.min(SKINS.length - 1, (save.giantWins ?? 0) % GIANTS.length + (lapNow() ? 1 : 0))] ?? SKINS[0];
  if (mode === "rush" && rush) {
    rush.left -= dt;
    stepField(field, dt, input, RUSH_UP, rushRng);
    handleEvents();
    setVacuum(field.beam, 0.5, field.critters.some((c) => c.state === "tug"));
    view.drawField(field, RUSH_UP, t, dt);
    if (rush.left <= 0) endRush();
  } else if (mode === "field") {
    field.eventsOn = !!lvl && !lvl.done && lvl.task !== "giant" && (save.catches >= 8 || lvl.task === "bonus");
    field.rivalOn = !!lvl && !lvl.done && (save.catches >= 10 || lvl.task === "rival") && lvl.task !== "giant" && lvl.task !== "golden";
    const playing = !!lvl && !lvl.done && !overlayOpen();
    if (started && !busy) { if (playing) gameplayStart(); else gameplayStop(); }
    if (playing && !document.hidden && started) save.playTime = (save.playTime ?? 0) + dt;
    if (playing && lvl!.total) { lvl!.left -= dt; if (lvl!.left <= 0) { lvl!.left = 0; endLevel(lvl!.task === "bonus" || (lvl!.task === "rival" && lvl!.stolen < 3 && lvl!.count >= lvl!.goal)); } }
    if (!playing) input.on = false;
    stepField(field, playing ? dt : dt * 0.3, input, save.up, rng);
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
  if (!save.tips.includes("road")) {
    save.tips.push("road"); writeSave(save);
    void (async () => { await showDream(); const w = showWorld({ walkFrom: 0 }); setTimeout(() => (document.querySelector("#world .pin.here") as HTMLElement | null)?.click(), 1500); await w; })();
  }
  setTimeout(() => void queued(dailyGift), 1200);
  if (!save.tips.includes("intro") && save.catches === 0) { lvl = makeLevel("meadow", 0); lvl.left = lvl.total = 60; } else renderLevels();
  if (save.catches > 0) $("hint").classList.add("hidden");
  const coin = img("coin"), jarImg = img("jar");
  if (coin) $("coinIco").innerHTML = `<img src="./art/coin.webp" alt="">`;
  if (jarImg) $("jarIco").innerHTML = `<img src="./art/jar.webp" alt="">`;
  updateUi();
  requestAnimationFrame((n) => { last = n; requestAnimationFrame(frame); });
});
// test handle for automated checks (harmless in production)
if (import.meta.env.MODE === "qa") (window as unknown as { __cv: unknown }).__cv = {
  field: () => field, save,
  /** test hook: the level in play (so a capture can make it last) */
  lvl: () => lvl,
  spawn: (id: string, opt: { mut?: "gold" | "rainbow" | "giant" | null; boss?: boolean; x?: number } = {}) => {
    const c = spawn(field, rng, { def: CRITTER_BY_ID[id], mut: opt.mut ?? null, x: opt.x });
    if (opt.boss) { c.boss = 3; c.scale = 2.1; }
    return c.uid;
  },
};
