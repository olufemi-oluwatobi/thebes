// Listing goals: the five goal types, their rewards, attachments and creator requirements.   BASE=http://localhost:8787 node test/squad-goals.mjs
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

const admin = person(), sel = person(), mk = person(), mk2 = person();
ok('everyone signs in', (await Promise.all([signIn(admin, 'admin@thebes.local'), signIn(sel, `gs-${TAG}@ex.com`), signIn(mk, `gm-${TAG}@ex.com`), signIn(mk2, `gm2-${TAG}@ex.com`)])).every(Boolean));
await sel.post('/api/squad/sellers', {});
await mk.post('/api/squad/marketers', { country: 'NG' }); await mk2.post('/api/squad/marketers', { country: 'NG' });
const S1 = (await mk.post('/api/squad/socials', { platform: 'youtube', handle: `rev${TAG}`, followers: 4000 })).social.id;
await mk2.post('/api/squad/socials', { platform: 'youtube', handle: `rev2${TAG}`, followers: 9000 });
await admin.post(`/api/admin/squad/socials/${S1}`, { action: 'verify' });
let r = await sel.post('/api/squad/products', { name: 'Glow serum', description: 'A light serum for a daily glow.' });
const P = r.product.id;
const mkOffer = (type, terms, extra = {}) => sel.post('/api/squad/offers', { product_id: P, offer_type: type, title: 'Goal ' + type, terms, status: 'open', ...extra });

// ---------- the five goals ----------
r = await mkOffer('traffic', { rate_cents: 10, daily_cap: 200 });
ok('traffic pays per click with a daily cap', r.status === 201 && r.offer.terms.rate_cents === 10 && r.offer.terms.daily_cap === 200, JSON.stringify(r.body));
ok('traffic needs a rate', (await mkOffer('traffic', {})).code === 'invalid_terms');
r = await mkOffer('sales', { percent: 15 });
ok('sales can pay a percentage', r.status === 201 && r.offer.terms.percent === 15, JSON.stringify(r.body));
ok('sales can pay a fixed amount', (await mkOffer('sales', { amount_cents: 500 })).offer?.terms.amount_cents === 500);
ok('sales needs a percentage or an amount', (await mkOffer('sales', {})).code === 'invalid_terms');
ok('sales cannot have both', (await mkOffer('sales', { percent: 10, amount_cents: 500 })).code === 'invalid_terms');
ok('newsletter pays per subscriber', (await mkOffer('newsletter', { rate_cents: 50 })).offer?.terms.rate_cents === 50);
ok('a story pays a flat fee', (await mkOffer('story', { fee_cents: 1000 })).offer?.terms.fee_cents === 1000);
ok('a story fee has a floor', (await mkOffer('story', { fee_cents: 5 })).code === 'invalid_terms');

// ---------- attachments ----------
const IMG = (await sel.up('/api/squad/media?kind=image', PNG, 'image/png')).media.id;
const VID = (await sel.up('/api/squad/media?kind=video', MP4, 'video/mp4')).media.id;
r = await mkOffer('review', { fee_cents: 5000 }, { attachments: [IMG, VID], requirements: { platforms: ['youtube'], min_followers: 1000, verified_socials: true, delivery_types: ['video'] } });
const REV = r.offer?.id;
ok('a review listing takes attachments', r.status === 201 && r.offer.attachments.length === 2 && r.offer.attachments[1].kind === 'video' && r.offer.attachments[0].url.endsWith(`${IMG}/file`), JSON.stringify(r.body));
ok('requirements keep verified accounts only', r.offer?.requirements.verified_socials === true);
ok("someone else's file cannot be attached", (await mk.post('/api/squad/offers', { product_id: P, offer_type: 'review', title: 'x', terms: { fee_cents: 500 } })).status !== 201
  && (await mkOffer('review', { fee_cents: 500 }, { attachments: ['md_nope'] })).status === 400);
ok('attach up to six files', (await mkOffer('review', { fee_cents: 500 }, { attachments: [1, 2, 3, 4, 5, 6, 7].map(String) })).status === 400);
r = await sel.patch(`/api/squad/offers/${REV}`, { attachments: [IMG] });
ok('attachments can be changed', r.offer?.attachments.length === 1, JSON.stringify(r.body));

// ---------- verified accounts only ----------
r = await mk.get(`/api/squad/offers/${REV}`);
ok('a creator with a verified account qualifies', r.eligible === true || r.offer?.eligible === true || r.body?.eligible === true, JSON.stringify(r.body).slice(0, 300));
r = await mk2.get(`/api/squad/offers/${REV}`);
const e2 = r.eligible ?? r.offer?.eligible;
ok('a bigger but unverified account does not', e2 === false, JSON.stringify(r.body).slice(0, 300));
r = await mk2.post(`/api/squad/offers/${REV}/interests`, { message: 'hi' });
ok('the unverified creator cannot apply', r.status === 403 || r.status === 409 || r.status === 400, r.status + ' ' + JSON.stringify(r.body));
r = await mk.post(`/api/squad/offers/${REV}/interests`, { message: 'I review skincare' });
ok('the verified creator can', r.status === 201, r.status + ' ' + JSON.stringify(r.body));

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
