# Poki upload packages

Each folder holds everything one game needs for Poki. The step-by-step guide (in Persian) is in `POKI_GUIDE_FA.md`. Each folder's `submission.md` has the text to paste into Poki for Developers (English) and a Persian explanation.

All files are copies; the originals stay in `game/promo`, `critter/promo`, and the zips at the repo root.

## deep-luck/ (41.1 MB total)
| File | Size |
|---|---|
| `deep-luck-poki.zip`: game build (index.html at root) | 5.3 MB |
| `thumb_1080.jpg`: main thumbnail, 1080 × 1080 | 470 KB |
| `thumb_628.jpg`: thumbnail, 628 × 628 | 184 KB |
| `thumb_1080_alt.jpg`: alternative thumbnail, 1080 × 1080 | 544 KB |
| `thumb_1280x720.jpg`: landscape key art / poster | 334 KB |
| `animated_thumbnail_1080.mp4`: 1080², 60 fps, 5.85 s, muted | 6.1 MB |
| `trailer_1280x720.mp4`: 35 s, 60 fps, with sound | 24.2 MB |
| `screenshots/gameplay_1_1280x720.png` | 883 KB |
| `screenshots/gameplay_2_1280x720.png` | 987 KB |
| `screenshots/gameplay_3_mobile_portrait.png` | 2.1 MB |
| `submission.md` | 8 KB |

## critter-vac/ (63.0 MB total)
| File | Size |
|---|---|
| `critter-vac-poki.zip`: game build (index.html at root) | 3.2 MB |
| `thumb_1080.jpg`: main thumbnail, 1080 × 1080 | 531 KB |
| `thumb_628.jpg`: thumbnail, 628 × 628 | 221 KB |
| `thumb_1080_moon.jpg`: alternative thumbnail, 1080 × 1080 | 557 KB |
| `thumb_1280x720.jpg`: landscape key art / poster | 368 KB |
| `animated_thumbnail_1080.mp4`: 1080², 60 fps, 5.95 s, muted | 11.4 MB |
| `trailer_1280x720.mp4`: 33 s, 60 fps, with sound | 42.4 MB |
| `screenshots/gameplay_1_1280x720.png` | 1.2 MB |
| `screenshots/gameplay_2_1280x720.png` | 732 KB |
| `screenshots/gameplay_3_mobile_portrait.png` | 2.4 MB |
| `submission.md` | 8 KB |

Sizes are decimal (1 MB = 1,000,000 bytes).

## Rebuilding a zip
```
cd game && npm run build && cd dist && rm -f ../../deep-luck-poki.zip && zip -q -r -X ../../deep-luck-poki.zip . -x '*.map'
cd critter && npm run build && cd dist && rm -f ../../critter-vac-poki.zip && zip -q -r -X ../../critter-vac-poki.zip . -x '*.map'
```
Then copy the new zip into the package folder.
