# MYRIAD — final design

**One line:** a tiny glowing seed leads a living swarm of up to 200,000 light-mites. The swarm eats a world that has turned to grey stone, and everything it passes over blooms back into colour.

**What should feel impossible on Poki:** hundreds of thousands of creatures flowing like liquid light, climbing and hollowing out buildings voxel by voxel, towers collapsing, and the city repainting itself. All of it stays perfectly smooth, from a download under 8 MB.

## 1. The funnel, element by element

| Step | The hook | How we make it happen |
|---|---|---|
| **Click** (thumbnail, video, title) | A glowing tide of light climbing a grey stone tower, with the city behind it already bursting into colour. No text. | Captured from the real engine with our frame-exact recorder. The animated thumbnail goes: static art → the tide climbs → the tower collapses → colour floods the street. |
| **First moment** (0–10 s) | 100 motes follow your finger like liquid light; the first grey flower is eaten and blooms; the swarm grows. | No menu and no text. A moving hand shows "drag". The first meal is 1 second away. |
| **Short play** (1–5 min) | A "first" every 30–60 s: a tree, a house collapses, a bridge of mites, the first stone giant climbed and eaten. | A district goal bar ("colour this place"), a swarm counter that only grows, and a giant that wakes when the bar reaches 70 %. |
| **Long play** | Six districts (farm, forest, harbour, city, ice, volcano), each with a giant. New mite kinds (fire, ice, gold) with visible effects. | Map of districts that turn from grey to colour. The daily city (the same seed for everyone). Each giant comes back stronger. |
| **Bringing others** | "How much of this city can you colour in 60 seconds?" | A challenge link via `PokiSDK.shareableURL` that opens the same city. The result screen shows a before/after picture. |

**Story (wordless):** the grey came and turned the world to stone. A seed of light wakes. Every bite gives colour back. The last district holds the heart of the grey.

## 2. Poki requirements (designed in from day 1)
- Download under 8 MB in total. The first load is about 2 MB (engine + the first district); the rest streams in.
- Plays straight away: no menu and no text; a 2-second wordless intro that can be skipped.
- Desktop, mobile and tablet; portrait and landscape; 16:9 sizes 640×360, 836×470 and 1031×580.
- WebGL2. This is supported almost everywhere and is the only path, so every player gets the same game; quality steps down, the game never does.
- SDK:
  - `gameLoadingFinished`; `gameplayStart` on the first input.
  - `gameplayStop` on any full-screen moment.
  - `commercialBreak` only between districts.
  - `rewardedBreak` only from a purple 🎬 button ("golden surge": double swarm for 30 s).
- No external requests, incognito-safe saves, no branding, no links, one currency.
- Space and arrow keys don't scroll the page; audio pauses during ads; debug only in a QA build.

## 3. Smoothness is a feature (never a hitch)
- Frame budget of 16.6 ms with about 4 ms of headroom. 120 Hz screens get 120 fps on desktop; mobile is capped at 60 fps.
- A quality governor measures frame time (GPU timer query where available, otherwise rAF timing). It steps down in this order:
  1. render scale (70–100 %)
  2. mote level of detail
  3. light resolution
  4. active simulation substeps

  It uses hysteresis so quality never flickers. It also detects thermal drift: when frame time creeps up over time, it drops one step and stays there.
- A 2-second benchmark during loading picks the starting tier.
- Zero garbage in the frame loop: every buffer and texture is created up front, and the loop uses typed arrays only.
- Every shader program is compiled and drawn once behind the loading bar, so the first explosion never stutters.
- The CPU only does input and game logic. Simulation, collapse and colour all run on the GPU. Districts are generated in a worker.
- Readbacks from the GPU are asynchronous (fence + pixel buffer, a few times per second), so the CPU never waits for the GPU.

## 4. How the "impossible" is made light (WebGL2 GPGPU)

| On screen | Technique |
|---|---|
| 200,000 mites | State (position, velocity, kind) is kept in float textures, 512 × 512 = 262,144 slots, and updated with ping-pong fragment passes. |
| Liquid flow without collisions between mites | Each frame every mite is splatted additively into a density field (a 2D grid over the world). Mites follow the leader and are pushed down the density gradient. This is fluid-like separation with no sorting and no atomics. |
| Climbing walls and giants | The world has an analytic SDF (the ground plus boxes and capsules looked up through a cell → object grid). Mites stick to surfaces and gravity follows the surface normal. |
| Holes where they eat | Each building is a voxel volume stored as a tile of a density atlas. Eating mites are rendered as points into the atlas with subtractive blending. Voxels are drawn instanced and vanish where the density is 0. |
| Towers collapsing | An analytic collapse runs in the vertex shader: each voxel falls with gravity after a delay set by its height, bounces once and settles as rubble, which is then food. There is no physics engine. |
| Thousands of light sources | The same density field, blurred through a small mip chain, lights the ground and the voxels. |
| Colour coming back | A world-space colour map that the swarm paints into; every surface blends from grey to colour. |
| Every mite animated | Instanced quads with a wing flap computed in the shader. Near mites are shaded sprites, far mites are glowing points. |
| Sound of the swarm | A synthesized swarm sound in an AudioWorklet. Its density and pitch follow the swarm's size and speed. |

## 5. Size budget

| Part | Size |
|---|---|
| Engine and game code | 0.6 MB |
| Shaders | 0.15 MB |
| Procedural districts (generated from small rule sets) | 0.3 MB |
| Palettes and small textures | 0.8 MB |
| Music (sound effects are synthesized) | 1.5 MB |
| UI and font | 0.2 MB |
| **Total** | **about 3.5–4 MB** (a hard cap of 7.5 MB) |
