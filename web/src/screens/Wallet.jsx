import { useEffect, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { api } from '../lib/api.js';
import { money, day } from '../lib/data.js';
import { Page, PageTitle, Card, Button, Ic, Empty, Sheet, Field, Input, Textarea, Segmented, cx } from '../ui/index.jsx';
import { walletFor } from './Applicant.jsx';

const KIND = { topup: 'Top-up', hold: 'Held for a job', fee: 'Fee', refund: 'Job cancelled, returned', earning: 'Job done', payout: 'Withdrawal', payout_return: 'Withdrawal cancelled', adjust: 'Adjustment' };

/* #wallet: what you have, what is held in jobs, what is on its way to you, and every movement */
export default function Wallet() {
  const { S, a } = useStore();
  const [why] = useState(() => walletFor.take()), [out, setOut] = useState(false);
  useEffect(() => { if (S.auth === 'in') a.loadWallet(); }, [S.auth]);
  const w = S.wallet, cur = 'USD';
  if (S.auth === 'out') return <Page crumb="Wallet"><Empty icon={<Ic.Wallet />} title="Your wallet" text="Sign in to top up and pay creators, or to get paid." action={<Button onClick={() => a.openSignin()}>Sign in</Button>} /></Page>;
  const bal = w?.balance?.[cur] || 0, held = w?.held?.[cur] || 0, incoming = w?.incoming?.[cur] || 0;
  const cancelTopup = async (t) => { if (await a.run(() => api(`/squad/wallet/topups/${t.id}/cancel`, { method: 'POST', body: {} }))) a.loadWallet(); };

  return (
    <Page crumb="Wallet" onBack={() => (why?.back ? go(why.back) : go('me'))}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <PageTitle h="Wallet" className="!mb-0" />
        {why && <div className="flex gap-3 rounded-card bg-[#FBF3E4] p-4 text-small text-[#8A6414]"><Ic.Wallet width="20" height="20" className="shrink-0" /><span>Top up to take on {why.who} for <b>{why.title}</b>. {why.need ? money(why.need, cur) + ' is held from your wallet when you accept.' : ''}</span></div>}
        <Card>
          <div className="text-caption font-semibold uppercase tracking-wider text-ink-faint">Balance</div>
          <div className="tnum mt-2 font-serif text-[44px] leading-none">{w ? money(bal, cur) : '…'}</div>
          {(held > 0 || incoming > 0) && <div className="mt-4 grid grid-cols-2 gap-3 text-small">
            {held > 0 && <div className="rounded-xl bg-cream-50 p-3"><div className="text-ink-soft">Held in jobs</div><b className="tnum">{money(held, cur)}</b></div>}
            {incoming > 0 && <div className="rounded-xl bg-sage-50 p-3"><div className="text-sage-700">On its way to you</div><b className="tnum">{money(incoming, cur)}</b></div>}
          </div>}
          <div className="mt-5 flex gap-3">
            {S.role === 'seller' && <Button size="lg" className="flex-1" onClick={() => { if (why) walletFor.set(why); go('topup'); }}><Ic.Plus width="18" height="18" />Top up</Button>}
            <Button size="lg" tone={S.role === 'seller' ? 'secondary' : 'primary'} className="flex-1" disabled={bal < 100} onClick={() => setOut(true)}>Withdraw</Button>
          </div>
        </Card>

        {w?.topups?.length > 0 && <Card title="Top-ups waiting" sub="Your wallet is credited once the payment lands.">
          <ul className="-my-2">{w.topups.map((t, i) => <li key={t.id} className={cx('flex items-center gap-3 py-3', i && 'border-t border-cream-100')}><div className="min-w-0 flex-1"><b className="tnum">{money(t.amount_cents, t.currency)}</b><div className="text-caption text-ink-soft">Reference {t.reference} · {day(t.created_at)}</div></div><button onClick={() => cancelTopup(t)} className="text-small font-semibold text-ink-soft hover:text-ink">Cancel</button></li>)}</ul>
        </Card>}

        {w?.holds?.length > 0 && <Card title="Held in jobs" sub="Paid to the creator when the job is done, or returned if it's cancelled.">
          <ul className="-my-2">{w.holds.map((h, i) => <li key={h.id}><button onClick={() => go('chats/' + h.relationship_id)} className={cx('flex w-full items-center gap-3 py-3 text-left', i && 'border-t border-cream-100')}><div className="min-w-0 flex-1"><div className="truncate font-semibold">{h.offer_title}</div><div className="truncate text-caption text-ink-soft">{h.other} · since {day(h.created_at)}</div></div><b className="tnum">{money(h.amount_cents, h.currency)}</b><Ic.Chev width="16" height="16" className="text-ink-faint" /></button></li>)}</ul>
        </Card>}

        {w?.incoming_holds?.length > 0 && <Card title="On its way to you" sub="Held for your jobs. It lands in your wallet when the job is marked done.">
          <ul className="-my-2">{w.incoming_holds.map((h, i) => <li key={h.id}><button onClick={() => go('chats/' + h.relationship_id)} className={cx('flex w-full items-center gap-3 py-3 text-left', i && 'border-t border-cream-100')}><div className="min-w-0 flex-1"><div className="truncate font-semibold">{h.offer_title}</div><div className="truncate text-caption text-ink-soft">{h.other}</div></div><b className="tnum text-sage-700">{money(h.amount_cents, h.currency)}</b></button></li>)}</ul>
        </Card>}

        <Card title="Activity" pad={false} className="overflow-hidden">
          {!w ? <div className="grid h-24 place-items-center"><span className="h-7 w-7 animate-spin rounded-full border-2 border-cream-200 border-t-army" /></div>
            : w.entries.length ? <ul>{w.entries.map((e, i) => <li key={e.id} className={cx('flex items-center gap-3 px-5 py-3', i && 'border-t border-cream-100')}>
                <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-full', e.amount_cents > 0 ? 'bg-sage-50 text-sage-700' : 'bg-cream-100 text-ink-soft')}>{e.amount_cents > 0 ? <Ic.Plus width="16" height="16" /> : <Ic.Minus width="16" height="16" />}</span>
                <div className="min-w-0 flex-1"><div className="truncate text-small font-semibold">{KIND[e.kind] || e.kind}</div><div className="truncate text-caption text-ink-soft">{e.note && e.note !== KIND[e.kind] ? e.note + ' · ' : ''}{day(e.created_at)}</div></div>
                <b className={cx('tnum text-small', e.amount_cents > 0 && 'text-sage-700')}>{(e.amount_cents > 0 ? '+' : '−') + money(Math.abs(e.amount_cents), e.currency)}</b></li>)}</ul>
            : <div className="p-5"><Empty icon={<Ic.Wallet />} title="Nothing yet" text="Top up to take on creators. Money you earn lands here too." /></div>}
        </Card>

        {w?.payouts?.length > 0 && <Card title="Withdrawals"><ul className="-my-2">{w.payouts.map((p, i) => <li key={p.id} className={cx('flex items-center justify-between gap-3 py-3 text-small', i && 'border-t border-cream-100')}><span>{money(p.amount_cents, p.currency)} · {p.method === 'mobile_money' ? 'Mobile money' : p.method === 'bank' ? 'Bank' : 'Crypto'} · {day(p.created_at)}</span><span className={cx('rounded-full px-2.5 py-1 text-caption font-semibold', p.status === 'paid' ? 'bg-sage-50 text-sage-700' : p.status === 'cancelled' ? 'bg-cream-100 text-ink-soft' : 'bg-[#FBF3E4] text-[#8A6414]')}>{p.status === 'requested' ? 'Processing' : p.status === 'paid' ? 'Paid' : 'Cancelled'}</span></li>)}</ul></Card>}
      </div>
      <WithdrawSheet open={out} onClose={() => setOut(false)} max={bal} cur={cur} />
    </Page>
  );
}

function WithdrawSheet({ open, onClose, max, cur }) {
  const { a } = useStore();
  const [amt, setAmt] = useState(''), [method, setMethod] = useState('bank'), [details, setDetails] = useState(''), [busy, setBusy] = useState(false);
  const cents = Math.round((+amt || 0) * 100);
  const send = async () => {
    if (cents < 100 || cents > max) return a.toast('Enter an amount between ' + money(100, cur) + ' and ' + money(max, cur));
    if (details.trim().length < 5) return a.toast('Add where the money should go');
    setBusy(true); const r = await a.run(() => api('/squad/wallet/payouts', { method: 'POST', body: { amount_cents: cents, currency: cur, method, details: details.trim() } })); setBusy(false);
    if (r) { a.toast("Withdrawal requested. We'll send it shortly."); a.loadWallet(); onClose(); setAmt(''); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Withdraw" sub={'Up to ' + money(max, cur) + '.'} footer={<Button size="lg" block disabled={busy} onClick={send}>{busy ? 'Sending…' : cents ? 'Withdraw ' + money(cents, cur) : 'Withdraw'}</Button>}>
      <div className="flex flex-col gap-5">
        <Field label="Amount" aside={<button type="button" className="text-small font-semibold text-sage-700" onClick={() => setAmt((max / 100).toFixed(2))}>All</button>}><Input type="number" min="1" step="0.01" pre="$" placeholder="0.00" value={amt} onChange={(e) => setAmt(e.target.value)} /></Field>
        <Field label="Send it to"><Segmented value={method} onChange={setMethod} items={[['bank', 'Bank'], ['mobile_money', 'Mobile money'], ['crypto', 'USDT/USDC']]} /></Field>
        <Field label={method === 'bank' ? 'Bank, account number and name' : method === 'mobile_money' ? 'Network, number and name' : 'Network and wallet address'}><Textarea rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={method === 'bank' ? 'GTBank · 0123456789 · Ama Mensah' : method === 'mobile_money' ? 'MTN · 024 000 0000 · Ama Mensah' : 'USDT on Tron · T…'} /></Field>
      </div>
    </Sheet>
  );
}
