// Gorilla Squad API, end to end, against a running dev Worker:  BASE=http://localhost:8787 node test/squad.mjs
// admin@thebes.local is an admin locally. Local mode returns sign-in links instead of emailing them.
const BASE = process.env.BASE || 'http://localhost:8787';
let pass = 0, failed = 0;
const ok = (name, cond, info = '') => { cond ? pass++ : failed++; console.log(`${cond ? '✓' : '✗'} ${name}${cond ? '' : '  ' + String(info).slice(0, 300)}`); };
const TAG = Date.now().toString(36);

function person() {
  const jar = new Map();
  const req = async (p, opts = {}) => {
    const r = await fetch(BASE + p, { redirect: 'manual', ...opts,
      headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...(typeof opts.body === 'string' ? { 'content-type': 'application/json' } : {}), ...(opts.headers || {}) } });
    for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const [k, ...v] = kv.split('='); v.join('=') ? jar.set(k.trim(), v.join('=')) : jar.delete(k.trim()); }
    return r;
  };
  const j = async (p, opts) => { const r = await req(p, opts); const b = await r.json().catch(() => ({})); return { status: r.status, body: b, ...b }; };
  const call = (m) => (p, b) => j(p, { method: m, body: JSON.stringify(b || {}) });
  return { req, get: (p) => j(p), post: call('POST'), patch: call('PATCH'), del: (p) => j(p, { method: 'DELETE' }) };
}
async function signIn(who, email) {
  const s = await who.post('/api/auth/start', { email });
  const link = new URL(s.body.link);
  return (await who.req(link.pathname + link.search)).status === 302;
}

const admin = person(), sel = person(), sel2 = person(), mk = person(), mk2 = person(), mk3 = person(), anon = person();
ok('everyone signs in', (await Promise.all([signIn(admin, 'admin@thebes.local'), signIn(sel, `sel-${TAG}@ex.com`), signIn(sel2, `sel2-${TAG}@ex.com`),
  signIn(mk, `mk-${TAG}@ex.com`), signIn(mk2, `mk2-${TAG}@ex.com`), signIn(mk3, `mk3-${TAG}@ex.com`)])).every(Boolean));

// ---------- me ----------
ok('signed out has no profile', (await anon.get('/api/squad/me')).status === 401);
let r = await sel.patch('/api/squad/me', { first_name: '  Ada ', last_name: 'Obi' });
ok('first and last name are saved, trimmed', r.user?.first_name === 'Ada' && r.user?.last_name === 'Obi', JSON.stringify(r.body));
r = await sel.patch('/api/squad/me', { last_name: '' });
ok('names are optional and can be cleared', r.user?.last_name === null);
ok('names have a length limit', (await sel.patch('/api/squad/me', { first_name: 'x'.repeat(61) })).status === 400);
r = await sel.get('/api/squad/me');
ok('a new user is neither seller nor marketer', r.seller === null && r.marketer === null && r.user.is_verified === false && r.user.is_blocked === false);

// ---------- companies and sellers ----------
ok('a product needs a seller profile', (await sel.post('/api/squad/products', { name: 'X', description: 'long enough text' })).code === 'no_seller');
r = await sel.post('/api/squad/sellers', {});
ok('becoming a seller', r.status === 201 && r.seller.id, JSON.stringify(r.body));
ok('becoming a seller twice is safe', (await sel.post('/api/squad/sellers', {})).status === 200);
r = await sel.post('/api/squad/companies', { name: `Acme ${TAG}`, website: 'https://acme.example', country: 'us' });
ok('a company is its own table', r.status === 201 && r.company.country === 'US', JSON.stringify(r.body));
const CO = r.company.id;
ok('the seller is attached to their first company', (await sel.get('/api/squad/me')).seller.company_id === CO);
ok('a bad website is refused', (await sel.post('/api/squad/companies', { name: 'Bad', website: 'javascript:alert(1)' })).status === 400);
ok('someone else cannot edit the company', (await mk.patch(`/api/squad/companies/${CO}`, { name: 'Hacked' })).status === 403);
ok('a stranger cannot join a company as seller', (await sel2.post('/api/squad/sellers', { company_id: CO })).status === 403);
await sel2.post('/api/squad/sellers', {});

// ---------- products ----------
ok('product needs a name', (await sel.post('/api/squad/products', { description: 'A long enough description' })).status === 400);
ok('product needs a description', (await sel.post('/api/squad/products', { name: 'Widget' })).status === 400);
r = await sel.post('/api/squad/products', { name: 'Ledgerly', description: 'Accounting software for small teams.', url: 'https://ledgerly.example', details: { price: '$49/mo', category: 'tech' } });
ok('seller lists a product', r.status === 201 && r.product.details.price === '$49/mo' && r.product.company_id === CO, JSON.stringify(r.body));
const P = r.product.id;
ok('another seller cannot edit it', (await sel2.patch(`/api/squad/products/${P}`, { name: 'Mine' })).status === 404);
ok('details must be an object', (await sel.patch(`/api/squad/products/${P}`, { details: [1, 2] })).status === 400);

// ---------- types ----------
r = await anon.get('/api/squad/offer-types');
ok('built-in offer types are listed', ['commission', 'attention', 'introduction'].every((s) => r.types.some((t) => t.slug === s)), JSON.stringify(r.body).slice(0, 200));
r = await anon.get('/api/squad/delivery-types');
ok('built-in delivery types are listed', r.types.length >= 6);
r = await mk.post('/api/squad/offer-types', { name: `Bounty ${TAG}`, description: 'Paid per qualified lead found.', criteria: { terms: { per_lead_cents: { type: 'number', min: 1 } } } });
ok('a user proposes an offer type', r.status === 201 && r.type.is_approved === false, JSON.stringify(r.body));
const OT = r.type;
ok('a proposed type with bad fields is refused', (await mk.post('/api/squad/offer-types', { name: `Bad ${TAG}`, description: 'Has a broken criteria field.', criteria: { terms: { 'Bad Key': { type: 'number' } } } })).status === 400);
ok('the same type name twice is refused', (await mk.post('/api/squad/offer-types', { name: `Bounty ${TAG}`, description: 'Paid per qualified lead found.' })).status === 409);
ok('others do not see an unapproved type', !(await anon.get('/api/squad/offer-types')).types.some((t) => t.id === OT.id));
ok('the proposer sees their own pending type', (await mk.get('/api/squad/offer-types')).types.some((t) => t.id === OT.id));
ok('an offer cannot use an unapproved type', (await sel.post('/api/squad/offers', { product_id: P, offer_type: OT.slug, title: 'Leads', terms: { per_lead_cents: 500 } })).code === 'type_pending');
ok('admin approves the type', (await admin.post(`/api/admin/squad/offer-types/${OT.id}`, { action: 'approve' })).status === 200);
ok('a non-admin cannot approve', (await mk.post(`/api/admin/squad/offer-types/${OT.id}`, { action: 'approve' })).status === 403);

// ---------- offers ----------
ok('terms are checked against the type', (await sel.post('/api/squad/offers', { product_id: P, offer_type: 'commission', title: 'Sell Ledgerly', terms: { percent: 95 } })).code === 'invalid_terms');
ok('required terms are enforced', (await sel.post('/api/squad/offers', { product_id: P, offer_type: 'commission', title: 'Sell Ledgerly', terms: {} })).code === 'invalid_terms');
ok('an enum term is enforced', (await sel.post('/api/squad/offers', { product_id: P, offer_type: 'attention', title: 'Post', terms: { rate_cents: 100, per: 'like' } })).code === 'invalid_terms');
ok('unknown platform in requirements is refused', (await sel.post('/api/squad/offers', { product_id: P, offer_type: 'commission', title: 'Sell', terms: { percent: 20 }, requirements: { platforms: ['myspace'] } })).status === 400);
ok('unknown delivery type in requirements is refused', (await sel.post('/api/squad/offers', { product_id: P, offer_type: 'commission', title: 'Sell', terms: { percent: 20 }, requirements: { delivery_types: ['skywriting'] } })).status === 400);
ok('someone else\'s product cannot get an offer', (await sel2.post('/api/squad/offers', { product_id: P, offer_type: 'commission', title: 'Sell', terms: { percent: 20 } })).status === 404);
r = await sel.post('/api/squad/offers', { product_id: P, offer_type: 'attention', title: 'Post about Ledgerly on YouTube', terms: { rate_cents: 2000, per: 'post' },
  requirements: { platforms: ['youtube'], min_followers: 5000, countries: ['US'], delivery_types: ['video'] }, max_relationships: 2 });
ok('seller creates a draft offer with requirements', r.status === 201 && r.offer.status === 'draft' && r.offer.requirements.min_followers === 5000, JSON.stringify(r.body));
const OF = r.offer.id;
ok('a draft is hidden from browse', !(await anon.get('/api/squad/offers')).offers.some((o) => o.id === OF));
ok('a draft is hidden from strangers', (await mk.get(`/api/squad/offers/${OF}`)).status === 404);
ok('a draft cannot be paused', (await sel.post(`/api/squad/offers/${OF}/status`, { status: 'paused' })).code === 'bad_transition');
ok('seller opens the offer', (await sel.post(`/api/squad/offers/${OF}/status`, { status: 'open' })).offer?.status === 'open');
r = await anon.get('/api/squad/offers?type=attention');
ok('an open offer is in browse, filtered by type', r.offers.some((o) => o.id === OF && o.type.slug === 'attention' && o.company?.name));
ok('the country filter applies', !(await anon.get('/api/squad/offers?country=NG')).offers.some((o) => o.id === OF) && (await anon.get('/api/squad/offers?country=US')).offers.some((o) => o.id === OF));
ok('the search filter applies', (await anon.get('/api/squad/offers?q=Ledgerly')).offers.some((o) => o.id === OF));
r = await sel.post('/api/squad/offers', { product_id: P, offer_type: 'commission', title: 'Sell Ledgerly to your network', terms: { percent: 20, cookie_days: 30 }, status: 'open' });
const OF2 = r.offer.id;
ok('an offer can open straight away', r.offer.status === 'open');

// ---------- marketers and socials ----------
ok('marketer needs a country', (await mk.post('/api/squad/marketers', {})).status === 400);
ok('country is two letters', (await mk.post('/api/squad/marketers', { country: 'USA' })).status === 400);
r = await mk.post('/api/squad/marketers', { country: 'us', city: 'Austin' });
ok('becoming a marketer', r.status === 201 && r.marketer.country === 'US');
const M = r.marketer.id;
await mk2.post('/api/squad/marketers', { country: 'NG' });
await mk3.post('/api/squad/marketers', { country: 'US' });
ok('a social needs a known platform', (await mk.post('/api/squad/socials', { platform: 'myspace', handle: 'x' })).status === 400);
r = await mk.post('/api/squad/socials', { platform: 'youtube', handle: `@ada${TAG}`, followers: 12000, audience_countries: ['US', 'ca'] });
ok('marketer adds a social; @ is stripped', r.status === 201 && r.social.handle === `ada${TAG}` && r.social.audience_countries.includes('CA'), JSON.stringify(r.body));
const S = r.social.id;
ok('the same account cannot be claimed twice', (await mk3.post('/api/squad/socials', { platform: 'youtube', handle: `ADA${TAG}` })).code === 'duplicate');
r = await mk3.post('/api/squad/socials', { platform: 'youtube', handle: `small${TAG}`, followers: 300 });
const S3 = r.social.id;
ok('negative followers are refused', (await mk.post('/api/squad/socials', { platform: 'x', handle: `neg${TAG}`, followers: -5 })).status === 400);

// ---------- eligibility and interests ----------
r = await mk.get(`/api/squad/offers/${OF}`);
ok('a qualifying marketer sees they are eligible', r.offer?.eligible === true, JSON.stringify(r.body).slice(0, 300));
r = await mk3.get(`/api/squad/offers/${OF}`);
ok('a small account is told why not', r.offer?.eligible === false && /5000\+ followers/.test(r.offer.reasons.join(' ')), JSON.stringify(r.offer?.reasons));
ok('a marketer in the wrong country is not eligible', (await mk2.get(`/api/squad/offers/${OF}`)).offer?.eligible === false);
r = await mk3.post(`/api/squad/offers/${OF}/interests`, { social_id: S3 });
ok('an ineligible marketer cannot ask', r.status === 403 && r.code === 'not_eligible', JSON.stringify(r.body));
ok('the eligible filter hides offers you do not fit', !(await mk3.get('/api/squad/offers?eligible=1')).offers.some((o) => o.id === OF));
ok('a seller cannot ask for their own offer', (await sel.post(`/api/squad/offers/${OF}/interests`, {})).code === 'no_marketer');
ok('you cannot use someone else\'s account', (await mk3.post(`/api/squad/offers/${OF}/interests`, { social_id: S })).status === 400);
r = await mk.post(`/api/squad/offers/${OF}/interests`, { social_id: S, message: 'I review tools for small teams.' });
ok('marketer shows interest', r.status === 201 && r.interest.status === 'pending', JSON.stringify(r.body));
const I1 = r.interest.id;
ok('asking twice is refused', (await mk.post(`/api/squad/offers/${OF}/interests`, { social_id: S })).code === 'duplicate');
ok('the seller sees it in the offer inbox', (await sel.get(`/api/squad/offers/${OF}/interests`)).interests.some((i) => i.id === I1 && i.social.handle === `ada${TAG}`));
ok('the marketer sees it in their list', (await mk.get('/api/squad/interests')).interests.some((i) => i.id === I1));
ok('another seller cannot read the inbox', (await sel2.get(`/api/squad/offers/${OF}/interests`)).status === 404);
ok('the marketer cannot accept their own interest', (await mk.post(`/api/squad/interests/${I1}/accept`)).status === 403);
ok('another seller cannot accept it', (await sel2.post(`/api/squad/interests/${I1}/accept`)).status === 404);
ok('the seller sees a pending count', (await sel.get('/api/squad/me')).counts.pending_interests >= 1);

// withdraw, deny, and ask again
r = await mk.post(`/api/squad/offers/${OF2}/interests`, {});
const I2 = r.interest.id;
ok('the marketer withdraws an interest', (await mk.post(`/api/squad/interests/${I2}/withdraw`)).interest?.status === 'withdrawn');
ok('a withdrawn interest cannot be accepted', (await sel.post(`/api/squad/interests/${I2}/accept`)).code === 'decided');
r = await mk.post(`/api/squad/offers/${OF2}/interests`, {});
ok('after withdrawing you can ask again', r.status === 201);
const I3 = r.interest.id;
ok('the seller denies it with a note', (await sel.post(`/api/squad/interests/${I3}/deny`, { note: 'Looking for B2B only' })).interest?.decision_note === 'Looking for B2B only');
ok('a denied interest cannot be denied again', (await sel.post(`/api/squad/interests/${I3}/deny`)).code === 'decided');

// ---------- accept → relationship ----------
r = await sel.post(`/api/squad/interests/${I1}/accept`, { note: 'Welcome aboard' });
ok('the seller accepts: a relationship starts', r.status === 201 && r.relationship.status === 'active' && r.relationship.terms_snapshot.terms.rate_cents === 2000, JSON.stringify(r.body));
const R = r.relationship.id;
ok('accepting twice is refused', (await sel.post(`/api/squad/interests/${I1}/accept`)).code === 'decided');
ok('an accepted interest cannot be withdrawn', (await mk.post(`/api/squad/interests/${I1}/withdraw`)).code === 'decided');
ok('the marketer cannot ask again while working on it', (await mk.post(`/api/squad/offers/${OF}/interests`, { social_id: S })).code === 'duplicate');
await sel.patch(`/api/squad/offers/${OF}`, { terms: { rate_cents: 500, per: 'post' } });
ok('editing the offer does not change the agreed terms', (await mk.get(`/api/squad/relationships/${R}`)).relationship.terms_snapshot.terms.rate_cents === 2000);
ok('the offer type is locked once taken', (await sel.patch(`/api/squad/offers/${OF}`, { offer_type: 'commission', terms: { percent: 10 } })).code === 'locked');
ok('max relationships cannot go below the active count', (await sel.patch(`/api/squad/offers/${OF}`, { max_relationships: 1 })).status === 200 && (await sel.patch(`/api/squad/offers/${OF}`, { max_relationships: 0 })).status === 400);

// one offer, many relationships, up to the limit
await mk3.patch(`/api/squad/socials/${S3}`, { followers: 9000 });
r = await mk3.post(`/api/squad/offers/${OF}/interests`, { social_id: S3 });
ok('a full offer refuses new interest', r.code === 'full', JSON.stringify(r.body));
await sel.patch(`/api/squad/offers/${OF}`, { max_relationships: 3 });
r = await mk3.post(`/api/squad/offers/${OF}/interests`, { social_id: S3 });
ok('after raising the limit a second marketer can ask', r.status === 201, JSON.stringify(r.body));
r = await sel.post(`/api/squad/interests/${r.interest.id}/accept`);
ok('one offer has many relationships', r.status === 201 && (await sel.get(`/api/squad/relationships?offer_id=${OF}`)).relationships.length === 2);
const R3 = r.relationship.id;

// ---------- relationships ----------
r = await sel.get('/api/squad/relationships?as=seller');
ok('the seller lists their relationships', r.relationships.some((x) => x.id === R && x.side === 'seller'));
r = await mk.get('/api/squad/relationships?as=marketer');
ok('the marketer lists theirs', r.relationships.some((x) => x.id === R && x.side === 'marketer'));
ok('a stranger cannot open a relationship', (await mk2.get(`/api/squad/relationships/${R}`)).status === 404);
ok('the admin can open any relationship', (await admin.get(`/api/squad/relationships/${R}`)).status === 200);
ok('the marketer cannot pause it', (await mk.post(`/api/squad/relationships/${R}/status`, { status: 'paused' })).status === 403);
ok('the seller pauses it', (await sel.post(`/api/squad/relationships/${R}/status`, { status: 'paused' })).relationship?.status === 'paused');

// ---------- deliveries ----------
ok('no deliveries while paused', (await mk.post(`/api/squad/relationships/${R}/deliveries`, { delivery_type: 'video', social_id: S, proof_url: 'https://youtu.be/a1' })).code === 'not_active');
await sel.post(`/api/squad/relationships/${R}/status`, { status: 'active' });
ok('only types the offer accepts', (await mk.post(`/api/squad/relationships/${R}/deliveries`, { delivery_type: 'newsletter', social_id: S, proof_url: 'https://x.example/1' })).code === 'type_not_allowed');
ok('a video needs the account it went out on', (await mk.post(`/api/squad/relationships/${R}/deliveries`, { delivery_type: 'video', proof_url: 'https://youtu.be/a1' })).code === 'needs_social');
ok('a video needs a proof link', (await mk.post(`/api/squad/relationships/${R}/deliveries`, { delivery_type: 'video', social_id: S })).status === 400);
ok('the seller cannot report a delivery', (await sel.post(`/api/squad/relationships/${R}/deliveries`, { delivery_type: 'video', social_id: S, proof_url: 'https://youtu.be/a1' })).status === 403);
r = await mk.post(`/api/squad/relationships/${R}/deliveries`, { delivery_type: 'video', social_id: S, proof_url: 'https://youtu.be/a1', note: 'Mention at 2:10' });
ok('the marketer reports a delivery', r.status === 201 && r.delivery.status === 'submitted', JSON.stringify(r.body));
const D1 = r.delivery.id;
ok('the same proof link twice is refused', (await mk.post(`/api/squad/relationships/${R}/deliveries`, { delivery_type: 'video', social_id: S, proof_url: 'https://youtu.be/a1' })).code === 'duplicate');
ok('the marketer cannot verify their own delivery', (await mk.post(`/api/squad/deliveries/${D1}/verify`)).status === 403);
ok('another seller cannot verify it', (await sel2.post(`/api/squad/deliveries/${D1}/verify`)).status === 404);
r = await sel.post(`/api/squad/deliveries/${D1}/verify`, { note: 'Seen it' });
ok('the seller verifies the delivery', r.delivery?.status === 'verified' && r.delivery.is_verified === true, JSON.stringify(r.body));
ok('a verified delivery cannot be rejected by the seller', (await sel.post(`/api/squad/deliveries/${D1}/reject`, { note: 'changed mind' })).code === 'decided');
ok('a verified delivery cannot be removed by the marketer', (await mk.del(`/api/squad/deliveries/${D1}`)).code === 'decided');
r = await mk.post(`/api/squad/relationships/${R}/deliveries`, { delivery_type: 'video', social_id: S, proof_url: 'https://youtu.be/b2' });
const D2 = r.delivery.id;
ok('a rejection needs a reason', (await sel.post(`/api/squad/deliveries/${D2}/reject`)).code === 'needs_note');
ok('the seller rejects with a reason', (await sel.post(`/api/squad/deliveries/${D2}/reject`, { note: 'Video is private' })).delivery?.status === 'rejected');
ok('the admin can overturn a decision', (await admin.post(`/api/squad/deliveries/${D2}/verify`, { note: 'Now public' })).delivery?.status === 'verified');
r = await mk.post(`/api/squad/relationships/${R}/deliveries`, { delivery_type: 'video', social_id: S, proof_url: 'https://youtu.be/c3' });
ok('the marketer can take back an unchecked delivery', (await mk.del(`/api/squad/deliveries/${r.delivery.id}`)).ok === true);
ok('deliveries are listed for both sides', (await sel.get(`/api/squad/relationships/${R}/deliveries`)).deliveries.length === 2);
ok('verified deliveries show on the public profile', (await anon.get(`/api/squad/marketers/${M}`)).verified_deliveries === 2);

// ---------- messages ----------
ok('an empty message is refused', (await mk.post(`/api/squad/relationships/${R}/messages`, { body: '  ' })).status === 400);
ok('a stranger cannot post', (await mk2.post(`/api/squad/relationships/${R}/messages`, { body: 'hi' })).status === 404);
ok('the admin reads but does not post', (await admin.post(`/api/squad/relationships/${R}/messages`, { body: 'hi' })).status === 403);
const m1 = await mk.post(`/api/squad/relationships/${R}/messages`, { body: 'Video goes up Friday.' });
ok('the marketer sends a message', m1.status === 201);
await sel.post(`/api/squad/relationships/${R}/messages`, { body: 'Great, thanks.' });
r = await sel.get(`/api/squad/relationships/${R}/messages`);
ok('both messages, oldest first', r.messages.length === 2 && r.messages[0].body === 'Video goes up Friday.');
ok('the seller has one unread', (await sel.get('/api/squad/relationships?as=seller')).relationships.find((x) => x.id === R).counts.unread === 1);
ok('marking read clears it', (await sel.post(`/api/squad/relationships/${R}/read`)).marked === 1 && (await sel.get('/api/squad/relationships?as=seller')).relationships.find((x) => x.id === R).counts.unread === 0);
ok('polling with ?after returns only new ones', (await mk.get(`/api/squad/relationships/${R}/messages?after=${r.messages[1].created_at}`)).messages.length === 0);
ok('you cannot delete someone else\'s message', (await sel.del(`/api/squad/messages/${m1.message.id}`)).status === 404);
ok('you can delete your own', (await mk.del(`/api/squad/messages/${m1.message.id}`)).ok === true && (await sel.get(`/api/squad/relationships/${R}/messages`)).messages[0].body === null);

// ---------- ending ----------
ok('the marketer ends one relationship', (await mk3.post(`/api/squad/relationships/${R3}/status`, { status: 'ended', reason: 'Too busy' })).relationship?.status === 'ended');
ok('an ended relationship cannot restart', (await sel.post(`/api/squad/relationships/${R3}/status`, { status: 'active' })).code === 'ended');
ok('no messages after it ends', (await mk3.post(`/api/squad/relationships/${R3}/messages`, { body: 'hi' })).code === 'ended');
ok('after it ends the marketer can ask again', (await mk3.post(`/api/squad/offers/${OF}/interests`, { social_id: S3 })).status === 201);

// ---------- deletes with live work ----------
ok('a product with live relationships cannot be deleted', (await sel.del(`/api/squad/products/${P}`)).code === 'has_relationships');
ok('an offer with live relationships cannot be deleted', (await sel.del(`/api/squad/offers/${OF}`)).code === 'has_relationships');
r = await sel.post(`/api/squad/offers/${OF}/status`, { status: 'closed' });
ok('closing an offer denies pending interest', r.offer?.status === 'closed' && (await mk3.get('/api/squad/interests')).interests.some((i) => i.offer_id === OF && i.status === 'denied' && i.decision_note === 'offer closed'));
ok('a closed offer cannot reopen', (await sel.post(`/api/squad/offers/${OF}/status`, { status: 'open' })).code === 'bad_transition');
ok('live relationships carry on after closing', (await mk.get(`/api/squad/relationships/${R}`)).relationship.status === 'active');

// ---------- verification, blocking and flags ----------
ok('a social edit after verification needs checking again', await (async () => {
  await admin.post(`/api/admin/squad/socials/${S}`, { action: 'verify' });
  const v = (await mk.get('/api/squad/socials')).socials.find((s) => s.id === S).is_verified;
  const e = await mk.patch(`/api/squad/socials/${S}`, { followers: 50000 });
  return v === true && e.social.is_verified === false && e.needs_verification === true;
})());
r = await sel.post('/api/squad/offers', { product_id: P, offer_type: 'commission', title: 'Verified only', terms: { percent: 15 }, requirements: { verified_only: true }, status: 'open' });
const OFV = r.offer.id;
ok('verified-only offers refuse unverified marketers', (await mk2.post(`/api/squad/offers/${OFV}/interests`, {})).code === 'not_eligible');
await admin.post(`/api/admin/squad/marketers/${(await mk2.get('/api/squad/me')).marketer.id}`, { action: 'verify' });
ok('after the admin verifies them they can ask', (await mk2.post(`/api/squad/offers/${OFV}/interests`, {})).status === 201);
const P2 = (await sel.post('/api/squad/products', { name: 'Shady pills', description: 'Miracle cure, guaranteed results.' })).product.id;
const OFF = (await sel.post('/api/squad/offers', { product_id: P2, offer_type: 'commission', title: 'Sell pills', terms: { percent: 50 }, status: 'open' })).offer.id;
await admin.post(`/api/admin/squad/products/${P2}`, { action: 'flag', note: 'Health claims' });
ok('flagging a product pauses its offers and hides them', (await sel.get(`/api/squad/offers/${OFF}`)).offer.status === 'paused' && (await anon.get(`/api/squad/offers/${OFF}`)).status === 404);
ok('a flagged product\'s offer cannot reopen', (await sel.post(`/api/squad/offers/${OFF}/status`, { status: 'open' })).code === 'flagged');
ok('the admin queue lists the flagged product', (await admin.get('/api/admin/squad/queue')).products.some((p) => p.id === P2));
const mk2Id = (await mk2.get('/api/squad/me')).marketer.id;
await admin.post(`/api/admin/squad/marketers/${mk2Id}`, { action: 'block' });
ok('a blocked marketer cannot act', (await mk2.post('/api/squad/socials', { platform: 'x', handle: `b${TAG}` })).code === 'blocked');
ok('blocking withdraws their pending interests', (await sel.get(`/api/squad/offers/${OFV}/interests`)).interests.every((i) => i.status !== 'pending'));
ok('blocked profiles are hidden publicly', (await anon.get(`/api/squad/marketers/${mk2Id}`)).status === 404);
await admin.post(`/api/admin/squad/marketers/${mk2Id}`, { action: 'unblock' });
ok('unblocking restores them', (await mk2.get('/api/squad/socials')).status === 200);
const selUser = (await sel2.get('/api/squad/me')).user.id;
await admin.post(`/api/admin/squad/users/${selUser}`, { action: 'block' });
ok('blocking a user signs them out', (await sel2.get('/api/squad/me')).status === 401);
ok('the admin cannot block themselves', (await admin.post(`/api/admin/squad/users/${(await admin.get('/api/squad/me')).user.id}`, { action: 'block' })).code === 'self');
ok('admin actions are checked per kind', (await admin.post(`/api/admin/squad/offer-types/${OT.id}`, { action: 'flag' })).status === 400);
ok('the admin lists blocked users', (await admin.get('/api/admin/squad/users?flag=blocked')).rows.some((u) => u.id === selUser));

// ---------- deleting your account ----------
const del = person(); await signIn(del, `del-${TAG}@ex.com`);
await del.post('/api/squad/marketers', { country: 'US' });
const di = await del.post(`/api/squad/offers/${OF2}/interests`, {});
ok('a member deletes their account', (await del.del('/api/squad/me')).ok === true);
ok('they are signed out', (await del.get('/api/squad/me')).status === 401);
ok('their pending interest is withdrawn', (await sel.get(`/api/squad/offers/${OF2}/interests`)).interests.find((i) => i.id === di.interest.id)?.status === 'withdrawn');

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
