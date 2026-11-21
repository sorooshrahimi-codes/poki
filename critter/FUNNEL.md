# Critter Vac — the Poki funnel plan

The goal: every step from "someone sees the thumbnail" to "they come back tomorrow and bring a friend" has one clear thing that pulls them to the next step. Small build (under 2 MB), no text needed, works on phone, tablet and desktop.

## The big idea (the hook)
**A tiny kid with a vacuum sucks up a GIANT.**
Scale is the wow: a little kid, a little nozzle, and a giant cute monster stretched like taffy into it. Cute plus a little cheeky humour (the kid burps after the giant goes in). It explains itself in one picture.

## The funnel, step by step

| Step | What the player feels | What makes it happen | Status |
|---|---|---|---|
| 1. Sees the thumbnail | "Wait, he's sucking up THAT?" | Thumbnail: the kid small in a corner, the giant huge, stretched toward the nozzle, coins flying. Title: **Critter Vac** | to remake |
| 2. Clicks | curiosity | The thumbnail asks a question (how?) | |
| 3. First 5 seconds | "I get it" | No menu. Game starts at once. A hand shows: hold and aim. The first critter flies in with a pop and coins | done |
| 4. First minute | "I'm getting stronger" | Coins fly to the counter; a glowing upgrade button; the bar toward the giant fills; the kid grows | done |
| 5. Minute 2-3 | "WOW" | The giant wakes up and fights: 3 rounds, screen shake, slow motion at the end, a big POP, coin rain, burp | to polish |
| 6. The session | "One more" | Next place opens with a new giant; new critters to discover in the book; combos; surprises (golden rain, stampede, visitors) | done |
| 7. Coming back | "My coins grew" | Offline income from the collection; the giant ladder (★2, ★3...) always has a next target | done |
| 8. Bringing friends | "Beat me!" | 60-second Rush with a friend link: same field for both, two bars side by side | done |
| 9. Competing | "I'm better" | Rush best on the button; after a giant, show the giant ladder rank | later |
| 10. Long term | "There's always more" | Six places on the road to the Moon (a giant every 3-4 min, the Moon at ~18 min), then the giant ladder (★2, ★3...) | done |

## Second by second: what the player meets, and what makes them stay

| Time | What happens on screen | What the player feels / learns | Pull to keep going |
|---|---|---|---|
| 0:00 | Loading bar (meadow art only, ~0.5 MB) | — | Fast: no menu, no title screen |
| 0:01 | The road picture: 🌼━🍄━❄️━🍭━🌋━🌙, the kid steps onto the first stop, the Moon glows at the end | "There is a journey, and the end is the Moon" | A destination from second one |
| 0:03 | Meadow. A huge golden giant sleeps on the horizon (Zzz). Bar at the top: 🌀0 ━━ giant 12 | "That thing is the goal" | Curiosity about the giant |
| 0:04 | A hand slides to the nearest critter and presses | "Hold and aim" | No reading needed |
| 0:06 | First catch: fwoomp-pop, coins fly to the counter, the critter pops up big with 🆕 and flies into the 📖 | "Catching = coins + collection" | Instant reward |
| 0:10–0:30 | Catches in a row: 🔥×3 combo, the pop climbs higher | "Fast = more" | Rhythm, sound |
| ~0:25 | First upgrade button glows gold, an arrow points at it | "Coins are for this" | First choice |
| 0:30 | Tap: a 🌀 spark flies up into the bar, it grows; the kid grows a little | "Upgrades fill the giant bar" | The link is visible |
| 0:30–1:30 | An upgrade every ~10 s; surprises (golden rain, stampede, rare visitor) | "I'm getting stronger fast" | Steady small wins |
| ~1:00 | Bar half full: the giant stops snoring | "It noticed me" | Tension starts |
| ~1:40 | Bar 85%: the giant wiggles, 💢 | "Almost!" | One more upgrade |
| ~1:50 | Bar full: ❗, the music speeds up, rumble, the giant stomps down HUGE | "WOW" | The big moment |
| 1:50–2:05 | Tug fight, 3 rounds, slow motion when it breaks free | "I can do this" | Skill + power |
| ~2:05 | Slow-mo taffy stretch → POP, coin rain, burp 💨 | Laugh, pride | The clip people share |
| 2:10 | Ad break (natural pause), then the road picture: the kid walks to 🍄 | "Next place, bigger giant" | The journey moves |
| 2:15–5:00 | Mushroom Forest: new critters, giant #2 at ~4:50 | Same loop, new things | Collection + variety |
| ~8:30 | Frost giant | | |
| ~11:30 | Candy Hills: the cake giant | Surprise: a candy world | Fresh art keeps it new |
| ~15:00 | Lava Mountain: the lava golem | | |
| ~17:45 | The Moon itself comes down and is sucked in | Big finish | |
| ~18:00 | Finale screen: the Moon, the cheering kid, 🏆, share 📤🌙, ★2 ▶ | "I did it" — and "tell a friend" | Share moment |
| 18:00+ | ★2 giants: same road, bigger and heavier | "Do it again, stronger" | Endless ladder |
| any time | 🏁 Rush: 60 s, same field for a friend, two bars side by side | "Beat me" | Competition |
| next day | Offline coins (up to 2 h) waiting | "My coins grew" | Return |

## Fixed principles (for the whole game)
- **Almost no words.** None on the playing field; the bare minimum in menus. Everything is understood from pictures, icons, colour and motion.
- **The screen belongs to the player.** No messages popping up over the field; tips are shown once by a moving hand, a few gestures, then never again.
- **Quiet controls.** Small, meaningful icons at the edges and in empty corners, no frames: they stand out by their own colour, glow and a soft see-through backing.
- **Everything where you expect it.** Coins and the book top left, settings top right, the giant gauge top centre, upgrades bottom centre, extras in the bottom corners.
- **Sound and music matter as much as pictures.** Every sound must fit what happens, at the right moment and the right volume against the others (see the sound pass below).

## Poki fit
- Poki SDK: gameplayStart/Stop, commercial break only at natural pauses (after a giant, before a Rush), rewarded video only on the purple 🎬 button (golden critters).
- Instant play, saves locally, no external links or requests, portrait and landscape.
- Size: about 1.9 MB (all art WebP).

## What is cut (and why)
Jar and park trips, eggs, bubble wand, flute, companions, lab: each added a rule to learn without a clear need. The game is one line now:
**catch critters → coins → stronger vacuum → giant → next place.**

## What the hits have that we must have (and status)
| Ingredient | Why it matters | In Critter Vac | Status |
|---|---|---|---|
| Understood in 10 s, no words | Poki players leave in seconds | Fail first: the giant laughs you off, the bar flashes red, the hand shows the small critters | done |
| A visible goal from second one | A reason to play | Giant on the horizon + bar, road to the Moon picture | done |
| Constant small wins | Dopamine every few seconds | Pops, combo pitch, coins flying, upgrade every ~10 s | done |
| Each stage plays differently | Novelty keeps the session going | Ice: critters slide · Candy: sugar rush of golden ones · Volcano: eruptions throw critters up, ×2 in the air · Moon: low gravity | done |
| A big shareable moment | Clips, word of mouth | Giant taffy-stretch, slow motion, POP, burp; Moon finale with share | done |
| Collection goals | "Just one more species" | Each place's book has 3 chests (4 / 8 / all species): coins, a perk card, a crown chest | done |
| Something to show off | Identity, pride | Suction styles won from each giant (honey, forest, ice, candy, lava, stars), chosen in the book | done |
| Surprise + choice in the moment | Unpredictable runs | Event deck in levels (mystery box, bombs, treasure runner, gust, parade, frenzy); the map forks: the normal way or the risky way (lucky wheel + a hard level for 2.5x) | done |
| Short varied levels | Variety + a sense of progress | Each place: 5 levels (catch N, a species, a combo, golden rain, fend off the rival), 1–3 stars, then the giant node | done |
| Visible growth | "I am getting stronger" you can see | The vacuum evolves at levels 8 / 25 / 60 (turbo, golden mega, cosmic): new look + a special move filled by catches (tornado → tornado + freeze → black hole) | done |
| A choice that matters | Ownership of your run | Three upgrade paths + after each giant pick 1 of 2 perks (💰 coins, 🌪️ special, ⏱ time, 🧲 magnet, ✨ gold, 🛡️ rival, 🔥 combo), stacking | done |
| Competition | "Beat me" | 60 s Rush, friend link, two bars, best on the button | done — next: weekly seeded Rush |
| A reason to come back | Day-2 retention | Offline coins (2 h cap) + a daily gift chest with a 7-day streak | done — next: a daily Rush seed |
| An end and an after | Completion + long tail | The Moon finale, then ★2 giants forever | done |
| Polished store page | Click-through on Poki | Giant thumbnail, one-line pitch, trailer clips | done — next: trailer with music and title card |

## Next steps, in order
Done: giant moment, giant thumbnail, promo text, sound pass, road to the Moon (6 places), giant that stirs as the bar fills, Moon finale with share.
1. Second-by-second check in a real playthrough (timings above are from the pacing simulator).
2. Rush: a visible best-score ribbon and a "beat my score" link right after a good run.
3. (done) **Sound pass:** one consistent sound palette (soft, toy-like); clear roles: suction loop that follows the wind strength, a "pop" per catch rising in pitch with the combo, coin sparkles, a deep rumble when a giant wakes, the finale pop and burp; music that steps up during a giant fight and calms afterwards; a mix check so nothing is louder than the catch sounds; mute remembered.
4. (done, first cut) Trailer: 22-second clips of the giant moment in promo/. A polished version with music, a title card and close-ups would be better.
