import { useEffect, useState } from 'react';
import { useStore, offerOf } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { money } from '../lib/data.js';
import { Page, PageTitle, Card, Button, Ic, Status, Empty, cx } from '../ui/index.jsx';
import { walletFor } from './Applicant.jsx';

/* #wallet: the money behind your listings. Top-ups come in the next phase; for now each listing carries its own budget. */
export default function Wallet() {
  const { S, a } = useStore();
  const [why] = useState(() => walletFor.take());
  useEffect(() => { if (S.auth === 'in' && a.hasSeller) a.loadSeller(); }, [S.auth, a.hasSeller]);
  const offers = (S.myOfferIds || []).map((id) => offerOf(S, id)).filter(Boolean);
  const cur = offers[0]?.fin.cur || 'USD';
  const rows = offers.map((o) => { const F = o.fin, left = F.budget ? Math.max(0, F.budget - F.spent) : 0;
    return { o, F, left, state: !F.budget ? 'none' : F.funded ? (left > 0 ? 'funded' : 'spent') : 'due' }; });
  const available = rows.filter((r) => r.state === 'funded').reduce((n, r) => n + r.left, 0);
  const due = rows.filter((r) => r.state === 'due').reduce((n, r) => n + (r.F.due || r.F.budget + r.F.fee), 0);
  const spent = rows.reduce((n, r) => n + r.F.spent, 0);
  const label = { funded: ['Funded', 'bg-sage-50 text-sage-700'], due: ['Awaiting payment', 'bg-[#FBF3E4] text-[#8A6414]'], spent: ['Used up', 'bg-cream-100 text-ink-soft'], none: ['No budget', 'bg-cream-100 text-ink-soft'] };

  return (
    <Page crumb="Wallet" onBack={() => (why?.back ? go(why.back) : go('me'))}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <PageTitle h="Wallet" p="The money behind your listings. Creators are paid from it as results are approved." className="!mb-0" />
        {why && <div className="flex gap-3 rounded-card bg-[#FBF3E4] p-4 text-small text-[#8A6414]"><Ic.Wallet width="20" height="20" className="shrink-0" /><span>Add funds to <b>{why.title}</b> before you take on {why.who}. Creators only join funded listings.</span></div>}
        <Card>
          <div className="text-caption font-semibold uppercase tracking-wider text-ink-faint">Available to pay creators</div>
          <div className="tnum mt-2 font-serif text-[44px] leading-none">{money(available, cur)}</div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-small"><div className="rounded-xl bg-cream-50 p-3"><div className="text-ink-soft">Awaiting payment</div><b className="tnum">{money(due, cur)}</b></div><div className="rounded-xl bg-cream-50 p-3"><div className="text-ink-soft">Paid to creators</div><b className="tnum">{money(spent, cur)}</b></div></div>
          <Button size="lg" block className="mt-5" disabled><Ic.Plus width="18" height="18" />Add funds</Button>
          <p className="mt-2 text-center text-caption text-ink-faint">Wallet top-ups are coming next. For now, fund a listing's budget from the listing.</p>
        </Card>
        <Card title="Listings" pad={false} className="overflow-hidden">
          {!S.myOfferIds ? <div className="grid h-24 place-items-center"><span className="h-7 w-7 animate-spin rounded-full border-2 border-cream-200 border-t-army" /></div>
            : rows.length ? rows.map((r, j) => (
              <button key={r.o.id} onClick={() => go('offer/' + r.o.id)} className={cx('flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-cream-50', j && 'border-t border-cream-100', why?.offer === r.o.id && 'bg-[#FBF3E4]/60')}>
                <div className="min-w-0 flex-1"><div className="truncate font-semibold">{r.o.title}</div><div className="tnum text-small text-ink-soft">{r.F.budget ? money(r.left, r.F.cur) + ' left of ' + money(r.F.budget, r.F.cur) : 'No budget set'}</div></div>
                <span className={cx('shrink-0 rounded-full px-2.5 py-1 text-caption font-semibold', label[r.state][1])}>{label[r.state][0]}</span><Ic.Chev width="18" height="18" className="text-ink-faint" />
              </button>))
            : <div className="p-5"><Empty icon={<Ic.Wallet />} title="No listings yet" text="Create a listing with a budget to fund it." action={<Button onClick={() => go('plus')}>List a product</Button>} /></div>}
        </Card>
      </div>
    </Page>
  );
}
