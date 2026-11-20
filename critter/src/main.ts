import "@fontsource/fredoka/500.css";
import "@fontsource/fredoka/600.css";
import "@fontsource/fredoka/700.css";
import "./style.css";
import { newField, stepField, spawn, type Field } from "./core/field.ts";
import { OFFLINE_CAP_MS, UPGRADES, UPGRADE_ORDER, catchCoins, power, range, tankSize, upgradeCost, type UpgradeId } from "./core/economy.ts";
import { makeRng } from "./core/rng.ts";
import { loadSave, writeSave } from "./core/save.ts";
import { BIOMES, CRITTERS, CRITTER_BY_ID, MUTATIONS, RARITY_COLOR, STAR_MULT, starOf } from "./data/critters.ts";
import type { BiomeId } from "./core/types.ts";
import { commercialBreak, gameplayStart, gameplayStop, initPoki, loadingFinished, rewardedBreak } from "./platform/poki.ts";
import { setDucked, setMuted, setRain, sfx, unlockAudio } from "./platform/audio.ts";
import { View, img, loadArt } from "./render/view.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const save = loadSave();
const view = new View($<HTMLCanvasElement>("game"));
const rng = makeRng((Date.now() & 0xffff) + 1);
let field: Field = newField(view.W, view.H, save.up, save.biome);
/** which place's page of the park is showing */
let parkBiome: BiomeId = save.biome;
let mode: "field" | "park" = "field";
/** what is in the jar right now (species and mutation of each critter) */
let jar: { id: string; mut: string | null }[] = [];
let busy = false, t = 0;

// ------------------------------------------------------------------ input: hold anywhere to suck, aim with the finger
const input = { on: false, x: view.W * 0.6, y: view.H * 0.7 };
const canvas = $("game");
const aimAt = (e: PointerEvent) => { const p = view.toWorld(e.clientX, e.clientY); input.x = p.x; input.y = p.y; };
canvas.addEventListener("pointerdown", (e) => { unlockAudio(); aimAt(e); if (mode === "field") { input.on = true; firstTouch(); } });
window.addEventListener("pointermove", (e) => { if (input.on || e.pointerType === "mouse") aimAt(e); });
window.addEventListener("pointerup", () => { input.on = false; });
window.addEventListener("pointercancel", () => { input.on = false; });
window.addEventListener("keydown", (e) => { if (e.key === " ") { input.on = true; firstTouch(); } });
window.addEventListener("keyup", (e) => { if (e.key === " ") input.on = false; });
window.addEventListener("resize", () => { view.resize(); field.W = view.W; field.H = view.H; field.farY = view.H * 0.6; field.nearY = view.H * 0.88; });

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
  if (earned > 0 && away > 60_000) setTimeout(() => toast(`🏡 +🪙${earned.toLocaleString()} while you were away!`, 3200), 600);
  save.coins += earned;
}

// ------------------------------------------------------------------ field events
function handleEvents() {
  for (const e of field.ev) {
    if (e.kind === "caught") {
      const c = e.c, mult = MUTATIONS.find((m) => m.id === c.mut)?.mult ?? 1;
      jar.push({ id: c.def.id, mut: c.mut });
      const coins = catchCoins(c.def.income, mult);
      save.coins += coins; save.catches++;
      const isNew = !save.index[c.def.id] && !jar.slice(0, -1).some((j) => j.id === c.def.id);
      sfx.hook(c.def.rarity === "legendary" ? "legendary" : c.def.rarity);
      view.burst(field.nozzle.x, field.nozzle.y, c.mut === "gold" ? "#ffd84a" : RARITY_COLOR[c.def.rarity], c.def.rarity === "common" && !c.mut ? 10 : 24);
      view.text(field.nozzle.x + 40, field.nozzle.y - 34 - (field.jar % 2) * 22, isNew ? `NEW! ${c.def.name}` : `+🪙${coins}`, isNew ? "#ff9ad1" : "#ffe066", isNew ? 20 : 17);
      if (c.mut || c.def.rarity === "epic" || c.def.rarity === "legendary") { view.shake = 8; sfx.reveal(c.def.rarity === "legendary" ? "legendary" : "epic"); }
      if (isNew) sfx.newFish();
      if (field.jar >= field.cap) { toast("🫙 Jar full! Bring them to the park", 2400); sfx.event(); }
    } else if (e.kind === "tug") {
      sfx.turn();
      view.text(e.c.x, e.c.y - 95, e.c.mut === "gold" ? "✨ GOLDEN! Hold on!" : "💪 Hold on!", "#ffe066", 16);
    } else if (e.kind === "escape") {
      view.text(e.c.x, e.c.y - 40, "💨 escaped!", "#ffffff", 14); sfx.snap();
    } else if (e.kind === "full") {
      $("parkBtn").classList.add("pulse");
    } else if (e.kind === "surprise") {
      sfx.event(); view.shake = 4;
      if (e.s === "visitor" && e.c) toast(`✨ A wild ${e.c.def.name} appeared!`, 2600);
      else if (e.s === "golden_rain") toast("🌟 Golden critters! Quick!", 2400);
      else toast("🏃 Stampede! Suck them all up!", 2400);
    } else if (e.kind === "spawn" && e.c.mut) {
      // a mutated one arrives: make sure the player notices it
      view.burst(e.c.x, e.c.y - 30, e.c.mut === "gold" ? "#ffd84a" : "#c9a7ff", 16, 120);
    }
  }
  field.ev.length = 0;
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
  toast("✨ The next 3 critters will be GOLDEN!", 2600);
  sfx.reveal("epic");
  await goField();
}

function buy(id: UpgradeId) {
  const cost = upgradeCost(save.up, id);
  if (cost === null || cost > save.coins) return;
  save.coins -= cost; save.up[id]++;
  sfx.buy(); writeSave(save); updateUi();
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
    el.innerHTML = owned ? `${b.icon} ${b.name}` : `🔒 ${b.icon} 🪙${b.price.toLocaleString()}`;
    el.disabled = !owned && save.coins < b.price;
    el.onclick = () => {
      if (!owned) { if (save.coins < b.price) return; save.coins -= b.price; save.biomes.push(b.id); sfx.reveal("legendary"); toast(`${b.icon} ${b.name} unlocked!`, 2400); }
      parkBiome = b.id; save.biome = b.id; writeSave(save); biomesKey = ""; updateUi();
    };
    box.appendChild(el);
  }
}

// ------------------------------------------------------------------ ui
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
const UP_NAME: Record<UpgradeId, string> = { power: "Suction", range: "Reach", tank: "Jar" };

function updateUi() {
  $("coinsN").textContent = short(save.coins);
  $("indexN").textContent = `${Object.keys(save.index).length}/${CRITTERS.length}`;
  const bi = BIOMES.find((b) => b.id === save.biome)!;
  $("goBtn").textContent = `${bi.icon} Catch more!`;
  $("jarN").textContent = `${field.jar}/${field.cap}`;
  ($("jarFill") as HTMLElement).style.width = `${Math.round((field.jar / field.cap) * 100)}%`;
  $("fieldUi").classList.toggle("hidden", mode !== "field");
  $("parkUi").classList.toggle("hidden", mode !== "park");
  $("incomeN").textContent = `🪙 ${short(incomePerSec())}/s`;
  renderBiomes();
  const box = $("ups");
  box.innerHTML = "";
  for (const id of UPGRADE_ORDER) {
    const cost = upgradeCost(save.up, id);
    const b = document.createElement("button");
    b.className = "btn up";
    b.disabled = cost === null || cost > save.coins;
    b.innerHTML = `<span class="ui">${UPGRADES[id].icon}</span><span class="un">${UP_NAME[id]}</span><span class="ul">⬆${UP_LABEL[id](save.up[id] + 1)}</span><span class="uc">${cost === null ? "MAX" : "🪙" + short(cost)}</span>`;
    b.onclick = () => buy(id);
    box.appendChild(b);
  }
}

$("parkBtn").onclick = () => void goPark();
$("goBtn").onclick = () => void goField();
$("lureBtn").onclick = () => void lure();
$("muteBtn").onclick = () => { save.muted = !save.muted; setMuted(save.muted); $("muteBtn").textContent = save.muted ? "🔇" : "🔊"; writeSave(save); };

// ------------------------------------------------------------------ main loop
let last = performance.now(), uiT = 0, coinAcc = 0;
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
  // the park pays every second, wherever you are
  coinAcc += incomePerSec() * dt;
  if (coinAcc >= 1) { const n = Math.floor(coinAcc); coinAcc -= n; save.coins += n; save.lastSeen = Date.now(); }
  if (mode === "field") {
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
  if (save.catches > 0) $("hint").classList.add("hidden");
  const coin = img("coin"), jarImg = img("jar");
  if (coin) $("coinIco").innerHTML = `<img src="./art/coin.webp" alt="">`;
  if (jarImg) $("jarIco").innerHTML = `<img src="./art/jar.webp" alt="">`;
  updateUi();
  requestAnimationFrame((n) => { last = n; requestAnimationFrame(frame); });
});
void CRITTER_BY_ID;
