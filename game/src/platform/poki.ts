// Thin wrapper over the Poki SDK. Outside Poki (local dev, the simulator) every call is a no-op
// and rewarded breaks succeed after a short fake delay, so the game runs anywhere.

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

declare global {
  interface Window { PokiSDK?: PokiSDKApi }
}

let sdk: PokiSDKApi | null = null;
let playing = false;
let adPlaying = false;
let onAdStart: () => void = () => {};
let onAdEnd: () => void = () => {};

export const isAdPlaying = () => adPlaying;

export async function initPoki(hooks: { adStart: () => void; adEnd: () => void }) {
  onAdStart = hooks.adStart;
  onAdEnd = hooks.adEnd;
  if (!window.PokiSDK) return;
  try {
    await window.PokiSDK.init();
    sdk = window.PokiSDK;
  } catch {
    // ad blockers make init reject: the game must still work
    sdk = window.PokiSDK;
  }
}

export const loadingFinished = () => sdk?.gameLoadingFinished();

export function gameplayStart() {
  if (playing) return;
  playing = true;
  sdk?.gameplayStart();
}

export function gameplayStop() {
  if (!playing) return;
  playing = false;
  sdk?.gameplayStop();
}

/** a natural break between dives: Poki decides whether an ad actually plays */
export async function commercialBreak() {
  gameplayStop();
  if (!sdk) return;
  await sdk.commercialBreak(() => { adPlaying = true; onAdStart(); });
  if (adPlaying) { adPlaying = false; onAdEnd(); }
}

/** the player chose to watch an ad for a reward; resolves true when the reward should be given */
export async function rewardedBreak(): Promise<boolean> {
  gameplayStop();
  if (!sdk) {
    await new Promise((r) => setTimeout(r, 600));
    return true;
  }
  const ok = await sdk.rewardedBreak({ size: "medium", onStart: () => { adPlaying = true; onAdStart(); } });
  if (adPlaying) { adPlaying = false; onAdEnd(); }
  return ok;
}

/** a link to this game that carries `params` (on Poki: a poki.com link; elsewhere: this page) */
export async function shareURL(params: Record<string, string>): Promise<string> {
  if (sdk?.shareableURL) { try { return await sdk.shareableURL(params); } catch { /* fall through */ } }
  const u = new URL(location.href);
  u.search = "";
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

/** a parameter of the link this player arrived with ("" when missing) */
export function urlParam(key: string): string {
  const fromSdk = sdk?.getURLParam?.(key);
  if (fromSdk) return fromSdk;
  return new URLSearchParams(location.search).get(key) ?? "";
}
