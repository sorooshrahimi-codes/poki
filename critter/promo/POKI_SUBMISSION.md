# Critter Vac — Poki submission kit

## Files to upload
| What | File | Poki spec | Ours |
|---|---|---|---|
| Game build | `critter-vac-poki.zip` (repo root, = `critter/dist`) | HTML5, initial download well under 8 MB | 3.5 MB total, ~0.6 MB before play (the rest streams in) |
| Static thumbnail | `promo/thumb_1080.jpg` (also `thumb_628.jpg`) | square, ≥ 628 px, full-bleed, no text | 1080 × 1080, full-bleed, no text |
| Animated thumbnail | `promo/animated_thumbnail_1080.mp4` | square ≥ 1080, ≥ 50 fps, 4–6 s, muted, mp4, ≤ 100 MB | 1080 × 1080, 60 fps, 5.9 s, muted, 5 MB; starts on the static art, then 3 gameplay scenes |
| Trailer (optional, for the page / socials) | `promo/trailer_1280x720.mp4` | — | 40 s, music |

## Title
**Critter Vac**

## One line
Vacuum up cute critters, power up your vacuum, and suck in a GIANT!

## Description
A kid with a toy vacuum dreams of catching the Moon.
Hold and aim to suck up adorable critters, grow your vacuum, and when the giant wakes up, win the tug of war and watch it stretch like taffy straight into your nozzle!
Travel from the flower meadow through the mushroom forest, the ice peaks, the candy hills and the volcano, build a rocket part by part, and fly to the Moon for the final giant.
- 30 short levels, every place with its own twist: blow bushes open, catch sliders on the ice, pull critters out of sticky candy, save them from the lava, grab them before they float into space
- Giants that fight back with stomps, bombs and roars
- A vacuum that evolves into a turbo, a golden mega machine and a cosmic black hole
- 72 critters to collect, a home to build, and a cheeky rival racing you to the Moon
- Challenge a friend in a 60-second Rush

## Controls
- Mobile / tablet: touch and hold to vacuum, drag to aim. Tap buttons.
- Desktop: hold the mouse button (or Space) to vacuum, move the mouse to aim.

## Tags
Casual, Cute, Animals, Collecting, Funny, Boss, Idle, Kids, 2D, Mobile

## Poki requirements: checked
- [x] Desktop, mobile and tablet; portrait and landscape; checked at 640×360, 836×470, 1031×580, phones and desktop
- [x] Incognito: all localStorage access in try/catch, plays without saving
- [x] No external requests (fonts and art bundled; only the Poki SDK script)
- [x] No branding splash, no outgoing links, no other ads
- [x] SDK: `gameLoadingFinished` when loaded; `gameplayStart` on the first input, never on load; `gameplayStop` on level end, map, and any full-screen moment; never twice in a row (checked with a logging SDK)
- [x] `commercialBreak` only when going from the map back into a level (never mid-play, never before the first 20 catches); game audio muted during ads
- [x] `rewardedBreak` only from the purple 🎬✨ button (optional golden critters); never a gate; not green; one ad = one reward; no internal ad timers; no ad-block messages
- [x] Works with an ad blocker
- [x] Clean build: no debug code (test hooks only exist in a separate QA build)
- [x] Progress saves automatically
- [x] Straight into play: a 2-second wordless dream (skippable), the map, the first level about 4 s after load; every scene skippable
- [x] Visual tutorial (a moving hand), no text needed
- [x] One currency (coins), no purchases
- [x] Space / arrow keys don't scroll the page

## Notes for the reviewers
- No words on the playing field; the UI is icons. 9 languages for the few labels.
- Share links (Rush challenge, Moon time) use `PokiSDK.shareableURL`.
