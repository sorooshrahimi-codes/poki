import { catchValue, diveCatches, resolveSnap, startDive, stepDive, type Dive, type DiveInput } from "./core/dive.ts";
import { noteDive, noteSurprise, pickSurprise } from "./core/director.ts";
import { UPGRADES, UPGRADE_ORDER, capacity, maxDepth, upgradeCost } from "./core/economy.ts";
import { currentEvent, isNight, nextWorldEvent, personalEventDue, type ActiveEvent } from "./core/events.ts";
import type { Catch, UpgradeId, ZoneId } from "./core/types.ts";
import { FISH, FISH_BY_ID } from "./data/fish.ts";
import { COSMETICS, TRY_DIVES, aquariumEarned, aquariumFish, aquariumRate, milestoneMet, type CosmeticDef } from "./data/cosmetics.ts";
import { MERGE_COUNT, ORDER_SLOTS, canFill, fill, keep, matching, merge, newOrder, tankPower, type Order } from "./core/tank.ts";
import { MISSIONS } from "./data/missions.ts";
import { BAIT_BY_ID, GEAR, lanternRadius, shopOffers, sonarRange, type BaitDef } from "./data/gear.ts";
import { RARITY_COLOR, RARITY_ORDER, ZONES, ZONE_ORDER } from "./data/world.ts";
import { LANGS, LANG_LABEL, detectLang, fishName, getLang, setLang, t, tEvent, tRarity, tUpgrade, tWeather, tZone } from "./i18n.ts";
import { setDucked, setMusicMood, setMuted, setRain, sfx, unlockAudio } from "./platform/audio.ts";
import { WEATHER, weatherAt, type WeatherId } from "./core/weather.ts";
import { commercialBreak, gameplayStart, gameplayStop, initPoki, isAdPlaying, loadingFinished, rewardedBreak } from "./platform/poki.ts";
import { loadSave, writeSave } from "./platform/storage.ts";
import "@fontsource/fredoka/latin-500.css";
import "@fontsource/fredoka/latin-600.css";
import "@fontsource/fredoka/latin-700.css";
import { artUrl, img, loadAssets, spriteTinted } from "./render/assets.ts";
import { drawFish } from "./render/fish.ts";
import { recolor } from "./render/recolor.ts";
import { Renderer, type SceneState } from "./render/scene.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const save = loadSave();
setLang(save.lang ?? detectLang());
setMuted(save.muted);

const canvas = $<HTMLCanvasElement>("game");
const renderer = new Renderer(canvas);
const scene: SceneState = { mode: "dock", zone: save.zone, dive: null, event: null, t: 0, hint: save.dives === 0, pose: "idle", poseT: 9, weather: weatherAt(Date.now()).def.id, light: 150, sonar: 0, pet: null, hat: null, outfit: null, outfitId: null, paint: null, paintId: null };
function setPose(p: SceneState["pose"]) { if (scene.pose !== p) { scene.pose = p; scene.poseT = 0; } }
/** slow motion: remaining real seconds and the time scale while it lasts */
let slowmo = 0;

const sessionStart = Date.now();
let personalEventAt: number | null = null;
let lastEventId: string | null = null;
let paused = false;
let busy = false; // an ad or a transition is running: ignore casts
let pending: Catch[] = [];

// ------------------------------------------------------------------ input
const input: DiveInput = { targetX: null, axis: 0, hold: false };
const keys = new Set<string>();
let pointerDown = false;

canvas.addEventListener("pointerdown", (e) => {
  unlockAudio();
  pointerDown = true;
  input.targetX = renderer.toWorldX(e.clientX);
  if (scene.mode === "dock") void cast();
});
window.addEventListener("pointermove", (e) => {
  // mouse steers on hover (desktop/Chromebook); touch steers while the finger is down
  if (e.pointerType === "mouse" || pointerDown) input.targetX = renderer.toWorldX(e.clientX);
});
window.addEventListener("pointerup", () => { pointerDown = false; });
window.addEventListener("pointercancel", () => { pointerDown = false; });
window.addEventListener("keydown", (e) => {
  unlockAudio();
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();
  if (e.key === "Escape" || e.key === "p") { togglePause(); return; }
  if (e.repeat) return;
  keys.add(e.key.toLowerCase());
  if ((e.key === " " || e.key === "Enter") && scene.mode === "dock" && !anyPanelOpen()) void cast();
  if ((e.key === " " || e.key === "Enter") && scene.mode === "reveal" && !$("reveal").classList.contains("hidden")) void collect(false);
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => { keys.clear(); pointerDown = false; });

function readInput() {
  input.axis = (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
  if (input.axis) input.targetX = null;
  input.hold = pointerDown || keys.has(" ") || keys.has("arrowup") || keys.has("w");
}

const anyPanelOpen = () => ["album", "pause", "shop", "map", "wardrobe", "aquarium", "orders"].some((id) => !$(id).classList.contains("hidden"));

// ------------------------------------------------------------------ dive flow
async function cast() {
  if (busy || paused || scene.mode !== "dock" || anyPanelOpen()) return;
  busy = true;
  // the natural break: before every cast after the first. Poki decides if an ad actually plays.
  if (save.dives > 0) await commercialBreak();
  busy = false;
  if (paused) return;
  gameplayStart();
  const bait = save.bait ? BAIT_BY_ID[save.bait.id] ?? null : null;
  if (save.bait) { save.bait.uses--; if (save.bait.uses <= 0) save.bait = null; }
  activeBait = bait;
  if (save.trial) { save.trial.dives--; if (save.trial.dives < 0) save.trial = null; }
  const ctx = { upgrades: save.upgrades, event: scene.event, night: isNight(Date.now()), rng: Math.random, weather: weatherAt(Date.now()).def, bait };
  const playSec = save.playMs / 1000;
  const floor = ZONES[scene.zone].floor;
  const surprise = forcedSurprise ?? pickSurprise(save.director, playSec, { zone: scene.zone, bottom: Math.min(maxDepth(save.upgrades), floor), floor, capacity: capacity(save.upgrades) }, Math.random);
  if (surprise) noteSurprise(save.director, surprise, playSec);
  const treasure = treasureNext;
  if (treasure) { treasureNext = false; save.mapPieces -= 3; }
  // first-minute pacing: a rare is guaranteed in rounds 2-3, and round 6 teases a legend below
  const hasRare = Object.keys(save.album).some((id) => FISH_BY_ID[id] && FISH_BY_ID[id].rarity !== "common" && !FISH_BY_ID[id].junk);
  const guarantee = (save.dives === 1 || save.dives === 2) && !hasRare;
  let sur = treasure ? null : surprise;
  if (!sur && !save.seenGlimpse && save.dives === 5) { sur = "glimpse"; save.seenGlimpse = true; }
  scene.dive = startDive(scene.zone, ctx, sur, treasure, guarantee);
  scene.mode = "dive";
  scene.hint = false;
  sfx.cast();
  setPose("cast");
  setTimeout(() => { if (scene.mode === "dive") setPose("idle"); }, 650);
  renderer.splash(scene.dive.hookX);
  updateUi();
}

function handleFx(d: Dive) {
  for (const fx of d.fx) {
    if (fx.kind === "hook") {
      sfx.hook(fx.fish.def.rarity);
      renderer.burst(d.hookX, d.hookY, fx.fish.mut ? "#ffe066" : RARITY_COLOR[fx.fish.def.rarity], fx.fish.def.rarity === "common" ? 8 : 18);
      if (fx.fish.def.rarity !== "common" || fx.fish.mut) {
        renderer.shakeIt(4);
        // the catch moment: a beat of slow motion and a punch-in, so a rare catch feels special
        slowmo = 0.35; renderer.punch(d.hookX, d.hookY, 0.1);
      }
    } else if (fx.kind === "turn") { sfx.turn(); setPose("reel"); }
    else if (fx.kind === "fightWon") {
      save.stats.fightsWon++;
      sfx.reveal(fx.fish.def.rarity);
      renderer.burst(d.hookX, d.hookY, RARITY_COLOR[fx.fish.def.rarity], 40, 260);
      renderer.shakeIt(10);
      renderer.flashIt(1);
      slowmo = 0.6; renderer.punch(d.hookX, d.hookY, 0.18);
    } else if (fx.kind === "snap") {
      sfx.snap();
      renderer.shakeIt(12);
      showSnap(fx.fish.def.id, fx.fish.mut, d.fight?.retried ?? true);
    } else if (fx.kind === "surprise") {
      toast(`${SURPRISE_ICON[fx.surprise]} ${t(`sur.${fx.surprise}` as Parameters<typeof t>[0])}`, 2200);
      if (fx.surprise === "shark" || fx.surprise === "shadow") sfx.snap(); else sfx.event();
    } else if (fx.kind === "stolen") {
      toast(`🦈 ${t("stolen")}`); sfx.snap(); renderer.shakeIt(10);
    } else if (fx.kind === "sharkGone") {
      toast(`😎 ${t("escaped")}`); sfx.buy();
    } else if (fx.kind === "bottle") {
      toast(`🍾 ${t("map")} ${save.mapPieces + d.mapPieces}/3`); sfx.newFish(); renderer.burst(d.hookX, d.hookY, "#bdf3ff", 20);
    } else if (fx.kind === "chest") {
      toast(`💰 +${fx.coins}`); sfx.reveal("legendary"); renderer.burst(d.hookX, d.hookY, "#ffd84a", 40, 260); renderer.flashIt(0.6); slowmo = 0.4;
    } else if (fx.kind === "bonk") {
      sfx.bonk(); renderer.shakeIt(3);
    } else if (fx.kind === "whirlpool") {
      renderer.shakeIt(8); sfx.turn();
    } else if (fx.kind === "surface") {
      sfx.splash();
      renderer.splash(d.hookX);
    }
  }
  d.fx.length = 0;
}

const SURPRISE_ICON: Record<string, string> = { golden_school: "✨", shark: "🦈", bottle: "🍾", whirlpool: "🌀", chest: "💰", shadow: "👀" };
let pendingBonus = 0;
let activeBait: BaitDef | null = null;
/** the next cast is a treasure-map dive (costs 3 map pieces) */
let treasureNext = false;
/** test hook: force the next dive's surprise */
let forcedSurprise: Parameters<typeof noteSurprise>[1] | null = null;

function finishDive(d: Dive) {
  gameplayStop();
  pending = diveCatches(d);
  pendingBonus = d.bonusCoins;
  save.mapPieces += d.mapPieces;
  noteDive(save.director, !!d.surprise || d.hooked.some((f) => f.mut || f.def.rarity !== "common"));
  scene.mode = "reveal";
  save.dives++;
  const best = pending.reduce((m, c) => Math.max(m, RARITY_ORDER.indexOf(FISH_BY_ID[c.fish].rarity) + (c.mut ? 1 : 0)), -1);
  setPose(best >= 1 ? "cheer" : "idle");
  const star = pending.filter((c) => RARITY_ORDER.indexOf(FISH_BY_ID[c.fish].rarity) >= 3)
    .sort((a, b) => b.value - a.value)[0];
  if (star) showLegend(star, () => showReveal(pending));
  else showReveal(pending);
}

async function collect(double: boolean) {
  if (scene.mode !== "reveal") { $("reveal").classList.add("hidden"); return; } // never leave a stray panel stuck
  if (busy || $("reveal").classList.contains("hidden")) return;
  if (double) {
    busy = true;
    const ok = await rewardedBreak();
    busy = false;
    if (!ok) return;
  }
  let total = 0;
  for (const [i, c] of pending.entries()) {
    if (keepSet.has(i)) keep(save.tank, c.fish); else total += c.value;
    const e = (save.album[c.fish] ??= { count: 0, muts: [], best: 0 });
    e.count++;
    e.best = Math.max(e.best, c.value);
    e.bestKg = Math.max(e.bestKg ?? 0, c.kg ?? 0);
    save.stats.catches++;
    if (c.mut && !e.muts.includes(c.mut)) e.muts.push(c.mut);
  }
  total += pendingBonus;
  pendingBonus = 0;
  if (keepSet.size) toast(`📥 ${keepSet.size} → 🐠`, 1600);
  keepSet.clear();
  if (double) total *= 2;
  save.coins += total;
  setTimeout(checkMission, 500);
  pending.forEach((_, i) => setTimeout(() => sfx.coin(i), i * 40));
  pending = [];
  $("reveal").classList.add("hidden");
  setPose("idle");
  scene.mode = "dock";
  scene.dive = null;
  writeSave(save);
  updateUi();
}

// ------------------------------------------------------------------ panels
function fishThumb(id: string, mut: Catch["mut"], w: number, h: number, silhouette = false) {
  const cv = document.createElement("canvas");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = w * dpr; cv.height = h * dpr;
  const c = cv.getContext("2d")!;
  c.scale(dpr, dpr);
  const def = FISH_BY_ID[id];
  const sp = mut ? null : img(id);
  if (sp) {
    const k = Math.min((w * 0.92) / sp.width, (h * 0.92) / sp.height);
    c.drawImage(sp, (w - sp.width * k) / 2, (h - sp.height * k) / 2, sp.width * k, sp.height * k);
  } else if (mut && img(id)) {
    const tint = tintedThumb(id, mut);
    const k = Math.min((w * 0.92) / tint.width, (h * 0.92) / tint.height);
    c.drawImage(tint, (w - tint.width * k) / 2, (h - tint.height * k) / 2, tint.width * k, tint.height * k);
  } else {
    c.translate(w / 2, h / 2);
    const len = Math.min(w * 0.78, (h * 0.8) / Math.max(0.35, def.look.aspect));
    drawFish(c, def, mut, len, 0.3);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  if (silhouette) {
    c.globalCompositeOperation = "source-atop";
    c.fillStyle = "#123049";
    c.fillRect(0, 0, w, h);
  }
  return cv;
}

/** indices of pending catches the player chose to keep in the tank */
const keepSet = new Set<number>();
function updateRevealTotal() {
  const sold = pending.reduce((a, c, i) => a + (keepSet.has(i) ? 0 : c.value), 0);
  $("totalN").textContent = String(sold + pendingBonus);
  $("keepN").textContent = keepSet.size ? `📥 ${keepSet.size}` : "";
}

function showReveal(list: Catch[]) {
  if (scene.mode !== "reveal") return;
  keepSet.clear();
  $("keepHint").textContent = t("tank.tap");
  $("keepN").textContent = "";
  const box = $("cards");
  box.innerHTML = "";
  const order = [...list].sort((a, b) => RARITY_ORDER.indexOf(FISH_BY_ID[a.fish].rarity) - RARITY_ORDER.indexOf(FISH_BY_ID[b.fish].rarity));
  let total = 0;
  const shown = new Set<string>();
  const bestInReveal = new Map<string, number>();
  order.forEach((c, i) => {
    const def = FISH_BY_ID[c.fish];
    const isNew = !save.album[c.fish] && !shown.has(c.fish);
    const prevKg = Math.max(save.album[c.fish]?.bestKg ?? 0, bestInReveal.get(c.fish) ?? 0);
    const isRecord = !isNew && !!save.album[c.fish] && (c.kg ?? 0) > prevKg && !FISH_BY_ID[c.fish].junk;
    bestInReveal.set(c.fish, Math.max(bestInReveal.get(c.fish) ?? 0, c.kg ?? 0));
    shown.add(c.fish);
    const card = document.createElement("div");
    const idx = list.indexOf(c);
    const wanted = save.orders.some((o) => o.need.kind === "fish" ? o.need.fish === c.fish : FISH_BY_ID[c.fish].rarity === o.need.rarity && FISH_BY_ID[c.fish].zone === o.need.zone);
    card.className = "card" + (RARITY_ORDER.indexOf(def.rarity) >= 2 || c.mut ? " big" : "");
    card.style.setProperty("--rc", RARITY_COLOR[def.rarity]);
    card.style.animationDelay = `${i * 0.18}s`;
    card.appendChild(fishThumb(c.fish, c.mut, 92, 50));
    card.insertAdjacentHTML("beforeend", `<div class="cn">${fishName(def)}</div><div class="cr">${tRarity(def.rarity)}</div><div class="ck">⚖️ ${fmtKg(c.kg)}</div><div class="cv">🪙 ${c.value}</div>` +
      (c.mut ? `<div class="cm">${MUT_ICON[c.mut]}</div>` : "") + (isNew ? `<div class="newb">${t("new")}</div>` : "") + (isRecord ? `<div class="newb rec">🏆 ${t("record")}</div>` : ""));
    if (isRecord) setTimeout(() => sfx.newFish(), i * 180 + 120);
    if (wanted && !def.junk) card.insertAdjacentHTML("beforeend", `<div class="wantb">📋</div>`);
    if (!def.junk) {
      card.classList.add("keepable");
      card.onclick = () => {
        if (keepSet.has(idx)) keepSet.delete(idx); else keepSet.add(idx);
        card.classList.toggle("kept", keepSet.has(idx));
        sfx.tap();
        updateRevealTotal();
      };
    }
    box.appendChild(card);
    setTimeout(() => { sfx.reveal(def.rarity); if (isNew) sfx.newFish(); }, i * 180);
    total += c.value;
  });
  $("totalN").textContent = String(total + pendingBonus);
  $("bonusN").textContent = pendingBonus ? `💰 +${pendingBonus}` : "";
  $("collectBtn").textContent = list.length ? t("collect") : "OK";
  // the x2 offer only when there is something worth doubling
  $("doubleBtn").classList.toggle("hidden", total < 40);
  $("reveal").classList.remove("hidden");
}

/** cinematic moment for legendary and secret catches: rays, spotlight, big sprite, then the cards */
function showLegend(c: Catch, done: () => void) {
  const def = FISH_BY_ID[c.fish];
  const el = $("legend");
  el.style.setProperty("--rc", RARITY_COLOR[def.rarity]);
  $("legendRarity").textContent = tRarity(def.rarity);
  $("legendName").textContent = fishName(def) + (c.mut ? " " + MUT_ICON[c.mut] : "");
  const holder = $("legendFish");
  holder.innerHTML = "";
  holder.appendChild(fishThumb(c.fish, c.mut, 300, 170));
  el.classList.remove("hidden");
  sfx.reveal(def.rarity);
  setTimeout(() => sfx.event(), 350);
  let closed = false;
  const dive = save.dives;
  const close = () => {
    if (closed) return;
    closed = true;
    el.classList.add("hidden");
    window.removeEventListener("keydown", onKey, true);
    if (scene.mode === "reveal" && save.dives === dive) done();
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
  window.addEventListener("keydown", onKey, true);
  el.onclick = close;
  setTimeout(close, 2600);
}

const MUT_ICON: Record<string, string> = { gold: "✨", rainbow: "🌈", giant: "⬆️", ghost: "👻", electric: "⚡" };

function showSnap(id: string, mut: Catch["mut"], retried: boolean) {
  $("snapTitle").textContent = t("snapped");
  $("retryBtn").classList.toggle("hidden", retried);
  const cv = $<HTMLCanvasElement>("snapFish");
  const c = cv.getContext("2d")!;
  c.clearRect(0, 0, cv.width, cv.height);
  const sp = mut ? tintedThumb(id, mut) : img(id);
  if (sp) {
    const k = Math.min(180 / sp.width, 100 / sp.height);
    c.drawImage(sp, 100 - (sp.width * k) / 2, 55 - (sp.height * k) / 2, sp.width * k, sp.height * k);
  } else { c.save(); c.translate(100, 55); drawFish(c, FISH_BY_ID[id], mut, 150, 0); c.restore(); }
  $("snap").classList.remove("hidden");
}

async function snapChoice(retry: boolean) {
  const d = scene.dive;
  if (!d || d.phase !== "snapped" || busy) return;
  if (retry) {
    busy = true;
    const ok = await rewardedBreak();
    busy = false;
    gameplayStart();
    resolveSnap(d, ok);
  } else resolveSnap(d, false);
  $("snap").classList.add("hidden");
}

function showAlbum() {
  const grid = $("albumGrid");
  grid.innerHTML = "";
  for (const def of FISH) {
    const e = save.album[def.id];
    const cell = document.createElement("div");
    cell.className = "acell";
    cell.style.setProperty("--rc", e ? RARITY_COLOR[def.rarity] : "#2a3a4a");
    cell.appendChild(fishThumb(def.id, null, 70, 40, !e));
    cell.insertAdjacentHTML("beforeend", `<div class="an">${e ? fishName(def) : "?"}</div><div class="am">${e ? e.muts.map((m) => MUT_ICON[m]).join("") : ""}</div>${e?.bestKg ? `<div class="ak">🏆 ${fmtKg(e.bestKg)}</div>` : ""}`);
    grid.appendChild(cell);
  }
  $("albumTitle").textContent = "📖 " + t("album");
  $("albumCount").textContent = albumText();
  $("album").classList.remove("hidden");
}

const albumText = () => `${Object.keys(save.album).length}/${FISH.length}`;

// ------------------------------------------------------------------ shop
const TIER_COLOR: Record<string, string> = { basic: "#9fd0ff", fine: "#4fc3f7", magic: "#c77dff", legend: "#ffc93c" };
const FX_ICON: Record<string, string> = { rare: "🔷", epic: "🟣", legendary: "🟡", gold: "✨", rainbow: "🌈", ghost: "👻", electric: "⚡" };
const baitName = (b: BaitDef) => b.names[getLang()] ?? b.names.en;

let shownRestock = 0;
/** one plain line saying what a bait does */
function baitEffect(b: BaitDef): string {
  const parts: string[] = [];
  for (const [r, m] of Object.entries(b.rarity ?? {})) parts.push(`${FX_ICON[r] ?? ""} ${tRarity(r as Parameters<typeof tRarity>[0])} ×${m}`);
  for (const [k, m] of Object.entries(b.mutation ?? {})) parts.push(`${FX_ICON[k] ?? ""} ×${m}`);
  if (b.attracts?.length) parts.push(`🧲 ${t("fx.attracts")}`);
  if (b.unlocksSecret) parts.push(`❓ ${t("fx.secret")}`);
  return parts.join("<br>");
}

/** what you own right now and where it is working */
function renderMyGear() {
  const bait = save.bait ? BAIT_BY_ID[save.bait.id] : null;
  const rows = [
    bait ? `<div class="gi"><img src="${artUrl(bait.art)}" alt=""><span><b>${baitName(bait)}</b> · 🎣 ${save.bait!.uses} ${t("fx.casts")}<br><small>${baitEffect(bait).replace(/<br>/g, " · ")}</small></span></div>`
      : `<div class="gi dim"><span>🪱 ${t("fx.nobait")}</span></div>`,
    `<div class="gi"><img src="${artUrl("g_lantern")}" alt=""><span><b>${t("fx.lantern")}</b> ★${save.gear.lantern} · 💡 ${lanternRadius(save.gear.lantern)}</span></div>`,
    `<div class="gi${save.gear.sonar ? "" : " dim"}"><img src="${artUrl("g_sonar")}" alt=""><span><b>${t("fx.sonar")}</b> ★${save.gear.sonar} · ${sonarRange(save.gear.sonar) ? Math.round(sonarRange(save.gear.sonar) / 10) + " m" : "—"}</span></div>`,
  ];
  $("myGear").innerHTML = `<div class="gt">${t("fx.mygear")}</div>` + rows.join("");
}

function renderShop() {
  const now = Date.now();
  const { offers, restockAt } = shopOffers(now);
  shownRestock = restockAt;
  const left = Math.max(0, Math.ceil((restockAt - now) / 1000));
  $("restock").textContent = `🔄 ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  renderMyGear();
  const box = $("offers");
  box.innerHTML = "";
  for (const b of offers) {
    const el = document.createElement("div");
    el.className = `offer tier-${b.tier}`;
    el.style.setProperty("--tc", TIER_COLOR[b.tier]);
    el.innerHTML = `<img class="bi" src="${artUrl(b.art)}" alt=""><div class="on">${baitName(b)}</div><div class="ue">🎣 ${b.uses} ${t("fx.casts")}</div><div class="eff">${baitEffect(b)}</div><div class="fx"></div>`;
    // attracted species: thumbnails, dark silhouettes until caught (a teaser)
    const fxRow = el.querySelector(".fx")!;
    for (const id of b.attracts ?? []) if (FISH_BY_ID[id]) fxRow.appendChild(fishThumb(id, null, 34, 20, !save.album[id]));
    const btn = document.createElement("button");
    btn.className = "btn big gold buy";
    btn.innerHTML = `🪙 ${b.price.toLocaleString()}`;
    btn.disabled = save.coins < b.price;
    btn.onclick = () => {
      if (save.coins < b.price) return;
      save.coins -= b.price;
      save.bait = { id: b.id, uses: (save.bait?.id === b.id ? save.bait.uses : 0) + b.uses };
      sfx.buy(); writeSave(save); renderShop(); updateUi();
      toast(`✅ ${baitName(b)}: ${t("fx.nextcasts").replace("{n}", String(save.bait.uses))}`, 2600);
    };
    el.appendChild(btn);
    box.appendChild(el);
  }
  const gr = $("gearRow");
  gr.innerHTML = "";
  for (const g of GEAR) {
    const lvl = save.gear[g.id], cost = lvl >= g.max ? null : g.cost(lvl);
    const el = document.createElement("div");
    el.className = "offer";
    el.style.setProperty("--tc", "#7be495");
    const val = (l: number) => g.id === "lantern" ? `${lanternRadius(l)}` : sonarRange(l) ? `${Math.round(sonarRange(l) / 10)} m` : "—";
    const name = g.id === "lantern" ? t("fx.lantern") : t("fx.sonar");
    const what = g.id === "lantern" ? t("fx.lanternDo") : t("fx.sonarDo");
    el.innerHTML = `<img class="bi" src="${artUrl(g.art)}" alt=""><div class="on">${name}</div><div class="ue">${"★".repeat(lvl)}${"☆".repeat(g.max - lvl)}</div>`
      + `<div class="eff">${what}<br><b>${val(lvl)}${lvl < g.max ? " → " + val(lvl + 1) : ""}</b></div>`;
    const btn = document.createElement("button");
    btn.className = "btn big gold buy";
    btn.innerHTML = cost === null ? t("max") : `🪙 ${cost.toLocaleString()}`;
    btn.disabled = cost === null || save.coins < cost;
    btn.onclick = () => {
      if (cost === null || save.coins < cost) return;
      save.coins -= cost; save.gear[g.id]++;
      sfx.buy(); writeSave(save); renderShop(); updateUi();
      toast(`✅ ${g.id === "lantern" ? t("fx.lantern") : t("fx.sonar")} ★${save.gear[g.id]}`, 2200);
    };
    el.appendChild(btn);
    gr.appendChild(el);
  }
}

// ------------------------------------------------------------------ wardrobe (cosmetics)
const isOwned = (c: CosmeticDef) => save.owned.includes(c.id) || (!c.price && milestoneMet(c, save.album));
/** live preview of the fisher with everything currently worn */
function renderWardPreview() {
  const cv = $<HTMLCanvasElement>("wardPreview");
  const x = cv.getContext("2d")!;
  x.clearRect(0, 0, cv.width, cv.height);
  const hatName = (save.wear.hat ?? "hat_cap").replace("hat_", "");
  const kid = img(`kid_${hatName}_idle`) ?? img("kid_cap_idle");
  if (!kid) return;
  const o = COSMETICS.find((c) => c.id === save.wear.outfit)?.tint, pt = COSMETICS.find((c) => c.id === save.wear.boat)?.tint;
  const parts: { part: "vest" | "stripe"; tint: NonNullable<typeof o> }[] = [];
  if (o && save.wear.outfit !== "vest_blue") parts.push({ part: "vest", tint: o });
  if (pt && save.wear.boat !== "paint_red") parts.push({ part: "stripe", tint: pt });
  const src = parts.length ? recolor(`${hatName}|idle|${save.wear.outfit}|${save.wear.boat}`, kid, parts) : kid;
  const w = 190, h = (w * kid.height) / kid.width, ox = 25, oy = cv.height - h - 4;
  x.drawImage(src, ox, oy, w, h);
  const pet = save.wear.pet ? img(save.wear.pet) : null;
  if (pet) { const pw = 58, ph = (pw * pet.height) / pet.width; x.drawImage(pet, ox + 0.926 * w - pw * 0.72, oy + h - w * 0.2 * (w / 150) * 0.75 - ph + 6, pw, ph); }
}

function renderWardrobe() {
  $("wardNote").textContent = t("ward.note");
  renderWardPreview();
  const box = $("wardGrid");
  box.innerHTML = "";
  const KIND_LABEL: Record<string, string> = { hat: "🎩", outfit: "🦺", boat: "🚤", pet: "🐾" };
  const order = ["hat", "outfit", "boat", "pet"];
  let lastKind = "";
  for (const c of [...COSMETICS].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))) {
    if (c.kind !== lastKind) { lastKind = c.kind; box.insertAdjacentHTML("beforeend", `<div class="wkind">${KIND_LABEL[c.kind]}</div>`); }
    const owned = isOwned(c);
    const free0 = (c.id === "hat_cap" && !save.wear.hat) || (c.id === "vest_blue" && !save.wear.outfit) || (c.id === "paint_red" && !save.wear.boat);
    const worn = save.wear[c.kind] === c.id || free0;
    const el = document.createElement("div");
    el.className = "offer" + (worn ? " worn" : "");
    el.style.setProperty("--tc", worn ? "#ffe066" : owned ? "#7be495" : "#7f93b5");
    if (c.tint) {
      // outfit / paint: a swatch of the real recoloured boat
      const sw = document.createElement("div");
      sw.className = "swatch" + (owned || c.price ? "" : " lockedimg");
      sw.style.background = `hsl(${c.tint.hue}, ${c.kind === "outfit" ? 70 : 75}%, ${Math.round(50 * (c.tint.light ?? 1))}%)`;
      sw.textContent = c.kind === "outfit" ? "🦺" : "🚤";
      el.appendChild(sw);
      el.insertAdjacentHTML("beforeend", `<div class="eff">${c.kind === "outfit" ? "👦 🦺" : "🚣 🎨"}</div>`);
    } else el.innerHTML = `<img class="bi${owned || c.price ? "" : " lockedimg"}" src="${artUrl(c.art)}" alt=""><div class="eff">${c.kind === "hat" ? "👦 🎩" : "🚣 🐾"}</div>`;
    const btn = document.createElement("button");
    btn.className = "btn big buy " + (owned ? "ok" : c.price ? "gold" : "plain");
    if (owned) {
      btn.textContent = worn ? "✓" : "👕";
      btn.onclick = () => { save.wear[c.kind] = worn ? null : c.id; sfx.buy(); writeSave(save); renderWardrobe(); renderWardPreview(); };
    } else if (c.price) {
      btn.textContent = `🪙 ${c.price.toLocaleString()}`;
      btn.disabled = save.coins < c.price;
      btn.onclick = () => { if (save.coins < c.price!) return; save.coins -= c.price!; save.owned.push(c.id); save.wear[c.kind] = c.id; sfx.reveal("epic"); writeSave(save); renderWardrobe(); updateUi(); };
    } else {
      // milestone goal: shown as the thing to chase
      btn.textContent = c.album !== undefined ? `📖 ${Object.keys(save.album).length}/${c.album}` : c.fish ? "🎣 ?" : "🟡 ?";
      btn.disabled = true;
      if (c.fish && FISH_BY_ID[c.fish]) el.appendChild(fishThumb(c.fish, null, 46, 26, true));
    }
    el.appendChild(btn);
    if (!owned) {
      // rewarded try: wear it for a few dives
      const tryb = document.createElement("button");
      tryb.className = "btn big ad buy";
      tryb.textContent = `🎬 ×${TRY_DIVES}`;
      tryb.onclick = async () => {
        busy = true; const ok = await rewardedBreak(); busy = false;
        if (ok) { save.trial = { id: c.id, dives: TRY_DIVES }; sfx.reveal("rare"); writeSave(save); $("wardrobe").classList.add("hidden"); }
      };
      el.appendChild(tryb);
    }
    box.appendChild(el);
  }
}

// ------------------------------------------------------------------ tank + aquarium (keep & merge)
let aquaRaf = 0;
const STARS = ["", "★", "★★", "★★★"];

function renderTankList() {
  const box = $("tankList");
  box.innerHTML = "";
  const entries = Object.entries(save.tank).filter(([, e]) => e[0] + e[1] + e[2] > 0)
    .sort((a, b) => tankPower(b[0], b[1]) - tankPower(a[0], a[1]));
  if (!entries.length) { box.innerHTML = `<div class="tankEmpty">${t("tank.empty")}</div>`; return; }
  for (const [id, e] of entries) {
    const row = document.createElement("div");
    row.className = "trow";
    row.appendChild(fishThumb(id, null, 54, 32));
    const counts = [0, 1, 2].filter((i) => e[i] > 0).map((i) => `<span class="st s${i + 1}">${STARS[i + 1]}×${e[i]}</span>`).join(" ");
    row.insertAdjacentHTML("beforeend", `<div class="tn"><b>${fishName(FISH_BY_ID[id])}</b><br>${counts}</div>`);
    for (const star of [1, 2] as const) {
      if (e[star - 1] >= MERGE_COUNT) {
        const mb = document.createElement("button");
        mb.className = "btn big gold mergeb";
        mb.textContent = `3${STARS[star]} → ${STARS[star + 1]}`;
        mb.onclick = () => {
          const got = merge(save.tank, id, star);
          if (!got) return;
          sfx.reveal(got === 3 ? "legendary" : "epic");
          toast(`✨ ${fishName(FISH_BY_ID[id])} ${STARS[got]}!`, 2000);
          writeSave(save); renderTankList(); openAquarium(false, true);
        };
        row.appendChild(mb);
      } else if (e[star - 1] > 0 && star === 1) {
        row.insertAdjacentHTML("beforeend", `<span class="mprog">${e[0]}/${MERGE_COUNT} → ★★</span>`);
      }
    }
    box.appendChild(row);
  }
}

function openAquarium(welcome: boolean, keepOpen = false) {
  const now = Date.now();
  if (!save.aquariumAt) save.aquariumAt = now;
  const earned = aquariumEarned(save.tank, save.aquariumAt, now);
  const perHour = Math.round(aquariumRate(save.tank) * 60);
  $("aquaEarn").innerHTML = `🪙 +${earned.toLocaleString()} <small>(${perHour.toLocaleString()}/h)</small>`;
  $("aquaCollect").textContent = t("collect");
  $<HTMLButtonElement>("aquaCollect").disabled = earned <= 0;
  $("aquaDouble").classList.toggle("hidden", earned < 50);
  $("aquaTitle").textContent = welcome ? "🐠 💤 → 🪙" : "🐠";
  $("aquaHint").textContent = t("tank.hint");
  renderTankList();
  $("aquarium").classList.remove("hidden");
  if (keepOpen && aquaRaf) return;
  const cv = $<HTMLCanvasElement>("aquaCanvas");
  const ctx = cv.getContext("2d")!;
  const show = aquariumFish(save.tank);
  const swimmers = show.map((f, i) => ({ ...f, x: 40 + ((i * 97) % 300), y: 50 + ((i * 53) % 150), dir: i % 2 ? 1 : -1, sp: 18 + (i % 3) * 8 }));
  let last = performance.now();
  cancelAnimationFrame(aquaRaf);
  const bg = img("bg_aquarium");
  const step = (tm: number) => {
    const dt = Math.min(0.05, (tm - last) / 1000); last = tm;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (bg) ctx.drawImage(bg, 0, 0, cv.width, cv.height);
    for (const f of swimmers) {
      f.x += f.dir * f.sp * dt;
      if (f.x < 30) f.dir = 1; if (f.x > cv.width - 30) f.dir = -1;
      const sp = img(f.id);
      if (!sp) continue;
      // merged fish are bigger and shine
      const w = Math.min(110, (40 + FISH_BY_ID[f.id].size * 0.6) * (1 + (f.star - 1) * 0.25)), h = (w * sp.height) / sp.width;
      const y = f.y + Math.sin(tm / 600 + f.x * 0.02) * 5;
      if (f.star > 1) {
        const g = ctx.createRadialGradient(f.x, y, 0, f.x, y, w * 0.7);
        g.addColorStop(0, f.star === 3 ? "rgba(255,210,80,0.55)" : "rgba(160,220,255,0.45)"); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, y, w * 0.7, 0, Math.PI * 2); ctx.fill();
      }
      ctx.save(); ctx.translate(f.x, y); ctx.scale(f.dir, 1);
      ctx.drawImage(sp, -w / 2, -h / 2, w, h); ctx.restore();
      if (f.star > 1) { ctx.font = "700 13px Fredoka, sans-serif"; ctx.fillStyle = "#ffe066"; ctx.textAlign = "center"; ctx.fillText(STARS[f.star], f.x, y - h / 2 - 2); }
    }
    if (!$("aquarium").classList.contains("hidden")) aquaRaf = requestAnimationFrame(step); else aquaRaf = 0;
  };
  aquaRaf = requestAnimationFrame(step);
}

async function collectAquarium(double: boolean) {
  const now = Date.now();
  let earned = aquariumEarned(save.tank, save.aquariumAt || now, now);
  if (earned <= 0) return;
  if (double) { busy = true; const ok = await rewardedBreak(); busy = false; if (!ok) return; earned *= 2; }
  save.coins += earned; save.aquariumAt = now;
  for (let i = 0; i < 8; i++) setTimeout(() => sfx.coin(i), i * 50);
  writeSave(save); updateUi();
  openAquarium(false, true);
}

// ------------------------------------------------------------------ orders board
const NPCS = ["npc_captain", "npc_chef", "npc_scientist", "npc_granny"];
function refillOrders() {
  const known = new Set(Object.keys(save.album));
  while (save.orders.length < ORDER_SLOTS) save.orders.push(newOrder(save.zones, known, Math.random, NPCS.length));
}
const fillableOrders = () => save.orders.filter((o) => canFill(save.tank, o)).length;

function needText(o: Order): string {
  if (o.need.kind === "fish") return `${o.need.count} × ${save.album[o.need.fish] ? fishName(FISH_BY_ID[o.need.fish]) : "???"}`;
  return `${o.need.count} × ${tRarity(o.need.rarity)} · ${tZone(o.need.zone)}`;
}
const haveCount = (o: Order) => matching(save.tank, o.need).reduce((a, id) => a + save.tank[id][0], 0);

function renderOrders() {
  refillOrders();
  $("ordersNote").textContent = t("orders.note");
  const box = $("orderList");
  box.innerHTML = "";
  for (const o of save.orders) {
    const ok = canFill(save.tank, o);
    const el = document.createElement("div");
    el.className = "order" + (ok ? " ready" : "");
    el.innerHTML = `<img class="npc" src="${artUrl(NPCS[o.npc])}" alt="">`;
    const mid = document.createElement("div");
    mid.className = "omid";
    if (o.need.kind === "fish") mid.appendChild(fishThumb(o.need.fish, null, 58, 34, !save.album[o.need.fish]));
    else mid.insertAdjacentHTML("beforeend", `<div class="rbadge" style="--rc:${RARITY_COLOR[o.need.rarity]}">${tRarity(o.need.rarity)}</div>`);
    mid.insertAdjacentHTML("beforeend", `<div class="ot">${needText(o)}</div><div class="oh">📥 ${Math.min(haveCount(o), o.need.count)}/${o.need.count}</div>`);
    el.appendChild(mid);
    const right = document.createElement("div");
    right.className = "oright";
    right.insertAdjacentHTML("beforeend", `<div class="orew">🪙 ${o.coins.toLocaleString()}${o.bait ? `<br><img src="${artUrl(BAIT_BY_ID[o.bait.id].art)}" alt="">×${o.bait.uses}` : ""}</div>`);
    const btn = document.createElement("button");
    btn.className = "btn big " + (ok ? "gold" : "plain") + " obtn";
    btn.textContent = ok ? t("orders.deliver") : "🎣";
    btn.disabled = !ok;
    btn.onclick = () => {
      if (!fill(save.tank, o)) return;
      save.coins += o.coins;
      if (o.bait) save.bait = { id: o.bait.id, uses: (save.bait?.id === o.bait.id ? save.bait.uses : 0) + o.bait.uses };
      save.orders = save.orders.filter((x) => x !== o);
      sfx.reveal("epic"); for (let i = 0; i < 6; i++) setTimeout(() => sfx.coin(i), 200 + i * 60);
      toast(`📋 ✓ 🪙+${o.coins.toLocaleString()}`, 2000);
      writeSave(save); renderOrders(); updateUi();
    };
    right.appendChild(btn);
    const rr = document.createElement("button");
    rr.className = "btn big ad obtn small";
    rr.textContent = "🎬 🔄";
    rr.onclick = async () => {
      busy = true; const okAd = await rewardedBreak(); busy = false;
      if (!okAd) return;
      save.orders = save.orders.filter((x) => x !== o);
      writeSave(save); renderOrders();
    };
    right.appendChild(rr);
    el.appendChild(right);
    box.appendChild(el);
  }
}

function togglePause(force?: boolean) {
  paused = force ?? !paused;
  $("pause").classList.toggle("hidden", !paused);
  if (paused) { gameplayStop(); writeSave(save); }
  else if (scene.mode === "dive") gameplayStart();
}

// ------------------------------------------------------------------ dock ui
const fmtKg = (kg?: number) => (kg ?? 0) >= 10 ? `${Math.round(kg!)} kg` : `${(kg ?? 0).toFixed(1)} kg`;

/** pay out every finished starter mission, one celebration each */
function checkMission() {
  const m = MISSIONS[save.mission];
  if (!m) return;
  const [cur, goal] = m.progress(save);
  if (cur >= goal) {
    save.mission++;
    save.coins += m.reward;
    toast(`🎯 ${m.text[getLang()] ?? m.text.en} ✓ 🪙+${m.reward}`, 2400);
    sfx.reveal("epic");
    writeSave(save);
    updateUi();
    setTimeout(checkMission, 2600);
  }
  renderMission();
}

function renderMission() {
  const el = $("mission");
  const m = MISSIONS[save.mission];
  el.classList.toggle("hidden", !m || scene.mode !== "dock");
  if (!m) return;
  const [cur, goal] = m.progress(save);
  el.innerHTML = `🎯 ${m.text[getLang()] ?? m.text.en} <b>${Math.floor(cur)}/${goal}</b> <span class="mr">🪙${m.reward}</span><i style="width:${Math.round((cur / goal) * 100)}%"></i>`;
}

/** the next new species the line upgrade reaches: a silhouette teaser on the button */
function nextFishTeaser(): { id: string; depth: number } | null {
  const now = maxDepth(save.upgrades), next = now + 120;
  const cand = FISH.filter((f) => f.zone === scene.zone && !f.junk && !f.event && f.depth[0] > now && f.depth[0] <= Math.max(next, now + 1))
    .sort((a, b) => a.depth[0] - b.depth[0]);
  const f = cand.find((x) => !save.album[x.id]) ?? null;
  return f ? { id: f.id, depth: Math.round(f.depth[0] / 10) } : null;
}

function buy(id: UpgradeId) {
  const cost = upgradeCost(save.upgrades, id);
  if (cost === null || cost > save.coins || scene.mode !== "dock") return;
  save.coins -= cost;
  save.upgrades[id]++;
  sfx.buy();
  writeSave(save);
  updateUi();
  toast(`✅ ${tUpgrade(id)}: ${t(`fx.${id}` as Parameters<typeof t>[0])}`, 1800);
  checkMission();
}

const zoneReachable = (z: ZoneId) => !ZONES[z].after || save.zones.includes(ZONES[z].after!);

/** world map: lake -> ocean -> fork (Frozen North | Coral Reef) */
const MAP_POS: Record<ZoneId, [number, number]> = { lake: [50, 84], ocean: [50, 52], ice: [22, 16], reef: [78, 16] };
function renderMap() {
  const box = $("mapNodes");
  box.innerHTML = "";
  const lines = ZONE_ORDER.filter((z) => ZONES[z].after).map((z) => {
    const [x1, y1] = MAP_POS[ZONES[z].after!], [x2, y2] = MAP_POS[z];
    const open = save.zones.includes(z);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${open ? "#ffe066" : "#7f93b5"}" stroke-width="1.6" stroke-dasharray="${open ? "0" : "3 2.5"}" />`;
  }).join("");
  box.insertAdjacentHTML("beforeend", `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>`);
  for (const z of ZONE_ORDER) {
    const owned = save.zones.includes(z), reach = zoneReachable(z), price = ZONES[z].price;
    const n = document.createElement("button");
    n.className = "btn mnode" + (z === scene.zone ? " here" : "") + (owned ? "" : reach ? " buy" : " far");
    n.style.left = `${MAP_POS[z][0]}%`; n.style.top = `${MAP_POS[z][1]}%`;
    n.style.backgroundImage = `url(${artUrl(`bg_${z}`)})`;
    const status = owned ? (z === scene.zone ? "📍" : "") : reach ? `🔒 🪙${price.toLocaleString()}` : `🔒 ${t("map.needs")} ${tZone(ZONES[z].after!)}`;
    n.innerHTML = `<span class="mn">${tZone(z)}</span><span class="ms">${status}</span>`;
    n.disabled = !owned && (!reach || save.coins < price);
    n.onclick = () => { pickZone(z); $("map").classList.add("hidden"); };
    box.appendChild(n);
  }
}

function pickZone(z: ZoneId) {
  if (scene.mode !== "dock") return;
  if (!save.zones.includes(z)) {
    if (save.coins < ZONES[z].price || !zoneReachable(z)) return;
    save.coins -= ZONES[z].price;
    save.zones.push(z);
    sfx.event();
    toast(`🗺️ ${tZone(z)}!`);
  }
  save.zone = z;
  scene.zone = z;
  writeSave(save);
  updateUi();
  checkMission();
}

function updateUi() {
  $("coinsN").textContent = save.coins.toLocaleString();
  $("albumN").textContent = albumText();
  $("langBtn").textContent = LANG_LABEL[getLang()];
  $("muteBtn").textContent = save.muted ? "🔇" : "🔊";
  $("resumeBtn").textContent = "▶ " + t("resume");
  $("retryLbl").textContent = t("retry");
  $("letgoBtn").textContent = t("letgo");
  $("doubleLbl").textContent = t("double");
  const dock = scene.mode === "dock";
  renderMission();
  refillOrders();
  const fo = fillableOrders();
  $("ordersBadge").textContent = fo ? String(fo) : "";
  $("ordersBadge").classList.toggle("hidden", !fo);
  const mb = $<HTMLButtonElement>("mapBtn");
  mb.classList.toggle("hidden", save.mapPieces < 1);
  mb.disabled = save.mapPieces < 3;
  $("mapN").textContent = `${Math.min(save.mapPieces, 3)}/3`;
  mb.classList.toggle("armed", treasureNext);
  $("dock").classList.toggle("hidden", !dock);
  $("diveHud").classList.toggle("hidden", scene.mode !== "dive");

  const zones = $("zones");
  zones.innerHTML = "";
  const b = document.createElement("button");
  // one button: where you are now; it opens the world map. It glows when a new place is affordable.
  const canUnlock = ZONE_ORDER.some((z) => !save.zones.includes(z) && zoneReachable(z) && save.coins >= ZONES[z].price);
  b.className = "btn zone on" + (canUnlock ? " glow" : "");
  b.innerHTML = `🗺️ ${tZone(scene.zone)}${canUnlock ? " ✨" : ""}`;
  b.onclick = () => { if (scene.mode === "dock") { renderMap(); $("map").classList.remove("hidden"); } };
  zones.appendChild(b);

  const ups = $("upgrades");
  ups.innerHTML = "";
  for (const id of UPGRADE_ORDER) {
    const cost = upgradeCost(save.upgrades, id);
    const b = document.createElement("button");
    const can = cost !== null && cost <= save.coins;
    b.className = "btn up" + (can ? " can" : "");
    b.disabled = cost === null;
    const valAt = (l: number) => id === "line" ? `${(400 + 120 * l) / 10}m` : id === "capacity" ? `×${3 + l}` : `+${l * 12}%`;
    const lv = save.upgrades[id];
    const lvl = cost === null ? valAt(lv) : `${valAt(lv)}→${valAt(lv + 1)}`;
    b.innerHTML = `<span class="ui"><img src="${artUrl(UP_ICON[id])}" alt="" onerror="this.replaceWith('${UPGRADES[id].icon}')"></span><span class="ul">${tUpgrade(id)}</span><span class="ul2">${lvl}</span><span class="uc">${cost === null ? t("max") : "🪙" + cost.toLocaleString()}</span>`;
    b.title = t(`fx.${id}` as Parameters<typeof t>[0]);
    b.onclick = () => buy(id);
    if (id === "line" && cost !== null) {
      const tz = nextFishTeaser();
      if (tz) { const tw = document.createElement("span"); tw.className = "tease"; tw.appendChild(fishThumb(tz.id, null, 34, 20, true)); tw.insertAdjacentHTML("beforeend", "<b>?</b>"); b.appendChild(tw); }
    }
    ups.appendChild(b);
  }
}

let toastTimer = 0;
function toast(text: string, ms = 2200) {
  const el = $("toast");
  el.textContent = text;
  el.classList.remove("hidden");
  el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.add("hidden"), ms);
}

let lastWeather = "";
let forcedWeather: WeatherId | null = null;
function updateWeather(now: number) {
  const w = weatherAt(now);
  if (forcedWeather) w.def = WEATHER[forcedWeather];
  scene.weather = w.def.id;
  const pill = $("weatherPill");
  const left = Math.max(0, Math.ceil((w.endsAt - now) / 1000));
  pill.textContent = `${w.def.icon} ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  pill.title = tWeather(w.def.id);
  setRain(w.def.id === "storm" ? 1 : w.def.id === "rain" ? 0.6 : 0);
  if (lastWeather && lastWeather !== w.def.id) { toast(`${w.def.icon} ${tWeather(w.def.id)}`, 2400); sfx.event(); }
  lastWeather = w.def.id;
}

function updateEvent(now: number) {
  updateWeather(now);
  const bp = $("baitPill");
  const b = save.bait ? BAIT_BY_ID[save.bait.id] : null;
  bp.classList.toggle("hidden", !b);
  if (b) bp.innerHTML = `<img src="${artUrl(b.art)}" alt=""> ×${save.bait!.uses}`;
  if (!$("shop").classList.contains("hidden")) {
    // only the countdown ticks; offers are rebuilt when the shop actually restocks
    const { restockAt } = shopOffers(now);
    if (restockAt !== shownRestock) renderShop();
    else { const left = Math.max(0, Math.ceil((restockAt - now) / 1000)); $("restock").textContent = `🔄 ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`; }
  }
  const due = personalEventDue(now, sessionStart, save.seenEvent);
  if (due !== null) personalEventAt = due;
  const ev: ActiveEvent | null = currentEvent(now, personalEventAt);
  scene.event = ev;
  const pill = $("eventPill");
  if (ev) {
    const left = Math.max(0, Math.ceil((ev.endsAt - now) / 1000));
    pill.textContent = `${ev.def.icon} ${tEvent(ev.def.id)} ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    pill.classList.remove("hidden");
    pill.style.background = "";
  } else {
    // show the countdown to the next event when it is close: a reason to keep playing
    const next = nextWorldEvent(now);
    const left = Math.ceil((next.startsAt - now) / 1000);
    if (left <= 120) {
      pill.textContent = `${next.def.icon} ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
      pill.classList.remove("hidden");
      pill.style.background = "rgba(5,20,35,0.62)";
    } else pill.classList.add("hidden");
  }
  const id = ev ? ev.def.id + ev.endsAt : null;
  if (id !== lastEventId) {
    if (ev) { sfx.event(); toast(`${ev.def.icon} ${tEvent(ev.def.id)}!`, 3000); save.seenEvent = true; }
    lastEventId = id;
  }
}

// ------------------------------------------------------------------ main loop
let last = performance.now();
let reelTick = 0;
let uiTick = 0;
function frame(now: number) {
  const realDt = Math.min(0.05, (now - last) / 1000);
  let dt = realDt;
  if (slowmo > 0) { slowmo -= realDt; dt = realDt * 0.3; }
  last = now;
  if (!paused && !isAdPlaying()) {
    scene.t += dt;
    scene.poseT += realDt;
    readInput();
    const d = scene.dive;
    if (scene.mode === "dive" && d) {
      const ctx = { upgrades: save.upgrades, event: scene.event, night: false, rng: Math.random, weather: weatherAt(Date.now()).def, bait: activeBait };
      stepDive(d, dt, input, ctx);
      handleFx(d);
      reelTick -= dt;
      if (d.phase === "ascend" && reelTick <= 0) { reelTick = 0.11; sfx.reel(); }
      if (d.phase === "done") finishDive(d);
      $("depthN").textContent = `${Math.round(d.hookY / 10)}m`;
      $("slots").textContent = "●".repeat(d.hooked.length) + "○".repeat(Math.max(0, d.capacity - d.hooked.length));
      $("reelHint").classList.toggle("hidden", d.phase !== "fight");
      if (d.phase === "fight") $("reelHint").textContent = "👇 " + t("reel");
    } else $("reelHint").classList.add("hidden");
    scene.light = lanternRadius(save.gear.lantern);
    const tr = save.trial ? COSMETICS.find((c) => c.id === save.trial!.id) : null;
    scene.pet = tr?.kind === "pet" ? tr.art : save.wear.pet;
    scene.hat = tr?.kind === "hat" ? tr.art : save.wear.hat;
    const oid = tr?.kind === "outfit" ? tr.id : save.wear.outfit ?? null;
    const pid = tr?.kind === "boat" ? tr.id : save.wear.boat ?? null;
    scene.outfitId = oid; scene.outfit = oid ? COSMETICS.find((c) => c.id === oid)?.tint ?? null : null;
    scene.paintId = pid; scene.paint = pid ? COSMETICS.find((c) => c.id === pid)?.tint ?? null : null;
    scene.sonar = sonarRange(save.gear.sonar);
    renderer.update(dt, scene);
    setMusicMood(scene.zone, scene.dive && scene.mode === "dive" ? scene.dive.hookY : 0, !!scene.event);
    save.playMs += dt * 1000;
  }
  uiTick -= dt;
  if (uiTick <= 0) { uiTick = 0.25; updateEvent(Date.now()); }
  renderer.draw(scene);
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ wiring
const UP_ICON: Record<UpgradeId, string> = { line: "i_line", capacity: "i_hooks", luck: "i_luck" };
function tintedThumb(id: string, mut: NonNullable<Catch["mut"]>) {
  return spriteTinted(id, mut) ?? (img(id) as unknown as HTMLCanvasElement);
}
document.querySelectorAll<HTMLButtonElement>("#ui button").forEach((b) => b.addEventListener("click", () => sfx.tap()));
$("collectBtn").onclick = () => void collect(false);
$("doubleBtn").onclick = () => void collect(true);
$("retryBtn").onclick = () => void snapChoice(true);
$("letgoBtn").onclick = () => void snapChoice(false);
$("albumBtn").onclick = () => { if (scene.mode === "dock") showAlbum(); };
$("mapBtn").onclick = () => {
  if (scene.mode !== "dock" || save.mapPieces < 3) return;
  treasureNext = !treasureNext;
  $("mapBtn").classList.toggle("armed", treasureNext);
  toast(treasureNext ? "🗺️ 💰 !" : "🗺️", 1500);
};
$("wardBtn").onclick = () => { if (scene.mode === "dock") { renderWardrobe(); $("wardrobe").classList.remove("hidden"); } };
$("wardClose").onclick = () => $("wardrobe").classList.add("hidden");
$("aquaBtn").onclick = () => { if (scene.mode === "dock") openAquarium(false); };
$("ordersBtn").onclick = () => { if (scene.mode === "dock") { renderOrders(); $("orders").classList.remove("hidden"); } };
$("ordersClose").onclick = () => $("orders").classList.add("hidden");
$("aquaClose").onclick = () => $("aquarium").classList.add("hidden");
$("aquaCollect").onclick = () => void collectAquarium(false);
$("aquaDouble").onclick = () => void collectAquarium(true);
$("baitPill").onclick = () => { const b = save.bait ? BAIT_BY_ID[save.bait.id] : null; if (b) toast(`${baitName(b)}: ${baitEffect(b).replace(/<br>/g, " · ")}`, 2600); };
$("mapClose").onclick = () => $("map").classList.add("hidden");
$("shopBtn").onclick = () => { if (scene.mode === "dock") { renderShop(); $("shop").classList.remove("hidden"); } };
$("shopClose").onclick = () => $("shop").classList.add("hidden");
$("albumClose").onclick = () => $("album").classList.add("hidden");
$("pauseBtn").onclick = () => togglePause(true);
$("resumeBtn").onclick = () => togglePause(false);
$("muteBtn").onclick = () => { save.muted = !save.muted; setMuted(save.muted); writeSave(save); updateUi(); };
$("langBtn").onclick = () => {
  const next = LANGS[(LANGS.indexOf(getLang()) + 1) % LANGS.length];
  setLang(next); save.lang = next; writeSave(save); updateUi();
};
window.addEventListener("resize", () => renderer.resize());
document.addEventListener("visibilitychange", () => { if (document.hidden && scene.mode === "dive") togglePause(true); writeSave(save); });
setInterval(() => writeSave(save), 10_000);

const bar = $("loadBar");
Promise.all([
  initPoki({ adStart: () => setDucked(true), adEnd: () => setDucked(false) }),
  loadAssets((k) => { bar.style.width = `${Math.round(k * 100)}%`; }),
  document.fonts?.ready,
]).then(() => {
  loadingFinished();
  $("loading").classList.add("gone");
  if (save.aquariumAt && aquariumEarned(save.tank, save.aquariumAt, Date.now()) >= 25) openAquarium(true);
  else if (!save.aquariumAt) save.aquariumAt = Date.now();
  $("coinIco").innerHTML = `<img src="${artUrl("i_coin")}" alt="">`;
  updateUi();
});
updateUi();
requestAnimationFrame(frame);

// debug handle for automated checks (harmless in production)
(window as unknown as { __deepLuck: unknown }).__deepLuck = { save, scene, catchValue, updateUi, showLegend, force: (k: typeof forcedSurprise) => { forcedSurprise = k; }, weather: (w: WeatherId) => { forcedWeather = w; } };
