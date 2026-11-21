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

## The game in one line
Catch fish -> coins -> upgrades -> your line reaches the Legend of the sea -> a three-round fight -> the next sea (lake, ocean, frozen north, reef, volcano), then the Legends return stronger. See `FUNNEL.md` for the design and `promo/POKI_SUBMISSION.md` for the Poki kit.

```bash
npm run build:qa   # a separate QA build (dist-qa) with the window.__deepLuck test handle; the Poki build has none
```

## Poki rules this build follows
- Nothing loads from another host except the Poki SDK script.
- `gameplayStart` fires on each cast and `gameplayStop` when the hook surfaces or the game pauses; they are never sent twice in a row.
- `commercialBreak` runs only just before a cast (a natural break), never during a dive, and never in the first three casts.
- Rewarded buttons are purple and carry 🎬: ×2 catch, retry a snapped line, try a hat. They are always optional.
- localStorage access is wrapped in try/catch, Esc pauses, Space and the arrow keys never scroll the page, and the game works in portrait and landscape.
