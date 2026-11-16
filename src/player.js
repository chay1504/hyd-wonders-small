// The traveller: a rigged, animated human loaded from assets/character.glb (any glTF with clips named
// Idle, Walk and Run works), with a simple procedural figure as the fallback if the file is missing,
// plus a third-person controller and a free "drone" camera.
import * as THREE from 'three';
import { CLOUD_Y, patch } from './kit.js';
import { groundAt, resolve } from './phys.js';

function mat(color, rough = 0.8, extra = {}) {
  return patch(new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra }));
}

function buildFigure() {
  const root = new THREE.Group();
  const ivory = mat(0xf3ead6, 0.75), maroon = mat(0x8c1c2c, 0.7), skin = mat(0xc48a62, 0.7);
  const hair = mat(0x1c1512, 0.6), gold = mat(0xd9a93f, 0.3, { metalness: 1 }), white = mat(0xfaf7f0, 0.8);
  const add = (parent, geo, m, x, y, z) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o;
  };
  const body = new THREE.Group(); root.add(body);

  // legs (churidar) pivot at the hip
  const legs = [-1, 1].map((s) => {
    const hip = new THREE.Group(); hip.position.set(s * 0.1, 0.92, 0); body.add(hip);
    add(hip, new THREE.CylinderGeometry(0.085, 0.06, 0.86, 8), white, 0, -0.43, 0);
    add(hip, new THREE.BoxGeometry(0.11, 0.07, 0.27), maroon, 0, -0.885, 0.06);
    return hip;
  });
  // sherwani: flared skirt + fitted chest
  const skirtPts = [[0.3, 0], [0.285, 0.12], [0.25, 0.34], [0.215, 0.52], [0.21, 0.62]].map((p) => new THREE.Vector2(p[0], p[1]));
  const skirt = add(body, new THREE.LatheGeometry(skirtPts, 14), ivory, 0, 0.5, 0); skirt.scale.z = 0.72;
  skirt.material = ivory.clone(); patch(skirt.material); skirt.material.side = THREE.DoubleSide;
  const hem = add(body, new THREE.TorusGeometry(0.295, 0.016, 6, 18), gold, 0, 0.51, 0); hem.rotation.x = Math.PI / 2; hem.scale.y = 0.72;
  const chest = add(body, new THREE.CylinderGeometry(0.235, 0.21, 0.5, 14), ivory, 0, 1.33, 0); chest.scale.z = 0.66;
  add(body, new THREE.SphereGeometry(0.235, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), ivory, 0, 1.575, 0).scale.set(1, 0.42, 0.66);
  add(body, new THREE.BoxGeometry(0.03, 0.62, 0.02), gold, 0, 1.28, 0.152);          // button placket
  for (let i = 0; i < 5; i++) add(body, new THREE.SphereGeometry(0.018, 6, 5), gold, 0, 1.52 - i * 0.11, 0.168);
  add(body, new THREE.CylinderGeometry(0.075, 0.085, 0.07, 10), gold, 0, 1.63, 0);    // collar
  // stole across the left shoulder
  const stole = add(body, new THREE.BoxGeometry(0.13, 0.78, 0.035), maroon, 0.04, 1.34, 0.165); stole.rotation.z = 0.5;
  const stoleBack = add(body, new THREE.BoxGeometry(0.13, 0.95, 0.035), maroon, -0.02, 1.2, -0.165); stoleBack.rotation.z = -0.42;
  add(body, new THREE.BoxGeometry(0.15, 0.06, 0.36), maroon, -0.2, 1.6, 0);
  // arms pivot at the shoulder
  const arms = [-1, 1].map((s) => {
    const sh = new THREE.Group(); sh.position.set(s * 0.275, 1.55, 0); body.add(sh);
    add(sh, new THREE.CylinderGeometry(0.068, 0.055, 0.56, 8), ivory, 0, -0.28, 0);
    add(sh, new THREE.CylinderGeometry(0.058, 0.058, 0.035, 8), gold, 0, -0.55, 0);
    add(sh, new THREE.SphereGeometry(0.055, 8, 6), skin, 0, -0.61, 0);
    sh.rotation.z = s * 0.07;
    return sh;
  });
  // head
  add(body, new THREE.CylinderGeometry(0.055, 0.06, 0.1, 8), skin, 0, 1.69, 0);
  const head = add(body, new THREE.SphereGeometry(0.125, 16, 12), skin, 0, 1.83, 0); head.scale.set(0.92, 1.08, 1);
  const cap = add(body, new THREE.SphereGeometry(0.133, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), hair, 0, 1.845, -0.012);
  cap.scale.set(0.95, 1.05, 1.02);
  return { root, body, legs, arms, stoleBack };
}

// metres per second; Shift sprints, Z toggles a sightseeing stroll
export const SPEED = { stroll: 1.9, jog: 5.0, sprint: 7.2 };
const MODEL_YAW = Math.PI; // yaw that makes the loaded model face +z (the controller's forward); this one faces -z

export class Player {
  constructor(scene, camera, spawn, gltf = null) {
    this.camera = camera;
    this.fig = buildFigure();
    scene.add(this.fig.root);
    this.model = null;
    if (gltf) { try { this.useModel(scene, gltf); } catch (err) { console.warn('character model unusable, using the fallback figure', err); this.model = null; } }
    this.fig.root.visible = !this.model;
    this.pos = new THREE.Vector3().copy(spawn);
    this.vel = new THREE.Vector3();
    this.heading = Math.PI; this.grounded = true; this.phase = 0; this.moveAmt = 0;
    this.safe = spawn.clone(); this.safeTimer = 0; this.surface = null; this.inWater = false;
    this.yaw = 0; this.pitch = 0.16; this.dist = 9.5;
    this.target = new THREE.Vector3().copy(spawn).setY(spawn.y + 1.5);
    this.fly = false; this.flyPos = new THREE.Vector3(); this.onRespawn = null;
    this._hit = {};
  }

  teleport(x, y, z) { this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.target.set(x, y + 1.5, z); this.safe.copy(this.pos); }

  toggleFly() {
    this.fly = !this.fly;
    if (this.fly) this.flyPos.copy(this.camera.position);
    return this.fly;
  }

  update(dt, input) {
    // ---- camera angles (mouse deltas are consumed by main.js into yaw/pitch)
    this.yaw += (input.left - input.right) * 1.6 * dt;
    this.pitch += (input.up - input.down) * 1.0 * dt;
    this.pitch = Math.max(this.fly ? -1.45 : -0.14, Math.min(1.45, this.pitch));
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const fx = -sy, fz = -cy, rx = cy, rz = -sy;      // camera forward / right on the ground plane
    const mf = input.fwd - input.back, mr = input.rgt - input.lft;

    if (this.fly) {
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      const sp3 = (input.sprint ? 70 : 24) * dt;
      this.flyPos.x += (fx * cp * mf + rx * mr) * sp3;
      this.flyPos.z += (fz * cp * mf + rz * mr) * sp3;
      this.flyPos.y += (-sp * mf + (input.jump ? 1 : 0) - (input.descend ? 1 : 0)) * sp3;
      this.flyPos.y = Math.max(CLOUD_Y + 6, this.flyPos.y);
      this.camera.position.copy(this.flyPos);
      this.camera.rotation.set(-this.pitch, this.yaw, 0, 'YXZ');
      this.animate(dt, 0);
      return;
    }

    // ---- walking
    let wx = fx * mf + rx * mr, wz = fz * mf + rz * mr;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; }
    const speed = (input.sprint ? SPEED.sprint : input.stroll ? SPEED.stroll : SPEED.jog) * (this.inWater ? 0.5 : 1);
    const k = 1 - Math.exp(-(this.grounded ? 11 : 3.5) * dt);
    this.vel.x += (wx * speed - this.vel.x) * k;
    this.vel.z += (wz * speed - this.vel.z) * k;

    const prevY = this.pos.y;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    resolve(this.pos, 0.38);

    if (this.grounded && input.jump) { this.vel.y = 8.8; this.grounded = false; }
    this.vel.y -= 26 * dt;
    this.pos.y += this.vel.y * dt;
    const g = groundAt(this.pos.x, this.pos.z, Math.max(prevY, this.pos.y), this._hit);
    if (this.vel.y <= 0 && (this.pos.y <= g || (this.grounded && this.pos.y - g < 0.55))) {
      this.pos.y = g; this.vel.y = 0; this.grounded = true; this.surface = this._hit.s;
    } else {
      this.grounded = false;
    }
    this.inWater = this.grounded && this.surface && this.surface.tag === 'water';

    // remember the last dry, solid spot
    if (this.grounded && !this.inWater) {
      this.safeTimer += dt;
      if (this.safeTimer > 0.4) { this.safeTimer = 0; this.safe.copy(this.pos); }
    }
    if (this.pos.y < CLOUD_Y - 4) {
      this.pos.copy(this.safe); this.vel.set(0, 0, 0);
      if (this.onRespawn) this.onRespawn();
    }

    // ---- facing + animation
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (wl > 0 && hs > 0.3) {
      const want = Math.atan2(this.vel.x, this.vel.z);
      let d = want - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * (1 - Math.exp(-12 * dt));
    }
    this.animate(dt, hs);

    // ---- chase camera
    const tk = 1 - Math.exp(-10 * dt);
    this.target.x += (this.pos.x - this.target.x) * tk;
    this.target.z += (this.pos.z - this.target.z) * tk;
    this.target.y += (this.pos.y + 1.5 - this.target.y) * (1 - Math.exp(-6 * dt));
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this.camera.position.set(this.target.x + sy * cp * this.dist, this.target.y + sp * this.dist, this.target.z + cy * cp * this.dist);
    this.camera.lookAt(this.target.x, this.target.y + 0.35, this.target.z);
  }

  /** Adopt a glTF character: scale to human height, find its clips, and measure how fast each gait really covers ground. */
  useModel(scene, gltf) {
    const model = gltf.scene, root = new THREE.Group();
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        // cloth and gear, not polished metal: without this the sky reflections turn the whole figure bronze
        if (!m.metalnessMap) { m.metalness = 0; m.roughness = Math.max(m.roughness, 0.78); }
        m.userData.weather = 0.12; patch(m);
      }
    });
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model), h = box.max.y - box.min.y;
    if (h > 0.3 && h < 400) model.scale.multiplyScalar(1.78 / h);
    model.updateMatrixWorld(true);
    model.position.y -= new THREE.Box3().setFromObject(model).min.y;
    model.rotation.y = MODEL_YAW;
    root.add(model); scene.add(root);

    const mixer = new THREE.AnimationMixer(model);
    const find = (n) => gltf.animations.find((a) => a.name.toLowerCase() === n) || gltf.animations.find((a) => a.name.toLowerCase().includes(n));
    const clips = { idle: find('idle'), walk: find('walk'), run: find('run') };
    if (!clips.idle || !clips.walk || !clips.run) throw new Error('needs clips named Idle, Walk and Run');
    const act = {};
    for (const k in clips) { act[k] = mixer.clipAction(clips[k]); act[k].play(); act[k].setEffectiveWeight(k === 'idle' ? 1 : 0); }
    // ground speed of an in-place gait = two foot strokes per cycle
    let foot = null, hips = null;
    model.traverse((o) => { if (o.isBone) { if (!foot && /LeftFoot$/i.test(o.name)) foot = o; if (!hips && /Hips$/i.test(o.name)) hips = o; } });
    const natural = { walk: 1.5, run: 4.2 };
    if (foot && hips) {
      const a = new THREE.Vector3(), b2 = new THREE.Vector3();
      for (const k of ['walk', 'run']) {
        for (const j in act) act[j].setEffectiveWeight(j === k ? 1 : 0);
        let lo = Infinity, hi = -Infinity;
        for (let i = 0; i < 48; i++) {
          mixer.setTime(clips[k].duration * i / 48); model.updateMatrixWorld(true);
          foot.getWorldPosition(a); hips.getWorldPosition(b2);
          const fwd = (a.x - b2.x) * Math.sin(MODEL_YAW) + (a.z - b2.z) * Math.cos(MODEL_YAW);
          lo = Math.min(lo, fwd); hi = Math.max(hi, fwd);
        }
        // walking keeps a foot on the ground half the cycle; running has a flight phase, so the feet sweep less than the body travels
        const v = 2 * (hi - lo) / clips[k].duration * (k === 'run' ? 1.6 : 1);
        if (v > 0.4 && v < 12) natural[k] = v;
      }
      mixer.setTime(0);
      for (const j in act) act[j].setEffectiveWeight(j === 'idle' ? 1 : 0);
    }
    this.model = { root, mixer, act, natural, height: h, w: { idle: 1, walk: 0, run: 0 } };
  }

  animateModel(dt, hs) {
    const m = this.model, sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    m.root.position.copy(this.pos);
    m.root.rotation.y = this.heading;
    const air = !this.grounded;
    const run = air ? 1 : sm(m.natural.walk * 1.35, m.natural.run * 0.8, hs), moving = air ? 1 : sm(0.15, 0.9, hs);
    const want = { idle: 1 - moving, walk: moving * (1 - run), run: moving * run }, k = 1 - Math.exp(-9 * dt);
    for (const n in want) { m.w[n] += (want[n] - m.w[n]) * k; m.act[n].setEffectiveWeight(m.w[n]); }
    m.act.walk.timeScale = Math.max(0.7, Math.min(1.7, hs / m.natural.walk));
    m.act.run.timeScale = air ? 0.45 : Math.max(0.75, Math.min(1.9, hs / m.natural.run));
    m.mixer.update(dt);
  }

  animate(dt, hs) {
    if (this.debugSpeed !== undefined) hs = this.debugSpeed;        // treadmill, for screenshots
    if (this.model) { this.animateModel(dt, hs); return; }
    const f = this.fig;
    f.root.position.copy(this.pos);
    f.root.rotation.y = this.heading;
    const amt = this.grounded ? Math.min(1, hs / 5.4) : 0.35;
    this.moveAmt += (amt - this.moveAmt) * (1 - Math.exp(-10 * dt));
    this.phase += dt * (3.2 + hs * 1.15);
    const s = Math.sin(this.phase), a = this.moveAmt;
    const stride = 0.62 * a * (hs > 7 ? 1.3 : 1);
    f.legs[0].rotation.x = s * stride; f.legs[1].rotation.x = -s * stride;
    f.arms[0].rotation.x = -s * stride * 0.8; f.arms[1].rotation.x = s * stride * 0.8;
    if (!this.grounded) { f.arms[0].rotation.x = -0.5; f.arms[1].rotation.x = -0.5; f.legs[0].rotation.x = 0.3; f.legs[1].rotation.x = -0.15; }
    f.body.position.y = Math.abs(Math.cos(this.phase)) * 0.045 * a + Math.sin(this.phase * 0.4) * 0.006 * (1 - a);
    f.body.rotation.x = a * (hs > 7 ? 0.16 : 0.05);
    f.stoleBack.rotation.x = -a * 0.35 - Math.abs(s) * 0.08 * a;
  }
}
