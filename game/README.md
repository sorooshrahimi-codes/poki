# Deep Luck (game)

A fishing collection game built for Poki. Plain TypeScript and Canvas 2D, with no runtime dependencies.

```bash
npm install
npm run dev        # local dev server
npm run build      # typecheck + production build into dist/ (zip dist/ for Poki)
npm run sim        # economy simulator: plays the real rules with a bot, PASS/FAIL on pacing targets
```

## Layout
- `src/core/`: pure rules (dive physics, fights, spawning, economy, clock events, save). They have no DOM, so the game, `tools/sim.ts` and the AI content studio share them.
- `src/data/`: the content library (fish, zones, rarities, mutations, events). AI-made content is added here in the same shape and must pass `npm run sim`.
- `src/render/`: canvas drawing. The fish are procedural placeholders for now and will be replaced by AI sprites (see `docs/art-tests/`).
- `src/platform/`: Poki SDK wrapper (no-op outside Poki), safe localStorage and synthesized sound.
- `src/i18n.ts`: the five launch languages (en, es, pt, hi, ja).

## Poki rules this build follows
- Nothing loads from another host except the Poki SDK script.
- `gameplayStart` fires on the first cast. `commercialBreak` runs only before a new cast (a natural break) and never mid-dive.
- Rewarded buttons are purple and carry 🎬. The normal choice button is the same size.
- localStorage access is wrapped in try/catch, Esc pauses, and the game works in both portrait and landscape.
- Current size: about 42 KB JS + 5 KB CSS.
