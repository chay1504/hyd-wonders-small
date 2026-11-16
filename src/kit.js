// Building kit: photographic PBR materials, a geometry batcher and the
// Deccani architectural vocabulary (pointed arches, onion domes, kanguras).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const CLOUD_Y = -21;
// linear-light colours shared by every patched material (tuned in main.js)
export const MIST = new THREE.Vector3(0.95, 0.97, 1.0);          // what things dissolve into near the cloud deck
export const HAZE = new THREE.Vector4(0.5, 0.62, 0.86, 0.00055); // rgb + density of aerial perspective

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 3D value noise for displacing rocks and foliage
function h3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let xf = x - xi, yf = y - yi, zf = z - zi;
  xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf); zf = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(h3(xi, yi, zi), h3(xi + 1, yi, zi), xf), L(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), xf), yf),
    L(L(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), xf), L(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), xf), yf), zf);
}
export function fbm3(x, y, z, oct = 4) {
  let a = 0.5, s = 0;
  for (let i = 0; i < oct; i++) { s += a * noise3(x, y, z); x *= 2.03; y *= 2.03; z *= 2.03; a *= 0.5; }
  return s;
}
/** A lumpy, natural rock: an icosphere pushed around by noise. */
export function rockGeo(seed, detail = 3, amp = 0.42, flatTop = false) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);                       // share vertices so the surface shades smoothly
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = fbm3(v.x * 1.3 + seed, v.y * 1.3 + seed * 2.1, v.z * 1.3 - seed, 4) - 0.5;
    const n2 = fbm3(v.x * 4 + seed, v.y * 4, v.z * 4 + seed, 3) - 0.5;
    v.multiplyScalar(1 + n * amp * 2 + n2 * amp * 0.5);
    if (flatTop && v.y > 0) v.y *= 0.06;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- textures
export const manager = new THREE.LoadingManager();
const TL = new THREE.TextureLoader(manager);
function T(file, srgb) {
  const t = TL.load('./assets/tex/' + file);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const sets = {};
const pbrSet = (id) => (sets[id] ??= { map: T(id + '_diff.jpg', true), normalMap: T(id + '_nor.jpg'), arm: T(id + '_arm.jpg') });

function canvasTex(size, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}
/** Tileable fbm noise (R: broad, G: fine). Used for the cloud sea and for weathering every surface. */
export const NOISE_TEX = (() => {
  const N = 512, data = new Uint8Array(N * N * 4);
  const hsh = (x, y, p, s) => { x = ((x % p) + p) % p; y = ((y % p) + p) % p; const v = Math.sin(x * 127.1 + y * 311.7 + s * 17.3) * 43758.5453; return v - Math.floor(v); };
  const vn = (x, y, p, s) => {
    const xi = Math.floor(x), yi = Math.floor(y); let xf = x - xi, yf = y - yi;
    xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf);
    const a = hsh(xi, yi, p, s), b = hsh(xi + 1, yi, p, s), c = hsh(xi, yi + 1, p, s), d = hsh(xi + 1, yi + 1, p, s);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  const fb = (u, v, p0, s) => { let amp = 0.5, sum = 0, p = p0; for (let o = 0; o < 6; o++) { sum += amp * vn(u * p, v * p, p, s + o); p *= 2; amp *= 0.5; } return sum; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4, u = x / N, v = y / N;
    data[i] = Math.min(255, fb(u, v, 4, 1) * 262); data[i + 1] = Math.min(255, fb(u, v, 8, 9) * 262); data[i + 2] = 128; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
})();

/** Turn a greyscale height drawing into a tangent-space normal map. */
function reliefNormal(w, h, draw, strength = 3) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const src = g.getImageData(0, 0, w, h).data, out = g.createImageData(w, h);
  const H = (x, y) => src[((((y % h) + h) % h) * w + (((x % w) + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    out.data[i] = (-dx / l * 0.5 + 0.5) * 255; out.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; out.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.colorSpace = THREE.NoColorSpace;
  return t;
}
/** Carved stucco frieze: a running band of palmettes between two mouldings. */
const friezeNormal = () => reliefNormal(256, 256, (g, w, h) => {
  g.fillStyle = '#606060'; g.fillRect(0, 0, w, h);
  g.filter = 'blur(1.6px)';
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 6, w, 20); g.fillRect(0, h - 26, w, 20);
  g.fillStyle = '#303030'; g.fillRect(0, 30, w, 5); g.fillRect(0, h - 35, w, 5);
  for (let k = 0; k < 2; k++) {
    const cx = k * 128 + 64, cy = h / 2 + 8;
    for (let p = -3; p <= 3; p++) {                      // palmette leaves fanning from the base
      const a = p * 0.36, len = 74 - Math.abs(p) * 9;
      g.save(); g.translate(cx, cy + 46); g.rotate(a);
      g.fillStyle = '#f0f0f0'; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(11, -len * 0.45, 9, -len * 0.85, 0, -len); g.bezierCurveTo(-9, -len * 0.85, -11, -len * 0.45, 0, 0); g.fill();
      g.strokeStyle = '#7a7a7a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -len + 6); g.stroke();
      g.restore();
    }
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, cy + 48, 9, 0, 7); g.fill();
    g.fillStyle = '#e0e0e0'; g.beginPath(); g.arc(k * 128, cy + 16, 12, 0, 7); g.fill();
    g.fillStyle = '#505050'; g.beginPath(); g.arc(k * 128, cy + 16, 5, 0, 7); g.fill();
  }
  g.filter = 'none';
}, 4.5);
/** A ring of little pointed arches over a pierced balustrade: wraps minaret galleries. One arch per repeat. */
const arcadeBandTex = () => canvasTex(256, (g, s) => {
  const r = rng(40);
  g.fillStyle = '#e3d3ad'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 3000; i++) { g.fillStyle = r() > 0.5 ? `rgba(255,255,255,${r() * 0.07})` : `rgba(70,45,20,${r() * 0.09})`; g.fillRect(r() * s, r() * s, 2, 2); }
  g.fillStyle = 'rgba(90,60,30,0.35)'; g.fillRect(0, s * 0.3, s, 3); g.fillRect(0, s * 0.9, s, 3);
  g.strokeStyle = 'rgba(80,55,30,0.5)'; g.lineWidth = 5;
  const arch = () => { g.beginPath(); g.moveTo(s * 0.2, s * 0.72); g.lineTo(s * 0.2, s * 0.5); g.bezierCurveTo(s * 0.2, s * 0.3, s * 0.4, s * 0.2, s * 0.5, s * 0.1); g.bezierCurveTo(s * 0.6, s * 0.2, s * 0.8, s * 0.3, s * 0.8, s * 0.5); g.lineTo(s * 0.8, s * 0.72); g.closePath(); };
  arch(); g.stroke();
  g.globalCompositeOperation = 'destination-out';
  arch(); g.fill();
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {   // balustrade piercings
    const x = (i + 0.5) * s / 4, y = s * 0.79 + j * s * 0.09;
    g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 9, y); g.lineTo(x, y + 8); g.lineTo(x - 9, y); g.closePath(); g.fill();
  }
});
/** A palm frond: midrib and leaflets, cut out with alpha. */
const frondTex = () => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 512;
  const g = c.getContext('2d'), r = rng(8);
  g.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const y = 500 - i * 10.6, t = i / 46, len = 58 * Math.sin(Math.PI * (0.12 + t * 0.86)) + 4;
    for (const s of [-1, 1]) {
      const gr = 100 + r() * 50 | 0;
      g.strokeStyle = `rgb(${38 + r() * 30 | 0},${gr},${30 + r() * 20 | 0})`; g.lineWidth = 5.2 - t * 2;
      g.beginPath(); g.moveTo(64, y); g.quadraticCurveTo(64 + s * len * 0.5, y - 10, 64 + s * len, y - 20 - r() * 12); g.stroke();
    }
  }
  g.strokeStyle = '#6b6a2e'; g.lineWidth = 4; g.beginPath(); g.moveTo(64, 512); g.lineTo(64, 6); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
};

/** Pierced stone screen: colour with real holes (alpha), used with alphaTest. */
const jaliTex = () => canvasTex(256, (g, s) => {
  const r = rng(12);
  g.fillStyle = '#dcc79a'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = r() > 0.5 ? `rgba(255,255,255,${r() * 0.08})` : `rgba(60,40,20,${r() * 0.1})`;
    g.fillRect(r() * s, r() * s, 2, 2);
  }
  g.globalCompositeOperation = 'destination-out';
  const n = 4, c = s / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i * c + c / 2, y = j * c + c / 2;
    for (let k = 0; k < 8; k++) {                      // eight-point star
      const a = k * Math.PI / 4;
      g.beginPath(); g.ellipse(x + Math.cos(a) * c * 0.21, y + Math.sin(a) * c * 0.21, c * 0.15, c * 0.075, a, 0, 7); g.fill();
    }
    g.beginPath(); g.arc(x, y, c * 0.07, 0, 7); g.fill();
    for (const [ox, oy] of [[0, 0], [c, 0], [0, c], [c, c]]) { g.beginPath(); g.arc(i * c + ox, j * c + oy, c * 0.15, 0, 7); g.fill(); }
  }
});
const glassTex = () => canvasTex(256, (g, s) => {
  const r = rng(77);
  g.fillStyle = '#0f2236'; g.fillRect(0, 0, s, s);
  const n = 8, c = s / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const v = r();
    g.fillStyle = v > 0.94 ? '#d9c79a' : `rgb(${26 + v * 30 | 0},${62 + v * 44 | 0},${96 + v * 56 | 0})`;
    g.fillRect(i * c + 1.5, j * c + 3, c - 3, c - 6);
  }
});
/** Tileable ripple normal map for water. */
const waterNormalTex = () => {
  const N = 256, h = new Float32Array(N * N);
  const waves = [[3, 2, 0.3, 1], [5, -4, 1.7, 0.6], [-7, 6, 4.1, 0.4], [11, 9, 2.2, 0.25], [-13, 5, 5.3, 0.2], [17, -15, 0.9, 0.12]];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0;
    for (const [fx, fy, ph, a] of waves) v += a * Math.sin((x * fx + y * fy) / N * Math.PI * 2 + ph + Math.sin((x * fy - y * fx) / N * Math.PI * 2) * 0.8);
    h[y * N + x] = v;
  }
  return canvasTex(N, (g) => {
    const img = g.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = h[y * N + (x + 1) % N] - h[y * N + (x + N - 1) % N], dy = h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x];
      const nx = -dx * 1.6, ny = -dy * 1.6, l = Math.hypot(nx, ny, 1), i = (y * N + x) * 4;
      img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, false);
};

/** A lettered board as its own mesh (not batched). */
export function signMesh(text, w, h, bg = '#7a1f2b', fg = '#f5d98a', font = 'Georgia') {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(16, 16, c.width - 32, c.height - 32);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  let px = c.height * 0.5;
  g.font = `bold ${px}px ${font}`;
  while (g.measureText(text).width > c.width - 100) { px -= 2; g.font = `bold ${px}px ${font}`; }
  g.fillText(text, c.width / 2, c.height / 2 + 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), patch(new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.1 })));
  m.castShadow = false; m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------- materials
/** Adds aerial haze and the cloud-deck mist to a standard material, in linear light before tone mapping. */
export function patch(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uMist = { value: MIST };
    sh.uniforms.uHaze = { value: HAZE };
    sh.uniforms.uMacro = { value: NOISE_TEX };
    sh.uniforms.uWeather = { value: mat.userData.weather ?? 1 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vMistY;\nvarying vec3 vMW;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 mistW = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mistW = instanceMatrix * mistW;
        #endif
        vMW = (modelMatrix * mistW).xyz;
        vMistY = vMW.y;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vMistY;\nvarying vec3 vMW;\nuniform vec3 uMist;\nuniform vec4 uHaze;\nuniform sampler2D uMacro;\nuniform float uWeather;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        {  // large-scale staining and rain streaks, so no surface is one flat tone
          float blot = texture2D(uMacro, vMW.xz * 0.013 + vMW.y * 0.009).r;
          float streak = texture2D(uMacro, vec2((vMW.x + vMW.z) * 0.21, vMW.y * 0.016)).g;
          float fine = texture2D(uMacro, vMW.xz * 0.09 + vMW.yy * 0.07).g;
          float w = (blot - 0.5) * 0.5 + (streak - 0.5) * 0.34 + (fine - 0.5) * 0.16;
          diffuseColor.rgb *= 1.0 + w * uWeather;
        }`)
      .replace('#include <tonemapping_fragment>', `
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze.rgb, 1.0 - exp(-length(vViewPosition) * uHaze.w));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uMist, 1.0 - smoothstep(-20.0, -2.5, vMistY));
        #include <tonemapping_fragment>`);
  };
  return mat;
}

export const M = {};
function reg(name, m, uv) { m.userData.uv = uv; m.name = name; M[name] = m; return m; }
/** Photographic PBR material. tint is a linear multiplier (may exceed 1 to lift a dark scan). */
function pbr(name, id, { uv = 0.25, tint = [1, 1, 1], rough = 1, bump = 1, ...rest } = {}) {
  const s = pbrSet(id);
  const m = patch(new THREE.MeshStandardMaterial({
    map: s.map, normalMap: s.normalMap, normalScale: new THREE.Vector2(bump, bump),
    aoMap: s.arm, roughnessMap: s.arm, roughness: rough, metalness: 0, ...rest,
  }));
  m.color.setRGB(tint[0], tint[1], tint[2]);
  return reg(name, m, uv);
}
function std(name, color, { rough = 0.9, metal = 0, uv = 0.25, ...rest } = {}) {
  return reg(name, patch(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...rest })), uv);
}
const fabricCache = new Map();
let weave = null;
export function fabric(hex) {
  if (!fabricCache.has(hex)) {
    const m = patch(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9, side: THREE.DoubleSide, normalMap: weave, normalScale: new THREE.Vector2(0.5, 0.5) }));
    m.userData.uv = 3; fabricCache.set(hex, m);
  }
  return fabricCache.get(hex);
}

export function initMaterials() {
  weave = pbrSet('white_stucco_02').normalMap;
  // lime plaster, the body of Charminar and the mosque
  pbr('lime', 'plastered_wall_02', { uv: 1 / 4, tint: [1.24, 1.02, 0.68], bump: 1.6 });
  M.lime.userData.weather = 1.25;
  pbr('limeTrim', 'plastered_wall_02', { uv: 1 / 3.2, tint: [1.32, 1.16, 0.86], bump: 1.4 });
  M.limeTrim.userData.weather = 0.8;
  pbr('limeShade', 'grey_plaster_02', { uv: 1 / 5, tint: [0.62, 0.5, 0.36] });
  // dressed stone
  pbr('granite', 'large_sandstone_blocks', { uv: 1 / 5.5, tint: [1.25, 1.14, 0.98], bump: 1.3 });
  pbr('granDark', 'castle_wall_slates', { uv: 1 / 4, tint: [0.72, 0.66, 0.58] });
  pbr('pave', 'seaworn_stone_tiles', { uv: 1 / 4.5, tint: [1.28, 1.16, 0.96], bump: 1.2 });
  pbr('paveDark', 'rock_tile_floor', { uv: 1 / 3.2, tint: [0.98, 0.9, 0.78] });
  pbr('stoneWhite', 'white_stucco_02', { uv: 1 / 3, tint: [1.3, 1.22, 1.05] });
  pbr('marble', 'marble_01', { uv: 1 / 3, tint: [1.05, 1.03, 1.0], rough: 0.55 });
  pbr('rock', 'rock_boulder_dry', { uv: 1 / 5, tint: [0.78, 0.71, 0.63], bump: 1.6 });
  pbr('grass', 'leafy_grass', { uv: 1 / 3, tint: [0.62, 1.12, 0.42] });
  pbr('leaf', 'leafy_grass', { uv: 1 / 1.1, tint: [0.26, 0.58, 0.2], bump: 2.6 });
  pbr('leaf2', 'leafy_grass', { uv: 1 / 1.1, tint: [0.36, 0.7, 0.24], bump: 2.6 });
  pbr('trunk', 'rock_boulder_dry', { uv: 1 / 1.2, tint: [0.62, 0.44, 0.3], bump: 2 });
  pbr('wood', 'brown_planks_03', { uv: 1 / 1.5, tint: [0.9, 0.8, 0.7] });
  pbr('concrete', 'white_stucco_02', { uv: 1 / 4, tint: [1.15, 1.16, 1.18] });
  pbr('white', 'plastered_wall_02', { uv: 1 / 3, tint: [1.35, 1.34, 1.3] });
  reg('jali', patch(new THREE.MeshStandardMaterial({
    map: jaliTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, normalMap: pbrSet('plastered_wall_02').normalMap,
  })), 1 / 1.7);
  // carved stucco band, arcaded gallery ring and palm fronds
  {
    const s = pbrSet('plastered_wall_02');
    reg('frieze', patch(new THREE.MeshStandardMaterial({ map: s.map, normalMap: friezeNormal(), normalScale: new THREE.Vector2(2.2, 2.2), roughness: 0.9 })), 1 / 1.1);
    M.frieze.color.setRGB(1.32, 1.16, 0.86);
    const band = arcadeBandTex();
    reg('arcadeBand', patch(new THREE.MeshStandardMaterial({ map: band, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 })), 1);
    M.arcadeBand.userData.keepUV = true; M.arcadeBand.userData.weather = 0.6;
    reg('frond', patch(new THREE.MeshStandardMaterial({ map: frondTex(), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.75 })), 1);
    M.frond.userData.keepUV = true; M.frond.userData.weather = 0.3;
  }
  std('gold', 0xe7b24a, { rough: 0.24, metal: 1 });
  M.gold.userData.weather = 0.25;
  std('green', 0x1f7a5c, { rough: 0.3, metal: 0.1 });
  std('iron', 0x1d2024, { rough: 0.45, metal: 0.8 });
  std('yellow', 0xf0b90f, { rough: 0.35, metal: 0.1 });
  std('black', 0x121214, { rough: 0.5 });
  std('glass', 0xffffff, { map: glassTex(), uv: 1 / 12, rough: 0.06, metal: 0.9 });
  M.glass.userData.weather = 0.15;
  const wn = waterNormalTex();
  std('water', 0x1f6f86, { rough: 0.03, metal: 0.1, transparent: true, opacity: 0.86, normalMap: wn, normalScale: new THREE.Vector2(0.3, 0.3), uv: 1 / 13 });
  M.water.userData.ripple = wn; M.water.userData.weather = 0;
  return M;
}

// ---------------------------------------------------------------- batching
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
/** Compose a matrix; rotation order is yaw (ry) then pitch (rx) then roll (rz). */
export function mat4(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3();
function boxUV(g, s) {
  const p = g.attributes.position, n = p.count, uv = new Float32Array(n * 2), v = [_a, _b, _c];
  for (let i = 0; i < n; i += 3) {
    _a.fromBufferAttribute(p, i); _b.fromBufferAttribute(p, i + 1); _c.fromBufferAttribute(p, i + 2);
    _n.subVectors(_b, _a).cross(_p.subVectors(_c, _a));
    const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
    for (let k = 0; k < 3; k++) {
      let u, w;
      if (ax >= ay && ax >= az) { u = v[k].z; w = v[k].y; }
      else if (ay >= az) { u = v[k].x; w = v[k].z; }
      else { u = v[k].x; w = v[k].y; }
      uv[(i + k) * 2] = u * s; uv[(i + k) * 2 + 1] = w * s;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** Collects transformed geometry per material and merges it into a few meshes. */
export class Batch {
  constructor() { this.map = new Map(); this.stack = [new THREE.Matrix4()]; this.tris = 0; }
  get base() { return this.stack[this.stack.length - 1]; }
  push(x, y, z, ry = 0) { this.stack.push(this.base.clone().multiply(mat4(x, y, z, ry))); return this; }
  pushM(m) { this.stack.push(this.base.clone().multiply(m)); return this; }
  pop() { this.stack.pop(); return this; }

  g(mat, geo, m) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(m ? this.base.clone().multiply(m) : this.base);
    const keep = mat.userData.keepUV && g.attributes.uv;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(keep && k === 'uv')) g.deleteAttribute(k);
    if (!keep) boxUV(g, mat.userData.uv || 0.25);
    if (!this.map.has(mat)) this.map.set(mat, []);
    this.map.get(mat).push(g);
    this.tris += g.attributes.position.count / 3;
    return this;
  }
  /** Box sitting on y (y is its underside). */
  box(mat, w, h, d, x, y, z, ry = 0) {
    return this.g(mat, new THREE.BoxGeometry(w, h, d), mat4(x, y + h / 2, z, ry));
  }
  /** Cylinder / cone sitting on y. */
  cyl(mat, rt, rb, h, x, y, z, seg = 14, ry = 0) {
    return this.g(mat, new THREE.CylinderGeometry(rt, rb, h, seg), mat4(x, y + h / 2, z, ry));
  }
  sphere(mat, r, x, y, z, sx = 1, sy = 1, sz = 1, ws = 12, hs = 8) {
    return this.g(mat, new THREE.SphereGeometry(r, ws, hs), mat4(x, y, z, 0, sx, sy, sz));
  }
  lathe(mat, pts, x, y, z, seg = 18, sx = 1, sz = 1, ry = 0) {
    return this.g(mat, new THREE.LatheGeometry(pts, seg), mat4(x, y, z, ry, sx, 1, sz));
  }
  build(parent, { cast = true, receive = true } = {}) {
    const out = [];
    for (const [mat, arr] of this.map) {
      const geo = mergeGeometries(arr, false);
      arr.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = cast && !mat.transparent; mesh.receiveShadow = receive;
      mesh.matrixAutoUpdate = false;
      parent.add(mesh); out.push(mesh);
    }
    this.map.clear();
    return out;
  }
}

// ---------------------------------------------------------------- arches
function archInto(p, x, y, w, spring, apex) {
  const hw = w / 2, r = apex - spring;
  p.lineTo(x - hw, y + spring);
  p.bezierCurveTo(x - hw, y + spring + r * 0.62, x - hw * 0.42, y + apex - r * 0.16, x, y + apex);
  p.bezierCurveTo(x + hw * 0.42, y + apex - r * 0.16, x + hw, y + spring + r * 0.62, x + hw, y + spring);
}
/** Wall W×H with pointed arches standing on the ground line. arches: [{x,w,spring,apex}] sorted by x. */
export function arcadeGeo(W, H, arches, depth) {
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0);
  for (const a of arches) {
    s.lineTo(a.x - a.w / 2, 0);
    archInto(s, a.x, 0, a.w, a.spring, a.apex);
    s.lineTo(a.x + a.w / 2, 0);
  }
  s.lineTo(W / 2, 0); s.lineTo(W / 2, H); s.lineTo(-W / 2, H); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 9 });
  g.translate(0, 0, -depth / 2);
  return g;
}
/** Wall W×H with raised arched openings. openings: [{x,y,w,spring,apex}] */
export function wallHoles(W, H, openings, depth) {
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0); s.lineTo(W / 2, 0); s.lineTo(W / 2, H); s.lineTo(-W / 2, H); s.closePath();
  for (const o of openings) {
    const p = new THREE.Path();
    p.moveTo(o.x - o.w / 2, o.y);
    archInto(p, o.x, o.y, o.w, o.spring, o.apex);
    p.lineTo(o.x + o.w / 2, o.y); p.closePath();
    s.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return g;
}
export function evenOpenings(W, n, w, y, spring, apex) {
  const o = [];
  for (let i = 0; i < n; i++) o.push({ x: (i + 0.5) * W / n - W / 2, y, w, spring, apex });
  return o;
}

// ---------------------------------------------------------------- kanguras (leaf merlons)
const KANG = (() => {
  const s = new THREE.Shape();
  s.moveTo(-0.42, 0); s.lineTo(0.42, 0); s.lineTo(0.42, 0.5);
  s.bezierCurveTo(0.42, 0.85, 0.12, 0.95, 0, 1.25);
  s.bezierCurveTo(-0.12, 0.95, -0.42, 0.85, -0.42, 0.5);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.28, bevelEnabled: false, curveSegments: 3 });
  g.translate(0, 0, -0.14);
  return g;
})();
export function kanguraRow(b, mat, x0, z0, x1, z1, y, size = 0.9) {
  const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), n = Math.max(1, Math.floor(L / (size * 1.05)));
  const ry = Math.atan2(-dz, dx);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    b.g(mat, KANG, mat4(x0 + dx * t, y, z0 + dz * t, ry, size, size, size));
  }
}
export function kanguraSquare(b, mat, cx, cz, hw, hd, y, size = 0.9) {
  kanguraRow(b, mat, cx - hw, cz + hd, cx + hw, cz + hd, y, size);
  kanguraRow(b, mat, cx - hw, cz - hd, cx + hw, cz - hd, y, size);
  kanguraRow(b, mat, cx - hw, cz - hd, cx - hw, cz + hd, y, size);
  kanguraRow(b, mat, cx + hw, cz - hd, cx + hw, cz + hd, y, size);
}
export function kanguraRing(b, mat, cx, cz, r, y, size = 0.9) {
  const n = Math.max(6, Math.floor(2 * Math.PI * r / (size * 1.05)));
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    b.g(mat, KANG, mat4(cx + Math.sin(a) * r, y, cz + Math.cos(a) * r, a, size, size, size));
  }
}

// ---------------------------------------------------------------- ornament: rings, petals, rosettes, cornices
const PI = Math.PI;
/** Open cylinder wrapped with the little-arch band; `n` arches round the ring. */
export function arcadeRing(b, x, y, z, r, h, n) {
  const g = new THREE.CylinderGeometry(r, r, h, Math.max(16, n * 2), 1, true);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * n);
  b.g(M.arcadeBand, g, mat4(x, y + h / 2, z));
}
/** A ring of leaf-shaped lotus petals. tilt > 0 leans the tips outward, < 0 turns them down. */
export function petalRing(b, mat, x, y, z, r, n, size, tilt = 0.55, phase = 0, lo = false) {
  for (let i = 0; i < n; i++) {
    const a = (i + phase) / n * PI * 2;
    b.g(mat, new THREE.SphereGeometry(1, lo ? 6 : 8, lo ? 4 : 6), mat4(x + Math.sin(a) * r, y, z + Math.cos(a) * r, a, size * 0.5, size, size * 0.22, tilt));
  }
}
/** Stucco rosette, facing the matrix's +z. */
export function rosette(b, m, r) {
  const at = (g, mat, lm) => b.g(mat, g, m.clone().multiply(lm));
  at(new THREE.CylinderGeometry(r, r, 0.14, 24), M.limeTrim, mat4(0, 0, 0.07, 0, 1, 1, 1, PI / 2));
  at(new THREE.TorusGeometry(r * 0.92, r * 0.09, 6, 28), M.limeTrim, mat4(0, 0, 0.15));
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * PI * 2;
    at(new THREE.SphereGeometry(1, 8, 6), M.limeTrim, mat4(Math.sin(a) * r * 0.5, Math.cos(a) * r * 0.5, 0.16, 0, r * 0.2, r * 0.36, r * 0.1, 0, -a));
  }
  at(new THREE.SphereGeometry(r * 0.2, 10, 8), M.limeTrim, mat4(0, 0, 0.18, 0, 1, 1, 0.6));
}
/** A lighter medallion for places that need dozens of them. */
export function rosetteLite(b, m, r) {
  const at = (g, lm) => b.g(M.limeTrim, g, m.clone().multiply(lm));
  at(new THREE.CylinderGeometry(r, r, 0.1, 14), mat4(0, 0, 0.05, 0, 1, 1, 1, PI / 2));
  at(new THREE.TorusGeometry(r * 0.78, r * 0.13, 5, 14), mat4(0, 0, 0.1));
  at(new THREE.SphereGeometry(r * 0.34, 8, 6), mat4(0, 0, 0.1, 0, 1, 1, 0.55));
}
/**
 * The crowning assembly of a Deccani storey around a rectangle: carved frieze, a course of brackets,
 * the cornice slab and a sloping eave (chajja). y is the underside of the slab.
 */
export function corniceRing(b, cx, cz, hw, hd, y, { frieze = 0.7, brackets = true, eave = 1.2, mat = M.limeTrim } = {}) {
  const segs = [[-hw, hd, hw, hd], [hw, hd, hw, -hd], [hw, -hd, -hw, -hd], [-hw, -hd, -hw, hd]];
  for (const [x0, z0, x1, z1] of segs) {
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx), nx = -dz / L, nz = dx / L;
    const mx = cx + (x0 + x1) / 2, mz = cz + (z0 + z1) / 2;
    if (frieze) b.g(M.frieze, new THREE.BoxGeometry(L, frieze, 0.16), mat4(mx + nx * 0.07, y - 0.52 - frieze / 2, mz + nz * 0.07, ry));
    if (brackets) {
      const n = Math.max(2, Math.floor(L / 0.85));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        b.g(mat, new THREE.BoxGeometry(0.26, 0.48, 0.6), mat4(cx + x0 + dx * t + nx * 0.3, y - 0.24, cz + z0 + dz * t + nz * 0.3, ry));
      }
    }
    if (eave) b.g(mat, new THREE.BoxGeometry(L + eave * 2, 0.12, eave), mat4(mx + nx * (0.62 + eave / 2), y + 0.06, mz + nz * (0.62 + eave / 2), ry, 1, 1, 1, 0.3));
  }
  b.box(mat, hw * 2 + 1.3, 0.3, hd * 2 + 1.3, cx, y, cz);
}

// ---------------------------------------------------------------- domes & minarets
const ONION = [[0.8, 0], [0.93, 0.08], [1, 0.22], [0.97, 0.38], [0.84, 0.55], [0.62, 0.72], [0.36, 0.85], [0.14, 0.94], [0, 1]];
export function onionPts(r, h, n = 20) {
  const c = new THREE.SplineCurve(ONION.map((p) => new THREE.Vector2(p[0] * r, p[1] * h)));
  return c.getPoints(n).map((p) => { p.x = Math.max(0, p.x); return p; });
}
export function finial(b, x, y, z, s) {
  b.cyl(M.gold, s * 0.16, s * 0.3, s * 0.3, x, y, z, 10);
  const ws = s < 0.4 ? 7 : 12, hs = s < 0.4 ? 5 : 8;
  b.sphere(M.gold, s * 0.36, x, y + s * 0.6, z, 1, 1, 1, ws, hs);
  b.sphere(M.gold, s * 0.24, x, y + s * 1.12, z, 1, 1, 1, ws, hs);
  b.cyl(M.gold, 0, s * 0.11, s * 1.2, x, y + s * 1.3, z, 8);
}
/** Bulbous Qutb Shahi dome rising out of a double calyx of lotus petals. y is the springing line. */
export function dome(b, mat, x, y, z, r, h, { petals = true, fin = true, petalMat = M.limeTrim } = {}) {
  if (petals) {
    const n = Math.max(10, Math.round(r * 5)), lo = r < 1.6;
    b.cyl(petalMat, r * 0.9, r * 0.96, r * 0.14, x, y - r * 0.14, z, lo ? 14 : 28);
    petalRing(b, petalMat, x, y + r * 0.16, z, r * 0.86, lo ? 8 : n, r * 0.36, 0.3, 0, lo);
    if (!lo) petalRing(b, petalMat, x, y + r * 0.04, z, r * 0.92, n, r * 0.26, 0.55, 0.5, lo);
  }
  b.lathe(mat, onionPts(r, h, r < 1.6 ? 12 : 26), x, y, z, r < 1.6 ? 14 : 32);
  if (fin) finial(b, x, y + h * 0.97, z, r * 0.22);
}
/** Slim corner minaret: moulded octagonal shaft, a lotus-bracketed arcaded gallery, and a little dome. */
export function miniMinaret(b, x, y, z, r, H, mat = M.lime) {
  const sh = H * 0.6, gy = y + sh, ro = r * 1.75, top = y + H * 0.86;
  b.cyl(M.limeTrim, r * 1.3, r * 1.45, r * 0.45, x, y, z, 8, PI / 8);
  b.cyl(mat, r * 0.86, r, sh, x, y, z, 8, PI / 8);
  for (const t of [0.34, 0.68]) b.g(M.limeTrim, new THREE.TorusGeometry(r * 0.98, r * 0.09, 5, 12), mat4(x, y + sh * t, z, 0, 1, 1, 1, PI / 2));
  b.cyl(M.limeTrim, ro, r * 0.92, r * 0.9, x, gy - r * 0.9, z, 14);
  petalRing(b, M.limeTrim, x, gy - r * 0.42, z, r * 1.32, 8, r * 0.5, -0.75, 0, true);
  b.cyl(M.limeTrim, ro + r * 0.1, ro + r * 0.1, r * 0.14, x, gy, z, 16);
  arcadeRing(b, x, gy + r * 0.14, z, ro, r * 1.15, Math.max(8, Math.round(2 * PI * ro / (r * 0.6))));
  b.cyl(M.limeShade, r * 0.8, r * 0.8, r * 1.15, x, gy + r * 0.14, z, 8);
  b.cyl(M.limeTrim, ro * 0.78, ro * 1.14, r * 0.22, x, gy + r * 1.29, z, 16);
  const uy = gy + r * 1.5;
  b.cyl(mat, r * 0.7, r * 0.76, Math.max(0.05, top - uy), x, uy, z, 8, PI / 8);
  b.cyl(M.limeTrim, r * 1.08, r * 0.72, r * 0.3, x, top - r * 0.3, z, 12);
  dome(b, M.limeTrim, x, top, z, r * 1.05, H * 0.14, { fin: true });
}
/** Charminar-scale minaret: octagonal shaft, three galleries, crowned dome. */
export function grandMinaret(b, x, y, z, H, r) {
  b.cyl(M.lime, r * 0.8, r, H * 0.86, x, y, z, 8, Math.PI / 8);
  for (let i = 1; i < 12; i++) if (i % 2) b.cyl(M.limeTrim, r * 0.98, r * 0.98, 0.22, x, y + H * 0.86 * i / 12, z, 8, Math.PI / 8);
  for (const t of [0.46, 0.62, 0.77]) {
    const yy = y + H * t, rr = r * (1 - t * 0.2);
    b.cyl(M.limeTrim, rr + 1.35, rr + 0.1, 1.2, x, yy - 1.2, z, 16);
    b.cyl(M.limeTrim, rr + 1.45, rr + 1.45, 0.25, x, yy, z, 16);
    b.cyl(M.jali, rr + 1.36, rr + 1.36, 0.95, x, yy + 0.25, z, 16);
    b.cyl(M.limeTrim, rr + 1.42, rr + 1.42, 0.14, x, yy + 1.2, z, 16);
  }
  const yt = y + H * 0.86;
  b.cyl(M.limeTrim, r * 1.3, r * 0.8, 0.9, x, yt - 0.9, z, 16);
  b.cyl(M.limeTrim, r * 1.34, r * 1.34, 0.3, x, yt, z, 16);
  dome(b, M.limeTrim, x, yt + 0.5, z, r * 0.98, H * 0.1, {});
}
