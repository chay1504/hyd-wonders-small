// Real-time frame-rate benchmark of the game in headless Chrome on this machine's GPU (no virtual time).
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROFILE = process.argv[2];
const SIZE = process.argv[3] || '1280,720';
const PORT = 9337;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--no-first-run', '--disable-extensions',
  `--window-size=${SIZE}`, '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', 'about:blank',
], { stdio: 'ignore' });

try {
  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(500);
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ }
  }
  if (!target) throw new Error('Chrome did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const waiting = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; waiting.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJS = async (expression, awaitPromise = false) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
    if (r.result?.exceptionDetails) return 'EXCEPTION ' + JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
    return r.result?.result?.value;
  };

  const views = process.argv[4] ? { charminar: '20,3.5,46,0.42,-0.3', golconda: '-128,24,44,1.05,0.12' } : { charminar: '20,3.5,46,0.42,-0.3', aerial: '40,34,120,0.28,0.2', tombs: '118,9,-8,-1.2,-0.18', golconda: '-128,24,44,1.05,0.12' };
  const RAF = `new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; const t = performance.now() - t0; if (t < 4000) requestAnimationFrame(f); else res(+(n * 1000 / t).toFixed(1)); }; requestAnimationFrame(f); })`;
  const out = {};
  for (const [name, v] of Object.entries(views)) {
    await send('Page.navigate', { url: `http://localhost:8791/?shot=${v}` });
    for (let i = 0; i < 60; i++) { await sleep(500); if (await evalJS(`typeof game !== 'undefined'`)) break; }
    await sleep(5000);                                   // shader compilation and texture uploads
    const row = { gpu: await evalJS(`(() => { const gl = game.renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; })()`) };
    for (const [q, label] of [[2, 'ultra'], [1, 'high'], [0, 'fast']]) {
      await evalJS(`game.setQuality(${q}, false); game.setPixelRatio(1); 0`);
      await sleep(1500);
      row[label + '_fps_at_full_res'] = await evalJS(RAF, true);
    }
    await evalJS(`game.setQuality(2, false); 0`);
    await sleep(9000);                                   // let the adaptive scaler settle
    row.ultra_auto = { fps: await evalJS(RAF, true), pixelRatio: await evalJS('game.pixelRatio'), buffer: await evalJS(`game.renderer.domElement.width + 'x' + game.renderer.domElement.height`) };
    row.triangles = await evalJS('game.world.tris');
    out[name] = row;
  }
  console.log(JSON.stringify(out, null, 1));
  ws.close();
} catch (err) {
  console.log('BENCH FAILED: ' + err.message);
} finally {
  chrome.kill();
}
