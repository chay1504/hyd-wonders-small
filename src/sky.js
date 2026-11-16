// The giant planet, the cloud sea and billboard cumulus. The sky itself is a
// photographed HDR panorama set up in main.js; everything here outputs linear
// light and is tone-mapped with the rest of the scene.
import * as THREE from 'three';
import { CLOUD_Y, rng, NOISE_TEX } from './kit.js';

const NOISE = `
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<6;i++){ s+=a*noise(p); p=p*2.03+vec2(17.0,9.0); a*=0.5; } return s; }
`;
const OUT = `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>`;

function planetTexture() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024;
  const g = c.getContext('2d'), r = rng(2024);
  const grad = g.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, '#e9f1f8'); grad.addColorStop(0.1, '#2c5f9e'); grad.addColorStop(0.5, '#173f80');
  grad.addColorStop(0.9, '#2c5f9e'); grad.addColorStop(1, '#eef4fa');
  g.fillStyle = grad; g.fillRect(0, 0, 2048, 1024);
  for (let i = 0; i < 46; i++) {                       // continents built from many soft blobs
    const x = r() * 2048, y = 180 + r() * 660, n = 40 + r() * 90, land = r() > 0.4;
    for (let k = 0; k < n; k++) {
      const px = x + (r() - 0.5) * 330 * r(), py = y + (r() - 0.5) * 200 * r(), rad = 8 + r() * 46;
      const gr = g.createRadialGradient(px, py, 0, px, py, rad);
      const col = land ? (r() > 0.5 ? '96,122,70' : '128,132,84') : '176,150,106';
      gr.addColorStop(0, `rgba(${col},${0.3 + r() * 0.4})`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
  }
  for (let i = 0; i < 1300; i++) {                     // weather systems: streaks and swirls
    const x = r() * 2048, y = r() * 1024, w = 20 + r() * 190, h = 2 + r() * 12;
    g.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.1})`;
    g.beginPath(); g.ellipse(x, y, w, h, (r() - 0.5) * 0.9, 0, 7); g.fill();
  }
  for (let i = 0; i < 26; i++) {
    const x = r() * 2048, y = 200 + r() * 620;
    for (let k = 0; k < 60; k++) {
      const a = k * 0.33, d = 6 + k * 1.5;
      g.fillStyle = `rgba(255,255,255,${0.05 * (1 - k / 60)})`;
      g.beginPath(); g.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, 20, 7, a + 1.5, 0, 7); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

/** Cumulus sprite sheet: 2x2 different cauliflower puffs with baked top-lit shading in rgb and density in alpha. */
function puffTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S * 2;
  const g = c.getContext('2d'), r = rng(31);
  for (let q = 0; q < 4; q++) {
    const ox = (q % 2) * S, oy = (q >> 1) * S;
    g.save(); g.beginPath(); g.rect(ox, oy, S, S); g.clip();
    const blobs = [];
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2, d = Math.pow(r(), 0.7) * 54;      // kept well inside the cell so no puff is cut square
      blobs.push([ox + S / 2 + Math.cos(a) * d * 1.2, oy + S * 0.56 + Math.sin(a) * d * 0.62 - d * 0.1, 10 + r() * 28 * (1 - d / 90)]);
    }
    blobs.sort((p, q2) => q2[1] - p[1]);                // lower blobs first so tops overlap them
    for (const [x, y, rad] of blobs) {
      const gr = g.createRadialGradient(x - rad * 0.2, y - rad * 0.35, rad * 0.1, x, y, rad);
      const shade = Math.max(0, Math.min(1, (y - oy) / S * 1.5 - 0.3));
      const v = Math.round(255 - shade * 120);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)');
      gr.addColorStop(0.6, `rgba(${v},${v},${v},0.75)`);
      gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
    }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace;
  return t;
}

export function makeSky(scene, sunDir, islands) {
  const group = new THREE.Group(); scene.add(group);
  const U = {
    uTime: { value: 0 },
    uLit: { value: new THREE.Vector3(1.18, 1.15, 1.1) },      // sunlit cloud, linear
    uShade: { value: new THREE.Vector3(0.42, 0.5, 0.66) },   // cloud in shadow
    uFar: { value: new THREE.Vector3(0.72, 0.82, 1.0) },     // what the deck fades to at the horizon
    uSun: { value: sunDir },
    uNoise: { value: NOISE_TEX },
    uCamY: { value: new THREE.Vector2(0, 1) },                 // world-y of the camera's right and up axes
  };

  // --- planet
  const pDir = new THREE.Vector3(0.42, 0.44, -0.8).normalize();
  const planet = new THREE.Mesh(new THREE.SphereGeometry(1050, 96, 64), new THREE.ShaderMaterial({
    depthWrite: false, fog: false, transparent: true,
    uniforms: { uSun: U.uSun, uMap: { value: planetTexture() }, uSpin: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec2 vUv; varying vec3 vV;
      void main(){ vN = normalize(mat3(modelMatrix) * normal); vUv = uv;
        vec4 w = modelMatrix * vec4(position,1.0); vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vN; varying vec2 vUv; varying vec3 vV; uniform vec3 uSun; uniform sampler2D uMap; uniform float uSpin;
      void main(){ vec3 n = normalize(vN);
        vec3 tex = pow(texture2D(uMap, vec2(vUv.x + uSpin, vUv.y)).rgb, vec3(2.2));
        float ndl = dot(n, normalize(uSun + vec3(-1.0, 0.0, 0.25)));
        float day = smoothstep(-0.12, 0.45, ndl);
        vec3 sky = vec3(0.16, 0.34, 0.78);                       // the daytime sky seen through thin air
        vec3 c = tex * (0.04 + 1.5 * day);
        float rim = pow(1.0 - max(dot(n, vV), 0.0), 3.0);
        c += vec3(0.35, 0.6, 1.3) * rim * (0.25 + day);          // atmosphere limb
        c = c * 0.5 + sky * (0.46 + 0.16 * (1.0 - day));         // veiled by our own atmosphere
        float edge = 1.0 - smoothstep(0.90, 1.0, 1.0 - max(dot(n, vV), 0.0));
        gl_FragColor = vec4(c, edge);
        ${OUT} }`,
  }));
  planet.renderOrder = -9; planet.frustumCulled = false;
  planet.rotation.set(0.35, 0.6, 0.25);
  group.add(planet);

  // --- cloud sea
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000), new THREE.ShaderMaterial({
    fog: false,
    uniforms: U,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vW; uniform float uTime; uniform vec3 uLit; uniform vec3 uShade; uniform vec3 uFar; uniform vec3 uSun; uniform sampler2D uNoise;
      float field(vec2 p){ return texture2D(uNoise, p / 830.0 + vec2(uTime * 0.0021, 0.0)).r * 0.62 + texture2D(uNoise, p / 420.0 - vec2(0.0, uTime * 0.0034)).g * 0.38; }
      void main(){
        vec2 p = vW.xz;
        float h = field(p);
        float hs = field(p + uSun.xz * 14.0);                   // light the billows from the sun's side
        float lit = clamp(0.5 + (h - hs) * 15.0, 0.0, 1.0);
        float crev = smoothstep(0.3, 0.58, h);
        vec3 c = mix(uShade, uLit, lit * (0.35 + 0.65 * crev));
        float d = length(p - cameraPosition.xz);
        c = mix(c, uFar, smoothstep(300.0, 4200.0, d));
        gl_FragColor = vec4(c, 1.0);
        ${OUT} }`,
  }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = CLOUD_Y; sea.frustumCulled = false; sea.renderOrder = -5;
  group.add(sea);

  // --- cumulus billboards
  const r = rng(909), P = [];
  const insideIsland = (x, z) => islands.some((i) => Math.abs(x - i.x) < i.hw + 14 && Math.abs(z - i.z) < i.hd + 14);
  for (let i = 0; i < 320; i++) {                 // lumps on the deck between the islands
    const x = (r() - 0.5) * 1100 - 10, z = (r() - 0.5) * 1000 - 80, near = insideIsland(x, z);
    const s = near ? 45 + r() * 30 : 60 + r() * 75;
    P.push([x, near ? CLOUD_Y - 7 + r() * 4 : CLOUD_Y - 5 + r() * 15, z, s, r()]);
  }
  for (const il of islands) {                     // a collar of cloud around every island's foot
    if (il.thin) continue;
    const per = 2 * (il.hw + il.hd) * 2, n = Math.round(per / 15);
    for (let i = 0; i < n; i++) {
      const t = (i + r() * 0.6) / n * 4, e = 6 + r() * 14; let x, z;
      if (il.round) { const a = t / 4 * Math.PI * 2; x = il.x + Math.sin(a) * (il.hw + e - 6); z = il.z + Math.cos(a) * (il.hw + e - 6); }
      else if (t < 1) { x = il.x - il.hw + t * 2 * il.hw; z = il.z - il.hd - e; }
      else if (t < 2) { x = il.x + il.hw + e; z = il.z - il.hd + (t - 1) * 2 * il.hd; }
      else if (t < 3) { x = il.x + il.hw - (t - 2) * 2 * il.hw; z = il.z + il.hd + e; }
      else { x = il.x - il.hw - e; z = il.z + il.hd - (t - 3) * 2 * il.hd; }
      P.push([x, il.y - 17 - r() * 6, z, 40 + r() * 26, r()]);
    }
  }
  for (let k = 0; k < 30; k++) {                  // towering cumulus on the horizon
    const a = r() * Math.PI * 2, d = 650 + r() * 900, cx = Math.cos(a) * d, cz = Math.sin(a) * d - 80;
    const top = 30 + r() * 170, n = 8 + (r() * 10 | 0), base = 150 + r() * 160;
    for (let j = 0; j < n; j++) {
      const t = j / n, s = base * (1 - t * 0.55);
      P.push([cx + (r() - 0.5) * base * (1.1 - t), CLOUD_Y + 10 + t * top, cz + (r() - 0.5) * base * (1.1 - t), s, r()]);
    }
  }
  P.sort((a, b) => (b[0] * b[0] + b[2] * b[2]) - (a[0] * a[0] + a[2] * a[2]));
  const ig = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  ig.index = quad.index; ig.setAttribute('position', quad.attributes.position); ig.setAttribute('uv', quad.attributes.uv);
  ig.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(P.flatMap((p) => [p[0], p[1], p[2]])), 3));
  ig.setAttribute('iSS', new THREE.InstancedBufferAttribute(new Float32Array(P.flatMap((p) => [p[3], p[4]])), 2));
  ig.instanceCount = P.length;
  const puffs = new THREE.Mesh(ig, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { ...U, uMap: { value: puffTexture() } },
    vertexShader: `attribute vec3 iPos; attribute vec2 iSS; varying vec2 vUv; varying float vD; varying float vWY; uniform float uTime; uniform vec2 uCamY;
      void main(){
        float cell = floor(iSS.y * 3.999);                     // pick one of the four puffs
        vUv = (uv + vec2(mod(cell, 2.0), floor(cell / 2.0))) * 0.5;
        vec3 wp = iPos; wp.y += sin(uTime * 0.12 + iSS.y * 40.0) * 1.6; wp.x += sin(uTime * 0.03 + iSS.y * 17.0) * 6.0;
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        vec2 off = vec2(position.x, position.y * 0.74) * iSS.x;
        mv.xy += off;
        vWY = wp.y + off.x * uCamY.x + off.y * uCamY.y;         // world height of this corner
        vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec2 vUv; varying float vD; varying float vWY; uniform sampler2D uMap; uniform vec3 uLit; uniform vec3 uShade; uniform vec3 uFar;
      void main(){ vec4 t = texture2D(uMap, vUv); if (t.a < 0.012) discard;
        vec3 c = mix(uShade, uLit, smoothstep(0.42, 0.98, t.r));
        c = mix(c, uFar, smoothstep(500.0, 3400.0, vD) * 0.85);
        float a = smoothstep(0.0, 0.55, t.a) * smoothstep(4.0, 45.0, vD);
        a *= smoothstep(${CLOUD_Y.toFixed(1)}, ${(CLOUD_Y + 11).toFixed(1)}, vWY);   // melt into the deck instead of being cut by it
        gl_FragColor = vec4(c, a);
        ${OUT} }`,
  }));
  puffs.frustumCulled = false; puffs.renderOrder = 5;
  group.add(puffs);

  return {
    group, uniforms: U,
    update(camera, time) {
      planet.position.copy(camera.position).addScaledVector(pDir, 3600);
      planet.material.uniforms.uSpin.value = time * 0.0012;
      sea.position.x = camera.position.x; sea.position.z = camera.position.z;
      U.uTime.value = time;
      const e = camera.matrixWorld.elements; U.uCamY.value.set(e[1], e[5]);
    },
  };
}
