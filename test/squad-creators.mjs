// Creator profiles: details, bio-code account checks, work stats, ratings and the application page.   BASE=http://localhost:8787 node test/squad-creators.mjs
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

const admin = person(), sel = person(), sel2 = person(), mk = person(), other = person();
ok('everyone signs in', (await Promise.all([signIn(admin, 'admin@thebes.local'), signIn(sel, `cs-${TAG}@ex.com`), signIn(sel2, `cs2-${TAG}@ex.com`), signIn(mk, `cm-${TAG}@ex.com`), signIn(other, `co-${TAG}@ex.com`)])).every(Boolean));
await sel.post('/api/squad/sellers', {}); await sel2.post('/api/squad/sellers', {});

// ---------- details ----------
let r = await mk.post('/api/squad/marketers', { country: 'NG', city: 'Lagos', niches: ['Beauty', 'Food', 'Beauty'], languages: ['English', 'Yoruba'] });
const M = r.marketer?.id;
ok('a creator sets niches and languages', r.status === 201 && r.marketer.niches.join() === 'Beauty,Food' && r.marketer.languages.length === 2, JSON.stringify(r.body));
ok('niches are limited', (await mk.post('/api/squad/marketers', { niches: Array.from({ length: 9 }, (_, i) => 'n' + i) })).status === 400);
ok('details can be changed', (await mk.post('/api/squad/marketers', { niches: ['Tech'] })).marketer?.niches.join() === 'Tech');

// ---------- account check with a bio code ----------
const S = (await mk.post('/api/squad/socials', { platform: 'instagram', handle: `cr${TAG}`, followers: 4200 })).social.id;
r = await mk.post(`/api/squad/socials/${S}/verify`, {});
const CODE = r.social?.verify_code;
ok('a creator gets a bio code', /^gs-\d{6}$/.test(CODE || '') && r.body.status === 'code', JSON.stringify(r.body));
ok('the code stays the same', (await mk.post(`/api/squad/socials/${S}/verify`, {})).social?.verify_code === CODE);
r = await mk.post(`/api/squad/socials/${S}/verify`, { placed: true });
ok('they say it is in their bio', r.body.status === 'requested' && r.social.verify_requested_at > 0);
ok("nobody else can ask for the code", (await other.post(`/api/squad/socials/${S}/verify`, {})).status >= 400);
ok('the public profile does not show the code', !JSON.stringify((await other.get(`/api/squad/marketers/${M}`)).body).includes(CODE));
await admin.post(`/api/admin/squad/socials/${S}`, { action: 'verify', note: 'code found' });
r = await mk.get('/api/squad/socials');
const so = r.socials.find((x) => x.id === S);
ok('verifying records the follower count we saw', so.is_verified && so.verified_followers === 4200 && !so.verify_requested_at, JSON.stringify(so));

// ---------- an application, the page for it, and work stats ----------
const P = (await sel.post('/api/squad/products', { name: 'Glow serum', description: 'A light serum for a daily glow.' })).product.id;
const O = (await sel.post('/api/squad/offers', { product_id: P, offer_type: 'story', title: 'Story about Glow', terms: { fee_cents: 1000 }, status: 'open' })).offer.id;
r = await mk.post(`/api/squad/offers/${O}/interests`, { social_id: S });
const I = r.interest?.id;
ok('a creator applies without a note', r.status === 201, JSON.stringify(r.body));
r = await sel.get(`/api/squad/interests/${I}`);
ok('the seller opens the application', r.status === 200 && r.interest.offer.type === 'story' && r.interest.social.verified_followers === 4200 && r.interest.marketer_id === M, JSON.stringify(r.body));
ok('the creator can see their own application', (await mk.get(`/api/squad/interests/${I}`)).status === 200);
ok('another seller cannot', (await sel2.get(`/api/squad/interests/${I}`)).status === 404);
r = await sel.post(`/api/squad/interests/${I}/accept`, {});
const R = r.relationship?.id;
ok('the seller accepts', !!R, JSON.stringify(r.body));
const D = (await mk.post(`/api/squad/relationships/${R}/deliveries`, { delivery_type: 'social_post', social_id: S, proof_url: 'https://instagram.com/p/abc' })).delivery?.id;
await sel.post(`/api/squad/deliveries/${D}/verify`, { amount_cents: 1000 });

// ---------- ratings ----------
ok('the creator cannot rate their own deal', (await mk.put(`/api/squad/relationships/${R}/rating`, { stars: 5 })).status === 403);
ok('stars are 1 to 5', (await sel.put(`/api/squad/relationships/${R}/rating`, { stars: 6 })).status === 400);
r = await sel.put(`/api/squad/relationships/${R}/rating`, { stars: 4, note: 'On time' });
ok('the seller rates the deal', r.rating?.stars === 4, JSON.stringify(r.body));
ok('and can change it', (await sel.put(`/api/squad/relationships/${R}/rating`, { stars: 5, note: 'Great story' })).rating?.stars === 5);
ok('the rating can be read back', (await sel.get(`/api/squad/relationships/${R}/rating`)).rating?.note === 'Great story');
r = await other.get(`/api/squad/marketers/${M}`);
const st = r.stats || {};
ok('the profile shows work stats', st.deals === 1 && st.approved_results === 1 && st.approval_rate === 100 && st.by_delivery[0]?.slug === 'social_post' && st.by_goal[0]?.slug === 'story', JSON.stringify(st));
ok('and the rating', st.rating?.average === 5 && st.rating.count === 1 && r.reviews[0]?.note === 'Great story', JSON.stringify(r.body).slice(0, 400));

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
