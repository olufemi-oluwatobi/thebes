// Admin console: overview, tables, a user in full, roles, blocking and wallet adjustments.   BASE=http://localhost:8787 node test/squad-admin.mjs
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

// tiny real files: a 1x1 PNG, and the start of an MP4 and a WebM
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(2000, 7)]);
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(500, 3)]);

const admin = person(), sel = person(), mk = person(), nobody = person();
ok('everyone signs in', (await Promise.all([signIn(admin, 'admin@thebes.local'), signIn(sel, `as-${TAG}@ex.com`), signIn(mk, `am-${TAG}@ex.com`), signIn(nobody, `an-${TAG}@ex.com`)])).every(Boolean));
await sel.post('/api/squad/sellers', {}); await mk.post('/api/squad/marketers', { country: 'NG' });
const me = async (who) => (await who.get('/api/squad/me')).user;
const SEL = (await me(sel)).id, MK = (await me(mk)).id, NB = (await me(nobody)).id;
const P = (await sel.post('/api/squad/products', { name: 'Glow serum', description: 'A light serum for a daily glow.' })).product.id;
const O = (await sel.post('/api/squad/offers', { product_id: P, offer_type: 'traffic', title: `Admin test ${TAG}`, terms: { rate_cents: 10 }, status: 'open' })).offer.id;

// ---------- only admins ----------
for (const path of ['/api/admin/squad/overview', '/api/admin/squad/table/users', `/api/admin/squad/users/${SEL}`])
  ok('non-admins are refused: ' + path.split('/').slice(4).join('/'), (await sel.get(path)).status === 403);
ok('a non-admin cannot make themselves admin', (await sel.post(`/api/admin/squad/users/${SEL}/role`, { role: 'admin' })).status === 403);

// ---------- overview and tables ----------
let r = await admin.get('/api/admin/squad/overview');
ok('the overview counts things', r.users?.n >= 3 && r.offers?.n >= 1 && typeof r.in_wallets === 'number', JSON.stringify(r.body).slice(0, 300));
r = await admin.get(`/api/admin/squad/table/users?q=as-${TAG}`);
ok('users can be searched', r.rows?.length === 1 && r.rows[0].id === SEL && r.rows[0].seller_id, JSON.stringify(r.body).slice(0, 300));
ok('users can be filtered to sellers', (await admin.get('/api/admin/squad/table/users?status=sellers')).rows.every((x) => x.seller_id));
r = await admin.get(`/api/admin/squad/table/offers?q=${TAG}`);
ok('offers show who listed them', r.rows?.[0]?.id === O && r.rows[0].seller === `as-${TAG}@ex.com` && r.rows[0].type === 'Drive traffic', JSON.stringify(r.body).slice(0, 300));
ok('an unknown table is refused', (await admin.get('/api/admin/squad/table/sessions')).status === 404);
ok('an unknown filter is refused', (await admin.get('/api/admin/squad/table/users?status=rich')).status === 400);

// ---------- roles ----------
ok('an admin makes someone an admin', (await admin.post(`/api/admin/squad/users/${NB}/role`, { role: 'admin' })).role === 'admin');
ok('the new admin can open the console', (await nobody.get('/api/admin/squad/overview')).status === 200);
ok('and the role can be taken away', (await admin.post(`/api/admin/squad/users/${NB}/role`, { role: 'user' })).role === 'user' && (await nobody.get('/api/admin/squad/overview')).status === 403);
const ADM = (await me(admin)).id;
ok('an admin cannot remove their own admin role', (await admin.post(`/api/admin/squad/users/${ADM}/role`, { role: 'user' })).status === 409);

// ---------- wallets ----------
r = await admin.post(`/api/admin/squad/users/${SEL}/adjust`, { amount_cents: 2500, note: 'Bank transfer, ref 991' });
ok('an admin credits a wallet with a reason', r.balance?.USD === 2500, JSON.stringify(r.body));
ok('a reason is required', (await admin.post(`/api/admin/squad/users/${SEL}/adjust`, { amount_cents: 100 })).status === 400);
ok('a wallet cannot be taken below zero', (await admin.post(`/api/admin/squad/users/${SEL}/adjust`, { amount_cents: -3000, note: 'mistake' })).status === 409);
ok('a correction takes money back', (await admin.post(`/api/admin/squad/users/${SEL}/adjust`, { amount_cents: -500, note: 'double credit' })).balance?.USD === 2000);
r = await admin.get(`/api/admin/squad/users/${SEL}`);
ok('one user in full: profile, offers, wallet', r.user?.email === `as-${TAG}@ex.com` && r.seller && r.offers.some((o) => o.id === O) && r.balance.USD === 2000 && r.entries.length === 2 && r.entries[0].kind === 'adjust', JSON.stringify(r.body).slice(0, 300));
ok('transactions can be filtered', (await admin.get(`/api/admin/squad/table/transactions?status=adjust&q=as-${TAG}`)).rows.length === 2);
ok('the seller sees the credit', (await sel.get('/api/squad/wallet')).balance.USD === 2000);

// ---------- blocking ----------
ok('an admin removes an offer', (await admin.post(`/api/admin/squad/offers/${O}`, { action: 'block' })).status === 200);
ok('it leaves the feed', !(await nobody.get('/api/squad/offers?limit=100')).offers.some((o) => o.id === O));
await admin.post(`/api/admin/squad/users/${MK}`, { action: 'block' });
ok('a blocked user is signed out', (await mk.get('/api/squad/me')).status === 401);
ok('blocked users can be listed', (await admin.get('/api/admin/squad/table/users?status=blocked')).rows.some((x) => x.id === MK));
await admin.post(`/api/admin/squad/users/${MK}`, { action: 'unblock' });

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
