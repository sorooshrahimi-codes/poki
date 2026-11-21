# MYRIAD — implementation roadmap

Each phase ends with an acceptance test. When a phase is done, there is a playable link to try on a real device.

## P1 — Tech core
- WebGL2 renderer with a fixed frame budget.
- Swarm simulation in float textures (262k slots) with a density-field flow.
- The leader follows the finger or mouse.
- Instanced mites with wing flaps.
- A ground plane and a camera that follows and pulls back as the swarm grows.
- A performance HUD: a frame-time graph, the tier, and the agent count.
- A quality governor (render scale, LOD, light resolution) with hysteresis, plus a startup benchmark.

**Accept:**
- 200k mites move with no visible stepping.
- On a mid desktop or phone, the 99th-percentile frame time is under 16.6 ms.
- No garbage is collected during play.

## P2 — The world is eaten
- Voxel buildings and trees (a density atlas).
- SDF climbing.
- Eating that leaves visible holes.
- Analytic collapse, with rubble that becomes food.
- A colour restoration map.
- The swarm grows with what it eats.
- The light of the swarm on the world.

**Accept:**
- A house is eaten and collapses.
- The street turns from grey to colour.
- Frame-time HUD stays flat during the collapse.

## P3 — Vertical slice
- The first district (a farm village) with a goal bar.
- The first stone giant: it walks, the swarm climbs it, it collapses.
- Procedural swarm sound and music.
- Hand-gesture onboarding with no text.
- Poki SDK wiring and a QA build.

**Accept:**
- A new player understands the game in 3 seconds.
- The giant appears at about minute 2.

## P4 — Full game
- Six districts, each with a giant.
- Mite kinds: fire, ice, gold.
- Shapes: bridge, hand.
- Split and merge with two fingers.
- The district map.
- The daily city and the challenge link.
- Rewarded "golden surge".
- Saves and nine languages for the few labels.

## P5 — Poki kit
- Key art.
- A static and an animated thumbnail.
- A trailer from the frame-exact recorder.
- The submission text and checklist.
- Size and compliance checks.
- A release zip.
