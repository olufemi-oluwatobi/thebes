// Bachs: top-ups go through hosted checkout and only a correctly signed webhook credits them, once.
//   BASE=http://localhost:8787 node test/squad-bachs.mjs
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
import { createHmac } from 'node:crypto';
const SECRET = process.env.BACHS_WEBHOOK_SECRET || 'whsec_local_stub';
const hook = (ev, { secret = SECRET, t = Math.floor(Date.now() / 1000), v1 = true } = {}) => {
  const raw = JSON.stringify(ev), sig = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  const headers = { 'content-type': 'application/json', ...(v1 ? { 'X-Bachs-Signature-V2': `t=${t},v1=deadbeef,v1=${sig}` } : { 'X-Bachs-Timestamp': String(t), 'X-Bachs-Signature': sig }) };
  return fetch(BASE + '/api/webhooks/bachs', { method: 'POST', headers, body: raw }).then(async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) }));
};
const paid = (chk, amount = '25.00', currency = 'USD', id = 'evt_' + Math.random().toString(36).slice(2)) => ({ id, type: 'collection.succeeded', created_at: new Date().toISOString(), organization_id: 'org_x', data: { checkout_id: chk, amount, currency, charge_id: 'ch_1' } });

const sel = person();
ok('sign in', await signIn(sel, `bx-${TAG}@ex.com`));
await sel.post('/api/squad/sellers', {});
const bal = async () => ((await sel.get('/api/squad/wallet')).balance || {}).USD || 0;

let r = await sel.post('/api/squad/wallet/topups', { amount_cents: 2500 });
const TP = r.topup?.id, CHK = r.topup?.checkout_id;
ok('a top-up opens a hosted checkout', r.status === 201 && /\/api\/__bachs\/pay\/chk_/.test(r.checkout_url || ''), JSON.stringify(r.body));
ok('nothing is credited before payment', (await bal()) === 0);

ok('an unsigned webhook is refused', (await fetch(BASE + '/api/webhooks/bachs', { method: 'POST', body: JSON.stringify(paid(CHK)) })).status === 400);
ok('a wrong secret is refused', (await hook(paid(CHK), { secret: 'nope' })).status === 400);
ok('an old delivery is refused', (await hook(paid(CHK), { t: Math.floor(Date.now() / 1000) - 600 })).status === 400);
ok('still nothing credited', (await bal()) === 0);

const ev = paid(CHK);
r = await hook(ev);
ok('a signed payment is accepted', r.status === 200 && r.ok, JSON.stringify(r));
ok('the wallet is credited', (await bal()) === 2500);
ok('the same delivery again is ignored', (await hook(ev)).duplicate === true && (await bal()) === 2500);
ok('a different event for the same checkout cannot credit twice', (await hook(paid(CHK))).status === 200 && (await bal()) === 2500);
ok('the older signature headers work too', (await hook(paid('chk_none'), { v1: false })).status === 200);

// paid less than asked: credit what was collected
r = await sel.post('/api/squad/wallet/topups', { amount_cents: 4000 });
await hook(paid(r.topup.checkout_id, '30.00'));
ok('credits what was actually paid', (await bal()) === 5500);

// wrong currency: no credit, left for an admin
r = await sel.post('/api/squad/wallet/topups', { amount_cents: 1000 });
const T3 = r.topup.id;
await hook(paid(r.topup.checkout_id, '10.00', 'EUR'));
ok('a currency mismatch credits nothing', (await bal()) === 5500);

// expired checkout cancels the waiting top-up
r = await sel.post('/api/squad/wallet/topups', { amount_cents: 1500 });
const T4 = r.topup.id, C4 = r.topup.checkout_id;
await hook({ id: 'evt_exp_' + T4, type: 'checkout.expired', data: { checkout_id: C4 } });
const w = await sel.get('/api/squad/wallet');
ok('an expired checkout drops off the waiting list', !w.topups.some((t) => t.id === T4) && w.topups.some((t) => t.id === T3));

// the admin "money received" button cannot double-credit a top-up Bachs already paid
const admin = person(); await signIn(admin, 'admin@thebes.local');
const again = await admin.post(`/api/admin/squad/topups/${TP}/credit`);
ok('an admin cannot re-credit a paid top-up', again.status >= 400 && (await bal()) === 5500, JSON.stringify(again.body));

console.log(`\n${pass} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
