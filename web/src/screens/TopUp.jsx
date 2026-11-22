import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go } from '../lib/router.js';
import { api } from '../lib/api.js';
import { money } from '../lib/data.js';
import { Page, PageTitle, Card, Button, Input, Field, Ic, Rows, cx } from '../ui/index.jsx';
import { walletFor } from './Applicant.jsx';

const PRESETS = [2500, 5000, 10000, 25000];

/* #topup: put money in the wallet. Until payments are connected, we give a reference and credit it when the money lands. */
export default function TopUp() {
  const { a } = useStore();
  const [why] = useState(() => { const v = walletFor.take(); if (v) walletFor.set(v); return v; });
  const [amt, setAmt] = useState(() => why?.need ? (Math.ceil(why.need / 100)).toString() : '50'), [busy, setBusy] = useState(false), [done, setDone] = useState(null);
  const cents = Math.round((+amt || 0) * 100);
  const submit = async () => {
    if (cents < 100) return a.toast('Top up at least ' + money(100));
    setBusy(true); const r = await a.run(() => api('/squad/wallet/topups', { method: 'POST', body: { amount_cents: cents, currency: 'USD' } })); setBusy(false);
    if (r?.checkout_url) { setBusy(true); location.href = r.checkout_url; return; } // pay on the Bachs page, then come back
    if (r) { setDone(r.topup); a.loadWallet(); }
  };
  if (done) return (
    <Page crumb="Top up" onBack={() => go('wallet')} bar={<Button size="lg" block onClick={() => go(why?.back || 'wallet')}>{why?.back ? 'Back to the application' : 'Back to wallet'}</Button>}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageTitle h="Almost there" p="Pay with the reference below. Your wallet is credited as soon as the payment lands." className="!mb-0" />
        <Card>
          <Rows rows={[['Amount', <b className="tnum">{money(done.amount_cents, done.currency)}</b>], ['Reference', <button onClick={() => { navigator.clipboard?.writeText(done.reference); a.toast('Copied'); }} className="inline-flex items-center gap-2 font-mono font-bold">{done.reference}<Ic.Copy width="15" height="15" className="text-ink-soft" /></button>], ['Status', 'Waiting for payment']]} />
        </Card>
        <p className="flex gap-2 text-small text-ink-soft"><Ic.Shield width="18" height="18" className="shrink-0 text-sage-700" />Card, bank transfer and mobile money checkout is coming. Until then our team confirms each top-up.</p>
      </div>
    </Page>
  );
  return (
    <Page crumb="Top up" onBack={() => go('wallet')} barDesktop bar={<Button size="lg" block disabled={busy} onClick={submit}>{busy ? 'Starting…' : 'Top up ' + (cents ? money(cents) : '')}</Button>}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageTitle h="Top up your wallet" p="Creators are paid from your wallet. A job's budget is held when you accept someone." className="!mb-0" />
        {why?.need > 0 && <div className="flex gap-3 rounded-card bg-[#FBF3E4] p-4 text-small text-[#8A6414]"><Ic.Wallet width="20" height="20" className="shrink-0" /><span>Taking on {why.who} needs {money(why.need)} in your wallet.</span></div>}
        <Card>
          <div className="grid grid-cols-4 gap-2">{PRESETS.map((p) => <button key={p} onClick={() => setAmt(String(p / 100))} className={cx('h-12 rounded-xl text-small font-semibold transition', cents === p ? 'bg-army text-onarmy' : 'bg-cream-100 hover:bg-cream-200')}>{money(p)}</button>)}</div>
          <div className="mt-5" /><Field label="Amount"><Input type="number" min="1" step="1" pre="$" value={amt} onChange={(e) => setAmt(e.target.value)} /></Field>
        </Card>
      </div>
    </Page>
  );
}
