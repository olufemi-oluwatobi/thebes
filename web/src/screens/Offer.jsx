import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { go, back } from '../lib/router.js';
import { CATS, TYPES, money, FEE, prodOf, offerOf, elig, PEOPLE, initials } from '../lib/data.js';
import { Page, Card, Rows, Button, Tag, Chip, Ic, Avatar, Sheet, ProductArt } from '../ui/index.jsx';
import { Gallery, Steps, ActionBar, Player } from '../ui/parts.jsx';

const HOW = {
  commission: [['Apply', 'Send a short note. The seller reviews it.'], ['Share your link', 'Promote it to your own audience in your own words.'], ['Earn per sale', 'Each verified sale pays your commission from the budget.']],
  attention: [['Apply', 'Send a short note. The seller reviews it.'], ['Post it', 'Share to your audience and report the proof link or video.'], ['Get paid per result', 'Each verified click or view earns the rate until the budget runs out.']],
  introduction: [['Apply', 'Tell the seller who you can introduce.'], ['Make the intro', 'Connect them with a real buyer and keep the chat going.'], ['Share the contract', 'When a contract signs, you earn your share.']],
};
export const fieldLabel = (k) => ({ percent: 'Commission', cookie_days: 'Attribution window', rate_cents: 'Rate', per: 'Paid per', share_percent: 'Your share', min_contract_cents: 'Minimum contract' }[k] || k);
export const fmtTerm = (k, v, cur = 'USD') => ({ percent: v + '%', cookie_days: v + ' days', rate_cents: money(v, cur), per: 'per ' + v, share_percent: v + '%', min_contract_cents: money(v, cur) }[k] ?? v);

export default function Offer({ id }) {
  const { S, a } = useStore();
  const [demo, setDemo] = useState(false), [pick, setPick] = useState(null);
  const o = offerOf(S, id); if (!o) { go('feed'); return null; }
  const p = prodOf(S, o.pid), T = TYPES[o.type], F = o.fin, mine = a.isMine(o), e = elig(o);
  const ints = S.interests.filter(i => i.offer === o.id), deal = a.dealFor(o), mi = a.myInterest(o);
  const left = F.budget == null ? null : Math.max(0, F.budget - F.spent), full = F.budget != null && left === 0;
  const fee = F.budget ? Math.round(F.budget * FEE / 10000) : 0;
  const cvs = S.deals.filter(d => d.offer === o.id).flatMap(d => d.dels.filter(x => x.video));

  const cta = mine ? <Button tone="soft" block onClick={() => a.toggleOffer(o)}>{o.status === 'open' ? 'Pause offer' : 'Reopen offer'}</Button>
    : deal ? <Button block onClick={() => go('chats-' + deal.id)}><Ic.Chat width="20" height="20" /> Open chat</Button>
    : mi ? <Button tone="sage" block onClick={() => a.withdraw(o)}><Ic.Check width="20" height="20" /> Applied · tap to withdraw</Button>
    : !e.ok ? <Button block disabled>You don't meet the requirements</Button>
    : full ? <Button block disabled>The budget is used up</Button>
    : <Button block onClick={() => a.apply(o)}>Apply</Button>;
  const visit = p.url && <Button tone="soft" onClick={() => { try { window.open(p.url, '_blank', 'noopener'); } catch {} }}><Ic.Visit width="20" height="20" /> Visit</Button>;

  return (
    <Page title={o.title} crumb={mine ? 'Your offer' : 'Offer'} onBack={() => back('feed')} wide>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          <Gallery p={p} onDemo={() => setDemo(true)} />
          <div>
            <div className="mb-3 flex gap-2"><Tag s={o.status} /><Chip>{CATS[p.category]}</Chip></div>
            <h1 className="font-serif text-[28px] leading-9 text-army md:text-[32px] md:leading-10">{o.title}</h1>
            <div className="mt-2 text-sm text-ink-soft">{o.co}{o.coV ? ' · verified seller' : ''} · {p.name}</div>
          </div>
          <Card title="About this offer"><p className="text-[15px] leading-7">{o.desc}</p></Card>
          {mine ? (
            <Card title="Interests" sub={ints.length ? 'Tap one to accept or deny.' : 'Nobody has applied yet.'}>
              <div className="-mx-2 flex flex-col">{ints.map(i => { const q = PEOPLE[i.from] || { name: i.from }; return (
                <button key={i.id} onClick={() => setPick(i)} className="flex h-[72px] items-center gap-3 rounded-2xl px-2 text-left transition hover:bg-cream-50"><Avatar name={q.name} /><div className="min-w-0 flex-1"><div className="font-semibold">{q.name}{q.verified ? ' ✓' : ''}</div><div className="text-xs text-ink-soft">{(q.followers || 0).toLocaleString()} followers · {q.country}</div></div><Tag s={i.status} /></button>); })}</div>
            </Card>
          ) : <Steps title="How it works" sub="Terms are frozen the moment the seller accepts you." steps={HOW[o.type]} />}
          {!mine && (
            <Card title="Requirements">
              <ul className="flex flex-col gap-4">{(e.res.length ? e.res : [{ ok: true, t: 'Open to every marketer', you: '' }]).map(x => (
                <li key={x.t} className="flex gap-3"><span className={'grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ' + (x.ok ? 'bg-sage-100 text-[#2f5a14]' : 'bg-[#F6D9CF] text-[#9b3a1c]')}>{x.ok ? '✓' : '✕'}</span><div><div className="text-[15px] font-semibold leading-6">{x.t}</div>{x.you && <div className="text-xs text-ink-soft">{x.you}</div>}</div></li>))}</ul>
            </Card>
          )}
          {cvs.length > 0 && <Card title="Creator videos" sub={cvs.length + ' from marketers on this offer'}><div className="flex gap-3">{cvs.map(v => <button key={v.id} onClick={() => setDemo(true)} className="relative h-[72px] w-24 overflow-hidden rounded-2xl"><ProductArt p={p} className="h-full w-full" /><span className="absolute inset-0 grid place-items-center text-white"><Ic.Play /></span></button>)}</div></Card>}
          <Card title="Terms"><Rows rows={[...Object.entries(o.terms).map(([k, v]) => [fieldLabel(k), fmtTerm(k, v, F.cur)]), ['Product', p.name + ' · ' + CATS[p.category]]]} /></Card>
        </div>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
          <Card>
            <div className="font-serif text-5xl leading-none">{T.reward(o.terms)}</div>
            <div className="mb-5 mt-2 text-sm font-semibold text-ink-soft">{T.sub(o.terms)}</div>
            <Rows rows={[['Budget left', left == null ? 'No cap' : money(left, F.cur)], ['Max per marketer', F.cap ? money(F.cap, F.cur) : 'None'], ['Type', T.name]]} />
            <div className="mt-5 hidden gap-3 lg:flex">{cta}{visit}</div>
            <p className="mt-4 flex gap-2 text-xs leading-4 text-ink-soft"><Ic.Shield width="16" height="16" className="shrink-0" />{mine ? 'You can pause or reopen this any time.' : 'The seller reviews every application. Your terms are frozen once accepted.'}</p>
          </Card>
          {mine && (
            <Card title="Financials" sub={F.budget ? (F.funded ? 'Funded and open' : 'Waiting for payment') : 'No budget set'}>
              {F.budget ? (<><div className="mb-4 h-2 overflow-hidden rounded-full bg-cream-100"><i className="block h-full rounded-full bg-army" style={{ width: Math.min(100, Math.round(F.spent / F.budget * 100)) + '%' }} /></div>
                <Rows rows={[['Spent', money(F.spent, F.cur) + ' of ' + money(F.budget, F.cur)], ['Listing fee (' + FEE / 100 + '%)', money(fee, F.cur)], ['Paid in', money(F.funded ? F.budget + fee : 0, F.cur)]]} /></>) : <p className="text-sm text-ink-soft">You settle payouts directly with each marketer.</p>}
            </Card>
          )}
        </aside>
      </div>
      {!mine && S.role === 'marketer' ? <ActionBar>{cta}{visit}</ActionBar> : <ActionBar>{cta}</ActionBar>}
      <Sheet open={demo} onClose={() => setDemo(false)} title={p.name + ' demo'}><Player p={p} sub={(p.video || '0:30') + ' · from ' + o.co} /></Sheet>
      <Sheet open={!!pick} onClose={() => setPick(null)} title={pick && (PEOPLE[pick.from] || { name: pick.from }).name} sub={pick && 'Applied to ' + o.title}>
        {pick && (() => { const q = PEOPLE[pick.from] || { name: pick.from }; return (<>
          <div className="grid grid-cols-3 gap-3 text-center">{[[(q.followers || 0).toLocaleString(), 'Followers'], [q.country, 'Country'], [q.verified ? 'Yes' : 'No', 'Verified']].map(([v, l]) => <div key={l} className="rounded-2xl bg-cream-50 p-3"><div className="font-bold">{v}</div><div className="text-xs text-ink-soft">{l}</div></div>)}</div>
          <p className="rounded-2xl bg-cream-50 p-4 text-sm leading-6">“{pick.msg}”</p>
          <p className="text-sm text-ink-soft">{q.socials}</p>
          {pick.status === 'pending' ? (<><Button block onClick={() => { const d = a.accept(pick); setPick(null); go('chats-' + d); }}>Accept and open chat</Button><Button tone="soft" block onClick={() => { a.deny(pick); setPick(null); }}>Deny</Button><p className="text-xs text-ink-soft">Accepting freezes today's terms into the deal.</p></>) : <Tag s={pick.status} />}</>); })()}
      </Sheet>
    </Page>
  );
}
