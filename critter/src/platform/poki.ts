// One thin layer over every web-game portal this game ships to. The portal is chosen at build time
// (vite --mode poki | crazygames | gamedistribution | playgama); the rest of the game only ever calls
// these functions. Outside a portal (local dev, the simulator) every call is a no-op and rewarded
// breaks succeed after a short fake delay, so the game runs anywhere.

export type Portal = "poki" | "crazygames" | "gamedistribution" | "playgama";
const MODE = import.meta.env.MODE;
export const PORTAL: Portal = MODE === "crazygames" || MODE === "gamedistribution" || MODE === "playgama" ? MODE : "poki";

// ---- the portal SDKs, as far as this game uses them
interface PokiSDKApi {
  init(): Promise<void>;
  gameLoadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  commercialBreak(onStart?: () => void): Promise<void>;
  rewardedBreak(opts?: { size?: "small" | "medium" | "large"; onStart?: () => void } | (() => void)): Promise<boolean>;
  shareableURL?(params: Record<string, string>): Promise<string>;
  getURLParam?(key: string): string;
}
type CGAdCallbacks = { adStarted?: () => void; adFinished?: () => void; adError?: (e: unknown) => void };
interface CrazySDK {
  init(): Promise<void>;
  environment?: string;
  game: { loadingStart(): void; loadingStop(): void; gameplayStart(): void; gameplayStop(): void; happytime?(): void; inviteLink?(p: Record<string, string>): string; getInviteParam?(k: string): string | null };
  ad: { requestAd(type: "midgame" | "rewarded", cb: CGAdCallbacks): void };
}
interface GDSDK { showAd(type?: string): Promise<unknown>; preloadAd?(type: string): Promise<unknown> }
interface Bridge {
  initialize(): Promise<void>;
  EVENT_NAME: Record<string, string>;
  platform: { sendMessage(m: string): void; isAudioEnabled?: boolean; on?(e: string, cb: (v: unknown) => void): void };
  game?: { on?(e: string, cb: (v: unknown) => void): void };
  advertisement: {
    showInterstitial(placement?: string): void; showRewarded(placement?: string): void;
    isRewardedSupported?: boolean; on(e: string, cb: (state: string) => void): void;
  };
}
declare global {
  interface Window {
    PokiSDK?: PokiSDKApi;
    CrazyGames?: { SDK: CrazySDK };
    gdsdk?: GDSDK;
    __gdEvent?: (name: string) => void;
    bridge?: Bridge;
  }
}

let poki: PokiSDKApi | null = null, crazy: CrazySDK | null = null, gd: GDSDK | null = null, bridge: Bridge | null = null;
let playing = false;
let adPlaying = false;
let onAdStart: () => void = () => {};
let onAdEnd: () => void = () => {};
const adBegin = () => { if (!adPlaying) { adPlaying = true; onAdStart(); } };
const adDone = () => { if (adPlaying) { adPlaying = false; onAdEnd(); } };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let gdRewardOk = false;
let onInter: (s: string) => void = () => {}, onRew: (s: string) => void = () => {};

export const isAdPlaying = () => adPlaying;

export async function initPoki(hooks: { adStart: () => void; adEnd: () => void }) {
  onAdStart = hooks.adStart;
  onAdEnd = hooks.adEnd;
  try {
    if (PORTAL === "poki" && window.PokiSDK) {
      poki = window.PokiSDK;
      await poki.init().catch(() => undefined); // ad blockers make init reject: the game must still work
    } else if (PORTAL === "crazygames" && window.CrazyGames) {
      await window.CrazyGames.SDK.init();
      crazy = window.CrazyGames.SDK;
      crazy.game.loadingStart();
    } else if (PORTAL === "gamedistribution") {
      // GD_OPTIONS.onEvent (in index.html) forwards SDK events here: pause and mute while an ad runs
      window.__gdEvent = (name) => {
        if (name === "SDK_GAME_PAUSE") adBegin();
        else if (name === "SDK_GAME_START") adDone();
        else if (name === "SDK_REWARDED_WATCH_COMPLETE") gdRewardOk = true;
      };
      for (let i = 0; i < 30 && !window.gdsdk; i++) await wait(100);
      gd = window.gdsdk ?? null;
      void gd?.preloadAd?.("rewarded").catch(() => undefined);
    } else if (PORTAL === "playgama" && window.bridge) {
      bridge = window.bridge; // initialised by boot.ts, before the game (its storage is read first)
      const E = bridge.EVENT_NAME;
      // the platform may pause or mute the game at any time (its own overlays): treat it like an ad
      for (const ev of [E.PAUSE_STATE_CHANGED, E.AUDIO_STATE_CHANGED]) if (ev) {
        const fn = (v: unknown) => { const off = ev === E.AUDIO_STATE_CHANGED ? v === false : v === true; if (off) adBegin(); else adDone(); };
        bridge.platform.on?.(ev, fn); bridge.game?.on?.(ev, fn);
      }
      // one listener each for the two ad kinds; each ad request swaps in its own handler
      bridge.advertisement.on(E.INTERSTITIAL_STATE_CHANGED ?? "interstitial_state_changed", (st) => onInter(st));
      bridge.advertisement.on(E.REWARDED_STATE_CHANGED ?? "rewarded_state_changed", (st) => onRew(st));
    }
  } catch {
    /* a portal SDK that fails must never stop the game */
  }
}

export function loadingFinished() {
  if (poki) poki.gameLoadingFinished();
  if (crazy) crazy.game.loadingStop();
  if (bridge) bridge.platform.sendMessage("game_ready");
}

export function gameplayStart() {
  if (playing) return;
  playing = true;
  poki?.gameplayStart();
  crazy?.game.gameplayStart();
}

export function gameplayStop() {
  if (!playing) return;
  playing = false;
  poki?.gameplayStop();
  crazy?.game.gameplayStop();
}

/** a moment of joy (a Legend landed, a giant caught): CrazyGames uses it to tune its ads */
export function happyTime() { crazy?.game.happytime?.(); }

/** a natural break between rounds: the portal decides whether an ad actually plays */
export async function commercialBreak() {
  gameplayStop();
  try {
    if (poki) { await poki.commercialBreak(adBegin); }
    else if (crazy) {
      await new Promise<void>((done) => crazy!.ad.requestAd("midgame", { adStarted: adBegin, adFinished: () => done(), adError: () => done() }));
    } else if (gd) { await gd.showAd().catch(() => undefined); }
    else if (bridge) {
      const b = bridge;
      await new Promise<void>((done) => {
        let started = false;
        const t = setTimeout(() => { if (!started) done(); }, 4000); // no ad today: carry on
        onInter = (s) => {
          if (s === "opened") { started = true; adBegin(); }
          if (s === "closed" || s === "failed") { clearTimeout(t); onInter = () => {}; done(); }
        };
        b.advertisement.showInterstitial();
      });
    }
  } catch { /* never block the game on an ad */ }
  adDone();
}

/** the player chose to watch an ad for a reward; resolves true only when the reward should be given */
export async function rewardedBreak(): Promise<boolean> {
  gameplayStop();
  let ok = false;
  try {
    if (poki) ok = await poki.rewardedBreak({ size: "medium", onStart: adBegin });
    else if (crazy) {
      ok = await new Promise<boolean>((done) => crazy!.ad.requestAd("rewarded", { adStarted: adBegin, adFinished: () => done(true), adError: () => done(false) }));
    } else if (gd) {
      gdRewardOk = false;
      await gd.showAd("rewarded").catch(() => undefined);
      ok = gdRewardOk; // only a watched-to-the-end ad pays out
    } else if (bridge) {
      const b = bridge;
      ok = await new Promise<boolean>((done) => {
        let got = false;
        onRew = (s) => {
          if (s === "opened") adBegin();
          if (s === "rewarded") got = true;
          if (s === "closed" || s === "failed") { onRew = () => {}; done(got); }
        };
        b.advertisement.showRewarded();
      });
    } else {
      await wait(600);
      ok = true; // local test: the reward always comes
    }
  } catch { ok = false; }
  adDone();
  return ok;
}

/** a link to this game that carries `params` (on Poki/CrazyGames: their own share link; elsewhere: this page) */
export async function shareURL(params: Record<string, string>): Promise<string> {
  if (poki?.shareableURL) { try { return await poki.shareableURL(params); } catch { /* fall through */ } }
  if (crazy?.game.inviteLink) { try { return crazy.game.inviteLink(params); } catch { /* fall through */ } }
  const u = new URL(location.href);
  u.search = "";
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

/** a parameter of the link this player arrived with ("" when missing) */
export function urlParam(key: string): string {
  const fromSdk = poki?.getURLParam?.(key) || crazy?.game.getInviteParam?.(key);
  if (fromSdk) return fromSdk;
  return new URLSearchParams(location.search).get(key) ?? "";
}

/** can the game show a "share with a friend" button here? (GameDistribution and Playgama forbid outside links) */
export const canShare = () => PORTAL === "poki" || PORTAL === "crazygames";
