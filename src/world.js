// The floating city: seven islands above the cloud deck, each a Hyderabad landmark.
import * as THREE from 'three';
import {
  M, Batch, mat4, arcadeGeo, wallHoles, evenOpenings, kanguraRow, kanguraSquare, kanguraRing,
  dome, finial, miniMinaret, rng, fabric, signMesh, patch, rockGeo,
  arcadeRing, petalRing, rosette, rosetteLite, corniceRing,
} from './kit.js';
import { addRect, addDisc, addRing, addBox, addCirc, addRaised, addRingBlock } from './phys.js';
import { charminar } from './charminar.js';

const PI = Math.PI;
export const ISLANDS = [];           // footprints: clouds + minimap
const LAMPS = [], LANTERNS = [], BANGLES = [], NO_AO = [];
const R = rng(1591);

function frame(x, y, z, ry = 0) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return { x, y, z, ry, w: (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c] };
}

// ------------------------------------------------------------ shared pieces
function railGeo(b, L) {
  const n = Math.max(1, Math.round(L / 3.2));
  for (let i = 0; i <= n; i++) {
    const z = -L / 2 + L * i / n;
    b.box(M.limeTrim, 0.42, 1.15, 0.42, 0, 0, z);
    b.cyl(M.limeTrim, 0, 0.34, 0.36, 0, 1.15, z, 4, PI / 4);
  }
  b.box(M.jali, 0.12, 0.62, L, 0, 0.2, 0);
  b.box(M.limeTrim, 0.3, 0.16, L, 0, 0.82, 0);
  b.box(M.limeTrim, 0.3, 0.2, L, 0, 0, 0);
}
function rail(b, x0, z0, x1, z1, y) {
  const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), ry = Math.atan2(dx, dz);
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  b.push(mx, y, mz, ry); railGeo(b, L); b.pop();
  addBox(mx, mz, 0.5, L, ry, y - 1, y + 2.2);
}

function island(b, cx, cz, w, d, y, gaps = []) {
  b.box(M.pave, w, 1, d, cx, y - 1, cz);
  b.box(M.limeTrim, w + 1, 0.6, d + 1, cx, y - 1.6, cz);
  b.box(M.granite, w - 2, 6, d - 2, cx, y - 7.6, cz);
  b.box(M.limeTrim, w - 1, 0.5, d - 1, cx, y - 8.1, cz);
  b.box(M.granite, w - 6, 70, d - 6, cx, y - 78, cz);
  addRect(cx, cz, w, d, y);
  ISLANDS.push({ x: cx, z: cz, hw: w / 2, hd: d / 2, y });
  const I = 0.45, x0 = cx - w / 2 + I, x1 = cx + w / 2 - I, z0 = cz - d / 2 + I, z1 = cz + d / 2 - I;
  const side = (k, a, e, fn) => {
    const gs = gaps.filter((g) => g.side === k).sort((p, q) => p.at - q.at);
    let cur = a;
    for (const g of gs) { if (g.at - g.w / 2 - cur > 1) fn(cur, g.at - g.w / 2); cur = g.at + g.w / 2; }
    if (e - cur > 1) fn(cur, e);
  };
  side('N', x0, x1, (s, t) => rail(b, s, z0, t, z0, y));
  side('S', x0, x1, (s, t) => rail(b, s, z1, t, z1, y));
  side('W', z0, z1, (s, t) => rail(b, x0, s, x0, t, y));
  side('E', z0, z1, (s, t) => rail(b, x1, s, x1, t, y));
}

function bridge(b, x0, z0, y0, x1, z1, y1, w, { piers = true } = {}) {
  const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), ry = Math.atan2(dx, dz);
  const a = Math.atan2(y1 - y0, L), Ls = Math.hypot(L, y1 - y0);
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, my = (y0 + y1) / 2;
  b.pushM(mat4(mx, my, mz, ry, 1, 1, 1, -a));
  b.box(M.pave, w, 0.8, Ls, 0, -0.8, 0);
  b.box(M.limeTrim, w + 0.6, 0.45, Ls, 0, -1.25, 0);
  b.push(w / 2 - 0.35, 0, 0); railGeo(b, Ls); b.pop();
  b.push(-w / 2 + 0.35, 0, 0); railGeo(b, Ls); b.pop();
  b.pop();
  if (piers) {
    const n = Math.max(1, Math.round(L / 26));
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1), px = x0 + dx * t, pz = z0 + dz * t, py = y0 + (y1 - y0) * t;
      b.box(M.limeTrim, w * 0.8, 1, 4.4, px, py - 2.4, pz, ry);
      b.box(M.granite, w * 0.62, 80, 3.2, px, py - 82.4, pz, ry);
    }
  }
  addRect(mx, mz, w, L, y0, ry, y1);
  ISLANDS.push({ x: mx, z: mz, hw: Math.abs(dx) / 2 + (dz ? w / 2 : 0), hd: Math.abs(dz) / 2 + (dx ? w / 2 : 0), y: my, thin: true });
  const c = Math.cos(ry), s = Math.sin(ry), o = w / 2 - 0.35;
  addBox(mx + o * c, mz - o * s, 0.5, L, ry, Math.min(y0, y1) - 1, Math.max(y0, y1) + 2.2);
  addBox(mx - o * c, mz + o * s, 0.5, L, ry, Math.min(y0, y1) - 1, Math.max(y0, y1) + 2.2);
}

/** Flight of steps rising toward the frame's +z. World coordinates. */
function stairs(b, mat, cx, cz, ry, width, run, yBot, yTop, cheek = 0.5) {
  const n = Math.max(2, Math.round((yTop - yBot) / 0.28)), rise = (yTop - yBot) / n, dp = run / n;
  b.push(cx, 0, cz, ry);
  for (let i = 0; i < n; i++) b.box(mat, width, (i + 1) * rise + 0.6, dp, 0, yBot - 0.6, -run / 2 + (i + 0.5) * dp);
  for (const s of [-1, 1]) b.box(mat, 0.7, yTop - yBot + 0.6 + cheek, run, s * (width / 2 + 0.35), yBot - 0.6, 0);
  b.pop();
  addRect(cx, cz, width, run, yBot + rise * 0.5, ry, yTop);
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const sg of [-1, 1]) {
    const o = sg * (width / 2 + 0.35);
    addBox(cx + o * c, cz - o * s, 0.7, run, ry, yBot - 1, yTop + cheek);
  }
}

/** Arcade standing in the batch's current local frame F; registers pier blockers in world space. */
function arcadeWall(b, F, mat, lx, ly, lz, lry, W, H, n, aw, spring, apex, depth, block = true) {
  const arches = [];
  for (let i = 0; i < n; i++) arches.push({ x: (i + 0.5) * W / n - W / 2, w: aw, spring, apex });
  b.g(mat, arcadeGeo(W, H, arches, depth), mat4(lx, ly, lz, lry));
  if (!block) return;
  const pw = W / n - aw, c = Math.cos(lry), s = Math.sin(lry);
  for (let j = 0; j <= n; j++) {
    const px = j * W / n - W / 2;
    const [wx, wz] = F.w(lx + px * c, lz - px * s);
    addBox(wx, wz, pw, depth, F.ry + lry, F.y + ly - 1, F.y + ly + H);
  }
}

const ICO = rockGeo(5.3, 2, 0.26);            // a soft, lumpy crown of foliage
/** An arching palm frond along +z: rises, then droops. Keeps its own UVs for the cut-out leaf texture. */
function frondGeo(len, width, rise, droop) {
  const g = new THREE.PlaneGeometry(width, len, 2, 9);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const lx = p.getX(i), t = p.getY(i) / len + 0.5;
    p.setXYZ(i, lx * (1 - 0.25 * t), len * (rise * t - droop * t * t) - Math.abs(lx) * 0.42, len * t * (1 - 0.22 * t));
  }
  g.computeVertexNormals();
  return g;
}
const FRONDS = [frondGeo(4.2, 1.5, 0.75, 0.55), frondGeo(4.6, 1.6, 0.45, 0.75), frondGeo(4.4, 1.5, 0.15, 0.85)];
function tree(b, x, y, z, s = 1, kind = 0) {
  if (kind === 0) {
    b.cyl(M.trunk, 0.18 * s, 0.27 * s, 2.7 * s, x, y, z, 7);
    // a broad crown built from overlapping masses of foliage, on a forking trunk
    b.g(M.leaf, ICO, mat4(x, y + 3.9 * s, z, R() * 6, 1.7 * s, 1.35 * s, 1.7 * s));
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * 6.283 + R() * 0.6, d = (1.0 + R() * 0.5) * s, sz = (0.95 + R() * 0.45) * s;
      b.g(i % 2 ? M.leaf2 : M.leaf, ICO, mat4(x + Math.sin(a) * d, y + (3.0 + R() * 0.9) * s, z + Math.cos(a) * d, R() * 6, sz * 1.15, sz * 0.9, sz * 1.15));
      if (i % 2) beam(b, M.trunk, V(x, y + 2.0 * s, z), V(x + Math.sin(a) * d * 0.7, y + 3.0 * s, z + Math.cos(a) * d * 0.7), 0.07 * s, 5);
    }
  } else if (kind === 1) {
    b.cyl(M.trunk, 0.12 * s, 0.16 * s, 0.9 * s, x, y, z, 6);
    b.cyl(M.leaf, 0, 0.78 * s, 5.4 * s, x, y + 0.6 * s, z, 7);
  } else {
    // date/coconut palm: a gently curving ringed trunk and a crown of arching fronds
    let px = x, pz = z; const lean = R() * 6.28, bend = 0.03 + R() * 0.05, segs = 9, sh = 0.82 * s;
    for (let i = 0; i < segs; i++) {
      const rb = (0.24 - i * 0.008) * s;
      b.cyl(M.trunk, rb - 0.012 * s, rb, sh + 0.04, px, y + i * sh, pz, 9);
      b.g(M.trunk, new THREE.TorusGeometry(rb, 0.025 * s, 4, 10), mat4(px, y + i * sh + 0.02, pz, 0, 1, 1, 1, PI / 2));
      px += Math.sin(lean) * bend * s * i; pz += Math.cos(lean) * bend * s * i;
    }
    const ty = y + segs * sh;
    b.sphere(M.trunk, 0.3 * s, px, ty - 0.05 * s, pz, 1, 1.2, 1, 8, 6);
    for (let i = 0; i < 17; i++) {
      const a = i / 17 * 6.283 * 2 + R() * 0.4, tier = i % 3;
      b.g(M.frond, FRONDS[tier], mat4(px, ty + (0.25 - tier * 0.14) * s, pz, a, s * (0.9 + R() * 0.25), s, s * (0.9 + R() * 0.25)));
    }
    for (let i = 0; i < 5; i++) { const a = i * 1.26; b.sphere(M.trunk, 0.12 * s, px + Math.sin(a) * 0.26 * s, ty - 0.3 * s, pz + Math.cos(a) * 0.26 * s, 1, 1, 1, 6, 5); }
  }
  addCirc(x, z, 0.3 * s, y - 1, y + 3);
}
const ROCKS = [rockGeo(1.3, 3), rockGeo(4.1, 3, 0.36), rockGeo(7.7, 3, 0.5)];
const DODE = ROCKS[0];
const ISLET = rockGeo(9.1, 3, 0.5, true);
const ROCKS_LO = [rockGeo(2.2, 2), rockGeo(5.5, 2, 0.36), rockGeo(8.8, 2, 0.5)];   // cheaper outcrops for the fort hill
let rockN = 0;
function boulder(b, x, y, z, s, block = true) {
  const sx = s * (0.8 + R() * 0.5), sy = s * (0.62 + R() * 0.4), sz = s * (0.8 + R() * 0.5);
  b.g(M.rock, ROCKS[rockN++ % 3], mat4(x, y + sy * 0.55, z, R() * 6.28, sx, sy, sz, R() * 0.4, R() * 0.4));
  if (block) addCirc(x, z, Math.min(sx, sz) * 0.85, y - 1, y + sy * 1.4);
}
function lamp(b, x, y, z) {
  b.cyl(M.iron, 0.07, 0.13, 4.4, x, y, z, 8);
  b.cyl(M.iron, 0.26, 0.3, 0.3, x, y, z, 8);
  b.cyl(M.gold, 0.2, 0.07, 0.3, x, y + 4.4, z, 8);
  LAMPS.push([x, y + 4.95, z]);
  addCirc(x, z, 0.25, y - 1, y + 4);
}
const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _q = new THREE.Quaternion();
function beam(b, mat, p0, p1, rad, seg = 5) {
  _d.subVectors(p1, p0); const len = _d.length(); _d.normalize();
  _q.setFromUnitVectors(_up, _d);
  const m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5), _q, new THREE.Vector3(1, len, 1));
  b.g(mat, new THREE.CylinderGeometry(rad, rad, 1, seg), m);
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------ Mecca Masjid (prayer-hall facade)
function meccaMasjid(b, x, y, z, ry) {
  const F = frame(x, y, z, ry); b.push(x, y, z, ry);
  const W = 34, H = 13, f = 0.3, ZB = -9, ZF = 3.2, bay = W / 5;        // hall from the qibla wall (ZB) to the front arcade (ZF)
  b.box(M.paveDark, W + 6, f, 17, 0, 0, -1.8);
  addRect(...F.w(0, -1.8), W + 6, 17, y + f, ry);

  // ---- front arcade in three stepped planes
  arcadeWall(b, F, M.lime, 0, f, ZF, 0, W, H, 5, 5.6, 6.2, 10.3, 2.2);
  const plate = (w, sp, ap) => Array.from({ length: 5 }, (_, i) => ({ x: (i + 0.5) * bay - W / 2, w, spring: sp, apex: ap }));
  b.g(M.limeTrim, arcadeGeo(W + 0.6, H - 1.3, plate(6.15, 6.45, 10.75), 0.4), mat4(0, f, ZF + 1.2, 0));
  b.g(M.lime, arcadeGeo(W - 0.4, H - 1.6, plate(5.8, 6.3, 10.45), 0.2), mat4(0, f, ZF + 1.45, 0));
  for (let j = 0; j <= 5; j++) {
    const lx = Math.max(-W / 2 + 0.9, Math.min(W / 2 - 0.9, j * bay - W / 2));
    rosette(b, mat4(lx, f + 10.3, ZF + 1.42, 0), 0.62);
    b.box(M.limeTrim, 0.5, H - 1.3, 0.3, lx, f, ZF + 1.5);
  }
  // ---- second row of arches inside the hall
  arcadeWall(b, F, M.lime, 0, f, -2.9, 0, W, H - 0.5, 5, 5.2, 6.0, 9.8, 1.4);
  // ---- qibla wall with five mihrab niches
  b.box(M.limeShade, W, H, 1.2, 0, f, ZB);
  b.g(M.lime, wallHoles(W - 3, H - 1, evenOpenings(W - 3, 5, 4.4, 0.4, 5.2, 8.4), 0.3), mat4(0, f, ZB + 0.75, 0));
  for (let i = 0; i < 5; i++) b.g(M.limeTrim, wallHoles(4.2, 6.6, [{ x: 0, y: 0.3, w: 2.3, spring: 3.3, apex: 5.2 }], 0.14), mat4((i + 0.5) * (W - 3) / 5 - (W - 3) / 2, f + 0.5, ZB + 0.68, 0));
  addBox(...F.w(0, ZB), W, 1.8, ry, y - 1, y + H);
  const zm = (ZF + 1.1 + ZB) / 2, zl = ZF + 1.1 - ZB;
  for (const s of [-1, 1]) {
    b.box(M.lime, 1.6, H, zl, s * (W / 2 - 0.8), f, zm);
    addBox(...F.w(s * (W / 2 - 0.8), zm), 1.6, zl, ry, y - 1, y + H);
  }
  b.box(M.limeShade, W - 1.5, 0.5, zl - 1, 0, f + H - 0.5, zm);          // ceiling

  // ---- frieze, brackets, cornice and eave all round; pierced parapet and merlons above
  const hd = zl / 2 + 0.3;
  corniceRing(b, 0, zm, W / 2 + 0.2, hd, f + H, { frieze: 0.85, eave: 1.5 });
  const yp = f + H + 0.3;
  for (const [x0, z0, x1, z1] of [[-W / 2 - 0.3, zm + hd + 0.1, W / 2 + 0.3, zm + hd + 0.1], [-W / 2 - 0.3, zm - hd - 0.1, W / 2 + 0.3, zm - hd - 0.1]]) {
    b.box(M.jali, W + 0.6, 1.0, 0.1, 0, yp, z0);
    b.box(M.limeTrim, W + 0.8, 0.15, 0.32, 0, yp + 1.0, z0);
    kanguraRow(b, M.limeTrim, x0, z0, x1, z1, yp + 1.15, 1.0);
  }
  for (const s of [-1, 1]) {
    b.box(M.jali, 0.1, 1.0, hd * 2, s * (W / 2 + 0.4), yp, zm);
    kanguraRow(b, M.limeTrim, s * (W / 2 + 0.4), zm - hd, s * (W / 2 + 0.4), zm + hd, yp + 1.0, 1.0);
  }
  // ---- the two great octagonal towers, each with an arcaded gallery and a dome
  for (const s of [-1, 1]) {
    const tx = s * (W / 2 + 2.2), tz = ZF - 0.6;
    b.cyl(M.limeTrim, 3.0, 3.3, 1.2, tx, 0, tz, 8, PI / 8);
    petalRing(b, M.limeTrim, tx, 1.6, tz, 2.75, 14, 0.9, 0.2);
    miniMinaret(b, tx, 0.9, tz, 2.4, 26);
    for (const yy of [5.5, 9.5, 13.3]) b.g(M.limeTrim, new THREE.TorusGeometry(2.42, 0.18, 6, 16), mat4(tx, yy, tz, 0, 1, 1, 1, PI / 2));
    addCirc(...F.w(tx, tz), 3.2, y - 1, y + 30);
  }
  b.pop();
}

// ------------------------------------------------------------ bazaar
const STALL_COLORS = [0xc62828, 0xe58a00, 0xb0206a, 0x00897b, 0xf2b705, 0x5e35b1, 0x1e88e5, 0xd84315];
const BANGLE_COLORS = [0xe53935, 0x43a047, 0xfdd835, 0x1e88e5, 0xd81b60, 0xffb300, 0x8e24aa, 0x00acc1];
function stall(b, F, lx, lz, lry, color, kind) {
  b.push(lx, 0, lz, lry);
  b.box(M.wood, 3.4, 0.95, 1.1, 0, 0, 0);
  b.box(fabric(color), 3.5, 0.55, 0.06, 0, 0.42, 0.58);
  for (const [px, pz, hh] of [[-1.7, -0.95, 3.15], [1.7, -0.95, 3.15], [-1.7, 1.55, 2.5], [1.7, 1.55, 2.5]]) b.cyl(M.wood, 0.05, 0.05, hh, px, 0, pz, 6);
  b.g(fabric(color), new THREE.BoxGeometry(3.9, 0.07, 2.9), mat4(0, 2.84, 0.3, 0, 1, 1, 1, 0.255));
  b.box(fabric(0xf6efe0), 3.9, 0.3, 0.05, 0, 2.2, 1.72);
  b.box(M.wood, 3.4, 2.2, 0.08, 0, 0.95, -0.95);
  if (kind === 0) {                                   // bangles
    for (let row = 0; row < 3; row++) {
      const yy = 1.55 + row * 0.42;
      b.g(M.gold, new THREE.CylinderGeometry(0.018, 0.018, 3.2, 5), mat4(0, yy, -0.78, 0, 1, 1, 1, 0, PI / 2));
      for (let i = 0; i < 13; i++) {
        const m = b.base.clone().multiply(mat4(-1.5 + i * 0.25, yy - 0.1, -0.78, PI / 2 + (R() - 0.5) * 0.5));
        BANGLES.push([m, BANGLE_COLORS[(i + row * 3 + (R() * 3 | 0)) % BANGLE_COLORS.length]]);
      }
    }
    for (let i = 0; i < 7; i++) b.cyl(fabric(BANGLE_COLORS[i % 8]), 0.11, 0.11, 0.18 + R() * 0.25, -1.35 + i * 0.45, 0.95, 0.1 + (R() - 0.5) * 0.4, 10);
  } else if (kind === 1) {                            // pearls
    b.box(fabric(0x1b2a4a), 3.0, 0.05, 0.9, 0, 0.95, 0);
    for (let s = 0; s < 4; s++) for (let i = 0; i < 9; i++) {
      const t = i / 8 - 0.5;
      b.sphere(M.marble, 0.05, -1.15 + s * 0.78 + t * 0.5, 2.55 - (0.25 - t * t) * 2.2, -0.88, 1, 1, 1, 6, 4);
    }
    for (let i = 0; i < 5; i++) b.sphere(M.marble, 0.09, -1.2 + i * 0.6, 1.07, 0.1, 1, 1, 1, 7, 5);
  } else if (kind === 2) {                            // spices and attar
    const cols = [0xc62828, 0xf9a825, 0xef6c00, 0x558b2f, 0x6d4c41, 0xfdd835];
    for (let i = 0; i < 6; i++) {
      b.cyl(M.gold, 0.26, 0.2, 0.12, -1.3 + i * 0.52, 0.95, 0.08, 10);
      b.cyl(fabric(cols[i]), 0, 0.23, 0.36, -1.3 + i * 0.52, 1.05, 0.08, 10);
    }
    for (let i = 0; i < 5; i++) b.cyl(M.gold, 0.05, 0.09, 0.3, -1.2 + i * 0.6, 1.75, -0.8, 8);
    b.box(M.wood, 3.2, 0.06, 0.3, 0, 1.7, -0.8);
  } else {                                            // cloth
    for (let i = 0; i < 6; i++) b.g(fabric(STALL_COLORS[(i * 3 + 1) % 8]), new THREE.CylinderGeometry(0.13, 0.13, 1, 8), mat4(-1.25 + i * 0.5, 1.09, 0.05, 0, 1, 1, 1, PI / 2));
    for (let i = 0; i < 5; i++) b.box(fabric(STALL_COLORS[(i * 5 + 2) % 8]), 0.5, 1.3, 0.04, -1.3 + i * 0.65, 1.2, -0.86);
  }
  b.pop();
  addBox(...F.w(lx, lz), 3.6, 1.4, F.ry + lry, F.y - 1, F.y + 1.0);
}

function bazaar(b, extras) {
  const F = frame(0, 0, 0);
  b.box(M.paveDark, 16, 1, 70, 0, -1, -85);
  b.box(M.limeTrim, 17, 0.6, 70, 0, -1.6, -85);
  b.box(M.granite, 14, 6, 70, 0, -7.6, -85);
  for (const zz of [-68, -85, -102]) b.box(M.granite, 11, 72, 4, 0, -79.6, zz);
  addRect(0, -85, 16, 70, 0);
  ISLANDS.push({ x: 0, z: -85, hw: 8, hd: 35, y: 0, thin: true });
  rail(b, -7.55, -119.6, -7.55, -50.4, 0); rail(b, 7.55, -119.6, 7.55, -50.4, 0);

  // Char Kaman – the gateway arch
  const gz = -55;
  b.g(M.lime, arcadeGeo(15.2, 13, [{ x: 0, w: 8.6, spring: 6, apex: 10.2 }], 2.6), mat4(0, 0, gz, 0));
  b.g(M.limeTrim, arcadeGeo(11.4, 11.6, [{ x: 0, w: 9.1, spring: 6.2, apex: 10.6 }], 0.4), mat4(0, 0, gz + 1.45, 0));
  b.g(M.limeTrim, arcadeGeo(11.4, 11.6, [{ x: 0, w: 9.1, spring: 6.2, apex: 10.6 }], 0.4), mat4(0, 0, gz - 1.45, 0));
  corniceRing(b, 0, gz, 7.6, 1.3, 13, { frieze: 0, eave: 0.9 });
  b.box(M.limeTrim, 16.2, 0.3, 3.6, 0, 13.3, gz);
  b.g(M.frieze, new THREE.BoxGeometry(15, 0.9, 0.16), mat4(0, 11.95, gz - 1.36, 0));
  for (const q of [-1, 1]) { rosette(b, mat4(q * 5.2, 9.5, gz + 1.66, 0), 0.5); rosette(b, mat4(q * 5.2, 9.5, gz - 1.66, PI), 0.5); }
  kanguraRow(b, M.limeTrim, -7.8, gz + 1.5, 7.8, gz + 1.5, 13.6, 0.95);
  kanguraRow(b, M.limeTrim, -7.8, gz - 1.5, 7.8, gz - 1.5, 13.6, 0.95);
  for (const s of [-1, 1]) {
    miniMinaret(b, s * 6.6, 13.6, gz, 0.75, 6.5);
    addBox(s * 5.95, gz, 3.3, 2.6, 0, -1, 14);
  }
  const sg = signMesh('LAAD BAZAAR', 6.4, 1.15); sg.position.set(0, 11.75, gz + 1.7); extras.add(sg);

  // stalls down both sides of the lane
  let k = 0;
  for (let i = 0; i < 6; i++) {
    const zz = -65 - i * 9.4;
    stall(b, F, -5.6, zz, PI / 2, STALL_COLORS[k % 8], k % 4); k++;
    stall(b, F, 5.6, zz + 1.5, -PI / 2, STALL_COLORS[(k + 3) % 8], (k + 1) % 4); k++;
  }
  // strings of lanterns over the lane
  for (let i = 0; i < 7; i++) {
    const zz = -61 - i * 8.6;
    b.cyl(M.wood, 0.07, 0.09, 6.4, -7.1, 0, zz, 6); b.cyl(M.wood, 0.07, 0.09, 6.4, 7.1, 0, zz, 6);
    let prev = null;
    for (let j = 0; j <= 10; j++) {
      const t = j / 10, px = -7.1 + 14.2 * t, py = 6.3 - Math.sin(t * PI) * 1.1;
      const p = V(px, py, zz);
      if (prev) beam(b, M.iron, prev, p, 0.012, 4);
      if (j > 0 && j < 10) LANTERNS.push([px, py - 0.22, zz, STALL_COLORS[(i * 3 + j) % 8]]);
      prev = p;
    }
  }
}

// ------------------------------------------------------------ Hussain Sagar
function hussainSagar(b, extras, anim) {
  const cx = 0, cz = -175, R0 = 41, R1 = 55;
  b.g(M.pave, new THREE.RingGeometry(R0, R1, 72, 1), mat4(cx, 0, cz, 0, 1, 1, 1, -PI / 2));
  b.g(M.limeTrim, new THREE.CylinderGeometry(R1, R1, 1.6, 72, 1, true), mat4(cx, -0.8, cz));
  b.g(M.granite, new THREE.CylinderGeometry(R1 - 0.6, R1 - 0.6, 6.5, 72, 1, true), mat4(cx, -4.85, cz));
  b.cyl(M.granite, R1 - 3, R1 - 3, 72, cx, -80, cz, 48);
  b.cyl(M.granDark, R1 - 0.7, R1 - 0.7, 0.4, cx, -2.0, cz, 48);        // lake bed
  b.lathe(M.limeTrim, [new THREE.Vector2(R0, 0), new THREE.Vector2(R0, -1.7)], cx, 0, cz, 72);
  b.g(M.limeTrim, new THREE.TorusGeometry(R0 + 0.25, 0.22, 6, 72), mat4(cx, 0.08, cz, 0, 1, 1, 1, PI / 2));
  b.g(M.water, new THREE.CircleGeometry(R0, 64), mat4(cx, -0.45, cz, 0, 1, 1, 1, -PI / 2));
  addRing(cx, cz, R0, R1, 0);
  addDisc(cx, cz, R0, -1.45, 'water');
  addRingBlock(cx, cz, R0, R1, -10, 0);
  addCirc(cx, cz, 9.8, -10, 0);
  addBox(cx, cz + 25, 5, 32.4, 0, -10, 0);
  ISLANDS.push({ x: cx, z: cz, hw: R1, hd: R1, y: 0, round: true });

  // rim railing with openings toward the bazaar (south), east and west bridges
  const gaps = [[0, 0.16], [PI / 2, 0.105], [-PI / 2, 0.125]];
  const open = (a) => gaps.some(([g, hw]) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < hw);
  const N = 96, rr = R1 - 0.5;
  for (let i = 0; i < N; i++) {
    const a0 = i / N * 2 * PI, a1 = (i + 1) / N * 2 * PI;
    if (open(a0) || open(a1)) continue;
    rail(b, cx + Math.sin(a0) * rr, cz + Math.cos(a0) * rr, cx + Math.sin(a1) * rr, cz + Math.cos(a1) * rr, 0);
  }
  for (let i = 0; i < 20; i++) {
    const a = (i + 0.5) / 20 * 2 * PI;
    if (open(a)) continue;
    if (i % 2) lamp(b, cx + Math.sin(a) * (R1 - 2), 0, cz + Math.cos(a) * (R1 - 2));
    else tree(b, cx + Math.sin(a) * (R0 + 2.6), 0, cz + Math.cos(a) * (R0 + 2.6), 0.95, 2);
  }

  // causeway to the rock
  b.box(M.pave, 5, 1.9, 32.4, cx, -1.9, cz + 25);
  for (const s of [-1, 1]) b.box(M.limeTrim, 0.35, 0.3, 32.4, cx + s * 2.35, 0, cz + 25);
  addRect(cx, cz + 25, 5, 32.6, 0);
  b.cyl(M.limeTrim, 9, 9.8, 2.0, cx, -2.0, cz, 28);
  b.cyl(M.pave, 8.7, 8.7, 0.05, cx, 0, cz, 28);
  addDisc(cx, cz, 9, 0);

  // the Buddha on the Rock of Gibraltar: a standing figure in a draped robe, right hand raised in blessing
  b.push(cx, 0, cz);
  b.g(M.rock, ROCKS[1], mat4(0, 1.0, 0, 0.4, 6.3, 2.7, 5.9));
  b.g(M.rock, ROCKS[2], mat4(1.2, 2.3, -0.8, 2.1, 4.4, 1.6, 4.2));
  addCirc(cx, cz, 6.7, -1, 4);
  const SW = M.stoneWhite, y0 = 4.75;
  // double-lotus pedestal
  b.cyl(SW, 2.9, 2.5, 0.55, 0, 3.35, 0, 28);
  petalRing(b, SW, 0, 3.55, 0, 2.75, 18, 1.0, -0.7);
  petalRing(b, SW, 0, 4.25, 0, 2.7, 18, 1.0, 0.4, 0.5);
  b.cyl(SW, 2.45, 2.7, 0.45, 0, 4.3, 0, 28);
  // body under the robe
  const prof = [[1.25, 0], [1.45, 0.3], [1.5, 2.6], [1.62, 5.4], [1.9, 8.2], [2.2, 10.2], [2.3, 11.4], [2.0, 12.4], [1.2, 13.1], [0.62, 13.5], [0.55, 13.9]];
  const bodyR = (h) => { for (let i = 1; i < prof.length; i++) if (h <= prof[i][1]) { const [r0, h0] = prof[i - 1], [r1, h1] = prof[i]; return r0 + (r1 - r0) * (h - h0) / (h1 - h0); } return 0.55; };
  b.lathe(SW, prof.map((p) => new THREE.Vector2(p[0], p[1])), 0, y0, 0, 28, 1, 0.6);
  b.g(SW, new THREE.TorusGeometry(1.5, 0.13, 6, 28), mat4(0, y0 + 0.45, 0, 0, 1, 0.6, 1, PI / 2));       // hem
  for (const s of [-1, 1]) b.sphere(SW, 1, s * 0.6, y0 + 0.2, 0.75, 0.45, 0.28, 0.85, 10, 8);              // feet
  // drapery: folds hanging in catenaries across the front, and falling straight at the back
  for (let k = 0; k < 11; k++) {
    const yk = 11.0 - k * 0.92, sag = 0.85 + k * 0.07, pts = [];
    for (let j = 0; j <= 14; j++) {
      const th = -1.3 + j * 2.6 / 14, hh = Math.max(0.5, yk - sag * Math.cos(th / 1.3 * PI / 2)), rb = bodyR(hh) + 0.05;
      pts.push(new THREE.Vector3(Math.sin(th) * rb, y0 + hh, Math.cos(th) * rb * 0.6));
    }
    b.g(SW, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, 0.05 + (k % 3) * 0.012, 5));
  }
  for (let k = 0; k < 7; k++) {
    const th = PI - 0.9 + k * 0.3, pts = [];
    for (let j = 0; j <= 6; j++) { const hh = 0.6 + j * 1.75, rb = bodyR(hh) + 0.04; pts.push(new THREE.Vector3(Math.sin(th) * rb, y0 + hh, Math.cos(th) * rb * 0.6)); }
    b.g(SW, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.07, 5));
  }
  // head: face, long ears, tight curls and the ushnisha
  const hy = y0 + 15.05;
  b.cyl(SW, 0.55, 0.62, 0.7, 0, y0 + 13.6, 0, 14);
  b.sphere(SW, 1.2, 0, hy, 0, 0.9, 1.1, 0.96, 24, 18);
  b.sphere(SW, 1, 0, hy - 0.08, 1.08, 0.13, 0.36, 0.2, 8, 6);                      // nose
  b.sphere(SW, 1, 0, hy - 0.56, 1.0, 0.3, 0.07, 0.12, 8, 6);                       // lips
  b.sphere(SW, 1, 0, hy - 0.95, 0.82, 0.34, 0.2, 0.26, 8, 6);                      // chin
  for (const s of [-1, 1]) {
    b.sphere(SW, 1, s * 0.4, hy + 0.12, 1.0, 0.21, 0.085, 0.07, 10, 6);            // lowered eyelids
    b.sphere(SW, 1, s * 0.42, hy + 0.34, 0.99, 0.27, 0.04, 0.05, 10, 6);            // brows
    b.sphere(SW, 1, s * 1.08, hy - 0.3, -0.02, 0.15, 0.78, 0.3, 8, 8);             // ears
  }
  for (let ring = 0; ring < 6; ring++) {                                           // curls
    const lat = 0.28 + ring * 0.24, n = Math.max(6, Math.round(22 * Math.cos(lat)));
    for (let i = 0; i < n; i++) {
      const a = (i + (ring % 2) * 0.5) / n * PI * 2;
      const px = Math.sin(a) * Math.cos(lat) * 1.1, pz = Math.cos(a) * Math.cos(lat) * 1.16, pyy = hy + Math.sin(lat) * 1.3;
      if (pz > 0.62 && ring < 2) continue;                                         // leave the forehead clear
      b.sphere(SW, 0.15, px, pyy, pz, 1, 1, 1, 6, 5);
    }
  }
  b.sphere(SW, 0.5, 0, hy + 1.42, -0.05, 1, 0.85, 1, 12, 10);
  for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2; b.sphere(SW, 0.13, Math.sin(a) * 0.4, hy + 1.5, Math.cos(a) * 0.4 - 0.05, 1, 1, 1, 6, 5); }
  b.sphere(SW, 0.14, 0, hy + 1.86, -0.05, 1, 1, 1, 6, 5);
  // right arm raised, palm outward
  const V3 = (x, yy, z) => new THREE.Vector3(x, y0 + yy, z);
  beam(b, SW, V3(2.1, 11.7, 0.05), V3(2.5, 9.0, 0.45), 0.52, 12);
  b.sphere(SW, 0.56, 2.5, y0 + 9.0, 0.45, 1, 1, 1, 10, 8);
  beam(b, SW, V3(2.5, 9.0, 0.45), V3(2.35, 11.1, 1.55), 0.44, 12);
  b.g(SW, new THREE.BoxGeometry(0.95, 1.15, 0.32), mat4(2.35, y0 + 11.85, 1.72, 0, 1, 1, 1, -0.12));
  for (let i = 0; i < 4; i++) b.g(SW, new THREE.CylinderGeometry(0.1, 0.115, 0.85 - Math.abs(i - 1.4) * 0.09, 8), mat4(2.0 + i * 0.235, y0 + 12.8, 1.82, 0, 1, 1, 1, -0.1));
  b.g(SW, new THREE.CylinderGeometry(0.11, 0.13, 0.62, 8), mat4(1.82, y0 + 12.05, 1.8, 0, 1, 1, 1, -0.1, 0.6));
  // left arm at rest, the robe falling from the forearm
  beam(b, SW, V3(-2.1, 11.7, 0.05), V3(-2.5, 8.8, 0.3), 0.52, 12);
  b.sphere(SW, 0.56, -2.5, y0 + 8.8, 0.3, 1, 1, 1, 10, 8);
  beam(b, SW, V3(-2.5, 8.8, 0.3), V3(-2.3, 6.5, 0.95), 0.44, 12);
  b.sphere(SW, 1, -2.3, y0 + 6.2, 1.02, 0.36, 0.5, 0.3, 10, 8);
  b.pop();

  // waterfalls spilling through the rim
  const fallMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime;
      float h(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        float streak = n(vec2(vUv.x*26.0, vUv.y*5.0 + uTime*2.6)) * 0.6 + n(vec2(vUv.x*60.0, vUv.y*9.0 + uTime*4.0)) * 0.4;
        float edge = smoothstep(0.0,0.12,vUv.x) * (1.0 - smoothstep(0.88,1.0,vUv.x));
        float a = edge * (0.5 + 0.5*streak) * smoothstep(0.0, 0.5, vUv.y) * (1.0 - smoothstep(0.985, 1.0, vUv.y));
        vec3 c = mix(vec3(0.72,0.86,0.95), vec3(1.0), streak);
        gl_FragColor = vec4(c, a * 0.9); }`,
  });
  for (const a of [0.9, 2.2, 3.6, 4.6, 5.4]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 42), fallMat);
    m.position.set(cx + Math.sin(a) * (R1 + 0.5), -22.6, cz + Math.cos(a) * (R1 + 0.5)); m.scale.y = 0.62; m.position.y = -14.6; m.rotation.y = a; m.renderOrder = 2;
    extras.add(m); NO_AO.push(m);
    b.g(M.limeTrim, new THREE.BoxGeometry(6.4, 1.2, 1.6), mat4(cx + Math.sin(a) * (R1 - 0.1), -1.9, cz + Math.cos(a) * (R1 - 0.1), a));
  }
  anim.push((t) => { fallMat.uniforms.uTime.value = t; });

  // the tricolour on the north shore
  const fx = cx, fz = cz - 48;
  b.cyl(M.white, 0.14, 0.24, 36, fx, 0, fz, 10); b.sphere(M.gold, 0.4, fx, 36.2, fz);
  b.cyl(M.limeTrim, 1.4, 1.7, 0.8, fx, 0, fz, 12); addCirc(fx, fz, 1.7, -1, 3);
  const fc = document.createElement('canvas'); fc.width = 384; fc.height = 256;
  const fg = fc.getContext('2d');
  fg.fillStyle = '#ff9933'; fg.fillRect(0, 0, 384, 86); fg.fillStyle = '#ffffff'; fg.fillRect(0, 85, 384, 86); fg.fillStyle = '#138808'; fg.fillRect(0, 170, 384, 86);
  fg.strokeStyle = '#000080'; fg.lineWidth = 3; fg.beginPath(); fg.arc(192, 128, 36, 0, 7); fg.stroke();
  for (let i = 0; i < 24; i++) { const a = i / 24 * 2 * PI; fg.beginPath(); fg.moveTo(192, 128); fg.lineTo(192 + Math.cos(a) * 36, 128 + Math.sin(a) * 36); fg.lineWidth = 1.4; fg.stroke(); }
  const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace;
  const flagGeo = new THREE.PlaneGeometry(10.5, 7, 16, 8); flagGeo.translate(5.25, 0, 0);
  const flag = new THREE.Mesh(flagGeo, patch(new THREE.MeshStandardMaterial({ map: ft, side: THREE.DoubleSide, roughness: 0.8 })));
  flag.position.set(fx + 0.15, 32, fz); flag.castShadow = true; extras.add(flag);
  const fp = flagGeo.attributes.position, fx0 = Float32Array.from(fp.array);
  anim.push((t) => {
    for (let i = 0; i < fp.count; i++) {
      const px = fx0[i * 3], py = fx0[i * 3 + 1], k = px / 10.5;
      fp.array[i * 3 + 2] = Math.sin(px * 0.9 - t * 4.2 + py * 0.3) * 0.55 * k;
      fp.array[i * 3 + 1] = py + Math.sin(px * 0.6 - t * 3.1) * 0.18 * k - k * k * 0.5;
    }
    fp.needsUpdate = true;
  });
}

// ------------------------------------------------------------ Qutb Shahi tombs
function tomb(b, x, y, z, S, ry) {
  const F = frame(x, y, z, ry); b.push(x, y, z, ry);
  const big = S > 20, pl = S + 10, ph = big ? 2.0 : 1.2, wall = M.stoneWhite, n1 = big ? 7 : 5;
  const side = (fn) => { for (let i = 0; i < 4; i++) { const a = i * PI / 2; fn(a, Math.sin(a), Math.cos(a)); } };

  // ---- terrace: a stone plinth, panelled with blind arches on the great tomb
  b.box(M.granite, pl, ph, pl, 0, 0, 0);
  b.box(M.limeTrim, pl + 0.7, 0.28, pl + 0.7, 0, ph - 0.5, 0);
  b.box(M.pave, pl - 0.5, 0.06, pl - 0.5, 0, ph - 0.02, 0);
  if (big) side((a, s, c) => b.g(wall, wallHoles(pl, ph - 0.55, evenOpenings(pl, 11, 1.8, 0.14, 0.72, 1.18), 0.22), mat4(s * (pl / 2 + 0.06), 0, c * (pl / 2 + 0.06), a)));

  // ---- ground storey: an open arcade with a real veranda behind it
  const H1 = S * 0.42, y1 = ph, bay = S / n1, aw = bay * 0.66, spring = H1 * 0.46, apex = H1 * 0.8, core = S - 5.6;
  b.box(wall, core, H1, core, 0, y1, 0);
  b.box(M.limeShade, S - 0.6, 0.4, S - 0.6, 0, y1 + H1 - 0.4, 0);                 // veranda ceiling
  side((a, s, c) => {
    arcadeWall(b, F, wall, s * (S / 2 - 0.5), y1, c * (S / 2 - 0.5), a, S, H1, n1, aw, spring, apex, 1.0);
    const arches = Array.from({ length: n1 }, (_, k) => ({ x: (k + 0.5) * bay - S / 2, w: aw + 0.34, spring: spring + 0.1, apex: apex + 0.24 }));
    b.g(M.limeTrim, arcadeGeo(S, H1 - 0.15, arches, 0.16), mat4(s * (S / 2 + 0.07), y1, c * (S / 2 + 0.07), a));
    for (let j = 1; j < n1; j++) {                                               // medallions in the spandrels
      const lx = j * bay - S / 2;
      rosetteLite(b, mat4(s * (S / 2 + 0.15) + c * lx, y1 + apex - H1 * 0.02, c * (S / 2 + 0.15) - s * lx, a), bay * 0.115);
    }
    // the inner wall: three recessed doorways, the middle one a dark opening
    const o = core / 2;
    b.g(M.limeTrim, wallHoles(core, H1 - 0.4, evenOpenings(core, 3, core / 3 * 0.52, 0.12, H1 * 0.4, H1 * 0.66), 0.2), mat4(s * (o + 0.16), y1, c * (o + 0.16), a));
    b.g(M.limeShade, new THREE.BoxGeometry(core - 1, H1 * 0.7, 0.08), mat4(s * (o + 0.05), y1 + H1 * 0.35 + 0.1, c * (o + 0.05), a));
    b.g(M.jali, new THREE.BoxGeometry(core / 3 * 0.5, H1 * 0.3, 0.06), mat4(s * (o + 0.1), y1 + H1 * 0.5, c * (o + 0.1), a));
  });
  const yc = y1 + H1;
  corniceRing(b, 0, 0, S / 2, S / 2, yc, { frieze: H1 * 0.085, eave: big ? 1.5 : 1.1 });
  // ---- roof terrace: pierced parapet, merlons, corner minarets
  const y2 = yc + 0.3, pr = S / 2 + 0.25;
  side((a, s, c) => {
    b.g(M.jali, new THREE.BoxGeometry(S + 0.5, 0.95, 0.1), mat4(s * pr, y2 + 0.475, c * pr, a));
    b.g(M.limeTrim, new THREE.BoxGeometry(S + 0.7, 0.14, 0.3), mat4(s * pr, y2 + 1.0, c * pr, a));
  });
  kanguraSquare(b, M.limeTrim, 0, 0, pr, pr, y2 + 1.07, 0.7);
  // ---- upper storey: arches closed with stone screens
  const S2 = S * 0.66, H2 = S * 0.25;
  b.box(M.limeShade, S2 - 1.2, H2, S2 - 1.2, 0, y2, 0);
  side((a, s, c) => {
    const o = S2 / 2 - 0.25;
    b.g(wall, wallHoles(S2, H2, evenOpenings(S2, 5, S2 / 5 * 0.62, H2 * 0.1, H2 * 0.42, H2 * 0.72), 0.5), mat4(s * o, y2, c * o, a));
    b.g(M.jali, new THREE.BoxGeometry(S2 - 0.6, H2 * 0.8, 0.07), mat4(s * (o - 0.2), y2 + H2 * 0.45, c * (o - 0.2), a));
    for (let j = 1; j < 5; j++) {
      const lx = j * S2 / 5 - S2 / 2;
      rosetteLite(b, mat4(s * (o + 0.27) + c * lx, y2 + H2 * 0.78, c * (o + 0.27) - s * lx, a), S2 * 0.03);
    }
  });
  corniceRing(b, 0, 0, S2 / 2, S2 / 2, y2 + H2, { frieze: H2 * 0.09, eave: big ? 1.0 : 0.75 });
  const y3 = y2 + H2 + 0.3;
  kanguraSquare(b, M.limeTrim, 0, 0, S2 / 2 + 0.3, S2 / 2 + 0.3, y3, 0.7);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    miniMinaret(b, sx * pr, y2, sz * pr, S * 0.03 + 0.22, S * 0.3, wall);
    miniMinaret(b, sx * (S2 / 2 + 0.1), y3, sz * (S2 / 2 + 0.1), S * 0.022 + 0.18, S * 0.24, wall);
  }
  // ---- drum ringed with little arches, then the dome on its lotus calyx
  const rD = S * 0.31, hD = S * 0.11;
  b.cyl(M.limeShade, rD - 0.3, rD - 0.3, hD, 0, y3, 0, 24);
  b.cyl(M.limeTrim, rD + 0.2, rD + 0.2, 0.22, 0, y3, 0, 32);
  arcadeRing(b, 0, y3 + 0.22, 0, rD, hD - 0.22, Math.round(2 * PI * rD / (hD * 0.75)));
  b.cyl(M.limeTrim, rD + 0.1, rD + 0.3, 0.3, 0, y3 + hD, 0, 32);
  dome(b, wall, 0, y3 + hD + 0.3 + S * 0.03, 0, S * 0.36, S * 0.5, {});
  b.pop();

  addRaised(x, z, pl, pl, ry, y + ph);
  addBox(x, z, core, core, ry, y, y + 80);
  const run = ph / 0.55, [sx, sz] = F.w(0, pl / 2 + run / 2);
  stairs(b, M.granite, sx, sz, ry + PI, big ? 8 : 6, run, y, y + ph, 0.35);
}

function tombsIsland(b) {
  const cx = 150, cz = -30, y = 5;
  island(b, cx, cz, 100, 120, y, [{ side: 'W', at: 0, w: 10 }, { side: 'N', at: 150, w: 10 }]);
  tomb(b, 168, y, -30, 24, -PI / 2);
  tomb(b, 125, y, -68, 15, 0);
  tomb(b, 130, y, 16, 15, PI);
  // charbagh: water channel and lawns leading to the great tomb
  for (const s of [-1, 1]) { b.box(M.limeTrim, 38, 0.3, 0.5, 126, y, -30 + s * 1.95); b.box(M.limeTrim, 0.5, 0.3, 3.4, 126 + s * 18.75, y, -30); }
  b.box(M.water, 37, 0.08, 3.4, 126, y + 0.14, -30);
  const lawns = [[127, -40.5, 40, 13], [127, -19.5, 40, 13], [165, -70, 50, 26], [170, 14, 44, 22]];
  for (const [lx, lz, lw, ld] of lawns) b.box(M.grass, lw, 0.06, ld, lx, y, lz);
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) tree(b, 110 + i * 8.5, y, -30 + s * 5.2, 0.9, 1);
  const spots = [[150, -78, 0], [172, -76, 0], [186, -62, 2], [190, -78, 0], [158, 16, 0], [178, 20, 2], [188, 8, 0], [162, -62, 2], [106, -84, 0], [108, 26, 2], [194, -3, 1], [194, -57, 1]];
  for (const [tx, tz, kd] of spots) tree(b, tx, y, tz, 1 + R() * 0.3, kd);
  for (const [lx, lz] of [[104, -6], [104, 6], [144, -6.5], [144, 6.5], [144, -84], [156, -84]]) lamp(b, lx, y, lz);
}

// ------------------------------------------------------------ Taramati Baradari
function baradari(b) {
  const cx = 150, cz = -175, y = 3;
  island(b, cx, cz, 34, 34, y, [{ side: 'W', at: -175, w: 10 }, { side: 'S', at: 150, w: 10 }]);
  const F = frame(cx, y, cz), ph = 1.2, S = 13, H = 6.6;
  b.push(cx, y, cz);
  b.box(M.granite, 18, ph, 18, 0, 0, 0); b.box(M.limeTrim, 18.6, 0.3, 18.6, 0, ph - 0.55, 0);
  b.box(M.pave, 17.4, 0.06, 17.4, 0, ph - 0.02, 0);
  for (let i = 0; i < 4; i++) {
    const a = i * PI / 2, s = Math.sin(a), c = Math.cos(a), o = S / 2 - 0.5;
    arcadeWall(b, F, M.lime, s * o, ph, c * o, a, S, H, 3, 2.9, 2.9, 5.2, 1.0);
    const arches = Array.from({ length: 3 }, (_, k) => ({ x: (k + 0.5) * S / 3 - S / 2, w: 3.25, spring: 3.0, apex: 5.45 }));
    b.g(M.limeTrim, arcadeGeo(S, H - 0.2, arches, 0.16), mat4(s * (S / 2 + 0.07), ph, c * (S / 2 + 0.07), a));
    for (const q of [-1, 1]) rosetteLite(b, mat4(s * (S / 2 + 0.15) + c * q * S / 6, ph + 5.2, c * (S / 2 + 0.15) - s * q * S / 6, a), 0.4);
  }
  b.box(M.limeShade, S - 1.6, 0.5, S - 1.6, 0, ph + H - 0.5, 0);
  corniceRing(b, 0, 0, S / 2, S / 2, ph + H, { frieze: 0.55, eave: 1.2 });
  kanguraSquare(b, M.limeTrim, 0, 0, S / 2 + 0.45, S / 2 + 0.45, ph + H + 0.3, 0.85);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) miniMinaret(b, sx * (S / 2 + 0.3), ph + H + 0.3, sz * (S / 2 + 0.3), 0.55, 4.6);
  b.pop();
  addRaised(cx, cz, 18, 18, 0, y + ph);
  stairs(b, M.granite, cx - 10.1, cz, PI / 2, 6, 2.2, y, y + ph, 0.35);
  stairs(b, M.granite, cx, cz + 10.1, PI, 6, 2.2, y, y + ph, 0.35);
  for (const [tx, tz, kd] of [[137, -189, 2], [163, -189, 0], [163, -162, 2], [137, -162, 0]]) tree(b, tx, y, tz, 1, kd);
}

// ------------------------------------------------------------ Golconda
function fortWall(b, x0, z0, x1, z1, y, h = 8.5, th = 3) {
  const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), ry = Math.atan2(dx, dz), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  const nx = dz / L, nz = -dx / L;                                   // across the wall
  b.box(M.granite, th, h, L, mx, y, mz, ry);
  b.box(M.granite, th + 0.9, 1.3, L, mx, y, mz, ry);                 // battered foot
  b.box(M.granite, th + 0.45, 0.6, L, mx, y + 1.3, mz, ry);
  b.box(M.granDark, th + 0.3, 0.3, L, mx, y + h - 1.7, mz, ry);     // string course
  b.box(M.granDark, th + 0.5, 0.4, L, mx, y + h, mz, ry);
  for (const o of [-1, 1]) {                                         // merlons on both edges of the wall walk
    const k = o * (th / 2 - 0.22);
    kanguraRow(b, M.granite, x0 + nx * k, z0 + nz * k, x1 + nx * k, z1 + nz * k, y + h + 0.4, 1.3);
  }
  const n = Math.floor(L / 5);
  for (let i = 0; i < n; i++) {                                      // arrow slits
    const t = (i + 0.5) / n;
    b.box(M.black, th + 0.06, 1.4, 0.16, x0 + dx * t, y + h - 3.9, z0 + dz * t, ry);
  }
  addBox(mx, mz, th + 0.9, L, ry, y - 1, y + h + 2);
}
function bastion(b, x, z, y, r, h) {
  b.cyl(M.granite, r, r * 1.12, h, x, y, z, 24);
  b.cyl(M.granite, r * 1.14, r * 1.26, 1.4, x, y, z, 24);
  for (const t of [0.45, 0.8]) b.g(M.granDark, new THREE.TorusGeometry(r * (1.12 - 0.12 * t) + 0.05, 0.2, 5, 28), mat4(x, y + h * t, z, 0, 1, 1, 1, PI / 2));
  b.cyl(M.granDark, r + 0.35, r + 0.35, 0.4, x, y + h, z, 24);
  kanguraRing(b, M.granite, x, z, r - 0.05, y + h + 0.4, 1.4);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * PI * 2 + 0.2;
    b.g(M.black, new THREE.BoxGeometry(0.18, 1.4, 0.5), mat4(x + Math.sin(a) * (r + 0.02), y + h - 3.2, z + Math.cos(a) * (r + 0.02), a));
  }
  addCirc(x, z, r * 1.2, y - 1, y + h + 2);
}
/** Gatehouse with a stepped arch, carved band and a pair of iron-studded doors standing open. Faces local +z (outward). */
function gatehouse(b, x, z, y, ry) {
  const F = frame(x, y, z, ry); b.push(x, y, z, ry);
  arcadeWall(b, F, M.granite, 0, 0, 0, 0, 14, 12, 1, 6, 5.2, 8.6, 4.2);
  for (const s of [-1, 1]) {
    b.g(M.limeTrim, arcadeGeo(8.6, 10.2, [{ x: 0, w: 6.6, spring: 5.5, apex: 9.1 }], 0.4), mat4(0, 0, s * 2.25, 0));
    b.g(M.granite, arcadeGeo(7.3, 9.9, [{ x: 0, w: 6.25, spring: 5.3, apex: 8.8 }], 0.2), mat4(0, 0, s * 2.5, 0));
    b.g(M.frieze, new THREE.BoxGeometry(13.4, 0.9, 0.16), mat4(0, 10.9, s * 2.16, 0));
    for (const q of [-1, 1]) {
      rosetteLite(b, mat4(q * 2.6, 7.9, s * 2.48, s > 0 ? 0 : PI), 0.42);
      b.g(M.granDark, wallHoles(2.2, 4.4, [{ x: 0, y: 0.5, w: 1.3, spring: 2.2, apex: 3.2 }], 0.2), mat4(q * 5.6, 1.4, s * 2.16, 0));   // guard niches
    }
    kanguraRow(b, M.granite, -7, s * 2.1, 7, s * 2.1, 12.5, 1.4);
  }
  b.box(M.granDark, 14.8, 0.5, 5, 0, 12, 0);
  // the doors: two leaves swung inward, banded with iron and studded with spikes against elephants
  for (const s of [-1, 1]) {
    const ang = -s * 1.2, hinge = mat4(s * 3.0, 0, -1.3, ang);
    const put = (mat, g, lx, ly, lz, rx = 0) => b.g(mat, g, hinge.clone().multiply(mat4(lx, ly, lz, 0, 1, 1, 1, rx)));
    put(M.wood, new THREE.BoxGeometry(2.9, 7.6, 0.24), -s * 1.45, 3.8, 0);
    for (const yy of [0.7, 2.6, 4.5, 6.4]) put(M.iron, new THREE.BoxGeometry(2.94, 0.16, 0.3), -s * 1.45, yy, 0);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) put(M.iron, new THREE.ConeGeometry(0.07, 0.32, 6), -s * (0.45 + c * 0.68), 1.6 + r * 1.2, 0.26, PI / 2);
    const cx = s * 3.0 - s * 1.45 * Math.cos(ang), cz = -1.3 + s * 1.45 * Math.sin(ang);
    addBox(...F.w(cx, cz), 2.9, 0.5, ry + ang, y - 1, y + 7.6);
  }
  b.pop();
}
function terraceStairs(b, t, a, yBot, width = 5) {
  const ux = Math.sin(a), uz = Math.cos(a), run = (t.y - yBot) / 0.75, ry = a + PI;
  const lx = t.x + ux * (t.r + 0.35), lz = t.z + uz * (t.r + 0.35);
  b.box(M.granite, width + 1.4, t.y - yBot + 0.6, 1.9, lx, yBot - 0.6, lz, ry);
  addRect(lx, lz, width, 2.1, t.y, ry);
  const d = t.r + 1.3 + run / 2;
  stairs(b, M.granite, t.x + ux * d, t.z + uz * d, ry, width, run, yBot, t.y, 0.8);
}
/** Crenellated parapet round a terrace rim, with an opening where the stairs arrive. */
function rimParapet(b, t, gapA, gapHalf) {
  const N = Math.round(2 * PI * t.r / 3.4), rr = t.r - 0.55;
  const near = (a) => Math.abs(Math.atan2(Math.sin(a - gapA), Math.cos(a - gapA))) < gapHalf;
  for (let i = 0; i < N; i++) {
    const a0 = i / N * 2 * PI, a1 = (i + 1) / N * 2 * PI;
    if (near(a0) || near(a1)) continue;
    const x0 = t.x + Math.sin(a0) * rr, z0 = t.z + Math.cos(a0) * rr, x1 = t.x + Math.sin(a1) * rr, z1 = t.z + Math.cos(a1) * rr;
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), ry = Math.atan2(dx, dz), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    b.box(M.granite, 0.7, 1.0, L + 0.3, mx, t.y, mz, ry);
    kanguraRow(b, M.granite, x0, z0, x1, z1, t.y + 1.0, 1.0);
    addBox(mx, mz, 0.8, L + 0.2, ry, t.y - 0.5, t.y + 2.4);
  }
}
function golconda(b) {
  const cx = -170, cz = 0, y = 0;
  island(b, cx, cz, 130, 130, y, [{ side: 'E', at: 0, w: 10 }, { side: 'N', at: -170, w: 10 }]);
  const X0 = -229, X1 = -111, Z0 = -59, Z1 = 59;
  fortWall(b, X1, Z0, X1, -7, y); fortWall(b, X1, 7, X1, Z1, y);
  fortWall(b, X0, Z0, -177, Z0, y); fortWall(b, -163, Z0, X1, Z0, y);
  fortWall(b, X0, Z0, X0, Z1, y); fortWall(b, X0, Z1, X1, Z1, y);
  for (const [bx, bz] of [[X0, Z0], [X0, Z1], [X1, Z0], [X1, Z1]]) bastion(b, bx, bz, y, 6.5, 11);
  for (const [bx, bz] of [[X0, 0], [-170, Z1], [X1, 30], [X1, -32], [-205, Z0], [-135, Z0]]) bastion(b, bx, bz, y, 4.6, 10);
  gatehouse(b, X1, 0, y, PI / 2); gatehouse(b, -170, Z0, y, PI);

  // the citadel hill: three rings of retaining wall rising out of granite outcrops
  const T = [{ x: -175, z: 0, r: 40, y: 7 }, { x: -178, z: -2, r: 27, y: 13 }, { x: -181, z: -3, r: 14, y: 19 }];
  const stairA = [PI / 2, 0, PI], stairW = [6, 5, 5];
  let py = y;
  T.forEach((t, ti) => {
    b.cyl(M.granite, t.r, t.r + 1.4, t.y - py + 0.5, t.x, py - 0.5, t.z, 40);
    b.cyl(M.granite, t.r + 0.9, t.r + 1.5, 1.0, t.x, py - 0.1, t.z, 40);          // spreading foot
    b.g(M.granDark, new THREE.TorusGeometry(t.r + 0.55, 0.28, 5, 48), mat4(t.x, py + (t.y - py) * 0.62, t.z, 0, 1, 1, 1, PI / 2));
    b.cyl(M.paveDark, t.r - 0.9, t.r - 0.9, 0.06, t.x, t.y, t.z, 40);
    addDisc(t.x, t.z, t.r * 0.985, t.y);
    addCirc(t.x, t.z, t.r + 1.0, -10, t.y);
    rimParapet(b, t, stairA[ti], (stairW[ti] / 2 + 1.4) / t.r);
    // bedrock breaking through at the foot of the wall
    const n = Math.round(t.r * 0.75);
    for (let k = 0; k < n; k++) {
      const a = (k + R() * 0.7) / n * 2 * PI;
      if (Math.abs(Math.atan2(Math.sin(a - stairA[ti]), Math.cos(a - stairA[ti]))) < 6 / t.r + 0.12) continue;
      const s = 1.3 + R() * 1.7, rr = t.r + 1.2 + R() * 1.8, rx = t.x + Math.sin(a) * rr, rz = t.z + Math.cos(a) * rr;
      const sx = s * (1 + R() * 0.5), sy = s * (0.8 + R() * 1.1), sz = s * (1 + R() * 0.5);
      b.g(M.rock, ROCKS_LO[k % 3], mat4(rx, py + sy * 0.3, rz, R() * 6.28, sx, sy, sz, R() * 0.3, R() * 0.3));
      addCirc(rx, rz, Math.min(sx, sz) * 0.8, py - 1, py + sy);
    }
    py = t.y;
  });
  terraceStairs(b, T[0], PI / 2, 0, 6);
  terraceStairs(b, T[1], 0, 7);
  terraceStairs(b, T[2], PI, 13);

  // Bala Hisar baradari on the summit
  const t3 = T[2], F = frame(t3.x, t3.y, t3.z + 1.5);
  b.push(F.x, F.y, F.z);
  const W = 12, D = 8.6, H = 6;
  b.box(M.pave, W + 1.6, 0.05, D + 1.6, 0, 0, 0);
  arcadeWall(b, F, M.lime, 0, 0, D / 2 - 0.45, 0, W, H, 3, 2.7, 2.6, 4.7, 0.9);
  arcadeWall(b, F, M.lime, 0, 0, -D / 2 + 0.45, 0, W, H, 3, 2.7, 2.6, 4.7, 0.9);
  arcadeWall(b, F, M.lime, W / 2 - 0.45, 0, 0, PI / 2, D, H, 2, 2.7, 2.6, 4.7, 0.9);
  arcadeWall(b, F, M.lime, -W / 2 + 0.45, 0, 0, PI / 2, D, H, 2, 2.7, 2.6, 4.7, 0.9);
  for (const s of [-1, 1]) {
    b.g(M.limeTrim, arcadeGeo(W, H - 0.2, Array.from({ length: 3 }, (_, i) => ({ x: (i + 0.5) * 4 - 6, w: 3.0, spring: 2.7, apex: 4.95 })), 0.14), mat4(0, 0, s * (D / 2 + 0.06), 0));
    for (const q of [-2, 2]) rosetteLite(b, mat4(q, 4.75, s * (D / 2 + 0.13), s > 0 ? 0 : PI), 0.32);
  }
  b.box(M.limeShade, W - 0.6, 0.35, D - 0.6, 0, H - 0.35, 0);
  corniceRing(b, 0, 0, W / 2, D / 2, H, { frieze: 0.5, eave: 1.0 });
  kanguraSquare(b, M.limeTrim, 0, 0, W / 2 + 0.4, D / 2 + 0.4, H + 0.3, 0.8);
  b.box(M.limeShade, 6.4, 3.4, 4.4, 0, H + 0.3, 0);
  for (let i = 0; i < 4; i++) {
    const a = i * PI / 2, ww = i % 2 ? 5 : 7, o = (i % 2 ? 7 : 5) / 2 - 0.2;
    b.g(M.lime, wallHoles(ww, 3.4, evenOpenings(ww, i % 2 ? 2 : 3, 1.3, 0.5, 1.4, 2.4), 0.4), mat4(Math.sin(a) * o, H + 0.3, Math.cos(a) * o, a));
    b.g(M.jali, new THREE.BoxGeometry(ww - 0.6, 2.4, 0.06), mat4(Math.sin(a) * (o - 0.15), H + 1.8, Math.cos(a) * (o - 0.15), a));
  }
  corniceRing(b, 0, 0, 3.5, 2.5, H + 3.7, { frieze: 0.35, eave: 0.6 });
  kanguraSquare(b, M.limeTrim, 0, 0, 3.8, 2.8, H + 4.0, 0.7);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) miniMinaret(b, sx * (W / 2 + 0.3), H + 0.3, sz * (D / 2 + 0.3), 0.42, 3.6);
  b.cyl(M.white, 0.07, 0.1, 7, 0, H + 4.0, 0, 6);
  b.g(fabric(0x1f7a5c), new THREE.BoxGeometry(2.6, 1.5, 0.04), mat4(1.35, H + 10.1, 0, 0));
  b.pop();

  // Deccan boulders and scrub on the fort floor
  const rocks = [[-122, 22, 2.6], [-119, 26, 1.7], [-124, 27, 1.2], [-121, -24, 2.2], [-125, -28, 1.5], [-222, 40, 3], [-218, 46, 2], [-223, 47, 1.3],
    [-220, -44, 2.8], [-215, -50, 1.8], [-150, 50, 2.4], [-145, 53, 1.5], [-196, -52, 2.2], [-150, -50, 2.0]];
  for (const [rx, rz, s] of rocks) boulder(b, rx, y, rz, s);
  boulder(b, -122, 2.4, 23, 1.4, false); boulder(b, -221, 3.0, 42, 1.6, false);
  for (const [tx, tz, kd] of [[-128, 42, 0], [-140, -44, 0], [-210, 52, 0], [-222, -20, 2], [-222, 14, 2], [-185, 52, 0], [-118, -48, 2], [-120, 48, 0]]) tree(b, tx, y, tz, 1.1, kd);
  for (const [tx, tz] of [[-148, 18], [-198, 30], [-203, -24], [-150, -24]]) tree(b, tx, 7, tz, 0.9, 0);
  for (const s of [-1, 1]) { lamp(b, -108, y, s * 6.5); lamp(b, -124, y, s * 5); }
}

// ------------------------------------------------------------ HITEC City
function glassTower(b, x, z, y, w, d, h, ry = 0) {
  b.push(x, y, z, ry);
  // podium with a recessed, glazed ground floor and an entrance canopy
  b.box(M.concrete, w + 3, 0.5, d + 3, 0, 0, 0);
  b.box(M.glass, w + 1.6, 2.4, d + 1.6, 0, 0.5, 0);
  b.box(M.concrete, w + 3.4, 0.5, d + 3.4, 0, 2.9, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(M.concrete, 0.9, 2.4, 0.9, sx * (w / 2 + 1), 0.5, sz * (d / 2 + 1));
  b.box(M.concrete, 5, 0.25, 3, 0, 2.5, d / 2 + 2.6);
  for (const s of [-1, 1]) b.cyl(M.iron, 0.08, 0.08, 2.0, s * 2.2, 0.5, d / 2 + 3.8, 8);
  // curtain wall: glass body, floor plates every 4 m, fins every 2 m
  b.box(M.glass, w, h, d, 0, 3.4, 0);
  for (let fy = 4; fy < h; fy += 4) b.box(M.concrete, w + 0.24, 0.22, d + 0.24, 0, 3.4 + fy, 0);
  for (let fx = -w / 2 + 1; fx <= w / 2 - 0.9; fx += 2) for (const s of [-1, 1]) b.box(M.concrete, 0.16, h, 0.34, fx, 3.4, s * (d / 2 + 0.14));
  for (let fz = -d / 2 + 1; fz <= d / 2 - 0.9; fz += 2) for (const s of [-1, 1]) b.box(M.concrete, 0.34, h, 0.16, s * (w / 2 + 0.14), 3.4, fz);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(M.concrete, 0.8, h + 1.5, 0.8, sx * w / 2, 3.4, sz * d / 2);
  // crown: parapet, plant room, mast
  b.box(M.concrete, w + 0.8, 1.2, d + 0.8, 0, h + 3.4, 0);
  b.box(M.concrete, w * 0.4, 3, d * 0.4, 0, h + 4.6, 0);
  for (let i = 0; i < 5; i++) b.box(M.iron, w * 0.38, 0.1, 0.05, 0, h + 5 + i * 0.5, d * 0.2 + 0.03);
  b.cyl(M.iron, 0.05, 0.1, 9, w * 0.12, h + 7.6, 0, 5);
  b.pop();
  addBox(x, z, w + 3, d + 3, ry, y - 1, y + h);
}
function hitec(b, extras) {
  const cx = -170, cz = -175, y = 8;
  island(b, cx, cz, 110, 90, y, [{ side: 'S', at: -170, w: 10 }, { side: 'E', at: -175, w: 12 }]);
  // Cyber Towers: the drum and its two wings
  const tx = -204, tz = -204;
  b.cyl(M.concrete, 14, 14, 3, tx, y, tz, 28);
  b.cyl(M.glass, 11.5, 11.5, 40, tx, y + 3, tz, 28);
  for (let i = 1; i <= 9; i++) b.cyl(M.concrete, 11.8, 11.8, 0.4, tx, y + 3 + i * 4, tz, 28);
  b.cyl(M.concrete, 12.4, 12.4, 1.4, tx, y + 43, tz, 28);
  b.cyl(M.glass, 6, 6, 5, tx, y + 44.4, tz, 20); b.cyl(M.concrete, 6.5, 6.5, 0.6, tx, y + 49.4, tz, 20);
  for (const [ox, oz] of [[14.5, 2], [2, 14.5]]) {
    b.cyl(M.glass, 8, 8, 30, tx + ox, y + 3, tz + oz, 22);
    for (let i = 1; i <= 7; i++) b.cyl(M.concrete, 8.25, 8.25, 0.35, tx + ox, y + 3 + i * 4, tz + oz, 22);
    b.cyl(M.concrete, 8.6, 8.6, 1, tx + ox, y + 33, tz + oz, 22); b.cyl(M.concrete, 9.6, 9.6, 3, tx + ox, y, tz + oz, 22);
    addCirc(tx + ox, tz + oz, 9.6, y - 1, y + 40);
  }
  addCirc(tx, tz, 14, y - 1, y + 50);
  glassTower(b, -136, -203, y, 18, 15, 68);
  glassTower(b, -206, -149, y, 16, 16, 47);
  glassTower(b, -137, -149, y, 22, 13, 22);
  b.box(M.concrete, 26, 1.6, 17, -137, y + 26.4, -149);
  // plaza
  b.cyl(M.concrete, 5.2, 5.4, 0.7, cx, y, cz, 24); b.cyl(M.water, 4.7, 4.7, 0.1, cx, y + 0.62, cz, 24);
  b.cyl(M.concrete, 0.5, 0.8, 2.6, cx, y, cz, 10); b.sphere(M.gold, 1.1, cx, y + 3.6, cz, 1, 1, 1, 16, 12);
  addCirc(cx, cz, 5.4, y - 1, y + 0.8);
  for (const [lx, lz, lw, ld] of [[-184, -175 + 11, 16, 8], [-184, -175 - 11, 16, 8], [-154, -175 + 11, 20, 8], [-154, -175 - 11, 20, 8]]) b.box(M.grass, lw, 0.06, ld, lx, y, lz);
  for (const [px, pz, kd] of [[-184, -164, 0], [-192, -182, 0], [-158, -164, 2], [-150, -186, 0], [-160, -186, 2], [-150, -164, 0], [-218, -175, 2], [-170, -214, 0], [-178, -214, 2], [-162, -214, 2]]) tree(b, px, y, pz, 1, kd);
  for (const [lx, lz] of [[-164, -136], [-176, -136], [-122, -168], [-122, -182], [-164, -196], [-176, -196]]) lamp(b, lx, y, lz);
  b.box(M.concrete, 9.8, 2.6, 0.7, -181, y, -184, PI / 4); addBox(-181, -184, 9.8, 0.9, PI / 4, y - 1, y + 2.6);
  const sg = signMesh('CYBER TOWERS', 9, 1.5, '#0f2a44', '#e8f2fb', 'Arial'); sg.position.set(-181 + 0.27, y + 1.5, -184 + 0.27); sg.rotation.y = PI / 4; extras.add(sg);
}

function cableBridge(b) {
  const x0 = -55, x1 = -115, z = -175, w = 11;
  bridge(b, x0, z, 0, x1, z, 8, w, { piers: false });
  const deckY = (x) => (x0 - x) / (x0 - x1) * 8;
  for (const px of [-73, -97]) {
    const by = deckY(px), top = by + 27;
    for (const s of [-1, 1]) {
      const g = new THREE.BoxGeometry(1.3, 46, 1.6); g.translate(0, 23, 0);
      b.g(M.concrete, g, mat4(px, by - 18, z + s * (w / 2 + 1.2), 0, 1, 1, 1, -s * 0.135));
      for (let i = 1; i <= 5; i++) for (const dir of [-1, 1]) {
        const ax = px + dir * i * 2.2, ay = deckY(ax) + 0.4;
        beam(b, M.white, V(px, top - i * 1.5, z + s * 1.2), V(ax, ay, z + s * (w / 2 - 0.1)), 0.06);
      }
    }
    b.box(M.concrete, 1.3, 1.4, 4.6, px, top - 0.4, z);
    b.box(M.concrete, 1.5, 1.2, w + 4.4, px, by - 2.6, z);
    b.box(M.concrete, 2.4, 80, 3, px, by - 82.6, z - w / 2 - 1.2); b.box(M.concrete, 2.4, 80, 3, px, by - 82.6, z + w / 2 + 1.2);
  }
}

// ------------------------------------------------------------ Charminar square
function autoRickshaw(b, x, y, z, ry) {
  b.push(x, y, z, ry);
  b.box(M.black, 1.36, 0.5, 2.3, 0, 0.28, 0);
  b.box(M.yellow, 1.3, 0.75, 1.5, 0, 0.78, -0.35);
  b.box(M.yellow, 1.0, 0.5, 0.55, 0, 0.5, 1.2);
  b.box(M.black, 1.42, 0.12, 2.15, 0, 1.72, -0.05);
  for (const s of [-1, 1]) { b.cyl(M.black, 0.035, 0.035, 0.95, s * 0.6, 0.78, 0.82, 5); b.cyl(M.black, 0.035, 0.035, 0.22, s * 0.62, 1.52, -1.05, 5); }
  b.box(M.black, 1.3, 0.3, 0.06, 0, 1.45, -1.08);
  b.box(M.white, 1.1, 0.5, 0.04, 0, 1.15, 0.86);
  const wheel = (wx, wz) => b.g(M.black, new THREE.CylinderGeometry(0.29, 0.29, 0.16, 12), mat4(wx, 0.29, wz, 0, 1, 1, 1, 0, PI / 2));
  wheel(0, 1.3); wheel(-0.66, -0.75); wheel(0.66, -0.75);
  b.sphere(M.white, 0.1, 0, 0.82, 1.48, 1, 1, 0.5, 8, 6);
  b.pop();
  addBox(x, z, 1.5, 2.9, ry, y - 1, y + 1.7);
}

function chowk(b, extras) {
  island(b, 0, 0, 100, 100, 0, [{ side: 'N', at: 0, w: 16 }, { side: 'E', at: 0, w: 10 }, { side: 'W', at: 0, w: 10 }]);
  b.box(M.paveDark, 12, 0.05, 99, 0, 0, 0);
  for (const s of [-1, 1]) b.box(M.paveDark, 43.5, 0.05, 10, s * 27.75, 0, 0);
  charminar(b, 0, 0, 0);
  meccaMasjid(b, -39, 0, 27, PI / 2);

  // Gulzar Houz, the old fountain north of the monument
  b.cyl(M.limeTrim, 4.2, 4.5, 0.8, 0, 0, -31, 8, PI / 8); b.cyl(M.water, 3.8, 3.8, 0.1, 0, 0.72, -31, 8, PI / 8);
  b.cyl(M.limeTrim, 0.5, 0.8, 1.8, 0, 0, -31, 8); b.cyl(M.limeTrim, 1.5, 0.4, 0.4, 0, 1.8, -31, 12); b.sphere(M.gold, 0.4, 0, 2.5, -31);
  addCirc(0, -31, 4.5, -1, 0.9);

  // Irani café in the south-east corner
  const F = frame(33, 0, 36, -PI / 2 - 0.5);
  b.push(F.x, 0, F.z, F.ry);
  b.box(M.lime, 7.5, 3.6, 4.2, 0, 0, 0);
  b.g(M.limeShade, wallHoles(7.6, 3.6, [{ x: -1.9, y: 1, w: 2.4, spring: 1.2, apex: 1.9 }, { x: 1.9, y: 0, w: 1.7, spring: 2.1, apex: 2.9 }], 0.2), mat4(0, 0, 2.05, 0));
  b.box(M.limeTrim, 8.3, 0.35, 5, 0, 3.6, 0);
  b.box(M.wood, 7, 0.9, 0.12, 0, 3.95, 2.2);
  b.g(fabric(0x00695c), new THREE.BoxGeometry(7.6, 0.07, 2.6), mat4(0, 3.0, 3.3, 0, 1, 1, 1, 0.3));
  for (const s of [-1, 1]) b.cyl(M.wood, 0.05, 0.05, 2.65, s * 3.6, 0, 4.45, 6);
  for (const s of [-1, 1]) {
    b.cyl(M.white, 0.55, 0.55, 0.06, s * 2.2, 0.78, 5.6, 14); b.cyl(M.iron, 0.05, 0.05, 0.78, s * 2.2, 0, 5.6, 6);
    for (const q of [-1, 1]) b.box(M.wood, 0.42, 0.46, 0.42, s * 2.2 + q * 0.95, 0, 5.6);
    b.cyl(M.white, 0.07, 0.05, 0.1, s * 2.2 + 0.18, 0.84, 5.55, 8); b.cyl(M.white, 0.07, 0.05, 0.1, s * 2.2 - 0.2, 0.84, 5.7, 8);
  }
  b.pop();
  addBox(F.x, F.z, 7.5, 4.2, F.ry, -1, 4);
  const cs = signMesh('IRANI CHAI • OSMANIA BISCUIT', 6.6, 0.8, '#00493f', '#f6e7b8');
  { const [nx, nz] = F.w(0, 2.3); cs.position.set(nx, 4.4, nz); cs.rotation.y = F.ry; }
  extras.add(cs);

  autoRickshaw(b, 20, 0, 41, 1.9); autoRickshaw(b, 14.5, 0, 42.5, 1.75); autoRickshaw(b, -17, 0, -41, -1.3); autoRickshaw(b, 41, 0, -13, 0.2);
  // a few pushcart stalls around the square
  const SF = frame(0, 0, 0);
  stall(b, SF, 18, -22, -0.6, 0xc62828, 0); stall(b, SF, -19, -20, 0.6, 0xf2b705, 2); stall(b, SF, 21, 19, -2.4, 0x1e88e5, 3);
  stall(b, SF, 30, -36, -0.9, 0xb0206a, 1); stall(b, SF, -30, -38, 0.9, 0x00897b, 3);
  for (const [tx, tz, kd] of [[-42, -42, 0], [42, -42, 0], [44, 44, 2], [-44, -20, 2], [44, 18, 0], [-12, 44, 2], [-26, -44, 0], [26, -44, 2]]) tree(b, tx, 0, tz, 1.15, kd);
  for (const [lx, lz] of [[-8, 20], [8, 20], [-8, -20], [8, -20], [20, -7], [20, 7], [-20, -7], [-20, 7], [-8, 44], [8, 44], [44, -7], [44, 7], [-44, -7], [-44, 7]]) lamp(b, lx, 0, lz);
}

// ------------------------------------------------------------ drifting islets (scenery only)
function islet(b, x, y, z, s, kind) {
  b.g(M.rock, ISLET, mat4(x, y, z, R() * 6, s * 1.05, s * 1.9, s * 1.05));
  b.cyl(M.grass, s * 0.82, s * 0.9, 0.5, x, y - 0.05, z, 18, R());
  if (kind === 0) {                                 // domed chhatri
    b.cyl(M.limeTrim, s * 0.5, s * 0.55, 0.5, x, y + 0.4, z, 8);
    for (let i = 0; i < 6; i++) { const a = i / 6 * 2 * PI; b.cyl(M.lime, 0.22, 0.26, s * 0.42, x + Math.sin(a) * s * 0.38, y + 0.9, z + Math.cos(a) * s * 0.38, 6); }
    b.cyl(M.limeTrim, s * 0.5, s * 0.5, 0.35, x, y + 0.9 + s * 0.42, z, 12);
    dome(b, M.limeTrim, x, y + 1.3 + s * 0.42, z, s * 0.36, s * 0.42, {});
  } else if (kind === 1) {
    b.g(M.rock, DODE, mat4(x, y + s * 0.35, z, R() * 6, s * 0.5, s * 0.42, s * 0.45));
    b.g(M.rock, DODE, mat4(x + s * 0.1, y + s * 0.95, z, R() * 6, s * 0.32, s * 0.3, s * 0.34));
  } else {
    b.cyl(M.trunk, 0.25, 0.4, s * 0.5, x, y + 0.3, z, 7);
    b.g(M.leaf, ICO, mat4(x, y + s * 0.8, z, 0, s * 0.5, s * 0.42, s * 0.5));
    b.g(M.leaf2, ICO, mat4(x + s * 0.28, y + s * 0.6, z + s * 0.1, 1, s * 0.32, s * 0.28, s * 0.32));
  }
}

// ------------------------------------------------------------ assemble
export function buildWorld(scene) {
  const extras = new THREE.Group(); scene.add(extras);
  const anim = [];
  const group = (fn) => { const b = new Batch(); fn(b); b.build(scene); return b.tris; };
  let tris = 0;
  tris += group((b) => chowk(b, extras));
  tris += group((b) => { bazaar(b, extras); });
  tris += group((b) => hussainSagar(b, extras, anim));
  tris += group((b) => { tombsIsland(b); bridge(b, 50, 0, 0, 100, 0, 5, 10); });
  tris += group((b) => { baradari(b); bridge(b, 55, -175, 0, 133, -175, 3, 9); bridge(b, 150, -158, 3, 150, -90, 5, 9); });
  tris += group((b) => { golconda(b); bridge(b, -50, 0, 0, -105, 0, 0, 10); });
  tris += group((b) => { hitec(b, extras); cableBridge(b); bridge(b, -170, -65, 0, -170, -130, 8, 9); });
  tris += group((b) => {
    const spots = [[90, 26, 95, 13, 0], [-78, 34, 82, 11, 2], [70, 12, -260, 12, 0], [-70, 40, -262, 14, 2], [250, 30, -120, 16, 0], [-285, 22, -90, 15, 2],
      [235, 55, 70, 12, 2], [-250, 60, 110, 16, 0], [20, 48, 150, 15, 0], [-120, 18, 120, 10, 2], [140, 70, -300, 18, 0], [-300, 75, -260, 20, 0], [310, 45, -10, 14, 2]];
    for (const [x, y, z, s, k] of spots) islet(b, x, y, z, s, k);
  });

  // ---- instanced details
  const globe = new THREE.InstancedMesh(new THREE.SphereGeometry(0.32, 10, 8), patch(new THREE.MeshStandardMaterial({ color: 0xfff3d0, emissive: 0xffd98a, emissiveIntensity: 1.6, roughness: 0.4 })), LAMPS.length);
  const mtx = new THREE.Matrix4();
  LAMPS.forEach((p, i) => globe.setMatrixAt(i, mtx.makeTranslation(p[0], p[1], p[2])));
  scene.add(globe);

  const lant = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.2, 0), patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 })), LANTERNS.length);
  const col = new THREE.Color();
  LANTERNS.forEach((p, i) => { lant.setMatrixAt(i, mat4(p[0], p[1], p[2], 0, 1, 1.5, 1)); lant.setColorAt(i, col.setHex(p[3])); });
  lant.castShadow = true; scene.add(lant);

  const bang = new THREE.InstancedMesh(new THREE.TorusGeometry(0.1, 0.017, 5, 14), patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.7 })), BANGLES.length);
  BANGLES.forEach((p, i) => { bang.setMatrixAt(i, p[0]); bang.setColorAt(i, col.setHex(p[1])); });
  scene.add(bang);

  return {
    tris, anim, noAO: NO_AO,
    spawn: new THREE.Vector3(0, 0, 33),
    zones: [
      { name: 'Charminar', sub: 'Four minarets, raised in 1591 by Muhammad Quli Qutb Shah', x: 0, z: 0, r: 47 },
      { name: 'Mecca Masjid', sub: 'The great mosque of the old city, completed in 1694', x: -37, z: 27, r: 16 },
      { name: 'Laad Bazaar', sub: 'The old bangle market, lac and glass in every colour', x: 0, z: -88, r: 33 },
      { name: 'Hussain Sagar', sub: 'The heart-shaped lake of 1563 and its monolithic Buddha', x: 0, z: -175, r: 56 },
      { name: 'Taramati Baradari', sub: 'A pavilion of twelve arches, open to every wind', x: 150, z: -175, r: 22 },
      { name: 'Qutb Shahi Tombs', sub: 'The domed necropolis of Golconda’s sultans', x: 150, z: -30, r: 66 },
      { name: 'Golconda Fort', sub: 'The diamond citadel — clap at the gate and the summit hears it', x: -170, z: 0, r: 80 },
      { name: 'HITEC City', sub: 'Cyberabad, the new city of glass', x: -170, z: -175, r: 62 },
    ],
    pearls: [
      [0, 1.3, 0], [-39, 1.6, 27], [0, 1.3, -55], [1.5, 1.3, -96], [0, 1.3, -167.5], [5, 1.3, -223],
      [150, 5.5, -175], [153.5, 8.3, -30], [190, 6.3, 22], [-117, 1.3, 0], [-181, 20.3, -1.5], [-85, 5.3, -175],
      [-170, 9.3, -160], [-209, 8.3, 8],
    ],
  };
}
