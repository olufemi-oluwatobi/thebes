// Media, product categories, offer budgets and funding.   BASE=http://localhost:8787 node test/squad-media.mjs
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

const admin = person(), sel = person(), sel2 = person(), mk = person(), mk2 = person(), anon = person();
ok('everyone signs in', (await Promise.all([signIn(admin, 'admin@thebes.local'), signIn(sel, `ms-${TAG}@ex.com`), signIn(sel2, `ms2-${TAG}@ex.com`), signIn(mk, `mm-${TAG}@ex.com`), signIn(mk2, `mm2-${TAG}@ex.com`)])).every(Boolean));
await sel.post('/api/squad/sellers', {}); await sel2.post('/api/squad/sellers', {});
await mk.post('/api/squad/marketers', { country: 'NG' }); await mk2.post('/api/squad/marketers', { country: 'GH' });
const SOC = (await mk.post('/api/squad/socials', { platform: 'youtube', handle: `ada${TAG}`, followers: 5000 })).social.id;

// ---------- categories ----------
let r = await sel.post('/api/squad/products', { name: 'Notely app', description: 'A note app for busy people, on web and mobile.', category: 'software' });
const P = r.product?.id;
ok('a product can be software', r.status === 201 && r.product.category === 'software', JSON.stringify(r.body));
ok('category defaults to physical', (await sel.post('/api/squad/products', { name: 'Hot sauce', description: 'Small batch scotch bonnet sauce.' })).product.category === 'physical');
ok('an unknown category is refused', (await sel.post('/api/squad/products', { name: 'X thing', description: 'Some description here.', category: 'weapons' })).status === 400);
ok('category can be changed', (await sel.patch(`/api/squad/products/${P}`, { category: 'digital' })).product?.category === 'digital');
await sel.patch(`/api/squad/products/${P}`, { category: 'software' });

// ---------- uploads ----------
ok('uploads need a sign-in', (await anon.up('/api/squad/media?kind=image', PNG, 'image/png')).status === 401);
ok('a marketer cannot upload product images', (await mk.up('/api/squad/media?kind=image', PNG, 'image/png')).code === 'no_seller');
r = await sel.up('/api/squad/media?kind=image&width=1&height=1&caption=Home%20screen', PNG, 'image/png');
const IMG = r.media?.id;
ok('a seller uploads a placement image', r.status === 201 && r.media.mime === 'image/png' && r.media.width === 1 && r.media.caption === 'Home screen', JSON.stringify(r.body));
ok('a renamed file is caught by its bytes', (await sel.up('/api/squad/media?kind=image', Buffer.from('<script>alert(1)</script>'), 'image/png')).status === 415);
ok('a video is not an image', (await sel.up('/api/squad/media?kind=image', MP4, 'video/mp4')).status === 415);
ok('an image is not a video', (await sel.up('/api/squad/media?kind=video', PNG, 'image/png')).status === 415);
ok('an empty file is refused', (await sel.up('/api/squad/media?kind=image', Buffer.alloc(0), 'image/png')).status === 400);
ok('images are limited to 5 MB', (await sel.up('/api/squad/media?kind=image', Buffer.concat([PNG, Buffer.alloc(5 * 1048576)]), 'image/png')).status === 413);
ok('an unknown kind is refused', (await sel.up('/api/squad/media?kind=audio', PNG, 'image/png')).status === 400);
r = await sel.up('/api/squad/media?kind=video&duration_ms=15000', MP4, 'video/mp4');
const VID = r.media?.id;
ok('a seller uploads a product video', r.status === 201 && r.media.kind === 'video' && r.media.duration_ms === 15000, JSON.stringify(r.body));
r = await sel.up(`/api/squad/media?kind=video&poster_media_id=${IMG}`, WEBM, 'video/webm');
ok('a video can have a poster image', r.media?.poster?.endsWith(`${IMG}/file`), JSON.stringify(r.body));
ok('a poster must be your own image', (await sel2.up(`/api/squad/media?kind=video&poster_media_id=${IMG}`, WEBM, 'video/webm')).status === 400);

// ---------- serving ----------
let f = await anon.req(`/api/squad/media/${IMG}/file`);
ok('a product image is public', f.status === 200 && f.headers.get('content-type') === 'image/png' && Buffer.from(await f.arrayBuffer()).equals(PNG));
ok('files are served as-is with nosniff', f.headers.get('x-content-type-options') === 'nosniff');
f = await anon.req(`/api/squad/media/${VID}/file`, { headers: { range: 'bytes=0-9' } });
ok('videos support Range', f.status === 206 && f.headers.get('content-range')?.startsWith('bytes 0-9/') && (await f.arrayBuffer()).byteLength === 10, f.status);
f = await anon.req(`/api/squad/media/${VID}/file`, { headers: { range: 'bytes=99999999-' } });
ok('a range past the end is refused', f.status === 416);
ok('an unknown file is a 404', (await anon.get('/api/squad/media/nope/file')).status === 404);
ok('your files list shows what you uploaded', (await sel.get('/api/squad/media')).media.length >= 3);
ok('...and nobody else\'s', (await sel2.get('/api/squad/media')).media.length === 0);

// ---------- a product's gallery ----------
ok('you cannot use someone else\'s file', (await sel2.put(`/api/squad/products/${P}/media`, { items: [{ media_id: IMG }] })).status === 404);
r = await sel.put(`/api/squad/products/${P}/media`, { items: [{ media_id: IMG, role: 'screenshot' }, { media_id: VID, role: 'demo' }] });
ok('the first image becomes the cover', r.status === 200 && r.product.cover_media_id === IMG && r.product.cover.endsWith(`${IMG}/file`) && r.media[0].role === 'cover', JSON.stringify(r.body));
ok('a video cannot be a screenshot', (await sel.put(`/api/squad/products/${P}/media`, { items: [{ media_id: VID, role: 'screenshot' }] })).status === 400);
ok('an image cannot be a demo', (await sel.put(`/api/squad/products/${P}/media`, { items: [{ media_id: IMG, role: 'demo' }] })).status === 400);
ok('a file can be listed once', (await sel.put(`/api/squad/products/${P}/media`, { items: [{ media_id: IMG }, { media_id: IMG }] })).status === 400);
ok('only one cover', (await sel.put(`/api/squad/products/${P}/media`, { items: [{ media_id: IMG, role: 'cover' }, { media_id: (await sel.up('/api/squad/media?kind=image', PNG, 'image/png')).media.id, role: 'cover' }] })).status === 400);
await sel.put(`/api/squad/products/${P}/media`, { items: [{ media_id: IMG }, { media_id: VID, role: 'demo' }] });
r = await anon.get(`/api/squad/products/${P}`);
ok('the product page returns its media', r.media?.length === 2 && r.product.category === 'software');

// ---------- offers carry the picture, the video and the money ----------
const OTYPE = 'commission';
ok('a payout cap needs a budget', (await sel.post('/api/squad/offers', { product_id: P, offer_type: OTYPE, title: 'Cap no budget', terms: { percent: 20 }, payout_cap_cents: 5000 })).status === 400);
ok('the cap cannot exceed the budget', (await sel.post('/api/squad/offers', { product_id: P, offer_type: OTYPE, title: 'Big cap', terms: { percent: 20 }, budget_cents: 5000, payout_cap_cents: 9000 })).status === 400);
ok('a budget has a minimum', (await sel.post('/api/squad/offers', { product_id: P, offer_type: OTYPE, title: 'Tiny budget', terms: { percent: 20 }, budget_cents: 50 })).status === 400);
ok('currency is checked', (await sel.post('/api/squad/offers', { product_id: P, offer_type: OTYPE, title: 'Odd money', terms: { percent: 20 }, budget_cents: 5000, currency: 'XXX' })).status === 400);
ok('a video must be yours', (await sel2.post('/api/squad/offers', { product_id: (await sel2.post('/api/squad/products', { name: 'Other', description: 'Another product here.' })).product.id, offer_type: OTYPE, title: 'Steal video', terms: { percent: 20 }, video_media_id: VID })).status === 400);
ok('a budgeted offer cannot be created open', (await sel.post('/api/squad/offers', { product_id: P, offer_type: OTYPE, title: 'Open now', terms: { percent: 20 }, budget_cents: 100000, status: 'open' })).code === 'unfunded');
r = await sel.post('/api/squad/offers', { product_id: P, offer_type: OTYPE, title: 'Promote Notely', terms: { percent: 20 }, budget_cents: 100000, payout_cap_cents: 40000, currency: 'usd', video_media_id: VID });
const O = r.offer?.id, F = r.offer?.financials;
ok('a draft offer is created with its financials', r.status === 201 && F.budget_cents === 100000 && F.currency === 'USD' && F.listing_fee_cents === 5000 && F.payment_due_cents === 105000 && F.funding_status === 'unfunded' && r.offer.video.endsWith(`${VID}/file`), JSON.stringify(r.body));
ok('it cannot open until funded', (await sel.post(`/api/squad/offers/${O}/status`, { status: 'open' })).code === 'unfunded');
ok('only an admin records funding', (await sel.post(`/api/admin/squad/offers/${O}/fund`, { amount_cents: 105000 })).status === 403);
ok('funding needs an amount', (await admin.post(`/api/admin/squad/offers/${O}/fund`, {})).status === 400);
r = await admin.post(`/api/admin/squad/offers/${O}/fund`, { amount_cents: 50000 });
ok('part payment leaves it unfunded', r.offer?.financials.funded_cents === 50000 && r.offer.financials.funding_status === 'unfunded', JSON.stringify(r.body));
ok('overpaying is refused', (await admin.post(`/api/admin/squad/offers/${O}/fund`, { amount_cents: 99999 })).code === 'overpaid');
r = await admin.post(`/api/admin/squad/offers/${O}/fund`, { amount_cents: 55000 });
ok('full payment marks it funded', r.offer?.financials.funding_status === 'funded');
ok('a funded budget is locked', (await sel.patch(`/api/squad/offers/${O}`, { budget_cents: 200000 })).code === 'locked');
ok('...but the text can still change', (await sel.patch(`/api/squad/offers/${O}`, { title: 'Promote Notely today' })).offer?.title === 'Promote Notely today');
ok('now it opens', (await sel.post(`/api/squad/offers/${O}/status`, { status: 'open' })).offer?.status === 'open');

r = await anon.get('/api/squad/offers?category=software');
const feed = r.offers?.find((o) => o.id === O);
ok('the feed shows the placement image, category and money', feed && feed.product.category === 'software' && feed.product.cover.endsWith(`${IMG}/file`) && feed.financials.remaining_cents === 100000 && feed.video, JSON.stringify(r.body).slice(0, 300));
ok('the category filter works', (await anon.get('/api/squad/offers?category=physical')).offers.every((o) => o.product.category !== 'software'));
ok('an unknown category filter is refused', (await anon.get('/api/squad/offers?category=nope')).status === 400);

// ---------- deal, creator video, and drawing the budget down ----------
const IN = (await mk.post(`/api/squad/offers/${O}/interests`, { social_id: SOC, message: 'I review apps.' })).interest.id;
const REL = (await sel.post(`/api/squad/interests/${IN}/accept`, {})).relationship.id;
ok('a creator video needs a seller or marketer profile', (await person().up('/api/squad/media?kind=creator_video', MP4, 'video/mp4')).status === 401);
r = await mk.up('/api/squad/media?kind=creator_video&duration_ms=45000', MP4, 'video/mp4');
const CV = r.media?.id;
ok('a marketer uploads a creator video', r.status === 201 && r.media.kind === 'creator_video', JSON.stringify(r.body));
ok('it is private before delivery', (await anon.req(`/api/squad/media/${CV}/file`)).status === 404 && (await sel.req(`/api/squad/media/${CV}/file`)).status === 404);
ok('the owner can see it', (await mk.req(`/api/squad/media/${CV}/file`)).status === 200);
ok('a delivery cannot use someone else\'s file', (await mk2.post(`/api/squad/relationships/${REL}/deliveries`, { delivery_type: 'video', media_id: CV })).status === 404);
r = await mk.post(`/api/squad/relationships/${REL}/deliveries`, { delivery_type: 'video', social_id: SOC, media_id: CV });
const D = r.delivery?.id;
ok('a creator video counts as proof', r.status === 201 && r.delivery.media.endsWith(`${CV}/file`), JSON.stringify(r.body));
ok('the seller can now see the creator video', (await sel.req(`/api/squad/media/${CV}/file`)).status === 200);
ok('another seller cannot', (await sel2.req(`/api/squad/media/${CV}/file`)).status === 404);
ok('the admin can', (await admin.req(`/api/squad/media/${CV}/file`)).status === 200);
ok('a file used by a delivery cannot be deleted', (await mk.del(`/api/squad/media/${CV}`)).code === 'in_use');
ok('the marketer cannot verify with an amount', (await mk.post(`/api/squad/deliveries/${D}/verify`, { amount_cents: 100 })).status === 403);
ok('an amount cannot exceed the payout cap', (await sel.post(`/api/squad/deliveries/${D}/verify`, { amount_cents: 40001 })).code === 'cap_exceeded');
r = await sel.post(`/api/squad/deliveries/${D}/verify`, { amount_cents: 25000 });
ok('verifying records what it earned', r.delivery?.status === 'verified' && r.delivery.amount_cents === 25000, JSON.stringify(r.body));
r = await sel.get(`/api/squad/offers/${O}`);
ok('the budget draws down', r.offer.financials.spent_cents === 25000 && r.offer.financials.remaining_cents === 75000, JSON.stringify(r.offer.financials));
r = await mk.get(`/api/squad/relationships/${REL}`);
ok('the relationship shows what the marketer earned', r.relationship.earned_cents === 25000 && r.relationship.payout_cap_cents === 40000, JSON.stringify(r.body).slice(0, 200));
const D2 = (await mk.post(`/api/squad/relationships/${REL}/deliveries`, { delivery_type: 'video', social_id: SOC, proof_url: 'https://youtu.be/second' })).delivery.id;
ok('earnings count toward the cap', (await sel.post(`/api/squad/deliveries/${D2}/verify`, { amount_cents: 15001 })).code === 'cap_exceeded');
ok('up to the cap is fine', (await sel.post(`/api/squad/deliveries/${D2}/verify`, { amount_cents: 15000 })).delivery?.amount_cents === 15000);
ok('a negative amount is refused', (await sel.post(`/api/squad/deliveries/${(await mk.post(`/api/squad/relationships/${REL}/deliveries`, { delivery_type: 'video', social_id: SOC, proof_url: 'https://youtu.be/third' })).delivery.id}/verify`, { amount_cents: -5 })).status === 400);

// ---------- exhausting a budget ----------
const P3 = (await sel2.post('/api/squad/products', { name: 'Tiny budget app', description: 'An app with a tiny budget.', category: 'software' })).product.id;
const O3 = (await sel2.post('/api/squad/offers', { product_id: P3, offer_type: OTYPE, title: 'Tiny', terms: { percent: 10 }, budget_cents: 1000 })).offer.id;
await admin.post(`/api/admin/squad/offers/${O3}/fund`, { amount_cents: 1050 });
await sel2.post(`/api/squad/offers/${O3}/status`, { status: 'open' });
const IN3 = (await mk.post(`/api/squad/offers/${O3}/interests`, { social_id: SOC })).interest.id;
const R3 = (await sel2.post(`/api/squad/interests/${IN3}/accept`, {})).relationship.id;
const D3 = (await mk.post(`/api/squad/relationships/${R3}/deliveries`, { delivery_type: 'video', social_id: SOC, proof_url: 'https://youtu.be/tiny' })).delivery.id;
ok('an amount over what is left is refused', (await sel2.post(`/api/squad/deliveries/${D3}/verify`, { amount_cents: 1001 })).code === 'budget_exceeded');
await sel2.post(`/api/squad/deliveries/${D3}/verify`, { amount_cents: 1000 });
ok('a used-up budget takes no new interest', (await mk2.post(`/api/squad/offers/${O3}/interests`, {})).code === 'budget_exhausted');

// ---------- refunds ----------
ok('an open offer cannot be refunded', (await admin.post(`/api/admin/squad/offers/${O3}/refund`, {})).code === 'not_closed');
await sel2.post(`/api/squad/offers/${O3}/status`, { status: 'closed' });
r = await admin.post(`/api/admin/squad/offers/${O3}/refund`, {});
ok('a fully spent offer refunds nothing (the fee stays)', r.refund_cents === 0 && r.offer.financials.funding_status === 'refunded', JSON.stringify(r.body));
ok('it cannot be refunded twice', (await admin.post(`/api/admin/squad/offers/${O3}/refund`, {})).code === 'refunded');
await sel.post(`/api/squad/offers/${O}/status`, { status: 'closed' });
r = await admin.post(`/api/admin/squad/offers/${O}/refund`, {});
ok('the unspent budget is refunded, not the fee', r.refund_cents === 100000 - 40000, JSON.stringify(r.body));

// ---------- deleting and moderating media ----------
ok('you cannot delete someone else\'s file', (await sel2.del(`/api/squad/media/${IMG}`)).status === 404);
ok('deleting a file removes it from the product', (await sel.del(`/api/squad/media/${IMG}`)).ok === true && (await anon.get(`/api/squad/products/${P}`)).product.cover_media_id === null);
ok('a deleted file is gone', (await anon.req(`/api/squad/media/${IMG}/file`)).status === 404);
ok('deleting a video clears it from the offer', (await sel.del(`/api/squad/media/${VID}`)).ok === true && (await sel.get(`/api/squad/offers/${O}`)).offer.video === null);
const IMG2 = (await sel.up('/api/squad/media?kind=image', PNG, 'image/png')).media.id;
await admin.post(`/api/admin/squad/media/${IMG2}`, { action: 'block' });
ok('a blocked file is hidden from the public', (await anon.req(`/api/squad/media/${IMG2}/file`)).status === 404);
ok('...but the admin still sees it', (await admin.req(`/api/squad/media/${IMG2}/file`)).status === 200);
const gone = person(); await signIn(gone, `mg-${TAG}@ex.com`); await gone.post('/api/squad/sellers', {});
const GM = (await gone.up('/api/squad/media?kind=image', PNG, 'image/png')).media.id;
await gone.del('/api/squad/me');
ok('deleting an account removes its files', (await anon.req(`/api/squad/media/${GM}/file`)).status === 404);

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
