// Wallets: top-ups, holding the budget per interest, job done, refunds and payouts.   BASE=http://localhost:8787 node test/squad-wallet.mjs
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

const admin = person(), sel = person(), mk = person(), mk2 = person(), mk3 = person();
ok('everyone signs in', (await Promise.all([signIn(admin, 'admin@thebes.local'), signIn(sel, `ws-${TAG}@ex.com`), signIn(mk, `wm-${TAG}@ex.com`), signIn(mk2, `wm2-${TAG}@ex.com`), signIn(mk3, `wm3-${TAG}@ex.com`)])).every(Boolean));
await sel.post('/api/squad/sellers', {});
for (const m of [mk, mk2, mk3]) await m.post('/api/squad/marketers', { country: 'NG' });
const bal = async (who) => ((await who.get('/api/squad/wallet')).balance || {}).USD || 0;

// ---------- top-ups ----------
ok('a new wallet is empty', (await bal(sel)) === 0);
let r = await sel.post('/api/squad/wallet/topups', { amount_cents: 10000 });
const TP = r.topup?.id;
ok('a seller asks to top up', r.status === 201 && /^GS-\d{8}$/.test(r.topup.reference), JSON.stringify(r.body));
ok('a pending top-up is not money yet', (await bal(sel)) === 0 && (await sel.get('/api/squad/wallet')).topups.length === 1);
ok('only an admin credits it', (await sel.post(`/api/admin/squad/topups/${TP}/credit`)).status === 403);
ok('an admin credits it', (await admin.post(`/api/admin/squad/topups/${TP}/credit`)).ok === true);
ok('the wallet shows it', (await bal(sel)) === 10000);
ok('it cannot be credited twice', (await admin.post(`/api/admin/squad/topups/${TP}/credit`)).status === 404 && (await bal(sel)) === 10000);

// ---------- holding the budget per interest ----------
const P = (await sel.post('/api/squad/products', { name: 'Glow serum', description: 'A light serum for a daily glow.' })).product.id;
r = await sel.post('/api/squad/offers', { product_id: P, offer_type: 'review', title: 'Review Glow', terms: { fee_cents: 5000 }, job_budget_cents: 5000, status: 'open' });
const O = r.offer?.id;
ok('an offer has a budget per interest', r.offer?.job_budget_cents === 5000, JSON.stringify(r.body));
const apply = async (m) => (await m.post(`/api/squad/offers/${O}/interests`, {})).interest.id;
const [I1, I2, I3] = [await apply(mk), await apply(mk2), await apply(mk3)];
r = await sel.post(`/api/squad/interests/${I1}/accept`);
const R1 = r.relationship?.id;
ok('accepting holds budget + fee from the wallet', !!R1 && (await bal(sel)) === 10000 - 5000 - 250, JSON.stringify(r.body));
let w = await sel.get('/api/squad/wallet');
ok('the wallet shows what is held', w.held.USD === 5000 && w.holds[0]?.relationship_id === R1 && w.entries.some((e) => e.kind === 'fee' && e.amount_cents === -250));
ok('the marketer sees money on the way', (await mk.get('/api/squad/wallet')).incoming.USD === 5000);
r = await sel.post(`/api/squad/interests/${I2}/accept`);
ok('not enough money: nothing happens', r.status === 402 && r.code === 'insufficient_funds', JSON.stringify(r.body));
ok('the interest stays pending and no deal is made', (await sel.get(`/api/squad/interests/${I2}`)).interest.status === 'pending' && (await bal(sel)) === 4750);
await admin.post(`/api/admin/squad/topups/${(await sel.post('/api/squad/wallet/topups', { amount_cents: 1000 })).topup.id}/credit`);
const [a2, a3] = await Promise.all([sel.post(`/api/squad/interests/${I2}/accept`), sel.post(`/api/squad/interests/${I3}/accept`)]);
ok('two accepts at once cannot overspend', [a2, a3].filter((x) => x.status === 201).length === 1 && [a2, a3].filter((x) => x.status === 402).length === 1 && (await bal(sel)) === 500, a2.status + ' ' + a3.status);
ok('a wallet never goes below zero', (await sel.get('/api/squad/wallet')).entries.reduce((n, e) => n + e.amount_cents, 0) >= 0);

// ---------- job done, cancelled ----------
const holds = (await admin.get('/api/admin/squad/money')).holds;
ok('admins see the held jobs', holds.length >= 2);
const H1 = holds.find((h) => h.relationship_id === R1).id;
ok('only an admin finishes a job', (await sel.post(`/api/admin/squad/holds/${H1}/release`)).status === 403);
r = await admin.post(`/api/admin/squad/holds/${H1}/release`, { note: 'video is up' });
ok('job done: the marketer is credited', r.hold?.status === 'released' && (await bal(mk)) === 5000, JSON.stringify(r.body));
ok('a finished job cannot be finished again', (await admin.post(`/api/admin/squad/holds/${H1}/release`)).status === 404 && (await bal(mk)) === 5000);
const H2 = (await sel.get('/api/squad/wallet')).holds[0].id;
const before = await bal(sel);
await admin.post(`/api/admin/squad/holds/${H2}/refund`, { note: 'never delivered' });
ok('a cancelled job gives budget and fee back', (await bal(sel)) === before + 5250);

// ---------- payouts ----------
ok('cannot withdraw more than you have', (await mk.post('/api/squad/wallet/payouts', { amount_cents: 6000, method: 'bank', details: 'GTBank 0123456789 Ama Mensah' })).status === 402);
r = await mk.post('/api/squad/wallet/payouts', { amount_cents: 3000, method: 'bank', details: 'GTBank 0123456789 Ama Mensah' });
const PO = r.payout?.id;
ok('a marketer withdraws', r.status === 201 && (await bal(mk)) === 2000, JSON.stringify(r.body));
const PO2 = (await mk.post('/api/squad/wallet/payouts', { amount_cents: 2000, method: 'mobile_money', details: 'MTN 024 000 0000' })).payout.id;
ok('the balance is now zero', (await bal(mk)) === 0);
await admin.post(`/api/admin/squad/payouts/${PO}/paid`);
await admin.post(`/api/admin/squad/payouts/${PO2}/cancel`, { note: 'wrong number' });
ok('a cancelled payout comes back', (await bal(mk)) === 2000);
w = await mk.get('/api/squad/wallet');
ok('the history adds up to the balance', w.entries.reduce((n, e) => n + e.amount_cents, 0) === w.balance.USD && w.payouts.find((p) => p.id === PO)?.status === 'paid');

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
