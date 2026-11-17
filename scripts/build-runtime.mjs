// Builds what the browser needs to make games, so nothing is ever built on a server:
//   public/runtime/compiler.worker.js  godtongue + the game engine, as a web worker
//   public/runtime/vfs.json            the files they read: engine, game runtime, word list, styles, fonts
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GT = path.join(ROOT, 'vendor', 'godtongue');
const OUT = path.join(ROOT, 'public', 'runtime');
fs.mkdirSync(OUT, { recursive: true });
const shim = (f) => path.join(ROOT, 'shims', f);

// godtongue finds its files from import.meta.url; give each module its real path so it matches vfs.json
const metaUrl = { name: 'meta-url', setup(b) { b.onLoad({ filter: /\.js$/ }, async (a) => {
  if (!a.path.startsWith(GT)) return;
  return { contents: fs.readFileSync(a.path, 'utf8').replaceAll('import.meta.url', JSON.stringify('file://' + a.path)), loader: 'js' };
}); } };
await esbuild.build({
  entryPoints: [path.join(ROOT, 'src', 'browser', 'compiler-worker.js')], bundle: true, format: 'iife', platform: 'browser',
  outfile: path.join(OUT, 'compiler.worker.js'), minify: true, logLevel: 'error', plugins: [metaUrl], inject: [shim('globals.js')],
  alias: { 'node:fs': shim('shim-fs.js'), 'node:path': 'path-browserify', 'node:url': shim('shim-url.js'), 'node:crypto': shim('shim-crypto.js'), 'node:child_process': shim('shim-cp.js') },
});

const files = {}, dirs = {};
const add = (p) => { files[p] = fs.readFileSync(p).toString('base64'); };
const list = (d, keep = () => true) => { const names = fs.readdirSync(d).filter(keep); dirs[d] = names; return names; };
add(path.join(GT, 'web', 'engine.js'));
for (const f of list(path.join(GT, 'web', 'games'))) add(path.join(GT, 'web', 'games', f));
for (const f of list(path.join(GT, 'styles'), (f) => f.endsWith('.gt'))) add(path.join(GT, 'styles', f));
const fonts = path.join(ROOT, 'vendor', 'fancard-complete', 'fancard-studio', 'fonts');
list(fonts);
for (const fam of fs.readdirSync(fonts)) {
  dirs[path.join(fonts, fam)] = ['files'];
  const d = path.join(fonts, fam, 'files');
  for (const f of list(d, (f) => f.endsWith('.woff2') && f.includes('-latin-') && !f.includes('-latin-ext-'))) add(path.join(d, f));
}
fs.writeFileSync(path.join(OUT, 'vfs.json'), JSON.stringify({ root: GT, files, dirs }));
const kb = (f) => Math.round(fs.statSync(path.join(OUT, f)).size / 1024) + ' KB';
console.log(`runtime: compiler.worker.js ${kb('compiler.worker.js')}, vfs.json ${kb('vfs.json')}`);
