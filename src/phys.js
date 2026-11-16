// Tiny analytic collision world: walkable surfaces (rects, ramps, discs, rings)
// and blockers (oriented boxes, circles) with a vertical extent.

export const surfaces = [];
export const blockers = [];

const STEP = 0.6; // max height the player can step up without jumping

/** Flat or sloped rectangle. y0 at local z = -d/2, y1 at local z = +d/2. */
export function addRect(cx, cz, w, d, y0, rot = 0, y1 = y0, tag = '') {
  surfaces.push({ k: 0, cx, cz, hx: w / 2, hz: d / 2, c: Math.cos(rot), s: Math.sin(rot), y0, y1, tag });
}
export function addDisc(cx, cz, r, y, tag = '') {
  surfaces.push({ k: 1, cx, cz, r0: 0, r1: r, y0: y, y1: y, tag });
}
export function addRing(cx, cz, r0, r1, y, tag = '') {
  surfaces.push({ k: 1, cx, cz, r0, r1, y0: y, y1: y, tag });
}

/** Highest surface under (x,z) that is no more than a step above y. */
export function groundAt(x, z, y, out) {
  let best = -Infinity, bs = null;
  for (let i = 0; i < surfaces.length; i++) {
    const s = surfaces[i];
    const dx = x - s.cx, dz = z - s.cz;
    let h;
    if (s.k === 0) {
      const lx = dx * s.c - dz * s.s;
      if (lx < -s.hx - 0.03 || lx > s.hx + 0.03) continue;
      const lz = dx * s.s + dz * s.c;
      if (lz < -s.hz - 0.03 || lz > s.hz + 0.03) continue;
      h = s.y0 + (s.y1 - s.y0) * Math.max(0, Math.min(1, (lz + s.hz) / (2 * s.hz)));
    } else {
      const d2 = dx * dx + dz * dz;
      if (d2 > s.r1 * s.r1 || d2 < s.r0 * s.r0) continue;
      h = s.y0;
    }
    if (h <= y + STEP && h > best) { best = h; bs = s; }
  }
  if (out) out.s = bs;
  return best;
}

/** Oriented box blocker: w along local x, d along local z. */
export function addBox(cx, cz, w, d, rot, y0, y1) {
  blockers.push({ k: 0, cx, cz, hx: w / 2, hz: d / 2, c: Math.cos(rot), s: Math.sin(rot), y0, y1 });
}
export function addCirc(cx, cz, r, y0, y1) {
  blockers.push({ k: 1, cx, cz, r, y0, y1 });
}
/** Annular wall (e.g. the lake rim seen from the water): blocks r0 < d < r1. */
export function addRingBlock(cx, cz, r0, r1, y0, y1) {
  blockers.push({ k: 2, cx, cz, r0, r1, y0, y1 });
}
/** A raised walkable slab the player has to climb or jump onto. */
export function addRaised(cx, cz, w, d, rot, yTop, tag = '') {
  addRect(cx, cz, w, d, yTop, rot, yTop, tag);
  addBox(cx, cz, w, d, rot, -1e3, yTop);
}

/** Push a circle of radius `rad` standing at p (feet) out of every blocker. */
export function resolve(p, rad) {
  for (let i = 0; i < blockers.length; i++) {
    const b = blockers[i];
    if (p.y + 0.55 >= b.y1 || p.y + 1.7 <= b.y0) continue;
    const dx = p.x - b.cx, dz = p.z - b.cz;
    if (b.k === 1) {
      const R = b.r + rad, d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      const d = Math.sqrt(d2) || 1e-4;
      // a slight sideways slip so walking dead-centre into a round thing slides past it
      const slip = d < R - 0.004 ? 0.014 : 0;
      p.x = b.cx + dx / d * R - dz / d * slip; p.z = b.cz + dz / d * R + dx / d * slip;
      continue;
    }
    if (b.k === 2) {
      const d = Math.sqrt(dx * dx + dz * dz) || 1e-4;
      if (d <= b.r0 - rad || d >= b.r1 + rad) continue;
      const R = (d - b.r0 < b.r1 - d) ? b.r0 - rad : b.r1 + rad;
      p.x = b.cx + dx / d * R; p.z = b.cz + dz / d * R;
      continue;
    }
    if (Math.abs(dx) + Math.abs(dz) > (b.hx + b.hz + rad) * 1.5) continue;
    let lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
    const qx = Math.max(-b.hx, Math.min(b.hx, lx)), qz = Math.max(-b.hz, Math.min(b.hz, lz));
    const nx = lx - qx, nz = lz - qz, d2 = nx * nx + nz * nz;
    if (d2 >= rad * rad) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2), k = (rad - d) / d;
      lx += nx * k; lz += nz * k;
    } else {
      const px = b.hx - Math.abs(lx), pz = b.hz - Math.abs(lz);
      if (px < pz) lx = (lx < 0 ? -1 : 1) * (b.hx + rad); else lz = (lz < 0 ? -1 : 1) * (b.hz + rad);
    }
    p.x = b.cx + lx * b.c + lz * b.s;
    p.z = b.cz - lx * b.s + lz * b.c;
  }
}
