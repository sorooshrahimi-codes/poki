// Poki SDK, wrapped so the game runs the same with or without it (local, other hosts, ad blockers).
type SDK = {
  init(): Promise<void>; gameLoadingFinished(): void; gameplayStart(): void; gameplayStop(): void;
  commercialBreak(cb?: () => void): Promise<void>; rewardedBreak(cb?: () => void): Promise<boolean>;
};
const sdk = (): SDK | undefined => (window as unknown as { PokiSDK?: SDK }).PokiSDK;
let playing = false;
export const poki = {
  // the SDK is fetched without blocking the page; the game never waits more than 3 s for it
  init: (): Promise<void> => new Promise((done) => {
    const go = () => { try { (sdk()?.init() ?? Promise.resolve()).catch(() => undefined).then(() => done()); } catch { done(); } };
    if (sdk()) return go();
    const tag = document.createElement("script");
    tag.src = "https://game-cdn.poki.com/scripts/v2/poki-sdk.js";
    tag.onload = go; tag.onerror = () => done();
    setTimeout(done, 3000);
    document.head.appendChild(tag);
  }),
  loadingFinished: () => { try { sdk()?.gameLoadingFinished(); } catch { /* */ } },
  gameplayStart: () => { if (playing) return; playing = true; try { sdk()?.gameplayStart(); } catch { /* */ } },
  gameplayStop: () => { if (!playing) return; playing = false; try { sdk()?.gameplayStop(); } catch { /* */ } },
  commercialBreak: (): Promise<void> => { poki.gameplayStop(); try { const s = sdk(); return s ? s.commercialBreak().catch(() => undefined) : Promise.resolve(); } catch { return Promise.resolve(); } },
  rewardedBreak: (): Promise<boolean> => { poki.gameplayStop(); try { const s = sdk(); return s ? s.rewardedBreak().catch(() => false) : Promise.resolve(true); } catch { return Promise.resolve(false); } },
};
