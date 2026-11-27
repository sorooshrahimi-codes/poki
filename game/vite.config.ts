import { defineConfig, type Plugin } from "vite";

// One game, four portals. `vite build --mode <portal>` swaps the portal SDK in index.html
// (the game code picks the matching branch in src/platform/poki.ts). Every path stays relative.
const POKI = `<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>`;
// GameDistribution: the game id comes from the GD dashboard (Upload game → Game ID); set GD_GAME_ID when building
const gdTag = (id: string) => `<script>
window["GD_OPTIONS"] = { gameId: "${id}", onEvent: function (e) { if (window.__gdEvent) window.__gdEvent(e.name); } };
(function (d, s, id) { var js, fjs = d.getElementsByTagName(s)[0]; if (d.getElementById(id)) return; js = d.createElement(s); js.id = id;
  js.src = "https://html5.api.gamedistribution.com/main.min.js"; fjs.parentNode.insertBefore(js, fjs); })(document, "script", "gamedistribution-jssdk");
</script>`;
const TAGS: Record<string, string> = {
  crazygames: `<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>`,
  gamedistribution: gdTag(process.env.GD_GAME_ID || "REPLACE_WITH_GD_GAME_ID"),
  playgama: `<script src="https://bridge.playgama.com/v2/stable/playgama-bridge.js"></script>`,
};

function portal(mode: string): Plugin {
  return {
    name: "portal-sdk",
    transformIndexHtml(html) {
      const tag = TAGS[mode];
      if (!tag) return html;
      html = html.replace(POKI, "");
      // Playgama wants its script first in <head>
      return mode === "playgama" ? html.replace("<head>", `<head>\n    ${tag}`) : html.replace("</head>", `  ${tag}\n  </head>`);
    },
    generateBundle() {
      if (mode !== "playgama") return;
      // Playgama reads this file next to index.html: ad pacing and placements
      this.emitFile({ type: "asset", fileName: "playgama-bridge-config.json", source: JSON.stringify({
        advertisement: { minimumDelayBetweenInterstitial: 60, interstitial: { placements: [{ id: "round_end" }] }, rewarded: { preloadOnStart: true } },
      }, null, 2) });
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [portal(mode)],
  build: { target: "es2020", assetsInlineLimit: 0, reportCompressedSize: true },
}));
