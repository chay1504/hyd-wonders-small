// Charminar (1591), modelled storey by storey: the four great arches in their
// stepped frames, the arcaded first-floor gallery with its clocks, the screened
// attic, and four minarets with lotus-bracketed, arcaded balconies.
import * as THREE from 'three';
import { M, mat4, arcadeGeo, kanguraRow, kanguraSquare, dome, arcadeRing, petalRing, rosette } from './kit.js';
import { addBox, addCirc } from './phys.js';

const PI = Math.PI;

function minaret(b, x, z, H, r) {
  // plinth and lotus foot
  b.cyl(M.limeTrim, r + 0.75, r + 0.95, 0.9, x, 0, z, 8, PI / 8);
  b.cyl(M.limeTrim, r + 0.45, r + 0.75, 0.5, x, 0.9, z, 16);
  petalRing(b, M.limeTrim, x, 1.75, z, r + 0.25, 16, 0.8, 0.2);
  // shaft with slender engaged ribs
  const top = H * 0.86, r1 = r * 0.78;
  b.cyl(M.lime, r1, r, top, x, 0, z, 16);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * PI * 2 + PI / 8;
    const g = new THREE.CylinderGeometry(0.2, 0.24, top, 6);
    const lean = Math.atan2(r - r1, top);
    b.g(M.limeTrim, g, mat4(x + Math.sin(a) * (r + r1) / 2, top / 2, z + Math.cos(a) * (r + r1) / 2, a, 1, 1, 1, -lean));
  }
  const rad = (yy) => r + (r1 - r) * yy / top;
  for (const yy of [5, 9.5, 14, 18.5, 29, 37.6, 45]) {
    b.g(M.limeTrim, new THREE.TorusGeometry(rad(yy) + 0.06, 0.16, 6, 28), mat4(x, yy, z, 0, 1, 1, 1, PI / 2));
  }
  // three balconies: lotus bracket, deck, arcaded parapet, eave
  for (const yy of [24.9, 33.6, 41.4]) {
    const rr = rad(yy), ro = rr + 1.5;
    b.cyl(M.limeTrim, ro + 0.05, rr + 0.1, 1.5, x, yy - 1.5, z, 24);
    petalRing(b, M.limeTrim, x, yy - 0.75, z, rr + 0.9, 18, 0.72, -0.75);
    b.cyl(M.limeTrim, ro + 0.2, ro + 0.2, 0.22, x, yy, z, 28);
    arcadeRing(b, x, yy + 0.22, z, ro, 2.0, Math.round(2 * PI * ro / 0.82));
    b.cyl(M.limeTrim, ro - 0.25, ro + 0.45, 0.32, x, yy + 2.22, z, 28);
    b.cyl(M.limeTrim, ro - 0.25, ro - 0.25, 0.2, x, yy + 2.54, z, 28);
    b.cyl(M.limeShade, rr + 0.04, rr + 0.04, 2.0, x, yy + 0.22, z, 16);        // shadowed core behind the arcade
  }
  // crown: collar, petals, bulbous dome, brass finial
  b.cyl(M.limeTrim, r1 + 0.75, r1 + 0.1, 1.0, x, top - 1.0, z, 24);
  b.cyl(M.limeTrim, r1 + 0.85, r1 + 0.85, 0.3, x, top, z, 24);
  kanguraRingSmall(b, x, z, r1 + 0.7, top + 0.3);
  dome(b, M.limeTrim, x, top + 0.75, z, r1 + 0.35, H * 0.1, {});
}
function kanguraRingSmall(b, x, z, r, y) {
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = i / n * PI * 2, a2 = (i + 0.02) / n * PI * 2;
    kanguraRow(b, M.limeTrim, x + Math.sin(a) * r, z + Math.cos(a) * r, x + Math.sin(a2) * r, z + Math.cos(a2) * r, y, 0.55);
  }
}

export function charminar(b, x, y, z) {
  b.push(x, y, z);
  const S = 22, h = S / 2, H1 = 24, G0 = 24.9, GH = 6.2, A0 = G0 + GH + 0.6, AH = 5;
  for (let i = 0; i < 4; i++) {
    const ry = i * PI / 2, sx = Math.sin(ry), cz = Math.cos(ry);
    const P = (lx, yy, off) => [sx * off + cz * lx, yy, cz * off - sx * lx];
    const put = (mat, geo, lx, yy, off, rx = 0, rz = 0) => { const p = P(lx, yy, off); b.g(mat, geo, mat4(p[0], p[1], p[2], ry, 1, 1, 1, rx, rz)); };
    const boxAt = (mat, w, hh, d, lx, yy, off) => put(mat, new THREE.BoxGeometry(w, hh, d), lx, yy + hh / 2, off);

    // ---- the great arch in three stepped planes
    put(M.lime, arcadeGeo(S, H1, [{ x: 0, w: 11, spring: 11.5, apex: 20 }], 3), 0, 0, h - 1.5);
    put(M.limeTrim, arcadeGeo(16, 21.5, [{ x: 0, w: 12.3, spring: 11.9, apex: 20.75 }], 0.45), 0, 0, h + 0.22);
    put(M.lime, arcadeGeo(13.3, 21.1, [{ x: 0, w: 11.55, spring: 11.65, apex: 20.3 }], 0.25), 0, 0, h + 0.5);
    for (const s of [-1, 1]) {
      const p = P(s * 4.75, 18.5, h + 0.45);
      rosette(b, mat4(p[0], p[1], p[2], ry), 0.95);
      boxAt(M.limeTrim, 0.5, 21.5, 0.3, s * 7.75, 0, h + 0.5);             // pilaster strips framing the bay
    }
    boxAt(M.limeTrim, 16.6, 0.5, 0.75, 0, 0, h + 0.3);                      // plinth course

    // ---- carved frieze, bracket course, cornice and sloping eave
    boxAt(M.frieze, 15.6, 1.1, 0.3, 0, 21.9, h + 0.1);
    boxAt(M.limeTrim, 15.9, 0.22, 0.5, 0, 23.0, h + 0.15);
    for (let k = 0; k < 16; k++) boxAt(M.limeTrim, 0.34, 0.62, 0.95, -7.5 + k, 23.3, h + 0.45);
    boxAt(M.limeTrim, 16.2, 0.3, 1.5, 0, 23.92, h + 0.65);
    put(M.limeTrim, new THREE.BoxGeometry(15.8, 0.16, 2.3), 0, 24.3, h + 1.75, 0.3);
    boxAt(M.limeTrim, 15.8, 0.22, 0.22, 0, 23.85, h + 2.75);

    // ---- first-floor gallery: seven open arches over a pierced balustrade
    const GW = 15.8;
    put(M.lime, arcadeGeo(GW, GH, Array.from({ length: 7 }, (_, k) => ({ x: (k + 0.5) * GW / 7 - GW / 2, w: 1.62, spring: 2.9, apex: 4.55 })), 0.8), 0, G0, h - 0.6);
    boxAt(M.jali, GW, 1.05, 0.1, 0, G0, h - 0.5);
    boxAt(M.limeTrim, GW, 0.16, 0.34, 0, G0 + 1.05, h - 0.5);
    for (let k = 0; k <= 7; k++) boxAt(M.limeTrim, 0.26, 4.9, 0.14, k * GW / 7 - GW / 2, G0, h - 0.16);
    boxAt(M.frieze, GW, 0.9, 0.2, 0, G0 + GH - 1.05, h - 0.14);
    // the clock, set in a gabled panel over the centre arch
    { const p0 = P(-0.05, 0, h - 0.02), p1 = P(0.05, 0, h - 0.02); kanguraRow(b, M.limeTrim, p0[0], p0[2], p1[0], p1[2], G0 + 2.9, 2.9); }
    put(M.white, new THREE.CylinderGeometry(1.0, 1.0, 0.16, 32), 0, G0 + 4.35, h + 0.48, PI / 2);
    put(M.gold, new THREE.TorusGeometry(1.0, 0.085, 8, 36), 0, G0 + 4.35, h + 0.56);
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * PI * 2, g = new THREE.BoxGeometry(0.045, k % 3 ? 0.13 : 0.22, 0.03);
      const p = P(Math.sin(a) * 0.84, G0 + 4.35 + Math.cos(a) * 0.84, h + 0.57);
      b.g(M.black, g, mat4(p[0], p[1], p[2], ry, 1, 1, 1, 0, -a));
    }
    const hand = (len, ang, wd) => { const g = new THREE.BoxGeometry(wd, len, 0.03); g.translate(0, len / 2 - 0.07, 0); put(M.black, g, 0, G0 + 4.35, h + 0.59, 0, ang); };
    hand(0.52, -1.0 + i * 0.3, 0.085); hand(0.8, 1.9 + i, 0.055);
    put(M.gold, new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10), 0, G0 + 4.35, h + 0.6, PI / 2);

    // ---- second cornice
    for (let k = 0; k < 16; k++) boxAt(M.limeTrim, 0.3, 0.45, 0.7, -7.5 + k, G0 + GH - 0.1, h + 0.12);
    boxAt(M.limeTrim, 16.2, 0.6, 1.5, 0, G0 + GH + 0.02, h + 0.1);

    // ---- attic: five arches closed with stone screens
    put(M.lime, arcadeGeo(16, AH, Array.from({ length: 5 }, (_, k) => ({ x: (k + 0.5) * 3.2 - 8, w: 2.05, spring: 2.3, apex: 3.75 })), 0.6), 0, A0, 7.7);
    boxAt(M.jali, 15.2, 3.8, 0.08, 0, A0, 7.55);
    for (let k = 0; k < 5; k++) boxAt(M.limeTrim, 2.5, 0.14, 0.12, (k + 0.5) * 3.2 - 8, A0 + 4.05, 8.04);
    boxAt(M.frieze, 16, 0.75, 0.16, 0, A0 + AH - 0.8, 8.02);

    for (const s of [-1, 1]) {
      const bp = P(s * 8.25, 0, h - 1.5);
      addBox(x + bp[0], z + bp[2], 5.5, 3, ry, y - 1, y + 30);
    }
  }
  // ---- cores, floors and parapets
  b.box(M.limeShade, S - 2, 1.6, S - 2, 0, 22.4, 0);
  b.box(M.limeTrim, S + 0.6, 0.9, S + 0.6, 0, 24, 0);
  b.box(M.limeShade, S - 5, GH, S - 5, 0, G0, 0);
  b.box(M.pave, S - 1.2, 0.12, S - 1.2, 0, G0 - 0.02, 0);
  b.box(M.limeTrim, S + 0.4, 0.6, S + 0.4, 0, G0 + GH, 0);
  kanguraSquare(b, M.limeTrim, 0, 0, h - 0.1, h - 0.1, A0, 0.95);
  b.box(M.limeShade, 13.6, AH, 13.6, 0, A0, 0);
  b.box(M.limeTrim, 17.3, 0.5, 17.3, 0, A0 + AH, 0);
  b.box(M.limeTrim, 18.1, 0.16, 18.1, 0, A0 + AH + 0.3, 0);
  kanguraSquare(b, M.limeTrim, 0, 0, 8.35, 8.35, A0 + AH + 0.5, 0.9);
  // medallion on the vault, and an inlaid star on the floor beneath it
  rosette(b, mat4(0, 22.38, 0, 0, 1, 1, 1, PI / 2), 3.2);
  b.cyl(M.limeTrim, 4.2, 4.2, 0.07, 0, 0, 0, 8, PI / 8);
  b.cyl(M.paveDark, 3.4, 3.4, 0.09, 0, 0, 0, 8);
  b.cyl(M.limeTrim, 1.6, 1.6, 0.11, 0, 0, 0, 8, PI / 8);

  for (const [mx, mz] of [[h, h], [h, -h], [-h, h], [-h, -h]]) {
    minaret(b, mx, mz, 56, 3.0);
    addCirc(x + mx, z + mz, 3.9, y - 1, y + 60);
  }
  b.pop();
}
