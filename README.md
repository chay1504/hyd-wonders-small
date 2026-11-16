# Hyderabad, above the clouds

A walkable Three.js world: Charminar, Mecca Masjid, Laad Bazaar, Hussain Sagar, Taramati Baradari,
the Qutb Shahi tombs, Golconda Fort and HITEC City on stone islands over a sea of cloud.

## Play

Double-click `start.bat` (needs Node.js), or run `node serve.mjs` and open http://localhost:8791.

| Key | Action |
| --- | --- |
| W A S D / arrows | walk (left/right arrows turn the camera) |
| Mouse | look (click to capture the mouse, Esc to release) |
| Wheel | zoom |
| Shift | sprint |
| Z | toggle a slow stroll |
| Space | jump |
| F | drone camera (Space / C for height) |
| R | back to the start |
| G | quality: Ultra / High / Fast |
| H | hide the HUD |

Find the 14 pearls hidden across the city.

## Layout

- `index.html` – page and HUD
- `src/main.js` – renderer, lighting, input, HUD, pearls, minimap
- `src/world.js` – every island and monument
- `src/charminar.js` – the detailed Charminar model
- `src/kit.js` – procedural textures, materials, arches, domes, geometry batching
- `src/sky.js` – sky dome, planet, cloud sea
- `src/player.js` – the character, walking and cameras
- `src/phys.js` – walkable surfaces and blockers
- `vendor/` – Three.js r170 and its post-processing addons (MIT)
- `assets/character.glb` – the player model ("Soldier" from the Three.js examples, a Mixamo character);
  replace it with any glTF that has Idle, Walk and Run clips
- `assets/` – textures and sky (Poly Haven, CC0)

Geometry is procedural. Surface materials are photographic PBR texture sets and the sky is an HDR panorama,
both CC0 from Poly Haven (`assets/`). Rendering uses image-based lighting, sun shadows, ambient occlusion,
bloom and SMAA; resolution scales down automatically on slow GPUs.
