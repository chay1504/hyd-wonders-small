# Hyderabad, above the clouds — handover plan

This file is the single source for continuing the project in a fresh session. It describes the goal, the
constraints, how the code is organised, the exact world layout, what is finished and what is left.
**Keep section 8 (status and checklist) up to date as steps finish.**

Where a number here disagrees with the code, the code wins; the numbers were checked against the code on
2026-11-16.

---

## 1. Goal and reference

**Reference:** `C:\Users\hp\Downloads\Three.js_-_dDHnjq.mp4` (2 min, 4K). A Three.js demo of a fantasy Chinese
palace city floating above a sea of cloud: stone platforms whose plinths vanish into the clouds, red-and-gold
pagodas, a giant Earth-like planet low in a blue sky, strong sun with long shadows, a third-person character in
a cream-and-red gown walking the platforms, and drone shots flying between the towers. Its assets are highly
detailed and it looks close to photoreal.

**What we are building:** the same kind of world for Hyderabad — its landmarks on floating stone islands over a
cloud sea, with the giant planet — playable as a third-person exploration game (walk, run, jump, drone camera,
collect 14 pearls, title card on entering each landmark).

**The user's quality bar (important):** they rated the first, stylised low-poly version 2/10. They want
"each and everything to be very precise, very ultra realistic". Every remaining task should be judged against
that: photographic materials, accurate proportions, rich architectural detail. Do not ship flat-coloured
primitives.

## 2. Tech and constraints

- **Three.js r170**, vendored: `vendor/three.module.js`, addons in `vendor/addons/` (postprocessing, shaders,
  loaders, math, utils). No build step, no npm at runtime. `index.html` has an importmap:
  `three` → `./vendor/three.module.js`, `three/addons/` → `./vendor/addons/`.
- **Serve:** `node serve.mjs [port]` (zero-dependency static server, default 8791) or `start.bat`.
  Preview config `hyderabad-sky` exists in `C:\Users\hp\Downloads\xyz\.claude\launch.json`.
- **Assets** (`assets/`, about 61 MB, all CC0 from Poly Haven): `sky_4k.hdr` (background), `sky_1k.hdr`
  (lighting) = `kloofendal_48d_partly_cloudy_puresky`; `tex/<id>_{diff,nor,arm}.jpg` for: `plastered_wall_02`,
  `grey_plaster_02` (2k), `seaworn_stone_tiles` (2k), `rock_tile_floor`, `large_sandstone_blocks` (2k),
  `castle_wall_slates`, `rock_boulder_dry`, `white_stucco_02`, `marble_01`, `leafy_grass`, `brown_planks_03`.
  `character.glb` is the player model: `Soldier.glb` from the Three.js r170 examples (a Mixamo character,
  "Vanguard", with Idle / Walk / Run clips; fine for local use, not for redistribution as an asset).
  More can be fetched from `https://api.polyhaven.com/files/<id>` (keys `Diffuse`, `nor_gl`, `arm`).
- **Hardware:** the user's PC has Intel UHD integrated graphics (no dedicated GPU), 15.6 GB RAM, Windows 11.
  Measured about 30 ms/frame at Ultra, 1088×612 internal. Performance rules that must be kept:
  - merge static geometry per island and per material (`Batch`), instancing for repeated small things;
  - one directional shadow map (2048, PCFSoft), refreshed every other frame, following the player with
    texel snapping;
  - pixel ratio starts at min(devicePixelRatio, 1), max 1.25, drops by 0.15 down to 0.6 when fps < 24;
  - ambient occlusion is computed at half resolution; the cloud sea samples a baked noise texture instead of
    evaluating fbm per pixel;
  - quality key `G`: Ultra (AO + bloom + SMAA), High (bloom + SMAA), Fast (direct render with MSAA).
- **Rendering pipeline:** linear HDR → `EffectComposer` (RenderPass → GTAOPass → UnrealBloomPass → OutputPass
  with ACES tone mapping → SMAAPass). Custom shaders must output linear light and end with
  `#include <tonemapping_fragment>` and `#include <colorspace_fragment>` so they work in both the composer
  and the direct path.

## 3. Conventions

- Units are metres, **y up**. North is **−z**, east is **+x**. The player spawns south of Charminar looking north.
- Rotation `ry` about Y follows Three.js: local +z maps to world `(sin ry, cos ry)`, local +x to `(cos ry, −sin ry)`.
- `mat4(x, y, z, ry, sx, sy, sz, rx, rz)` composes with Euler order `YXZ` (roll, then pitch, then yaw).
- `Batch.box/cyl` take **y as the underside** (the shape sits on y). `Batch.sphere` takes the centre.
- A segment from A to B has `ry = atan2(dx, dz)`; a wall whose face should look along the segment's normal
  uses `ry = atan2(−dz, dx)` (see `kanguraRow`).
- GLSL: never call `smoothstep(a, b, x)` with a > b (undefined); write `1.0 − smoothstep(b, a, x)`.

## 4. Files and their APIs

| File | Lines | Role |
| --- | --- | --- |
| `index.html` | 95 | Page, HUD markup and CSS, importmap. HUD ids: `loading`, `intro`, `begin`, `place`, `mode`, `pearlCount`, `pearlTotal`, `map` (232×161 canvas), `qual`, `card`/`cardName`/`cardSub`, `toast`, `flash`. Body classes: `playing`, `nohud`. No glass/blur effects (user preference). |
| `src/phys.js` | 98 | Analytic collision. |
| `src/kit.js` | 539 | Textures, materials, `Batch`, architectural shapes. |
| `src/sky.js` | 206 | Planet, cloud sea, cumulus billboards. |
| `src/player.js` | 172 | Character mesh, walking controller, chase and drone cameras. |
| `src/charminar.js` | 163 | The detailed Charminar. |
| `src/world.js` | 825 | Every island, monument, bridge, prop; `buildWorld`. |
| `src/main.js` | 356 | Async init, sky/sun, composer, input, HUD, pearls, minimap, loop. |
| `serve.mjs`, `start.bat` | | Static server and launcher. |

### phys.js
- `surfaces[]`, `blockers[]`.
- `addRect(cx, cz, w, d, y0, rot=0, y1=y0, tag)` — walkable rectangle; a ramp when `y1 ≠ y0` (y0 at local
  z = −d/2, y1 at +d/2). `addDisc(cx, cz, r, y, tag)`, `addRing(cx, cz, r0, r1, y, tag)`.
- `groundAt(x, z, y, out)` — highest surface under the point that is at most `STEP` (0.6) above y.
- `addBox(cx, cz, w, d, rot, y0, y1)`, `addCirc(cx, cz, r, y0, y1)`, `addRingBlock(cx, cz, r0, r1, y0, y1)`.
  A blocker is ignored when `feet + 0.55 ≥ y1` (can step over) or `feet + 1.7 ≤ y0`.
- `addRaised(cx, cz, w, d, rot, yTop)` — walkable slab plus a blocker up to its top (plinths).
- `resolve(pos, radius)` — pushes the player out of blockers; circles add a slight sideways slip so a head-on
  walk slides round.
- Anything raised more than 0.6 m needs a blocker, or the player walks into it.

### kit.js
- Constants: `CLOUD_Y = −21`; `MIST` (Vector3) and `HAZE` (Vector4: rgb + density), linear colours shared by
  all patched materials.
- `rng(seed)`, `noise3`, `fbm3`, `rockGeo(seed, detail, amp, flatTop)` (noise-displaced icosphere).
- `manager` (LoadingManager for textures and HDRs), `NOISE_TEX` (512² tileable fbm, R broad / G fine).
- `patch(material)` — onBeforeCompile hook adding: world-space weathering (blotches, rain streaks; strength
  `material.userData.weather`, default 1), aerial haze, and the mist fade below y ≈ −2.5…−20. **Every
  MeshStandard/Physical material in the scene should go through `patch`.**
- `initMaterials()` fills `M`: `lime`, `limeTrim`, `limeShade`, `granite`, `granDark`, `pave`, `paveDark`,
  `stoneWhite`, `marble`, `rock`, `grass`, `leaf`, `leaf2`, `trunk`, `wood`, `concrete`, `white`, `jali`
  (alpha-cut pierced screen), `frieze` (carved-relief normal map), `arcadeBand` (alpha-cut ring of little
  arches, keeps its own UVs), `frond` (alpha-cut palm frond, keeps UVs), `gold`, `green`, `iron`, `yellow`,
  `black`, `glass`, `water` (`userData.ripple` is its normal map, scrolled in main). `fabric(hex)` for cloth.
  PBR materials take a linear `tint` multiplier (may exceed 1) and a `uv` scale (tiles per metre).
- `Batch` — `push(x,y,z,ry)` / `pushM(m)` / `pop()` transform stack; `g(mat, geo, matrix)`; `box`, `cyl`,
  `sphere`, `lathe`; `build(parent)` merges per material. UVs are re-projected in world space (box mapping at
  `mat.userData.uv`) unless `mat.userData.keepUV`. Do not use negative scales.
- Shapes: `arcadeGeo(W, H, arches[{x,w,spring,apex}], depth)` (pointed arches standing on the ground line),
  `wallHoles(W, H, openings[{x,y,w,spring,apex}], depth)`, `evenOpenings`, `kanguraRow/Square/Ring` (leaf
  merlons), `onionPts`, `dome(b, mat, x, y, z, r, h, opts)`, `finial`, `miniMinaret`, `grandMinaret` (old,
  unused), `signMesh(text, w, h, bg, fg, font)`.

### sky.js
`makeSky(scene, sunDir, ISLANDS)` → `{ group, uniforms, update(camera, time) }`. `group.children` =
`[planet, cloud sea, puffs]`. Uniforms `uLit`, `uShade`, `uFar` (linear cloud colours), `uSun`, `uNoise`.
The planet sits at direction (0.42, 0.44, −0.8) from the camera, radius 1050 at distance 3600.

### player.js
`new Player(scene, camera, spawn)`; fields `pos`, `vel`, `heading`, `yaw`, `pitch`, `dist`, `fly`, `flyPos`,
`safe`; methods `update(dt, input)`, `animate(dt, speed)`, `teleport(x,y,z)`, `toggleFly()`; `onRespawn`.
`new Player(scene, camera, spawn, gltf)` — when a glTF is passed, `useModel` scales it to 1.78 m, turns it by
`MODEL_YAW` (π for this model, which faces −z), plays Idle / Walk / Run through an `AnimationMixer` and
measures each gait's natural ground speed from the foot bone (walk 1.71 m/s, run 4.21 m/s here) so
`animateModel` can cross-fade by speed and scale playback to stop the feet sliding. Without a model the
old procedural figure is used. `SPEED = { stroll: 1.9, jog: 5.0, sprint: 7.2 }` m/s; jump velocity 8.8,
gravity 26, radius 0.38, half speed in water. `player.debugSpeed` forces a gait on the spot (screenshots). Falling below
`CLOUD_Y − 4` returns the player to the last dry grounded spot. Camera forward on the ground is
`(−sin yaw, −cos yaw)`.

### main.js
`init()` is async: start texture loads → load both HDRs → `analyseSky` (finds the sun in the 1k HDR, clamps
it to 9 so the sky lights softly) → rotate background/environment so the sun sits at azimuth
`atan2(0.52, 0.6)` → build world and sky → sun `DirectionalLight(0xffeed2, 7.0)` with shadow half-extent 85,
warm `HemisphereLight(0x000000, 0xd9b27c, 0.9)`, `environmentIntensity 0.72`, exposure 0.74, camera fov 55,
far 9000 → player, pearls, composer, input, HUD, loop. Debug hook: `window.game` (`player`, `camera`,
`renderer`, `scene`, `world`, `pearls`, `begin`, `sun`, `sky`, `composer`, `gtao`, `bloom`, `MIST`, `HAZE`,
`M`, `setQuality`, `setPixelRatio`, `fps`, `pixelRatio`, `quality`).

## 5. World layout (exact numbers)

Helpers in world.js: `island(b, cx, cz, w, d, y, gaps)` (paved slab, cornice, stone plinth 70 m down, rails
with `gaps: [{side: 'N'|'S'|'E'|'W', at, w}]`, N = −z edge, S = +z, W = −x, E = +x), `bridge(b, x0,z0,y0,
x1,z1,y1, width, {piers})`, `stairs(b, mat, cx, cz, ry, width, run, yBot, yTop, cheek)` (rises toward the
frame's +z), `rail`, `arcadeWall` (arcade plus pier blockers), `tree(b,x,y,z,s,kind)` (0 round, 1 cypress,
2 palm), `boulder`, `lamp`, `beam`, `stall`, `autoRickshaw`, `islet`. Rail blockers are 2.2 m tall so they
cannot be jumped.

### Islands

| Island | Centre (x, z) | Size (x × z) | Top y | Rail gaps |
| --- | --- | --- | --- | --- |
| Charminar Chowk | (0, 0) | 100 × 100 | 0 | N at x=0 w16; E at z=0 w10; W at z=0 w10 |
| Laad Bazaar street | (0, −85) | 16 × 70 (z −120…−50) | 0 | open at both ends |
| Hussain Sagar | (0, −175) | ring r 41…55, lake inside | 0 | S (0.16 rad), E (0.105), W (0.125) |
| Taramati Baradari | (150, −175) | 34 × 34 | 3 | W at z=−175 w10; S at x=150 w10 |
| Qutb Shahi tombs | (150, −30) | 100 × 120 | 5 | W at z=0 w10; N at x=150 w10 |
| Golconda | (−170, 0) | 130 × 130 | 0 | E at z=0 w10; N at x=−170 w10 |
| HITEC City | (−170, −175) | 110 × 90 | 8 | S at x=−170 w10; E at z=−175 w12 |

### Bridges (x0, z0, y0 → x1, z1, y1, width)

- Chowk → tombs: (50, 0, 0) → (100, 0, 5), 10
- Chowk → Golconda: (−50, 0, 0) → (−105, 0, 0), 10
- Hussain Sagar → Baradari: (55, −175, 0) → (133, −175, 3), 9
- Baradari → tombs: (150, −158, 3) → (150, −90, 5), 9
- Golconda → HITEC: (−170, −65, 0) → (−170, −130, 8), 9
- Hussain Sagar → HITEC, cable-stayed (Durgam Cheruvu style): (−55, −175, 0) → (−115, −175, 8), 11, no
  piers; two A-frame pylons at x = −73 and −97 (legs 46 m leaning 0.135 rad, five cable pairs each way).

### Charminar (`charminar.js`), at (0, 0, 0)
Footprint S = 22 (real 20 m scaled 1.1). Per face: main wall `arcadeGeo(22, 24, arch w 11, spring 11.5,
apex 20, depth 3)` at offset 9.5; two stepped frame plates in front; rosettes at ±4.75, y 18.5; pilaster
strips at ±7.75; carved frieze y 21.9–23; 16 brackets; cornice; sloping eave (rx 0.3). Gallery G0 = 24.9,
height 6.2: seven arches (w 1.62, spring 2.9, apex 4.55) over a jali balustrade, gabled clock panel with
clock centre at G0 + 4.35. Attic A0 = 31.7, height 5, half-width 8: five arches (w 2.05) closed with jali.
Kangura parapets at A0 and A0 + 5.5. Minarets at (±11, ±11): height 56, base radius 3.0 tapering to 2.34 at
y 48.2, eight engaged ribs, ring mouldings, balconies at y 24.9, 33.6, 41.4 (lotus bracket, deck, arcaded
ring 2 m tall, eave), dome on a kangura collar. Blockers: pier boxes 5.5 × 3 at local x ±8.25 on each face,
circles r 3.9 at the minarets. The four arches are walkable through; inlaid star on the floor.

### Chowk props
Mecca Masjid facade at (−39, 0, 27), ry = π/2 (faces east): W 34, H 13, five arches (w 5.6, spring 6.2, apex
10.3), back wall, three roof domes, two `miniMinaret(r 2.3, H 25)` at local x ±19.4, 0.3 m platform.
Gulzar Houz fountain at (0, −31), r 4.5. Irani café at (33, 36), ry = −π/2 − 0.5, sign
"IRANI CHAI • OSMANIA BISCUIT". Auto-rickshaws at (20, 41), (14.5, 42.5), (−17, −41), (41, −13). Five
pushcart stalls, 8 trees, 14 lamps. Dark road strips: N–S 12 wide, E–W 10 wide.

### Laad Bazaar
Char Kaman gateway at z = −55: `arcadeGeo(15.2, 13, arch w 8.6, spring 6, apex 10.2, depth 2.6)`, sign
"LAAD BAZAAR" at y 11.75 facing south, two mini minarets on top, pier blockers at x ±5.95. Twelve stalls:
left at x −5.6 (ry π/2), right at x 5.6 (ry −π/2), z from −65 stepping −9.4; kinds cycle bangles / pearls /
spices / cloth. Seven strings of lanterns across the lane (instanced octahedra). Bangles are an
InstancedMesh of tori.

### Hussain Sagar
Ring walkway r 41–55 at y 0; water surface y −0.45; wading floor y −1.45 (tag `water`); ring blocker keeps
waders inside; rail round the outer rim (96 chords) with three openings; 10 lamps and 10 palms alternating.
Causeway 5 × 32.4 centred (0, −150) to a plinth disc r 9. Buddha on the rock at the centre, facing south
(+z): rock r ≈ 6, lotus pedestal at y 3.6, lathe body from y 4.5 (14.4 tall, flattened to 0.62 in z), head
at y 19.75, right hand raised. Five waterfalls on the outer wall at angles 0.9, 2.2, 3.6, 4.6, 5.4 rad.
Tricolour flag on a 36 m pole at (0, −223).

### Taramati Baradari
Plinth 18 × 18, 1.2 high, at the island centre; pavilion 13 × 13, H 6.6, three arches per side (w 2.9,
spring 2.9, apex 5.2); stairs on the west (ry π/2) and south (ry π); four corner mini minarets.

### Qutb Shahi tombs
`tomb(b, x, y, z, S, ry)` — plinth S + 10 square, 1.2 high, stairs on local +z; ground storey S wide,
0.42 S high, five arches per side; upper storey 0.68 S, 0.25 S high; drum; onion dome r 0.36 S, h 0.5 S;
eight mini minarets. Tombs: (168, −30) S 24 ry −π/2; (125, −68) S 15 ry 0; (130, 16) S 15 ry π.
Charbagh water channel 40 × 4.4 at (127, −30), four lawns, cypress rows at z −30 ± 5.2, 12 trees, 6 lamps.

### Golconda
Fort wall square x −229…−111, z −59…59 (8.5 high, 3 thick, kangura merlons); gate gaps on the east (z ±7)
and north (x −170 ± 7) with gatehouses 14 × 12 × 4.2 (arch w 6, apex 8.6); corner bastions r 6.5 h 11; six
more r 4.6 h 10. Citadel terraces (centre x, z, radius, top y): (−175, 0, 40, 7), (−178, −2, 27, 13),
(−181, −3, 14, 19). `terraceStairs(terrace, angle, yBottom, width)` with rise/run 0.75: east (π/2) from 0,
south (0) from 7, north (π) from 13. Bala Hisar pavilion on the summit at (−181, 19, −1.5): 12 × 8.6, H 6,
arcades 3 + 2 arches, small upper storey, green pennant. Boulders and trees on the ground and terraces.

### HITEC City
Cyber Towers drum at (−204, −204): r 11.5, h 40 on a r 14 podium, two wings r 8 h 30 at offsets
(14.5, 2) and (2, 14.5). Glass towers `(x, z, w, d, h)`: (−136, −203, 18, 15, 68), (−206, −149, 16, 16, 47),
(−137, −149, 22, 13, 22). Fountain with a gold sphere at the centre, r 5.4. Sign monolith "CYBER TOWERS" at
(−181, −184), ry π/4. Four lawns, trees, lamps.

### Scenery, spawn, pearls, zones
- 13 non-walkable drifting islets (`islet`), listed in `buildWorld`.
- **Spawn:** (0, 0, 33).
- **Pearls (14):** (0, 1.3, 0), (−39, 1.6, 27), (0, 1.3, −55), (1.5, 1.3, −96), (0, 1.3, −167.5),
  (5, 1.3, −223), (150, 5.5, −175), (153.5, 7.5, −30), (190, 6.3, 22), (−117, 1.3, 0), (−181, 20.3, −1.5),
  (−85, 5.3, −175), (−170, 9.3, −160), (−209, 8.3, 8). Collected within √2.6 m horizontally.
- **Zones (name, x, z, r):** Charminar (0, 0, 47); Mecca Masjid (−37, 27, 16); Laad Bazaar (0, −88, 33);
  Hussain Sagar (0, −175, 56); Taramati Baradari (150, −175, 22); Qutb Shahi Tombs (150, −30, 66);
  Golconda Fort (−170, 0, 80); HITEC City (−170, −175, 62). The smallest containing zone wins.
- **Minimap bounds:** x0 −246, z0 −240, width 464, height 322; drawn from `phys.surfaces`.

## 6. Gameplay and controls

W A S D or up/down arrows walk; left/right arrows or Q/E turn the camera; mouse look (click captures the
pointer, dragging also works, Esc releases); wheel zooms 3–42 m; default pace is a jog, Shift sprints, Z toggles a stroll; Space jumps; F toggles the
drone camera (Space / C for height, Shift fast); G cycles quality; R returns to spawn; H hides the HUD.
Title screen slowly orbits Charminar until "Enter the city" (or Enter / Space). HUD: place name, drone
label, pearl counter, minimap, help strip, zone title card (5 s), toast, white flash on respawn. A short
two-note ping plays on each pearl.

## 7. How to verify

1. Start the preview (`hyderabad-sky`, port 8791) and wait about 10 s for the 20 MB HDR.
2. Console must be clean. `game.begin()` starts play without clicking.
3. Drone view helper for screenshots:
   `view = (x,y,z,yaw,pitch) => { const p = game.player; if (!p.fly) p.toggleFly(); p.flyPos.set(x,y,z); p.yaw = yaw; p.pitch = pitch; document.body.classList.add('nohud'); }`
   Useful views: Charminar `view(20, 3.5, 46, 0.42, −0.3)`; aerial `view(40, 34, 120, 0.28, 0.2)`; bazaar
   `view(1, 2.4, −42, 0, −0.1)`; lake `view(14, 6, −128, 0.35, 0)`; tombs `view(104, 9, 6, −1.25, −0.1)`;
   Golconda gate `view(−78, 6, 10, 1.45, −0.12)`; summit `view(−150, 30, 40, 1.0, 0.1)`; HITEC
   `view(−150, 12, −140, 0.75, −0.25)`.
4. Collision checks by simulation: set `player.pos`, `yaw`, then call `player.update(1/60, input)` in a loop
   with `{fwd: 1}` and read the end position. Expected: Golconda stairs from (−116, 0, 0) yaw π/2 reach
   y 7; east bridge from (48, 0, 0) yaw −π/2 reaches y 5; walking into the lake gives y ≈ −1.45 and
   `inWater`; a pier of Charminar stops a walker from (8, 0, 20).
5. Frame cost: time `composer.render()` followed by `gl.readPixels` of one pixel, after a few warm-up
   frames. The first frames after a change include shader compilation and are meaningless.

**Checks that do not need the in-app preview pane** (it froze once under two heavy tabs):

- Screenshot: `chrome --headless=new --user-data-dir=<temp> --window-size=1280,720 --use-angle=d3d11 --enable-gpu
  --ignore-gpu-blocklist --virtual-time-budget=25000 --screenshot=out.png "http://localhost:8791/?shot=x,y,z,yaw,pitch"`
  (`?shot=` starts in the drone view with the HUD hidden). Takes about 20 s per view.
- Collision: same command with `--dump-dom "http://localhost:8791/?selftest"`, then read `<pre id="selftest">`.
  Expected end positions (2026-11-17, jog 5.0 m/s): through Charminar 0, 0, −16.6; pier 6.7, 0, 11.4; east
  bridge 107.6, 5, 0; great tomb 158.4, 7, −30; small tomb 125, 6.2, −62.9; Mecca Masjid −46.7, 0.3, 27;
  east gate −124.6, 0.3, 1.2; ring stairs reach y 7, 13 and 19; rim parapet −175, 7, 38.7; north gate
  −170, 2.4, −84.6; lake 20, −1.4, −146.4 (water); lake rim 8, −1.4, −214.8; cable bridge −121.5, 8, −175;
  Baradari 155.6, 4.2, −175; rail 20, 0, 48.9; last line reports the character's measured gait speeds.
- Character: `"http://localhost:8791/?chase=x,y,z,camYaw,pitch,dist,speed"` shows the player on the spot at a
  given gait speed (0 idle, 1.9 stroll, 5 jog) with the HUD hidden; camYaw π looks at the face.

- Frame rate: `node tools/bench.mjs <temp-profile-dir> 1280,720` (add a third argument for a shorter
  two-view run). It drives headless Chrome over the DevTools protocol in real time and prints fps per
  quality level and where the automatic resolution scaler settles.

Pitfalls met so far: the preview pane can be hidden, which throttles `requestAnimationFrame` to about 1 fps
and makes the in-game fps reading useless; screenshots sometimes lag one view behind; long JS heredocs in
bash broke on quotes, so write edit scripts to a file first.

## 8. Status and checklist

### Done
- [x] Collision system, materials kit, sky, player, world, main loop, HUD, static server, launcher
- [x] All seven islands, six bridges, props, pearls, zones, minimap
- [x] Walk-through tests (stairs, bridges, lake, rails, respawn)
- [x] Realism pass 1: photographic PBR materials, HDR sky and image-based lighting, sun-matched shadows,
      ambient occlusion, bloom, SMAA, weathering shader, lit cloud sea, quality levels, adaptive resolution
- [x] Charminar rebuilt in detail (`src/charminar.js`)
- [x] Realistic palms, natural boulders, pierced jali screens
- [x] Shared ornament kit in `kit.js`: `arcadeRing`, `petalRing`, `rosette`, `rosetteLite`, `corniceRing`
      (frieze + brackets + slab + sloping eave), lotus-calyx `dome`, galleried `miniMinaret`
- [x] Qutb Shahi tombs rebuilt: panelled plinth, open arcade with a walkable veranda, medallions, cornices,
      jali parapets and screens, arcaded drum, lotus-calyx dome (great tomb: plinth 2.0 high, 7 arches)
- [x] Mecca Masjid rebuilt: three-plane front arcade with rosettes, second arcade inside, qibla wall with
      five mihrab niches, cornice ring, jali parapet, two galleried towers (hall is walkable)
- [x] Golconda rebuilt: battered walls with string courses, slits and double merlons; gatehouses with
      carved bands and open iron-studded doors (north gate now `ry = PI`); crenellated rim parapets on
      the three rings (`rimParapet`, with a gap at each stair); granite outcrops; Bala Hisar cornices
- [x] Buddha re-sculpted: double-lotus pedestal, draped robe folds, face, ears, curls, raised hand
- [x] Baradari, Char Kaman and the HITEC towers detailed (cornices, medallions, fins, floor plates, podiums)
- [x] Automated checks added (see section 7): `?shot=`, `?chase=` and `?selftest` URL parameters
- [x] Performance measured on the Intel UHD after the monument pass (2026-11-17, about 590k triangles,
      real-time in headless Chrome via `tools/bench.mjs`):
      - 1280×720 window: Ultra 29–44 fps, High 41–53, Fast about 60 (Charminar and tombs views).
      - 1920×1080 window: Ultra 14–21 fps at full resolution; the automatic scaler settles at pixel
        ratio 0.7 (about 1331×688 internal) and holds 27–35 fps. High at full resolution 22–28, Fast 40–43.
      Readings vary a few fps run to run. No trimming was needed; re-run after any large addition.
- [x] Animated player character (2026-11-17): `assets/character.glb` with idle / walk / run blending,
      stroll (Z) / jog / sprint (Shift) paces

### Remaining, in suggested order
Each item should reach the level of `charminar.js`: accurate proportions, real openings, carved bands,
brackets, pierced screens. Verify each in the browser from two or three views before moving on, and
re-run the collision checks if blockers change.

- [ ] **Golconda hill:** the rings are still clean cylinders; a noise-displaced granite terrain mesh
      under them (keeping the three walkable discs) would read as a real hill.
- [ ] **Buddha face:** still simple; a sculpted GLB head or statue would be better.
- [ ] **Player character, better fit (parked):** the user chose to **keep the soldier** on 2026-11-17, so
      do not replace it unless they ask. For reference: the current model is an armoured soldier, which
      does not suit Hyderabad. Any glTF with clips named Idle, Walk and Run dropped at `assets/character.glb` replaces
      it (set `MODEL_YAW` in `player.js` if it faces the other way). A civilian needs a login-gated
      download (e.g. Mixamo: one character plus Idle, Walking and Running as FBX), merged into one GLB
      with Blender, which the user has. There is no jump animation yet.
- [ ] **Trees:** round trees are smooth foliage masses (topiary-like); switch to alpha-card canopies like the palm fronds.
- [ ] **Laad Bazaar:** stall detail and shop fronts behind the stalls.
- [ ] **HITEC City:** Cyber Towers drum façade (it only has bands), reflections check.
- [ ] **Bridges:** piers with pointed arches between them.
- [ ] **Planet:** large and pale; consider a smaller, crisper disc.
- [ ] **Water:** planar or screen-space reflections are too heavy for this GPU; try a fresnel term and
      depth-based tint in the `water` material instead.
- [ ] **Camera:** chase camera can clip through walls and rails; add a simple pull-in using `resolve` or
      a ray against blockers.
- [ ] Optional: dusk/night mode with lit lamps and lanterns; touch controls.

### Open questions for the user
- The user chose "other monuments" first (done 2026-11-16). They then asked for a free character of my choosing (done 2026-11-17, see above).
- Do they have a character model they want to use?
