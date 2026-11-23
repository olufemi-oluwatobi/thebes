// Stripe: the admin switch, Checkout top-ups, and a signed webhook that credits exactly once.   BASE=http://localhost:8787 node test/squad-stripe.mjs
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
const SECRET = 'whsec_stripe_local_stub';
const hook = (ev, { secret = SECRET, t = Math.floor(Date.now() / 1000) } = {}) => {
  const raw = JSON.stringify(ev), sig = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  return fetch(BASE + '/api/webhooks/stripe', { method: 'POST', headers: { 'content-type': 'application/json', 'Stripe-Signature': `t=${t},v1=${sig},v0=ignored` }, body: raw }).then(async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) }));
};
const rid = () => 'evt_' + Math.random().toString(36).slice(2);
const sess = (type, id, extra = {}) => ({ id: rid(), object: 'event', type, data: { object: { id, object: 'checkout.session', amount_total: 2500, currency: 'usd', payment_status: 'paid', ...extra } } });

const sel = person(), boss = person();
ok('sign in', await signIn(sel, `sx-${TAG}@ex.com`) && await signIn(boss, 'admin@thebes.local'));
await sel.post('/api/squad/sellers', {});
const bal = async () => ((await sel.get('/api/squad/wallet')).balance || {}).USD || 0;

let r = await boss.get('/api/admin/squad/settings/payments');
ok('the admin sees all three providers', r.available?.length === 3 && r.available.every((p) => p.ready), JSON.stringify(r.body));
ok('a seller cannot see or change the switch', (await sel.get('/api/admin/squad/settings/payments')).status === 403 && (await sel.post('/api/admin/squad/settings/payments', { provider: 'manual' })).status === 403);
ok('an unknown provider is refused', (await boss.post('/api/admin/squad/settings/payments', { provider: 'paypal' })).status === 400);
ok('switch to Stripe', (await boss.post('/api/admin/squad/settings/payments', { provider: 'stripe' })).active === 'stripe');

r = await sel.post('/api/squad/wallet/topups', { amount_cents: 2500 });
const CS = r.topup?.checkout_id;
ok('a top-up opens Stripe Checkout', r.status === 201 && /^cs_test_/.test(CS || '') && /__stripe\/pay/.test(r.checkout_url || ''), JSON.stringify(r.body));
ok('a bad signature is refused', (await hook(sess('checkout.session.completed', CS), { secret: 'nope' })).status === 400);
ok('an unsigned call is refused', (await fetch(BASE + '/api/webhooks/stripe', { method: 'POST', body: '{}' })).status === 400);
ok('nothing credited yet', (await bal()) === 0);

ok('completed but unpaid waits', (await hook(sess('checkout.session.completed', CS, { payment_status: 'unpaid' }))).ok && (await bal()) === 0);
const ev = sess('checkout.session.async_payment_succeeded', CS);
ok('settled payment is credited', (await hook(ev)).ok && (await bal()) === 2500);
ok('the same event again is ignored', (await hook(ev)).duplicate === true && (await bal()) === 2500);
ok('another paid event cannot credit twice', (await hook(sess('checkout.session.completed', CS))).ok && (await bal()) === 2500);

r = await sel.post('/api/squad/wallet/topups', { amount_cents: 1000 });
await hook(sess('checkout.session.completed', r.topup.checkout_id, { amount_total: 1000, currency: 'eur' }));
ok('wrong currency credits nothing', (await bal()) === 2500);

r = await sel.post('/api/squad/wallet/topups', { amount_cents: 700 });
const T = r.topup.id;
await hook(sess('checkout.session.expired', r.topup.checkout_id, { payment_status: 'unpaid' }));
ok('an expired session cancels the top-up', !(await sel.get('/api/squad/wallet')).topups.some((x) => x.id === T));

ok('switch to manual', (await boss.post('/api/admin/squad/settings/payments', { provider: 'manual' })).active === 'manual');
r = await sel.post('/api/squad/wallet/topups', { amount_cents: 500 });
ok('manual top-ups have no checkout', r.status === 201 && !r.checkout_url);
await boss.post('/api/admin/squad/settings/payments', { provider: 'bachs' });

console.log(`\n${pass} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
