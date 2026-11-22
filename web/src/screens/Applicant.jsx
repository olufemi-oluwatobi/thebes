import { useEffect, useState } from 'react';
import { useStore, offerOf } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { api } from '../lib/api.js';
import { GOALS, money, FEE } from '../lib/data.js';
import { Page, Card, Button, Ic, Chip, Empty, cx } from '../ui/index.jsx';
import { CreatorView, useCreator, platName, countryName, k } from '../ui/creator.jsx';

// what taking one creator on costs: the budget per creator plus our fee, held from the seller's wallet
export const holdFor = (o) => o?.job ? o.job + Math.round(o.job * FEE / 10000) : 0;
// can the seller take someone on? Listings with a budget per creator need it in the wallet; older listings need a funded budget
export const hasFunds = (o, wallet) => o?.job ? (wallet?.balance?.[o.fin?.cur || 'USD'] || 0) >= holdFor(o) : !!(o?.fin?.budget && o.fin.funded && o.fin.budget - o.fin.spent > 0);
export const walletFor = { set: (v) => { try { sessionStorage.setItem('gs_wallet_for', JSON.stringify(v)); } catch {} }, take: () => { try { const v = JSON.parse(sessionStorage.getItem('gs_wallet_for') || 'null'); sessionStorage.removeItem('gs_wallet_for'); return v; } catch { return null; } } };

/* #applicant/<interest id>: who applied, what they bring, and Interested / Not interested */
export default function Applicant({ id }) {
  const { S, a } = useStore();
  const [i, setI] = useState(null), [err, setErr] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => { api('/squad/interests/' + id).then((r) => { setI(r.interest); a.loadOffer(r.interest.offer_id); }).catch(() => setErr(true)); a.loadWallet(); }, [id]);
  const { d } = useCreator(i?.marketer_id);
  const o = i ? offerOf(S, i.offer_id) : null;
  const name = d ? (d.user?.display_name || (d.socials?.[0] ? '@' + d.socials[0].handle : 'this creator')) : 'this creator';
  if (err) return <Page crumb="Application" onBack={() => history.back()}><Empty icon={<Ic.Me />} title="Application not found" text="It may have been withdrawn." /></Page>;
  if (!i || !d) return <Page crumb="Application" onBack={() => history.back()}><div className="grid h-40 place-items-center"><span className="h-8 w-8 animate-spin rounded-full border-2 border-cream-200 border-t-army" /></div></Page>;

  const req = i.offer.requirements || {}, s = i.social, m = d.marketer;
  const n = s ? (s.is_verified && s.verified_followers != null ? s.verified_followers : s.followers) : 0;
  const fit = [
    req.platforms?.length && { ok: !!s && req.platforms.includes(s.platform), t: 'Posts on ' + req.platforms.map(platName).join(' or '), v: s ? platName(s.platform) : 'No account picked' },
    req.min_followers && { ok: n >= req.min_followers, t: k(req.min_followers) + '+ followers', v: k(n) + (s?.is_verified ? ' verified' : ' claimed') },
    req.countries?.length && { ok: req.countries.includes(m.country), t: 'Based in ' + req.countries.map(countryName).join(' or '), v: countryName(m.country) },
    req.verified_socials && { ok: !!s?.is_verified, t: 'Verified account', v: s?.is_verified ? 'Verified' : 'Not verified' },
    req.verified_only && { ok: !!m.is_verified, t: 'Verified creator', v: m.is_verified ? 'Verified' : 'Not verified' },
  ].filter(Boolean);
  const pending = i.status === 'pending';

  const interested = async () => {
    const w = await a.loadWallet();
    if (!hasFunds(o, w)) { walletFor.set({ offer: i.offer_id, title: i.offer.title, who: name, back: 'applicant/' + id, need: holdFor(o) }); a.toast('Top up to take on ' + name); return go(o?.job ? 'topup' : 'wallet'); }
    setBusy(true); const rel = await a.accept({ id: i.id }); setBusy(false); if (rel) { walletFor.take(); a.loadWallet(); go('chats/' + rel); }
  };
  const notInterested = async () => { setBusy(true); await a.deny({ id: i.id }); setBusy(false); setI({ ...i, status: 'denied' }); };

  return (
    <Page crumb="Application" onBack={() => history.back()} barDesktop
      bar={pending ? <><Button tone="secondary" size="lg" className="flex-1" disabled={busy} onClick={notInterested}>Not interested</Button><Button size="lg" className="flex-1" disabled={busy} onClick={interested}>Interested</Button></>
        : i.relationship_id && i.status === 'accepted' ? <Button size="lg" block onClick={() => go('chats/' + i.relationship_id)}>Open the deal</Button> : null}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <button onClick={() => go('offer/' + i.offer_id)} className="flex items-center gap-2 self-start rounded-full bg-paper py-1.5 pl-3 pr-4 text-small"><span className="text-ink-soft">Applied for</span><b className="max-w-[220px] truncate">{i.offer.title}</b><Chip tone="sage">{GOALS.find((g) => g[0] === i.offer.type)?.[1] || i.offer.type}</Chip></button>
        {!pending && <div className={cx('rounded-card p-4 text-small font-semibold', i.status === 'accepted' ? 'bg-sage-50 text-sage-700' : 'bg-cream-100 text-ink-soft')}>{i.status === 'accepted' ? 'You took ' + name + ' on.' : i.status === 'denied' ? 'You passed on this application.' : 'This application was withdrawn.'}</div>}
        <CreatorView d={d} highlight={s?.id} />
        {fit.length > 0 && <Card title="Fit for this listing">
          <ul className="-my-2">{fit.map((x, j) => <li key={x.t} className={cx('flex min-h-[52px] items-center gap-3 py-2', j && 'border-t border-cream-100')}>
            <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-full', x.ok ? 'bg-sage-50 text-sage-700' : 'bg-[#FBEAE4] text-[#A23B17]')}>{x.ok ? <Ic.Check width="14" height="14" /> : <Ic.X_ width="14" height="14" />}</span>
            <span className="flex-1 text-small font-semibold">{x.t}</span><span className="text-small text-ink-soft">{x.v}</span></li>)}</ul>
        </Card>}
        {pending && o?.job > 0 && <p className={cx('flex gap-2 rounded-card p-4 text-small', hasFunds(o, S.wallet) ? 'bg-sage-50 text-sage-700' : 'bg-[#FBF3E4] text-[#8A6414]')}><Ic.Wallet width="18" height="18" className="shrink-0" />{hasFunds(o, S.wallet) ? money(holdFor(o), o.fin.cur) + ' will be held from your wallet for this job (budget ' + money(o.job, o.fin.cur) + ' + fee).' : 'Taking ' + name + ' on holds ' + money(holdFor(o), o.fin.cur) + '. Your wallet has ' + money(S.wallet?.balance?.[o.fin.cur] || 0, o.fin.cur) + '.'}</p>}
        {pending && o && !o.job && !hasFunds(o) && <p className="flex gap-2 rounded-card bg-[#FBF3E4] p-4 text-small text-[#8A6414]"><Ic.Wallet width="18" height="18" className="shrink-0" />This listing has no funds yet. You'll add them before taking anyone on.</p>}
      </div>
    </Page>
  );
}
