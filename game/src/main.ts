import { catchValue, diveCatches, resolveSnap, startDive, stepDive, type Dive, type DiveInput } from "./core/dive.ts";
import { UPGRADES, UPGRADE_ORDER, capacity, upgradeCost } from "./core/economy.ts";
import { currentEvent, isNight, nextWorldEvent, personalEventDue, type ActiveEvent } from "./core/events.ts";
import type { Catch, UpgradeId, ZoneId } from "./core/types.ts";
import { FISH, FISH_BY_ID } from "./data/fish.ts";
import { RARITY_COLOR, RARITY_ORDER, ZONES, ZONE_ORDER } from "./data/world.ts";
import { LANGS, LANG_LABEL, detectLang, fishName, getLang, setLang, t, tEvent, tRarity, tUpgrade, tZone } from "./i18n.ts";
import { setDucked, setMuted, sfx, unlockAudio } from "./platform/audio.ts";
import { commercialBreak, gameplayStart, gameplayStop, initPoki, isAdPlaying, loadingFinished, rewardedBreak } from "./platform/poki.ts";
import { loadSave, writeSave } from "./platform/storage.ts";
import { drawFish } from "./render/fish.ts";
import { Renderer, type SceneState } from "./render/scene.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const save = loadSave();
setLang(save.lang ?? detectLang());
setMuted(save.muted);

const canvas = $<HTMLCanvasElement>("game");
const renderer = new Renderer(canvas);
const scene: SceneState = { mode: "dock", zone: save.zone, dive: null, event: null, t: 0, hint: save.dives === 0 };

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
  const ctx = { upgrades: save.upgrades, event: scene.event, night: isNight(Date.now()), rng: Math.random };
  scene.dive = startDive(scene.zone, ctx);
  scene.mode = "dive";
  scene.hint = false;
  sfx.cast();
  renderer.splash(scene.dive.hookX);
  updateUi();
}

function handleFx(d: Dive) {
  for (const fx of d.fx) {
    if (fx.kind === "hook") {
      sfx.hook(fx.fish.def.rarity);
      renderer.burst(d.hookX, d.hookY, fx.fish.mut ? "#ffe066" : RARITY_COLOR[fx.fish.def.rarity], fx.fish.def.rarity === "common" ? 8 : 18);
      if (fx.fish.def.rarity !== "common") renderer.shakeIt(4);
    } else if (fx.kind === "turn") sfx.turn();
    else if (fx.kind === "fightWon") {
      sfx.reveal(fx.fish.def.rarity);
      renderer.burst(d.hookX, d.hookY, RARITY_COLOR[fx.fish.def.rarity], 40, 260);
      renderer.shakeIt(10);
    } else if (fx.kind === "snap") {
      sfx.snap();
      renderer.shakeIt(12);
      showSnap(fx.fish.def.id, fx.fish.mut, d.fight?.retried ?? true);
    } else if (fx.kind === "surface") {
      sfx.splash();
      renderer.splash(d.hookX);
    }
  }
  d.fx.length = 0;
}

function finishDive(d: Dive) {
  gameplayStop();
  pending = diveCatches(d);
  scene.mode = "reveal";
  save.dives++;
  showReveal(pending);
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
  if (double) total *= 2;
  save.coins += total;
  pending.forEach((_, i) => setTimeout(() => sfx.coin(i), i * 40));
  pending = [];
  $("reveal").classList.add("hidden");
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
  c.translate(w / 2, h / 2);
  const len = Math.min(w * 0.78, (h * 0.8) / Math.max(0.35, def.look.aspect));
  drawFish(c, def, mut, len, 0.3);
  if (silhouette) {
    c.globalCompositeOperation = "source-atop";
    c.fillStyle = "#0a1a2a";
    c.fillRect(-w, -h, w * 2, h * 2);
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
    setTimeout(() => sfx.reveal(def.rarity), i * 180);
    total += c.value;
  });
  $("totalN").textContent = String(total);
  $("collectBtn").textContent = list.length ? t("collect") : "OK";
  // the x2 offer only when there is something worth doubling
  $("doubleBtn").classList.toggle("hidden", total < 40);
  $("reveal").classList.remove("hidden");
}

const MUT_ICON: Record<string, string> = { gold: "✨", rainbow: "🌈", giant: "⬆️", ghost: "👻", electric: "⚡" };

function showSnap(id: string, mut: Catch["mut"], retried: boolean) {
  $("snapTitle").textContent = t("snapped");
  $("retryBtn").classList.toggle("hidden", retried);
  const cv = $<HTMLCanvasElement>("snapFish");
  const c = cv.getContext("2d")!;
  c.clearRect(0, 0, cv.width, cv.height);
  c.save(); c.translate(100, 55);
  drawFish(c, FISH_BY_ID[id], mut, 150, 0);
  c.restore();
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
    b.innerHTML = `<span class="ui">${UPGRADES[id].icon}</span><span class="ul">${tUpgrade(id)} ${lvl}</span><span class="uc">${cost === null ? t("max") : "🪙" + cost.toLocaleString()}</span>`;
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

function updateEvent(now: number) {
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
let uiTick = 0;
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused && !isAdPlaying()) {
    scene.t += dt;
    readInput();
    const d = scene.dive;
    if (scene.mode === "dive" && d) {
      const ctx = { upgrades: save.upgrades, event: scene.event, night: false, rng: Math.random };
      stepDive(d, dt, input, ctx);
      handleFx(d);
      if (d.phase === "done") finishDive(d);
      $("depthN").textContent = `${Math.round(d.hookY / 10)}m`;
      $("slots").textContent = "●".repeat(d.hooked.length) + "○".repeat(Math.max(0, d.capacity - d.hooked.length));
      $("reelHint").classList.toggle("hidden", d.phase !== "fight");
      if (d.phase === "fight") $("reelHint").textContent = "👇 " + t("reel");
    } else $("reelHint").classList.add("hidden");
    renderer.update(dt, scene);
    save.playMs += dt * 1000;
  }
  uiTick -= dt;
  if (uiTick <= 0) { uiTick = 0.25; updateEvent(Date.now()); }
  renderer.draw(scene);
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ wiring
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

void initPoki({ adStart: () => setDucked(true), adEnd: () => setDucked(false) }).then(() => loadingFinished());
updateUi();
requestAnimationFrame(frame);

// debug handle for automated checks (harmless in production)
(window as unknown as { __deepLuck: unknown }).__deepLuck = { save, scene, catchValue, updateUi };
