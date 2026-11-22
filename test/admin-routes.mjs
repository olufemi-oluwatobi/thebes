// Every admin route, found by reading the source, must refuse strangers (401) and ordinary users (403).
//   BASE=http://localhost:8787 node test/admin-routes.mjs
import { readFileSync } from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:8787';
let pass = 0, failed = 0;
const ok = (name, cond, info = '') => { cond ? pass++ : failed++; console.log(`${cond ? '✓' : '✗'} ${name}${cond ? '' : '  ' + String(info).slice(0, 300)}`); };
const TAG = Date.now().toString(36);
function person() {
  const jar = new Map();
  const req = async (p, opts = {}) => {
    const r = await fetch(BASE + p, { redirect: 'manual', ...opts, headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...(typeof opts.body === 'string' ? { 'content-type': 'application/json' } : {}), ...(opts.headers || {}) } });
    for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const [k, ...v] = kv.split('='); v.join('=') ? jar.set(k.trim(), v.join('=')) : jar.delete(k.trim()); }
    return r;
  };
  const j = async (p, opts) => { const r = await req(p, opts); const b = await r.json().catch(() => ({})); return { status: r.status, body: b, ...b }; };
  const call = (m) => (p, b) => j(p, { method: m, body: JSON.stringify(b || {}) });
  const up = (p, bytes, type) => j(p, { method: 'POST', body: bytes, headers: { 'content-type': type } });
  return { req, get: (p) => j(p), post: call('POST'), put: call('PUT'), patch: call('PATCH'), del: (p) => j(p, { method: 'DELETE' }), up };
}
async function signIn(who, email) { const s = await who.post('/api/auth/start', { email }); const l = new URL(s.body.link); return (await who.req(l.pathname + l.search)).status === 302; }

const routes = [];
for (const f of ['src/worker.js', 'src/squad-routes.js']) {
  const src = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  for (const m of src.matchAll(/app\.(get|post|put|patch|delete)\(\s*['`](\/api\/admin\/[^'`]+)['`]/g)) routes.push([m[1].toUpperCase(), m[2]]);
}
const fill = (p) => p.replace(/:(\w+)\{[^}]*\}/g, (_, k) => (k === 'kind' ? 'users' : k === 'act' ? 'verify' : k === 'name' ? 'users' : 'x')).replace(/:(\w+)/g, (_, k) => (k === 'kind' ? 'users' : k === 'name' ? 'users' : 'x'));
ok(`found the admin routes (${routes.length})`, routes.length >= 15, routes.length);

const anon = person(), user = person(), admin = person();
ok('people sign in', (await Promise.all([signIn(user, `ar-${TAG}@ex.com`), signIn(admin, 'admin@thebes.local')])).every(Boolean));
const send = (who, [m, p]) => who.req(fill(p), { method: m, ...(m === 'GET' ? {} : { body: '{}' }) });
const bad = { anon: [], user: [] };
for (const r of routes) {
  if ((await send(anon, r)).status !== 401) bad.anon.push(r.join(' '));
  if ((await send(user, r)).status !== 403) bad.user.push(r.join(' '));
}
ok('signed out: every admin route says 401', !bad.anon.length, bad.anon.join(', '));
ok('ordinary user: every admin route says 403', !bad.user.length, bad.user.join(', '));
// unknown admin paths are refused before routing, too
ok('an unknown admin path refuses a stranger', (await anon.req('/api/admin/nope/nothing')).status === 401);
ok('an unknown admin path refuses a user', (await user.req('/api/admin/nope/nothing', { method: 'POST', body: '{}' })).status === 403);
ok('an admin gets in', (await admin.get('/api/admin/squad/overview')).status === 200);

// a blocked admin loses access at once: their session stops working
const boss = person(), email = `boss-${TAG}@ex.com`;
await signIn(boss, email);
const id = (await boss.get('/api/me')).body?.user?.id;
ok('promote a second admin', (await admin.post(`/api/admin/squad/users/${id}/role`, { role: 'admin' })).status === 200);
ok('the new admin gets in', (await boss.get('/api/admin/squad/overview')).status === 200);
ok('block them', (await admin.post(`/api/admin/squad/users/${id}`, { action: 'block' })).ok === true);
ok('a blocked admin is shut out', (await boss.get('/api/admin/squad/overview')).status === 401);

console.log(`\n${pass} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
