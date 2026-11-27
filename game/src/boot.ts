// The entry point. On Playgama the platform SDK must be ready, and the saved progress read from its
// storage, before the game starts; everywhere else the game starts at once.
import { PORTAL } from "./platform/poki.ts";
import { kvPreload } from "./platform/kv.ts";

(async () => {
  if (PORTAL === "playgama" && window.bridge) {
    try { await window.bridge.initialize(); await kvPreload(["deepluck.save.v1"]); } catch { /* play without the platform */ }
  }
  await import("./main.ts");
})();
