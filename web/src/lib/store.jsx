// Mock store. Replace the bodies of these actions with calls to /api/squad/* to go live;
// screens only talk to the store, never to data directly.
import { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import { seed, ME, FEE, TYPES, artFor, elig, prodOf, offerOf } from './data.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const hasMsg = (d) => d.msgs.length > 0;
const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function StoreProvider({ children }) {
  const [S, setS] = useState(() => { const s = seed(); s.deals.forEach(d => d.msgs.forEach((m, i) => (m.at = m.at || ['9:12','9:40','10:05','10:31'][i % 4]))); s.applied = {}; s.toast = null; s.n = 40; return s; });
  const mutate = useCallback((fn) => setS(prev => { const next = structuredClone(prev); fn(next); return next; }), []);
  const toast = useCallback((m) => { mutate(s => { s.toast = { m, k: Date.now() }; }); }, [mutate]);
  useEffect(() => { if (!S.toast) return; const t = setTimeout(() => setS(s => ({ ...s, toast: null })), 2200); return () => clearTimeout(t); }, [S.toast?.k]);

  const me = ME[S.role];
  const a = useMemo(() => ({
    me,
    toast,
    setRole: () => mutate(s => { s.role = s.role === 'marketer' ? 'seller' : 'marketer'; }),
    isMine: (o) => S.role === 'seller' && o.owner === 'u-kofi',
    myInterest: (o) => S.interests.find(i => i.offer === o.id && i.from === 'u-ada' && i.status === 'pending'),
    dealFor: (o) => S.deals.find(d => d.offer === o.id && d.marketer === 'u-ada' && d.status !== 'ended'),
    myDeals: () => S.deals.filter(d => S.role === 'seller' ? offerOf(S, d.offer).owner === 'u-kofi' : d.marketer === 'u-ada'),
    apply(o) {
      if (!elig(o).ok) return toast("You don't meet the requirements");
      mutate(s => { s.interests.push({ id: 'i' + (++s.n), offer: o.id, from: 'u-ada', msg: "Hi! I'd love to promote this to my community in Lagos.", status: 'pending' }); s.toast = { m: 'Applied. The seller will accept or deny.', k: Date.now() }; });
    },
    withdraw(o) { mutate(s => { const i = s.interests.find(x => x.offer === o.id && x.from === 'u-ada' && x.status === 'pending'); if (i) i.status = 'withdrawn'; s.toast = { m: 'Request withdrawn', k: Date.now() }; }); },
    toggleOffer: (o) => mutate(s => { const x = s.offers.find(y => y.id === o.id); x.status = x.status === 'open' ? 'paused' : 'open'; }),
    accept(i) {
      let id; mutate(s => { const x = s.interests.find(y => y.id === i.id); x.status = 'accepted'; const o = offerOf(s, x.offer);
        id = 'd' + (++s.n); s.deals.push({ id, offer: o.id, marketer: x.from, status: 'active', terms: { ...o.terms }, since: 'today', msgs: [{ f: 'u-kofi', t: "Welcome! Your terms are locked in. Let's get started.", at: now() }], dels: [] });
        s.toast = { m: 'Accepted. Chat opened.', k: Date.now() }; });
      return id;
    },
    deny: (i) => mutate(s => { s.interests.find(y => y.id === i.id).status = 'denied'; s.toast = { m: 'Interest denied', k: Date.now() }; }),
    send: (d, t) => t.trim() && mutate(s => { s.deals.find(x => x.id === d.id).msgs.push({ f: ME[s.role].id, t: t.trim(), at: now() }); }),
    report: (d, proof) => mutate(s => { s.deals.find(x => x.id === d.id).dels.push({ id: 'x' + (++s.n), kind: 'Social post', proof, status: 'pending', amount: null }); s.toast = { m: 'Reported. Waiting for the seller.', k: Date.now() }; }),
    uploadVideo: (d) => mutate(s => { s.deals.find(x => x.id === d.id).dels.push({ id: 'x' + (++s.n), kind: 'Creator video', proof: 'my-review.mp4', video: '0:45', by: 'Ada Okafor', status: 'pending', amount: null }); s.toast = { m: 'Creator video uploaded.', k: Date.now() }; }),
    verify(d, x, amount) {
      const o = offerOf(S, d.offer), F = o.fin; const earned = d.dels.filter(z => z.status === 'verified' && z.id !== x.id).reduce((n, z) => n + (z.amount || 0), 0);
      const left = F.budget == null ? null : Math.max(0, F.budget - F.spent);
      if (F.budget && amount > left) { toast('Only a bit is left in the budget'); return false; }
      if (F.cap && earned + amount > F.cap) { toast("Over this marketer's cap"); return false; }
      mutate(s => { const dd = s.deals.find(y => y.id === d.id), xx = dd.dels.find(y => y.id === x.id); xx.status = 'verified'; xx.amount = amount; offerOf(s, dd.offer).fin.spent += amount; s.toast = { m: 'Verified', k: Date.now() }; });
      return true;
    },
    reject: (d, x) => mutate(s => { s.deals.find(y => y.id === d.id).dels.find(y => y.id === x.id).status = 'rejected'; }),
    pauseDeal: (d) => mutate(s => { const x = s.deals.find(y => y.id === d.id); x.status = x.status === 'paused' ? 'active' : 'paused'; }),
    endDeal: (d) => mutate(s => { s.deals.find(y => y.id === d.id).status = 'ended'; s.toast = { m: 'Deal ended', k: Date.now() }; }),
    addProduct(n) {
      let id; mutate(s => { id = 'p' + (++s.n); s.products.push({ id, owner: 'u-kofi', mine: true, name: n.name.trim(), category: n.category, art: artFor(n.category), gallery: [artFor(n.category)], img: n.img, video: n.video ? '0:30' : null, desc: n.desc }); s.toast = { m: 'Product saved', k: Date.now() }; });
      return id;
    },
    addOffer(P, p, terms, b, cap) {
      let id; mutate(s => { id = 'o' + (++s.n); s.offers.unshift({ id, pid: p.id, owner: 'u-kofi', co: ME.seller.company, coV: true, title: P.title || 'Promote ' + p.name, type: P.type, terms, req: { min_followers: +P.minf || 0, countries: P.countries, verified_only: P.verified }, desc: P.desc || p.desc, status: 'open', max: 10, likes: 0, fin: { cur: P.cur, budget: b, cap, funded: !!b, spent: 0 } }); s.toast = { m: b ? 'Payment received. Your offer is live.' : 'Your offer is live', k: Date.now() }; });
      return id;
    },
  }), [S, me, mutate, toast]);
  return <Ctx.Provider value={{ S, a }}>{children}</Ctx.Provider>;
}
