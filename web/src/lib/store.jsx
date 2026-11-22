// App state backed by the Worker API (/api/squad/*). Screens read S and call actions on `a`; they never fetch directly.
import { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { api, qs } from './api.js';
import { artFor, CAT_BG, day, kindOf, kindFromCategory, PLATFORMS } from './data.js';
import { ART } from './art.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

/* ---------------- adapters: API shapes → what the screens use ---------------- */
const nameOf = (u) => (u && (u.display_name || [u.first_name, u.last_name].filter(Boolean).join(' '))) || 'Member';
export function productA(p, media = []) {
  const images = media.filter((m) => m.kind === 'image').map((m) => m.url);
  const demo = media.find((m) => m.role === 'demo' || m.kind === 'video');
  const cover = p.cover || images[0] || null;
  const kind = p.details?.kind || kindFromCategory(p.category);
  return { id: p.id, name: p.name, desc: p.description || '', url: p.url || null, category: p.category || 'other', kind, details: p.details || {}, art: kindOf(kind)[3],
    img: cover, images: images.length ? images : cover ? [cover] : [], gallery: [artFor(p.category)], video: demo ? 'Demo' : null, videoUrl: demo?.url || null,
    company: null, owner: false };
}
export function offerA(o) {
  const f = o.financials || {}, r = o.requirements || {};
  return {
    id: o.id, pid: o.product_id, cover: o.cover || null, files: o.attachments || [], max: o.max_relationships || null, title: o.title, desc: o.description || '', type: o.type?.slug || 'commission', terms: o.terms || {}, status: o.status,
    co: o.company?.name || o.product?.name || 'Seller', coV: !!(o.company?.is_verified || o.seller_verified),
    req: { min_followers: r.min_followers || 0, countries: r.countries || [], platforms: r.platforms || [], verified_only: !!r.verified_only, verified_socials: !!r.verified_socials, delivery_types: r.delivery_types || [] },
    fin: { cur: f.currency || 'USD', budget: f.budget_cents ?? null, cap: f.payout_cap_cents ?? null, funded: f.funding_status === 'funded', spent: f.spent_cents || 0, fee: f.listing_fee_cents || 0, due: f.payment_due_cents || 0 },
    eligible: o.eligible, reasons: o.reasons || [], myInterest: o.my_interest && typeof o.my_interest === 'object' ? o.my_interest : o.my_interest ? { status: o.my_interest } : null,
    myRel: o.my_relationship || null, mine: !!o.is_owner, full: !!o.full, pending: o.pending_interests || 0, active: o.active_relationships || 0, created: o.created_at,
  };
}
const dealA = (r) => ({
  id: r.id, offer: r.offer_id, offerTitle: r.offer?.title, productId: r.product?.id, productName: r.product?.name, type: r.type?.slug, status: r.status, side: r.side,
  terms: r.terms_snapshot?.terms || {}, since: day(r.created_at), created: r.created_at, sellerName: r.seller?.company || nameOf(r.seller?.user), marketerName: nameOf(r.marketer?.user),
  marketerVerified: !!r.marketer?.is_verified, unread: r.counts?.unread || 0, deliveries: r.counts?.deliveries || 0, lastAt: r.last_message_at || r.updated_at,
  earned: r.earned_cents ?? null, currency: r.currency || null, cap: r.payout_cap_cents ?? null,
});
const delA = (d) => ({ id: d.id, kind: d.type?.slug === 'in_person' ? (d.media ? 'Video' : d.proof_url ? 'Post link' : 'Delivery') : d.type?.name || 'Delivery', slug: d.type?.slug, proof: d.proof_url || d.note || '', url: d.proof_url, media: d.media, video: d.media ? 'Video' : null,
  status: d.status === 'submitted' ? 'pending' : d.status, amount: d.amount_cents, at: d.created_at, note: d.verification_note });
const interestA = (i, offerId) => ({ id: i.id, offer: offerId || i.offer_id, status: i.status, msg: i.message || '', at: i.created_at,
  who: i.marketer ? { name: nameOf(i.marketer.user), country: i.marketer.country, verified: !!i.marketer.is_verified, social: i.social } : null,
  offerTitle: i.offer?.title, relId: i.relationship_id || null });

/* a placement image drawn from our built-in art, for "use a sample image" */
export async function sampleImage(kind) {
  const k = kindOf(kind), svg = ART[k[3]], [c1, c2] = CAT_BG[k[4]] || CAT_BG.other;
  const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 900;
  const g = cv.getContext('2d'), grd = g.createLinearGradient(0, 0, 600, 900); grd.addColorStop(0, c1); grd.addColorStop(1, c2);
  g.fillStyle = grd; g.fillRect(0, 0, 1200, 900);
  const fixed = svg.replace('<svg', '<svg width="640" height="640"' + (svg.includes('xmlns=') ? '' : ' xmlns="http://www.w3.org/2000/svg"'));
  const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(fixed);
  try { await img.decode(); g.drawImage(img, 280, 130, 640, 640); } catch { /* gradient only */ }
  return new Promise((res) => cv.toBlob((b) => res(new File([b], 'sample.png', { type: 'image/png' })), 'image/png'));
}

/* ---------------- provider ---------------- */
const init = { auth: 'loading', me: null, role: 'marketer', offers: {}, products: {}, feed: null, feedCat: 'all', myOfferIds: null, myProductIds: null,
  deals: null, msgs: {}, dels: {}, recv: null, sent: null, toast: null, signin: null, applyTo: null, setup: null };

export function StoreProvider({ children }) {
  const [S, setS] = useState(init);
  const ref = useRef(S); ref.current = S;
  const patch = useCallback((fn) => setS((s) => { const n = { ...s }; fn(n); return n; }), []);
  const toast = useCallback((m) => patch((s) => { s.toast = { m, k: Date.now() }; }), [patch]);
  useEffect(() => { if (!S.toast) return; const t = setTimeout(() => setS((s) => ({ ...s, toast: null })), 2600); return () => clearTimeout(t); }, [S.toast?.k]);

  const putOffers = (list) => patch((s) => { s.offers = { ...s.offers }; for (const o of list) s.offers[o.id] = { ...(s.offers[o.id] || {}), ...o }; });
  const putProducts = (list) => patch((s) => { s.products = { ...s.products }; for (const p of list) s.products[p.id] = { ...(s.products[p.id] || {}), ...p }; });

  // run an API call; on failure show the server's message, and ask to sign in when that is the problem
  const run = useCallback(async (fn, { quiet } = {}) => {
    try { return await fn(); }
    catch (e) {
      if (e.status === 401 || e.code === 'signin') { patch((s) => { s.signin = { why: 'Sign in to continue' }; }); return null; }
      if (e.code === 'no_marketer') { patch((s) => { s.setup = 'marketer'; }); return null; }
      if (e.code === 'no_seller') { patch((s) => { s.setup = 'seller'; }); return null; }
      if (!quiet) toast(e.message);
      return null;
    }
  }, [patch, toast]);

  const loadMe = useCallback(async () => {
    try {
      const me = await api('/squad/me');
      patch((s) => { s.auth = 'in'; s.me = me; if (!s.roleSet) s.role = me.seller && !me.marketer ? 'seller' : 'marketer'; });
      return me;
    } catch { patch((s) => { s.auth = 'out'; s.me = null; }); return null; }
  }, [patch]);
  useEffect(() => { loadMe(); }, [loadMe]);

  const a = useMemo(() => {
    const me = S.me, seller = S.role === 'seller';
    const userName = me ? nameOf(me.user) || me.user.email.split('@')[0] : '';
    const needIn = (why) => { if (ref.current.auth === 'in') return false; patch((s) => { s.signin = { why }; }); return true; };
    const act = {
      toast, run,
      me: me ? { id: me.user.id, name: me.user.display_name || me.user.email.split('@')[0], email: me.user.email, handle: me.user.email.split('@')[0], verified: !!(seller ? me.seller?.is_verified : me.marketer?.is_verified),
        company: me.companies?.[0]?.name || null, co: me.companies?.[0] || null, sellerBio: me.seller?.bio || '', country: me.marketer?.country || null, city: me.marketer?.city || null,
        followers: (me.socials || []).reduce((n, x) => n + (x.followers || 0), 0), socials: me.socials || [] } : null,
      userName,
      hasSeller: !!me?.seller, hasMarketer: !!me?.marketer,
      setRole: (r) => patch((s) => { s.role = r || (s.role === 'seller' ? 'marketer' : 'seller'); s.roleSet = true; s.deals = null; }),
      openSignin: (why) => patch((s) => { s.signin = { why: why || 'Sign in to Gorilla Squad' }; }),
      closeSignin: () => patch((s) => { s.signin = null; }),
      closeSetup: () => patch((s) => { s.setup = null; s.setupThen = null; }),
      openSetup: (k, then) => patch((s) => { s.setup = k; s.setupThen = then || null; }),
      async signIn(email) {
        try { return await api('/auth/start', { method: 'POST', body: { email } }); }
        catch (e) { toast(e.status === 503 ? "Sign-in emails aren't switched on yet. Please try again soon." : e.status === 502 ? "We couldn't send the email. " + ((e.message.match(/\((.*)\)$/) || [])[1] || "Check the address and try again.") : e.message); return null; }
      },
      async signOut() { await run(() => api('/auth/signout', { method: 'POST' })); location.hash = 'feed'; location.reload(); },
      async setupProfile(kind, f) {
        const ok = await run(async () => {
          if (f.name) await api('/squad/me', { method: 'PATCH', body: { display_name: f.name } });
          if (kind === 'seller') {
            let company_id;
            if (f.company && !me?.companies?.length) company_id = (await api('/squad/companies', { method: 'POST', body: { name: f.company, website: f.website || undefined, country: f.country || undefined } })).company.id;
            await api('/squad/sellers', { method: 'POST', body: { company_id } });
          } else await api('/squad/marketers', { method: 'POST', body: { country: f.country, city: f.city || undefined } });
          return true;
        });
        if (ok) { const then = ref.current.setupThen; await loadMe(); patch((s) => { s.setup = null; s.setupThen = null; s.role = kind; s.roleSet = true; s.deals = null; }); toast(kind === 'seller' ? 'Seller profile ready' : 'Marketer profile ready'); if (then) setTimeout(then, 60); }
        return ok;
      },
      // create or update the seller account: the brand (company) creators see, then the seller profile on top of it
      async saveSeller(f) {
        const had = !!me?.seller, co = me?.companies?.[0];
        const brand = { name: f.company.trim(), website: f.website?.trim() || undefined, industry: f.industry?.trim() || undefined, description: f.description?.trim() || undefined, city: f.city?.trim() || undefined, country: f.country || undefined };
        const ok = await run(async () => {
          if (f.name?.trim() && f.name.trim() !== me?.user?.display_name) await api('/squad/me', { method: 'PATCH', body: { display_name: f.name.trim() } });
          let company_id = co?.id;
          if (co) await api('/squad/companies/' + co.id, { method: 'PATCH', body: { ...brand, website: f.website?.trim() || null, industry: f.industry?.trim() || null, description: f.description?.trim() || null, city: f.city?.trim() || null } });
          else company_id = (await api('/squad/companies', { method: 'POST', body: brand })).company.id;
          await api('/squad/sellers', { method: 'POST', body: { company_id } });
          return true;
        });
        if (ok) { await loadMe(); patch((s) => { s.role = 'seller'; s.roleSet = true; s.deals = null; }); toast(had ? 'Seller account saved' : 'Seller account ready'); }
        return !!ok;
      },
      async saveName(name) { const r = await run(() => api('/squad/me', { method: 'PATCH', body: { display_name: name } })); if (r) { await loadMe(); toast('Saved'); } return !!r; },

      /* feed + offers */
      async loadFeed(cat = 'all') {
        patch((s) => { s.feedCat = cat; if (s.feedCatLoaded !== cat) s.feed = null; });
        const r = await run(() => api('/squad/offers' + qs({ category: cat === 'all' ? '' : cat, limit: 50 })));
        if (!r) return patch((s) => { s.feed = []; });
        putOffers(r.offers.map(offerA));
        putProducts(r.offers.map((o) => ({ id: o.product_id, ...productA({ id: o.product_id, ...o.product }) })).map((p) => { const old = ref.current.products[p.id]; return old?.full ? old : p; }));
        patch((s) => { s.feed = r.offers.map((o) => o.id); s.feedCatLoaded = cat; });
      },
      async loadOffer(id) {
        const r = await run(() => api('/squad/offers/' + id), { quiet: true });
        if (!r) { patch((s) => { s.offers = { ...s.offers, [id]: { ...(s.offers[id] || {}), missing: true } }; }); return null; }
        const o = offerA(r.offer), p = { ...productA(r.offer.product, r.offer.media), company: r.offer.company, full: true, owner: o.mine };
        putProducts([p]); putOffers([o]);
        return o;
      },
      async loadProduct(id) {
        const r = await run(() => api('/squad/products/' + id), { quiet: true });
        if (!r) { patch((s) => { s.products = { ...s.products, [id]: { id, missing: true } }; }); return; }
        putProducts([{ ...productA(r.product, r.media), company: r.company, full: true, owner: r.is_owner }]);
        putOffers(r.offers.map((o) => ({ ...offerA(o), co: r.company?.name || r.product.name })));
        patch((s) => { s.prodOffers = { ...(s.prodOffers || {}), [id]: r.offers.map((o) => o.id) }; });
      },
      isMine: (o) => !!o && (o.mine || (ref.current.myOfferIds || []).includes(o.id)),
      myInterest: (o) => o && o.myInterest?.status === 'pending' ? o.myInterest : null,
      dealFor: (o) => o && o.myRel ? { id: o.myRel.id } : o && o.myInterest?.status === 'accepted' && o.myInterest.relId ? { id: o.myInterest.relId } : null,
      apply(o) {
        if (needIn('Sign in to apply')) return;
        if (!me?.marketer) return patch((s) => { s.setup = 'marketer'; });
        patch((s) => { s.applyTo = o.id; });
      },
      closeApply: () => patch((s) => { s.applyTo = null; }),
      async sendApply(o, message, social_id) {
        const r = await run(() => api(`/squad/offers/${o.id}/interests`, { method: 'POST', body: { message: message || undefined, social_id: social_id || undefined } }));
        if (!r) return false;
        putOffers([{ id: o.id, myInterest: { ...r.interest } }]);
        patch((s) => { s.applyTo = null; s.sent = null; }); toast('Applied. The seller will accept or deny.');
        return true;
      },
      async withdraw(o) {
        let iid = o.myInterest?.id;
        if (!iid) { const r = await run(() => api('/squad/interests')); iid = r?.interests.find((i) => i.offer_id === o.id && i.status === 'pending')?.id; }
        if (!iid) return;
        const r = await run(() => api(`/squad/interests/${iid}/withdraw`, { method: 'POST' }));
        if (r) { putOffers([{ id: o.id, myInterest: r.interest }]); patch((s) => { s.sent = null; }); toast('Application withdrawn'); }
      },

      /* seller side */
      async loadSeller() {
        const [o, p] = await Promise.all([run(() => api('/squad/seller/offers'), { quiet: true }), run(() => api('/squad/products'), { quiet: true })]);
        if (o) { putOffers(o.offers.map((x) => ({ ...offerA(x), mine: true, co: me?.companies?.[0]?.name || x.product?.name }))); patch((s) => { s.myOfferIds = o.offers.map((x) => x.id); }); }
        if (p) { putProducts(p.products.map((x) => ({ ...productA(x), owner: true, ...(ref.current.products[x.id]?.full ? { images: ref.current.products[x.id].images, videoUrl: ref.current.products[x.id].videoUrl, video: ref.current.products[x.id].video } : {}) }))); patch((s) => { s.myProductIds = p.products.map((x) => x.id); }); }
        if (o) {
          const lists = await Promise.all(o.offers.map((x) => run(() => api(`/squad/offers/${x.id}/interests`), { quiet: true }).then((r) => (r?.interests || []).map((i) => interestA(i, x.id)))));
          patch((s) => { s.recv = lists.flat().sort((x, y) => (x.status === 'pending') - (y.status === 'pending') || 0).reverse(); });
        }
      },
      async loadSent() { const r = await run(() => api('/squad/interests'), { quiet: true }); patch((s) => { s.sent = (r?.interests || []).map((i) => interestA(i)); }); },
      async toggleOffer(o) {
        const to = o.status === 'open' ? 'paused' : 'open';
        const r = await run(() => api(`/squad/offers/${o.id}/status`, { method: 'POST', body: { status: to } }));
        if (r) { putOffers([{ id: o.id, status: r.offer.status }]); toast(to === 'open' ? 'Offer is open' : 'Offer paused'); }
      },
      async accept(i) {
        const r = await run(() => api(`/squad/interests/${i.id}/accept`, { method: 'POST', body: {} }));
        if (!r) return null;
        patch((s) => { s.recv = (s.recv || []).map((x) => x.id === i.id ? { ...x, status: 'accepted' } : x); s.deals = null; });
        await api(`/squad/relationships/${r.relationship.id}/messages`, { method: 'POST', body: { body: "Welcome! You're accepted and your terms are locked in." } }).catch(() => {});
        toast('Accepted. Chat opened.');
        return r.relationship.id;
      },
      async deny(i) {
        const r = await run(() => api(`/squad/interests/${i.id}/deny`, { method: 'POST', body: {} }));
        if (r) { patch((s) => { s.recv = (s.recv || []).map((x) => x.id === i.id ? { ...x, status: 'denied' } : x); }); toast('Application denied'); }
      },
      async uploadMedia(file, kind) {
        const r = await run(() => api('/squad/media' + qs({ kind }), { method: 'POST', file }));
        return r?.media || null;
      },
      async addProduct(n) {
        const r = await run(() => api('/squad/products', { method: 'POST', body: { name: n.name.trim(), description: n.desc.trim(), category: kindOf(n.kind)[4], url: n.url?.trim() || undefined, details: { kind: n.kind, ...(n.details || {}) } } }));
        if (!r) return null;
        const id = r.product.id, items = [];
        const file = n.file || (n.sample ? await sampleImage(n.kind).catch(() => null) : null);
        if (file) { const m = await act.uploadMedia(file, 'image'); if (m) items.push({ media_id: m.id, role: 'cover' }); }
        for (const g of n.gallery || []) { const m = await act.uploadMedia(g.file, 'image'); if (m) items.push({ media_id: m.id, role: 'gallery' }); }
        if (n.videoFile) { const m = await act.uploadMedia(n.videoFile, 'video'); if (m) items.push({ media_id: m.id, role: 'demo' }); }
        let media = [];
        if (items.length) media = (await run(() => api(`/squad/products/${id}/media`, { method: 'PUT', body: { items } })))?.media || [];
        putProducts([{ ...productA({ ...r.product, cover: media.find((m) => m.role === 'cover')?.url }, media), owner: true, full: true }]);
        patch((s) => { s.myProductIds = [id, ...(s.myProductIds || [])]; });
        toast('Product saved');
        return id;
      },
      async addOffer(L, p) {
        const files = [];
        for (const f of L.files || []) { const m = await act.uploadMedia(f.file, f.file.type.startsWith('video/') ? 'video' : 'image'); if (!m) return null; files.push(m.id); }
        const budget = L.budget, body = { product_id: p.id, offer_type: L.type, title: L.title || 'Promote ' + p.name, terms: L.terms, attachments: files,
          requirements: { min_followers: +L.minf || undefined, countries: L.countries.length ? L.countries : undefined, platforms: L.platforms.length ? L.platforms : undefined,
            verified_only: L.verified || undefined, verified_socials: L.verifiedSocials || undefined, delivery_types: L.delivery ? [L.delivery] : undefined },
          ...(L.max ? { max_relationships: L.max } : {}),
          status: budget ? 'draft' : 'open', currency: L.cur, ...(budget ? { budget_cents: budget } : {}), ...(L.cap ? { payout_cap_cents: L.cap } : {}) };
        const r = await run(() => api('/squad/offers', { method: 'POST', body }));
        if (!r) return null;
        putOffers([{ ...offerA(r.offer), mine: true, co: me?.companies?.[0]?.name || p.name }]);
        patch((s) => { s.myOfferIds = [r.offer.id, ...(s.myOfferIds || [])]; s.feed = null; });
        toast(budget ? 'Saved. It goes live once the budget is paid.' : 'Your listing is live');
        return r.offer.id;
      },
      async addSocial(f) {
        if (!me?.marketer) { patch((s) => { s.setup = 'marketer'; }); return false; }
        const r = await run(() => api('/squad/socials', { method: 'POST', body: { platform: f.platform, handle: f.handle, followers: +f.followers || 0, url: f.url || undefined } }));
        if (r) { await loadMe(); toast('Added. An admin will verify it.'); }
        return !!r;
      },

      /* deals (relationships), chat, deliveries */
      async loadDeals() {
        const r = await run(() => api('/squad/relationships' + qs({ as: ref.current.role })), { quiet: true });
        patch((s) => { s.deals = (r?.relationships || []).map(dealA); });
      },
      async loadDeal(id) {
        const [r, m, d] = await Promise.all([run(() => api('/squad/relationships/' + id), { quiet: true }), run(() => api(`/squad/relationships/${id}/messages?limit=100`), { quiet: true }), run(() => api(`/squad/relationships/${id}/deliveries`), { quiet: true })]);
        if (r) { const deal = dealA(r.relationship); patch((s) => { const list = s.deals || []; s.deals = list.some((x) => x.id === id) ? list.map((x) => x.id === id ? { ...x, ...deal } : x) : [deal, ...list]; }); if (!ref.current.offers[deal.offer]?.full) act.loadOffer(deal.offer); }
        if (m) patch((s) => { s.msgs = { ...s.msgs, [id]: m.messages }; });
        if (d) patch((s) => { s.dels = { ...s.dels, [id]: d.deliveries.map(delA) }; });
        api(`/squad/relationships/${id}/read`, { method: 'POST' }).then(() => patch((s) => { s.deals = (s.deals || []).map((x) => x.id === id ? { ...x, unread: 0 } : x); })).catch(() => {});
      },
      async loadDels(id) {
        const d = await api(`/squad/relationships/${id}/deliveries`).catch(() => null);
        if (d) patch((s) => { s.dels = { ...s.dels, [id]: d.deliveries.map(delA) }; });
      },
      async pollMsgs(id) {
        const list = ref.current.msgs[id] || [], after = list.length ? list[list.length - 1].created_at : 0;
        const r = await api(`/squad/relationships/${id}/messages${qs({ after })}`).catch(() => null);
        if (r?.messages.length) { patch((s) => { const cur = s.msgs[id] || []; const ids = new Set(cur.map((x) => x.id)); s.msgs = { ...s.msgs, [id]: [...cur, ...r.messages.filter((x) => !ids.has(x.id))] }; }); api(`/squad/relationships/${id}/read`, { method: 'POST' }).catch(() => {}); }
      },
      async send(d, t) {
        const body = t.trim(); if (!body) return;
        const r = await run(() => api(`/squad/relationships/${d.id}/messages`, { method: 'POST', body: { body } }));
        if (r) patch((s) => { s.msgs = { ...s.msgs, [d.id]: [...(s.msgs[d.id] || []), r.message] }; s.deals = (s.deals || []).map((x) => x.id === d.id ? { ...x, lastAt: r.message.created_at } : x); });
      },
      async report(d, proof) {
        const social = me?.socials?.find((x) => !x.is_blocked);
        const body = social ? { delivery_type: 'social_post', social_id: social.id, proof_url: proof } : { delivery_type: 'in_person', proof_url: proof };
        const r = await run(() => api(`/squad/relationships/${d.id}/deliveries`, { method: 'POST', body }));
        if (r) { await act.loadDeal(d.id); toast('Reported. Waiting for the seller to verify.'); }
        return !!r;
      },
      async uploadVideo(d, file) {
        toast('Uploading video…');
        const m = await act.uploadMedia(file, 'creator_video'); if (!m) return false;
        const social = me?.socials?.find((x) => !x.is_blocked);
        const body = social ? { delivery_type: 'video', social_id: social.id, media_id: m.id } : { delivery_type: 'in_person', media_id: m.id };
        const r = await run(() => api(`/squad/relationships/${d.id}/deliveries`, { method: 'POST', body }));
        if (r) { await act.loadDeal(d.id); toast('Video sent for review'); }
        return !!r;
      },
      async verify(d, x, amount) {
        const r = await run(() => api(`/squad/deliveries/${x.id}/verify`, { method: 'POST', body: amount ? { amount_cents: amount } : {} }));
        if (r) { await act.loadDeal(d.id); act.loadOffer(d.offer); toast('Verified'); }
        return !!r;
      },
      async reject(d, x, note) {
        const r = await run(() => api(`/squad/deliveries/${x.id}/reject`, { method: 'POST', body: { note: note || 'Not accepted' } }));
        if (r) { await act.loadDeal(d.id); toast('Rejected'); }
        return !!r;
      },
      async setDeal(d, status) {
        const r = await run(() => api(`/squad/relationships/${d.id}/status`, { method: 'POST', body: { status } }));
        if (r) { patch((s) => { s.deals = (s.deals || []).map((x) => x.id === d.id ? { ...x, status: r.relationship.status } : x); }); toast(status === 'ended' ? 'Deal ended' : status === 'paused' ? 'Deal paused' : 'Deal resumed'); }
      },
      pauseDeal: (d) => act.setDeal(d, d.status === 'paused' ? 'active' : 'paused'),
      endDeal: (d) => { if (confirm('End this deal? This cannot be undone.')) act.setDeal(d, 'ended'); },
      refreshMe: loadMe,
    };
    return act;
  }, [S.me, S.role, S.auth, patch, toast, run, loadMe]);

  return <Ctx.Provider value={{ S, a }}>{children}</Ctx.Provider>;
}

export const offerOf = (S, id) => S.offers[id];
export const prodOf = (S, id) => S.products[id];
/* what the screens show under "Who can apply": each rule with a tick or a cross for this marketer */
export function elig(o, a) {
  const r = o.req || {}, res = [], known = o.eligible !== undefined && o.eligible !== null, bad = (w) => known && !o.eligible && o.reasons.some((x) => x.includes(w));
  if (r.min_followers) res.push({ ok: !bad('account'), t: r.min_followers.toLocaleString() + '+ followers', you: a?.me ? 'You have ' + a.me.followers.toLocaleString() : '' });
  if (r.countries?.length) res.push({ ok: !bad('based'), t: 'Based in ' + r.countries.join(' / '), you: a?.me?.country ? 'You are in ' + a.me.country : '' });
  if (r.platforms?.length) res.push({ ok: !bad('account'), t: 'Posts on ' + r.platforms.map((p) => PLATFORMS.find((x) => x[0] === p)?.[1] || p).join(' or '), you: !a?.me ? '' : a.me.socials.length ? 'You have ' + a.me.socials.map((x) => PLATFORMS.find((q) => q[0] === x.platform)?.[1] || x.platform).join(', ') : 'Add your accounts in Profile' });
  if (r.verified_socials && !r.verified_only) res.push({ ok: !bad('verified'), t: 'A verified account', you: a?.me ? (a.me.socials.some((x) => x.is_verified) ? 'You have one' : 'None verified yet') : '' });
  if (r.verified_only) res.push({ ok: !bad('verified'), t: 'Verified marketers', you: a?.me ? (a.me.verified ? 'You are verified' : 'Not verified yet') : '' });
  return { ok: known ? !!o.eligible : true, res, known };
}
