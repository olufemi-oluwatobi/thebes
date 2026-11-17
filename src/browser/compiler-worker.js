// The compile worker: godtongue + the game engine, in the creator's browser (no server build).
// In:  { id, cmd: 'init', base } · { id, cmd: 'compile', source, vars }
// Out: { id, ok: true, r } or { id, ok: false, error }
import fs from 'node:fs';
import { compile, createRegistry } from '../../vendor/godtongue/index.js';
import game from '../../vendor/godtongue/engines/game.js';

let reg = null, ready = null, n = 0;
async function init({ base }) {
  if (!ready) ready = (async () => {
    const res = await fetch(base + 'vfs.json');
    if (!res.ok) throw new Error('could not load the game runtime (' + res.status + ')');
    globalThis.__GT_VFS = await res.json();
    reg = createRegistry();
    return { ok: true };
  })();
  ready.catch(() => { ready = null; });
  return ready;
}
async function build({ source, vars }) {
  if (!reg) throw new Error('the compiler is not ready');
  const t0 = performance.now();
  const r = compile(source, { registry: reg, baseDir: '/mem/piece', vars: vars || {} });
  const errors = (r.diagnostics || []).filter((d) => d.level === 'error');
  if (!r.ok || errors.length) return { ok: false, diagnostics: r.diagnostics };
  if (!r.doc.game) return { ok: false, diagnostics: [{ level: 'error', line: 0, msg: 'this piece plays no game' }] };
  const out = '/mem/out/' + (n++);
  await game.build(r.doc, { outDir: out });
  const html = fs.readFileSync(out + '/index.html', 'utf8'); fs.rmSync(out + '/index.html');
  return { ok: true, html, values: r.doc.game.values, ms: Math.round(performance.now() - t0) };
}
const H = { init, compile: build };
self.onmessage = async (ev) => {
  const { id, cmd, ...args } = ev.data || {};
  if (!id || !H[cmd]) return;
  try { self.postMessage({ id, ok: true, r: await H[cmd](args) }); }
  catch (e) { self.postMessage({ id, ok: false, error: String(e?.message || e) }); }
};
