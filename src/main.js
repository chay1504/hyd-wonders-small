import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { initMaterials, patch, manager, MIST, HAZE, M } from './kit.js';
import { makeSky } from './sky.js';
import { buildWorld, ISLANDS } from './world.js';
import { Player } from './player.js';
import { surfaces } from './phys.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');

// ------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const MAX_PR = Math.min(window.devicePixelRatio || 1, 1.25);
let pixelRatio = Math.min(MAX_PR, 1);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.74;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.3, 9000);

// ------------------------------------------------------------ loading
let pending = 0, done = 0;
manager.onProgress = (_u, loaded, total) => { done = loaded; pending = total; $('loading').textContent = `Raising the city… ${Math.round(loaded / total * 100)}%`; };

/** Find the sun in an equirectangular HDR and tame it so the sky lights softly (the sun itself is a real light with shadows). */
function analyseSky(tex) {
  const { data, width: w, height: h } = tex.image, half = data instanceof Uint16Array;
  const rd = half ? THREE.DataUtils.fromHalfFloat : (v) => v, wr = half ? THREE.DataUtils.toHalfFloat : (v) => v;
  const lum = new Float32Array(w * h); let best = 0;
  for (let i = 0; i < w * h; i++) { const l = rd(data[i * 4]) + rd(data[i * 4 + 1]) + rd(data[i * 4 + 2]); lum[i] = l; if (l > best) best = l; }
  const acc = new THREE.Vector3(), CAP = 9;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, l = lum[i];
    if (l > best * 0.2) {
      const lon = ((x + 0.5) / w - 0.5) * Math.PI * 2, lat = (0.5 - (y + 0.5) / h) * Math.PI, cl = Math.cos(lat);
      acc.x += cl * Math.cos(lon) * l; acc.y += Math.sin(lat) * l; acc.z += cl * Math.sin(lon) * l;
    }
    if (l > CAP) { const k = CAP / l; for (let c = 0; c < 3; c++) data[i * 4 + c] = wr(rd(data[i * 4 + c]) * k); }
  }
  tex.needsUpdate = true;
  if (acc.y < 0) acc.y = -acc.y;
  return acc.normalize();
}

async function init() {
  initMaterials();                                        // starts the texture downloads
  const hdr = new RGBELoader(manager);
  const [skyBg, skyEnv, character] = await Promise.all([
    hdr.loadAsync('./assets/sky_4k.hdr'), hdr.loadAsync('./assets/sky_1k.hdr'),
    new GLTFLoader(manager).loadAsync('./assets/character.glb').catch(() => null),   // falls back to the built-in figure
  ]);
  await new Promise((res) => { const t = () => (pending && done >= pending ? res() : setTimeout(t, 60)); t(); });

  // ---- sky and light: the photographed sun is rotated to where the scene wants it
  const sun0 = analyseSky(skyEnv);
  const wantAz = Math.atan2(0.52, 0.6), el = Math.asin(sun0.y);
  const rot = wantAz - Math.atan2(sun0.x, sun0.z);
  const sunDir = new THREE.Vector3(Math.cos(el) * Math.sin(wantAz), Math.sin(el), Math.cos(el) * Math.cos(wantAz));
  skyBg.mapping = skyEnv.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = skyBg; scene.backgroundRotation.y = rot;
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromEquirectangular(skyEnv).texture; scene.environmentRotation.y = rot;
  scene.environmentIntensity = 0.72;
  pm.dispose(); skyEnv.dispose();

  const world = buildWorld(scene);
  const sky = makeSky(scene, sunDir, ISLANDS);

  const sun = new THREE.DirectionalLight(0xffeed2, 7.0);
  sun.castShadow = true;
  const SH = 85;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 10, far: 700 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.25; sun.shadow.radius = 2.5;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0x000000, 0xd9b27c, 0.9));   // warm light bounced up off the sunlit stone
  const sRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), sunDir).normalize();
  const sUp = new THREE.Vector3().crossVectors(sunDir, sRight);
  const sFocus = new THREE.Vector3();
  function aimSun(p) {
    const texel = (SH * 2) / sun.shadow.mapSize.x;
    const tx = p.dot(sRight), ty = p.dot(sUp);
    sFocus.copy(p).addScaledVector(sRight, Math.round(tx / texel) * texel - tx).addScaledVector(sUp, Math.round(ty / texel) * texel - ty);
    sun.target.position.copy(sFocus);
    sun.position.copy(sFocus).addScaledVector(sunDir, 320);
  }

  // ---- player
  const player = new Player(scene, camera, world.spawn, character);
  player.onRespawn = () => { flash(); toast('The clouds carried you back'); };

  // ---- pearls
  const pearlGeo = new THREE.SphereGeometry(0.34, 32, 20);
  const pearlMat = patch(new THREE.MeshPhysicalMaterial({ color: 0xfff6ea, roughness: 0.16, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 1, sheenColor: 0xffd9e8, emissive: 0xfff1d8, emissiveIntensity: 0.25 }));
  const haloTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,246,220,0.9)'); gr.addColorStop(0.25, 'rgba(255,236,190,0.35)'); gr.addColorStop(1, 'rgba(255,230,170,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const haloMat = new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const noAO = [sky.group, ...world.noAO];
  const pearls = world.pearls.map(([x, y, z], i) => {
    const g = new THREE.Group(); g.position.set(x, y, z);
    const m = new THREE.Mesh(pearlGeo, pearlMat); m.castShadow = true; g.add(m);
    const h = new THREE.Sprite(haloMat); h.scale.setScalar(2.4); g.add(h); noAO.push(h);
    scene.add(g);
    return { g, x, y, z, got: false, ph: i * 1.7 };
  });
  let found = 0;
  $('pearlTotal').textContent = pearls.length;

  // ---- post-processing
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType }));
  composer.setPixelRatio(pixelRatio);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, size.x, size.y);
  gtao.updateGtaoMaterial({ radius: 1.9, distanceExponent: 1.5, thickness: 1.3, scale: 1.25, samples: 8, distanceFallOff: 1, screenSpaceRadius: false });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 8 });
  gtao.blendIntensity = 1;
  {
    const ov = gtao.overrideVisibility.bind(gtao), rv = gtao.restoreVisibility.bind(gtao);
    const was = new Map();
    gtao.overrideVisibility = () => { ov(); for (const o of noAO) { was.set(o, o.visible); o.visible = false; } };
    gtao.restoreVisibility = () => { rv(); for (const o of noAO) o.visible = was.get(o); };
    const ss = gtao.setSize.bind(gtao);                    // occlusion at half resolution: far cheaper, still soft
    gtao.setSize = (w, h) => ss(Math.ceil(w * 0.5), Math.ceil(h * 0.5));
  }
  composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.16, 0.7, 1.15);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const smaa = new SMAAPass(size.x, size.y);
  composer.addPass(smaa);
  composer.setSize(window.innerWidth, window.innerHeight);

  const QUALITY = ['Fast', 'High', 'Ultra'];
  let quality = 2;
  try { const q = localStorage.getItem('hyd-quality'); if (q !== null) quality = Math.max(0, Math.min(2, +q)); } catch (_) { /* private mode */ }
  function setQuality(q, say) {
    quality = q; gtao.enabled = q === 2; bloom.enabled = q >= 1;
    $('qual').textContent = QUALITY[q];
    try { localStorage.setItem('hyd-quality', q); } catch (_) { /* ignore */ }
    if (say) toast(`Quality: ${QUALITY[q]}${q === 2 ? ' — ambient occlusion, bloom, anti-aliasing' : q === 1 ? ' — bloom, anti-aliasing' : ' — direct rendering'}`);
  }
  setQuality(quality, false);
  function setPixelRatio(v) { pixelRatio = v; renderer.setPixelRatio(v); composer.setPixelRatio(v); composer.setSize(window.innerWidth, window.innerHeight); }

  // ---- input
  const input = { fwd: 0, back: 0, lft: 0, rgt: 0, left: 0, right: 0, up: 0, down: 0, jump: false, sprint: false, descend: false, stroll: false };
  const KEYS = {
    KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back', KeyA: 'lft', KeyD: 'rgt',
    ArrowLeft: 'left', KeyQ: 'left', ArrowRight: 'right', KeyE: 'right', PageUp: 'up', PageDown: 'down',
  };
  let started = false, hudHidden = false;
  addEventListener('keydown', (e) => {
    if (!started) { if (e.code === 'Enter' || e.code === 'Space') begin(); return; }
    if (KEYS[e.code]) { input[KEYS[e.code]] = 1; e.preventDefault(); }
    else if (e.code === 'Space') { input.jump = true; e.preventDefault(); }
    else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.sprint = true;
    else if (e.code === 'KeyC' || e.code === 'ControlLeft') input.descend = true;
    else if (e.code === 'KeyF' && !e.repeat) { const on = player.toggleFly(); $('mode').textContent = on ? 'Drone camera' : ''; toast(on ? 'Drone camera — WASD to fly, Space / C for height, F to return' : 'Back on foot'); }
    else if (e.code === 'KeyH' && !e.repeat) { hudHidden = !hudHidden; document.body.classList.toggle('nohud', hudHidden); }
    else if (e.code === 'KeyG' && !e.repeat) setQuality((quality + 2) % 3, true);
    else if (e.code === 'KeyZ' && !e.repeat) { input.stroll = !input.stroll; toast(input.stroll ? 'Strolling — Z to jog again' : 'Jogging'); }
    else if (e.code === 'KeyR' && !e.repeat) { player.teleport(world.spawn.x, world.spawn.y, world.spawn.z); player.yaw = 0; flash(); }
  });
  addEventListener('keyup', (e) => {
    if (KEYS[e.code]) input[KEYS[e.code]] = 0;
    else if (e.code === 'Space') input.jump = false;
    else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.sprint = false;
    else if (e.code === 'KeyC' || e.code === 'ControlLeft') input.descend = false;
  });
  addEventListener('blur', () => { for (const k in input) if (k !== 'stroll') input[k] = typeof input[k] === 'boolean' ? false : 0; });

  let dragging = false;
  const locked = () => document.pointerLockElement === canvas;
  canvas.addEventListener('pointerdown', (e) => {
    if (!started) return;
    dragging = true;
    if (e.pointerType === 'mouse' && !locked() && canvas.requestPointerLock) {
      try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* drag still works */ }
    }
  });
  addEventListener('pointerup', () => { dragging = false; });
  addEventListener('pointermove', (e) => {
    if (!started || !(dragging || locked())) return;
    player.yaw -= e.movementX * 0.0032;
    player.pitch += e.movementY * 0.0026;
  });
  canvas.addEventListener('wheel', (e) => {
    player.dist = Math.max(3, Math.min(42, player.dist * (1 + Math.sign(e.deltaY) * 0.1)));
    e.preventDefault();
  }, { passive: false });
  addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---- HUD helpers
  let toastTimer = 0;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); toastTimer = 3.4; }
  function flash() { const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
  let audio = null;
  function ping(n) {
    if (!audio) return;
    const t = audio.currentTime;
    [0, 0.09].forEach((d, i) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.value = (660 + n * 28) * (i ? 1.5 : 1);
      g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.12, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.6);
      o.connect(g).connect(audio.destination); o.start(t + d); o.stop(t + d + 0.65);
    });
  }

  let zone = null, cardTimer = 0;
  function checkZone() {
    let best = null;
    for (const z of world.zones) {
      const d = Math.hypot(player.pos.x - z.x, player.pos.z - z.z);
      if (d < z.r && (!best || z.r < best.r)) best = z;
    }
    if (best && best !== zone) {
      zone = best;
      $('cardName').textContent = best.name; $('cardSub').textContent = best.sub;
      $('card').classList.add('on'); cardTimer = 5;
      $('place').textContent = best.name;
    }
  }

  // minimap
  const MAP = { x0: -246, z0: -240, w: 464, h: 322 };
  const mm = $('map'), mctx = mm.getContext('2d');
  const mk = mm.width / MAP.w;
  const mx = (x) => (x - MAP.x0) * mk, mz = (z) => (z - MAP.z0) * mk;
  const mapBase = document.createElement('canvas'); mapBase.width = mm.width; mapBase.height = mm.height;
  {
    const g = mapBase.getContext('2d');
    for (const pass of [0, 1]) for (const s of surfaces) {
      const water = s.tag === 'water';
      if ((pass === 0) !== water) continue;
      g.fillStyle = water ? '#5fb0c8' : '#e9d9b0';
      if (s.k === 0) {
        g.save(); g.translate(mx(s.cx), mz(s.cz)); g.transform(s.c, -s.s, s.s, s.c, 0, 0);
        g.fillRect(-s.hx * mk, -s.hz * mk, s.hx * 2 * mk, s.hz * 2 * mk); g.restore();
      } else {
        g.beginPath(); g.arc(mx(s.cx), mz(s.cz), s.r1 * mk, 0, 7);
        if (s.r0 > 0) g.arc(mx(s.cx), mz(s.cz), s.r0 * mk, 0, 7, true);
        g.fill();
      }
    }
  }
  function drawMap() {
    mctx.clearRect(0, 0, mm.width, mm.height);
    mctx.drawImage(mapBase, 0, 0);
    mctx.fillStyle = '#fff'; mctx.strokeStyle = 'rgba(60,40,10,0.7)'; mctx.lineWidth = 1;
    for (const p of pearls) if (!p.got) { mctx.beginPath(); mctx.arc(mx(p.x), mz(p.z), 2.2, 0, 7); mctx.fill(); mctx.stroke(); }
    mctx.save(); mctx.translate(mx(player.pos.x), mz(player.pos.z)); mctx.rotate(-player.heading + Math.PI);
    mctx.fillStyle = '#b3202c'; mctx.strokeStyle = '#fff'; mctx.lineWidth = 1.2;
    mctx.beginPath(); mctx.moveTo(0, -6.5); mctx.lineTo(4.4, 5); mctx.lineTo(0, 2.4); mctx.lineTo(-4.4, 5); mctx.closePath(); mctx.fill(); mctx.stroke();
    mctx.restore();
  }

  // ---- start
  function begin() {
    if (started) return;
    started = true;
    document.body.classList.add('playing');
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { audio = null; }
    player.yaw = 0; player.pitch = 0.1; player.dist = 9.5;
    zone = null; checkZone();
  }
  $('begin').addEventListener('click', begin);

  // ---- loop
  const clock = new THREE.Clock();
  const ripple = M.water.userData.ripple;
  let time = 0, zoneTick = 0, slow = 0, fast = 0, frames = 0, fps = 60, tick = 0, lastMark = performance.now();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    time += dt;

    if (started) {
      player.update(dt, input);
    } else {
      const a = time * 0.06 + 0.45;
      camera.position.set(Math.sin(a) * 74, 13 + Math.sin(time * 0.11) * 4, Math.cos(a) * 74);
      camera.lookAt(0, 26, 0);
      player.animate(dt, 0);
    }

    for (const fn of world.anim) fn(time);
    ripple.offset.set(time * 0.012, time * 0.007);
    for (const p of pearls) {
      if (p.got) continue;
      p.g.position.y = p.y + Math.sin(time * 1.6 + p.ph) * 0.18;
      p.g.rotation.y = time * 0.8;
      if (started && !player.fly) {
        const dx = player.pos.x - p.x, dz = player.pos.z - p.z, dy = player.pos.y + 1 - p.y;
        if (dx * dx + dz * dz < 2.6 && Math.abs(dy) < 2.2) {
          p.got = true; p.g.visible = false; found++;
          $('pearlCount').textContent = found; ping(found);
          toast(found === pearls.length ? 'All the pearls of Hyderabad are yours — the City of Pearls is complete' : `Pearl ${found} of ${pearls.length}`);
        }
      }
    }

    aimSun(started && !player.fly ? player.pos : camera.position);
    renderer.shadowMap.needsUpdate = (tick++ & 1) === 0;      // the city is static: refresh shadows every other frame
    sky.update(camera, time);
    if (quality === 0) renderer.render(scene, camera); else composer.render(dt);

    if (started) {
      zoneTick -= dt; if (zoneTick <= 0) { zoneTick = 0.25; checkZone(); }
      if (cardTimer > 0 && (cardTimer -= dt) <= 0) $('card').classList.remove('on');
      if (toastTimer > 0 && (toastTimer -= dt) <= 0) $('toast').classList.remove('on');
      if (!hudHidden) drawMap();
      // adaptive resolution for integrated GPUs (real time, ignoring stalls and background tabs)
      frames++;
      const now = performance.now();
      if (now - lastMark >= 1500) {
        const span = now - lastMark; lastMark = now;
        if (document.visibilityState === 'visible' && span < 2500) {
          fps = frames * 1000 / span;
          slow = fps < 24 ? slow + 1 : 0; fast = fps > 50 ? fast + 1 : 0;
          if (slow >= 2 && pixelRatio > 0.62) { setPixelRatio(Math.max(0.6, pixelRatio - 0.15)); slow = 0; }
          else if (fast >= 4 && pixelRatio < MAX_PR) { setPixelRatio(Math.min(MAX_PR, pixelRatio + 0.1)); fast = 0; }
        }
        frames = 0;
      }
    }
    requestAnimationFrame(frame);
  }
  aimSun(world.spawn);
  requestAnimationFrame(frame);
  $('loading').remove();

  // debugging / screenshots
  window.game = {
    player, camera, renderer, scene, world, pearls, begin, sun, sky, composer, gtao, bloom, MIST, HAZE, M, setQuality, setPixelRatio,
    get fps() { return fps; }, get pixelRatio() { return pixelRatio; }, get quality() { return quality; },
  };
  // ?shot=x,y,z,yaw,pitch starts straight into a drone view with the HUD hidden (for automated screenshots)
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) {
    const [sx, sy, sz, syaw, spitch] = shot.split(',').map(Number);
    begin(); player.toggleFly(); player.flyPos.set(sx, sy, sz); player.yaw = syaw; player.pitch = spitch;
    document.body.classList.add('nohud');
  }
  // ?chase=x,y,z,camYaw,pitch,dist,speed shows the character on the spot at a given gait speed, HUD hidden
  const chase = new URLSearchParams(location.search).get('chase');
  if (chase) {
    const [cx, cy, cz, cyaw, cpitch, cdist, cspeed, cface] = chase.split(',').map(Number);
    begin(); player.teleport(cx, cy, cz); player.yaw = cyaw; player.pitch = cpitch; player.dist = cdist;
    player.debugSpeed = cspeed || 0; player.heading = Number.isFinite(cface) ? cface : Math.PI;
    document.body.classList.add('nohud');
  }
  // ?selftest walks fixed routes through the collision world and writes the end positions into <pre id="selftest">
  if (new URLSearchParams(location.search).has('selftest')) {
    begin();
    const mk = (o) => Object.assign({ fwd: 0, back: 0, lft: 0, rgt: 0, left: 0, right: 0, up: 0, down: 0, jump: false, sprint: false, descend: false }, o);
    const run = (name, x, y, z, yaw, secs, inp = { fwd: 1 }) => {
      player.pos.set(x, y, z); player.vel.set(0, 0, 0); player.grounded = true; player.safe.set(x, y, z); player.yaw = yaw;
      const i = mk(inp);
      for (let k = 0; k < secs * 60; k++) player.update(1 / 60, i);
      return `${name}: ${player.pos.x.toFixed(1)}, ${player.pos.y.toFixed(1)}, ${player.pos.z.toFixed(1)}${player.inWater ? ' (water)' : ''}`;
    };
    const P2 = Math.PI / 2, out = [
      run('through Charminar north', 0, 0, 33, 0, 10),
      run('Charminar pier stops walker', 8, 0, 20, 0, 4),
      run('east bridge up to tombs', 48, 0, 0, -P2, 12),
      run('great tomb stairs and veranda', 140, 5, -30, -P2, 6),
      run('small tomb stairs and veranda', 125, 5, -50, 0, 5),
      run('Mecca Masjid to the qibla wall', -28, 0, 27, P2, 6),
      run('Golconda east gate', -100, 0, 1.2, P2, 5),
      run('Golconda ring 1 stairs', -116, 0, 0, P2, 7),
      run('Golconda ring 2 stairs', -178, 7, 37, 0, 5),
      run('Golconda ring 3 stairs', -181, 13, -27.5, Math.PI, 5),
      run('Golconda rim parapet holds', -175, 7, 33, Math.PI, 4),
      run('Golconda north gate to bridge', -170, 0, -50, 0, 7),
      run('into the lake', 20, 0, -132, 0, 4),
      run('lake rim holds a wader', 8, -1.45, -200, 0, 6),
      run('cable bridge to HITEC', -52, 0, -175, P2, 14),
      run('Baradari stairs', 131, 3, -175, -P2, 5),
      run('rail holds at island edge', 20, 0, 45, Math.PI, 4, { fwd: 1, jump: true }),
    ];
    if (player.model) out.push(`character: height ${player.model.height.toFixed(2)} (source units), natural walk ${player.model.natural.walk.toFixed(2)} m/s, run ${player.model.natural.run.toFixed(2)} m/s`);
    else out.push('character: FALLBACK FIGURE (model not loaded)');
    const pre = document.createElement('pre'); pre.id = 'selftest'; pre.textContent = out.join('\n');
    document.body.appendChild(pre);
    player.teleport(world.spawn.x, world.spawn.y, world.spawn.z); player.yaw = 0;
  }
}

init().catch((err) => { console.error(err); $('loading').textContent = 'Could not start: ' + err.message; });
