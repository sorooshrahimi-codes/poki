import { catchValue, diveCatches, resolveSnap, startDive, stepDive, type Dive, type DiveInput } from "./core/dive.ts";
import { noteDive, noteSurprise, pickSurprise } from "./core/director.ts";
import { UPGRADES, UPGRADE_ORDER, capacity, maxDepth, upgradeCost } from "./core/economy.ts";
import { currentEvent, isNight, nextWorldEvent, personalEventDue, type ActiveEvent } from "./core/events.ts";
import type { Catch, UpgradeId, ZoneId } from "./core/types.ts";
import { FISH, FISH_BY_ID } from "./data/fish.ts";
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
import { Renderer, type SceneState } from "./render/scene.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const save = loadSave();
setLang(save.lang ?? detectLang());
setMuted(save.muted);

const canvas = $<HTMLCanvasElement>("game");
const renderer = new Renderer(canvas);
const scene: SceneState = { mode: "dock", zone: save.zone, dive: null, event: null, t: 0, hint: save.dives === 0, pose: "idle", poseT: 9, weather: weatherAt(Date.now()).def.id };
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
  if ((e.key === " " || e.key === "Enter") && scene.mode === "reveal") void collect(false);
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => { keys.clear(); pointerDown = false; });

function readInput() {
  input.axis = (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
  if (input.axis) input.targetX = null;
  input.hold = pointerDown || keys.has(" ") || keys.has("arrowup") || keys.has("w");
}

const anyPanelOpen = () => !$("album").classList.contains("hidden") || !$("pause").classList.contains("hidden");

// ------------------------------------------------------------------ dive flow
async function cast() {
  if (busy || paused || scene.mode !== "dock" || anyPanelOpen()) return;
  busy = true;
  // the natural break: before every cast after the first. Poki decides if an ad actually plays.
  if (save.dives > 0) await commercialBreak();
  busy = false;
  if (paused) return;
  gameplayStart();
  const ctx = { upgrades: save.upgrades, event: scene.event, night: isNight(Date.now()), rng: Math.random, weather: weatherAt(Date.now()).def };
  const playSec = save.playMs / 1000;
  const floor = ZONES[scene.zone].floor;
  const surprise = forcedSurprise ?? pickSurprise(save.director, playSec, { zone: scene.zone, bottom: Math.min(maxDepth(save.upgrades), floor), floor, capacity: capacity(save.upgrades) }, Math.random);
  if (surprise) noteSurprise(save.director, surprise, playSec);
  scene.dive = startDive(scene.zone, ctx, surprise);
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
  if (busy || scene.mode !== "reveal") return;
  if (double) {
    busy = true;
    const ok = await rewardedBreak();
    busy = false;
    if (!ok) return;
  }
  let total = 0;
  for (const c of pending) {
    total += c.value;
    const e = (save.album[c.fish] ??= { count: 0, muts: [], best: 0 });
    e.count++;
    e.best = Math.max(e.best, c.value);
    if (c.mut && !e.muts.includes(c.mut)) e.muts.push(c.mut);
  }
  total += pendingBonus;
  pendingBonus = 0;
  if (double) total *= 2;
  save.coins += total;
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

function showReveal(list: Catch[]) {
  const box = $("cards");
  box.innerHTML = "";
  const order = [...list].sort((a, b) => RARITY_ORDER.indexOf(FISH_BY_ID[a.fish].rarity) - RARITY_ORDER.indexOf(FISH_BY_ID[b.fish].rarity));
  let total = 0;
  const shown = new Set<string>();
  order.forEach((c, i) => {
    const def = FISH_BY_ID[c.fish];
    const isNew = !save.album[c.fish] && !shown.has(c.fish);
    shown.add(c.fish);
    const card = document.createElement("div");
    card.className = "card" + (RARITY_ORDER.indexOf(def.rarity) >= 2 || c.mut ? " big" : "");
    card.style.setProperty("--rc", RARITY_COLOR[def.rarity]);
    card.style.animationDelay = `${i * 0.18}s`;
    card.appendChild(fishThumb(c.fish, c.mut, 92, 50));
    card.insertAdjacentHTML("beforeend", `<div class="cn">${fishName(def)}</div><div class="cr">${tRarity(def.rarity)}</div><div class="cv">🪙 ${c.value}</div>` +
      (c.mut ? `<div class="cm">${MUT_ICON[c.mut]}</div>` : "") + (isNew ? `<div class="newb">${t("new")}</div>` : ""));
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
  const close = () => { if (closed) return; closed = true; el.classList.add("hidden"); done(); };
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
    cell.insertAdjacentHTML("beforeend", `<div class="an">${e ? fishName(def) : "?"}</div><div class="am">${e ? e.muts.map((m) => MUT_ICON[m]).join("") : ""}</div>`);
    grid.appendChild(cell);
  }
  $("albumTitle").textContent = "📖 " + t("album");
  $("albumCount").textContent = albumText();
  $("album").classList.remove("hidden");
}

const albumText = () => `${Object.keys(save.album).length}/${FISH.length}`;

function togglePause(force?: boolean) {
  paused = force ?? !paused;
  $("pause").classList.toggle("hidden", !paused);
  if (paused) { gameplayStop(); writeSave(save); }
  else if (scene.mode === "dive") gameplayStart();
}

// ------------------------------------------------------------------ dock ui
function buy(id: UpgradeId) {
  const cost = upgradeCost(save.upgrades, id);
  if (cost === null || cost > save.coins || scene.mode !== "dock") return;
  save.coins -= cost;
  save.upgrades[id]++;
  sfx.buy();
  writeSave(save);
  updateUi();
}

function pickZone(z: ZoneId) {
  if (scene.mode !== "dock") return;
  if (!save.zones.includes(z)) {
    if (save.coins < ZONES[z].price) return;
    save.coins -= ZONES[z].price;
    save.zones.push(z);
    sfx.event();
    toast(`🗺️ ${tZone(z)}!`);
  }
  save.zone = z;
  scene.zone = z;
  writeSave(save);
  updateUi();
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
  $("dock").classList.toggle("hidden", !dock);
  $("diveHud").classList.toggle("hidden", scene.mode !== "dive");

  const zones = $("zones");
  zones.innerHTML = "";
  for (const z of ZONE_ORDER) {
    const owned = save.zones.includes(z);
    if (!owned && z !== ZONE_ORDER[save.zones.length]) continue; // show only the next locked zone
    const b = document.createElement("button");
    b.className = "btn zone" + (z === scene.zone ? " on" : "") + (owned ? "" : " locked");
    b.textContent = owned ? tZone(z) : `🔒 ${tZone(z)} 🪙${ZONES[z].price.toLocaleString()}`;
    b.disabled = !owned && save.coins < ZONES[z].price;
    b.onclick = () => pickZone(z);
    zones.appendChild(b);
  }

  const ups = $("upgrades");
  ups.innerHTML = "";
  for (const id of UPGRADE_ORDER) {
    const cost = upgradeCost(save.upgrades, id);
    const b = document.createElement("button");
    const can = cost !== null && cost <= save.coins;
    b.className = "btn up" + (can ? " can" : "");
    b.disabled = cost === null;
    const lvl = id === "line" ? `${(400 + 120 * save.upgrades.line) / 10}m` : id === "capacity" ? `×${capacity(save.upgrades)}` : `+${save.upgrades.luck * 12}%`;
    b.innerHTML = `<span class="ui"><img src="${artUrl(UP_ICON[id])}" alt="" onerror="this.replaceWith('${UPGRADES[id].icon}')"></span><span class="ul">${tUpgrade(id)} ${lvl}</span><span class="uc">${cost === null ? t("max") : "🪙" + cost.toLocaleString()}</span>`;
    b.onclick = () => buy(id);
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
      const ctx = { upgrades: save.upgrades, event: scene.event, night: false, rng: Math.random, weather: weatherAt(Date.now()).def };
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
  $("coinIco").innerHTML = `<img src="${artUrl("i_coin")}" alt="">`;
  updateUi();
});
updateUi();
requestAnimationFrame(frame);

// debug handle for automated checks (harmless in production)
(window as unknown as { __deepLuck: unknown }).__deepLuck = { save, scene, catchValue, updateUi, showLegend, force: (k: typeof forcedSurprise) => { forcedSurprise = k; }, weather: (w: WeatherId) => { forcedWeather = w; } };
