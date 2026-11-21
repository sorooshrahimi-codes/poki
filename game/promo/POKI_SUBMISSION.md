# Deep Luck — Poki submission kit

## Files to upload
| What | File | Poki spec | Ours |
|---|---|---|---|
| Game build | `release/deep-luck-poki.zip` (= `game/dist`) | HTML5, small initial download | 5.3 MB zip; about 1.4 MB loads before the first cast (the current sea only), the rest streams in while you play |
| Static thumbnail | `promo/thumb_1080.jpg` (also `thumb_628.jpg`) | square, ≥ 628 px, full-bleed, no text | 1080 × 1080, full-bleed, no text |
| Animated thumbnail | `promo/animated_thumbnail_1080.mp4` | square ≥ 1080, ≥ 50 fps, 4–6 s, muted, mp4, ≤ 100 MB | 1080 × 1080, 60 fps, 5.7 s, muted, 4.6 MB; it opens on the static art, then the Legend lurking, the fight, the catch reeled up to the boat and the crown |
| Trailer (optional, for the page and socials) | `promo/trailer_1280x720.mp4` | — | 37 s, 60 fps, with music (key art, five seas, the three-round Legend fight, the logbook) |

## Title
**Deep Luck**

## One line
Drop your line, dodge the small fry and reel up the giant Legend of every sea!

## Description
Captain Bo has given you his little boat and his old logbook. Each of its five pages holds a Legend of the sea.

Tap to cast, steer the hook down past the fish and catch everything you can on the way up. Every catch pulls your line closer to the giant Legend lurking in the deep. When the line reaches it, the Legend bites: hold on, strike on time and follow it through three rounds to land it!

- Five seas, five giant Legends: a grumpy catfish, a crowned marlin, a narwhal king, a coral dragon and a phoenix fish
- Each sea plays differently: drifting ice to steer around, strong currents on the reef, erupting volcano vents
- Golden, rainbow, ghost and electric fish are worth much more
- Sharks that steal your catch, octopus ink, a crab that grabs your hook, bouncing puffers
- Upgrade your line, hooks and luck, and fill your logbook with 50+ creatures
- After the last page, the Legends come back stronger
- Challenge a friend: three casts in the same sea, then send them your score

## Controls
- Mobile / tablet: tap to cast, slide left and right to steer the hook, hold or tap during fights.
- Desktop: click or Space to cast, move the mouse (or arrow keys / A D) to steer, hold or tap during fights.

## Tags
Fishing, Casual, Collecting, Boss, Upgrade, Idle, Kids, Animals, 2D, Mobile

## Poki requirements: checked
- [x] Desktop, mobile and tablet; portrait and landscape; checked at 640×360, 836×470, 1031×580 and on phone sizes
- [x] Incognito: localStorage access is wrapped in try/catch, so the game plays without saving
- [x] No external requests: fonts and art are bundled; the only outside script is the Poki SDK
- [x] No branding splash, no outgoing links and no other ads
- [x] SDK: `gameLoadingFinished` fires when loading ends; `gameplayStart` fires on each cast (never on load), `gameplayStop` when the hook surfaces or the game pauses; never twice in a row (checked with a logging SDK)
- [x] `commercialBreak` only just before a cast (a natural break), never during a dive, never in the first three casts; game audio is muted during ads
- [x] `rewardedBreak` only from purple 🎬 buttons (×2 catch, retry a snapped line, try a hat); always optional, never green, one ad gives one reward, no ad timers, no ad-block messages
- [x] Works with an ad blocker
- [x] Clean build: no debug code (test hooks exist only in a separate QA build)
- [x] Progress saves automatically
- [x] Straight into play: a 3-second wordless logbook opening (tap to skip), then a moving hand shows "tap to cast"
- [x] Wordless tutorial: a moving hand, a bouncing arrow on the first upgrade, and icons in fights (👇 hold, 👆 tap, 👈👉 follow)
- [x] One currency (coins) and no purchases
- [x] Space and arrow keys don't scroll the page

## Notes for the reviewers
- There are no words on the playing field; the UI is icons, and fish names appear only in the logbook. The few labels come in 9 languages.
- The friend challenge link uses `PokiSDK.shareableURL`.
